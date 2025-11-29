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
import { useAudio } from '../context/AudioContext';

type ReaderScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Reader'>;
type ReaderScreenRouteProp = RouteProp<RootStackParamList, 'Reader'>;

interface Props {
  navigation: ReaderScreenNavigationProp;
  route: ReaderScreenRouteProp;
}

const ReaderScreen: React.FC<Props> = ({ navigation, route }) => {
  const { novel, chapter } = route.params;
  const {
    isPlaying,
    currentParagraphIndex,
    playParagraph,
    loadChapter,
    setPlaybackSpeed,
    setVoices,
    audioPlayerState,
    content,
    isChapterLoading,
    playbackSpeed
  } = useAudio();

  // Local state for UI only

  // Local state for UI only
  const [fontSize, setFontSize] = useState(16);
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [textColor, setTextColor] = useState('#fff');
  const [showSettings, setShowSettings] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showNarratorModal, setShowNarratorModal] = useState(false);
  const [showDialogueModal, setShowDialogueModal] = useState(false);
  const [narratorVoice, setNarratorVoice] = useState("en-US-AvaMultilingualNeural");
  const [dialogueVoice, setDialogueVoice] = useState("en-GB-RyanNeural");

  const scrollViewRef = useRef<ScrollView>(null);
  const paragraphRefs = useRef<{ [key: number]: View | null }>({});

  const isTransitioning = useRef(false); // Track if we are switching paragraphs
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
    if (currentParagraphIndex !== null) {
      scrollToActiveParagraph(currentParagraphIndex);
    }
  }, [currentParagraphIndex, scrollToActiveParagraph]);

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
    loadChapter(novel, chapter);
  }, [chapter.id, novel.title, loadChapter]);

  useEffect(() => {
    saveProgress();
  }, [chapter.id, novel.title]); // Only save when chapter changes

  // Update voices in context
  useEffect(() => {
    setVoices(narratorVoice, dialogueVoice);
  }, [narratorVoice, dialogueVoice, setVoices]);

  // Handle paragraph press - Moved up to avoid use-before-declaration in useEffect
  const handleParagraphPress = async (index: number) => {
    console.log('🎯 handleParagraphPress called for index:', index);
    await playParagraph(index);
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



  const openNarratorVoiceModal = () => {
    setShowNarratorModal(true);
  };

  const openDialogueVoiceModal = () => {
    setShowDialogueModal(true);
  };

  const selectNarratorVoice = async (voiceValue: string) => {
    setNarratorVoice(voiceValue);
    setShowNarratorModal(false);

    // Replay current paragraph with new voice
    if (currentParagraphIndex !== null) {
      await playParagraph(currentParagraphIndex);
    }
  };

  const selectDialogueVoice = async (voiceValue: string) => {
    setDialogueVoice(voiceValue);
    setShowDialogueModal(false);

    // Replay current paragraph with new voice
    if (currentParagraphIndex !== null) {
      await playParagraph(currentParagraphIndex);
    }
  };

  const renderParagraph = (paragraph: string, index: number) => {
    const isActive = currentParagraphIndex === index;
    // Removed isLoading check for UI simplification


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
          {/* Audio loading and playing indicators removed for simpler UI */}


          <Text style={[
            index === 0 ? styles.chapterTitleText : styles.paragraph, // Special style for title
            {
              fontSize: index === 0 ? fontSize * 1.5 : fontSize,
              color: isActive
                ? (backgroundColor === '#fff' ? '#1565c0' : '#90caf9')
                : textColor,
              fontWeight: index === 0 ? '700' : (isActive ? '600' : '400'),
              lineHeight: fontSize * (index === 0 ? 1.5 : 1.6), // Increased line height for title
              marginTop: isActive ? 4 : 0,
              textAlign: index === 0 ? 'center' : 'justify',
              paddingVertical: index === 0 ? 4 : 0, // Add padding to prevent clipping
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
              {index === 0 ? 'Chapter Title' : `Paragraph ${index}`}
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

  if (isChapterLoading) {
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
          { paddingBottom: 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.chapterHeader}>
          {/* Title is now part of the content list */}
        </View>
        {content.map((paragraph, index) => renderParagraph(paragraph, index))}
      </ScrollView>

      {renderSettingsPanel()}

      {renderSpeedModal()}
      {renderNarratorVoiceModal()}
      {renderDialogueVoiceModal()}

      {/* Floating Settings Button */}
      <TouchableOpacity
        style={[styles.floatingSettingsButton, { bottom: 20 }]}
        onPress={toggleSettings}
      >
        <MaterialIcons name="settings" size={24} color="#fff" />
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
});

export default ReaderScreen;