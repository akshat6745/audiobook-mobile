# AudioBook Reader - React Native

A cross-platform audiobook application built with React Native and Expo that works on iOS, Android, and Web. This app integrates with the AudioBookPython backend to provide text-to-speech functionality, user authentication, and reading progress tracking.

## Features

### 📱 Cross-Platform Support
- **iOS App**: Native iOS experience with optimized performance
- **Android App**: Native Android experience with material design
- **Web App**: Progressive Web App that works in any modern browser

### 📚 Core Functionality
- **Novel Library**: Browse and search through available novels
- **Chapter Reading**: Clean, customizable reading interface with font size and theme controls
- **Audio Playback**: AI-generated text-to-speech with dual voice support for dialogue
- **Progress Tracking**: Automatic saving of reading progress across devices
- **User Authentication**: Secure login and registration system

### 🎧 Advanced Audio Features
- **Dual Voice TTS**: Different voices for narrative and dialogue
- **Playback Controls**: Play, pause, skip forward/backward (30s)
- **Speed Control**: Adjustable playback speed from 0.5x to 2.0x
- **Background Playback**: Continue listening while using other apps

### 🎨 User Experience
- **Dark/Light Themes**: Toggle between light and dark reading modes
- **Responsive Design**: Optimized for phones, tablets, and desktop browsers
- **Offline Capabilities**: Downloaded audio files work without internet
- **Progress Sync**: Reading progress syncs across all platforms

## Prerequisites

Before running this application, ensure you have:

1. **Node.js** (v16 or higher)
2. **npm** or **yarn** package manager
3. **Expo CLI** installed globally: `npm install -g expo-cli`
4. **AudioBookPython Backend** running (see backend setup below)

For mobile development:
- **iOS**: Xcode and iOS Simulator (macOS only)
- **Android**: Android Studio and Android Emulator

## Backend Setup

This app requires the AudioBookPython backend to be running. Ensure the backend is:

1. **Running on the correct port**: Default is `http://localhost:8080`
2. **API endpoints available**: All endpoints from the AudioBookPython API documentation
3. **CORS configured**: Allow requests from your development domain

Update the API base URL in `src/services/api.ts` if your backend is hosted elsewhere:

```typescript
const API_BASE_URL = 'http://localhost:8080'; // Change this to your API URL
```

## Installation & Setup

1. **Clone the repository** (if not already created):
   ```bash
   cd audiobook-mobile
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API endpoint** (if needed):
   Edit `src/services/api.ts` and update the `API_BASE_URL` constant.

4. **Start the development server**:
   ```bash
   npm start
   ```

## Running on Different Platforms

### 📱 Mobile Development

**iOS (macOS only):**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

**Using Expo Go App:**
1. Install Expo Go on your mobile device
2. Run `npm start`
3. Scan the QR code with your device

### 🌐 Web Development

```bash
npm run web
```

The web app will be available at `http://localhost:19006`

### 📦 Building for Production

**Web Build:**
```bash
npx expo export:web
```

**Mobile Builds:**
```bash
# Build for iOS (requires macOS and Xcode)
npx expo build:ios

# Build for Android
npx expo build:android

# Or use EAS Build (recommended)
npx eas build --platform all
```

## Project Structure

```
audiobook-mobile/
├── src/
│   ├── components/          # Reusable UI components
│   ├── context/            # React Context for state management
│   │   └── AuthContext.tsx # User authentication context
│   ├── navigation/         # Navigation configuration
│   │   └── AppNavigator.tsx # Main app navigation
│   ├── screens/           # App screens
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── NovelListScreen.tsx
│   │   ├── ChapterListScreen.tsx
│   │   ├── ReaderScreen.tsx
│   │   ├── AudioPlayerScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── services/          # API and external services
│   │   └── api.ts        # AudioBookPython API integration
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   └── utils/            # Utility functions
├── assets/               # Images, fonts, and other assets
├── App.tsx              # Main app component
├── app.json             # Expo configuration
└── package.json         # Dependencies and scripts
```

