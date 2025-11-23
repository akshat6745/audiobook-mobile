import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { novelAPI } from '../services/api';
import { Novel, RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';

type NovelListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'NovelList'>;

interface Props {
  navigation: NovelListScreenNavigationProp;
}

const NovelListScreen: React.FC<Props> = ({ navigation }) => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [filteredNovels, setFilteredNovels] = useState<Novel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadNovels();
  }, []);

  useEffect(() => {
    filterNovels();
  }, [searchQuery, novels]);

  const loadNovels = async () => {
    try {
      setIsLoading(true);
      const novelsData = await novelAPI.getAllNovels();
      setNovels(novelsData);
      setFilteredNovels(novelsData);
    } catch (error) {
      console.error('Error loading novels:', error);

      // Load demo data if backend is not available
      const demoNovels: Novel[] = [
        {
          id: 'demo-1',
          title: 'The Great Adventure',
          author: 'Demo Author',
          chapterCount: 25,
          source: 'epub_upload'
        },
        {
          id: 'demo-2',
          title: 'Mystery of the Lost City',
          author: 'Jane Smith',
          chapterCount: 18,
          source: 'google_doc'
        },
        {
          id: 'demo-3',
          title: 'Science Fiction Chronicles',
          author: 'John Doe',
          chapterCount: 32,
          source: 'epub_upload'
        }
      ];

      setNovels(demoNovels);
      setFilteredNovels(demoNovels);

      Alert.alert(
        'Demo Mode',
        'Backend not available. Loading demo novels for testing.\n\nTo use real data, ensure AudioBookPython backend is running on localhost:8080'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNovels();
    setRefreshing(false);
  };

  const filterNovels = () => {
    if (!searchQuery.trim()) {
      setFilteredNovels(novels);
      return;
    }

    const filtered = novels.filter(
      (novel) =>
        novel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (novel.author && novel.author.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredNovels(filtered);
  };

  const handleNovelPress = (novel: Novel) => {
    navigation.navigate('ChapterList', { novel });
  };

  const renderNovel = ({ item }: { item: Novel }) => (
    <TouchableOpacity style={styles.novelCard} onPress={() => handleNovelPress(item)}>
      <View style={styles.novelInfo}>
        <Text style={styles.novelTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.author && (
          <Text style={styles.novelAuthor} numberOfLines={1}>
            by {item.author}
          </Text>
        )}
        <View style={styles.novelMeta}>
          {item.chapterCount && (
            <Text style={styles.chapterCount}>
              {item.chapterCount} chapters
            </Text>
          )}
          <View style={styles.sourceTag}>
            <Text style={styles.sourceText}>
              {item.source === 'epub_upload' ? 'EPUB' : 'WEB'}
            </Text>
          </View>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#666" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="library-books" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>
        {searchQuery ? 'No novels found matching your search' : 'No novels available'}
      </Text>
      {!searchQuery && (
        <Text style={styles.emptyStateSubtext}>
          Novels will appear here once they're added to your library
        </Text>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading your library...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back, {user}!</Text>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search novels..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="clear" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredNovels}
        renderItem={renderNovel}
        keyExtractor={(item) => item.title}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  listContainer: {
    flexGrow: 1,
    padding: 15,
  },
  novelCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  novelInfo: {
    flex: 1,
  },
  novelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  novelAuthor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  novelMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterCount: {
    fontSize: 12,
    color: '#888',
  },
  sourceTag: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

export default NovelListScreen;