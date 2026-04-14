import * as TrackPlayer from 'react-native-track-player/lib/src/trackPlayer';
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
  private cacheManager: AudioCacheManager;
  private currentIndex: number | null = null;
  private isPlaying: boolean = false;
  private isLoading: boolean = false;
  private playbackSpeed: number = 1.0;
  private rateApplied: boolean = false;
  private autoAdvanceConfig: AutoAdvanceConfig = { enabled: true, delayMs: 1 };
  private playerReady: boolean = false;

  // Notification metadata
  private novelName: string = '';
  private chapterTitle: string = '';
  private artworkUrl: string | undefined = undefined;

  // Callbacks
  private onStateChange?: (state: AudioPlayerState) => void;
  private onAutoAdvance?: (fromIndex: number, toIndex: number) => void;
  private onError?: (error: Error) => void;
  private onRemoteNext?: () => void;
  private onRemotePrevious?: () => void;

  // Prevent multiple simultaneous operations
  private operationLock: boolean = false;
  private completionHandled: boolean = false;

  // When true, ignore Paused/Stopped events from PlaybackState.
  // load() fires Stopped for the old track asynchronously — if we don't suppress it,
  // the stale event resets isPlaying=false AFTER loadAndPlay() already set it to true.
  // Cleared only when State.Playing confirms the new track is actually playing.
  private suppressPauseEvents: boolean = false;

  // Event subscriptions
  private eventSubscriptions: Array<{ remove: () => void }> = [];

  // Cached state object — reuse to avoid GC pressure
  private cachedState: AudioPlayerState = {
    isPlaying: false,
    currentIndex: null,
    isLoading: false,
    duration: 0,
    position: 0,
    playbackSpeed: 1.0,
    pitchCorrectionEnabled: true,
    platform: Platform.OS,
  };

  constructor(cacheManager: AudioCacheManager) {
    this.cacheManager = cacheManager;
    this.initializePlayer();
  }

  private async initializePlayer(): Promise<void> {
    try {
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
      });

      // RNTP Capability enum reads from native module constants at import time,
      // which are null under New Architecture. Use the raw numeric values directly.
      // Values from RNTP v4 source: Play=0, Pause=3, SkipToNext=7, SkipToPrevious=8
      await TrackPlayer.updateOptions({
        capabilities: [0, 3, 7, 8],
        compactCapabilities: [0, 3, 7, 8],
        android: {
          appKilledPlaybackBehavior: 'pause-playback' as any,
        },
        progressUpdateEventInterval: 0,
      });

      this.setupEventListeners();
      this.playerReady = true;
      console.log(`🎵 TrackPlayer initialized for platform: ${Platform.OS}`);
    } catch (error: any) {
      if (error?.message?.includes('already been initialized')) {
        this.setupEventListeners();
        this.playerReady = true;
      } else {
        console.error('Failed to initialize TrackPlayer:', error);
      }
    }
  }

  private setupEventListeners(): void {
    this.removeEventListeners();

    // String event/state names to avoid importing enums that crash under New Arch.
    // Values from RNTP v4: Event strings are the enum's string values, State uses string IDs.
    this.eventSubscriptions.push(
      TrackPlayer.addEventListener('playback-state' as any, (event: any) => {
        const state = event.state;

        if (state === 'playing') {
          this.suppressPauseEvents = false;
          if (!this.isPlaying) {
            this.isPlaying = true;
            this.emitStateChange();
          }
        } else if (state === 'paused' || state === 'stopped') {
          if (this.suppressPauseEvents) return;
          if (this.isPlaying) {
            this.isPlaying = false;
            this.emitStateChange();
          }
        }
      })
    );

    this.eventSubscriptions.push(
      TrackPlayer.addEventListener('playback-queue-ended' as any, () => {
        if (this.currentIndex !== null && !this.completionHandled) {
          this.handleAudioCompletion(this.currentIndex);
        }
      })
    );

    this.eventSubscriptions.push(
      TrackPlayer.addEventListener('remote-next' as any, () => {
        this.onRemoteNext?.();
      })
    );

    this.eventSubscriptions.push(
      TrackPlayer.addEventListener('remote-previous' as any, () => {
        this.onRemotePrevious?.();
      })
    );

    this.eventSubscriptions.push(
      TrackPlayer.addEventListener('playback-error' as any, (event: any) => {
        console.error('TrackPlayer error:', event);
        this.onError?.(new Error(`Playback error: ${event.message}`));
      })
    );
  }

  private removeEventListeners(): void {
    for (const sub of this.eventSubscriptions) {
      sub.remove();
    }
    this.eventSubscriptions = [];
  }

  setMetadata(novelName: string, chapterTitle: string, artworkUrl?: string): void {
    this.novelName = novelName;
    this.chapterTitle = chapterTitle;
    this.artworkUrl = artworkUrl;
  }

  async playParagraph(
    paragraphIndex: number,
    paragraphText: string,
    allParagraphs: string[]
  ): Promise<boolean> {
    if (this.operationLock) {
      return false;
    }

    if (!this.playerReady) {
      return false;
    }

    this.operationLock = true;

    try {
      // Set loading state
      this.isLoading = true;
      this.currentIndex = paragraphIndex;
      this.emitStateChange();

      // Get audio from cache manager
      const audioData = await this.cacheManager.getAudio(
        paragraphIndex,
        paragraphText,
        allParagraphs
      );

      if (!audioData?.audio_received || !audioData?.audio_uri) {
        throw new Error(`No audio available for paragraph ${paragraphIndex}`);
      }

      // Load and play via TrackPlayer — single load() call replaces current track
      await this.loadAndPlay(audioData, paragraphText);
      return true;

    } catch (error) {
      console.error(`❌ Failed to play paragraph ${paragraphIndex}:`, error);
      this.onError?.(error as Error);
      return false;
    } finally {
      this.isLoading = false;
      this.operationLock = false;
      this.emitStateChange();
    }
  }

  private async loadAndPlay(audioData: ParagraphAudioData, paragraphText: string): Promise<void> {
    this.completionHandled = false;

    // Suppress stale Stopped/Paused events from the old track being replaced.
    // Cleared when State.Playing fires for the new track.
    this.suppressPauseEvents = true;

    // Truncate paragraph for the subtitle line
    const paragraphPreview = paragraphText.length > 120
      ? paragraphText.substring(0, 120) + '...'
      : paragraphText;

    const track: any = {
      url: audioData.audio_uri!,
      title: this.chapterTitle || `Paragraph ${audioData.paragraph_index + 1}`,
      artist: paragraphPreview,
      album: this.novelName || 'Audiobook Reader',
    };

    if (this.artworkUrl) {
      track.artwork = this.artworkUrl;
    }

    // Use load() — single native call that replaces the current track
    await TrackPlayer.load(track);

    // Only set rate if it hasn't been applied yet or changed
    if (!this.rateApplied) {
      await TrackPlayer.setRate(this.playbackSpeed);
      this.rateApplied = true;
    }

    await TrackPlayer.play();

    this.currentIndex = audioData.paragraph_index;
    this.isPlaying = true;
    this.emitStateChange();

    // Update cache manager in background
    this.cacheManager.setCurrentlyPlaying(audioData.paragraph_index);
  }

  private handleAudioCompletion(paragraphIndex: number): void {
    if (this.completionHandled) return;

    this.completionHandled = true;

    if (this.autoAdvanceConfig.enabled) {
      // Suppress pause events — auto-advance will call playParagraph which calls
      // loadAndPlay which also sets suppressPauseEvents, but we need it set NOW
      // before the async Stopped event from the finished track arrives.
      this.suppressPauseEvents = true;
      const nextIndex = paragraphIndex + 1;
      this.onAutoAdvance?.(paragraphIndex, nextIndex);
    } else {
      this.isPlaying = false;
      this.emitStateChange();
    }
  }

  async togglePlayback(): Promise<boolean> {
    if (!this.playerReady || this.operationLock) return false;

    try {
      if (this.isPlaying) {
        await TrackPlayer.pause();
        this.isPlaying = false;
      } else {
        await TrackPlayer.play();
        this.isPlaying = true;
      }

      this.emitStateChange();
      return true;
    } catch (error) {
      console.error('Error toggling playback:', error);
      this.onError?.(error as Error);
      return false;
    }
  }

  async setPlaybackSpeed(speed: number): Promise<void> {
    const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));
    this.playbackSpeed = clampedSpeed;
    this.cacheManager.setPlaybackSpeed(clampedSpeed);

    if (this.playerReady) {
      try {
        await TrackPlayer.setRate(clampedSpeed);
        this.rateApplied = true;
        this.emitStateChange();
      } catch (error) {
        console.error('Error setting playback speed:', error);
      }
    }
  }

  private emitStateChange(): void {
    // Mutate cached object in-place — avoids creating new objects on every emit
    this.cachedState.isPlaying = this.isPlaying;
    this.cachedState.currentIndex = this.currentIndex;
    this.cachedState.isLoading = this.isLoading;
    this.cachedState.playbackSpeed = this.playbackSpeed;

    this.onStateChange?.(this.cachedState);
  }

  configureAutoAdvance(config: AutoAdvanceConfig): void {
    this.autoAdvanceConfig = config;
  }

  setCallbacks(callbacks: {
    onStateChange?: (state: AudioPlayerState) => void;
    onAutoAdvance?: (fromIndex: number, toIndex: number) => void;
    onError?: (error: Error) => void;
    onRemoteNext?: () => void;
    onRemotePrevious?: () => void;
  }): void {
    this.onStateChange = callbacks.onStateChange;
    this.onAutoAdvance = callbacks.onAutoAdvance;
    this.onError = callbacks.onError;
    this.onRemoteNext = callbacks.onRemoteNext;
    this.onRemotePrevious = callbacks.onRemotePrevious;
  }

  getCurrentState(): AudioPlayerState {
    return this.cachedState;
  }

  async cleanup(): Promise<void> {
    if (this.playerReady) {
      try {
        await TrackPlayer.reset();
      } catch (error) {
        console.warn('Error during player cleanup:', error);
      }
    }

    this.currentIndex = null;
    this.isPlaying = false;
    this.isLoading = false;
    this.operationLock = false;
    this.rateApplied = false;
    this.suppressPauseEvents = false;
    this.emitStateChange();
  }

  async destroy(): Promise<void> {
    this.removeEventListeners();
    await this.cleanup();
  }

  isReadyToPlay(paragraphIndex: number): boolean {
    return this.cacheManager.isAudioReady(paragraphIndex) && !this.operationLock;
  }
}
