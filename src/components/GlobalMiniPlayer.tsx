import React, { useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  PanResponder, 
  Dimensions, 
  Modal, 
  ScrollView 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAudio } from '../context/AudioContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLAYER_HEIGHT = 70;
const MARGIN = 10;

const GlobalMiniPlayer: React.FC = () => {
  const {
    isPlaying,
    currentParagraphIndex,
    currentChapter,
    currentNovel,
    content,
    togglePlayback,
    playNextParagraph,
    playPreviousParagraph,
    setVoices,
    narratorVoice,
    dialogueVoice,
    closePlayer,
    playbackSpeed,
    setPlaybackSpeed,
  } = useAudio();

  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showSpeedSettings, setShowSpeedSettings] = useState(false);

  const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

  const VOICE_OPTIONS = [
    { label: "Ava (Female, US)", value: "en-US-AvaMultilingualNeural" },
    { label: "Christopher (Male, US)", value: "en-US-ChristopherNeural" },
    { label: "Jenny (Female, US)", value: "en-US-JennyNeural" },
    { label: "Sonia (Female, UK)", value: "en-GB-SoniaNeural" },
    { label: "Ryan (Male, UK)", value: "en-GB-RyanNeural" },
    { label: "Andrew (Male, US, Multilingual)", value: "en-US-AndrewMultilingualNeural" },
    { label: "Emma (Female, US, Multilingual)", value: "en-US-EmmaMultilingualNeural" },
  ];

  const navigation = useNavigation<NavigationProp>();
  const [showFullTextModal, setShowFullTextModal] = useState(false);

  // Dragging state
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
        setIsDragging(true);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        setIsDragging(false);
        
        // Optional: Snap to edges logic could go here
      },
    })
  ).current;

  if (currentParagraphIndex === null || !currentChapter || !currentNovel) {
    return null;
  }

  const handleGoToChapter = () => {
    navigation.navigate('Reader', { novel: currentNovel, chapter: currentChapter });
  };

  const currentText = content[currentParagraphIndex] || '';
  const displayText = currentText.length > 50 ? currentText.substring(0, 50) + '...' : currentText;

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.miniPlayerContainer}>
          {/* Content Area - Opens Modal */}
          <TouchableOpacity 
            style={styles.contentContainer} 
            onPress={() => !isDragging && setShowFullTextModal(true)}
            activeOpacity={0.9}
          >
            <View style={styles.textContainer}>
              <Text style={styles.chapterTitle} numberOfLines={1}>
                {currentChapter.chapterTitle}
              </Text>
              <Text style={styles.paragraphText} numberOfLines={1}>
                {displayText}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.controlsContainer}>
            {/* Play/Pause Button */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={togglePlayback}
            >
              <MaterialIcons
                name={isPlaying ? "pause" : "play-arrow"}
                size={28}
                color="#fff"
              />
            </TouchableOpacity>

            {/* Go to Chapter Button */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleGoToChapter}
            >
              <MaterialIcons name="open-in-new" size={24} color="#64b5f6" />
            </TouchableOpacity>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closePlayer}
            >
              <MaterialIcons name="close" size={20} color="#aaa" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Full Text Modal */}
      <Modal
        visible={showFullTextModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFullTextModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Current Paragraph</Text>
              <TouchableOpacity onPress={() => setShowFullTextModal(false)}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fullText}>{currentText}</Text>
            </ScrollView>
            <View style={styles.modalFooter}>
              {/* Playback Controls */}
              <View style={styles.modalPlaybackControls}>
                <TouchableOpacity onPress={playPreviousParagraph} style={styles.modalControlBtn}>
                  <MaterialIcons name="skip-previous" size={32} color="#fff" />
                </TouchableOpacity>
                
                <TouchableOpacity onPress={togglePlayback} style={styles.modalPlayBtn}>
                  <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={40} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={playNextParagraph} style={styles.modalControlBtn}>
                  <MaterialIcons name="skip-next" size={32} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Speed Controls Toggle */}
              <TouchableOpacity 
                style={styles.voiceSettingsToggle}
                onPress={() => setShowSpeedSettings(!showSpeedSettings)}
              >
                <Text style={styles.voiceSettingsTitle}>Playback Speed</Text>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={{color: '#aaa', marginRight: 8}}>{playbackSpeed}x</Text>
                  <MaterialIcons name={showSpeedSettings ? "expand-less" : "expand-more"} size={24} color="#64b5f6" />
                </View>
              </TouchableOpacity>

              {showSpeedSettings && (
                <View style={styles.voiceSettingsContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {SPEED_OPTIONS.map(speed => (
                      <TouchableOpacity 
                        key={speed}
                        style={[styles.voiceChip, playbackSpeed === speed && styles.voiceChipActive]}
                        onPress={() => setPlaybackSpeed(speed)}
                      >
                        <Text style={[styles.voiceChipText, playbackSpeed === speed && styles.voiceChipTextActive]}>
                          {speed}x
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Voice Controls Toggle */}
              <TouchableOpacity 
                style={styles.voiceSettingsToggle}
                onPress={() => setShowVoiceSettings(!showVoiceSettings)}
              >
                <Text style={styles.voiceSettingsTitle}>Voice Settings</Text>
                <MaterialIcons name={showVoiceSettings ? "expand-less" : "expand-more"} size={24} color="#64b5f6" />
              </TouchableOpacity>

              {showVoiceSettings && (
                <View style={styles.voiceSettingsContainer}>
                  <View style={styles.voiceRow}>
                    <Text style={styles.voiceLabel}>Narrator:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {VOICE_OPTIONS.map(v => (
                        <TouchableOpacity 
                          key={v.value}
                          style={[styles.voiceChip, narratorVoice === v.value && styles.voiceChipActive]}
                          onPress={() => setVoices(v.value, dialogueVoice)}
                        >
                          <Text style={[styles.voiceChipText, narratorVoice === v.value && styles.voiceChipTextActive]}>
                            {v.label.split(' ')[0]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  
                  <View style={styles.voiceRow}>
                    <Text style={styles.voiceLabel}>Dialogue:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {VOICE_OPTIONS.map(v => (
                        <TouchableOpacity 
                          key={v.value}
                          style={[styles.voiceChip, dialogueVoice === v.value && styles.voiceChipActive]}
                          onPress={() => setVoices(narratorVoice, v.value)}
                        >
                          <Text style={[styles.voiceChipText, dialogueVoice === v.value && styles.voiceChipTextActive]}>
                            {v.label.split(' ')[0]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}

               <TouchableOpacity
                style={styles.modalButton}
                onPress={handleGoToChapter}
              >
                <MaterialIcons name="book" size={20} color="#fff" style={{marginRight: 8}}/>
                <Text style={styles.modalButtonText}>Go to Chapter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100, // Initial position
    left: MARGIN,
    right: MARGIN,
    zIndex: 1000,
    width: SCREEN_WIDTH - (MARGIN * 2),
  },
  miniPlayerContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  textContainer: {
    justifyContent: 'center',
  },
  chapterTitle: {
    color: '#64b5f6',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  paragraphText: {
    color: '#fff',
    fontSize: 13,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
    marginLeft: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScroll: {
    padding: 20,
  },
  fullText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  modalPlaybackControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  modalControlBtn: {
    padding: 10,
    marginHorizontal: 15,
  },
  modalPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  voiceSettingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 5,
  },
  voiceSettingsTitle: {
    color: '#64b5f6',
    fontSize: 16,
    fontWeight: '600',
  },
  voiceSettingsContainer: {
    width: '100%',
    marginBottom: 15,
  },
  voiceRow: {
    marginBottom: 10,
  },
  voiceLabel: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 5,
    marginLeft: 4,
  },
  voiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#333',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  voiceChipActive: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderColor: '#2196F3',
  },
  voiceChipText: {
    color: '#ccc',
    fontSize: 12,
  },
  voiceChipTextActive: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
});

export default GlobalMiniPlayer;
