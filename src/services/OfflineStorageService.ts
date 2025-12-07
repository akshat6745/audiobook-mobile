import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { Paragraph } from '../types';

export interface OfflineChapter {
  novelName: string;
  chapterNumber: number;
  chapterTitle: string;
  paragraphs: Paragraph[];
  audioFiles?: Record<string, string>; // Map of paragraph index to filename
  timestamp: number;
  localJsonPath: string;
  localAudioPath: string; // Directory containing audio files
}

interface ManifestEntry {
  id: string; // UUID for directory name
  title: string;
  lastUpdated: number;
}

interface Manifest {
  novels: Record<string, ManifestEntry>; // map novelTitle -> ManifestEntry
}

const BASE_DIR = FileSystem.documentDirectory + 'downloads/';
const MANIFEST_PATH = BASE_DIR + 'manifest.json';

class OfflineStorageService {
  private manifest: Manifest | null = null;

  constructor() {
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    const dirInfo = await FileSystem.getInfoAsync(BASE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BASE_DIR, { intermediates: true });
    }
  }

  // --- Manifest Management ---

  private async loadManifest(): Promise<Manifest> {
    if (this.manifest) return this.manifest;

    try {
      const fileInfo = await FileSystem.getInfoAsync(MANIFEST_PATH);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(MANIFEST_PATH);
        this.manifest = JSON.parse(content);
      } else {
        this.manifest = { novels: {} };
      }
    } catch (e) {
      console.warn('Error loading manifest, resetting:', e);
      this.manifest = { novels: {} };
    }
    return this.manifest!;
  }

  private async saveManifest() {
    if (!this.manifest) return;
    await FileSystem.writeAsStringAsync(MANIFEST_PATH, JSON.stringify(this.manifest));
  }

  private async getNovelId(novelName: string): Promise<string> {
    await this.loadManifest();
    
    // Normalize key
    const key = novelName.trim();
    
    if (!this.manifest!.novels[key]) {
      // Create new entry
      const id = this.generateUUID();
      this.manifest!.novels[key] = {
        id,
        title: novelName,
        lastUpdated: Date.now()
      };
      await this.saveManifest();
    }
    
    return this.manifest!.novels[key].id;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async getChapterDir(novelName: string, chapterNumber: number): Promise<string> {
    const novelId = await this.getNovelId(novelName);
    return `${BASE_DIR}${novelId}/${chapterNumber}/`;
  }

  // --- Core Functionality ---

  async downloadAndSaveChapter(downloadUrl: string, novelName: string, chapterNumber: number): Promise<void> {
    await this.ensureDirectoryExists();
    const chapterDir = await this.getChapterDir(novelName, chapterNumber);
    
    // Create chapter directory
    await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });
    await FileSystem.makeDirectoryAsync(chapterDir + 'audio/', { intermediates: true });

    const tempUri = FileSystem.cacheDirectory + `temp_chapter_${Date.now()}.zip`;

    try {
      // Download directly to filesystem
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, tempUri);
      
      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      // Read as base64 to load into JSZip (JSZip supports base64 string)
      const base64 = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.Base64 });
      
      // Load zip
      const zip = await JSZip.loadAsync(base64, { base64: true });

      // Save content.json
      const contentFile = zip.file('content.json');
      if (contentFile) {
        const contentText = await contentFile.async('string');
        // Inject metadata if missing
        const content = JSON.parse(contentText);
        content.novelName = novelName; 
        content.chapterNumber = chapterNumber; 
        content.timestamp = Date.now();
        
        await FileSystem.writeAsStringAsync(chapterDir + 'content.json', JSON.stringify(content));
      }

      // Save audio files
      const audioFolder = zip.folder('audio');
      if (audioFolder) {
        const files: any[] = [];
        audioFolder.forEach((relativePath, file) => {
          files.push({ relativePath, file });
        });

        for (const { relativePath, file } of files) {
          if (!file.dir) {
            const audioBase64 = await file.async('base64');
            await FileSystem.writeAsStringAsync(
              chapterDir + 'audio/' + relativePath,
              audioBase64,
              { encoding: FileSystem.EncodingType.Base64 }
            );
          }
        }
      }
      
      // Update manifest timestamp
      if (this.manifest && this.manifest.novels[novelName]) {
        this.manifest.novels[novelName].lastUpdated = Date.now();
        await this.saveManifest();
      }

    } finally {
      // Clean up temp file
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    }
  }

  // New method to support self-healing / progressive caching
  async saveParagraphAudio(
    novelName: string, 
    chapterNumber: number, 
    paragraphIndex: number, 
    audioUri: string // Source URI (likely in cache)
  ): Promise<string | null> {
    try {
      const chapterDir = await this.getChapterDir(novelName, chapterNumber);
      const audioDir = chapterDir + 'audio/';
      
      // Ensure directories exist
      const dirInfo = await FileSystem.getInfoAsync(audioDir);
      if (!dirInfo.exists) {
        // If the chapter directory doesn't exist at all, we might want to create the scaffolding
        // assuming we have the content elsewhere or will create it. 
        // For now, allow creating the structure.
        await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
      }

      const fileName = `${paragraphIndex}.mp3`;
      const targetPath = audioDir + fileName;

      // Copy file from cache to permanent storage
      await FileSystem.copyAsync({
        from: audioUri,
        to: targetPath
      });

      console.log(`💾 Saved paragraph audio to offline storage: ${targetPath}`);
      return targetPath;
    } catch (error) {
      console.warn('Failed to save paragraph audio to offline storage:', error);
      return null;
    }
  }

  async getChapter(novelName: string, chapterNumber: number): Promise<OfflineChapter | null> {
    const chapterDir = await this.getChapterDir(novelName, chapterNumber);
    const contentPath = chapterDir + 'content.json';

    try {
      const fileInfo = await FileSystem.getInfoAsync(contentPath);
      if (!fileInfo.exists) return null;

      const contentText = await FileSystem.readAsStringAsync(contentPath);
      const content = JSON.parse(contentText);

      let paragraphs = content.paragraphs;
      if (Array.isArray(paragraphs) && paragraphs.length > 0 && typeof paragraphs[0] === 'string') {
        paragraphs = paragraphs.map((text: string, index: number) => ({ text, index }));
      }

      let audioFiles = content.audioFiles;
      // Always scan directory to catch any new files added via self-healing
      try {
        const files = await FileSystem.readDirectoryAsync(chapterDir + 'audio/');
        audioFiles = {};
        files.forEach(file => {
          if (file.endsWith('.mp3')) {
            // Check for title.mp3
            if (file === 'title.mp3') {
              audioFiles['title'] = file;
            } else {
              // Check for numeric filenames 0.mp3, 1.mp3...
              const match = file.match(/^(\d+)\.mp3$/);
              if (match) {
                const index = match[1];
                audioFiles[index] = file;
              }
            }
          }
        });
      } catch (e) {
        console.warn('Could not scan audio directory:', e);
      }
      
      return {
        novelName: content.novelName || novelName,
        chapterNumber: content.chapterNumber || chapterNumber,
        chapterTitle: content.chapterTitle,
        paragraphs: paragraphs,
        audioFiles: audioFiles,
        timestamp: content.timestamp || Date.now(),
        localJsonPath: contentPath,
        localAudioPath: chapterDir + 'audio/',
      };
    } catch (error) {
      console.error('Error reading offline chapter:', error);
      return null;
    }
  }

  async isChapterDownloaded(novelName: string, chapterNumber: number): Promise<boolean> {
    const chapterDir = await this.getChapterDir(novelName, chapterNumber);
    const contentPath = chapterDir + 'content.json';
    const fileInfo = await FileSystem.getInfoAsync(contentPath);
    return fileInfo.exists;
  }

  async deleteChapter(novelName: string, chapterNumber: number): Promise<void> {
    const chapterDir = await this.getChapterDir(novelName, chapterNumber);
    await FileSystem.deleteAsync(chapterDir, { idempotent: true });
  }

  async getAllDownloadedChapters(): Promise<OfflineChapter[]> {
    try {
      await this.loadManifest();
      const chapters: OfflineChapter[] = [];
      const novels = Object.values(this.manifest!.novels);

      for (const novel of novels) {
        const novelPath = BASE_DIR + novel.id + '/';
        const chapterDirs = await FileSystem.readDirectoryAsync(novelPath);

        for (const chapterNumDir of chapterDirs) {
          const contentPath = novelPath + chapterNumDir + '/content.json';
          const fileInfo = await FileSystem.getInfoAsync(contentPath);
          
          if (fileInfo.exists) {
            const contentText = await FileSystem.readAsStringAsync(contentPath);
            const content = JSON.parse(contentText);
            chapters.push({
              novelName: content.novelName || novel.title,
              chapterNumber: content.chapterNumber,
              chapterTitle: content.chapterTitle,
              paragraphs: content.paragraphs,
              timestamp: content.timestamp || Date.now(),
              localJsonPath: contentPath,
              localAudioPath: novelPath + chapterNumDir + '/audio/',
            });
          }
        }
      }
      return chapters.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting all downloaded chapters:', error);
      // Fallback to legacy scan if manifest fails?
      // For now, simpler to just return clean slate or what we found
      return [];
    }
  }

  getAudioUri(novelId: string, chapterNumber: number, filename: string): string {
    // Note: This method was synchronous before, but getChapterDir is async now.
    // However, we can construct the path if we have the ID. 
    // The previous usage was taking novelName.
    // To support sync usage, this method needs to return the path directly.
    // BUT we need the ID.
    // Usage of this method seems rare (only verified in deleted code or tests?).
    // Let's implement it by ASSUMING it receives the Novel Name and doing a best effort
    // or better, deprecated it. 
    // Actually, looking at AudioContext usage, it gets the path from `offlineChapter.localAudioPath`
    // which is returned by `getChapter` (async). 
    // `getAudioUri` was not used in the viewed AudioContext code.
    return `${BASE_DIR}${novelId}/${chapterNumber}/audio/${filename}`;
  }
}

export const offlineStorage = new OfflineStorageService();
