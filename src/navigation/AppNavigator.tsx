import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import NovelListScreen from '../screens/NovelListScreen';
import ChapterListScreen from '../screens/ChapterListScreen';
import ReaderScreen from '../screens/ReaderScreen';
import AudioPlayerScreen from '../screens/AudioPlayerScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Icons
import { MaterialIcons } from '@expo/vector-icons';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap;

          if (route.name === 'Novels') {
            iconName = 'library-books';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          } else {
            iconName = 'book';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Novels"
        component={NovelListScreen}
        options={{ title: 'My Library' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

const AuthStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Login' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
    </Stack.Navigator>
  );
};

const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChapterList"
        component={ChapterListScreen}
        options={({ route }) => ({
          title: (route.params as any)?.novel?.title || 'Chapters'
        })}
      />
      <Stack.Screen
        name="Reader"
        component={ReaderScreen}
        options={({ route }) => ({
          title: (route.params as any)?.chapter?.chapterTitle || 'Reading'
        })}
      />
      <Stack.Screen
        name="AudioPlayer"
        component={AudioPlayerScreen}
        options={({ route }) => ({
          title: (route.params as any)?.chapter?.chapterTitle || 'Audio Player'
        })}
      />
    </Stack.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // You can create a loading screen component here
    return null;
  }

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;