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
} from '../types';

// Configure base URL for the AudioBookPython API
const API_BASE_URL = 'http://localhost:8080';

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
  getAllNovels: async (): Promise<Novel[]> => {
    const response: AxiosResponse<Novel[]> = await api.get('/novels');
    return response.data;
  },

  uploadEpub: async (file: FormData): Promise<Novel> => {
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
    const encodedName = encodeURIComponent(novelName);
    const response: AxiosResponse<ChapterContent> = await api.get(
      `/chapter?chapterNumber=${chapterNumber}&novelName=${encodedName}`
    );
    return response.data;
  },

  getDownloadChapterUrl: (
    novelName: string,
    chapterNumber: number,
    voice: string,
    dialogueVoice: string,
    progressId?: string
  ): string => {
    const encodedName = encodeURIComponent(novelName);
    let url = `${API_BASE_URL}/download-chapter/${encodedName}/${chapterNumber}?voice=${encodeURIComponent(voice)}&dialogue_voice=${encodeURIComponent(dialogueVoice)}`;
    if (progressId) {
      url += `&progress_id=${encodeURIComponent(progressId)}`;
    }
    return url;
  },

  getDownloadProgress: async (progressId: string): Promise<{ status: string; percent: number; total: number; current: number }> => {
    const response = await api.get(`/download/progress/${encodeURIComponent(progressId)}`);
    return response.data;
  },
};

// Text-to-Speech API
export const ttsAPI = {
  convertTextToSpeech: async (text: string, voice: string): Promise<Blob> => {
    const response: AxiosResponse<Blob> = await api.post(
      '/tts',
      { text, voice },
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
    novelName: string,
    lastChapterRead: number
  ): Promise<ProgressResponse> => {
    const response: AxiosResponse<ProgressResponse> = await api.post(
      '/user/progress',
      {
        username,
        novelName,
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

  getNovelProgress: async (
    novelName: string,
    username: string
  ): Promise<UserProgress> => {
    const encodedNovelName = encodeURIComponent(novelName);
    const encodedUsername = encodeURIComponent(username);
    const response: AxiosResponse<UserProgress> = await api.get(
      `/user/progress/${encodedNovelName}?username=${encodedUsername}`
    );
    return response.data;
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