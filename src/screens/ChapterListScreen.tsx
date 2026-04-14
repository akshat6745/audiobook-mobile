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
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { chapterAPI, userAPI, imageAPI } from '../services/api';
import { Chapter, Novel, RootStackParamList, UserProgress } from '../types';
import { useAuth } from '../context/AuthContext';
import { useProgress } from '../context/ProgressContext';
import { useAudio } from '../context/AudioContext';
import { useDownload } from '../context/DownloadContext';
import DownloadButton from '../components/DownloadButton';
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { progressMap } = useProgress();
  // Try novel slug first (new standard), then fallback to novel title (old format)
  const lastReadChapter = progressMap[novel.slug] || progressMap[novel.title] || null;
  const { user } = useAuth();
  const { narratorVoice, dialogueVoice } = useAudio();
  const { isChapterDownloaded, activeDownloads, downloadedChapters } = useDownload();

  useEffect(() => {
    loadChapters(1);
  }, []);

  const loadChapters = async (pageNum = 1, isRefresh = false) => {
    try {
      if (pageNum === 1 && !isRefresh) {
        setIsLoading(true);
      } else if (pageNum > 1) {
        setIsLoadingMore(true);
      }

      const chapterData = await chapterAPI.getChaptersList(novel.slug, pageNum);

      if (pageNum === 1) {
        setChapters(chapterData.chapters);
      } else {
        setChapters(prev => [...prev, ...chapterData.chapters]);
      }

      setTotalPages(chapterData.total_pages || 1);
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading chapters:', error);

      // Load demo chapters if backend is not available
      const demoChapters: Chapter[] = Array.from({ length: novel.chapterCount || 10 }, (_, i) => ({
        chapterNumber: i + 1,
        chapterTitle: `Chapter ${i + 1}: Demo Chapter Title`,
        id: `demo-chapter-${i + 1}`,
        slug: 'demo-chapter-${i + 1}',
        author: 'demo-author',
        chapterCount: 10,
        description: 'demo-description',
        source: 'demo-source',
      }));

      if (pageNum === 1) {
        setChapters(demoChapters);
        setTotalPages(1);
        Alert.alert(
          'Demo Mode',
          'Loading demo chapters. Connect to AudioBookPython backend for real chapter data.'
        );
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };



  const onRefresh = async () => {
    setRefreshing(true);
    await loadChapters(1, true);
    setRefreshing(false);
  };

  const loadMoreChapters = () => {
    if (!isLoadingMore && !isLoading && page < totalPages) {
      loadChapters(page + 1);
    }
  };

  const handleChapterPress = useCallback((chapter: Chapter) => {
    navigation.navigate('Reader', { novel, chapter });
  }, [navigation, novel]);


  const getChapterDownloadStatus = (chapterNumber: number) => {
    // Find active download for this chapter
    const activeDownload = Array.from(activeDownloads.values()).find(
      download => downloadedChapters.some(
        dc => dc.downloadId === download.download_id &&
              dc.novelName === novel.slug &&
              dc.chapterNumber === chapterNumber
      )
    );

    return activeDownload;
  };

  const renderChapterCard = (item: Chapter, isLastRead: boolean) => {
    const isOfflineAvailable = isChapterDownloaded(novel.slug, item.chapterNumber);
    const activeDownload = getChapterDownloadStatus(item.chapterNumber);

    return (
      <View style={styles.chapterCard}>
        <TouchableOpacity
          style={[styles.chapterContent, isLastRead && styles.lastReadChapter]}
          onPress={() => handleChapterPress(item)}
        >
          <View style={styles.chapterHeader}>
            <View style={styles.chapterNumberRow}>
              <Text style={styles.chapterNumber}>
                Chapter {item.chapterNumber}
              </Text>
              {activeDownload && (
                <View style={styles.progressIndicator}>
                  <Text style={styles.progressText}>
                    {Math.round(activeDownload.progress)}%
                  </Text>
                </View>
              )}
              {!activeDownload && isOfflineAvailable && (
                <MaterialIcons name="offline-pin" size={16} color="#4CAF50" />
              )}
            </View>
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
        <DownloadButton
          novelName={novel.slug}
          chapterNumber={item.chapterNumber}
          chapterTitle={item.chapterTitle}
          narratorVoice={narratorVoice}
          dialogueVoice={dialogueVoice}
          size="small"
          style={styles.downloadButton}
        />
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

  const renderChapter = ({ item }: { item: Chapter }) => {
    const isLastRead = lastReadChapter === item.chapterNumber;
    return renderChapterCard(item, isLastRead);
  };

  const renderHeader = () => {
    let lastReadChapterItem = chapters.find(c => c.chapterNumber === lastReadChapter);

    // Create a dummy chapter object so we can navigate to the progress even
    // if the chapter data isn't loaded on the current page
    if (!lastReadChapterItem && lastReadChapter) {
      lastReadChapterItem = {
        chapterNumber: lastReadChapter,
        chapterTitle: `Chapter ${lastReadChapter}`,
        id: `continue-${lastReadChapter}`,
      } as Chapter;
    }

    return (
      <View>
        {lastReadChapterItem && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Continue Reading</Text>
            {renderChapterCard(lastReadChapterItem, true)}
          </View>
        )}
        <Text style={styles.sectionTitle}>All Chapters</Text>
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
        <View style={styles.headerRow}>
          <Image
            source={{ uri: imageAPI.getNovelCoverUrl(novel.slug) }}
            style={styles.headerCover}
            resizeMode="cover"
          />
          <View style={styles.headerInfo}>
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
        </View>
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
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreChapters}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={{ padding: Theme.spacing.md }}>
              <ActivityIndicator color={Theme.colors.primary[500]} />
            </View>
          ) : null
        }
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerCover: {
    width: 85,
    height: 120,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: Theme.spacing.md,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
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
  chapterNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  downloadButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    minWidth: 60,
  },
  progressIndicator: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 36,
    alignItems: 'center',
  },
  progressText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
  sectionContainer: {
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: Theme.typography.fontSizes.lg,
    fontWeight: Theme.typography.fontWeights.bold,
    color: Theme.colors.neutral.white,
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
  },
});

export default ChapterListScreen;