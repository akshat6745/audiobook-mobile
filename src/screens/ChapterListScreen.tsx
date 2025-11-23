import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { chapterAPI, userAPI } from '../services/api';
import { Chapter, Novel, RootStackParamList, UserProgress } from '../types';
import { useAuth } from '../context/AuthContext';

type ChapterListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChapterList'>;
type ChapterListScreenRouteProp = RouteProp<RootStackParamList, 'ChapterList'>;

interface Props {
  navigation: ChapterListScreenNavigationProp;
  route: ChapterListScreenRouteProp;
}

const ChapterListScreen: React.FC<Props> = ({ navigation, route }) => {
  const { novel } = route.params;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastReadChapter, setLastReadChapter] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadChapters();
    loadUserProgress();
  }, []);

  const loadChapters = async (page: number = 1) => {
    try {
      if (page === 1) setIsLoading(true);

      const chapterData = await chapterAPI.getChaptersList(novel.title, page);

      if (page === 1) {
        setChapters(chapterData.chapters);
      } else {
        setChapters(prev => [...prev, ...chapterData.chapters]);
      }

      setCurrentPage(chapterData.current_page);
      setTotalPages(chapterData.total_pages);
    } catch (error) {
      console.error('Error loading chapters:', error);

      // Load demo chapters if backend is not available
      const demoChapters: Chapter[] = Array.from({ length: novel.chapterCount || 10 }, (_, i) => ({
        chapterNumber: i + 1,
        chapterTitle: `Chapter ${i + 1}: Demo Chapter Title`,
        id: `demo-chapter-${i + 1}`
      }));

      setChapters(demoChapters.slice(0, 10)); // Show first 10 chapters
      setCurrentPage(1);
      setTotalPages(Math.ceil(demoChapters.length / 10));

      Alert.alert(
        'Demo Mode',
        'Loading demo chapters. Connect to AudioBookPython backend for real chapter data.'
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadUserProgress = async () => {
    if (!user) return;

    try {
      const progress = await userAPI.getNovelProgress(novel.title, user);
      setLastReadChapter(progress.lastChapterRead);
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChapters(1);
  };

  const loadMoreChapters = async () => {
    if (currentPage < totalPages && !isLoading) {
      await loadChapters(currentPage + 1);
    }
  };

  const handleChapterPress = (chapter: Chapter, mode: 'read' | 'audio') => {
    if (mode === 'read') {
      navigation.navigate('Reader', { novel, chapter });
    } else {
      navigation.navigate('AudioPlayer', { novel, chapter });
    }
  };

  const renderChapter = ({ item }: { item: Chapter }) => {
    const isLastRead = lastReadChapter === item.chapterNumber;

    return (
      <View style={styles.chapterCard}>
        <TouchableOpacity
          style={[styles.chapterInfo, isLastRead && styles.lastReadChapter]}
          onPress={() => handleChapterPress(item, 'read')}
        >
          <View style={styles.chapterHeader}>
            <Text style={styles.chapterNumber}>
              Chapter {item.chapterNumber}
            </Text>
            {isLastRead && (
              <View style={styles.lastReadBadge}>
                <Text style={styles.lastReadText}>LAST READ</Text>
              </View>
            )}
          </View>
          <Text style={styles.chapterTitle} numberOfLines={2}>
            {item.chapterTitle}
          </Text>
        </TouchableOpacity>

        <View style={styles.chapterActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleChapterPress(item, 'read')}
          >
            <MaterialIcons name="book" size={20} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleChapterPress(item, 'audio')}
          >
            <MaterialIcons name="headset" size={20} color="#FF9800" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFooter = () => {
    if (currentPage >= totalPages) return null;

    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreChapters}>
        <Text style={styles.loadMoreText}>Load More Chapters</Text>
        <MaterialIcons name="keyboard-arrow-down" size={20} color="#2196F3" />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="menu-book" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>No chapters available</Text>
      <Text style={styles.emptyStateSubtext}>
        Chapters will appear here once they're loaded
      </Text>
    </View>
  );

  if (isLoading && chapters.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading chapters...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.novelTitle} numberOfLines={2}>
          {novel.title}
        </Text>
        {novel.author && (
          <Text style={styles.novelAuthor}>by {novel.author}</Text>
        )}
        {novel.chapterCount && (
          <Text style={styles.chapterCount}>
            {novel.chapterCount} chapters total
          </Text>
        )}
      </View>

      <FlatList
        data={chapters}
        renderItem={renderChapter}
        keyExtractor={(item) => `${item.chapterNumber}`}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  novelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  novelAuthor: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  chapterCount: {
    fontSize: 14,
    color: '#888',
  },
  listContainer: {
    flexGrow: 1,
    padding: 15,
  },
  chapterCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chapterInfo: {
    flex: 1,
    padding: 15,
  },
  lastReadChapter: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  chapterNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  lastReadBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lastReadText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  chapterTitle: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  chapterActions: {
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  actionButton: {
    padding: 10,
    marginVertical: 5,
  },
  loadMoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  loadMoreText: {
    color: '#2196F3',
    fontWeight: 'bold',
    marginRight: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

export default ChapterListScreen;