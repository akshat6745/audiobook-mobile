import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { chapterAPI, userAPI } from '../services/api';
import { Chapter, Novel, RootStackParamList, UserProgress } from '../types';
import { useAuth } from '../context/AuthContext';
import Theme from '../styles/theme';

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
  const [lastReadChapter, setLastReadChapter] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadChapters();
    loadUserProgress();
  }, []);

  const loadChapters = async () => {
    try {
      setIsLoading(true);
      const chapterData = await chapterAPI.getChaptersList(novel.title, 1);
      setChapters(chapterData.chapters);
    } catch (error) {
      console.error('Error loading chapters:', error);

      // Load demo chapters if backend is not available
      const demoChapters: Chapter[] = Array.from({ length: novel.chapterCount || 10 }, (_, i) => ({
        chapterNumber: i + 1,
        chapterTitle: `Chapter ${i + 1}: Demo Chapter Title`,
        id: `demo-chapter-${i + 1}`
      }));

      setChapters(demoChapters);
      Alert.alert(
        'Demo Mode',
        'Loading demo chapters. Connect to AudioBookPython backend for real chapter data.'
      );
    } finally {
      setIsLoading(false);
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
    await loadChapters();
    setRefreshing(false);
  };

  const handleChapterPress = useCallback((chapter: Chapter) => {
    navigation.navigate('Reader', { novel, chapter });
  }, [navigation, novel]);

  const renderChapter = ({ item }: { item: Chapter }) => {
    const isLastRead = lastReadChapter === item.chapterNumber;

    return (
      <View style={styles.chapterCard}>
        <TouchableOpacity
          style={[styles.chapterContent, isLastRead && styles.lastReadChapter]}
          onPress={() => handleChapterPress(item)}
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
            style={[styles.actionButton, styles.readButton]}
            onPress={() => handleChapterPress(item)}
          >
            <MaterialIcons name="book" size={20} color={Theme.colors.primary[600]} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="menu-book" size={64} color={Theme.colors.neutral[300]} />
      <Text style={styles.emptyStateText}>No chapters available</Text>
      <Text style={styles.emptyStateSubtext}>
        Chapters will appear here once they're loaded
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[Theme.colors.primary[500], Theme.colors.primary[700]]}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color={Theme.colors.neutral.white} />
          <Text style={styles.loadingText}>Loading chapters...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[Theme.colors.primary[500], Theme.colors.primary[700]]}
        style={styles.header}
      >
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
      </LinearGradient>

      {/* Chapter List */}
      <FlatList
        data={chapters}
        renderItem={renderChapter}
        keyExtractor={(item) => `${item.chapterNumber}`}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary[500]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
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
  novelTitle: {
    fontSize: Theme.typography.fontSizes.xl,
    fontWeight: Theme.typography.fontWeights.bold,
    color: Theme.colors.neutral.white,
    marginBottom: Theme.spacing.xs,
  },
  novelAuthor: {
    fontSize: Theme.typography.fontSizes.md,
    color: Theme.colors.neutral.white + 'DD',
    marginBottom: Theme.spacing.xs,
  },
  chapterCount: {
    fontSize: Theme.typography.fontSizes.sm,
    color: Theme.colors.neutral.white + 'CC',
  },
  listContainer: {
    flexGrow: 1,
    padding: Theme.spacing.lg,
  },
  chapterCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: Theme.borderRadius.xl,
    marginBottom: Theme.spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Theme.shadows.md,
  },
  chapterContent: {
    flex: 1,
    padding: Theme.spacing.lg,
  },
  lastReadChapter: {
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.success[500],
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  chapterNumber: {
    fontSize: Theme.typography.fontSizes.sm,
    fontWeight: Theme.typography.fontWeights.bold,
    color: '#64b5f6',
  },
  lastReadBadge: {
    backgroundColor: Theme.colors.success[500],
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
  },
  lastReadText: {
    fontSize: Theme.typography.fontSizes.xs,
    color: Theme.colors.neutral.white,
    fontWeight: Theme.typography.fontWeights.bold,
  },
  chapterTitle: {
    fontSize: Theme.typography.fontSizes.md,
    color: '#fff',
    lineHeight: Theme.typography.lineHeights.normal * Theme.typography.fontSizes.md,
    fontWeight: Theme.typography.fontWeights.medium,
  },
  chapterActions: {
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: Theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readButton: {
    backgroundColor: Theme.colors.primary[100],
  },

  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: Theme.typography.fontSizes.lg,
    color: Theme.colors.neutral.white,
    fontWeight: Theme.typography.fontWeights.medium,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing['4xl'],
  },
  emptyStateText: {
    fontSize: Theme.typography.fontSizes.lg,
    fontWeight: Theme.typography.fontWeights.semibold,
    color: '#fff',
    textAlign: 'center',
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: Theme.typography.fontSizes.md,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeights.relaxed * Theme.typography.fontSizes.md,
  },
});

export default ChapterListScreen;