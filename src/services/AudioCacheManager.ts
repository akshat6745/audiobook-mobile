import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import api from './api';
import { offlineStorage } from './OfflineStorageService';

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
  isOffline?: boolean; // Flag to identify permanent offline files
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
  
  // Context for self-healing offline storage
  private currentNovelName: string | null = null;
  private currentChapterNumber: number | null = null;

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
  
  setContext(novelName: string, chapterNumber: number) {
    this.currentNovelName = novelName;
    this.currentChapterNumber = chapterNumber;
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

    // Check if we have valid cached audio with data integrity validation
    const cached = this.cache.get(paragraphIndex);
    if (cached) {
      // Validate cache entry integrity
      const isValid = cached.audio_received === true &&
                     typeof cached.audio_uri === 'string' &&
                     cached.audio_uri.length > 0;

      if (isValid) {
        console.log(`✅ Using cached audio for paragraph ${paragraphIndex}`);
        // Trigger preload for upcoming paragraphs (non-blocking) with current speed
        this.triggerPreload(paragraphIndex, allParagraphs, this.currentPlaybackSpeed);
        return cached;
      } else {
        // Clean up corrupted cache entry
        console.warn(`⚠️ Corrupted cache entry detected for paragraph ${paragraphIndex}`, {
          audio_received: cached.audio_received,
          audio_received_type: typeof cached.audio_received,
          audio_uri: cached.audio_uri,
          audio_uri_type: typeof cached.audio_uri,
          is_loading: cached.is_loading,
          is_loading_type: typeof cached.is_loading
        });
        this.cache.delete(paragraphIndex);
        console.log(`🗑️ Removed corrupted cache entry for paragraph ${paragraphIndex}`);
      }
    }

    // Check if already loading - wait for it
    if (this.activeRequests.has(paragraphIndex)) {
      console.log(`⏳ Waiting for existing request for paragraph ${paragraphIndex}`);
      try {
        await this.activeRequests.get(paragraphIndex);
        const loadedData = this.cache.get(paragraphIndex);
        if (loadedData) {
          const isValid = loadedData.audio_received === true &&
                         typeof loadedData.audio_uri === 'string' &&
                         loadedData.audio_uri.length > 0;

          if (isValid) {
            console.log(`✅ Audio ready after wait for paragraph ${paragraphIndex}`);
            // Trigger preload (non-blocking) with current speed
            this.triggerPreload(paragraphIndex, allParagraphs, this.currentPlaybackSpeed);
            return loadedData;
          } else {
            console.warn(`⚠️ Invalid data after wait for paragraph ${paragraphIndex}`, {
              audio_received: loadedData.audio_received,
              audio_uri_valid: typeof loadedData.audio_uri === 'string' && loadedData.audio_uri.length > 0
            });
          }
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
   * Load audio for a specific paragraph with enhanced race condition protection
   */
  private async loadAudioForParagraph(
    paragraphIndex: number,
    paragraphText: string
  ): Promise<ParagraphAudioData | null> {
    // Double check if already cached with data validation (race condition protection)
    const existing = this.cache.get(paragraphIndex);
    if (existing) {
      const isValid = existing.audio_received === true &&
                     typeof existing.audio_uri === 'string' &&
                     existing.audio_uri.length > 0;

      if (isValid) {
        console.log(`🔄 Audio already loaded for paragraph ${paragraphIndex}`);
        return existing;
      } else if (existing.audio_received !== undefined) {
        // Clean up invalid cache entry
        console.warn(`⚠️ Cleaning invalid cache entry for paragraph ${paragraphIndex}`);
        this.cache.delete(paragraphIndex);
      }
    }

    // Check if already being loaded by another request
    if (this.activeRequests.has(paragraphIndex)) {
      console.log(`⏳ Another request already loading paragraph ${paragraphIndex}, skipping duplicate`);
      return null;
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

      // Validate data integrity with detailed logging
      if (loadedData) {
        const isValid = loadedData.audio_received === true && !!loadedData.audio_uri;

        if (isValid) {
          console.log(`✅ Successfully loaded audio for paragraph ${paragraphIndex}`);
          return loadedData;
        } else {
          console.error(`❌ Audio data incomplete for paragraph ${paragraphIndex}`, {
            audio_received: loadedData.audio_received,
            audio_received_type: typeof loadedData.audio_received,
            has_audio_uri: !!loadedData.audio_uri,
            audio_uri_type: typeof loadedData.audio_uri,
            is_loading: loadedData.is_loading,
            is_loading_type: typeof loadedData.is_loading,
            cache_entry: loadedData
          });

          // Clean up corrupted entry
          this.cache.delete(paragraphIndex);
          console.log(`🗑️ Removed corrupted cache entry for paragraph ${paragraphIndex}`);
          return null;
        }
      } else {
        console.error(`❌ No data found in cache for paragraph ${paragraphIndex} after loading`);
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

    // Check if already in cache and valid to prevent race conditions
    const existingData = this.cache.get(paragraphIndex);
    if (existingData?.audio_received === true && existingData.audio_uri) {
      console.log(`🔄 Audio already loaded for paragraph ${paragraphIndex}, skipping`);
      return;
    }

    // Create or update cache entry with proper initialization
    const audioData: ParagraphAudioData = {
      paragraph_index: paragraphIndex,
      paragraph_text: paragraphText,
      audio_received: false, // Explicitly set to false
      is_loading: true, // Explicitly set to true
      created_at: Date.now(),
      character_count: paragraphText.length,
    };

    this.cache.set(paragraphIndex, audioData);
    console.log(`💾 Cache entry created for paragraph ${paragraphIndex}:`, {
      audio_received: audioData.audio_received,
      is_loading: audioData.is_loading
    });

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

      // --- SELF HEALING: Save to offline storage if context is available ---
      if (this.currentNovelName && this.currentChapterNumber !== null) {
          // Fire and forget - don't block playback for this
          offlineStorage.saveParagraphAudio(
            this.currentNovelName,
            this.currentChapterNumber,
            paragraphIndex,
            fileUri
          ).then((savedPath) => {
            if (savedPath) {
               // Update cache to point to permanent location?
               // Maybe not strictly necessary for this session, but good for cleanliness.
               // However, we already set audio_uri to fileUri (temp).
               // If we update it here, we might need to be careful about async race conditions.
               // For now, let's just save it. Next load will pick it up from offline storage.
               // Actually, if we update it, we can mark it as isOffline = true?
               // Let's keep it simple: just save it. The NEXT time chapter loads, it will be offline.
            }
          });
      }
      // -------------------------------------------------------------------

      // Update cache entry with explicit values
      audioData.audio_received = true;
      audioData.audio_uri = fileUri;
      audioData.is_loading = false;

      // Ensure the cache is properly updated
      this.cache.set(paragraphIndex, audioData);

      console.log(`💾 Cache entry updated for paragraph ${paragraphIndex}:`, {
        audio_received: audioData.audio_received,
        audio_uri: !!audioData.audio_uri,
        is_loading: audioData.is_loading
      });

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
      // Ensure proper error state in cache
      audioData.is_loading = false;
      audioData.audio_received = false;
      this.cache.set(paragraphIndex, audioData);

      console.error(`❌ Error loading audio for paragraph ${paragraphIndex}:`, error);
      console.log(`💾 Cache entry error state for paragraph ${paragraphIndex}:`, {
        audio_received: audioData.audio_received,
        is_loading: audioData.is_loading
      });
      throw error;
    }
  }

  /**
   * Seed cache with existing audio URI (e.g. from offline storage)
   */
  async seedCache(paragraphIndex: number, paragraphText: string, audioUri: string): Promise<void> {
    console.log(`🌱 Seeding cache for paragraph ${paragraphIndex} with URI: ${audioUri}`);
    
    const audioData: ParagraphAudioData = {
      paragraph_index: paragraphIndex,
      paragraph_text: paragraphText,
      audio_received: true,
      audio_uri: audioUri,
      is_loading: false,
      created_at: Date.now(),
      character_count: paragraphText.length,
      isOffline: true, // Mark as offline/permanent
    };

    // Get duration if possible
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        audioData.audio_duration = status.durationMillis || 0;
      }
      await sound.unloadAsync();
    } catch (error) {
      console.warn(`Could not get duration for seeded paragraph ${paragraphIndex}:`, error);
    }

    this.cache.set(paragraphIndex, audioData);
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
      // NEVER delete offline entries from cache map
      if (data.isOffline) return;

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
   * Check if audio is ready for a paragraph with data validation
   */
  isAudioReady(paragraphIndex: number): boolean {
    const cached = this.cache.get(paragraphIndex);
    if (!cached) return false;

    const isValid = cached.audio_received === true &&
                   typeof cached.audio_uri === 'string' &&
                   cached.audio_uri.length > 0;

    if (!isValid && cached.audio_received !== undefined) {
      // Clean up invalid entry
      console.warn(`⚠️ Invalid cache entry detected in isAudioReady for paragraph ${paragraphIndex}`);
      this.cache.delete(paragraphIndex);
    }

    return isValid;
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
      // Don't delete offline files even on clearCache if possible? 
      // Actually clearCache is usually when voices change, so we might want to reload. 
      // But offline files are static. 
      // For now, let's play it safe and NOT delete isOffline files even here.
      if (data.isOffline) return;

      if (data.audio_uri) filesToDelete.push(data.audio_uri);
    });

    // We can clear the map, but offline entries might need to be preserved if we want to change voices but keep offline?
    // Actually offline audio is pre-rendered with specific voices. If user changes voice, offline audio shouldn't be used?
    // But offline audio IS the source of truth for that chapter.
    // Ideally we should keep offline entries.
    // For now, I will just filter filesToDelete.
    // The map will be cleared, so next time it will reload ... from where?
    // If we clear map, we lose the 'isOffline' knowledge.
    // But updateVoices happens rarely.

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