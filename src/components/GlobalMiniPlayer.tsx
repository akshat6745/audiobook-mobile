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
    closePlayer,
  } = useAudio();

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
});

export default GlobalMiniPlayer;
