import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { chapterAPI, userAPI } from '../services/api';
import { Chapter, Novel, RootStackParamList, ChapterContent } from '../types';
import { useAuth } from '../context/AuthContext';
import { AudioCacheManager } from '../services/AudioCacheManager';
import { AudioPlayerManager, AudioPlayerState } from '../services/AudioPlayerManager';

type ReaderScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Reader'>;
type ReaderScreenRouteProp = RouteProp<RootStackParamList, 'Reader'>;

interface Props {
  navigation: ReaderScreenNavigationProp;
  route: ReaderScreenRouteProp;
}

const ReaderScreen: React.FC<Props> = ({ navigation, route }) => {
  const { novel, chapter } = route.params;
  const [content, setContent] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [textColor, setTextColor] = useState('#fff');
  const [showSettings, setShowSettings] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showNarratorModal, setShowNarratorModal] = useState(false);
  const [showDialogueModal, setShowDialogueModal] = useState(false);
  const [narratorVoice, setNarratorVoice] = useState("en-US-ChristopherNeural");
  const [dialogueVoice, setDialogueVoice] = useState("en-US-AvaMultilingualNeural");
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

  const scrollViewRef = useRef<ScrollView>(null);
  const paragraphRefs = useRef<{ [key: number]: View | null }>({});
  const audioCacheManager = useRef<AudioCacheManager | null>(null);
  const audioPlayerManager = useRef<AudioPlayerManager | null>(null);
  const { user } = useAuth();

  // Auto-scroll functionality
  const scrollToActiveParagraph = useCallback((paragraphIndex: number) => {
    if (scrollViewRef.current && paragraphRefs.current[paragraphIndex]) {
      paragraphRefs.current[paragraphIndex]?.measureLayout(
        scrollViewRef.current as any,
        (x, y, width, height) => {
          const scrollPosition = Math.max(0, y - 100); // Offset for better visibility
          scrollViewRef.current?.scrollTo({
            y: scrollPosition,
            animated: true,
          });
          console.log(`📍 Auto-scrolled to paragraph ${paragraphIndex} at position ${scrollPosition}`);
        },
        () => console.warn(`⚠️ Could not measure paragraph ${paragraphIndex} for auto-scroll`)
      );
    }
  }, []);

  // Auto-scroll when active paragraph changes
  useEffect(() => {
    if (activeParagraphIndex !== null) {
      scrollToActiveParagraph(activeParagraphIndex);
    }
  }, [activeParagraphIndex, scrollToActiveParagraph]);

  // Audio system handled by AudioCacheManager and AudioPlayerManager

  // Voice options - Updated comprehensive list
  const VOICE_OPTIONS = [
    { label: "Ava (Female, US)", value: "en-US-AvaMultilingualNeural" },
    { label: "Christopher (Male, US)", value: "en-US-ChristopherNeural" },
    { label: "Jenny (Female, US)", value: "en-US-JennyNeural" },
    { label: "Sonia (Female, UK)", value: "en-GB-SoniaNeural" },
    { label: "Ryan (Male, UK)", value: "en-GB-RyanNeural" },
    { label: "Andrew (Male, US, Multilingual)", value: "en-US-AndrewMultilingualNeural" },
    { label: "Emma (Female, US, Multilingual)", value: "en-US-EmmaMultilingualNeural" },
  ];

  const narratorVoices = VOICE_OPTIONS;
  const dialogueVoices = VOICE_OPTIONS;

  useEffect(() => {
    loadChapterContent();
    saveProgress();
    initializeAudioSystem();

    return () => {
      cleanupAudioSystem();
    };
  }, [chapter]);

  // Re-initialize audio system when voices change
  useEffect(() => {
    if (audioCacheManager.current && audioPlayerManager.current) {
      audioCacheManager.current.updateVoices(narratorVoice, dialogueVoice);
    }
  }, [narratorVoice, dialogueVoice]);

  // Handle paragraph press - Moved up to avoid use-before-declaration in useEffect
  const handleParagraphPress = async (index: number) => {
    console.log('🎯 handleParagraphPress called for index:', index);

    if (!audioPlayerManager.current || !content[index]) {
      console.warn('Audio system not ready or invalid index');
      return;
    }

    try {
      const success = await audioPlayerManager.current.playParagraph(
        index,
        content[index],
        content
      );

      if (success) {
        console.log(`✅ Successfully started playing paragraph ${index}`);
      } else {
        console.warn(`⚠️ Failed to start playing paragraph ${index}`);
      }
    } catch (error) {
      console.error(`❌ Error playing paragraph ${index}:`, error);
      Alert.alert('Audio Error', `Failed to play paragraph: ${(error as Error).message}`);
    }
  };

  // Update callbacks when content changes to avoid stale closures
  useEffect(() => {
    if (audioPlayerManager.current && content.length > 0) {
      console.log(`🔄 Setting callbacks with content length: ${content.length}`);

      audioPlayerManager.current.setCallbacks({
        onStateChange: (state) => {
          console.log('🔄 Audio state changed:', state);
          setAudioPlayerState(state);
          setActiveParagraphIndex(state.currentIndex);
          setIsPlaying(state.isPlaying);

          if (state.currentIndex !== null) {
            setShowMiniPlayer(true);
            // Auto-scroll to current paragraph
            scrollToActiveParagraph(state.currentIndex);
          }
        },
        onAutoAdvance: async (fromIndex, toIndex) => {
          console.log(`⏭️ Auto-advancing from ${fromIndex} to ${toIndex}`);

          console.log(`📋 Current content length: ${content.length}, toIndex: ${toIndex}`);

          if (toIndex < content.length && audioPlayerManager.current && content[toIndex]) {
            try {
              console.log(`🚀 Executing auto-advance playParagraph with content: "${content[toIndex].substring(0, 50)}..."`);
              const success = await audioPlayerManager.current.playParagraph(
                toIndex,
                content[toIndex],
                content
              );
              console.log(`🎯 Auto-advance playParagraph result: ${success}`);
            } catch (error) {
              console.error(`❌ Error in auto-advance:`, error);
              // Fallback to regular paragraph press
              console.log(`🔄 Fallback to handleParagraphPress`);
              handleParagraphPress(toIndex);
            }
          } else {
            console.warn(`⚠️ Auto-advance failed:`, {
              toIndex,
              contentLength: content.length,
              hasManager: !!audioPlayerManager.current,
              hasContent: !!content[toIndex]
            });
          }
        },
        onError: (error) => {
          console.error('🚨 Audio player error:', error);
          Alert.alert('Audio Error', error.message);
        },
      });
    }
  }, [content, handleParagraphPress]);

  const initializeAudioSystem = async () => {
    console.log('🎵 Initializing new audio system');

    // Create audio cache manager
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

    // Create audio player manager
    audioPlayerManager.current = new AudioPlayerManager(audioCacheManager.current);

    // Note: Callbacks will be set in useEffect when content is loaded

    // Configure auto-advance
    audioPlayerManager.current.configureAutoAdvance({
      enabled: true,
      delayMs: 500,
    });

    console.log('✅ Audio system initialized');
  };

  const cleanupAudioSystem = async () => {
    console.log('🧹 Cleaning up audio system');

    if (audioPlayerManager.current) {
      await audioPlayerManager.current.cleanup();
    }

    if (audioCacheManager.current) {
      audioCacheManager.current.clearCache();
    }

    audioPlayerManager.current = null;
    audioCacheManager.current = null;
  };

  const loadChapterContent = async () => {
    try {
      setIsLoading(true);
      const chapterData = await chapterAPI.getChapterContent(
        chapter.chapterNumber,
        novel.title
      );
      // Filter out empty paragraphs and process content
      const processedContent = chapterData.content
        .map((text) => text.trim())
        .filter((text) => text.length > 0);

      // Add chapter title as the first paragraph
      const titleContent = `Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}`;
      setContent([titleContent, ...processedContent]);
    } catch (error) {
      console.error('Error loading chapter content:', error);

      // Load demo content if backend is not available
      const demoContent = [
        `Chapter ${chapter.chapterNumber}: ${chapter.chapterTitle}`, // Add title to demo content
        "Welcome to the AudioBook Reader demo application!",
        "This is a demonstration chapter that shows how the reading interface works. In a real application, this content would come from your AudioBookPython backend server.",
        "The reader supports multiple features:",
        "• Adjustable font size for comfortable reading",
        "• Dark and light theme toggle",
        "• Automatic progress saving",
        "• Audio playback with text-to-speech",
        "• Cross-platform support (iOS, Android, Web)",
        "• Clickable paragraphs for enhanced interaction",
        "To use this app with real content, make sure your AudioBookPython backend is running and accessible.",
        "The app will automatically detect when the backend is available and switch from demo mode to live mode.",
        "Enjoy exploring the features of this audiobook reader! You can navigate using the toolbar at the bottom, switch to audio mode, or adjust reading settings.",
        "This paragraph demonstrates how longer content is displayed in the reader. The text is automatically formatted for comfortable reading with proper line spacing and justification.",
        "Try tapping on any paragraph to see the click interaction - this feature can be used for audio playback control.",
        "Thank you for trying out the AudioBook Reader mobile application!"
      ];

      setContent(demoContent);

      Alert.alert(
        'Demo Content',
        'Loading demo chapter content. Backend not available - using demo mode.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgress = async () => {
    if (!user) return;

    try {
      await userAPI.saveProgress(user, novel.title, chapter.chapterNumber);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const adjustFontSize = (increment: number) => {
    const newSize = Math.max(12, Math.min(24, fontSize + increment));
    setFontSize(newSize);
  };

  const toggleTheme = () => {
    if (backgroundColor === '#1a1a1a') {
      setBackgroundColor('#fff');
      setTextColor('#333');
    } else {
      setBackgroundColor('#1a1a1a');
      setTextColor('#fff');
    }
  };

  const navigateToAudioPlayer = () => {
    navigation.navigate('AudioPlayer', { novel, chapter });
  };



  // Old loadParagraphAudio function removed - using new AudioPlayerManager

  // Old preloading functions removed - using new AudioCacheManager

  const togglePlayback = async () => {
    if (audioPlayerManager.current) {
      const success = await audioPlayerManager.current.togglePlayback();
      if (!success) {
        console.warn('Failed to toggle playback');
      }
    }
  };

  const goToPreviousParagraph = async () => {
    const currentIndex = audioPlayerState.currentIndex;

    if (currentIndex !== null && currentIndex > 0) {
      const newIndex = currentIndex - 1;
      console.log('⬅️ goToPreviousParagraph: Moving to index', newIndex);
      await handleParagraphPress(newIndex);
    }
  };

  const goToNextParagraph = async () => {
    const currentIndex = audioPlayerState.currentIndex;

    if (currentIndex !== null && currentIndex < content.length - 1) {
      const newIndex = currentIndex + 1;
      console.log('➡️ goToNextParagraph: Moving to index', newIndex);
      await handleParagraphPress(newIndex);
    } else {
      console.log('goToNextParagraph: Cannot advance - currentIndex:', currentIndex, 'contentLength:', content.length);
    }
  };

  const closeMiniPlayer = async () => {
    setShowMiniPlayer(false);
    setIsPlaying(false);
    setActiveParagraphIndex(null);

    // Clean up audio player
    if (audioPlayerManager.current) {
      await audioPlayerManager.current.cleanup();
    }
  };

  const openNarratorVoiceModal = () => {
    setShowNarratorModal(true);
  };

  const openDialogueVoiceModal = () => {
    setShowDialogueModal(true);
  };

  const selectNarratorVoice = async (voiceValue: string) => {
    setNarratorVoice(voiceValue);
    setShowNarratorModal(false);

    // Update cache manager with new voice
    if (audioCacheManager.current) {
      audioCacheManager.current.updateVoices(voiceValue, dialogueVoice);
    }

    // Replay current paragraph with new voice
    if (audioPlayerState.currentIndex !== null) {
      await handleParagraphPress(audioPlayerState.currentIndex);
    }
  };

  const selectDialogueVoice = async (voiceValue: string) => {
    setDialogueVoice(voiceValue);
    setShowDialogueModal(false);

    // Update cache manager with new voice
    if (audioCacheManager.current) {
      audioCacheManager.current.updateVoices(narratorVoice, voiceValue);
    }

    // Replay current paragraph with new voice
    if (audioPlayerState.currentIndex !== null) {
      await handleParagraphPress(audioPlayerState.currentIndex);
    }
  };

  const renderParagraph = (paragraph: string, index: number) => {
    const isActive = audioPlayerState.currentIndex === index;
    const isLoading = audioPlayerState.isLoading && audioPlayerState.currentIndex === index;

    return (
      <View
        key={index}
        ref={(ref) => {
          paragraphRefs.current[index] = ref;
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            console.log('Paragraph pressed! Index:', index);
            handleParagraphPress(index);
          }}
          style={[
            styles.paragraphContainer,
            {
              backgroundColor: isActive
                ? (backgroundColor === '#fff' ? 'rgba(100, 181, 246, 0.15)' : 'rgba(100, 181, 246, 0.2)')
                : (backgroundColor === '#fff' ? '#ffffff' : '#252525'), // Lighter/Darker background for contrast
              borderLeftColor: isActive ? '#64b5f6' : 'transparent',
              borderLeftWidth: isActive ? 4 : 0,
              borderColor: isActive 
                ? '#64b5f6' 
                : (backgroundColor === '#fff' ? '#e0e0e0' : '#3A3A3A'), // More visible border
              shadowColor: isActive ? '#64b5f6' : '#000',
              shadowOffset: { width: 0, height: isActive ? 4 : 2 },
              shadowOpacity: isActive ? 0.25 : (backgroundColor === '#fff' ? 0.1 : 0.3),
              shadowRadius: isActive ? 8 : 4,
              elevation: isActive ? 8 : 3,
              transform: [{ scale: isActive ? 1.01 : 1 }],
              marginBottom: index === 0 ? 24 : 16, // Extra margin for title
            }
          ]}
        >
          {/* Audio loading indicator */}
          {isLoading && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color="#64b5f6" />
            </View>
          )}

          {/* Playing icon for active paragraph */}
          {isActive && !isLoading && (
            <View style={styles.playingIndicator}>
              <MaterialIcons
                name={audioPlayerState.isPlaying ? "volume-up" : "pause"}
                size={18}
                color="#64b5f6"
              />
            </View>
          )}

          <Text style={[
            index === 0 ? styles.chapterTitleText : styles.paragraph, // Special style for title
            {
              fontSize: index === 0 ? fontSize * 1.5 : fontSize,
              color: isActive
                ? (backgroundColor === '#fff' ? '#1565c0' : '#90caf9')
                : textColor,
              fontWeight: index === 0 ? '700' : (isActive ? '600' : '400'),
              lineHeight: fontSize * (index === 0 ? 1.3 : 1.6),
              marginTop: isActive ? 4 : 0,
              textAlign: index === 0 ? 'center' : 'justify',
            }
          ]}>
            {paragraph}
          </Text>

          <View style={styles.paragraphFooter}>
            <Text style={[
              styles.paragraphLabel,
              {
                color: isActive ? '#64b5f6' : (backgroundColor === '#fff' ? '#757575' : '#888'),
                fontWeight: isActive ? '600' : '400',
              }
            ]}>
              {isActive && audioPlayerState.isPlaying ? '🎵 Playing' :
               isActive && !audioPlayerState.isPlaying && !isLoading ? '⏸️ Paused' :
               isLoading ? '⏳ Loading...' :
               index === 0 ? 'Chapter Title' : `Paragraph ${index}`}
            </Text>

            {/* Word count for better reading experience */}
            <Text style={[
              styles.wordCount,
              { color: backgroundColor === '#fff' ? '#bdbdbd' : '#666' }
            ]}>
              {paragraph.split(' ').length} words
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSpeedModal = () => {
    const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];

    return (
      <Modal
        visible={showSpeedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpeedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.speedModalContainer, { backgroundColor: backgroundColor }]}>
            <Text style={[styles.speedModalTitle, { color: textColor }]}>
              Playback Speed
            </Text>

            {speedOptions.map((speed) => (
              <TouchableOpacity
                key={speed}
                style={[
                  styles.speedOption,
                  {
                    backgroundColor: playbackSpeed === speed
                      ? '#64b5f6'
                      : 'transparent',
                    borderColor: '#64b5f6',
                  }
                ]}
                onPress={async () => {
                  setPlaybackSpeed(speed);
                  setShowSpeedModal(false);

                  // Update playback speed in audio player
                  if (audioPlayerManager.current) {
                    await audioPlayerManager.current.setPlaybackSpeed(speed);
                  }
                }}
              >
                <Text style={[
                  styles.speedOptionText,
                  {
                    color: playbackSpeed === speed ? '#000' : textColor,
                    fontWeight: playbackSpeed === speed ? 'bold' : 'normal',
                  }
                ]}>
                  {speed}×
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.speedModalClose}
              onPress={() => setShowSpeedModal(false)}
            >
              <Text style={[styles.speedModalCloseText, { color: '#64b5f6' }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderNarratorVoiceModal = () => (
    <Modal
      visible={showNarratorModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowNarratorModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.voiceModalContainer, { backgroundColor: backgroundColor }]}>
          <Text style={[styles.voiceModalTitle, { color: textColor }]}>
            Narrator Voice
          </Text>

          {narratorVoices.map((voice) => (
            <TouchableOpacity
              key={voice.value}
              style={[
                styles.voiceOption,
                {
                  backgroundColor: narratorVoice === voice.value
                    ? '#64b5f6'
                    : 'transparent',
                  borderColor: '#64b5f6',
                }
              ]}
              onPress={() => selectNarratorVoice(voice.value)}
            >
              <Text style={[
                styles.voiceOptionText,
                {
                  color: narratorVoice === voice.value ? '#000' : textColor,
                  fontWeight: narratorVoice === voice.value ? 'bold' : 'normal',
                }
              ]}>
                {voice.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.voiceModalClose}
            onPress={() => setShowNarratorModal(false)}
          >
            <Text style={[styles.voiceModalCloseText, { color: '#64b5f6' }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderDialogueVoiceModal = () => (
    <Modal
      visible={showDialogueModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDialogueModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.voiceModalContainer, { backgroundColor: backgroundColor }]}>
          <Text style={[styles.voiceModalTitle, { color: textColor }]}>
            Dialogue Voice
          </Text>

          {dialogueVoices.map((voice) => (
            <TouchableOpacity
              key={voice.value}
              style={[
                styles.voiceOption,
                {
                  backgroundColor: dialogueVoice === voice.value
                    ? '#64b5f6'
                    : 'transparent',
                  borderColor: '#64b5f6',
                }
              ]}
              onPress={() => selectDialogueVoice(voice.value)}
            >
              <Text style={[
                styles.voiceOptionText,
                {
                  color: dialogueVoice === voice.value ? '#000' : textColor,
                  fontWeight: dialogueVoice === voice.value ? 'bold' : 'normal',
                }
              ]}>
                {voice.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.voiceModalClose}
            onPress={() => setShowDialogueModal(false)}
          >
            <Text style={[styles.voiceModalCloseText, { color: '#64b5f6' }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderMiniPlayer = () => {
    if (!showMiniPlayer || activeParagraphIndex === null) return null;

    return (
      <Animated.View style={styles.miniPlayerContainer}>
        {/* Modern glass morphism effect */}
        <LinearGradient
          colors={['rgba(100, 181, 246, 0.1)', 'rgba(100, 181, 246, 0.05)']}
          style={styles.miniPlayerGradient}
        />
        <View style={styles.miniPlayerContent}>
          <View style={styles.miniPlayerControls}>
            {/* Previous Button */}
            <TouchableOpacity
              style={[
                styles.miniPlayerButton,
                {
                  opacity: activeParagraphIndex > 0 ? 1 : 0.5,
                }
              ]}
              onPress={goToPreviousParagraph}
              disabled={activeParagraphIndex === 0}
            >
              <MaterialIcons name="skip-previous" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Play/Pause Button */}
            <TouchableOpacity
              style={[styles.miniPlayerPlayButton, { backgroundColor: '#64b5f6' }]}
              onPress={togglePlayback}
            >
              <MaterialIcons
                name={isPlaying ? "pause" : "play-arrow"}
                size={24}
                color="#000"
              />
            </TouchableOpacity>

            {/* Next Button */}
            <TouchableOpacity
              style={[
                styles.miniPlayerButton,
                {
                  opacity: activeParagraphIndex < content.length - 1 ? 1 : 0.5,
                }
              ]}
              onPress={goToNextParagraph}
              disabled={activeParagraphIndex === content.length - 1}
            >
              <MaterialIcons name="skip-next" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Voice Selection Buttons */}
            <TouchableOpacity
              style={styles.miniPlayerVoiceButton}
              onPress={openNarratorVoiceModal}
            >
              <MaterialIcons name="person" size={16} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.miniPlayerVoiceButton}
              onPress={openDialogueVoiceModal}
            >
              <MaterialIcons name="chat" size={16} color="#fff" />
            </TouchableOpacity>

            {/* Speed Button */}
            <TouchableOpacity
              style={styles.miniPlayerSpeedButton}
              onPress={() => setShowSpeedModal(true)}
            >
              <Text style={styles.miniPlayerSpeedText}>{playbackSpeed}×</Text>
            </TouchableOpacity>
          </View>

          {/* Loading/Audio Status */}
          {audioPlayerState.isLoading && (
            <View style={styles.audioStatusContainer}>
              <ActivityIndicator size="small" color="#64b5f6" />
              <Text style={[styles.audioStatusText, { color: textColor }]}>
                Generating audio...
              </Text>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity
            style={styles.miniPlayerClose}
            onPress={closeMiniPlayer}
          >
            <MaterialIcons name="close" size={20} color={textColor} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderSettingsPanel = () => (
    <Modal
      visible={showSettings}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSettings(false)}
    >
      <TouchableOpacity
        style={styles.settingsModalOverlay}
        activeOpacity={1}
        onPress={() => setShowSettings(false)}
      >
        <TouchableOpacity
          style={[styles.settingsPanel, { backgroundColor: backgroundColor }]}
          activeOpacity={1}
          onPress={() => {}} // Prevent modal close when tapping inside
        >
          {/* Close Button */}
          <TouchableOpacity
            style={styles.settingsCloseButton}
            onPress={() => setShowSettings(false)}
          >
            <MaterialIcons name="close" size={24} color={textColor} />
          </TouchableOpacity>

          <Text style={[styles.settingsPanelTitle, { color: textColor }]}>
            Reading Settings
          </Text>

          <View style={styles.settingsRow}>
            <Text style={[styles.settingsLabel, { color: textColor }]}>Font Size</Text>
            <View style={styles.fontControls}>
              <TouchableOpacity
                style={styles.fontButton}
                onPress={() => adjustFontSize(-2)}
              >
                <MaterialIcons name="text-decrease" size={20} color={textColor} />
              </TouchableOpacity>
              <Text style={[styles.fontSizeText, { color: textColor }]}>{fontSize}</Text>
              <TouchableOpacity
                style={styles.fontButton}
                onPress={() => adjustFontSize(2)}
              >
                <MaterialIcons name="text-increase" size={20} color={textColor} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingsRow}>
            <Text style={[styles.settingsLabel, { color: textColor }]}>Theme</Text>
            <TouchableOpacity style={styles.themeButton} onPress={toggleTheme}>
              <MaterialIcons
                name={backgroundColor === '#1a1a1a' ? 'light-mode' : 'dark-mode'}
                size={20}
                color={textColor}
              />
              <Text style={[styles.themeButtonText, { color: textColor }]}>
                {backgroundColor === '#1a1a1a' ? 'Light' : 'Dark'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading chapter...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />

      {/* Modern gradient header */}
      <LinearGradient
        colors={['rgba(100, 181, 246, 0.1)', 'transparent']}
        style={styles.headerGradient}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: showMiniPlayer ? 140 : 80 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.chapterHeader}>
          {/* Title is now part of the content list */}
        </View>
        {content.map((paragraph, index) => renderParagraph(paragraph, index))}
      </ScrollView>

      {renderSettingsPanel()}
      {renderMiniPlayer()}
      {renderSpeedModal()}
      {renderNarratorVoiceModal()}
      {renderDialogueVoiceModal()}

      {/* Floating Settings Button */}
      <TouchableOpacity
        style={[styles.floatingSettingsButton, { bottom: showMiniPlayer ? 100 : 20 }]}
        onPress={toggleSettings}
      >
        <MaterialIcons name="settings" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Floating Audio Button */}
      <TouchableOpacity
        style={[styles.floatingAudioButton, { bottom: showMiniPlayer ? 160 : 80 }]}
        onPress={navigateToAudioPlayer}
      >
        <MaterialIcons name="headset" size={24} color="#fff" />
      </TouchableOpacity>

    </View>
  );
};
const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Deeper background for better contrast
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  chapterTitleText: {
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  paragraphContainer: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    minHeight: 60,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    position: 'relative',
  },
  paragraph: {
    textAlign: 'justify',
    letterSpacing: 0.2,
  },
  paragraphLabel: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'left',
  },
  paragraphFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  wordCount: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  loadingIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  playingIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    backgroundColor: 'rgba(100, 181, 246, 0.1)',
    borderRadius: 12,
    padding: 4,
  },
  toolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  toolbarButton: {
    padding: 10,
  },
  audioButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsPanel: {
    width: '85%',
    maxWidth: 350,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#404040',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
  },
  settingsCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingsPanelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fontButton: {
    padding: 10,
  },
  fontSizeText: {
    marginHorizontal: 15,
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  themeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  themeButtonText: {
    marginLeft: 5,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  // Modern design elements
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 0,
  },
  chapterHeader: {
    marginBottom: 10,
    paddingVertical: 0,
  },
  chapterSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Mini Player Styles
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 181, 246, 0.3)',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    zIndex: 1000,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  miniPlayerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
    minHeight: 88,
    zIndex: 1,
  },
  miniPlayerTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  miniPlayerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    paddingHorizontal: 16,
  },
  miniPlayerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  miniPlayerPlayButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#64b5f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  miniPlayerSpeedButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  miniPlayerSpeedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  miniPlayerVoiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  audioStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  audioStatusText: {
    fontSize: 12,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  miniPlayerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Speed Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedModalContainer: {
    width: '80%',
    maxWidth: 300,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  speedModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  speedOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  speedModalClose: {
    marginTop: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedModalCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Voice Modal Styles
  voiceModalContainer: {
    width: '80%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  voiceModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  voiceOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  voiceModalClose: {
    marginTop: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceModalCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Floating Action Buttons
  floatingSettingsButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#64b5f6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#64b5f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 999,
  },
  floatingAudioButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 999,
  },
});

export default ReaderScreen;