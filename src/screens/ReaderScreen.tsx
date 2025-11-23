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
  const [backgroundColor, setBackgroundColor] = useState('#fff');
  const [textColor, setTextColor] = useState('#333');
  const [showSettings, setShowSettings] = useState(false);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
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
    if (backgroundColor === '#fff') {
      setBackgroundColor('#1a1a1a');
      setTextColor('#fff');
    } else {
      setBackgroundColor('#fff');
      setTextColor('#333');
    }
  };

  const navigateToAudioPlayer = () => {
    navigation.navigate('AudioPlayer', { novel, chapter });
  };

  const handleParagraphPress = (index: number) => {
    setActiveParagraphIndex(activeParagraphIndex === index ? null : index);
    // Here you can add audio playback functionality in the future
    // For now, just provide visual feedback
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
            borderLeftColor: isActive ? '#2196F3' : 'transparent',
            borderLeftWidth: isActive ? 4 : 0,
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
            Paragraph {index + 1} • Tap to deselect
          </Text>
        )}
      </TouchableOpacity>
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
            name={backgroundColor === '#fff' ? 'dark-mode' : 'light-mode'}
            size={20}
            color={textColor}
          />
          <Text style={[styles.themeButtonText, { color: textColor }]}>
            {backgroundColor === '#fff' ? 'Dark' : 'Light'}
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
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.chapterTitle, { color: textColor }]}>
          Chapter {chapter.chapterNumber}: {chapter.chapterTitle}
        </Text>

        {content.map(renderParagraph)}
      </ScrollView>

      {showSettings && renderSettingsPanel()}

      <View style={[styles.toolbar, { backgroundColor }]}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={toggleSettings}
        >
          <MaterialIcons name="settings" size={24} color={textColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <MaterialIcons name="keyboard-arrow-up" size={24} color={textColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.audioButton}
          onPress={navigateToAudioPlayer}
        >
          <MaterialIcons name="headset" size={24} color="#fff" />
          <Text style={styles.audioButtonText}>Listen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <MaterialIcons name="keyboard-arrow-down" size={24} color={textColor} />
        </TouchableOpacity>
      </View>
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
    borderTopColor: '#e0e0e0',
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
});

export default ReaderScreen;