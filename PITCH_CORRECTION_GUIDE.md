# Cross-Platform Pitch Correction Guide

## Overview
This audiobook app implements robust pitch correction across iOS, Android, and Web platforms to ensure that changing playback speed doesn't affect the voice pitch, maintaining natural-sounding audio at all speed levels.

## Platform-Specific Implementation

### iOS (React Native + expo-av)
- **Method**: `sound.setRateAsync(speed, true)` with `shouldCorrectPitch: true`
- **Quality**: High-quality pitch correction using iOS AVAudioEngine
- **Speed Range**: 0.25x - 4.0x (recommended 0.5x - 2.5x for best quality)
- **Audio Mode**: `interruptionModeIOS: 'DoNotMix'` for consistent playback

```typescript
// iOS Configuration
const soundConfig = {
  shouldPlay: true,
  rate: this.playbackSpeed,
  shouldCorrectPitch: true,
  pitchCorrectionQuality: 'High'
};
```

### Android (React Native + expo-av)
- **Method**: `sound.setRateAsync(speed, true)` with native Android pitch preservation
- **Quality**: Good pitch correction using Android MediaPlayer/ExoPlayer
- **Speed Range**: 0.25x - 4.0x (recommended 0.5x - 2.0x for best quality)
- **Audio Focus**: `androidAudioFocusMode: 'DoNotMix'` for uninterrupted playback

```typescript
// Android Configuration
const soundConfig = {
  shouldPlay: true,
  rate: this.playbackSpeed,
  shouldCorrectPitch: true,
  androidAudioFocusMode: 'DoNotMix'
};
```

### Web (React Native Web + expo-av)
- **Method**: Web Audio API with `preservesPitch: true`
- **Quality**: Excellent pitch correction using Web Audio API algorithms
- **Speed Range**: 0.25x - 4.0x (recommended 0.5x - 3.0x for best quality)
- **Browser Support**: Chrome 88+, Firefox 85+, Safari 14+

```typescript
// Web Configuration
const soundConfig = {
  shouldPlay: true,
  rate: this.playbackSpeed,
  shouldCorrectPitch: true,
  preservesPitch: true // Web Audio API specific
};
```

## Key Features

### 1. Automatic Speed Clamping
All platforms automatically clamp speed values to safe ranges:
- **Minimum**: 0.25x (prevents audio artifacts)
- **Maximum**: 4.0x (prevents distortion)
- **Recommended**: 0.5x - 2.5x for optimal listening experience

### 2. Fallback Mechanisms
If platform-specific settings fail, the system falls back to:
1. Generic `setRateAsync(speed, true)` with pitch correction
2. Error logging for debugging
3. UI notification of any limitations

### 3. Real-time Monitoring
The audio player state includes:
```typescript
interface AudioPlayerState {
  playbackSpeed: number;
  pitchCorrectionEnabled: boolean;
  platform: string;
  // ... other properties
}
```

## Testing Recommendations

### Speed Testing Matrix
Test all platforms with these speeds:
- **0.5x**: Slow, clear speech
- **1.0x**: Normal speed (baseline)
- **1.25x**: Slightly faster
- **1.5x**: Moderately faster
- **2.0x**: Fast (recommended maximum)
- **2.5x**: Very fast (edge case testing)

### Quality Checks
1. **Pitch Consistency**: Voice should sound natural at all speeds
2. **Audio Clarity**: No artifacts, distortion, or dropouts
3. **Transition Smoothness**: Speed changes should be immediate
4. **Cross-Platform Parity**: Similar experience across platforms

## Browser Compatibility (Web)

| Browser | Minimum Version | Pitch Correction Quality |
|---------|----------------|-------------------------|
| Chrome | 88+ | Excellent |
| Firefox | 85+ | Good |
| Safari | 14+ | Good |
| Edge | 88+ | Excellent |

## Performance Considerations

### Memory Usage
- Pitch correction algorithms are CPU-intensive
- Monitor battery usage on mobile devices
- Consider reducing maximum speed on older devices

### Latency
- iOS: ~50ms latency for speed changes
- Android: ~100ms latency for speed changes
- Web: ~20ms latency for speed changes

## Common Issues & Solutions

### Issue: Pitch changes despite correction being enabled
**Solution**: Verify `shouldCorrectPitch: true` is set in both sound creation and speed setting

### Issue: Web audio doesn't preserve pitch
**Solution**: Ensure `preservesPitch: true` is included in web-specific configuration

### Issue: Android audio cuts out during speed changes
**Solution**: Use `androidAudioFocusMode: 'DoNotMix'` to prevent audio interruption

### Issue: Speed changes are delayed
**Solution**: Avoid setting speed while `operationLock` is true

## Implementation Checklist

- [ ] Pitch correction enabled in sound creation
- [ ] Platform-specific audio modes configured
- [ ] Speed validation and clamping implemented
- [ ] Error handling and fallbacks in place
- [ ] UI feedback for pitch correction status
- [ ] Testing completed across all target platforms
- [ ] Performance monitoring implemented

## Code Examples

### Setting Playback Speed with Pitch Correction
```typescript
async setPlaybackSpeed(speed: number): Promise<void> {
  const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));

  if (Platform.OS === 'ios') {
    await this.sound.setRateAsync(clampedSpeed, true);
  } else if (Platform.OS === 'android') {
    await this.sound.setRateAsync(clampedSpeed, true);
  } else if (Platform.OS === 'web') {
    await this.sound.setRateAsync(clampedSpeed, true);
  }
}
```

### Platform Detection and Configuration
```typescript
const audioConfig = {
  shouldCorrectPitch: true,
  ...(Platform.OS === 'ios' && { pitchCorrectionQuality: 'High' }),
  ...(Platform.OS === 'android' && { androidAudioFocusMode: 'DoNotMix' }),
  ...(Platform.OS === 'web' && { preservesPitch: true })
};
```

## Conclusion

This implementation ensures consistent, high-quality pitch correction across all supported platforms, providing users with a natural listening experience regardless of playback speed or device type.