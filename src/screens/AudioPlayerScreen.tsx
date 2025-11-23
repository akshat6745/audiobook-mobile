import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { chapterAPI, userAPI } from '../services/api';
import { Chapter, Novel, RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

type AudioPlayerScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AudioPlayer'>;
type AudioPlayerScreenRouteProp = RouteProp<RootStackParamList, 'AudioPlayer'>;

interface Props {
  navigation: AudioPlayerScreenNavigationProp;
  route: AudioPlayerScreenRouteProp;
}

const AudioPlayerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { novel, chapter } = route.params;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [voice, setVoice] = useState('en-US-ChristopherNeural');
  const [dialogueVoice, setDialogueVoice] = useState('en-US-JennyNeural');
  const { user } = useAuth();

  useEffect(() => {
    // Simulate audio generation for demo purposes
    simulateAudioGeneration();
    saveProgress();
  }, [chapter]);

  const saveProgress = async () => {
    if (!user) return;

    try {
      await userAPI.saveProgress(user, novel.title, chapter.chapterNumber);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const simulateAudioGeneration = async () => {
    setIsGenerating(true);

    // Simulate audio generation delay
    setTimeout(() => {
      setIsGenerating(false);
      setDuration(180000); // 3 minutes demo duration
      Alert.alert(
        'Audio Ready',
        'Audio has been generated! Note: This is a demo version. Connect to AudioBookPython backend for full TTS functionality.',
        [{ text: 'OK' }]
      );
    }, 3000);
  };

  const togglePlayback = () => {
    if (isGenerating) return;
    setIsPlaying(!isPlaying);

    // Simulate playback progress
    if (!isPlaying) {
      const interval = setInterval(() => {
        setPosition(prev => {
          const newPos = prev + 1000;
          if (newPos >= duration) {
            setIsPlaying(false);
            clearInterval(interval);
            return duration;
          }
          return newPos;
        });
      }, 1000);

      // Store interval ID for cleanup
      (togglePlayback as any).interval = interval;
    } else {
      if ((togglePlayback as any).interval) {
        clearInterval((togglePlayback as any).interval);
      }
    }
  };

  const seekTo = (value: number) => {
    setPosition(value);
  };

  const skipForward = () => {
    const newPosition = Math.min(position + 30000, duration);
    setPosition(newPosition);
  };

  const skipBackward = () => {
    const newPosition = Math.max(position - 30000, 0);
    setPosition(newPosition);
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const regenerateAudio = () => {
    Alert.alert(
      'Regenerate Audio',
      'This will regenerate the audio with current voice settings. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: simulateAudioGeneration },
      ]
    );
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const openReader = () => {
    navigation.navigate('Reader', { novel, chapter });
  };

  if (isGenerating) {
    return (
      <View style={styles.generatingContainer}>
        <LinearGradient
          colors={['#2196F3', '#1976D2']}
          style={styles.gradient}
        >
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.generatingText}>Generating Audio...</Text>
          <Text style={styles.generatingSubtext}>
            Converting chapter to speech with AI voices
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2196F3', '#1976D2']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.novelTitle} numberOfLines={1}>
            {novel.title}
          </Text>
          <Text style={styles.chapterTitle} numberOfLines={2}>
            Chapter {chapter.chapterNumber}: {chapter.chapterTitle}
          </Text>
        </View>

        <View style={styles.playerContainer}>
          {/* Progress Slider */}
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Slider
              style={styles.progressSlider}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              onSlidingComplete={seekTo}
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="rgba(255,255,255,0.3)"
            />
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>

          {/* Main Controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={skipBackward}
              disabled={isLoading}
            >
              <MaterialIcons name="replay-30" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.playButton, isLoading && styles.playButtonDisabled]}
              onPress={togglePlayback}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : (
                <MaterialIcons
                  name={isPlaying ? "pause" : "play-arrow"}
                  size={48}
                  color="#2196F3"
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={skipForward}
              disabled={isLoading}
            >
              <MaterialIcons name="forward-30" size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Speed Control */}
          <View style={styles.speedContainer}>
            <Text style={styles.speedLabel}>Speed: {playbackSpeed}x</Text>
            <View style={styles.speedButtons}>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.speedButton,
                    playbackSpeed === speed && styles.speedButtonActive
                  ]}
                  onPress={() => changePlaybackSpeed(speed)}
                >
                  <Text
                    style={[
                      styles.speedButtonText,
                      playbackSpeed === speed && styles.speedButtonTextActive
                    ]}
                  >
                    {speed}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.actionButton} onPress={openReader}>
            <MaterialIcons name="book" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Read</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={regenerateAudio}>
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  novelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  chapterTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  playerContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  progressSlider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  controlButton: {
    padding: 15,
  },
  playButton: {
    backgroundColor: '#fff',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  playButtonDisabled: {
    opacity: 0.7,
  },
  speedContainer: {
    alignItems: 'center',
  },
  speedLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  speedButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  speedButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  speedButtonActive: {
    backgroundColor: '#fff',
  },
  speedButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  speedButtonTextActive: {
    color: '#2196F3',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  generatingContainer: {
    flex: 1,
  },
  generatingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  generatingSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default AudioPlayerScreen;