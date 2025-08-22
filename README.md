# ClassFileOrganizer (Expo + Firebase)

Minimal cross‑platform app to create classes, organize folders, upload files to Firebase Storage, and see real‑time updates via Firestore. No auth. QR code per class for easy sharing.

## Features

- Classes list with auto‑generated 6‑char class codes and QR codes
- Inside a class: folders and files with real‑time sync
- CRUD: create/rename/delete folders and files
- Upload files (PDF/DOCX/ZIP/other) to Firebase Storage
- Clean UI using React Native Paper; floating action menu

## Tech

- Expo SDK 53, Expo Router
- Firebase JS SDK (Firestore + Storage)
- react-native-paper, react-native-svg, react-native-qrcode-svg
- expo-document-picker

## Quick start

1. Install deps

```bash
npm install
```

2. Configure Firebase

- Update `firebaseconfig.ts` with your Firebase project keys (already scaffolded). Ensure Firestore and Storage are enabled in Firebase console.

3. Required Firestore index

- Create a composite index for listing files:
  - Collection: `files`
  - Fields: `classCode` Asc, `uploadedAt` Desc
  - Scope: Collection
  - You can follow the console link shown in runtime errors if prompted.

4. Run the app

```bash
npx expo start
```

Pick Android or iOS. For native modules, use a development build if needed:

```bash
npx expo run:android
# or
npx expo run:ios
```

## Usage

- Home: Tap “New Class” to create one. Tap a class card to open.
- Class screen:
  - Plus button → New Folder or Upload File (select folder then pick a file)
  - Three‑dot menu on folders/files → Rename or Delete
  - QR code shown in header area for sharing code

## Data model

Firestore

```ts
// Collection: classes (doc id = classCode)
Class {
  code: string,
  createdAt: Timestamp,
  folders: { id: string, name: string, createdAt: number|Timestamp }[]
}

// Collection: files (auto id)
File {
  id: string,
  classCode: string,
  folderId: string,
  name: string,
  url: string,
  path: string, // storage path
  uploadedAt: Timestamp
}
```

Storage

```
classes/{classCode}/{folderId}/{fileId}-{safeName}
```

## Notes

- Firestore in RN uses long‑polling: see `initializeFirestore` options in `firebaseconfig.ts`.
- If uploads fail on emulator, verify network and Storage rules.
- No authentication; access is by knowing the class code.

## Scripts

```bash
npm start           # expo start
npm run android     # open Android
npm run ios         # open iOS
```
