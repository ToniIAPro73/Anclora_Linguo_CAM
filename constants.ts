
import { Language } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ru', name: 'Russian' }
];

export const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
export const SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
export const FRAME_RATE = 1; // Frames per second for visual context
export const JPEG_QUALITY = 0.6;
