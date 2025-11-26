import React, { useState, useEffect, memo, useCallback } from 'react';
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
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
// import { BlurView } from 'expo-blur'; // Removed for compatibility
import { novelAPI } from '../services/api';
import { Novel, RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import Theme from '../styles/theme';

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

  const scrollY = new Animated.Value(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadNovels();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
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
        },
        {
          id: 'demo-4',
          title: 'Romance Under the Stars',
          author: 'Alice Johnson',
          chapterCount: 22,
          source: 'epub_upload'
        },
        {
          id: 'demo-5',
          title: 'The Ancient Prophecy',
          author: 'Robert Miller',
          chapterCount: 45,
          source: 'google_doc'
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

  const handleNovelPress = useCallback((novel: Novel) => {
    navigation.navigate('ChapterList', { novel });
  }, [navigation]);

  const getSourceIcon = (source: string) => {
    return source === 'epub_upload' ? 'book' : 'language';
  };

  const getSourceColor = (source: string) => {
    return source === 'epub_upload' ? Theme.colors.success[500] : Theme.colors.primary[500];
  };

  const renderNovel = ({ item, index }: { item: Novel; index: number }) => (
    <Animated.View
      style={[
        styles.novelCard,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })
          }]
        }
      ]}
    >
      <TouchableOpacity onPress={() => handleNovelPress(item)}>
        <LinearGradient
          colors={['#2a2a2a', '#252525']}
          style={styles.cardGradient}
        >
          <View style={styles.novelHeader}>
            <View style={[styles.sourceIcon, { backgroundColor: getSourceColor(item.source) }]}>
              <MaterialIcons name={getSourceIcon(item.source)} size={16} color={Theme.colors.neutral.white} />
            </View>
            <View style={styles.novelInfo}>
              <Text style={styles.novelTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.author && (
                <Text style={styles.novelAuthor} numberOfLines={1}>
                  by {item.author}
                </Text>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666" />
          </View>

          <View style={styles.novelFooter}>
            {item.chapterCount && (
              <View style={styles.chapterInfo}>
                <MaterialIcons name="menu-book" size={16} color="#999" />
                <Text style={styles.chapterCount}>
                  {item.chapterCount} chapters
                </Text>
              </View>
            )}
            <View style={[styles.sourceTag, { backgroundColor: getSourceColor(item.source) + '20' }]}>
              <Text style={[styles.sourceText, { color: getSourceColor(item.source) }]}>
                {item.source === 'epub_upload' ? 'EPUB' : 'WEB'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <MaterialIcons name="library-books" size={64} color="#666" />
      </View>
      <Text style={styles.emptyStateText}>
        {searchQuery ? 'No novels found matching your search' : 'No novels available'}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {searchQuery
          ? 'Try adjusting your search terms'
          : 'Novels will appear here once they\'re added to your library'
        }
      </Text>
    </View>
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[Theme.colors.primary[500], Theme.colors.primary[700]]}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color={Theme.colors.neutral.white} />
          <Text style={styles.loadingText}>Loading your library...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={[Theme.colors.primary[500], Theme.colors.primary[700]]}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>Welcome back, {user}!</Text>
            <Text style={styles.librarySubtext}>Your Audio Library</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={Theme.colors.neutral[400]} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search novels..."
            placeholderTextColor={Theme.colors.neutral[400]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <MaterialIcons name="clear" size={20} color={Theme.colors.neutral[400]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Novel List */}
      <FlatList
        data={filteredNovels}
        renderItem={renderNovel}
        keyExtractor={(item) => item.id || item.title}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary[500]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 50,
  },
  headerGradient: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.lg,
  },
  headerContent: {
    marginTop: Theme.spacing.sm,
  },
  welcomeText: {
    fontSize: Theme.typography.fontSizes['2xl'],
    fontWeight: Theme.typography.fontWeights.bold,
    color: Theme.colors.neutral.white,
    marginBottom: Theme.spacing.xs,
  },
  librarySubtext: {
    fontSize: Theme.typography.fontSizes.md,
    color: Theme.colors.neutral.white + 'DD',
  },
  searchSection: {
    marginTop: -Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.xl,
    ...Theme.shadows.md,
  },
  searchIcon: {
    marginRight: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Theme.typography.fontSizes.md,
    color: '#fff',
    paddingVertical: Theme.spacing.sm,
  },
  clearButton: {
    padding: Theme.spacing.xs,
  },
  listContainer: {
    flexGrow: 1,
    padding: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
  },
  novelCard: {
    marginBottom: Theme.spacing.md,
    borderRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
    ...Theme.shadows.md,
  },
  cardGradient: {
    padding: Theme.spacing.lg,
  },
  novelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.md,
  },
  sourceIcon: {
    width: 32,
    height: 32,
    borderRadius: Theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  novelInfo: {
    flex: 1,
  },
  novelTitle: {
    fontSize: Theme.typography.fontSizes.lg,
    fontWeight: Theme.typography.fontWeights.semibold,
    color: '#fff',
    marginBottom: Theme.spacing.xs,
    lineHeight: Theme.typography.lineHeights.tight * Theme.typography.fontSizes.lg,
  },
  novelAuthor: {
    fontSize: Theme.typography.fontSizes.sm,
    color: '#aaa',
  },
  novelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterCount: {
    fontSize: Theme.typography.fontSizes.xs,
    color: '#999',
    marginLeft: Theme.spacing.xs,
    fontWeight: Theme.typography.fontWeights.medium,
  },
  sourceTag: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.md,
  },
  sourceText: {
    fontSize: Theme.typography.fontSizes.xs,
    fontWeight: Theme.typography.fontWeights.bold,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: Theme.typography.fontSizes.lg,
    color: Theme.colors.neutral.white,
    fontWeight: Theme.typography.fontWeights.medium,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing['4xl'],
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  emptyStateText: {
    fontSize: Theme.typography.fontSizes.lg,
    fontWeight: Theme.typography.fontWeights.semibold,
    color: '#fff',
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: Theme.typography.fontSizes.md,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeights.relaxed * Theme.typography.fontSizes.md,
  },
});

export default NovelListScreen;