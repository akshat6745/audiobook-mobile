// API Types based on AudioBookPython API
export interface Novel {
  id: string;
  title: string;
  author: string | null;
  chapterCount: number | null;
  source: 'cloudflare_d1' | 'google_doc' | 'epub_upload';
  slug: string;
  description: string | null;
  isPublic?: boolean;
}

export interface Chapter {
  chapterNumber: number;
  chapterTitle: string;
  link?: string;
  id?: string;
  wordCount?: number;
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
  lastReadDate?: string;
}

export interface AuthResponse {
  status: string;
  message: string;
}

export interface ProgressResponse {
  status: string;
  message: string;
  lastReadDate?: string;
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

// Download Types
export interface DownloadRequest {
  novel_name: string;
  chapter_number: number;
  narrator_voice: string;
  dialogue_voice: string;
}

export interface DownloadResponse {
  download_id: string;
  status: string;
  message: string;
}

export interface DownloadStatus {
  download_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  total_files: number;
  completed_files: number;
  error_message?: string;
  files?: {
    content?: string;
    audio?: {
      title?: string;
      paragraphs?: string[];
    };
  };
}

export interface DownloadedChapter {
  downloadId: string;
  novelName: string;
  chapterNumber: number;
  chapterTitle?: string;
  status: DownloadStatus['status'];
  progress: number;
  downloadDate: string;
  totalFiles: number;
  completedFiles: number;
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
  Downloads: undefined;
  Profile: undefined;
};