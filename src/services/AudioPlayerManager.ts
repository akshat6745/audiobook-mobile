import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { AudioCacheManager, ParagraphAudioData } from './AudioCacheManager';

export interface AudioPlayerState {
  isPlaying: boolean;
  currentIndex: number | null;
  isLoading: boolean;
  duration: number;
  position: number;
  playbackSpeed: number;
  pitchCorrectionEnabled: boolean;
  platform: string;
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
  private autoAdvanceConfig: AutoAdvanceConfig = { enabled: true, delayMs: 10 }; // Ultra-fast transition

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
      // Platform-specific audio configuration for optimal pitch correction
      const audioModeConfig: any = {
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      };

      // Enhanced settings for better pitch correction on different platforms
      if (Platform.OS === 'ios') {
        audioModeConfig.interruptionModeIOS = 'DoNotMix';
        audioModeConfig.playsInSilentModeIOS = true;
      } else if (Platform.OS === 'android') {
        audioModeConfig.shouldDuckAndroid = true;
        audioModeConfig.interruptionModeAndroid = 'DoNotMix';
      } else if (Platform.OS === 'web') {
        // Web-specific optimizations will be handled in sound creation
        console.log('🌐 Web platform detected - using enhanced audio settings');
      }

      await Audio.setAudioModeAsync(audioModeConfig);
      console.log(`🎵 Audio mode initialized for platform: ${Platform.OS}`);
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
    console.log(`🔊 Creating sound for paragraph ${audioData.paragraph_index} on ${Platform.OS}`);

    // Reset completion handler for new audio
    this.completionHandled = false;

    // Platform-specific audio configuration for optimal pitch correction
    const soundConfig: any = {
      shouldPlay: true,
      rate: this.playbackSpeed,
      shouldCorrectPitch: true,
    };

