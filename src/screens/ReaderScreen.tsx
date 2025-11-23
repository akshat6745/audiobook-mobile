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
import { chapterAPI, userAPI } from '../services/api';
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
  const scrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadChapterContent();
    saveProgress();
  }, [chapter]);

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

  const handleParagraphPress = (index: number) => {
    setActiveParagraphIndex(index);
    setShowMiniPlayer(true);
    setIsPlaying(false); // Start paused when selecting new paragraph
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    // Here you would implement actual TTS audio playback
  };

  const goToPreviousParagraph = () => {
    if (activeParagraphIndex !== null && activeParagraphIndex > 0) {
      setActiveParagraphIndex(activeParagraphIndex - 1);
      setIsPlaying(false);
    }
  };

  const goToNextParagraph = () => {
    if (activeParagraphIndex !== null && activeParagraphIndex < content.length - 1) {
      setActiveParagraphIndex(activeParagraphIndex + 1);
      setIsPlaying(false);
    }
  };

  const closeMiniPlayer = () => {
    setShowMiniPlayer(false);
    setIsPlaying(false);
    setActiveParagraphIndex(null);
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
              : 'transparent',
            borderLeftColor: isActive ? '#64b5f6' : 'transparent',
            borderLeftWidth: isActive ? 4 : 0,
            borderColor: isActive ? '#64b5f6' : 'transparent',
            borderWidth: isActive ? 1 : 0,
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
                onPress={() => {
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

  const renderMiniPlayer = () => {
    if (!showMiniPlayer || activeParagraphIndex === null) return null;

    return (
      <Animated.View style={[styles.miniPlayerContainer, { backgroundColor: backgroundColor }]}>
        <View style={styles.miniPlayerContent}>
          <Text style={[styles.miniPlayerTitle, { color: textColor }]}>
            Paragraph {activeParagraphIndex + 1}
          </Text>

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

            {/* Speed Button */}
            <TouchableOpacity
              style={[styles.miniPlayerSpeedButton, { backgroundColor: '#333' }]}
              onPress={() => setShowSpeedModal(true)}
            >
              <Text style={styles.miniPlayerSpeedText}>{playbackSpeed}×</Text>
            </TouchableOpacity>
          </View>

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
    <View style={[styles.settingsPanel, { backgroundColor: backgroundColor }]}>
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
    </View>
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
          { paddingBottom: showMiniPlayer ? 180 : 120 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.chapterTitle, { color: textColor }]}>
          Chapter {chapter.chapterNumber}: {chapter.chapterTitle}
        </Text>

        {content.map(renderParagraph)}
      </ScrollView>

      {showSettings && renderSettingsPanel()}
      {renderMiniPlayer()}
      {renderSpeedModal()}

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
  settingsPanel: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    bottom: 70,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: '#333',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
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
    gap: 12,
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
});

export default ReaderScreen;