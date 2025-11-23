# AudioBook Reader - Troubleshooting Guide

## Common Issues and Solutions

### 1. "Problem running the requested app" on Simulator

This error can occur for several reasons. Try these solutions in order:

#### Solution 1: Clear Cache and Restart
```bash
# Clear Metro cache
npx expo start --clear

# Or clear all caches
npx expo start -c --no-dev --minify
```

#### Solution 2: Check Package Compatibility
```bash
# Fix dependency versions
npx expo install --fix

# Install latest compatible versions
npx expo install
```

#### Solution 3: Reset Metro Bundler
```bash
# Kill any existing processes
pkill -f "expo start"
pkill -f "metro"

# Start fresh
npm start
```

#### Solution 4: Simulator-Specific Issues

**For iOS Simulator:**
1. Open Xcode
2. Go to Window > Devices and Simulators
3. Delete current simulator
4. Create a new iOS simulator
5. Try running the app again

**For Android Emulator:**
1. Open Android Studio
2. Go to Tools > AVD Manager
3. Wipe data on your emulator
4. Cold boot the emulator
5. Try running the app again

#### Solution 5: Check TypeScript Compilation
```bash
# Check for TypeScript errors
npx tsc --noEmit

# If errors, fix them before running
```

### 2. Backend Connection Issues

The app includes demo mode for when the AudioBookPython backend is not available:

#### Demo Login Credentials
- **Username:** demo
- **Password:** demo

This will allow you to explore all app features with demo data.

#### Real Backend Setup
1. Ensure AudioBookPython is running on `localhost:8080`
2. Check CORS configuration allows your app
3. Test API endpoints manually:
   ```bash
   curl http://localhost:8080/health
   ```

### 3. Metro Bundler Issues

#### Port Conflicts
```bash
# Kill processes using port 8081
lsof -ti:8081 | xargs kill -9

# Start with different port
npx expo start --port 8082
```

#### JavaScript Heap Out of Memory
```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
npm start
```

### 4. Platform-Specific Issues

#### Web Platform
```bash
# Install web dependencies if missing
npx expo install react-dom react-native-web

# Start web version
npm run web
```

#### iOS Issues
- Ensure Xcode is installed and updated
- Check iOS Simulator is properly configured
- Verify Apple Developer tools are installed

#### Android Issues
- Check Android Studio setup
- Verify ANDROID_HOME environment variable
- Ensure emulator has enough storage space

### 5. Navigation Issues

If you see navigation-related errors:
```bash
# Install navigation dependencies
npx expo install react-native-screens react-native-safe-area-context
npx expo install react-native-gesture-handler
```

For iOS, you may need to run:
```bash
cd ios && pod install && cd ..
```

### 6. Development Tips

#### Real-time Debugging
1. Open the app in your browser/simulator
2. Open developer console (press `j` in terminal)
3. Enable remote debugging
4. Check console for specific errors

#### Performance Issues
- Use `npm run web` for fastest iteration
- Enable Fast Refresh in Expo Dev Tools
- Use physical device instead of simulator for audio testing

### 7. Quick Fixes

#### Reset Everything
```bash
# Nuclear option - reset everything
rm -rf node_modules package-lock.json
npm install
npx expo start --clear
```

#### Check Expo CLI Version
```bash
# Update Expo CLI if outdated
npm install -g @expo/cli@latest
```

### 8. Getting Help

If none of these solutions work:

1. **Check Expo Status:** https://status.expo.dev/
2. **Expo Documentation:** https://docs.expo.dev/
3. **React Native Documentation:** https://reactnative.dev/docs/troubleshooting

#### Reporting Issues

When reporting issues, include:
- Exact error message
- Platform (iOS/Android/Web)
- Expo SDK version
- Node.js version
- Steps to reproduce

#### Useful Commands for Debugging
```bash
# Check versions
expo --version
node --version
npm --version

# View detailed logs
npx expo start --no-dev --minify

# Check for common issues
npx expo doctor
```

### 9. Demo Mode Features

When running without the backend, the app provides:

- **3 Demo Novels** with realistic metadata
- **Demo Chapters** with sample content
- **Audio Player Demo** with simulated playback
- **Progress Tracking** (local storage only)
- **All UI Features** fully functional

This allows you to test all app functionality without needing the backend server.

### 10. Production Deployment

When ready for production:

1. Update API_BASE_URL in `src/services/api.ts`
2. Configure app.json with your bundle identifiers
3. Build for your target platforms:
   ```bash
   # Web
   npx expo export:web

   # Mobile (requires EAS)
   npx eas build --platform all
   ```

---

**Remember:** The app is designed to work both with and without the AudioBookPython backend, so you can explore all features even if you encounter backend connection issues.