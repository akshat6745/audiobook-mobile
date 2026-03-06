// Storage utility with fallback for when AsyncStorage isn't available
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory fallback storage for development
const memoryStorage: { [key: string]: string } = {};

class StorageService {
  private isAsyncStorageAvailable = true;

  constructor() {
    // Test if AsyncStorage is available
    this.testAsyncStorage();
  }

  private async testAsyncStorage() {
    try {
      await AsyncStorage.getItem('test');
    } catch (error) {
      console.warn('AsyncStorage not available, using memory fallback:', error);
      this.isAsyncStorageAvailable = false;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      if (this.isAsyncStorageAvailable) {
        return await AsyncStorage.getItem(key);
      } else {
        return memoryStorage[key] || null;
      }
    } catch (error) {
      console.warn(`Failed to get item ${key}, using memory fallback:`, error);
      this.isAsyncStorageAvailable = false;
      return memoryStorage[key] || null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (this.isAsyncStorageAvailable) {
        await AsyncStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
    } catch (error) {
      console.warn(`Failed to set item ${key}, using memory fallback:`, error);
      this.isAsyncStorageAvailable = false;
      memoryStorage[key] = value;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (this.isAsyncStorageAvailable) {
        await AsyncStorage.removeItem(key);
      } else {
        delete memoryStorage[key];
      }
    } catch (error) {
      console.warn(`Failed to remove item ${key}, using memory fallback:`, error);
      this.isAsyncStorageAvailable = false;
      delete memoryStorage[key];
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.isAsyncStorageAvailable) {
        await AsyncStorage.clear();
      } else {
        Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
      }
    } catch (error) {
      console.warn('Failed to clear storage, using memory fallback:', error);
      this.isAsyncStorageAvailable = false;
      Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
    }
  }
}

export const storage = new StorageService();
export default storage;