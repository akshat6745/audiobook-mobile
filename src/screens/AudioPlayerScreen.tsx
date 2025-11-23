import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { chapterAPI, userAPI } from '../services/api';
import { Chapter, Novel, RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import Theme from '../styles/theme';

type AudioPlayerScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AudioPlayer'>;
type AudioPlayerScreenRouteProp = RouteProp<RootStackParamList, 'AudioPlayer'>;

interface Props {
  navigation: AudioPlayerScreenNavigationProp;
  route: AudioPlayerScreenRouteProp;
}

const AudioPlayerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { novel, chapter } = route.params;
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(180000); // 3 minutes default
  const [position, setPosition] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const { user } = useAuth();

  // Timer management
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    simulateAudioGeneration();
    saveProgress();

    return () => {
      clearTimer();
    };
  }, [chapter]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      startTimer();
    } else {
      clearTimer();
    }
  }, [isPlaying, playbackSpeed]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      if (isPlayingRef.current) {
        setPosition(prev => {
          const newPos = prev + (1000 * playbackSpeed);
          if (newPos >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return newPos;
        });
      }
    }, 1000);
  }, [duration, playbackSpeed, clearTimer]);

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
    setTimeout(() => {
      setIsGenerating(false);
      setDuration(180000);
      Alert.alert(
        'Audio Ready',
        'Demo audio generated! Timer now works correctly - try play/pause.',
        [{ text: 'OK' }]
      );
    }, 2000);
  };

  const togglePlayback = () => {
    if (isGenerating) return;
    setIsPlaying(!isPlaying);
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

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const openReader = () => {
    navigation.navigate('Reader', { novel, chapter });
  };

  const getProgressPercentage = () => {
    return duration > 0 ? (position / duration) * 100 : 0;
  };

  if (isGenerating) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[Theme.colors.primary[500], Theme.colors.primary[700]]}
          style={styles.gradient}
        >
          <ActivityIndicator size="large" color={Theme.colors.neutral.white} />
          <Text style={styles.generatingText}>Generating Audio...</Text>
          <Text style={styles.generatingSubtext}>
            Converting chapter to speech
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[Theme.colors.primary[500], Theme.colors.primary[700]]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.novelTitle} numberOfLines={1}>
            {novel.title}
          </Text>
          <Text style={styles.chapterTitle} numberOfLines={2}>
            Chapter {chapter.chapterNumber}: {chapter.chapterTitle}
          </Text>
        </View>

        {/* Album Art */}
        <View style={styles.albumArtContainer}>
          <View style={styles.albumArt}>
            <MaterialIcons
              name="headset"
              size={80}
              color={Theme.colors.primary[300]}
            />
          </View>
          <Text style={styles.progressText}>
            {getProgressPercentage().toFixed(0)}% Complete
          </Text>
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Slider
            style={styles.progressSlider}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            onSlidingComplete={seekTo}
            minimumTrackTintColor={Theme.colors.accent[400]}
            maximumTrackTintColor={Theme.colors.neutral.white + '40'}
            thumbTintColor={Theme.colors.accent[400]}
          />
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={skipBackward}
          >
            <MaterialIcons name="replay-30" size={32} color={Theme.colors.neutral.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayback}
          >
            <MaterialIcons
              name={isPlaying ? "pause" : "play-arrow"}
              size={48}
              color={Theme.colors.primary[600]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={skipForward}
          >
            <MaterialIcons name="forward-30" size={32} color={Theme.colors.neutral.white} />
          </TouchableOpacity>
        </View>

        {/* Speed Control */}
        <View style={styles.speedContainer}>
          <Text style={styles.speedLabel}>Speed: {playbackSpeed}×</Text>
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
                  {speed}×
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.actionButton} onPress={openReader}>
            <MaterialIcons name="book" size={20} color={Theme.colors.neutral.white} />
            <Text style={styles.actionButtonText}>Read Text</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    padding: Theme.spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: Theme.spacing.xl,
  },
  novelTitle: {
    fontSize: Theme.typography.fontSizes.xl,
    fontWeight: Theme.typography.fontWeights.bold,
    color: Theme.colors.neutral.white,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  chapterTitle: {
    fontSize: Theme.typography.fontSizes.md,
    color: Theme.colors.neutral.white + 'E0',
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeights.normal * Theme.typography.fontSizes.md,
  },
  albumArtContainer: {
    alignItems: 'center',
    marginVertical: Theme.spacing.xl,
  },
  albumArt: {
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: (width * 0.5) / 2,
    backgroundColor: Theme.colors.neutral.white + '20',
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.xl,
    marginBottom: Theme.spacing.md,
  },
  progressText: {
    color: Theme.colors.neutral.white,
    fontSize: Theme.typography.fontSizes.sm,
    fontWeight: Theme.typography.fontWeights.medium,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Theme.spacing.lg,
  },
  progressSlider: {
    flex: 1,
    height: 40,
    marginHorizontal: Theme.spacing.md,
  },
  timeText: {
    color: Theme.colors.neutral.white,
    fontSize: Theme.typography.fontSizes.sm,
    fontWeight: Theme.typography.fontWeights.medium,
    minWidth: 50,
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Theme.spacing.lg,
  },
  controlButton: {
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.neutral.white + '10',
  },
  playButton: {
    backgroundColor: Theme.colors.neutral.white,
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: Theme.spacing.xl,
    ...Theme.shadows.lg,
  },
  speedContainer: {
    alignItems: 'center',
    marginVertical: Theme.spacing.md,
  },
  speedLabel: {
    color: Theme.colors.neutral.white,
    fontSize: Theme.typography.fontSizes.md,
    fontWeight: Theme.typography.fontWeights.medium,
    marginBottom: Theme.spacing.md,
  },
  speedButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  speedButton: {
    backgroundColor: Theme.colors.neutral.white + '20',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.neutral.white + '30',
  },
  speedButtonActive: {
    backgroundColor: Theme.colors.accent[400],
    borderColor: Theme.colors.accent[400],
  },
  speedButtonText: {
    color: Theme.colors.neutral.white,
    fontSize: Theme.typography.fontSizes.sm,
    fontWeight: Theme.typography.fontWeights.medium,
  },
  speedButtonTextActive: {
    color: Theme.colors.neutral.white,
    fontWeight: Theme.typography.fontWeights.bold,
  },
  bottomActions: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.neutral.white + '15',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Theme.colors.neutral.white + '20',
  },
  actionButtonText: {
    color: Theme.colors.neutral.white,
    fontWeight: Theme.typography.fontWeights.medium,
    marginLeft: Theme.spacing.sm,
  },
  generatingText: {
    fontSize: Theme.typography.fontSizes['2xl'],
    fontWeight: Theme.typography.fontWeights.bold,
    color: Theme.colors.neutral.white,
    textAlign: 'center',
    marginTop: Theme.spacing.lg,
  },
  generatingSubtext: {
    fontSize: Theme.typography.fontSizes.md,
    color: Theme.colors.neutral.white + 'CC',
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
  },
});

export default AudioPlayerScreen;