    // Enhanced pitch correction settings per platform
    if (Platform.OS === 'ios') {
      // iOS-specific optimizations for pitch correction
      soundConfig.shouldCorrectPitch = true;
      soundConfig.pitchCorrectionQuality = 'High';
      console.log('🍎 Using iOS optimized pitch correction');
    } else if (Platform.OS === 'android') {
      // Android-specific optimizations
      soundConfig.shouldCorrectPitch = true;
      soundConfig.androidAudioFocusMode = 'DoNotMix';
      console.log('🤖 Using Android optimized pitch correction');
    } else if (Platform.OS === 'web') {
      // Web platform optimizations
      soundConfig.shouldCorrectPitch = true;
      soundConfig.preservesPitch = true; // Web Audio API specific
      console.log('🌐 Using Web optimized pitch correction');
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: audioData.audio_uri! },
      soundConfig,
      this.createStatusCallback(audioData.paragraph_index)
    );

    // Set properties immediately for instant UI update
    this.sound = sound;
    this.currentIndex = audioData.paragraph_index;
    this.isPlaying = true;

    // Emit state change immediately for instant UI feedback
    this.emitStateChange();

    // Update cache manager in background (non-blocking)
    setTimeout(() => {
      this.cacheManager.setCurrentlyPlaying(audioData.paragraph_index);
    }, 0);
  }

  /**
   * Create status callback for audio playback
   */
  private createStatusCallback(paragraphIndex: number) {
    let earlyPreloadTriggered = false; // Prevent multiple early preload triggers

    return (status: any) => {
      // Only log critical events for maximum performance during transitions
      if (status.didJustFinish || (!status.isPlaying && status.positionMillis > 0)) {
        console.log(`📊 Critical event for paragraph ${paragraphIndex}:`, {
          isPlaying: status.isPlaying,
          didJustFinish: status.didJustFinish,
          position: Math.round(status.positionMillis || 0),
          duration: Math.round(status.durationMillis || 0),
        });
      }

      // Update playing state
      this.isPlaying = status.isPlaying || false;

      // Ultra-early preload trigger at 70% completion for instant transitions
      if (!earlyPreloadTriggered &&
          status.positionMillis &&
          status.durationMillis &&
          status.positionMillis / status.durationMillis >= 0.7) {
        earlyPreloadTriggered = true;
        const nextIndex = paragraphIndex + 1;
        if (!this.cacheManager.isAudioReady(nextIndex)) {
          console.log(`⚡ Ultra-early preload trigger at 70% for instant transition to paragraph ${nextIndex}`);
          // This will be handled by existing preload logic
        }
      }

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
           status.positionMillis >= status.durationMillis - 30; // Ultra-aggressive threshold for instant transitions

    // Only log completion events to reduce overhead during transitions
    if (isComplete && status.positionMillis && status.durationMillis) {
      console.log(`🎯 Completion detected: ${Math.round((status.positionMillis / status.durationMillis) * 100)}%`);
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
      const nextIndex = paragraphIndex + 1;
      const isNextReady = this.cacheManager.isAudioReady(nextIndex);

      console.log(`⏭️ Auto-advancing from paragraph ${paragraphIndex} to ${nextIndex}`, {
        nextParagraphReady: isNextReady
      });

      if (isNextReady) {
        // Next paragraph is ready, advance INSTANTLY with zero delay
        console.log(`🎯 Executing INSTANT auto-advance: ${paragraphIndex} -> ${nextIndex}`);
        this.onAutoAdvance?.(paragraphIndex, nextIndex);
      } else {
        // Next paragraph not ready, use minimal delay
        setTimeout(() => {
          console.log(`🎯 Executing minimal-delay auto-advance: ${paragraphIndex} -> ${nextIndex}`);
          this.onAutoAdvance?.(paragraphIndex, nextIndex);
        }, this.autoAdvanceConfig.delayMs);
      }
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
   * Set playback speed with cross-platform pitch correction
   */
  async setPlaybackSpeed(speed: number): Promise<void> {
    // Validate speed range for all platforms
    const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));
    if (clampedSpeed !== speed) {
      console.warn(`⚠️ Speed ${speed} clamped to ${clampedSpeed} for platform compatibility`);
    }

    this.playbackSpeed = clampedSpeed;

    if (this.sound && !this.operationLock) {
      try {
        // Platform-specific pitch correction implementation
        if (Platform.OS === 'ios') {
          // iOS: Use setRateAsync with pitch correction
          await this.sound.setRateAsync(clampedSpeed, true);
          console.log(`🍎 iOS playback speed set to ${clampedSpeed}x with pitch correction`);
        } else if (Platform.OS === 'android') {
          // Android: Use setRateAsync with enhanced pitch correction
          await this.sound.setRateAsync(clampedSpeed, true);
          console.log(`🤖 Android playback speed set to ${clampedSpeed}x with pitch correction`);
        } else if (Platform.OS === 'web') {
          // Web: Use preservesPitch for Web Audio API
          await this.sound.setRateAsync(clampedSpeed, true);
          console.log(`🌐 Web playback speed set to ${clampedSpeed}x with pitch preservation`);
        } else {
          // Fallback for other platforms
          await this.sound.setRateAsync(clampedSpeed, true);
          console.log(`🔧 Generic playback speed set to ${clampedSpeed}x with pitch correction`);
        }

        // Emit state change to update UI
        this.emitStateChange();
      } catch (error) {
        console.error(`❌ Error setting playback speed on ${Platform.OS}:`, error);

        // Fallback: Try without platform-specific settings
        try {
          await this.sound.setRateAsync(clampedSpeed, true);
          console.log(`🔄 Fallback: Speed set to ${clampedSpeed}x`);
        } catch (fallbackError) {
          console.error('❌ Fallback speed setting also failed:', fallbackError);
        }
      }
    } else {
      console.log(`⏳ Speed ${clampedSpeed}x queued (sound not ready or operation locked)`);
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
      pitchCorrectionEnabled: true, // Always enabled in our implementation
      platform: Platform.OS,
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
      pitchCorrectionEnabled: true,
      platform: Platform.OS,
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