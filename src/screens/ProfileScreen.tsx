import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { UserProgress } from '../types';

const ProfileScreen: React.FC = () => {
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) {
      loadUserProgress();
    }
  }, [user]);

  const loadUserProgress = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const progress = await userAPI.getUserProgress(user);
      setUserProgress(progress);
    } catch (error) {
      console.error('Error loading user progress:', error);
      Alert.alert('Error', 'Failed to load reading progress.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout, style: 'destructive' },
      ]
    );
  };

  const renderProgressItem = (progress: UserProgress, index: number) => (
    <View key={index} style={styles.progressCard}>
      <View style={styles.progressInfo}>
        <Text style={styles.novelTitle} numberOfLines={2}>
          {progress.novelName}
        </Text>
        <Text style={styles.chapterProgress}>
          Last read: Chapter {progress.lastChapterRead}
        </Text>
      </View>
      <MaterialIcons name="book" size={24} color="#2196F3" />
    </View>
  );

  const renderEmptyProgress = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="library-books" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>No reading progress yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Start reading novels to track your progress here
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileIcon}>
          <MaterialIcons name="person" size={48} color="#fff" />
        </View>
        <Text style={styles.username}>{user}</Text>
        <Text style={styles.userType}>AudioBook Reader</Text>
      </View>

      {/* Reading Progress Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading Progress</Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2196F3" />
            <Text style={styles.loadingText}>Loading progress...</Text>
          </View>
        ) : userProgress.length > 0 ? (
          <View style={styles.progressList}>
            {userProgress.map(renderProgressItem)}
          </View>
        ) : (
          renderEmptyProgress()
        )}
      </View>

      {/* Statistics Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="menu-book" size={32} color="#2196F3" />
            <Text style={styles.statNumber}>{userProgress.length}</Text>
            <Text style={styles.statLabel}>Novels Started</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialIcons name="bookmark" size={32} color="#4CAF50" />
            <Text style={styles.statNumber}>
              {userProgress.reduce((total, novel) => total + novel.lastChapterRead, 0)}
            </Text>
            <Text style={styles.statLabel}>Chapters Read</Text>
          </View>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity style={styles.settingItem} onPress={loadUserProgress}>
          <View style={styles.settingLeft}>
            <MaterialIcons name="refresh" size={24} color="#666" />
            <Text style={styles.settingText}>Refresh Progress</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <MaterialIcons name="info" size={24} color="#666" />
            <Text style={styles.settingText}>About</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, styles.logoutItem]}
          onPress={handleLogout}
        >
          <View style={styles.settingLeft}>
            <MaterialIcons name="logout" size={24} color="#f44336" />
            <Text style={[styles.settingText, styles.logoutText]}>Logout</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>AudioBook Reader v1.0.0</Text>
        <Text style={styles.appInfoSubtext}>
          Built with React Native & Expo
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  profileIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userType: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  progressList: {
    gap: 10,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  progressInfo: {
    flex: 1,
  },
  novelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  chapterProgress: {
    fontSize: 14,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#f44336',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 10,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  appInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  appInfoSubtext: {
    fontSize: 12,
    color: '#888',
  },
});

export default ProfileScreen;