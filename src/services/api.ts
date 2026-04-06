import axios, { AxiosResponse } from 'axios';
import {
  Novel,
  ChapterListResponse,
  ChapterContent,
  User,
  AuthResponse,
  UserProgress,
  ProgressResponse,
  UserProgressResponse,
  DownloadRequest,
  DownloadResponse,
  DownloadStatus,
} from '../types';

// Configure base URL for the AudioBookPython API
const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor to handle connection errors gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNREFUSED' || error.code === 'NETWORK_ERROR') {
      console.warn('Backend not available, using demo mode');
      // Return mock data for demo purposes
      return Promise.reject(new Error('Backend not available - using demo mode'));
    }
    return Promise.reject(error);
  }
);

// Novel Management API
export const novelAPI = {
  getAllNovels: async (username?: string): Promise<Novel[]> => {
    const url = username ? `/novels?username=${encodeURIComponent(username)}` : '/novels';
    const response: AxiosResponse<Novel[]> = await api.get(url);
    return response.data;
  },

  uploadEpub: async (file: FormData, username?: string): Promise<Novel> => {
    if (username) {
      file.append('username', username);
    }
    const response: AxiosResponse<Novel> = await api.post('/upload-epub', file, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Chapter Management API
export const chapterAPI = {
  getChaptersList: async (
    novelName: string,
    page: number = 1
  ): Promise<ChapterListResponse> => {
    const encodedName = encodeURIComponent(novelName);
    const response: AxiosResponse<ChapterListResponse> = await api.get(
      `/chapters-with-pages/${encodedName}?page=${page}`
    );
    return response.data;
  },

  getChapterContent: async (
    chapterNumber: number,
    novelName: string
  ): Promise<ChapterContent> => {
    // Local-first: check for downloaded content before hitting the network
    try {
      const { offlineContentService } = await import('../services/offlineContentService');
      const offlineContent = await offlineContentService.getOfflineChapterContent(novelName, chapterNumber);
      if (offlineContent) {
        console.log('📖 Using offline chapter content for chapter', chapterNumber);
        return offlineContent;
      }
    } catch (offlineError) {
      console.warn('Offline content check failed, will try online:', offlineError);
    }

    // No offline content — fetch from API
    try {
      const encodedName = encodeURIComponent(novelName);
      const response: AxiosResponse<ChapterContent> = await api.get(
        `/chapter?chapterNumber=${chapterNumber}&novelName=${encodedName}`
      );
      return response.data;
    } catch (error) {
      console.warn('Online chapter content failed:', error);
      throw error;
    }
  },

};

// Text-to-Speech API
export const ttsAPI = {
  convertTextToSpeech: async (
    text: string,
    paragraphVoice: string,
    dialogueVoice: string
  ): Promise<Blob> => {
    const response: AxiosResponse<Blob> = await api.post(
      '/tts-dual-voice',
      { text, paragraphVoice, dialogueVoice },
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },

  getChapterAudioWithDualVoices: async (
    novelName: string,
    chapterNumber: number,
    voice: string,
    dialogueVoice: string
  ): Promise<Blob> => {
    const encodedName = encodeURIComponent(novelName);
    const response: AxiosResponse<Blob> = await api.get(
      `/novel-with-tts?novelName=${encodedName}&chapterNumber=${chapterNumber}&voice=${voice}&dialogueVoice=${dialogueVoice}`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },
};

// Images Management API
export const imageAPI = {
  getNovelImages: async (novelId: string): Promise<any> => {
    const response = await api.get(`/novel/${encodeURIComponent(novelId)}/images`);
    return response.data;
  },

  getNovelImageUrl: (novelId: string, imageId: string): string => {
    return `${API_BASE_URL}/novel/${encodeURIComponent(novelId)}/image/${encodeURIComponent(imageId)}`;
  },
};

// User Management API
export const userAPI = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response: AxiosResponse<AuthResponse> = await api.post('/userLogin', {
      username,
      password,
    });
    return response.data;
  },

  register: async (username: string, password: string): Promise<AuthResponse> => {
    const response: AxiosResponse<AuthResponse> = await api.post('/register', {
      username,
      password,
    });
    return response.data;
  },

  saveProgress: async (
    username: string,
    novelSlug: string,
    lastChapterRead: number
  ): Promise<ProgressResponse> => {
    const response: AxiosResponse<ProgressResponse> = await api.post(
      '/user/progress',
      {
        username,
        novelName: novelSlug,
        lastChapterRead,
      }
    );
    return response.data;
  },

  getUserProgress: async (username: string): Promise<UserProgress[]> => {
    const response: AxiosResponse<UserProgressResponse> = await api.get(
      `/user/progress?username=${encodeURIComponent(username)}`
    );
    return response.data.progress;
  },

  getUserProgressForNovel: async (
    novelName: string,
    username: string
  ): Promise<UserProgress> => {
    const response: AxiosResponse<UserProgress> = await api.get(
      `/user/progress/${encodeURIComponent(novelName)}?username=${encodeURIComponent(username)}`
    );
    return response.data;
  },
};

// Download Management API
export const downloadAPI = {
  startChapterDownload: async (request: DownloadRequest): Promise<DownloadResponse> => {
    const response: AxiosResponse<DownloadResponse> = await api.post('/download/chapter', request);
    return response.data;
  },

  getDownloadStatus: async (downloadId: string): Promise<DownloadStatus> => {
    const response: AxiosResponse<DownloadStatus> = await api.get(`/download/status/${downloadId}`);
    return response.data;
  },

  getDownloadFiles: async (downloadId: string): Promise<string[]> => {
    const response: AxiosResponse<string[]> = await api.get(`/download/${downloadId}/files`);
    return response.data;
  },

  getDownloadFileUrl: (downloadId: string, filename: string): string => {
    return `${API_BASE_URL}/download/${downloadId}/files/${filename}`;
  },
};

// Health check
export const healthAPI = {
  checkHealth: async (): Promise<{ status: string }> => {
    const response: AxiosResponse<{ status: string }> = await api.get('/health');
    return response.data;
  },
};

export default api;