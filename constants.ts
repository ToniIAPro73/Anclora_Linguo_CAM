
import { Language } from './types';

const env = import.meta.env;

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
export const ASR_MT_WS_URL = env.VITE_ASR_MT_WS_URL || 'ws://localhost:8001/ws/asr-mt';
export const ASR_MT_HTTP_URL = env.VITE_ASR_MT_HTTP_URL || 'http://localhost:8001';
export const ASR_WS_MAX_BUFFERED_BYTES = Number(env.VITE_ASR_WS_MAX_BUFFERED_BYTES || 262144);
export const AUDIO_CHUNK_FRAMES = 320;
export const VAD_THRESHOLD = 0.01;
export const VAD_MIN_SPEECH_MS = 220;
export const VAD_MIN_SILENCE_MS = 420;
export const VAD_MAX_SEGMENT_MS = 2400;
export const VAD_HANGOVER_MS = 120;
export const CALL_TOPOLOGY = env.VITE_CALL_TOPOLOGY || 'p2p';
export const SFU_JOIN_URL = env.VITE_SFU_JOIN_URL || '';
export const ENABLE_INSERTABLE_E2EE = env.VITE_ENABLE_INSERTABLE_E2EE === 'true';
export const REQUIRE_INSERTABLE_E2EE = env.VITE_REQUIRE_INSERTABLE_E2EE === 'true';
export const E2EE_SHARED_KEY = env.VITE_E2EE_SHARED_KEY || '';
export const ENABLE_LOCAL_MT_PRIVACY = env.VITE_ENABLE_LOCAL_MT_PRIVACY === 'true';
export const PEER_SERVER_HOST = env.VITE_PEER_SERVER_HOST || 'localhost';
export const PEER_SERVER_PORT = Number(env.VITE_PEER_SERVER_PORT || 9000);
export const PEER_SERVER_PATH = env.VITE_PEER_SERVER_PATH || '/peerjs';
export const PEER_SERVER_SECURE = env.VITE_PEER_SERVER_SECURE === 'true';
export const ICE_SERVERS = (() => {
  const raw = env.VITE_ICE_SERVERS;
  if (!raw) return [{ urls: 'stun:stun.l.google.com:19302' }];
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Invalid VITE_ICE_SERVERS JSON, using default STUN.', error);
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
})();

const toUrls = (entry: { urls: string | string[] }): string[] =>
  Array.isArray(entry.urls) ? entry.urls : [entry.urls];

export const HAS_TURN_SERVER = ICE_SERVERS.some((server) =>
  toUrls(server).some((url) => url.startsWith('turn:') || url.startsWith('turns:')),
);
