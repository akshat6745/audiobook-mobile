import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, StatusBar } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { offlineStorage, OfflineChapter } from '../services/OfflineStorageService';
import { RootStackParamList } from '../types';
import Theme from '../styles/theme';

type DownloadsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

interface Props {
  navigation: DownloadsScreenNavigationProp;
}

const DownloadsScreen: React.FC<Props> = ({ navigation }) => {
  const [downloads, setDownloads] = useState<OfflineChapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadDownloads();
    }, [])
  );

  const loadDownloads = async () => {
    try {
      setIsLoading(true);
      const chapters = await offlineStorage.getAllDownloadedChapters();
      setDownloads(chapters);
    } catch (error) {
      console.error('Error loading downloads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (chapter: OfflineChapter) => {
    Alert.alert(
      'Delete Download',
      `Are you sure you want to delete ${chapter.novelName} - Chapter ${chapter.chapterNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await offlineStorage.deleteChapter(chapter.novelName, chapter.chapterNumber);
            loadDownloads();
          },
        },
      ]
    );
  };

  const handlePress = (chapter: OfflineChapter) => {
    // Navigate to Reader with offline chapter data
    // We need to construct a Chapter and Novel object
    const novel = {
      id: null,
      title: chapter.novelName,
      author: 'Unknown', // We might want to store author in offline metadata too
      chapterCount: null,
      source: 'google_doc' as const,
    };

    const chapterObj = {
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
      id: `offline-${chapter.novelName}-${chapter.chapterNumber}`,
    };

    navigation.navigate('Reader', { novel, chapter: chapterObj });
  };

  const renderItem = ({ item }: { item: OfflineChapter }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handlePress(item)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.novelTitle}>{item.novelName}</Text>
        <Text style={styles.chapterTitle}>
          Chapter {item.chapterNumber}: {item.chapterTitle}
        </Text>
        <Text style={styles.timestamp}>
          Downloaded {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <MaterialIcons name="delete" size={24} color={Theme.colors.error[500]} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="cloud-off" size={64} color={Theme.colors.neutral[300]} />
      <Text style={styles.emptyStateText}>No downloads yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Downloaded chapters will appear here for offline reading
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[Theme.colors.primary[500], Theme.colors.primary[700]]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Downloads</Text>
      </LinearGradient>

      <FlatList
        data={downloads}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.novelName}-${item.chapterNumber}`}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.lg,
  },
  headerTitle: {
    fontSize: Theme.typography.fontSizes['2xl'],
    fontWeight: Theme.typography.fontWeights.bold,
    color: Theme.colors.neutral.white,
  },
  listContainer: {
    padding: Theme.spacing.lg,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#2a2a2a',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Theme.shadows.sm,
  },
  cardContent: {
    flex: 1,
  },
  novelTitle: {
    fontSize: Theme.typography.fontSizes.sm,
    color: Theme.colors.primary[300],
    marginBottom: Theme.spacing.xs,
    fontWeight: Theme.typography.fontWeights.medium,
  },
  chapterTitle: {
    fontSize: Theme.typography.fontSizes.md,
    color: Theme.colors.neutral.white,
    fontWeight: Theme.typography.fontWeights.semibold,
    marginBottom: Theme.spacing.xs,
  },
  timestamp: {
    fontSize: Theme.typography.fontSizes.xs,
    color: Theme.colors.neutral[400],
  },
  deleteButton: {
    padding: Theme.spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyStateText: {
    fontSize: Theme.typography.fontSizes.lg,
    fontWeight: Theme.typography.fontWeights.semibold,
    color: '#fff',
    marginTop: Theme.spacing.md,
  },
  emptyStateSubtext: {
    fontSize: Theme.typography.fontSizes.md,
    color: '#aaa',
    marginTop: Theme.spacing.sm,
  },
});

export default DownloadsScreen;
