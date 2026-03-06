import * as FileSystem from 'expo-file-system/legacy';
import {
  DownloadRequest,
  DownloadResponse,
  DownloadStatus,
  DownloadedChapter
} from '../types';
import api from './api';
import storage from '../utils/storage';

const DOWNLOADS_STORAGE_KEY = 'downloaded_chapters';
const DOWNLOAD_BASE_DIR = `${FileSystem.documentDirectory || '/tmp/'}downloads/`;

export class DownloadService {
  private static instance: DownloadService;
  private downloadStatusCache: Map<string, DownloadStatus> = new Map();

  public static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  constructor() {
    this.ensureDownloadDirectory();
  }

  private async ensureDownloadDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_BASE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOAD_BASE_DIR, { intermediates: true });
    }
  }

  /**
   * Start a chapter download
   */
  async startChapterDownload(request: DownloadRequest): Promise<DownloadResponse> {
    try {
      console.log('Starting download request:', request);

      const response = await api.post<DownloadResponse>('/download/chapter', request);

      // Save download info locally
      await this.saveDownloadInfo({
        downloadId: response.data.download_id,
        novelName: request.novel_name,
        chapterNumber: request.chapter_number,
        status: 'pending',
        progress: 0,
        downloadDate: new Date().toISOString(),
        totalFiles: 0,
        completedFiles: 0,
      });

      return response.data;
    } catch (error) {
      console.error('Failed to start download:', error);
      throw error;
    }
  }

  /**
   * Check download status
   */
  async getDownloadStatus(downloadId: string): Promise<DownloadStatus> {
    try {
      // Check cache first
      const cachedStatus = this.downloadStatusCache.get(downloadId);
      if (cachedStatus && cachedStatus.status === 'completed') {
        return cachedStatus;
      }

      const response = await api.get<DownloadStatus>(`/download/status/${downloadId}`);
      const status = response.data;

      // Update cache
      this.downloadStatusCache.set(downloadId, status);

      // Update progress counters but do NOT set local status to 'completed' here.
      // Only downloadFiles() sets 'completed' after all files are actually on disk.
      // Setting 'completed' here would cause a race: offlineContentService would find
      // a 'completed' record but the files wouldn't exist yet.
      if (status.status === 'processing' || status.status === 'completed') {
        await this.updateDownloadInfo(downloadId, {
          totalFiles: status.total_files,
          completedFiles: status.completed_files,
        });
      }

      return status;
    } catch (error) {
      console.error('Failed to get download status:', error);
      throw error;
    }
  }

  /**
   * Download and save individual files locally
   */
  async downloadFiles(downloadId: string): Promise<void> {
    try {
      const status = await this.getDownloadStatus(downloadId);
      if (status.status !== 'completed') {
        throw new Error('Download not completed yet');
      }

      // Get status to get file list from the download response
      const statusResponse = await this.getDownloadStatus(downloadId);
      if (!statusResponse.files) {
        throw new Error('File list not available in download status');
      }

      // Extract all file paths from the status response
      const files: string[] = [];
      if (statusResponse.files.content) {
        files.push('content.json');
      }
      if (statusResponse.files.audio) {
        if (statusResponse.files.audio.title) {
          files.push('title.mp3');
        }
        if (statusResponse.files.audio.paragraphs) {
          statusResponse.files.audio.paragraphs.forEach((_, index) => {
            files.push(`${index}.mp3`);
          });
        }
      }

      const downloadDir = `${DOWNLOAD_BASE_DIR}${downloadId}/`;
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });

      // Download each file
      for (const filename of files) {
        const fileUrl = `${api.defaults.baseURL}/download/file/${downloadId}/${filename}`;
        const localPath = `${downloadDir}${filename}`;

        console.log(`Downloading ${filename}...`);

        const result = await FileSystem.downloadAsync(fileUrl, localPath);
        if (result.status !== 200) {
          throw new Error(`Failed to download ${filename}: server returned HTTP ${result.status}`);
        }
      }

      // Update local storage to mark files as downloaded
      await this.updateDownloadInfo(downloadId, {
        status: 'completed',
        progress: 100,
      });

      console.log('All files downloaded successfully');
    } catch (error) {
      console.error('Failed to download files:', error);
      throw error;
    }
  }

  /**
   * Get locally downloaded content
   */
  async getDownloadedContent(downloadId: string): Promise<{
    content: string[];
    audioFiles: string[];
    chapterTitle?: string;
  } | null> {
    try {
      const downloadDir = `${DOWNLOAD_BASE_DIR}${downloadId}/`;
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);

      if (!dirInfo.exists) {
        return null;
      }

      // Read content.json
      const contentPath = `${downloadDir}content.json`;
      const contentInfo = await FileSystem.getInfoAsync(contentPath);

      if (!contentInfo.exists) {
        return null;
      }

      const contentJson = await FileSystem.readAsStringAsync(contentPath);
      const content = JSON.parse(contentJson);

      // List audio files
      const files = await FileSystem.readDirectoryAsync(downloadDir);
      const audioFiles = files
        .filter(file => file.endsWith('.mp3'))
        .sort((a, b) => {
          // Sort to ensure proper order (title.mp3 first, then paragraph_0.mp3, etc.)
          if (a === 'title.mp3') return -1;
          if (b === 'title.mp3') return 1;

          const aNum = a.match(/^(\d+)\.mp3$/)?.[1];
          const bNum = b.match(/^(\d+)\.mp3$/)?.[1];

          if (aNum && bNum) {
            return parseInt(aNum) - parseInt(bNum);
          }

          return a.localeCompare(b);
        })
        .map(file => `${downloadDir}${file}`);

      const paragraphs: string[] = content.paragraphs || [];
      // Validate this is a real content file, not a 404 error response saved to disk
      if (paragraphs.length === 0 && !content.chapter_title && !content.chapterTitle) {
        console.warn(`content.json for ${downloadId} appears invalid (no paragraphs or title), ignoring`);
        return null;
      }

      // Backend stores chapter_title (snake_case); also support camelCase for old downloads
      const chapterTitle = content.chapter_title || content.chapterTitle;

      return {
        content: paragraphs,
        audioFiles,
        chapterTitle,
      };
    } catch (error) {
      console.error('Failed to get downloaded content:', error);
      return null;
    }
  }

  /**
   * Get all downloaded chapters from local storage
   */
  async getDownloadedChapters(): Promise<DownloadedChapter[]> {
    try {
      const stored = await storage.getItem(DOWNLOADS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get downloaded chapters:', error);
      return [];
    }
  }

  /**
   * Check if a chapter is downloaded locally
   */
  async isChapterDownloaded(novelName: string, chapterNumber: number): Promise<boolean> {
    const downloads = await this.getDownloadedChapters();
    return downloads.some(
      d => d.novelName === novelName &&
           d.chapterNumber === chapterNumber &&
           d.status === 'completed'
    );
  }

  /**
   * Delete downloaded chapter
   */
  async deleteDownload(downloadId: string): Promise<void> {
    try {
      // Delete local files
      const downloadDir = `${DOWNLOAD_BASE_DIR}${downloadId}/`;
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);

      if (dirInfo.exists) {
        await FileSystem.deleteAsync(downloadDir);
      }

      // Remove from local storage
      const downloads = await this.getDownloadedChapters();
      const updated = downloads.filter(d => d.downloadId !== downloadId);
      await storage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(updated));

      // Remove from cache
      this.downloadStatusCache.delete(downloadId);

      console.log('Download deleted successfully');
    } catch (error) {
      console.error('Failed to delete download:', error);
      throw error;
    }
  }

  /**
   * Save download info to local storage
   */
  private async saveDownloadInfo(download: DownloadedChapter): Promise<void> {
    try {
      const downloads = await this.getDownloadedChapters();
      const existing = downloads.find(d => d.downloadId === download.downloadId);

      if (existing) {
        Object.assign(existing, download);
      } else {
        downloads.push(download);
      }

      await storage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(downloads));
    } catch (error) {
      console.error('Failed to save download info:', error);
    }
  }

  /**
   * Update download info in local storage
   */
  private async updateDownloadInfo(downloadId: string, updates: Partial<DownloadedChapter>): Promise<void> {
    try {
      const downloads = await this.getDownloadedChapters();
      const download = downloads.find(d => d.downloadId === downloadId);

      if (download) {
        Object.assign(download, updates);
        await storage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(downloads));
      }
    } catch (error) {
      console.error('Failed to update download info:', error);
    }
  }

  /**
   * Poll download status until completion
   */
  async pollDownloadUntilComplete(
    downloadId: string,
    onProgress?: (status: DownloadStatus) => void
  ): Promise<DownloadStatus> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await this.getDownloadStatus(downloadId);

        if (onProgress) {
          onProgress(status);
        }

        if (status.status === 'completed') {
          // Auto-download files when backend processing is complete
          await this.downloadFiles(downloadId);
          return status;
        }

        if (status.status === 'error') {
          throw new Error(status.error_message || 'Download failed');
        }

        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      } catch (error) {
        console.error('Error polling download status:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('Download polling timeout');
  }

  /**
   * Clear all downloads cache
   */
  clearCache(): void {
    this.downloadStatusCache.clear();
  }
}

export const downloadService = DownloadService.getInstance();
export default downloadService;