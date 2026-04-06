/**
 * Download Validation Utilities
 * Ensures downloaded chapters are complete, valid, and not corrupted
 */

import * as FileSystem from 'expo-file-system/legacy';

export interface DownloadValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: string;
}

export class DownloadValidator {
  /**
   * Comprehensive validation of a downloaded chapter
   */
  static async validateDownload(
    downloadDir: string,
    expectedParagraphCount: number
  ): Promise<DownloadValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Check directory exists
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        errors.push(`Download directory does not exist: ${downloadDir}`);
        return {
          isValid: false,
          errors,
          warnings,
          summary: errors[0],
        };
      }

      // 2. Check content.json
      const contentPath = `${downloadDir}content.json`;
      const contentInfo = await FileSystem.getInfoAsync(contentPath);

      if (!contentInfo.exists) {
        errors.push('content.json not found');
      } else {
        try {
          const contentJson = await FileSystem.readAsStringAsync(contentPath);
          const content = JSON.parse(contentJson);

          if (!content.paragraphs || !Array.isArray(content.paragraphs)) {
            errors.push('content.json missing paragraphs array');
          } else if (content.paragraphs.length !== expectedParagraphCount) {
            errors.push(
              `Paragraph count mismatch: expected ${expectedParagraphCount}, ` +
              `got ${content.paragraphs.length}`
            );
          }

          if (!content.chapter_title && !content.chapterTitle) {
            warnings.push('content.json missing chapter_title');
          }
        } catch (parseError) {
          errors.push(`content.json is corrupted: ${parseError}`);
        }
      }

      // 3. Check title audio
      const titlePath = `${downloadDir}title.mp3`;
      const titleInfo = await FileSystem.getInfoAsync(titlePath);
      if (!titleInfo.exists) {
        warnings.push('title.mp3 not found');
      } else {
        const titleSize = 'size' in titleInfo ? (titleInfo as any).size : undefined;
        if (titleSize && titleSize < 1024) {
          errors.push(`title.mp3 is too small (${titleSize} bytes)`);
        }
      }

      // 4. Check all paragraph audio files
      let missingParagraphs: number[] = [];
      let smallFiles: { index: number; size: number }[] = [];

      for (let i = 0; i < expectedParagraphCount; i++) {
        const filePath = `${downloadDir}${i}.mp3`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (!fileInfo.exists) {
          missingParagraphs.push(i);
        } else {
          const fileSize = 'size' in fileInfo ? (fileInfo as any).size : undefined;
          if (fileSize && fileSize < 1024) {
            smallFiles.push({ index: i, size: fileSize });
          }
        }
      }

      if (missingParagraphs.length > 0) {
        errors.push(
          `Missing paragraph audio files: ${missingParagraphs.slice(0, 5).join(', ')}` +
          (missingParagraphs.length > 5 ? ` (and ${missingParagraphs.length - 5} more)` : '')
        );
      }

      if (smallFiles.length > 0) {
        errors.push(
          `Corrupted paragraph audio files: ${smallFiles
            .slice(0, 5)
            .map(f => `${f.index} (${f.size}b)`)
            .join(', ')}` +
          (smallFiles.length > 5 ? ` (and ${smallFiles.length - 5} more)` : '')
        );
      }

      // 5. Summary
      const isValid = errors.length === 0;
      let summary = '';

      if (isValid) {
        summary = `✅ Download complete: ${expectedParagraphCount} paragraphs + title + content`;
      } else {
        summary = `❌ Download incomplete: ${errors.length} critical issue(s)`;
        if (warnings.length > 0) {
          summary += `, ${warnings.length} warning(s)`;
        }
      }

      return {
        isValid,
        errors,
        warnings,
        summary,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        warnings,
        summary: `❌ Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Quick validation to check if a paragraph's audio file is usable
   */
  static async validateParagraphAudio(
    audioPath: string,
    paragraphIndex: number
  ): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(audioPath);

      if (!fileInfo.exists) {
        console.warn(`Audio file does not exist for paragraph ${paragraphIndex}: ${audioPath}`);
        return false;
      }

      const fileSize = 'size' in fileInfo ? (fileInfo as any).size : undefined;
      if (!fileSize || fileSize < 1024) {
        console.warn(`Audio file too small for paragraph ${paragraphIndex}: ${fileSize} bytes`);
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`Could not validate audio for paragraph ${paragraphIndex}:`, error);
      return false;
    }
  }

  /**
   * Get detailed download status/diagnostics
   */
  static async getDiagnostics(
    downloadDir: string
  ): Promise<{
    contentValid: boolean;
    audioFilesFound: number;
    audioFilesExpected: number;
    smallFiles: string[];
    missingFiles: string[];
    totalSize: number;
  }> {
    const diagnostics = {
      contentValid: false,
      audioFilesFound: 0,
      audioFilesExpected: 0,
      smallFiles: [] as string[],
      missingFiles: [] as string[],
      totalSize: 0,
    };

    try {
      // Check content.json
      const contentPath = `${downloadDir}content.json`;
      const contentInfo = await FileSystem.getInfoAsync(contentPath);

      if (contentInfo.exists) {
        const contentSize = 'size' in contentInfo ? (contentInfo as any).size : undefined;
        if (contentSize) {
          diagnostics.totalSize += contentSize;
        }
        try {
          const contentJson = await FileSystem.readAsStringAsync(contentPath);
          const content = JSON.parse(contentJson);
          diagnostics.contentValid = !!content.paragraphs;
          diagnostics.audioFilesExpected = (content.paragraphs || []).length + 1; // +1 for title
        } catch (e) {
          // Content is invalid
        }
      }

      // Check audio files
      const dirFiles = await FileSystem.readDirectoryAsync(downloadDir);
      for (const file of dirFiles) {
        if (file.endsWith('.mp3')) {
          const filePath = `${downloadDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);

          if (fileInfo.exists) {
            const fileSize = 'size' in fileInfo ? (fileInfo as any).size : undefined;
            if (fileSize) {
              diagnostics.audioFilesFound++;
              diagnostics.totalSize += fileSize;

              if (fileSize < 1024) {
                diagnostics.smallFiles.push(`${file} (${fileSize}b)`);
              }
            }
          }
        }
      }

      // Check for missing files
      if (diagnostics.audioFilesExpected > 0) {
        const expectedFiles = ['title.mp3'];
        for (let i = 0; i < diagnostics.audioFilesExpected - 1; i++) {
          expectedFiles.push(`${i}.mp3`);
        }

        for (const expectedFile of expectedFiles) {
          const filePath = `${downloadDir}${expectedFile}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (!fileInfo.exists) {
            diagnostics.missingFiles.push(expectedFile);
          }
        }
      }

      return diagnostics;
    } catch (error) {
      console.warn('Error getting diagnostics:', error);
      return diagnostics;
    }
  }
}

export default DownloadValidator;
