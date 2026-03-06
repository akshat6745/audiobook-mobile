import { downloadService } from './downloadService';
import { ChapterContent } from '../types';

export class OfflineContentService {

  /**
   * Get chapter content from downloaded files
   */
  async getOfflineChapterContent(
    novelName: string,
    chapterNumber: number
  ): Promise<ChapterContent | null> {
    try {
      // Check if chapter is downloaded
      const isDownloaded = await downloadService.isChapterDownloaded(novelName, chapterNumber);
      if (!isDownloaded) {
        return null;
      }

      // Find the download
      const downloads = await downloadService.getDownloadedChapters();
      const download = downloads.find(
        d => d.novelName === novelName &&
             d.chapterNumber === chapterNumber &&
             d.status === 'completed'
      );

      if (!download) {
        return null;
      }

      // Get downloaded content
      const downloadedContent = await downloadService.getDownloadedContent(download.downloadId);
      if (!downloadedContent) {
        return null;
      }

      return {
        content: downloadedContent.content,
        chapterNumber,
        // Prefer chapterTitle from the content file (set by backend) over metadata (often undefined)
        chapterTitle: downloadedContent.chapterTitle || download.chapterTitle,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting offline chapter content:', error);
      return null;
    }
  }

  /**
   * Check if a chapter is available offline
   */
  async isChapterAvailableOffline(novelName: string, chapterNumber: number): Promise<boolean> {
    try {
      return await downloadService.isChapterDownloaded(novelName, chapterNumber);
    } catch (error) {
      console.error('Error checking offline availability:', error);
      return false;
    }
  }

  /**
   * Get all offline available chapters for a novel
   */
  async getOfflineChapters(novelName: string): Promise<number[]> {
    try {
      const downloads = await downloadService.getDownloadedChapters();
      return downloads
        .filter(d => d.novelName === novelName && d.status === 'completed')
        .map(d => d.chapterNumber)
        .sort((a, b) => a - b);
    } catch (error) {
      console.error('Error getting offline chapters:', error);
      return [];
    }
  }

  /**
   * Get audio files for offline chapter
   */
  async getOfflineChapterAudio(novelName: string, chapterNumber: number): Promise<{
    titleAudio?: string;
    paragraphAudios: string[];
  } | null> {
    try {
      // Find the download
      const downloads = await downloadService.getDownloadedChapters();
      const download = downloads.find(
        d => d.novelName === novelName &&
             d.chapterNumber === chapterNumber &&
             d.status === 'completed'
      );

      if (!download) {
        return null;
      }

      // Get downloaded content
      const downloadedContent = await downloadService.getDownloadedContent(download.downloadId);
      if (!downloadedContent) {
        return null;
      }

      // Find title audio (should be at index 0 if it exists)
      const titleAudio = downloadedContent.audioFiles.find(file => file.includes('title.mp3'));

      // Find paragraph audios (should be in order)
      const paragraphAudios = downloadedContent.audioFiles
        .filter(file => /\d+\.mp3$/.test(file))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/(\d+)\.mp3$/)?.[1] || '0');
          const bNum = parseInt(b.match(/(\d+)\.mp3$/)?.[1] || '0');
          return aNum - bNum;
        });

      return {
        titleAudio,
        paragraphAudios
      };
    } catch (error) {
      console.error('Error getting offline chapter audio:', error);
      return null;
    }
  }
}

export const offlineContentService = new OfflineContentService();
export default offlineContentService;