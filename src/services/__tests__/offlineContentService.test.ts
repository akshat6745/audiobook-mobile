/**
 * Tests for OfflineContentService — per-paragraph null fallback behavior
 * when downloaded audio files are missing.
 */

jest.mock('../downloadService', () => ({
  downloadService: {
    getDownloadedChapters: jest.fn(),
    getDownloadedContent: jest.fn(),
    isChapterDownloaded: jest.fn(),
  },
}));

import { downloadService } from '../downloadService';
import { OfflineContentService } from '../offlineContentService';

const mockGetDownloadedChapters = downloadService.getDownloadedChapters as jest.Mock;
const mockGetDownloadedContent = downloadService.getDownloadedContent as jest.Mock;

const CHAPTER_RECORD = {
  downloadId: 'dl-1',
  novelName: 'TestNovel',
  chapterNumber: 1,
  status: 'completed' as const,
  progress: 100,
  downloadDate: '2026-01-01',
  totalFiles: 5,
  completedFiles: 5,
};

describe('OfflineContentService.getOfflineChapterAudio', () => {
  let service: OfflineContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OfflineContentService();
    mockGetDownloadedChapters.mockResolvedValue([CHAPTER_RECORD]);
  });

  it('returns null when chapter is not downloaded', async () => {
    mockGetDownloadedChapters.mockResolvedValue([]);
    const result = await service.getOfflineChapterAudio('TestNovel', 1);
    expect(result).toBeNull();
  });

  it('returns all audio paths when all files are present', async () => {
    mockGetDownloadedContent.mockResolvedValue({
      content: ['Para 1', 'Para 2'],
      audioFiles: {
        title: '/docs/downloads/dl-1/title.mp3',
        paragraphs: ['/docs/downloads/dl-1/0.mp3', '/docs/downloads/dl-1/1.mp3'],
      },
      chapterTitle: 'Chapter 1',
    });

    const result = await service.getOfflineChapterAudio('TestNovel', 1);

    expect(result).not.toBeNull();
    expect(result!.paragraphAudios).toHaveLength(2);
    expect(result!.paragraphAudios[0]).toBeTruthy();
    expect(result!.paragraphAudios[1]).toBeTruthy();
  });

  it('passes through null entries for missing paragraph audio (no whole-chapter failure)', async () => {
    mockGetDownloadedContent.mockResolvedValue({
      content: ['Para 1', 'Para 2', 'Para 3'],
      audioFiles: {
        title: '/docs/downloads/dl-1/title.mp3',
        paragraphs: [
          '/docs/downloads/dl-1/0.mp3',
          null,                              // paragraph 1 audio is missing
          '/docs/downloads/dl-1/2.mp3',
        ],
      },
      chapterTitle: 'Chapter 1',
    });

    const result = await service.getOfflineChapterAudio('TestNovel', 1);

    // Chapter should still be playable — just paragraph 1 will fall back to TTS
    expect(result).not.toBeNull();
    expect(result!.paragraphAudios[0]).toBeTruthy();
    expect(result!.paragraphAudios[1]).toBeNull();
    expect(result!.paragraphAudios[2]).toBeTruthy();
  });

  it('does not return null when audio count mismatches paragraph count', async () => {
    // Fewer audio files than paragraphs (partial download)
    mockGetDownloadedContent.mockResolvedValue({
      content: ['Para 1', 'Para 2', 'Para 3'],
      audioFiles: {
        title: '/docs/downloads/dl-1/title.mp3',
        paragraphs: ['/docs/downloads/dl-1/0.mp3', '/docs/downloads/dl-1/1.mp3'],
      },
      chapterTitle: 'Chapter 1',
    });

    const result = await service.getOfflineChapterAudio('TestNovel', 1);

    // Returns available data instead of null — caller handles per-paragraph fallback
    expect(result).not.toBeNull();
  });
});
