/**
 * Tests for DownloadService — progress reporting, retry, resume, cleanup on
 * failure, and storage quota checks.
 *
 * All external dependencies are mocked so tests run without Expo native modules.
 */

// NOTE: jest.mock factories are hoisted to the top of the file by Babel/Jest
// so they cannot reference variables declared in the test file. All mocks are
// self-contained factories.

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/docs/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getFreeDiskStorageAsync: jest.fn(),
}));

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { baseURL: 'http://localhost:8000' },
  },
}));

jest.mock('../../utils/storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../downloadValidation', () => ({
  DownloadValidator: {
    validateDownload: jest.fn(),
  },
}));

// --- Import mocked modules after mock declarations ---
import * as FileSystem from 'expo-file-system/legacy';
import api from '../api';
import { DownloadValidator } from '../downloadValidation';
import { DownloadService } from '../downloadService';

const fs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockApi = api as jest.Mocked<typeof api>;
const mockValidator = DownloadValidator as jest.Mocked<typeof DownloadValidator>;

// --- Test helpers ---

const VALID_CONTENT = JSON.stringify({
  chapter_title: 'Chapter 1',
  paragraphs: ['Para 1', 'Para 2', 'Para 3'],
});

const COMPLETED_STATUS = {
  download_id: 'dl-1',
  status: 'completed' as const,
  progress: 100,
  total_files: 5,
  completed_files: 5,
  files: {
    content: 'content.json',
    audio: { title: 'title.mp3', paragraphs: ['0.mp3', '1.mp3', '2.mp3'] },
  },
};

function setupHappyPath() {
  (fs.getFreeDiskStorageAsync as jest.Mock).mockResolvedValue(200 * 1024 * 1024);
  (mockApi.get as jest.Mock).mockResolvedValue({ data: COMPLETED_STATUS });
  // Return exists:true with size so resume check treats files as already valid.
  // This also satisfies validateAudioFile's getInfoAsync call after download.
  (fs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 5000 });
  (fs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
  (fs.downloadAsync as jest.Mock).mockResolvedValue({ status: 200 });
  (fs.readAsStringAsync as jest.Mock).mockResolvedValue(VALID_CONTENT);
  (fs.readDirectoryAsync as jest.Mock).mockResolvedValue([
    'content.json', 'title.mp3', '0.mp3', '1.mp3', '2.mp3',
  ]);
  (mockValidator.validateDownload as jest.Mock).mockResolvedValue({
    isValid: true,
    errors: [],
    warnings: [],
    summary: 'All valid',
  });
}

// --- Tests ---

