import { registerRootComponent } from 'expo';
import * as TrackPlayer from 'react-native-track-player/lib/src/trackPlayer';

import App from './App';
import { PlaybackService } from './src/services/PlaybackService';

TrackPlayer.registerPlaybackService(() => PlaybackService);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
