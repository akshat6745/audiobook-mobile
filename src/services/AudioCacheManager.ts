import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import api from './api';

// Enhanced data structure for paragraph audio caching
export interface ParagraphAudioData {
  paragraph_index: number;
  paragraph_text: string;
  audio_received: boolean;
  audio_uri?: string;
  audio_duration?: number;
  is_loading: boolean;
  created_at: number;
  character_count: number;
}

export interface AudioCacheConfig {
  maxCacheSize: number;
  preloadCharacterThreshold: number; // Target 1000+ characters ready
  maxPreloadDistance: number; // Max paragraphs to preload ahead
  cacheExpiryMs: number;
}

export class AudioCacheManager {
  private cache: Map<number, ParagraphAudioData> = new Map();
  private activeRequests: Map<number, Promise<void>> = new Map();
  private currentPlayingIndex: number | null = null;
  private narratorVoice: string;
  private dialogueVoice: string;
  private config: AudioCacheConfig;
  private currentPlaybackSpeed: number = 1.0; // Track current playback speed

  constructor(
    narratorVoice: string,
    dialogueVoice: string,
    config: AudioCacheConfig = {
      maxCacheSize: 20,
      preloadCharacterThreshold: 1000,
      maxPreloadDistance: 8,
      cacheExpiryMs: 30 * 60 * 1000, // 30 minutes
    }
  ) {
    this.narratorVoice = narratorVoice;
    this.dialogueVoice = dialogueVoice;
    this.config = config;
  }

  /**
   * Get audio for a paragraph, with automatic preloading
   */
  async getAudio(
    paragraphIndex: number,
    paragraphText: string,
    allParagraphs: string[]
  ): Promise<ParagraphAudioData | null> {
    console.log(`🎵 Getting audio for paragraph ${paragraphIndex}`);

    // Check if we have valid cached audio
    const cached = this.cache.get(paragraphIndex);
    if (cached?.audio_received && cached.audio_uri) {
      console.log(`✅ Using cached audio for paragraph ${paragraphIndex}`);
      // Trigger preload for upcoming paragraphs (non-blocking) with current speed
      this.triggerPreload(paragraphIndex, allParagraphs, this.currentPlaybackSpeed);
      return cached;
    }

    // Check if already loading - wait for it
    if (this.activeRequests.has(paragraphIndex)) {
      console.log(`⏳ Waiting for existing request for paragraph ${paragraphIndex}`);
      try {
        await this.activeRequests.get(paragraphIndex);
        const loadedData = this.cache.get(paragraphIndex);
        if (loadedData?.audio_received && loadedData.audio_uri) {
          console.log(`✅ Audio ready after wait for paragraph ${paragraphIndex}`);
          // Trigger preload (non-blocking) with current speed
          this.triggerPreload(paragraphIndex, allParagraphs, this.currentPlaybackSpeed);
          return loadedData;
        }
      } catch (error) {
        console.error(`❌ Error waiting for paragraph ${paragraphIndex}:`, error);
      }
    }

    // Load audio for this paragraph and wait for completion
    console.log(`📡 Loading new audio for paragraph ${paragraphIndex}`);
    const audioData = await this.loadAudioForParagraph(paragraphIndex, paragraphText);

    // Trigger preload for upcoming paragraphs (non-blocking) with current speed
    if (audioData?.audio_received) {
      this.triggerPreload(paragraphIndex, allParagraphs, this.currentPlaybackSpeed);
    }

    return audioData;
  }

  /**
   * Load audio for a specific paragraph
   */
  private async loadAudioForParagraph(
    paragraphIndex: number,
    paragraphText: string
  ): Promise<ParagraphAudioData | null> {
    // Double check if already cached (race condition protection)
    const existing = this.cache.get(paragraphIndex);
    if (existing?.audio_received && existing.audio_uri) {
      console.log(`🔄 Audio already loaded for paragraph ${paragraphIndex}`);
      return existing;
    }

    const loadPromise = this._loadAudioInternal(paragraphIndex, paragraphText);
    this.activeRequests.set(paragraphIndex, loadPromise);

    try {
      await loadPromise;
      const loadedData = this.cache.get(paragraphIndex);
      console.log(`🔍 Validating loaded data for paragraph ${paragraphIndex}:`, {
        exists: !!loadedData,
        audio_received: loadedData?.audio_received,
        audio_uri: !!loadedData?.audio_uri,
        is_loading: loadedData?.is_loading
      });

      if (loadedData?.audio_received && loadedData.audio_uri) {
        console.log(`✅ Successfully loaded audio for paragraph ${paragraphIndex}`);
        return loadedData;
      } else {
        console.error(`❌ Audio data incomplete for paragraph ${paragraphIndex}`, {
          audio_received: loadedData?.audio_received,
          has_audio_uri: !!loadedData?.audio_uri,
          is_loading: loadedData?.is_loading
        });
        return null;
      }
    } catch (error) {
      console.error(`❌ Failed to load audio for paragraph ${paragraphIndex}:`, error);
      return null;
    } finally {
      this.activeRequests.delete(paragraphIndex);
    }
  }

