import { db, storage } from '@/firebaseconfig';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
// Avoid using nanoid in React Native to prevent Web Crypto dependency issues

export type ClassFolder = {
  id: string;
  name: string;
  createdAt: any;
};

export type ClassDoc = {
  code: string;
  createdAt: any;
  folders: ClassFolder[];
};

export type FileDoc = {
  id: string;
  classCode: string;
  folderId: string;
  name: string;
  url: string;
  path: string;
  uploadedAt: any;
};

const CLASSES = 'classes';
const FILES = 'files';

function generateClassCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i += 1) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function createClass(): Promise<ClassDoc> {
  let code = generateClassCode();
  // Ensure uniqueness by checking existing doc id; retry a few times if collision
  for (let attempts = 0; attempts < 3; attempts += 1) {
    const existing = await getDoc(doc(db, CLASSES, code));
    if (!existing.exists()) break;
    code = generateClassCode();
  }

  const classRef = doc(db, CLASSES, code);
  const payload: ClassDoc = {
    code,
    createdAt: serverTimestamp(),
    folders: [],
  } as any;
  await setDoc(classRef, payload);
  return { ...payload };
}

export function listenToClasses(cb: (items: ClassDoc[]) => void) {
  const q = query(collection(db, CLASSES), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const items: ClassDoc[] = snap.docs.map((d) => ({
      ...(d.data() as any),
    }));
    cb(items);
  });
}

export function listenToClass(code: string, cb: (item: ClassDoc | null) => void) {
  const refDoc = doc(db, CLASSES, code);
  return onSnapshot(refDoc, (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb(snap.data() as ClassDoc);
  });
}

export async function createFolder(classCode: string, name: string): Promise<ClassFolder> {
  const classRef = doc(db, CLASSES, classCode);
  const snap = await getDoc(classRef);
  if (!snap.exists()) throw new Error('Class not found');
  const folders: ClassFolder[] = (snap.data().folders || []) as ClassFolder[];
  const newFolder: ClassFolder = { id: generateId(12), name, createdAt: Date.now() as any };
  const next = [...folders, newFolder];
  await updateDoc(classRef, { folders: next });
  return newFolder;
}

export async function deleteFolder(classCode: string, folderId: string): Promise<void> {
  const classRef = doc(db, CLASSES, classCode);
  const snap = await getDoc(classRef);
  if (!snap.exists()) return;
  const folders: ClassFolder[] = (snap.data().folders || []) as ClassFolder[];
  const next = folders.filter((f) => f.id !== folderId);
  await updateDoc(classRef, { folders: next });

  // Delete files under this folder
  const filesQ = query(collection(db, FILES), where('classCode', '==', classCode), where('folderId', '==', folderId));
  const unsubscribe = onSnapshot(filesQ, async (filesSnap) => {
    const batch = writeBatch(db);
    const deletions: Promise<void>[] = [];
    filesSnap.forEach((d) => {
      const data = d.data() as FileDoc;
      if (data.path) {
        const r = ref(storage, data.path);
        deletions.push(deleteObject(r).catch(() => {}));
      }
      batch.delete(doc(db, FILES, d.id));
    });
    await Promise.allSettled(deletions);
    await batch.commit();
    unsubscribe();
  });
}

export async function renameFolder(classCode: string, folderId: string, newName: string): Promise<void> {
  const classRef = doc(db, CLASSES, classCode);
  const snap = await getDoc(classRef);
  if (!snap.exists()) throw new Error('Class not found');
  const folders: ClassFolder[] = (snap.data().folders || []) as ClassFolder[];
  const next = folders.map((f) => (f.id === folderId ? { ...f, name: newName } : f));
  await updateDoc(classRef, { folders: next });
}

export function listenToFilesForClass(classCode: string, cb: (items: FileDoc[]) => void) {
  const q = query(
    collection(db, FILES),
    where('classCode', '==', classCode)
    // orderBy('uploadedAt', 'desc') // temporarily disable
  );
  return onSnapshot(q, (snap) => {
    const items: FileDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    cb(items);
  });
}

export type UploadInput = { uri: string; name: string; mimeType?: string | null };

export async function uploadFile(classCode: string, folderId: string, file: UploadInput): Promise<FileDoc> {
  const fileId = generateId(12);
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const storagePath = `classes/${classCode}/${folderId}/${fileId}-${safeName}`;
  const storageRef = ref(storage, storagePath);

  const response = await fetch(file.uri);
  const blob = await response.blob();
  await uploadBytes(storageRef, blob, { contentType: file.mimeType || undefined });
  const url = await getDownloadURL(storageRef);

  const payload = {
    id: fileId,
    classCode,
    folderId,
    name: file.name,
    url,
    path: storagePath,
    uploadedAt: serverTimestamp(),
  };
  await setDoc(doc(collection(db, FILES)), payload);
  return payload as FileDoc;
}

export async function deleteFile(fileId: string): Promise<void> {
  // Find by id
  const q = query(collection(db, FILES), where('id', '==', fileId));
  return new Promise((resolve) => {
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        unsub();
        resolve();
        return;
      }
      const d = snap.docs[0];
      const data = d.data() as FileDoc;
      if (data.path) {
        const r = ref(storage, data.path);
        await deleteObject(r).catch(() => {});
      }
      await deleteDoc(d.ref);
      unsub();
      resolve();
    });
  });
}

export async function renameFile(fileId: string, newName: string): Promise<void> {
  const q = query(collection(db, FILES), where('id', '==', fileId));
  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(q, async (snap) => {
      try {
        if (snap.empty) {
          unsub();
          resolve();
          return;
        }
        const d = snap.docs[0];
        await updateDoc(d.ref, { name: newName });
        unsub();
        resolve();
      } catch (err) {
        unsub();
        reject(err);
      }
    });
  });
}

export function formatDate(ts: any): string {
  try {
    if (!ts) return '';
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return date.toLocaleString();
  } catch {
    return '';
  }
}