## Key Dependencies

### Core Framework
- **React Native**: Cross-platform mobile framework
- **Expo**: Development platform and tools
- **TypeScript**: Type-safe development

### Navigation
- **@react-navigation/native**: Navigation library
- **@react-navigation/stack**: Stack navigation
- **@react-navigation/bottom-tabs**: Tab navigation

### Audio & Media
- **expo-av**: Audio playback and recording
- **expo-file-system**: File system operations

### UI & Styling
- **react-native-paper**: Material Design components
- **expo-linear-gradient**: Gradient backgrounds
- **@expo/vector-icons**: Icon library

### Networking & Storage
- **axios**: HTTP client for API requests
- **expo-secure-store**: Secure storage for user credentials

## Configuration

### API Configuration

The app is configured to work with the AudioBookPython backend. Key configuration points:

1. **API Base URL**: Set in `src/services/api.ts`
2. **Request Timeout**: 30 seconds (configurable)
3. **Audio Caching**: Downloaded audio files are cached locally

### App Configuration

Key settings in `app.json`:

```json
{
  "expo": {
    "name": "AudioBook Reader",
    "platforms": ["ios", "android", "web"],
    "ios": {
      "bundleIdentifier": "com.audiobook.reader"
    },
    "android": {
      "package": "com.audiobook.reader"
    }
  }
}
```

## API Integration

The app integrates with these AudioBookPython API endpoints:

### Authentication
- `POST /userLogin` - User login
- `POST /register` - User registration

### Novel Management
- `GET /novels` - Get all available novels
- `POST /upload-epub` - Upload EPUB files (future feature)

### Chapter Management
- `GET /chapters-with-pages/{novel_name}` - Get chapter list
- `GET /chapter` - Get chapter content

### Text-to-Speech
- `POST /tts` - Convert text to speech
- `GET /novel-with-tts` - Get chapter audio with dual voices

### Progress Tracking
- `POST /user/progress` - Save reading progress
- `GET /user/progress` - Get user's progress
- `GET /user/progress/{novel_name}` - Get progress for specific novel

## Troubleshooting

### Common Issues

1. **API Connection Errors**:
   - Ensure AudioBookPython backend is running
   - Check the API_BASE_URL in `src/services/api.ts`
   - Verify CORS configuration on the backend

2. **Audio Playback Issues**:
   - Check device audio permissions
   - Ensure backend TTS endpoints are working
   - Verify audio file generation and download

3. **Platform-Specific Issues**:
   - **iOS**: Ensure Xcode is properly configured
   - **Android**: Check Android SDK and emulator setup
   - **Web**: Clear browser cache and localStorage

### Development Tips

1. **Hot Reload**: Use `npm start` for fastest development cycle
2. **Debugging**: Use React Native Debugger or browser dev tools
3. **Testing**: Test on multiple platforms regularly
4. **Performance**: Monitor memory usage with audio playback

## Contributing

When contributing to this project:

1. Follow the existing code style and TypeScript conventions
2. Test on multiple platforms before submitting changes
3. Update this README if adding new features or dependencies
4. Ensure API integration remains compatible with AudioBookPython backend

## Future Enhancements

Potential improvements for future versions:

- **Offline Reading**: Download chapters for offline reading
- **Bookmarks**: Save specific positions within chapters
- **Reading Statistics**: Track reading time and habits
- **Social Features**: Share reading progress with friends
- **Voice Customization**: More TTS voice options
- **Accessibility**: Enhanced support for screen readers
- **Sync Across Devices**: Cloud-based progress synchronization

## License

This project is created as a companion app to the AudioBookPython backend. Please refer to the main project's license terms.

## Support

For technical support or questions:

1. Check this README for configuration issues
2. Review the AudioBookPython API documentation
3. Check backend service status and logs
4. Verify mobile platform development environment setup

---

**Built with ❤️ using React Native & Expo**