describe('DownloadService.downloadFiles', () => {
  let service: DownloadService;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (fs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    // Stub out the constructor's async directory check so it never causes issues
    jest.spyOn(DownloadService.prototype as any, 'ensureDownloadDirectory').mockResolvedValue(undefined);
    service = new DownloadService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits progress callbacks that increase to 100% total files', async () => {
    setupHappyPath();

    const updates: Array<{ completed: number; total: number }> = [];
    await service.downloadFiles('dl-1', (c, t) => updates.push({ completed: c, total: t }));

    expect(updates.length).toBeGreaterThan(0);
    // Each update should have total > 0
    updates.forEach(u => expect(u.total).toBeGreaterThan(0));
    // Final update: completed === total
    const last = updates[updates.length - 1];
    expect(last.completed).toBe(last.total);
  });

  it('skips files that already exist and are valid (resume logic)', async () => {
    setupHappyPath();
    // setupHappyPath sets getInfoAsync to { exists: true, size: 5000 } for all files
    // so every file passes the resume check and no downloads should happen

    await service.downloadFiles('dl-1');

    // No files should have been re-downloaded since all were already valid
    expect(fs.downloadAsync).not.toHaveBeenCalled();
  });

  it('throws user-friendly error when storage is below 50MB', async () => {
    setupHappyPath();
    (fs.getFreeDiskStorageAsync as jest.Mock).mockResolvedValue(10 * 1024 * 1024); // 10MB

    await expect(service.downloadFiles('dl-1')).rejects.toThrow('Not enough storage space');
  });

  it('preserves downloaded files on validation failure (allows resume)', async () => {
    // Files were downloaded but final validation failed — directory must NOT be deleted
    // so a retry can resume from where it left off.
    setupHappyPath();
    (mockValidator.validateDownload as jest.Mock).mockResolvedValue({
      isValid: false,
      errors: ['Corrupted file'],
      warnings: [],
      summary: 'Failed',
    });

    await expect(service.downloadFiles('dl-1')).rejects.toThrow();

    // Directory should NOT be deleted since audio files were downloaded
    expect(fs.deleteAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('dl-1'),
      expect.objectContaining({ idempotent: true })
    );
  });

  it('deletes download directory when failure occurs before any audio is downloaded', async () => {
    // Simulate an early failure: status check itself throws (e.g. network error)
    (fs.getFreeDiskStorageAsync as jest.Mock).mockResolvedValue(10 * 1024 * 1024); // below quota
    (mockApi.get as jest.Mock).mockResolvedValue({ data: { ...COMPLETED_STATUS } });
    (fs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 5000 });
    (fs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (fs.readAsStringAsync as jest.Mock).mockResolvedValue(VALID_CONTENT);

    await expect(service.downloadFiles('dl-1')).rejects.toThrow('Not enough storage space');

    // No audio files were pushed before the error, so directory should be deleted
    expect(fs.deleteAsync).toHaveBeenCalledWith(
      expect.stringContaining('dl-1'),
      expect.objectContaining({ idempotent: true })
    );
  });

  it('retries a failed download 3 times before giving up', async () => {
    // Keep getInfoAsync valid so ensureDownloadDirectory (called async from constructor)
    // doesn't produce unhandled rejection during the real retry wait
    (fs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (fs.downloadAsync as jest.Mock).mockRejectedValue(new Error('network'));

    await expect(
      (service as any).downloadFileWithRetry(
        'http://localhost:8000/file.mp3',
        '/docs/downloads/test.mp3'
      )
    ).rejects.toThrow('Failed after 3 attempts');

    expect(fs.downloadAsync).toHaveBeenCalledTimes(3);
  }, 10000); // allow up to 10s for real retry delays (0 + 1 + 3 = 4s)
});

describe('DownloadService.getDownloadedContent', () => {
  let service: DownloadService;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    jest.spyOn(DownloadService.prototype as any, 'ensureDownloadDirectory').mockResolvedValue(undefined);
    service = new DownloadService();
  });

  it('returns null for missing paragraph audio instead of null for whole chapter', async () => {
    (fs.getInfoAsync as jest.Mock).mockImplementation((path: string) => {
      if ((path as string).endsWith('downloads/dl-1')) return Promise.resolve({ exists: true });
      if ((path as string).endsWith('content.json')) return Promise.resolve({ exists: true, size: 5000 });
      if ((path as string).endsWith('title.mp3')) return Promise.resolve({ exists: true, size: 5000 });
      if ((path as string).endsWith('1.mp3')) return Promise.resolve({ exists: false }); // missing
      return Promise.resolve({ exists: true, size: 5000 });
    });
    (fs.readAsStringAsync as jest.Mock).mockResolvedValue(VALID_CONTENT);
    (fs.readDirectoryAsync as jest.Mock).mockResolvedValue(['content.json', 'title.mp3', '0.mp3', '2.mp3']);

    const result = await service.getDownloadedContent('dl-1');

    expect(result).not.toBeNull();
    expect(result!.audioFiles.paragraphs[0]).toBeTruthy();  // 0.mp3 present
    expect(result!.audioFiles.paragraphs[1]).toBeNull();     // 1.mp3 missing → null
    expect(result!.audioFiles.paragraphs[2]).toBeTruthy();  // 2.mp3 present
  });
});

describe('DownloadService.pollDownloadUntilComplete', () => {
  let service: DownloadService;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    jest.spyOn(DownloadService.prototype as any, 'ensureDownloadDirectory').mockResolvedValue(undefined);
    service = new DownloadService();
  });

  it('scales backend progress to 0–50% range before calling onProgress', async () => {
    setupHappyPath();

    // Return 'completed' with progress 80 immediately (no wait loop)
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: { ...COMPLETED_STATUS, status: 'completed', progress: 80 },
    });

    // Stub downloadFiles so we don't do actual file ops
    jest.spyOn(service as any, 'downloadFiles').mockResolvedValue(undefined);

    const progressValues: number[] = [];
    await service.pollDownloadUntilComplete('dl-1', (status) => {
      progressValues.push(status.progress);
    });

    // 80% backend progress should be scaled to 40%
    expect(progressValues).toContain(40);
  });
});
