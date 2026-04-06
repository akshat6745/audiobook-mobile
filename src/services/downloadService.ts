import * as FileSystem from 'expo-file-system/legacy';
import {
  DownloadRequest,
  DownloadResponse,
  DownloadStatus,
  DownloadedChapter
} from '../types';
import api from './api';
import storage from '../utils/storage';
import { DownloadValidator } from './downloadValidation';

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
    if (!dirInfo?.exists) {
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

      // Update cache — cap at 100 entries to prevent unbounded growth
      if (this.downloadStatusCache.size >= 100) {
        const firstKey = this.downloadStatusCache.keys().next().value;
        if (firstKey) this.downloadStatusCache.delete(firstKey);
      }
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
   * Download a single file with exponential backoff retry
   */
  private async downloadFileWithRetry(
    fileUrl: string,
    localPath: string,
    maxAttempts = 3
  ): Promise<void> {
    const delays = [0, 1000, 3000];
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt] ?? 3000));
        console.log(`🔄 Retry ${attempt}/${maxAttempts - 1}: ${localPath}`);
      }
      try {
        const result = await FileSystem.downloadAsync(fileUrl, localPath);
        if (result.status !== 200) {
          throw new Error(`HTTP ${result.status}`);
        }
        return;
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Download attempt ${attempt + 1} failed:`, error);
      }
    }
    throw new Error(`Failed after ${maxAttempts} attempts: ${lastError}`);
  }

  /**
   * Check that device has sufficient free storage before downloading
   */
  private async checkStorageQuota(requiredBytes = 50 * 1024 * 1024): Promise<void> {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      if (freeSpace !== undefined && freeSpace < requiredBytes) {
        throw new Error(
          `Not enough storage space. Please free up space and try again. ` +
          `(Available: ${Math.round(freeSpace / 1024 / 1024)}MB, Required: ${Math.round(requiredBytes / 1024 / 1024)}MB)`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not enough storage')) throw error;
      console.warn('Could not check storage quota:', error);
    }
  }

  /**
   * Download and save individual files locally
   */
  async downloadFiles(
    downloadId: string,
    onFileProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    const downloadDir = `${DOWNLOAD_BASE_DIR}${downloadId}/`;
    let paragraphCount = 0;
    const downloadedAudioFiles: string[] = [];

    try {
      const status = await this.getDownloadStatus(downloadId);
      if (status.status !== 'completed') {
        throw new Error('Download not completed yet');
      }

      const statusResponse = await this.getDownloadStatus(downloadId);
      if (!statusResponse.files) {
        throw new Error('File list not available in download status');
      }

      // Check storage before starting
      await this.checkStorageQuota();

      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });

      // 1. Download content.json first (resume: skip if already valid)
      if (statusResponse.files.content) {
        const filename = 'content.json';
        const fileUrl = `${api.defaults.baseURL}/download/file/${downloadId}/${filename}`;
        const localPath = `${downloadDir}${filename}`;

        const existing = await FileSystem.getInfoAsync(localPath);
        if (existing.exists) {
          try {
            await this.validateContentFile(localPath);
            console.log(`⏭️ Skipping ${filename} — already downloaded and valid`);
          } catch {
            console.log(`🔁 Re-downloading ${filename} — existing file failed validation`);
            await this.downloadFileWithRetry(fileUrl, localPath);
            await this.validateContentFile(localPath);
          }
        } else {
          console.log(`📥 Downloading ${filename}...`);
          await this.downloadFileWithRetry(fileUrl, localPath);
          await this.validateContentFile(localPath);
        }
      }

      // 2. Parse content.json for paragraph count
      const contentJson = await FileSystem.readAsStringAsync(`${downloadDir}content.json`);
      const content = JSON.parse(contentJson);
      paragraphCount = (content.paragraphs || []).length;

      if (paragraphCount === 0) {
        throw new Error('Content.json has no paragraphs - invalid download');
      }

      // Total files: content.json + title.mp3 + paragraphs
      const totalFiles = 1 + 1 + paragraphCount;
      let completedFiles = 1; // content.json counts as done
      onFileProgress?.(completedFiles, totalFiles);

      // 3. Download title audio (resume: skip if already valid)
      if (statusResponse.files.audio?.title) {
        const filename = 'title.mp3';
        const fileUrl = `${api.defaults.baseURL}/download/file/${downloadId}/${filename}`;
        const localPath = `${downloadDir}${filename}`;

        const existing = await FileSystem.getInfoAsync(localPath);
        if (existing.exists) {
          try {
            await this.validateAudioFile(localPath, filename);
            console.log(`⏭️ Skipping ${filename} — already downloaded and valid`);
          } catch {
            console.log(`🔁 Re-downloading ${filename} — existing file failed validation`);
            await this.downloadFileWithRetry(fileUrl, localPath);
            await this.validateAudioFile(localPath, filename);
          }
        } else {
          console.log(`📥 Downloading ${filename}...`);
          await this.downloadFileWithRetry(fileUrl, localPath);
          await this.validateAudioFile(localPath, filename);
        }

        completedFiles++;
        onFileProgress?.(completedFiles, totalFiles);
      }

      // 4. Download all paragraph audio files (resume: skip already-valid ones)
      for (let i = 0; i < paragraphCount; i++) {
        const filename = `${i}.mp3`;
        const fileUrl = `${api.defaults.baseURL}/download/file/${downloadId}/${filename}`;
        const localPath = `${downloadDir}${filename}`;

        const existing = await FileSystem.getInfoAsync(localPath);
        if (existing.exists) {
          try {
            await this.validateAudioFile(localPath, filename);
            console.log(`⏭️ Skipping paragraph ${i} — already downloaded and valid`);
            downloadedAudioFiles.push(filename);
          } catch {
            console.log(`🔁 Re-downloading paragraph ${i} — existing file failed validation`);
            await FileSystem.deleteAsync(localPath, { idempotent: true });
            await this.downloadFileWithRetry(fileUrl, localPath);
            await this.validateAudioFile(localPath, filename);
            downloadedAudioFiles.push(filename);
          }
        } else {
          console.log(`📥 Downloading paragraph audio ${i}/${paragraphCount - 1}...`);
          await this.downloadFileWithRetry(fileUrl, localPath);
          await this.validateAudioFile(localPath, filename);
          downloadedAudioFiles.push(filename);
        }

        completedFiles++;
        onFileProgress?.(completedFiles, totalFiles);
      }

      // 5. Verify all paragraph files downloaded
      if (downloadedAudioFiles.length !== paragraphCount) {
        throw new Error(
          `Missing paragraph audio files. Downloaded: ${downloadedAudioFiles.length}, Expected: ${paragraphCount}`
        );
      }

      // 6. Run comprehensive validation
      console.log(`🔍 Running comprehensive validation...`);
      const validation = await DownloadValidator.validateDownload(downloadDir, paragraphCount);

      if (!validation.isValid) {
        console.error(`❌ Validation failed:`, validation.errors);
        throw new Error(`Download validation failed: ${validation.errors.join('; ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings:`, validation.warnings);
      }

      console.log(`✅ ${validation.summary}`);

      // 7. Mark as completed
      await this.updateDownloadInfo(downloadId, {
        status: 'completed',
        progress: 100,
        totalFiles,
        completedFiles: totalFiles,
      });

      console.log(`✅ Download complete and validated: ${paragraphCount} paragraphs + title + content`);
    } catch (error) {
      console.error('❌ Failed to download files:', error);
      // Only delete the directory if no audio files were successfully downloaded yet.
      // If files were downloaded but validation failed, keep them so a retry can resume.
      if (downloadedAudioFiles.length === 0) {
        try {
          await FileSystem.deleteAsync(downloadDir, { idempotent: true });
        } catch (cleanupError) {
          console.warn('Failed to clean up empty download directory:', cleanupError);
        }
      }
      await this.updateDownloadInfo(downloadId, { status: 'error', progress: 0 });
      throw error;
    }
  }

  /**
   * Validate that content.json has proper structure
   */
  private async validateContentFile(filePath: string): Promise<void> {
    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      const data = JSON.parse(content);

      // Check for required fields
      if (!data.chapter_title && !data.chapterTitle) {
        throw new Error('Missing chapter_title field');
      }

      if (!Array.isArray(data.paragraphs) || data.paragraphs.length === 0) {
        throw new Error('Missing or empty paragraphs array');
      }

      // Verify it's not an error response (HTML)
      if (content.includes('<!DOCTYPE') || content.includes('<html')) {
        throw new Error('Downloaded file is HTML error response, not valid JSON');
      }

      console.log(`✅ content.json validated: ${data.paragraphs.length} paragraphs`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unexpected token')) {
        throw new Error('content.json is corrupted or invalid JSON');
      }
      throw error;
    }
  }

  /**
   * Validate that audio file is a valid MP3 (not corrupted or error response)
   */
  private async validateAudioFile(filePath: string, filename: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (!fileInfo.exists) {
        throw new Error(`File does not exist: ${filename}`);
      }

      // Check file size - audio files should be at least 1KB
      const fileSize = 'size' in fileInfo ? (fileInfo as any).size : undefined;
      if (fileSize && fileSize < 1024) {
        throw new Error(
          `${filename} is too small (${fileSize} bytes). Likely an error response or corrupted.`
        );
      }

      // Try to read first few bytes to check MP3 header
      // MP3 files should start with ID3 tag (0x49 44 33) or MPEG sync (0xFF FB or 0xFF FA)
      try {
        const header = await FileSystem.readAsStringAsync(filePath, {
          encoding: 'utf8',
          length: 4,
        });

        // Check for MP3 magic bytes (ID3 tag or MPEG frame)
        const bytes = header.charCodeAt(0) << 8 | header.charCodeAt(1);
        const isID3 = header.substring(0, 3) === 'ID3';
        const isMpegFrame = (bytes & 0xFFE0) === 0xFFE0; // MPEG sync word

        if (!isID3 && !isMpegFrame) {
          console.warn(
            `⚠️ ${filename} may not be a valid MP3 (no ID3 tag or MPEG sync). Size: ${fileInfo.size} bytes`
          );
          // Still allow download but log warning
        }
      } catch (headerError) {
        console.warn(`Could not read MP3 header for ${filename}:`, headerError);
        // Don't fail on header read - file might still be valid
      }

      console.log(`✅ ${filename} validated (${fileInfo.size} bytes)`);
    } catch (error) {
      throw new Error(`Audio file validation failed for ${filename}: ${error}`);
    }
  }

  /**
   * Get locally downloaded content with integrity validation
   */
  async getDownloadedContent(downloadId: string): Promise<{
    content: string[];
    audioFiles: { title?: string; paragraphs: (string | null)[] };
    chapterTitle?: string;
  } | null> {
    try {
      const downloadDir = `${DOWNLOAD_BASE_DIR}${downloadId}/`;
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);

      if (!dirInfo.exists) {
        console.warn(`Download directory does not exist: ${downloadDir}`);
        return null;
      }

      // Read and validate content.json
      const contentPath = `${downloadDir}content.json`;
      const contentInfo = await FileSystem.getInfoAsync(contentPath);

      if (!contentInfo.exists) {
        console.warn(`content.json not found in ${downloadDir}`);
        return null;
      }

      let content: any;
      try {
        const contentJson = await FileSystem.readAsStringAsync(contentPath);
        content = JSON.parse(contentJson);
      } catch (parseError) {
        console.error(`Failed to parse content.json for ${downloadId}:`, parseError);
        return null;
      }

      // Validate content structure
      const paragraphs: string[] = content.paragraphs || [];
      const chapterTitle = content.chapter_title || content.chapterTitle;

      if (paragraphs.length === 0) {
        console.warn(`content.json for ${downloadId} has no paragraphs, ignoring`);
        return null;
      }

      if (!chapterTitle) {
        console.warn(`content.json for ${downloadId} has no chapter title`);
        // Continue anyway, use default
      }

      // List all audio files on disk
      const files = await FileSystem.readDirectoryAsync(downloadDir);
      const audioFiles = files.filter(file => file.endsWith('.mp3'));

      // Build proper audio file structure with index validation
      const titleAudioFile = audioFiles.includes('title.mp3') ? `${downloadDir}title.mp3` : undefined;

      // Build paragraph audio file list — missing or invalid files become null so
      // AudioCacheManager can fall back to TTS for individual paragraphs instead of
      // failing the whole chapter.
      const paragraphAudioFiles: (string | null)[] = [];
      for (let i = 0; i < paragraphs.length; i++) {
        const filename = `${i}.mp3`;
        const filePath = `${downloadDir}${filename}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (!fileInfo.exists) {
          console.warn(`⚠️ Missing paragraph audio file: ${filename} (paragraph ${i}) — will use TTS fallback`);
          paragraphAudioFiles.push(null);
          continue;
        }

        // Quick size check
        const fileSize = 'size' in fileInfo ? (fileInfo as any).size : undefined;
        if (fileSize && fileSize < 1024) {
          console.warn(`⚠️ Paragraph audio file too small: ${filename} (${fileSize} bytes) — will use TTS fallback`);
          paragraphAudioFiles.push(null);
          continue;
        }

        paragraphAudioFiles.push(filePath);
      }

      console.log(
        `✅ Downloaded content validated: ${paragraphs.length} paragraphs, ` +
        `${titleAudioFile ? 'title audio' : 'no title audio'}`
      );

      return {
        content: paragraphs,
        audioFiles: {
          title: titleAudioFile,
          paragraphs: paragraphAudioFiles,
        },
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
          // Scale backend processing progress to 0–50% so file download gets 50–100%
          onProgress({
            ...status,
            progress: Math.round((status.progress || 0) * 0.5),
          });
        }

        if (status.status === 'completed') {
          // Auto-download files; emit 50–100% progress during file download phase
          await this.downloadFiles(downloadId, (completed, total) => {
            if (onProgress) {
              const fileProgress = total > 0 ? Math.round((completed / total) * 50 + 50) : 50;
              onProgress({
                ...status,
                status: 'processing',
                progress: fileProgress,
                completed_files: completed,
                total_files: total,
              });
            }
          });
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