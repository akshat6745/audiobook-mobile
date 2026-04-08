import React, { useState, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDownload } from '../context/DownloadContext';
import { DownloadRequest } from '../types';

interface DownloadButtonProps {
  novelName: string;
  chapterNumber: number;
  chapterTitle?: string;
  narratorVoice?: string;
  dialogueVoice?: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  novelName,
  chapterNumber,
  chapterTitle,
  narratorVoice = 'en-US-AvaMultilingualNeural',
  dialogueVoice = 'en-GB-RyanNeural',
  disabled = false,
  size = 'medium',
  style,
}) => {
  const {
    startDownload,
    isChapterDownloaded,
    activeDownloads,
    deleteDownload,
    downloadedChapters,
  } = useDownload();

  const [isStartingDownload, setIsStartingDownload] = useState(false);

  const isDownloaded = isChapterDownloaded(novelName, chapterNumber);

  const activeDownload = useMemo(() => {
    for (const download of activeDownloads.values()) {
      if (downloadedChapters.some(
        dc => dc.downloadId === download.download_id &&
              dc.novelName === novelName &&
              dc.chapterNumber === chapterNumber
      )) {
        return download;
      }
    }
    return undefined;
  }, [activeDownloads, downloadedChapters, novelName, chapterNumber]);

  const handleDownloadPress = async () => {
    if (isDownloaded) {
      // Show options to delete or manage
      Alert.alert(
        'Chapter Downloaded',
        'This chapter is already downloaded. What would you like to do?',
        [
          {
            text: 'Keep',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: handleDeleteDownload,
          },
        ]
      );
      return;
    }

    if (activeDownload) {
      Alert.alert(
        'Download in Progress',
        `Download is ${Math.round(activeDownload.progress)}% complete. Please wait.`
      );
      return;
    }

    await handleStartDownload();
  };

  const handleStartDownload = async () => {
    try {
      setIsStartingDownload(true);

      const request: DownloadRequest = {
        novel_name: novelName,
        chapter_number: chapterNumber,
        narrator_voice: narratorVoice,
        dialogue_voice: dialogueVoice,
      };

      await startDownload(request);

      Alert.alert(
        'Download Started',
        `Chapter ${chapterNumber}${chapterTitle ? ` - ${chapterTitle}` : ''} download started. You can monitor progress in the Downloads screen.`
      );
    } catch (error) {
      console.error('Failed to start download:', error);
      Alert.alert(
        'Download Failed',
        'Failed to start chapter download. Please check your connection and try again.'
      );
    } finally {
      setIsStartingDownload(false);
    }
  };

  const handleDeleteDownload = async () => {
    try {
      const downloadedChapter = downloadedChapters.find(
        dc => dc.novelName === novelName && dc.chapterNumber === chapterNumber
      );

      if (downloadedChapter) {
        await deleteDownload(downloadedChapter.downloadId);
        Alert.alert('Success', 'Chapter download deleted successfully.');
      }
    } catch (error) {
      console.error('Failed to delete download:', error);
      Alert.alert(
        'Delete Failed',
        'Failed to delete chapter download. Please try again.'
      );
    }
  };

  const getIconName = (): keyof typeof MaterialIcons.glyphMap => {
    if (isDownloaded) return 'download-done';
    if (activeDownload) return 'downloading';
    return 'download';
  };

  const getIconColor = (): string => {
    if (isDownloaded) return '#4CAF50';
    if (activeDownload) return '#FF9800';
    if (disabled) return '#ccc';
    return '#2196F3';
  };

  const getButtonText = (): string => {
    if (isDownloaded) return 'Downloaded';
    if (activeDownload) {
      const progress = Math.round(activeDownload.progress);
      const status = activeDownload.status;
      if (status === 'pending') return 'Starting...';
      if (status === 'processing') return `${progress}%`;
      if (status === 'completed') return 'Done!';
      if (status === 'error') return 'Failed';
      return `${progress}%`;
    }
    return 'Download';
  };

  const iconSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24;
  const textSize = size === 'small' ? 12 : size === 'medium' ? 14 : 16;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[size],
        disabled && styles.disabled,
        isDownloaded && styles.downloaded,
        activeDownload && styles.downloading,
        style,
      ]}
      onPress={handleDownloadPress}
      disabled={disabled || isStartingDownload}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {isStartingDownload ? (
          <ActivityIndicator size="small" color={getIconColor()} />
        ) : (
          <MaterialIcons
            name={getIconName()}
            size={iconSize}
            color={getIconColor()}
          />
        )}
        <Text
          style={[
            styles.text,
            { fontSize: textSize, color: getIconColor() },
            disabled && styles.disabledText,
          ]}
        >
          {getButtonText()}
        </Text>
      </View>

      {activeDownload && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${activeDownload.progress}%` },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 70,
  },
  medium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 80,
  },
  large: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.5,
    borderColor: '#ccc',
  },
  disabledText: {
    color: '#ccc',
  },
  downloaded: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  downloading: {
    borderColor: '#FF9800',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
});

export default DownloadButton;