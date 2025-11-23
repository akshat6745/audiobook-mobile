import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types';
import Theme from '../styles/theme';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const success = await login(username, password);
    if (!success) {
      Alert.alert(
        'Login Failed',
        'Invalid credentials. Try demo/demo for demo mode.',
        [
          { text: 'Try Demo', onPress: () => handleDemoLogin() },
          { text: 'OK' }
        ]
      );
    }
  };

  const handleDemoLogin = () => {
    setUsername('demo');
    setPassword('demo');
  };

  const navigateToRegister = () => {
    navigation.navigate('Register');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[Theme.colors.primary[400], Theme.colors.primary[600], Theme.colors.primary[800]]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              {/* App Icon */}
              <View style={styles.iconContainer}>
                <View style={styles.appIcon}>
                  <MaterialIcons name="headset" size={48} color={Theme.colors.primary[600]} />
                </View>
              </View>

              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.title}>AudioBook Reader</Text>
                <Text style={styles.subtitle}>Sign in to continue your reading journey</Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons
                      name="person"
                      size={20}
                      color={Theme.colors.neutral[400]}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Username"
                      placeholderTextColor={Theme.colors.neutral[400]}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons
                      name="lock"
                      size={20}
                      color={Theme.colors.neutral[400]}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor={Theme.colors.neutral[400]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                    >
                      <MaterialIcons
                        name={showPassword ? "visibility" : "visibility-off"}
                        size={20}
                        color={Theme.colors.neutral[400]}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={[Theme.colors.accent[400], Theme.colors.accent[600]]}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isLoading ? (
                      <View style={styles.loadingContainer}>
                        <Text style={styles.buttonText}>Signing In...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>Sign In</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Demo Mode */}
                <View style={styles.demoContainer}>
                  <Text style={styles.demoText}>Try the demo:</Text>
                  <TouchableOpacity
                    onPress={handleDemoLogin}
                    style={styles.demoButton}
                  >
                    <Text style={styles.demoButtonText}>Use Demo Login</Text>
                  </TouchableOpacity>
                </View>

                {/* Register Link */}
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={navigateToRegister}
                >
                  <Text style={styles.linkText}>
                    Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.lg,
  },
  content: {
    paddingVertical: Theme.spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  appIcon: {
    width: 100,
    height: 100,
    borderRadius: Theme.borderRadius['2xl'],
    backgroundColor: Theme.colors.neutral.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.xl,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing['3xl'],
  },
  title: {
    fontSize: Theme.typography.fontSizes['4xl'],
    fontWeight: Theme.typography.fontWeights.bold,
    color: Theme.colors.neutral.white,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontSize: Theme.typography.fontSizes.md,
    color: Theme.colors.neutral.white + 'DD',
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeights.relaxed * Theme.typography.fontSizes.md,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: Theme.spacing.lg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.neutral.white,
    borderRadius: Theme.borderRadius.xl,
    paddingHorizontal: Theme.spacing.md,
    ...Theme.shadows.md,
  },
  inputIcon: {
    marginRight: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    fontSize: Theme.typography.fontSizes.md,
    color: Theme.colors.neutral[800],
  },
  eyeButton: {
    padding: Theme.spacing.sm,
  },
  button: {
    borderRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadows.lg,
  },
  buttonGradient: {
    paddingVertical: Theme.spacing.md + 2,
    paddingHorizontal: Theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Theme.colors.neutral.white,
    fontSize: Theme.typography.fontSizes.lg,
    fontWeight: Theme.typography.fontWeights.semibold,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  demoContainer: {
    alignItems: 'center',
    marginVertical: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.neutral.white + '30',
  },
  demoText: {
    color: Theme.colors.neutral.white + 'DD',
    fontSize: Theme.typography.fontSizes.sm,
    marginBottom: Theme.spacing.sm,
  },
  demoButton: {
    backgroundColor: Theme.colors.neutral.white + '20',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.neutral.white + '40',
  },
  demoButtonText: {
    color: Theme.colors.neutral.white,
    fontSize: Theme.typography.fontSizes.sm,
    fontWeight: Theme.typography.fontWeights.medium,
  },
  linkButton: {
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
  },
  linkText: {
    color: Theme.colors.neutral.white + 'DD',
    fontSize: Theme.typography.fontSizes.md,
    textAlign: 'center',
  },
  linkTextBold: {
    fontWeight: Theme.typography.fontWeights.bold,
    color: Theme.colors.neutral.white,
  },
});

export default LoginScreen;