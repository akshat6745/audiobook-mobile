import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDownload } from '../context/DownloadContext';
import { DownloadedChapter, Novel, Chapter } from '../types';

// Format a slug like "shadow-slave" → "Shadow Slave" for display
const prettifySlug = (slug: string): string =>
  slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const DownloadsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    downloadedChapters,
    activeDownloads,
    deleteDownload,
    refreshDownloads,
    isLoading,
  } = useDownload();

  // Refresh downloads when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshDownloads();
    }, [refreshDownloads])
  );

  const handleReadChapter = useCallback((download: DownloadedChapter) => {
    // novelName stores the slug (passed as novel.slug from ChapterListScreen)
    const novel: Novel = {
      id: '',
      title: prettifySlug(download.novelName),
      slug: download.novelName,
      author: null,
      chapterCount: null,
      source: 'cloudflare_d1',
      description: null,
    };
    const chapter: Chapter = {
      chapterNumber: download.chapterNumber,
      chapterTitle: download.chapterTitle || `Chapter ${download.chapterNumber}`,
    };
    navigation.navigate('Reader', { novel, chapter });
  }, [navigation]);

  const handleDeleteDownload = useCallback((downloadId: string, chapterTitle: string) => {
    Alert.alert(
      'Delete Download',
      `Are you sure you want to delete "${chapterTitle}"? This will remove all downloaded files.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDownload(downloadId);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete download. Please try again.');
            }
          },
        },
      ]
    );
  }, [deleteDownload]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (totalFiles: number, completedFiles: number): string => {
    return `${completedFiles}/${totalFiles} files`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'processing':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return '#2196F3';
    }
  };

  const getStatusIcon = (status: string): keyof typeof MaterialIcons.glyphMap => {
    switch (status) {
      case 'completed':
        return 'check-circle';
      case 'processing':
        return 'hourglass-empty';
      case 'failed':
        return 'error';
      default:
        return 'download';
    }
  };

  const renderDownloadItem = useCallback((download: DownloadedChapter) => {
    const activeDownload = activeDownloads.get(download.downloadId);
    const currentStatus = activeDownload ? activeDownload.status : download.status;
    const currentProgress = activeDownload ? activeDownload.progress : download.progress;

    return (
      <View key={download.downloadId} style={styles.downloadItem}>
        <View style={styles.downloadHeader}>
          <View style={styles.downloadInfo}>
            <Text style={styles.novelName} numberOfLines={1}>
              {prettifySlug(download.novelName)}
            </Text>
            <Text style={styles.chapterTitle} numberOfLines={2}>
              Chapter {download.chapterNumber}
              {download.chapterTitle && ` - ${download.chapterTitle}`}
            </Text>
          </View>

          <View style={styles.actionButtons}>
            {currentStatus === 'completed' && (
              <TouchableOpacity
                style={styles.readButton}
                onPress={() => handleReadChapter(download)}
              >
                <MaterialIcons name="play-arrow" size={20} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() =>
                handleDeleteDownload(
                  download.downloadId,
                  `${download.novelName} - Chapter ${download.chapterNumber}`
                )
              }
            >
              <MaterialIcons name="delete" size={20} color="#F44336" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.downloadDetails}>
          <View style={styles.statusRow}>
            <MaterialIcons
              name={getStatusIcon(currentStatus)}
              size={16}
              color={getStatusColor(currentStatus)}
            />
            <Text style={[styles.status, { color: getStatusColor(currentStatus) }]}>
              {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
            </Text>
            <Text style={styles.progress}>
              {Math.round(currentProgress)}%
            </Text>
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.detailText}>
              {formatFileSize(download.totalFiles, download.completedFiles)}
            </Text>
            <Text style={styles.detailText}>
              {formatDate(download.downloadDate)}
            </Text>
          </View>

          {currentStatus === 'processing' && activeDownload && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${currentProgress}%` },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }, [activeDownloads, handleDeleteDownload]);

  const activeDownloadsArray = useMemo(() => Array.from(activeDownloads.values()), [activeDownloads]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Downloads</Text>
        <Text style={styles.headerSubtitle}>
          {downloadedChapters.length} chapters downloaded
          {activeDownloadsArray.length > 0 && `, ${activeDownloadsArray.length} in progress`}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshDownloads} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Active Downloads Section */}
        {activeDownloadsArray.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>In Progress</Text>
            {activeDownloadsArray.map(activeDownload => {
              const matchingChapter = downloadedChapters.find(
                dc => dc.downloadId === activeDownload.download_id
              );

              if (matchingChapter) {
                return renderDownloadItem(matchingChapter);
              }

              return (
                <View key={activeDownload.download_id} style={styles.downloadItem}>
                  <View style={styles.downloadInfo}>
                    <Text style={styles.chapterTitle}>
                      Download in progress...
                    </Text>
                    <Text style={styles.progress}>
                      {Math.round(activeDownload.progress)}%
                    </Text>
                  </View>

                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${activeDownload.progress}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Completed Downloads Section */}
        {downloadedChapters.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Downloaded Chapters</Text>
            {downloadedChapters
              .filter(chapter => !activeDownloads.has(chapter.downloadId))
              .sort((a, b) => new Date(b.downloadDate).getTime() - new Date(a.downloadDate).getTime())
              .map(renderDownloadItem)}
          </View>
        ) : (
          !isLoading && activeDownloadsArray.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="download" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Downloads</Text>
              <Text style={styles.emptySubtitle}>
                Start downloading chapters to read offline
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  downloadItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  downloadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  downloadInfo: {
    flex: 1,
    marginRight: 12,
  },
  novelName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    padding: 4,
  },
  downloadDetails: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF9800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default DownloadsScreen;