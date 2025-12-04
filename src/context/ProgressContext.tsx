import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { userAPI } from '../services/api';
import { useAuth } from './AuthContext';

interface ProgressContextType {
  progressMap: Record<string, number>;
  isLoading: boolean;
  refreshProgress: () => Promise<void>;
  updateProgress: (novelTitle: string, chapterNumber: number) => Promise<void>;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

interface ProgressProviderProps {
  children: ReactNode;
}

export const ProgressProvider: React.FC<ProgressProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchProgress = useCallback(async () => {
    if (!user) {
      setProgressMap({});
      return;
    }

    try {
      setIsLoading(true);
      const progressList = await userAPI.getUserProgress(user);
      const newProgressMap: Record<string, number> = {};
      progressList.forEach(p => {
        newProgressMap[p.novelName] = p.lastChapterRead;
      });
      setProgressMap(newProgressMap);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch progress when user changes
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const updateProgress = useCallback(async (novelTitle: string, chapterNumber: number) => {
    if (!user) return;

    // Optimistic update
    setProgressMap(prev => ({
      ...prev,
      [novelTitle]: chapterNumber
    }));

    try {
      await userAPI.saveProgress(user, novelTitle, chapterNumber);
    } catch (error) {
      console.error('Error saving progress:', error);
      // Optionally revert state here if strict consistency is needed
      // For progress tracking, silent failure with optimistic update is usually acceptable
      // or we could trigger a re-fetch
    }
  }, [user]);

  return (
    <ProgressContext.Provider
      value={{
        progressMap,
        isLoading,
        refreshProgress: fetchProgress,
        updateProgress
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
};
