// API Types based on AudioBookPython API
export interface Novel {
  id: string | null;
  title: string;
  author: string | null;
  chapterCount: number | null;
  source: 'google_doc' | 'epub_upload';
}

export interface Chapter {
  chapterNumber: number;
  chapterTitle: string;
  link?: string;
  id?: string;
}

export interface ChapterContent {
  content: string[];
  chapterNumber?: number;
  chapterTitle?: string;
  timestamp?: string;
}

export interface Paragraph {
  text: string;
  index: number;
}

export interface ChapterListResponse {
  chapters: Chapter[];
  total_pages: number;
  current_page: number;
}

export interface User {
  username: string;
  password: string;
}

export interface UserProgress {
  novelName: string;
  lastChapterRead: number;
}

export interface AuthResponse {
  status: string;
  message: string;
}

export interface ProgressResponse {
  status: string;
  message: string;
}

export interface UserProgressResponse {
  progress: UserProgress[];
}

// Audio Player Types
export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  currentChapter?: Chapter;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  NovelList: undefined;
  ChapterList: { novel: Novel };
  Reader: { novel: Novel; chapter: Chapter };

  Profile: undefined;
};