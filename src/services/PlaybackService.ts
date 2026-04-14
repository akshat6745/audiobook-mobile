// Import from internal module to avoid barrel export that triggers Capability enum
// initializer (crashes under New Architecture when native constants are null).
import * as TrackPlayer from 'react-native-track-player/lib/src/trackPlayer';

/**
 * RNTP playback service — registered once at app startup.
 *
 * Uses string event names instead of the Event enum to avoid importing
 * native constants at module evaluation time (crashes under New Architecture).
 */
export async function PlaybackService() {
  TrackPlayer.addEventListener('remote-play' as any, () => TrackPlayer.play());
  TrackPlayer.addEventListener('remote-pause' as any, () => TrackPlayer.pause());
  TrackPlayer.addEventListener('remote-stop' as any, () => TrackPlayer.stop());

  TrackPlayer.addEventListener('remote-duck' as any, async (event: any) => {
    if (event.paused) {
      await TrackPlayer.pause();
    } else if (event.permanent) {
      await TrackPlayer.stop();
    } else {
      await TrackPlayer.play();
    }
  });
}
