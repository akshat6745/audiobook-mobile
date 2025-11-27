import { Audio } from 'expo-av';
import { AudioCacheManager, ParagraphAudioData } from './AudioCacheManager';

export interface AudioPlayerState {
  isPlaying: boolean;
  currentIndex: number | null;
  isLoading: boolean;
  duration: number;
  position: number;
  playbackSpeed: number;
}

export interface AutoAdvanceConfig {
  enabled: boolean;
  delayMs: number;
}

export class AudioPlayerManager {
  private sound: Audio.Sound | null = null;
  private cacheManager: AudioCacheManager;
  private currentIndex: number | null = null;
  private isPlaying: boolean = false;
  private isLoading: boolean = false;
  private playbackSpeed: number = 1.0;
  private autoAdvanceConfig: AutoAdvanceConfig = { enabled: true, delayMs: 500 };

  // Callbacks
  private onStateChange?: (state: AudioPlayerState) => void;
  private onAutoAdvance?: (fromIndex: number, toIndex: number) => void;
  private onError?: (error: Error) => void;

  // Prevent multiple simultaneous operations
  private operationLock: boolean = false;
  private completionHandled: boolean = false;

  constructor(cacheManager: AudioCacheManager) {
    this.cacheManager = cacheManager;
    this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  /**
   * Play audio for a specific paragraph
   */
  async playParagraph(
    paragraphIndex: number,
    paragraphText: string,
    allParagraphs: string[]
  ): Promise<boolean> {
    console.log(`🎵 PlayParagraph called for index ${paragraphIndex}`);

    // Prevent multiple simultaneous operations
    if (this.operationLock) {
      console.log(`⚠️ Operation already in progress, ignoring play request for ${paragraphIndex}`);
      return false;
    }

    this.operationLock = true;

    try {
      // Stop current playback
      await this.stopCurrentPlayback();

      // Set loading state
      this.setLoadingState(true, paragraphIndex);

      // Get audio from cache manager
      const audioData = await this.cacheManager.getAudio(
        paragraphIndex,
        paragraphText,
        allParagraphs
      );

      if (!audioData) {
        throw new Error(`Failed to load audio data for paragraph ${paragraphIndex}`);
      }

      if (!audioData.audio_received) {
        throw new Error(`Audio not ready for paragraph ${paragraphIndex} (still loading)`);
      }

      if (!audioData.audio_uri) {
        throw new Error(`No audio URI available for paragraph ${paragraphIndex}`);
      }

      console.log(`🎵 Audio ready for paragraph ${paragraphIndex}, URI: ${audioData.audio_uri.substring(0, 50)}...`);

      // Create and play sound
      await this.createAndPlaySound(audioData);

      console.log(`✅ Successfully started playing paragraph ${paragraphIndex}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to play paragraph ${paragraphIndex}:`, error);
      this.onError?.(error as Error);
      return false;
    } finally {
      this.setLoadingState(false);
      this.operationLock = false;
    }
  }

  /**
   * Stop current playback
   */
  private async stopCurrentPlayback(): Promise<void> {
    if (this.sound) {
      try {
        console.log(`⏹️ Stopping current playback`);
        await this.sound.unloadAsync();
      } catch (error) {
        console.warn('Error stopping previous sound:', error);
      }
      this.sound = null;
    }

    this.isPlaying = false;
    this.emitStateChange();
  }

  /**
   * Create and play sound from audio data
   */
  private async createAndPlaySound(audioData: ParagraphAudioData): Promise<void> {
    console.log(`🔊 Creating sound for paragraph ${audioData.paragraph_index}`);

    // Reset completion handler for new audio
    this.completionHandled = false;

    const { sound } = await Audio.Sound.createAsync(
      { uri: audioData.audio_uri! },
      {
        shouldPlay: true,
        rate: this.playbackSpeed,
        shouldCorrectPitch: true,
      },
      this.createStatusCallback(audioData.paragraph_index)
    );

    this.sound = sound;
    this.currentIndex = audioData.paragraph_index;
    this.isPlaying = true;

    // Update cache manager about currently playing
    this.cacheManager.setCurrentlyPlaying(audioData.paragraph_index);

    this.emitStateChange();
  }

  /**
   * Create status callback for audio playback
   */
  private createStatusCallback(paragraphIndex: number) {
    return (status: any) => {
      console.log(`📊 Audio status for paragraph ${paragraphIndex}:`, {
        isPlaying: status.isPlaying,
        didJustFinish: status.didJustFinish,
        positionMillis: status.positionMillis,
        durationMillis: status.durationMillis,
      });

      // Update playing state
      this.isPlaying = status.isPlaying || false;

      // Handle audio completion
      const audioCompleted = status.didJustFinish || this.isAudioComplete(status);
      if (audioCompleted) {
        console.log(`✅ Audio completed for paragraph ${paragraphIndex}`, {
          didJustFinish: status.didJustFinish,
          isAudioComplete: this.isAudioComplete(status),
          position: status.positionMillis,
          duration: status.durationMillis
        });
        this.handleAudioCompletion(paragraphIndex);
      }

      this.emitStateChange();
    };
  }

  /**
   * Check if audio is complete using multiple methods
   */
  private isAudioComplete(status: any): boolean {
    const isComplete = !status.isPlaying &&
           status.positionMillis &&
           status.durationMillis &&
           status.positionMillis >= status.durationMillis - 500; // Increased threshold for better detection

    if (status.positionMillis && status.durationMillis) {
      const progress = status.positionMillis / status.durationMillis;
      console.log(`🎵 Audio progress: ${Math.round(progress * 100)}% (${status.positionMillis}ms / ${status.durationMillis}ms), isPlaying: ${status.isPlaying}, complete: ${isComplete}`);
    }

    return isComplete;
  }

  /**
   * Handle audio completion and auto-advance
   */
  private handleAudioCompletion(paragraphIndex: number): void {
    // Prevent multiple completion events for the same audio
    if (this.completionHandled) {
      console.log(`⚠️ Audio completion already handled for paragraph ${paragraphIndex}, skipping`);
      return;
    }

    this.completionHandled = true;
    this.isPlaying = false;

    console.log(`🏁 Audio completion detected for paragraph ${paragraphIndex}`, {
      autoAdvanceEnabled: this.autoAdvanceConfig.enabled,
      hasCallback: !!this.onAutoAdvance,
      delayMs: this.autoAdvanceConfig.delayMs
    });

    if (this.autoAdvanceConfig.enabled) {
      console.log(`⏭️ Auto-advancing from paragraph ${paragraphIndex} to ${paragraphIndex + 1}`);

      setTimeout(() => {
        console.log(`🎯 Executing auto-advance callback: ${paragraphIndex} -> ${paragraphIndex + 1}`);
        this.onAutoAdvance?.(paragraphIndex, paragraphIndex + 1);
      }, this.autoAdvanceConfig.delayMs);
    } else {
      console.log(`❌ Auto-advance disabled or no callback available`);
    }
  }

  /**
   * Toggle playback (play/pause)
   */
  async togglePlayback(): Promise<boolean> {
    if (!this.sound || this.operationLock) return false;

    this.operationLock = true;

    try {
      if (this.isPlaying) {
        await this.sound.pauseAsync();
        this.isPlaying = false;
        console.log(`⏸️ Paused playback`);
      } else {
        await this.sound.playAsync();
        this.isPlaying = true;
        console.log(`▶️ Resumed playback`);
      }

      this.emitStateChange();
      return true;
    } catch (error) {
      console.error('Error toggling playback:', error);
      this.onError?.(error as Error);
      return false;
    } finally {
      this.operationLock = false;
    }
  }

  /**
   * Set playback speed
   */
  async setPlaybackSpeed(speed: number): Promise<void> {
    this.playbackSpeed = speed;

    if (this.sound && !this.operationLock) {
      try {
        await this.sound.setRateAsync(speed, true);
        console.log(`🏃 Playback speed set to ${speed}x`);
      } catch (error) {
        console.error('Error setting playback speed:', error);
      }
    }
  }

  /**
   * Set loading state
   */
  private setLoadingState(loading: boolean, index?: number): void {
    this.isLoading = loading;
    if (index !== undefined) {
      this.currentIndex = index;
    }
    this.emitStateChange();
  }

  /**
   * Emit state change to listeners
   */
  private emitStateChange(): void {
    const state: AudioPlayerState = {
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      isLoading: this.isLoading,
      duration: 0, // Could be enhanced to track duration
      position: 0, // Could be enhanced to track position
      playbackSpeed: this.playbackSpeed,
    };

    this.onStateChange?.(state);
  }

  /**
   * Configure auto-advance
   */
  configureAutoAdvance(config: AutoAdvanceConfig): void {
    this.autoAdvanceConfig = config;
    console.log(`⚙️ Auto-advance configured:`, config);
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: {
    onStateChange?: (state: AudioPlayerState) => void;
    onAutoAdvance?: (fromIndex: number, toIndex: number) => void;
    onError?: (error: Error) => void;
  }): void {
    this.onStateChange = callbacks.onStateChange;
    this.onAutoAdvance = callbacks.onAutoAdvance;
    this.onError = callbacks.onError;
  }

  /**
   * Get current player state
   */
  getCurrentState(): AudioPlayerState {
    return {
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      isLoading: this.isLoading,
      duration: 0,
      position: 0,
      playbackSpeed: this.playbackSpeed,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log(`🧹 Cleaning up audio player`);

    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        console.warn('Error during sound cleanup:', error);
      }
      this.sound = null;
    }

    this.currentIndex = null;
    this.isPlaying = false;
    this.isLoading = false;
    this.operationLock = false;

    this.emitStateChange();
  }

  /**
   * Check if ready to play a specific paragraph
   */
  isReadyToPlay(paragraphIndex: number): boolean {
    return this.cacheManager.isAudioReady(paragraphIndex) && !this.operationLock;
  }
}