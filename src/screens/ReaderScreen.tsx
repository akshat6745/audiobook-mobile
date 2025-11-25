import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { chapterAPI, userAPI } from '../services/api';
import api from '../services/api';
import { Chapter, Novel, RootStackParamList, ChapterContent } from '../types';
import { useAuth } from '../context/AuthContext';

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
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [audioStatus, setAudioStatus] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();

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
    initializeAudio();

    return () => {
      // Cleanup audio when component unmounts
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [chapter]);

  // Monitor audio status
  useEffect(() => {
    if (audioStatus) {
      if (audioStatus.didJustFinish) {
        setIsPlaying(false);
      }
      setIsPlaying(audioStatus.isPlaying || false);
    }
  }, [audioStatus]);

  const initializeAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
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

      setContent(processedContent);
    } catch (error) {
      console.error('Error loading chapter content:', error);

      // Load demo content if backend is not available
      const demoContent = [
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

  const handleParagraphPress = async (index: number) => {
    setActiveParagraphIndex(index);
    setShowMiniPlayer(true);
    setIsPlaying(false);

    // Load audio for this paragraph
    await loadParagraphAudio(index);
  };

  const loadParagraphAudio = async (index: number) => {
    if (!content[index]) return;

    try {
      setIsLoadingAudio(true);
      const paragraphText = content[index];

      // Unload previous sound
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // Make API request to get audio
      const response = await fetch(`${api.defaults.baseURL}/tts-dual-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: paragraphText,
          paragraphVoice: narratorVoice,
          dialogueVoice: dialogueVoice
        })
      });

      if (response.ok) {
        // Get the audio as a blob
        const audioBlob = await response.blob();

        // Create a temporary file
        const fileUri = `${FileSystem.cacheDirectory}audio_${Date.now()}.mp3`;

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);

        reader.onload = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];

            // Write the file using legacy API which is more stable
            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Load the audio file with Expo AV and auto-play
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: fileUri },
              {
                shouldPlay: true, // Auto-play when audio loads
                rate: playbackSpeed,
                shouldCorrectPitch: true
              },
              (status) => setAudioStatus(status)
            );

            setSound(newSound);
            setIsPlaying(true); // Update playing state
          } catch (fileError) {
            console.error('Error writing audio file:', fileError);
            Alert.alert(
              'Audio Error',
              'Failed to save audio file. Please try again.',
              [{ text: 'OK' }]
            );
          }
        };

        reader.onerror = () => {
          console.error('Error reading audio blob');
          Alert.alert(
            'Audio Error',
            'Failed to process audio data. Please try again.',
            [{ text: 'OK' }]
          );
        };
      } else {
        console.error('Failed to generate audio:', response.status);
        Alert.alert(
          'Audio Generation Failed',
          'Could not generate audio for this paragraph. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      Alert.alert(
        'Audio Error',
        'Failed to connect to audio service. Please check your connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const togglePlayback = async () => {
    if (sound && !isLoadingAudio) {
      try {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Error controlling playback:', error);
      }
    }
  };

  const goToPreviousParagraph = async () => {
    if (activeParagraphIndex !== null && activeParagraphIndex > 0) {
      const newIndex = activeParagraphIndex - 1;
      setActiveParagraphIndex(newIndex);
      setIsPlaying(false);
      // Auto-play new paragraph
      await loadParagraphAudio(newIndex);
    }
  };

  const goToNextParagraph = async () => {
    if (activeParagraphIndex !== null && activeParagraphIndex < content.length - 1) {
      const newIndex = activeParagraphIndex + 1;
      setActiveParagraphIndex(newIndex);
      setIsPlaying(false);
      // Auto-play new paragraph
      await loadParagraphAudio(newIndex);
    }
  };

  const closeMiniPlayer = async () => {
    setShowMiniPlayer(false);
    setIsPlaying(false);
    setActiveParagraphIndex(null);

    // Clean up sound
    if (sound) {
      try {
        await sound.unloadAsync();
        setSound(null);
      } catch (error) {
        console.error('Error unloading sound:', error);
      }
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

    // Regenerate and auto-play audio with new voice if paragraph is active
    if (activeParagraphIndex !== null) {
      setIsPlaying(false); // Stop current audio
      await loadParagraphAudio(activeParagraphIndex);
    }
  };

  const selectDialogueVoice = async (voiceValue: string) => {
    setDialogueVoice(voiceValue);
    setShowDialogueModal(false);

    // Regenerate and auto-play audio with new voice if paragraph is active
    if (activeParagraphIndex !== null) {
      setIsPlaying(false); // Stop current audio
      await loadParagraphAudio(activeParagraphIndex);
    }
  };

  const renderParagraph = (paragraph: string, index: number) => {
    const isActive = activeParagraphIndex === index;

    return (
      <TouchableOpacity
        key={index}
        activeOpacity={0.7}
        onPress={() => handleParagraphPress(index)}
        style={[
          styles.paragraphContainer,
          {
            backgroundColor: isActive
              ? (backgroundColor === '#fff' ? '#f0f8ff' : '#2a2a2a')
              : undefined, // Use default from styles
            borderLeftColor: isActive ? '#64b5f6' : 'transparent',
            borderLeftWidth: isActive ? 4 : 0,
            borderColor: isActive ? '#64b5f6' : '#333333',
          }
        ]}
      >
        <Text style={[
          styles.paragraph,
          {
            fontSize,
            color: isActive
              ? (backgroundColor === '#fff' ? '#1976d2' : '#64b5f6')
              : textColor,
            fontWeight: isActive ? '600' : 'normal'
          }
        ]}>
          {paragraph}
        </Text>
        {isActive && (
          <Text style={[
            styles.paragraphLabel,
            {
              color: backgroundColor === '#fff' ? '#1976d2' : '#64b5f6'
            }
          ]}>
            Paragraph {index + 1} • Now Reading
          </Text>
        )}
      </TouchableOpacity>
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

                  // Update current sound speed
                  if (sound) {
                    try {
                      await sound.setRateAsync(speed, true);
                    } catch (error) {
                      console.error('Error setting playback speed:', error);
                    }
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
        <View style={styles.miniPlayerContent}>
          <View style={styles.miniPlayerControls}>
            {/* Previous Button */}
            <TouchableOpacity
              style={[
                styles.miniPlayerButton,
                {
                  opacity: activeParagraphIndex > 0 ? 1 : 0.5,
                  backgroundColor: '#333'
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
                  backgroundColor: '#333'
                }
              ]}
              onPress={goToNextParagraph}
              disabled={activeParagraphIndex === content.length - 1}
            >
              <MaterialIcons name="skip-next" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Voice Selection Buttons */}
            <TouchableOpacity
              style={[styles.miniPlayerVoiceButton, { backgroundColor: '#333' }]}
              onPress={openNarratorVoiceModal}
            >
              <MaterialIcons name="person" size={16} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.miniPlayerVoiceButton, { backgroundColor: '#333' }]}
              onPress={openDialogueVoiceModal}
            >
              <MaterialIcons name="chat" size={16} color="#fff" />
            </TouchableOpacity>

            {/* Speed Button */}
            <TouchableOpacity
              style={[styles.miniPlayerSpeedButton, { backgroundColor: '#333' }]}
              onPress={() => setShowSpeedModal(true)}
            >
              <Text style={styles.miniPlayerSpeedText}>{playbackSpeed}×</Text>
            </TouchableOpacity>
          </View>

          {/* Loading/Audio Status */}
          {isLoadingAudio && (
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
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: showMiniPlayer ? 100 : 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.chapterTitle, { color: textColor }]}>
          Chapter {chapter.chapterNumber}: {chapter.chapterTitle}
        </Text>

        {content.map(renderParagraph)}
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
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  chapterTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 28,
  },
  paragraphContainer: {
    marginBottom: 15,
    borderRadius: 8,
    padding: 12,
    minHeight: 50,
    backgroundColor: '#242424', // Subtle dark shade for distinction
    borderWidth: 1,
    borderColor: '#333333',
  },
  paragraph: {
    lineHeight: 24,
    textAlign: 'justify',
  },
  paragraphLabel: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'right',
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
  // Mini Player Styles
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#252525', // Contrasting dark shade
    borderTopWidth: 1,
    borderTopColor: '#404040',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    zIndex: 1000,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
    minHeight: 80,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerSpeedButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerSpeedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  miniPlayerVoiceButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 999,
  },
});

export default ReaderScreen;