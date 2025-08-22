import {
  ClassDoc,
  ClassFolder,
  FileDoc,
  createFolder,
  deleteFile,
  deleteFolder,
  formatDate,
  listenToClass,
  listenToFilesForClass,
  uploadFile,
} from '@/services/firebaseData';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Appbar, Button, Dialog, Divider, FAB, IconButton, List, MD3Colors, Menu, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

export default function ClassScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const classCode = String(code);

  const [clazz, setClazz] = useState<ClassDoc | null>(null);
  const [files, setFiles] = useState<FileDoc[]>([]);
  const [snack, setSnack] = useState<string | null>(null);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [busy, setBusy] = useState(false);
  const [renameState, setRenameState] = useState<{ type: 'folder' | 'file'; id: string; value: string } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ id: string; type: 'folder' | 'file'; x: number; y: number } | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [chooseFolderModal, setChooseFolderModal] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [folderOptionsModal, setFolderOptionsModal] = useState<{ folder: ClassFolder } | null>(null);

  useEffect(() => {
    const unsubA = listenToClass(classCode, setClazz);
    const unsubB = listenToFilesForClass(classCode, setFiles);
    return () => {
      unsubA();
      unsubB();
    };
  }, [classCode]);

  async function onCreateFolder() {
    if (!folderName.trim()) return;
    try {
      setBusy(true);
      await createFolder(classCode, folderName.trim());
      setFolderName('');
      setFolderModal(false);
    } catch (e: any) {
      setSnack(e?.message || 'Failed to create folder');
    } finally {
      setBusy(false);
    }
  }

  async function onPickAndUpload(folderId: string) {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', '*/*'],
      });
      if (res.canceled) return;
      const file = res.assets[0];
      const name = file.name || 'file';
      const uri = file.uri;
      await uploadFile(classCode, folderId, { uri, name, mimeType: file.mimeType });
      setSnack('File uploaded');
    } catch (e: any) {
      setSnack(e?.message || 'Upload failed');
    }
  }

  function confirmDeleteFolder(folder: ClassFolder) {
    Alert.alert('Delete folder', `Delete folder "${folder.name}" and its files?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteFolder(classCode, folder.id); setSnack('Folder deleted'); } catch (e: any) { setSnack(e?.message || 'Failed'); }
      } },
    ]);
  }

  function confirmDeleteFile(file: FileDoc) {
    Alert.alert('Delete file', `Delete file "${file.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteFile(file.id); setSnack('File deleted'); } catch (e: any) { setSnack(e?.message || 'Failed'); }
      } },
    ]);
  }

  const folders: ClassFolder[] = useMemo(() => clazz?.folders || [], [clazz]);

  return (
    <View style={styles.container}>
      {/* Top app bar with QR */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={`Class ${classCode}`} />
        <Appbar.Action icon="qrcode" onPress={() => setQrVisible(true)} />
      </Appbar.Header>

      <FlatList
        data={folders}
        keyExtractor={(f) => f.id}
        contentContainerStyle={folders.length === 0 ? [styles.emptyContainer, styles.listPadBottom] : styles.listPadBottom}
        ListHeaderComponent={null}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={<Text style={styles.emptyText}>No folders yet. Create one.</Text>}
        renderItem={({ item }) => (
          <List.Accordion
            title={item.name}
            left={(props) => <List.Icon {...props} icon="folder" />}
            onLongPress={() => setFolderOptionsModal({ folder: item })}
          >
            <View style={styles.folderActions} />
            {files.filter((f) => f.folderId === item.id).map((file) => (
              <List.Item
                key={file.id}
                title={file.name}
                description={formatDate(file.uploadedAt)}
                left={(props) => <List.Icon {...props} icon="file" />}
                right={() => (
                  <Menu
                    visible={menuAnchor?.id === file.id && menuAnchor?.type === 'file'}
                    onDismiss={() => setMenuAnchor(null)}
                    anchor={<IconButton icon="dots-vertical" onPress={() => setMenuAnchor({ id: file.id, type: 'file', x: 0, y: 0 })} />}
                  >
                    <Menu.Item onPress={() => { setRenameState({ type: 'file', id: file.id, value: file.name }); setMenuAnchor(null); }} title="Rename" />
                    <Menu.Item onPress={() => { setMenuAnchor(null); confirmDeleteFile(file); }} title="Delete" titleStyle={{ color: MD3Colors.error50 }} />
                  </Menu>
                )}
              />
            ))}
          </List.Accordion>
        )}
      />
      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'close' : 'plus'}
        actions={[
          { icon: 'folder-plus', label: 'New Folder', onPress: () => setFolderModal(true) },
          { icon: 'upload', label: 'Upload File', onPress: () => setChooseFolderModal(true) },
        ]}
        onStateChange={({ open }) => setFabOpen(open)}
      />

      <Portal>
        {/* QR and class code dialog */}
        <Dialog visible={qrVisible} onDismiss={() => setQrVisible(false)}>
          <Dialog.Title>Class Code</Dialog.Title>
          <Dialog.Content>
            <View style={{ alignItems: 'center' }}>
              <QRCode value={classCode} size={160} />
              <Text selectable style={{ marginTop: 12, fontSize: 18, fontWeight: '700' }}>{classCode}</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQrVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
        {/* Rename dialog */}
        <Dialog visible={!!renameState} onDismiss={() => setRenameState(null)}>
          <Dialog.Title>Rename {renameState?.type === 'folder' ? 'Folder' : 'File'}</Dialog.Title>
          <Dialog.Content>
            <TextInput label="New name" value={renameState?.value || ''} onChangeText={(t) => setRenameState((s) => (s ? { ...s, value: t } : s))} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameState(null)}>Cancel</Button>
            <Button onPress={async () => {
              if (!renameState) return;
              try {
                if (renameState.type === 'folder') {
                  // rename folder
                  const { renameFolder } = await import('@/services/firebaseData');
                  await renameFolder(classCode, renameState.id, renameState.value.trim());
                } else {
                  const { renameFile } = await import('@/services/firebaseData');
                  await renameFile(renameState.id, renameState.value.trim());
                }
                setRenameState(null);
              } catch (e: any) {
                setSnack(e?.message || 'Rename failed');
              }
            }}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={folderModal} onDismiss={() => setFolderModal(false)}>
          <Dialog.Title>New Folder</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Folder name" value={folderName} onChangeText={setFolderName} autoFocus />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFolderModal(false)}>Cancel</Button>
            <Button loading={busy} onPress={onCreateFolder}>Create</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Choose folder for upload */}
        <Dialog visible={chooseFolderModal} onDismiss={() => setChooseFolderModal(false)}>
          <Dialog.Title>Select Folder</Dialog.Title>
          <Dialog.Content>
            {folders.length === 0 ? (
              <Text>No folders yet. Create one first.</Text>
            ) : (
              <>
                {folders.map((f) => (
                  <List.Item key={f.id} title={f.name} left={(p) => <List.Icon {...p} icon="folder" />} onPress={async () => {
                    setChooseFolderModal(false);
                    await onPickAndUpload(f.id);
                  }} />
                ))}
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setChooseFolderModal(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Folder options dialog */}
        <Dialog visible={!!folderOptionsModal} onDismiss={() => setFolderOptionsModal(null)}>
          <Dialog.Title>Folder Options</Dialog.Title>
          <Dialog.Content>
            <Text>What would you like to do with "{folderOptionsModal?.folder.name}"?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFolderOptionsModal(null)}>Cancel</Button>
            <Button onPress={() => {
              if (folderOptionsModal) {
                setRenameState({ type: 'folder', id: folderOptionsModal.folder.id, value: folderOptionsModal.folder.name });
                setFolderOptionsModal(null);
              }
            }}>Rename</Button>
            <Button textColor={MD3Colors.error50} onPress={() => {
              if (folderOptionsModal) {
                setFolderOptionsModal(null);
                confirmDeleteFolder(folderOptionsModal.folder);
              }
            }}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2400}>{snack}</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBox: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  code: { fontSize: 20, fontWeight: '700' },
  section: { paddingHorizontal: 8 },
  folderActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#666' },
  listPadBottom: { paddingBottom: 96 },
});


