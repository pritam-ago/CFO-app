import { ClassDoc, createClass, joinClass, listenToClasses } from '@/services/firebaseData';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Dialog, Divider, FAB, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

export default function HomeScreen() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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

  async function onJoinClass() {
    if (!classCode.trim()) return;
    
    const code = classCode.trim().toUpperCase();
    
    // Validate class code format
    if (code.length !== 6) {
      setSnack('Class code must be exactly 6 characters');
      return;
    }
    
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setSnack('Class code must contain only letters and numbers');
      return;
    }
    
    // Check if user already has access to this class
    const existingClass = classes.find(c => c.code === code);
    if (existingClass) {
      setSnack(`You already have access to class ${code}`);
      setJoinModalVisible(false);
      setClassCode('');
      return;
    }
    
    try {
      setJoining(true);
      const joinedClass = await joinClass(code);
      setJoinSuccess(true);
      
      // Provide haptic feedback for success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setSnack(`Successfully joined class ${joinedClass.code}! You can now access it.`);
      
      // Show success state briefly before navigating
      setTimeout(() => {
        setJoinModalVisible(false);
        setClassCode('');
        setJoinSuccess(false);
        // Navigate to the joined class
        router.push(`/class/${joinedClass.code}`);
      }, 1500);
    } catch (e: any) {
      // Provide haptic feedback for error
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (e?.message?.includes('Class not found')) {
        setSnack('Class not found. Please check the code and try again.');
      } else {
        setSnack(e?.message || 'Failed to join class. Please try again.');
      }
    } finally {
      setJoining(false);
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
        <Appbar.Content 
          title="Classes" 
          subtitle={`Last updated: ${lastRefresh.toLocaleTimeString()}`}
        />
      </Appbar.Header>
      <FlatList
        data={classes}
        keyExtractor={(item) => item.code}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={classes.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.emptyText}>No classes yet. Create one to start.</Text>}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              setSnack('Refreshing classes...');
              // Force refresh by re-fetching
              const unsub = listenToClasses((items) => {
                setClasses(items);
                setRefreshing(false);
                setLastRefresh(new Date());
                setSnack('Classes refreshed!');
              });
              // Clean up after a short delay
              setTimeout(() => unsub(), 1000);
            }}
            colors={['#007AFF']}
            tintColor="#007AFF"
            title="Pull to refresh"
            titleColor="#666"
          />
        }

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
      <FAB icon="plus" style={styles.fab} loading={creating} onPress={onCreateClass} label="New Class" disabled={creating || joining} />
      <FAB icon="login" style={styles.joinFab} onPress={() => setJoinModalVisible(true)} label="Join Class" disabled={creating || joining} />
      
      <Portal>
        <Dialog visible={joinModalVisible} onDismiss={() => {
          setJoinModalVisible(false);
          setClassCode('');
          setJoinSuccess(false);
        }}>
          <Dialog.Title>Join Class</Dialog.Title>
          <Dialog.Content>
            {joining ? (
              <View style={styles.loadingContent}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Joining class...</Text>
              </View>
            ) : joinSuccess ? (
              <View style={styles.successContent}>
                <Text style={styles.successIcon}>✓</Text>
                <Text style={styles.successText}>Successfully joined class!</Text>
                <Text style={styles.successSubtext}>Redirecting to class...</Text>
              </View>
            ) : (
              <>
                <TextInput
                  label="Class Code"
                  value={classCode}
                  onChangeText={(text) => {
                    // Only allow letters and numbers, convert to uppercase
                    const cleanText = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                    setClassCode(cleanText);
                  }}
                  placeholder="ABC123"
                  autoFocus
                  autoCapitalize="characters"
                  maxLength={6}
                  disabled={joining}
                  style={styles.classCodeInput}
                  mode="outlined"
                  dense
                />
                <Text style={styles.helperText}>
                  Enter the 6-character class code (e.g., ABC123)
                </Text>
                <Text style={styles.additionalHelperText}>
                  Ask your teacher or classmate for the class code to join
                </Text>
                {classCode.length > 0 && (
                  <View style={styles.validationContainer}>
                    <Text style={[
                      styles.validationText,
                      classCode.length === 6 ? styles.validationSuccess : styles.validationWarning
                    ]}>
                      {classCode.length === 6 ? '✓ Valid format' : `${classCode.length}/6 characters`}
                    </Text>
                  </View>
                )}
                {classCode.length === 6 && (
                  <View style={styles.readyToJoinContainer}>
                    <Text style={styles.readyToJoinText}>
                      Ready to join class: <Text style={styles.classCodeDisplay}>{classCode}</Text>
                    </Text>
                    <Text style={styles.readyToJoinSubtext}>
                      Click "Join Class {classCode}" to continue
                    </Text>
                  </View>
                )}
                {classCode.length > 0 && classCode.length < 6 && (
                  <View style={styles.codePreview}>
                    <Text style={styles.codePreviewText}>
                      {classCode.padEnd(6, '•').split('').map((char, index) => (
                        <Text key={index} style={[
                          styles.codeChar,
                          char === '•' ? styles.codeCharPlaceholder : styles.codeCharFilled
                        ]}>
                          {char}
                        </Text>
                      ))}
                    </Text>
                  </View>
                )}
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setJoinModalVisible(false);
              setClassCode('');
              setJoinSuccess(false);
            }} disabled={joining}>
              Cancel
            </Button>
            <Button 
              loading={joining} 
              onPress={onJoinClass}
              disabled={!classCode.trim() || joining}
            >
              {joining ? 'Joining...' : `Join Class ${classCode}`}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
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
  joinFab: { position: 'absolute', right: 16, bottom: 100 },
  code: { fontSize: 18, fontWeight: '600' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#666' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },

  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  additionalHelperText: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  classCodeInput: {
    marginBottom: 8,
  },
  codePreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  codePreviewText: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  codeChar: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  codeCharPlaceholder: {
    color: '#ccc',
  },
  codeCharFilled: {
    color: '#333',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    fontSize: 60,
    color: '#4CAF50', // A green color for success
    marginBottom: 10,
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  successSubtext: {
    fontSize: 14,
    color: '#666',
  },

  validationContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  validationText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  validationSuccess: {
    color: '#4CAF50', // Green for success
  },
  validationWarning: {
    color: '#FF9800', // Orange for warning
  },
  readyToJoinContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#e0f7fa', // A light blue background
    borderRadius: 8,
    alignItems: 'center',
  },
  readyToJoinText: {
    fontSize: 14,
    color: '#00796b', // A dark green color for the text
    textAlign: 'center',
  },
  classCodeDisplay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00796b', // A dark green color for the class code
  },
  readyToJoinSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
