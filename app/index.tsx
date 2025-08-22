import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Button, Card, Divider, FAB, Snackbar, Text, ActivityIndicator } from 'react-native-paper';
import { ClassDoc, createClass, listenToClasses } from '@/services/firebaseData';
import QRCode from 'react-native-qrcode-svg';

export default function HomeScreen() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenToClasses((items) => {
      setClasses(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function onCreateClass() {
    try {
      setCreating(true);
      const created = await createClass();
      setSnack(`Created class ${created.code}`);
    } catch (e: any) {
      setSnack(e?.message || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.Content title="Classes" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading classes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Classes" />
      </Appbar.Header>
      <FlatList
        data={classes}
        keyExtractor={(item) => item.code}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={classes.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.emptyText}>No classes yet. Create one to start.</Text>}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => router.push(`/class/${item.code}`)}>
            <Card.Title title={`Class ${item.code}`} subtitle={item.folders?.length ? `${item.folders.length} folder(s)` : 'No folders yet'} />
            <Card.Content>
              <View style={styles.qrRow}>
                <QRCode value={item.code} size={72} />
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text>Code</Text>
                  <Text selectable style={styles.code}>{item.code}</Text>
                  <Button onPress={() => router.push(`/class/${item.code}`)}>Open</Button>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
      />
      <FAB icon="plus" style={styles.fab} loading={creating} onPress={onCreateClass} label="New Class" />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { marginHorizontal: 12, marginVertical: 8 },
  qrRow: { flexDirection: 'row', alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 24 },
  code: { fontSize: 18, fontWeight: '600' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#666' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
});
