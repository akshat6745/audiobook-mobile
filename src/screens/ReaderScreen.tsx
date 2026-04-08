import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { chapterAPI } from '../services/api';
import { RootStackParamList } from '../types';
import { offlineContentService } from '../services/offlineContentService';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import { useProgress } from '../context/ProgressContext';

type ReaderScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Reader'>;
type ReaderScreenRouteProp = RouteProp<RootStackParamList, 'Reader'>;

// Fallback height used when FlatList cannot scroll to an index (item not yet rendered).
// Approximate average; keeps the list in the right vicinity without exact measurement.
const ESTIMATED_PARAGRAPH_HEIGHT = 120;

interface ParagraphItemProps {
  paragraph: string;
  index: number;
  isActive: boolean;
  onPress: (index: number) => void;
  fontSize: number;
  backgroundColor: string;
  textColor: string;
}

const ParagraphItem = React.memo(({
  paragraph, index, isActive, onPress, fontSize, backgroundColor, textColor,
}: ParagraphItemProps) => {
  const isTitle = index === 0;
  const isLight = backgroundColor === '#fff';
  const wordCount = useMemo(() => paragraph.split(' ').length, [paragraph]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(index)}
      style={[
        styles.paragraphContainer,
        {
          backgroundColor: isActive
            ? (isLight ? 'rgba(100, 181, 246, 0.15)' : 'rgba(100, 181, 246, 0.2)')
            : (isLight ? '#ffffff' : '#252525'),
          borderLeftColor: isActive ? '#64b5f6' : 'transparent',
          borderLeftWidth: isActive ? 4 : 0,
          borderColor: isActive ? '#64b5f6' : (isLight ? '#e0e0e0' : '#3A3A3A'),
          shadowColor: isActive ? '#64b5f6' : '#000',
          shadowOffset: { width: 0, height: isActive ? 4 : 2 },
          shadowOpacity: isActive ? 0.25 : (isLight ? 0.1 : 0.3),
          shadowRadius: isActive ? 8 : 4,
          elevation: isActive ? 8 : 3,
          transform: [{ scale: isActive ? 1.01 : 1 }],
          marginBottom: isTitle ? 24 : 16,
        },
      ]}
    >
      <Text
        style={[
          isTitle ? styles.chapterTitleText : styles.paragraph,
          {
            fontSize: isTitle ? fontSize * 1.5 : fontSize,
            color: isActive ? (isLight ? '#1565c0' : '#90caf9') : textColor,
            fontWeight: isTitle ? '700' : (isActive ? '600' : '400'),
            lineHeight: fontSize * (isTitle ? 1.5 : 1.6),
            marginTop: isActive ? 4 : 0,
            textAlign: isTitle ? 'center' : 'justify',
            paddingVertical: isTitle ? 4 : 0,
          },
        ]}
      >
        {paragraph}
      </Text>
      <View style={styles.paragraphFooter}>
        <Text
          style={[
            styles.paragraphLabel,
            {
              color: isActive ? '#64b5f6' : (isLight ? '#757575' : '#888'),
              fontWeight: isActive ? '600' : '400',
            },
          ]}
        >
          {isTitle ? 'Chapter Title' : `Paragraph ${index}`}
        </Text>
        <Text style={[styles.wordCount, { color: isLight ? '#bdbdbd' : '#666' }]}>
          {wordCount} words
        </Text>
      </View>
    </TouchableOpacity>
  );
});

interface Props {
  navigation: ReaderScreenNavigationProp;
  route: ReaderScreenRouteProp;
}

