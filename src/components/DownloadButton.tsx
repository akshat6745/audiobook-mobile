import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { chapterAPI } from '../services/api';
import { offlineStorage } from '../services/OfflineStorageService';

interface DownloadButtonProps {
  novelName: string;
  chapterNumber: number;
  voice: string;
  dialogueVoice: string;
  onDownloadComplete?: () => void;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  novelName,
  chapterNumber,
  voice,
  dialogueVoice,
  onDownloadComplete,
}) => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'downloaded'>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkStatus();
  }, [novelName, chapterNumber]);

  const checkStatus = async () => {
    const isDownloaded = await offlineStorage.isChapterDownloaded(novelName, chapterNumber);
    setStatus(isDownloaded ? 'downloaded' : 'idle');
  };

  const generateId = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const handleDownload = async () => {
    const progressId = generateId();
    let pollInterval: NodeJS.Timeout;

    try {
      setStatus('downloading');
      setProgress(0);

      // Start polling
      pollInterval = setInterval(async () => {
        try {
          const progressData = await chapterAPI.getDownloadProgress(progressId);
          if (progressData.percent) {
            setProgress(progressData.percent);
          }
        } catch (error: any) {
          // Stop polling if 404 (ID not found/backend restarted) or other error
          if (error.response && error.response.status === 404) {
            console.warn('Progress ID not found, stopping poll');
            clearInterval(pollInterval);
          }
        }
      }, 1000);

      const downloadUrl = chapterAPI.getDownloadChapterUrl(novelName, chapterNumber, voice, dialogueVoice, progressId);
      
      clearInterval(pollInterval);
      setProgress(100);
      
      await offlineStorage.downloadAndSaveChapter(downloadUrl, novelName, chapterNumber);
      setStatus('downloaded');
      if (onDownloadComplete) onDownloadComplete();
      Alert.alert('Success', 'Chapter downloaded successfully');
    } catch (error) {
      if (pollInterval!) clearInterval(pollInterval);
      console.error('Download failed:', error);
      setStatus('idle');
      Alert.alert('Error', 'Failed to download chapter');
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Download',
      'Are you sure you want to delete this chapter?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await offlineStorage.deleteChapter(novelName, chapterNumber);
            setStatus('idle');
          },
        },
      ]
    );
  };

  if (status === 'downloading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#2196F3" />
        {progress > 0 && (
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        )}
      </View>
    );
  }

  if (status === 'downloaded') {
    return (
      <TouchableOpacity onPress={handleDelete} style={styles.container}>
        <MaterialIcons name="offline-pin" size={24} color="#4CAF50" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handleDownload} style={styles.container}>
      <MaterialIcons name="file-download" size={24} color="#757575" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 10,
    color: '#2196F3',
    marginTop: 2,
  },
});

export default DownloadButton;
