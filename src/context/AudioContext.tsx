import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { AudioPlayerManager, AudioPlayerState } from '../services/AudioPlayerManager';
import { AudioCacheManager } from '../services/AudioCacheManager';
import { Chapter, Novel } from '../types';
import { chapterAPI } from '../services/api';

interface AudioContextType {
  // State
  isPlaying: boolean;
  isLoading: boolean;
  isChapterLoading: boolean;
  currentParagraphIndex: number | null;
  currentChapter: Chapter | null;
  currentNovel: Novel | null;
  content: string[];
  playbackSpeed: number;
  narratorVoice: string;
  dialogueVoice: string;
  audioPlayerState: AudioPlayerState;
  
  // Actions
  loadChapter: (novel: Novel, chapter: Chapter, initialContent?: string[]) => Promise<void>;
  playParagraph: (index: number) => Promise<void>;
  togglePlayback: () => Promise<void>;
  playNextParagraph: () => Promise<void>;
  playPreviousParagraph: () => Promise<void>;
  setPlaybackSpeed: (speed: number) => Promise<void>;
  setVoices: (narrator: string, dialogue: string) => void;
  closePlayer: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

interface AudioProviderProps {
  children: ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  // State
  const [currentNovel, setCurrentNovel] = useState<Novel | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [content, setContent] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isChapterLoading, setIsChapterLoading] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1.0);
  const [narratorVoice, setNarratorVoice] = useState("en-US-AvaMultilingualNeural");
  const [dialogueVoice, setDialogueVoice] = useState("en-US-RyanNeural");
  const [audioPlayerState, setAudioPlayerState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentIndex: null,
    isLoading: false,
    duration: 0,
    position: 0,
    playbackSpeed: 1.0,
    pitchCorrectionEnabled: false,
    platform: 'ios',
  });

  // Refs
  const audioCacheManager = useRef<AudioCacheManager | null>(null);
  const audioPlayerManager = useRef<AudioPlayerManager | null>(null);
  const isTransitioning = useRef(false);
  const loadingChapterId = useRef<string | null>(null);
  const stateRef = useRef({ currentChapter, content, currentNovel });

  // Update stateRef whenever relevant state changes
  useEffect(() => {
    stateRef.current = { currentChapter, content, currentNovel };
  }, [currentChapter, content, currentNovel]);

  // Initialize Audio System
  useEffect(() => {
    const init = async () => {
      console.log('🎵 Initializing Global Audio System');
      
      audioCacheManager.current = new AudioCacheManager(
        narratorVoice,
        dialogueVoice,
        {
          maxCacheSize: 20,
          preloadCharacterThreshold: 1000,
          maxPreloadDistance: 8,
          cacheExpiryMs: 30 * 60 * 1000,
        }
      );

      audioPlayerManager.current = new AudioPlayerManager(audioCacheManager.current);

      audioPlayerManager.current.configureAutoAdvance({
        enabled: true,
        delayMs: 0,
      });

      // Set up callbacks
      setupCallbacks();
    };

    init();

    return () => {
      if (audioPlayerManager.current) {
        audioPlayerManager.current.cleanup();
      }
    };
  }, []);

  // Update voices
  useEffect(() => {
    if (audioCacheManager.current) {
      audioCacheManager.current.updateVoices(narratorVoice, dialogueVoice);
    }
  }, [narratorVoice, dialogueVoice]);

  const playParagraph = useCallback(async (index: number) => {
    if (!audioPlayerManager.current || !content[index]) return;

    // Optimistic update
    isTransitioning.current = true;
    setIsPlaying(true);
    setCurrentParagraphIndex(index);
    setAudioPlayerState(prev => ({ ...prev, isPlaying: true, currentIndex: index, isLoading: true }));

    try {
      const success = await audioPlayerManager.current.playParagraph(
        index,
        content[index],
        content
      );
      if (!success) isTransitioning.current = false;
    } catch (error) {
      console.error('Error playing paragraph:', error);
      isTransitioning.current = false;
    }
  }, [content]);

  const setupCallbacks = () => {
    if (!audioPlayerManager.current) return;

    audioPlayerManager.current.setCallbacks({
      onStateChange: (state) => {
        setAudioPlayerState(state);
        setCurrentParagraphIndex(state.currentIndex);

        // State masking logic for flicker prevention
        if (state.isPlaying) {
          isTransitioning.current = false;
          setIsPlaying(true);
        } else if (!isTransitioning.current) {
          setIsPlaying(false);
        }
      },
      onAutoAdvance: async (fromIndex, toIndex) => {
        // We need to access the current content ref or state here. 
        // Since content is in state, we can use it directly if we ensure this callback 
        // has access to the latest closure, or we use a ref for content.
        
        // Check if we've reached the end of the chapter
        if (toIndex >= stateRef.current.content.length) {
          console.log('🏁 End of chapter reached, loading next chapter...');
          await loadNextChapter();
          return;
        }
        
        // Otherwise, this initial callback might be stale for content, 
        // but the useEffect below handles the active playback updates.
      },
      onError: (error) => {
        console.error('Global Audio Error:', error);
      }
    });
  };

  // Update callbacks when content changes
  useEffect(() => {
    if (audioPlayerManager.current && content.length > 0) {
      audioPlayerManager.current.setCallbacks({
        onStateChange: (state) => {
          setAudioPlayerState(state);
          setCurrentParagraphIndex(state.currentIndex);

          if (state.isPlaying) {
            isTransitioning.current = false;
            setIsPlaying(true);
          } else if (!isTransitioning.current) {
            setIsPlaying(false);
          }
        },
        onAutoAdvance: async (fromIndex, toIndex) => {
          if (toIndex < content.length && audioPlayerManager.current) {
            try {
              isTransitioning.current = true;
              const success = await audioPlayerManager.current.playParagraph(
                toIndex,
                content[toIndex],
                content
              );
              if (!success) isTransitioning.current = false;
            } catch (error) {
              console.error('Auto-advance error:', error);
              isTransitioning.current = false;
              // Fallback
              playParagraph(toIndex);
            }
          } else if (toIndex >= content.length) {
            console.log('🏁 End of chapter reached (active), loading next chapter...');
            await loadNextChapter();
          }
        },
        onError: (error) => {
          console.error('Global Audio Error:', error);
        }
      });
    }
  }, [content]);

  const loadChapter = useCallback(async (novel: Novel, chapter: Chapter, initialContent?: string[]) => {
    try {
      // Prevent duplicate loads for the same chapter
      const chapterUniqueId = `${novel.title}-${chapter.chapterNumber}`;
      
      if (loadingChapterId.current === chapterUniqueId) {
        console.log('⚠️ Already loading chapter:', chapterUniqueId);
        return;
      }

      // Check against current state in ref to avoid dependency cycle
      // Added check for novel title to prevent stale content when switching novels
      const { currentChapter: refCurrentChapter, content: refContent, currentNovel: refCurrentNovel } = stateRef.current;
      if (refCurrentChapter?.chapterNumber === chapter.chapterNumber && 
          refCurrentNovel?.title === novel.title && 
          refContent.length > 0) {
        console.log('⚠️ Chapter already loaded:', chapterUniqueId);
        return;
      }

      loadingChapterId.current = chapterUniqueId;
      setIsChapterLoading(true);

      // Stop current playback
      if (audioPlayerManager.current) {
        await audioPlayerManager.current.cleanup();
      }
      
      // Reset state
      setIsPlaying(false);
      setCurrentParagraphIndex(null);
      setContent([]);
      setCurrentNovel(novel);
      setCurrentChapter(chapter);

      let newContent: string[] = [];

      if (initialContent && initialContent.length > 0) {
        // Use provided content if available (avoids double fetch)
        console.log('📦 Using provided initial content for chapter:', chapter.chapterNumber);
        newContent = initialContent;
      } else {
        // Fetch content
        console.log('📥 Fetching content for chapter:', chapter.chapterNumber);
        const chapterData = await chapterAPI.getChapterContent(
          chapter.chapterNumber,
          novel.title
        );

        const processedContent = chapterData.content
          .map((text) => text.trim())
          .filter((text) => text.length > 0);

        const titleContent = `Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}`;
        newContent = [titleContent, ...processedContent];
      }
      
      setContent(newContent);

      // Re-configure player if needed (cleanup might have cleared it)
      if (audioPlayerManager.current) {
         audioPlayerManager.current.configureAutoAdvance({
          enabled: true,
          delayMs: 0,
        });
      }

    } catch (error) {
      console.error('Error loading chapter:', error);
    } finally {
      loadingChapterId.current = null;
      setIsChapterLoading(false);
    }
  }, []); // No dependencies needed as we use refs

  const loadNextChapter = useCallback(async () => {
    const { currentChapter, currentNovel } = stateRef.current;
    if (!currentChapter || !currentNovel) return;

    try {
      const nextChapterNumber = currentChapter.chapterNumber + 1;
      console.log('Attempting to load next chapter:', nextChapterNumber);

      // Fetch next chapter content to get the title
      const chapterData = await chapterAPI.getChapterContent(
        nextChapterNumber,
        currentNovel.title
      );

      if (chapterData && chapterData.content) {
        const nextChapter: Chapter = {
          chapterNumber: nextChapterNumber,
          chapterTitle: chapterData.chapterTitle || `Chapter ${nextChapterNumber}`,
          id: `chapter_${nextChapterNumber}`
        };

        // Process content here to pass to loadChapter
        const processedContent = (chapterData.content || [])
          .map((text) => text.trim())
          .filter((text) => text.length > 0);
        
        const titleContent = `Chapter ${nextChapter.chapterNumber}: ${nextChapter.chapterTitle}`;
        const fullContent = [titleContent, ...processedContent];

        await loadChapter(currentNovel, nextChapter, fullContent);
      }
    } catch (error) {
      console.log('End of book or error loading next chapter:', error);
    }
  }, [loadChapter]);

  

  const togglePlayback = useCallback(async () => {
    if (audioPlayerManager.current) {
      await audioPlayerManager.current.togglePlayback();
    }
  }, []);

  const playNextParagraph = useCallback(async () => {
    if (currentParagraphIndex !== null && currentParagraphIndex < content.length - 1) {
      await playParagraph(currentParagraphIndex + 1);
    }
  }, [currentParagraphIndex, content, playParagraph]);

  const playPreviousParagraph = useCallback(async () => {
    if (currentParagraphIndex !== null && currentParagraphIndex > 0) {
      await playParagraph(currentParagraphIndex - 1);
    }
  }, [currentParagraphIndex, playParagraph]);

  const setPlaybackSpeed = useCallback(async (speed: number) => {
    if (audioPlayerManager.current) {
      await audioPlayerManager.current.setPlaybackSpeed(speed);
      setPlaybackSpeedState(speed);
    }
  }, []);

  const setVoices = useCallback((narrator: string, dialogue: string) => {
    setNarratorVoice(narrator);
    setDialogueVoice(dialogue);
  }, []);

  const closePlayer = useCallback(async () => {
    if (audioPlayerManager.current) {
      await audioPlayerManager.current.cleanup();
    }
    setIsPlaying(false);
    setCurrentParagraphIndex(null);
  }, []);

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        isLoading: audioPlayerState.isLoading,
        isChapterLoading,
        currentParagraphIndex,
        currentChapter,
        currentNovel,
        content,
        playbackSpeed,
        narratorVoice,
        dialogueVoice,
        audioPlayerState,
        loadChapter,
        playParagraph,
        togglePlayback,
        playNextParagraph,
        playPreviousParagraph,
        setPlaybackSpeed,
        setVoices,
        closePlayer,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
