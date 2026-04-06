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
   * Get audio files for offline chapter with proper index validation
   */
  async getOfflineChapterAudio(novelName: string, chapterNumber: number): Promise<{
    titleAudio?: string;
    paragraphAudios: (string | null)[];
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
        console.warn(`No completed download found for ${novelName} chapter ${chapterNumber}`);
        return null;
      }

      // Get downloaded content
      const downloadedContent = await downloadService.getDownloadedContent(download.downloadId);
      if (!downloadedContent) {
        console.warn(`Could not load downloaded content for ${download.downloadId}`);
        return null;
      }

      // Extract title and paragraph audio - new structure has them separated
      const titleAudio = downloadedContent.audioFiles.title;
      const paragraphAudios = downloadedContent.audioFiles.paragraphs;

      // Log a warning if counts don't match, but still return what we have so
      // AudioCacheManager can fall back to TTS for missing individual paragraphs.
      if (paragraphAudios.length !== downloadedContent.content.length) {
        console.warn(
          `⚠️ Audio-text mismatch for ${novelName} chapter ${chapterNumber}: ` +
          `${paragraphAudios.length} audio files but ${downloadedContent.content.length} paragraphs — ` +
          `missing paragraphs will use TTS fallback`
        );
      }

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