const ReaderScreen: React.FC<Props> = ({ navigation, route }) => {
  const { novel, chapter } = route.params;
  const {
    currentParagraphIndex: globalParagraphIndex,
    playParagraph,
    loadChapter,
    setPlaybackSpeed,
    setVoices,
    playbackSpeed,
    currentChapter: globalCurrentChapter,
    currentNovel: globalCurrentNovel,
  } = useAudio();
  const { updateProgress } = useProgress();

  // Local state for UI only

  // Local state for content and loading
  const [localContent, setLocalContent] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const flatListRef = useRef<FlatList>(null);

  const { user } = useAuth();

  // Auto-scroll functionality
  const scrollToActiveParagraph = useCallback((index: number) => {
    try {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewOffset: 100 });
    } catch (e) {
      console.warn(`[ReaderScreen] scrollToIndex failed for ${index}, using offset fallback:`, e);
      flatListRef.current?.scrollToOffset({ offset: index * ESTIMATED_PARAGRAPH_HEIGHT, animated: true });
    }
  }, []);

  // Auto-scroll when active paragraph changes
  useEffect(() => {
    // Only auto-scroll if the current playing chapter matches this screen's chapter
    const isCurrentChapterPlaying =
      globalCurrentChapter?.chapterNumber === chapter.chapterNumber &&
      globalCurrentNovel?.title === novel.title;

    if (isCurrentChapterPlaying && globalParagraphIndex !== null) {
      scrollToActiveParagraph(globalParagraphIndex);
    }
  }, [globalParagraphIndex, scrollToActiveParagraph, globalCurrentChapter, globalCurrentNovel, chapter.chapterNumber, novel.title]);

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

  // Independent Content Fetching Logic
  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      try {
        let newContent: string[] = [];
        let realTitle = chapter.chapterTitle || `Chapter ${chapter.chapterNumber}`;

        // Fetch content from API
        console.log('📥 [ReaderScreen] Fetching content for chapter:', chapter.chapterNumber);
        try {
          const chapterData = await chapterAPI.getChapterContent(
            chapter.chapterNumber,
            novel.slug
          );

          if (chapterData && chapterData.content) {
            const processedContent = chapterData.content
              .map((text) => text.trim())
              .filter((text) => text.length > 0);

            realTitle = chapterData.chapterTitle || `Chapter ${chapter.chapterNumber}`;
            const titleContent = `Chapter ${chapter.chapterNumber}: ${realTitle}`;
            newContent = [titleContent, ...processedContent];

            navigation.setOptions({ title: realTitle });
          }
        } catch (apiError) {
          // API unavailable — try offline downloaded content
          console.warn('[ReaderScreen] API unavailable, trying offline content...');
          const offlineData = await offlineContentService.getOfflineChapterContent(
            novel.slug,
            chapter.chapterNumber
          );
          if (offlineData?.content?.length) {
            realTitle = offlineData.chapterTitle || chapter.chapterTitle || `Chapter ${chapter.chapterNumber}`;
            const titleContent = `Chapter ${chapter.chapterNumber}: ${realTitle}`;
            newContent = [titleContent, ...offlineData.content];
            navigation.setOptions({ title: realTitle });
            console.log(`📂 [ReaderScreen] Loaded ${offlineData.content.length} paragraphs from offline storage`);
          } else {
            Alert.alert(
              'Offline',
              'No internet connection and this chapter has not been downloaded. Please connect to continue.'
            );
          }
        }

        setLocalContent(newContent);

      } catch (error) {
        console.error('[ReaderScreen] Error loading chapter content:', error);
        Alert.alert('Error', 'Failed to load chapter content. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [chapter.chapterNumber, novel.title, novel.slug]); // Dependency on IDs, not objects

  // Save progress (Optimized to only trigger when actually viewing)
  useEffect(() => {
    if (user && !isLoading) {
      updateProgress(novel.slug, chapter.chapterNumber);
    }
  }, [novel.title, chapter.chapterNumber, user, isLoading]);

  // Update voices in context
  useEffect(() => {
    setVoices(narratorVoice, dialogueVoice);
  }, [narratorVoice, dialogueVoice, setVoices]);

  const handleParagraphPress = useCallback(async (index: number) => {
    const isCurrentChapterLoaded =
      globalCurrentChapter?.chapterNumber === chapter.chapterNumber &&
      globalCurrentNovel?.title === novel.title;

    if (!isCurrentChapterLoaded) {
      // AudioContext must be loaded with this chapter before playParagraph works.
      // Pass localContent so we don't make a redundant API call.
      await loadChapter(novel, chapter, localContent, false);
    }

    await playParagraph(index);
  }, [chapter, novel, localContent, globalCurrentChapter, globalCurrentNovel, loadChapter, playParagraph]);

  const goToPrevious = useCallback(() => {
    if (chapter.chapterNumber > 1) {
      navigation.replace('Reader', {
        novel,
        chapter: {
          chapterNumber: chapter.chapterNumber - 1,
          chapterTitle: `Chapter ${chapter.chapterNumber - 1}`,
        },
      });
    }
  }, [navigation, novel, chapter.chapterNumber]);

  const goToNext = useCallback(() => {
    if (!novel.chapterCount || chapter.chapterNumber < novel.chapterCount) {
      navigation.replace('Reader', {
        novel,
        chapter: {
          chapterNumber: chapter.chapterNumber + 1,
          chapterTitle: `Chapter ${chapter.chapterNumber + 1}`,
        },
      });
    }
  }, [navigation, novel, chapter.chapterNumber]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          <TouchableOpacity
            onPress={goToPrevious}
            disabled={chapter.chapterNumber <= 1}
            style={{ padding: 8, opacity: chapter.chapterNumber <= 1 ? 0.3 : 1 }}
          >
            <MaterialIcons name="chevron-left" size={30} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToNext}
            disabled={!!novel.chapterCount && chapter.chapterNumber >= novel.chapterCount}
            style={{ padding: 8, opacity: (!!novel.chapterCount && chapter.chapterNumber >= novel.chapterCount) ? 0.3 : 1 }}
          >
            <MaterialIcons name="chevron-right" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, chapter.chapterNumber, novel.chapterCount, goToPrevious, goToNext]);



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



  const selectNarratorVoice = async (voiceValue: string) => {
    setNarratorVoice(voiceValue);
    setShowNarratorModal(false);

    // Replay current paragraph with new voice
    if (globalParagraphIndex !== null) {
      await playParagraph(globalParagraphIndex);
    }
  };

  const selectDialogueVoice = async (voiceValue: string) => {
    setDialogueVoice(voiceValue);
    setShowDialogueModal(false);

    // Replay current paragraph with new voice
    if (globalParagraphIndex !== null) {
      await playParagraph(globalParagraphIndex);
    }
  };

  const renderSpeedModal = () => {
    const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

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
          onPress={() => { }} // Prevent modal close when tapping inside
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

      <FlatList
        ref={flatListRef}
        data={localContent}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item, index }) => (
          <ParagraphItem
            paragraph={item}
            index={index}
            isActive={
              globalCurrentChapter?.chapterNumber === chapter.chapterNumber &&
              globalCurrentNovel?.title === novel.title &&
              globalParagraphIndex === index
            }
            onPress={handleParagraphPress}
            fontSize={fontSize}
            backgroundColor={backgroundColor}
            textColor={textColor}
          />
        )}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={7}
        initialNumToRender={12}
        onScrollToIndexFailed={({ index }) => {
          flatListRef.current?.scrollToOffset({ offset: index * ESTIMATED_PARAGRAPH_HEIGHT, animated: true });
        }}
      />

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
    paddingBottom: 160,
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