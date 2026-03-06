import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DownloadedChapter, DownloadStatus, DownloadRequest } from '../types';
import { downloadService } from '../services/downloadService';

interface DownloadContextType {
  // Downloaded chapters
  downloadedChapters: DownloadedChapter[];

  // Active downloads with real-time status
  activeDownloads: Map<string, DownloadStatus>;

  // Actions
  startDownload: (request: DownloadRequest) => Promise<string>;
  getDownloadStatus: (downloadId: string) => Promise<DownloadStatus>;
  deleteDownload: (downloadId: string) => Promise<void>;
  isChapterDownloaded: (novelName: string, chapterNumber: number) => boolean;
  refreshDownloads: () => Promise<void>;

  // UI state
  isLoading: boolean;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

interface DownloadProviderProps {
  children: ReactNode;
}

export const DownloadProvider: React.FC<DownloadProviderProps> = ({ children }) => {
  const [downloadedChapters, setDownloadedChapters] = useState<DownloadedChapter[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Map<string, DownloadStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const loadDownloadedChapters = useCallback(async () => {
    try {
      setIsLoading(true);
      const chapters = await downloadService.getDownloadedChapters();
      setDownloadedChapters(chapters);
    } catch (error) {
      console.error('Failed to load downloaded chapters:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load downloaded chapters on mount
  useEffect(() => {
    loadDownloadedChapters();
  }, [loadDownloadedChapters]);

  const startDownload = async (request: DownloadRequest): Promise<string> => {
    try {
      setIsLoading(true);

      // Start the download on backend
      const response = await downloadService.startChapterDownload(request);
      const { download_id: downloadId } = response;

      // Start polling for status updates
      pollDownloadStatus(downloadId, request);

      return downloadId;
    } catch (error) {
      console.error('Failed to start download:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const pollDownloadStatus = async (downloadId: string, request: DownloadRequest) => {
    try {
      await downloadService.pollDownloadUntilComplete(downloadId, (status) => {
        // Update active downloads map
        setActiveDownloads(prev => {
          const newMap = new Map(prev);
          newMap.set(downloadId, status);
          return newMap;
        });
      });

      // Remove from active downloads when completed
      setActiveDownloads(prev => {
        const newMap = new Map(prev);
        newMap.delete(downloadId);
        return newMap;
      });

      // Refresh the downloaded chapters list
      await loadDownloadedChapters();
    } catch (error) {
      console.error('Download failed:', error);

      // Update status to failed
      setActiveDownloads(prev => {
        const newMap = new Map(prev);
        newMap.set(downloadId, {
          download_id: downloadId,
          status: 'error',
          progress: 0,
          total_files: 0,
          completed_files: 0,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
        return newMap;
      });
    }
  };

  const getDownloadStatus = async (downloadId: string): Promise<DownloadStatus> => {
    try {
      return await downloadService.getDownloadStatus(downloadId);
    } catch (error) {
      console.error('Failed to get download status:', error);
      throw error;
    }
  };

  const deleteDownload = async (downloadId: string): Promise<void> => {
    try {
      setIsLoading(true);
      await downloadService.deleteDownload(downloadId);

      // Remove from active downloads
      setActiveDownloads(prev => {
        const newMap = new Map(prev);
        newMap.delete(downloadId);
        return newMap;
      });

      // Refresh the downloaded chapters list
      await loadDownloadedChapters();
    } catch (error) {
      console.error('Failed to delete download:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const isChapterDownloaded = (novelName: string, chapterNumber: number): boolean => {
    return downloadedChapters.some(
      chapter =>
        chapter.novelName === novelName &&
        chapter.chapterNumber === chapterNumber &&
        chapter.status === 'completed'
    );
  };

  const refreshDownloads = useCallback(async (): Promise<void> => {
    await loadDownloadedChapters();
  }, [loadDownloadedChapters]);

  const contextValue: DownloadContextType = {
    downloadedChapters,
    activeDownloads,
    startDownload,
    getDownloadStatus,
    deleteDownload,
    isChapterDownloaded,
    refreshDownloads,
    isLoading,
  };

  return (
    <DownloadContext.Provider value={contextValue}>
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownload = (): DownloadContextType => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
};

export default DownloadContext;