  private async _loadAudioInternal(paragraphIndex: number, paragraphText: string): Promise<void> {
    console.log(`📡 Loading audio for paragraph ${paragraphIndex}`);

    // Create cache entry
    const audioData: ParagraphAudioData = {
      paragraph_index: paragraphIndex,
      paragraph_text: paragraphText,
      audio_received: false,
      is_loading: true,
      created_at: Date.now(),
      character_count: paragraphText.length,
    };

    this.cache.set(paragraphIndex, audioData);

    try {
      // Make TTS API call
      const response = await fetch(`${api.defaults.baseURL}/tts-dual-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: paragraphText,
          paragraphVoice: this.narratorVoice,
          dialogueVoice: this.dialogueVoice,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API failed: ${response.status} ${response.statusText}`);
      }

      // Convert to file and cache
      const audioBlob = await response.blob();
      const fileUri = await this.saveAudioToFile(paragraphIndex, audioBlob);

      // Update cache entry
      audioData.audio_received = true;
      audioData.audio_uri = fileUri;
      audioData.is_loading = false;

      // Get audio duration
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          audioData.audio_duration = status.durationMillis || 0;
        }
        await sound.unloadAsync();
      } catch (durationError) {
        console.warn(`Could not get duration for paragraph ${paragraphIndex}:`, durationError);
      }

      console.log(`✅ Audio loaded for paragraph ${paragraphIndex}, duration: ${audioData.audio_duration}ms`);

    } catch (error) {
      audioData.is_loading = false;
      console.error(`❌ Error loading audio for paragraph ${paragraphIndex}:`, error);
      throw error;
    }
  }

  /**
   * Save audio blob to file system
   */
  private async saveAudioToFile(paragraphIndex: number, audioBlob: Blob): Promise<string> {
    const fileUri = `${FileSystem.cacheDirectory}audio_${paragraphIndex}_${Date.now()}.mp3`;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: 'base64' as any,
          });
          resolve(fileUri);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(audioBlob);
    });
  }

  /**
   * Intelligent preloading based on character count threshold (non-blocking)
   */
  private triggerPreload(currentIndex: number, allParagraphs: string[], playbackSpeed: number = 1.0): void {
    // Speed-adaptive preloading - immediate for fast speeds
    const preloadDelay = playbackSpeed >= 1.5 ? 0 : 1; // Immediate for 1.5x+ speeds

    setTimeout(async () => {
      try {
        console.log(`🔄 Triggering preload from paragraph ${currentIndex}`);

        // ULTRA-PRIORITY: Ensure immediate next paragraph is always ready first
        const immediateNext = currentIndex + 1;
        if (immediateNext < allParagraphs.length &&
            !this.cache.has(immediateNext) &&
            !this.activeRequests.has(immediateNext)) {
          console.log(`🚀 ULTRA-PRIORITY instant preload next paragraph ${immediateNext}`);
          // Fire and forget for maximum speed
          this.loadAudioForParagraph(immediateNext, allParagraphs[immediateNext]);
        }

        let totalCharacters = 0;
        let preloadCount = 0;

        // Speed-adaptive preloading distance - more aggressive for faster speeds
        const speedMultiplier = Math.min(playbackSpeed, 2.5);
        const adaptiveMaxDistance = Math.min(
          Math.floor(this.config.maxPreloadDistance * speedMultiplier),
          allParagraphs.length - currentIndex - 1
        );

        console.log(`📊 Speed-adaptive preloading: ${speedMultiplier}x speed, max distance: ${adaptiveMaxDistance}`);

        // Calculate how many paragraphs ahead we need to preload to reach character threshold
        for (let i = currentIndex + 1; i < allParagraphs.length && preloadCount < adaptiveMaxDistance; i++) {
          const paragraph = allParagraphs[i];
          totalCharacters += paragraph.length;
          preloadCount++;

          // Preload this paragraph if not already cached/loading
          if (!this.cache.has(i) && !this.activeRequests.has(i)) {
            const isPriority = (i === immediateNext) ? " (PRIORITY)" : "";
            console.log(`📋 Preloading paragraph ${i} (${paragraph.length} chars)${isPriority}`);
            this.loadAudioForParagraph(i, paragraph).catch(error => {
              console.warn(`Failed to preload paragraph ${i}:`, error);
            });
          }

          // Stop if we've reached our character threshold
          if (totalCharacters >= this.config.preloadCharacterThreshold) {
            console.log(`✅ Preload target reached: ${totalCharacters} characters across ${preloadCount} paragraphs`);
            break;
          }
        }

        // Clean up old entries to manage cache size
        this.cleanupCache(currentIndex);
      } catch (error) {
        console.warn('Error in preload trigger:', error);
      }
    }, preloadDelay); // Speed-adaptive delay
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(currentIndex: number): void {
    if (this.cache.size <= this.config.maxCacheSize) return;

    const keepRange = 3; // Keep 3 paragraphs before and after current
    const keepStart = Math.max(0, currentIndex - keepRange);
    const keepEnd = currentIndex + this.config.maxPreloadDistance;

    const toDelete: number[] = [];
    const filesToDelete: string[] = [];

    this.cache.forEach((data, index) => {
      if (index < keepStart || index > keepEnd) {
        toDelete.push(index);
        if (data.audio_uri) {
          filesToDelete.push(data.audio_uri);
        }
      }
    });

    // Delete from cache
    toDelete.forEach(index => {
      this.cache.delete(index);
      console.log(`🗑️ Removed paragraph ${index} from cache`);
    });

    // Delete files asynchronously
    filesToDelete.forEach(async (fileUri) => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      } catch (error) {
        console.warn(`Failed to delete audio file: ${fileUri}`, error);
      }
    });

    console.log(`🧹 Cache cleanup: removed ${toDelete.length} entries, ${this.cache.size} remaining`);
  }

  /**
   * Set currently playing paragraph (for optimization)
   */
  setCurrentlyPlaying(index: number | null): void {
    this.currentPlayingIndex = index;
  }

  /**
   * Update playback speed for adaptive caching
   */
  setPlaybackSpeed(speed: number): void {
    this.currentPlaybackSpeed = speed;
    console.log(`⚡ Cache manager updated to ${speed}x playback speed`);
  }

  /**
   * Check if audio is ready for a paragraph
   */
  isAudioReady(paragraphIndex: number): boolean {
    const cached = this.cache.get(paragraphIndex);
    return cached?.audio_received && !!cached.audio_uri;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalCached: number;
    readyCount: number;
    loadingCount: number;
    totalCharactersCached: number;
  } {
    let readyCount = 0;
    let loadingCount = 0;
    let totalCharactersCached = 0;

    this.cache.forEach(data => {
      if (data.audio_received) readyCount++;
      if (data.is_loading) loadingCount++;
      totalCharactersCached += data.character_count;
    });

    return {
      totalCached: this.cache.size,
      readyCount,
      loadingCount,
      totalCharactersCached,
    };
  }

  /**
   * Update voice settings (clears cache)
   */
  updateVoices(narratorVoice: string, dialogueVoice: string): void {
    if (this.narratorVoice !== narratorVoice || this.dialogueVoice !== dialogueVoice) {
      console.log(`🔄 Voice settings changed, clearing cache`);
      this.clearCache();
      this.narratorVoice = narratorVoice;
      this.dialogueVoice = dialogueVoice;
    }
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    const filesToDelete: string[] = [];
    this.cache.forEach(data => {
      if (data.audio_uri) filesToDelete.push(data.audio_uri);
    });

    this.cache.clear();
    this.activeRequests.clear();

    // Delete files
    filesToDelete.forEach(async (fileUri) => {
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (error) {
        console.warn(`Failed to delete audio file: ${fileUri}`, error);
      }
    });

    console.log(`🗑️ Cache cleared, ${filesToDelete.length} files deleted`);
  }
}