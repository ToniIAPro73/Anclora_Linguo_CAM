import React, { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'peerjs';
import {
  SUPPORTED_LANGUAGES,
  SAMPLE_RATE,
  ASR_MT_WS_URL,
  ASR_MT_HTTP_URL,
  AUDIO_CHUNK_FRAMES,
  VAD_THRESHOLD,
  VAD_MIN_SPEECH_MS,
  VAD_MIN_SILENCE_MS,
  VAD_MAX_SEGMENT_MS,
  VAD_HANGOVER_MS,
  CALL_TOPOLOGY,
  SFU_JOIN_URL,
  ENABLE_INSERTABLE_E2EE,
  REQUIRE_INSERTABLE_E2EE,
  E2EE_SHARED_KEY,
  PEER_SERVER_HOST,
  PEER_SERVER_PORT,
  PEER_SERVER_PATH,
  PEER_SERVER_SECURE,
  ICE_SERVERS,
  HAS_TURN_SERVER,
} from './constants';
import { CallStatus } from './types';
import { useWebRtcStats } from './hooks/useWebRtcStats';
import { useStreamingTranslation } from './hooks/useStreamingTranslation';
import { useRecording } from './hooks/useRecording';
import CallHeader from './components/CallHeader';
import CallSetup from './components/CallSetup';
import ChatSidebar from './components/ChatSidebar';
import VideoGrid from './components/VideoGrid';
import ControlBar from './components/ControlBar';
import SettingsModal from './components/SettingsModal';
import {
  buildInviteLink,
  extractRoomCode,
  normalizeRoomCode,
  shouldInitiateCall,
  stopMediaStream,
} from './utils/callSession';
import { toSrt, toVtt, TranscriptEntry } from './utils/transcript';
import { applyInsertableE2EE, supportsInsertableStreams } from './utils/e2ee';

interface ChatMessage {
  id: string;
  sender: 'me' | 'peer';
  text: string;
  translatedText?: string;
  timestamp: number;
}

interface QualityProfile {
  label: string;
  width: number;
  height: number;
  maxBitrate: number;
}

interface SessionInfo {
  token: string;
  userId: string;
  displayName: string;
  role: 'agent' | 'investor';
  expiresAt: number;
}

interface ConsentResponse {
  status: string;
  consent_id: string;
}

interface UsageSummary {
  translated_chars: number;
  tts_chars: number;
  translated_limit: number;
  tts_limit: number;
}

interface RoomResolveResponse {
  room_code: string;
  participants: number;
  target_peer_id: string | null;
  initiator_peer_id: string | null;
}

interface TelemetryEventPayload {
  [key: string]: string | number | boolean | null | undefined;
}

type UiLocale = 'es' | 'en' | 'de' | 'ru' | 'fr' | 'it';

const QUALITY_PROFILES: Record<string, QualityProfile> = {
  low: { label: 'Low (360p)', width: 640, height: 360, maxBitrate: 500000 },
  medium: { label: 'Medium (720p)', width: 1280, height: 720, maxBitrate: 1500000 },
  high: { label: 'High (1080p)', width: 1920, height: 1080, maxBitrate: 4000000 },
};

const SESSION_STORAGE_KEY = 'anclora_linguo_session';
const UI_LOCALE_STORAGE_KEY = 'anclora_linguo_ui_locale';
const SHOW_HYPOTHESIS_STORAGE_KEY = 'anclora_show_hypothesis_subtitles';
const ROOM_QUERY_PARAM = 'room';

const UI_LOCALE_OPTIONS: Array<{ code: UiLocale; label: string }> = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ru', label: 'Русский' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
];

const UI_TEXTS: Record<UiLocale, Record<string, string>> = {
  es: {
    appTitle: 'Anclora LinguoCAM',
    appSubtitle: 'Comunicación global, sin barreras.',
    yourPeerId: 'Tu ID de Peer',
    iSpeak: 'Yo hablo',
    theySpeak: 'Ellos hablan',
    callQuality: 'Calidad de llamada',
    joinRoom: 'Unirse a sala',
    joinRoomPlaceholder: 'Introduce el Peer ID para llamar...',
    connecting: 'Conectando...',
    startCall: 'Iniciar llamada con traducción',
    copyHint: 'Pide a la otra persona su Peer ID para conectar.',
    copyInviteLink: 'Copiar enlace',
    runPrecheck: 'Pre-check',
    checkingPrecheck: 'Comprobando...',
    precheckOk: 'Pre-check OK: cámara, micrófono y red listos.',
    precheckFail: 'Pre-check con incidencias. Revisa permisos o red.',
    waitingInRoom: 'Esperando a otro participante en la sala...',
    secureAccess: 'Acceso seguro',
    secureAccessDesc: 'Cada llamada requiere participantes autenticados antes de conectar.',
    name: 'Nombre',
    namePlaceholder: 'Tu nombre completo',
    role: 'Rol',
    agent: 'Agente',
    investor: 'Inversor',
    creatingSession: 'Creando sesión...',
    enterWorkspace: 'Entrar al workspace',
    signOut: 'Cerrar sesión',
    authNameError: 'Introduce tu nombre para continuar.',
    authCreateError: 'No se pudo crear una sesión segura. Revisa la conexión con backend.',
    validatingSession: 'Validando sesión segura...',
  },
  en: {
    appTitle: 'Anclora LinguoCAM',
    appSubtitle: 'Global communication, zero barriers.',
    yourPeerId: 'Your Peer ID',
    iSpeak: 'I speak',
    theySpeak: 'They speak',
    callQuality: 'Call quality',
    joinRoom: 'Join room',
    joinRoomPlaceholder: 'Enter Peer ID to call...',
    connecting: 'Connecting...',
    startCall: 'Start translation call',
    copyHint: 'Ask the other person for their Peer ID to connect.',
    copyInviteLink: 'Copy invite link',
    runPrecheck: 'Pre-check',
    checkingPrecheck: 'Checking...',
    precheckOk: 'Pre-check OK: camera, microphone and network ready.',
    precheckFail: 'Pre-check failed. Review permissions or network.',
    waitingInRoom: 'Waiting for another participant in the room...',
    secureAccess: 'Secure access',
    secureAccessDesc: 'Every call requires authenticated participants before connection.',
    name: 'Name',
    namePlaceholder: 'Your full name',
    role: 'Role',
    agent: 'Agent',
    investor: 'Investor',
    creatingSession: 'Creating session...',
    enterWorkspace: 'Enter workspace',
    signOut: 'Sign out',
    authNameError: 'Enter your name to continue.',
    authCreateError: 'Could not create a secure session. Check backend connectivity.',
    validatingSession: 'Validating secure session...',
  },
  de: {
    appTitle: 'Anclora LinguoCAM',
    appSubtitle: 'Globale Kommunikation ohne Barrieren.',
    yourPeerId: 'Deine Peer-ID',
    iSpeak: 'Ich spreche',
    theySpeak: 'Sie sprechen',
    callQuality: 'Anrufqualität',
    joinRoom: 'Raum beitreten',
    joinRoomPlaceholder: 'Peer-ID zum Anrufen eingeben...',
    connecting: 'Verbinden...',
    startCall: 'Übersetzungsanruf starten',
    copyHint: 'Bitte die andere Person um ihre Peer-ID.',
    copyInviteLink: 'Link kopieren',
    runPrecheck: 'Pre-Check',
    checkingPrecheck: 'Prüfung...',
    precheckOk: 'Pre-Check OK: Kamera, Mikrofon und Netzwerk bereit.',
    precheckFail: 'Pre-Check fehlgeschlagen. Berechtigungen/Netz prüfen.',
    waitingInRoom: 'Warte auf einen weiteren Teilnehmer im Raum...',
    secureAccess: 'Sicherer Zugang',
    secureAccessDesc: 'Jeder Anruf erfordert authentifizierte Teilnehmer vor der Verbindung.',
    name: 'Name',
    namePlaceholder: 'Dein vollständiger Name',
    role: 'Rolle',
    agent: 'Agent',
    investor: 'Investor',
    creatingSession: 'Sitzung wird erstellt...',
    enterWorkspace: 'Workspace betreten',
    signOut: 'Abmelden',
    authNameError: 'Bitte gib deinen Namen ein.',
    authCreateError: 'Sichere Sitzung konnte nicht erstellt werden.',
    validatingSession: 'Sichere Sitzung wird geprüft...',
  },
  ru: {
    appTitle: 'Anclora LinguoCAM',
    appSubtitle: 'Глобальное общение без барьеров.',
    yourPeerId: 'Ваш Peer ID',
    iSpeak: 'Я говорю',
    theySpeak: 'Они говорят',
    callQuality: 'Качество звонка',
    joinRoom: 'Войти в комнату',
    joinRoomPlaceholder: 'Введите Peer ID для звонка...',
    connecting: 'Подключение...',
    startCall: 'Начать звонок с переводом',
    copyHint: 'Попросите собеседника прислать Peer ID.',
    copyInviteLink: 'Копировать ссылку',
    runPrecheck: 'Пре-чек',
    checkingPrecheck: 'Проверка...',
    precheckOk: 'Пре-чек OK: камера, микрофон и сеть готовы.',
    precheckFail: 'Проблема в пре-чеке. Проверьте сеть/разрешения.',
    waitingInRoom: 'Ожидание второго участника в комнате...',
    secureAccess: 'Безопасный вход',
    secureAccessDesc: 'Перед подключением все участники должны быть аутентифицированы.',
    name: 'Имя',
    namePlaceholder: 'Ваше полное имя',
    role: 'Роль',
    agent: 'Агент',
    investor: 'Инвестор',
    creatingSession: 'Создание сессии...',
    enterWorkspace: 'Войти в workspace',
    signOut: 'Выйти',
    authNameError: 'Введите имя, чтобы продолжить.',
    authCreateError: 'Не удалось создать безопасную сессию.',
    validatingSession: 'Проверка защищенной сессии...',
  },
  fr: {
    appTitle: 'Anclora LinguoCAM',
    appSubtitle: 'Communication mondiale, sans barrières.',
    yourPeerId: 'Votre ID Peer',
    iSpeak: 'Je parle',
    theySpeak: 'Ils parlent',
    callQuality: 'Qualité d’appel',
    joinRoom: 'Rejoindre la salle',
    joinRoomPlaceholder: 'Entrez le Peer ID pour appeler...',
    connecting: 'Connexion...',
    startCall: 'Démarrer l’appel traduit',
    copyHint: 'Demandez le Peer ID de l’autre personne.',
    copyInviteLink: 'Copier le lien',
    runPrecheck: 'Pré-check',
    checkingPrecheck: 'Vérification...',
    precheckOk: 'Pré-check OK : caméra, micro et réseau prêts.',
    precheckFail: 'Pré-check en échec. Vérifiez permissions/réseau.',
    waitingInRoom: 'En attente d’un autre participant dans la salle...',
    secureAccess: 'Accès sécurisé',
    secureAccessDesc: 'Chaque appel nécessite des participants authentifiés avant connexion.',
    name: 'Nom',
    namePlaceholder: 'Votre nom complet',
    role: 'Rôle',
    agent: 'Agent',
    investor: 'Investisseur',
    creatingSession: 'Création de session...',
    enterWorkspace: 'Entrer dans le workspace',
    signOut: 'Déconnexion',
    authNameError: 'Entrez votre nom pour continuer.',
    authCreateError: 'Impossible de créer une session sécurisée.',
    validatingSession: 'Validation de la session sécurisée...',
  },
  it: {
    appTitle: 'Anclora LinguoCAM',
    appSubtitle: 'Comunicazione globale, zero barriere.',
    yourPeerId: 'Il tuo Peer ID',
    iSpeak: 'Io parlo',
    theySpeak: 'Loro parlano',
    callQuality: 'Qualità chiamata',
    joinRoom: 'Entra nella stanza',
    joinRoomPlaceholder: 'Inserisci il Peer ID per chiamare...',
    connecting: 'Connessione...',
    startCall: 'Avvia chiamata tradotta',
    copyHint: "Chiedi all'altra persona il suo Peer ID.",
    copyInviteLink: 'Copia link',
    runPrecheck: 'Pre-check',
    checkingPrecheck: 'Verifica...',
    precheckOk: 'Pre-check OK: camera, microfono e rete pronti.',
    precheckFail: 'Pre-check fallito. Controlla permessi o rete.',
    waitingInRoom: 'In attesa di un altro partecipante nella stanza...',
    secureAccess: 'Accesso sicuro',
    secureAccessDesc: 'Ogni chiamata richiede partecipanti autenticati prima della connessione.',
    name: 'Nome',
    namePlaceholder: 'Il tuo nome completo',
    role: 'Ruolo',
    agent: 'Agente',
    investor: 'Investitore',
    creatingSession: 'Creazione sessione...',
    enterWorkspace: 'Entra nel workspace',
    signOut: 'Esci',
    authNameError: 'Inserisci il tuo nome per continuare.',
    authCreateError: 'Impossibile creare una sessione sicura.',
    validatingSession: 'Verifica sessione sicura...',
  },
};
const ENABLE_E2E_HOOKS = import.meta.env.VITE_ENABLE_E2E_HOOKS === 'true';

const percentile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

const updateCaptionTrack = (
  prevConfirmed: string,
  prevLastHypothesis: string,
  prevStableCount: number,
  nextText: string,
  isFinal: boolean,
): { confirmed: string; hypothesis: string; lastHypothesis: string; stableCount: number } => {
  if (isFinal) {
    return {
      confirmed: nextText.trim(),
      hypothesis: '',
      lastHypothesis: '',
      stableCount: 0,
    };
  }

  const normalized = nextText.trim();
  const stableCount = normalized && normalized === prevLastHypothesis ? prevStableCount + 1 : 1;
  const shouldCommit = stableCount >= 2 && normalized.length > prevConfirmed.length;
  if (shouldCommit) {
    return {
      confirmed: normalized,
      hypothesis: '',
      lastHypothesis: normalized,
      stableCount,
    };
  }

  if (normalized.startsWith(prevConfirmed)) {
    return {
      confirmed: prevConfirmed,
      hypothesis: normalized.slice(prevConfirmed.length).trim(),
      lastHypothesis: normalized,
      stableCount,
    };
  }

  return {
    confirmed: prevConfirmed,
    hypothesis: normalized,
    lastHypothesis: normalized,
    stableCount,
  };
};

const App: React.FC = () => {
  const [status, setStatus] = useState<CallStatus>(CallStatus.IDLE);
  const [peerId, setPeerId] = useState<string>('');
  const [targetPeerId, setTargetPeerId] = useState<string>('');
  const [myLang, setMyLang] = useState('es');
  const [remoteLang, setRemoteLang] = useState('en');
  const [quality, setQuality] = useState('medium');
  const [remoteVolume, setRemoteVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isPttPressed, setIsPttPressed] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);

  const [localSubtitleConfirmed, setLocalSubtitleConfirmed] = useState('');
  const [localSubtitleHypothesis, setLocalSubtitleHypothesis] = useState('');
  const [remoteSubtitleConfirmed, setRemoteSubtitleConfirmed] = useState('');
  const [remoteSubtitleHypothesis, setRemoteSubtitleHypothesis] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHypothesisSubtitles, setShowHypothesisSubtitles] = useState<boolean>(() => {
    const stored = localStorage.getItem(SHOW_HYPOTHESIS_STORAGE_KEY);
    if (stored === null) return true;
    return stored !== 'false';
  });
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState<'agent' | 'investor'>('agent');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [, setUsageSummary] = useState<UsageSummary | null>(null);
  const [isRunningPrecallCheck, setIsRunningPrecallCheck] = useState(false);
  const [preCallStatus, setPreCallStatus] = useState('');
  const [uiLocale, setUiLocale] = useState<UiLocale>(() => {
    const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY) as UiLocale | null;
    return stored && UI_TEXTS[stored] ? stored : 'es';
  });
  const [peerConnectionState, setPeerConnectionState] = useState<'connected' | 'reconnecting' | 'down'>('connected');
  const [networkNotice, setNetworkNotice] = useState<string>('');
  const [e2eeState, setE2eeState] = useState<'off' | 'enabled' | 'unsupported' | 'error'>('off');

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [recordingConsentGranted, setRecordingConsentGranted] = useState(false);
  const activeCallIdRef = useRef<string>('');
  const consentRegisteredRef = useRef(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pttActiveRef = useRef(false);
  const handsFreeActiveRef = useRef(false);
  const qualityRef = useRef(quality);
  const remoteVolumeRef = useRef(remoteVolume);
  const sessionRef = useRef<SessionInfo | null>(null);
  const statusRef = useRef<CallStatus>(status);
  const resetCallStateRef = useRef<() => void>(() => undefined);
  const lastSubtitleReconnectAttemptRef = useRef<number>(0);
  const trackTelemetryRef = useRef<(eventType: string, payload?: TelemetryEventPayload) => void>(
    () => undefined,
  );
  const localSubtitleConfirmedRef = useRef('');
  const remoteSubtitleConfirmedRef = useRef('');
  const localSubtitleTrackRef = useRef({ lastHypothesis: '', stableCount: 0 });
  const remoteSubtitleTrackRef = useRef({ lastHypothesis: '', stableCount: 0 });
  const callStartedAtRef = useRef<number | null>(null);
  const firstRemoteSubtitleAtRef = useRef<number | null>(null);
  const captionLagSamplesRef = useRef<number[]>([]);
  const hypothesisSentRef = useRef(0);
  const hypothesisDroppedRef = useRef(0);
  const endpointProfileRef = useRef<'normal' | 'aggressive'>('normal');
  const chunkProfileRef = useRef<'fast' | 'normal' | 'stable'>('normal');

  const peerRef = useRef<Peer | null>(null);
  const currentCallRef = useRef<any>(null);
  const dataConnRef = useRef<any>(null);
  const captionsHypChannelRef = useRef<RTCDataChannel | null>(null);
  const captionsCommitChannelRef = useRef<RTCDataChannel | null>(null);
  const subtitleSeqRef = useRef(0);
  const remoteSubtitleOrderRef = useRef({ lastHypSeq: -1, lastCommitSeq: -1 });
  const seenCaptionIdsRef = useRef<string[]>([]);

  const appendTranscriptEntry = useCallback((speaker: string, text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const timestampMs = Date.now();
    setTranscriptEntries((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && last.text === cleaned && (timestampMs - last.timestampMs) < 1200) {
        return prev;
      }
      return [...prev, { speaker, text: cleaned, timestampMs }];
    });
  }, []);

  const webrtcStats = useWebRtcStats(
    currentCallRef.current?.peerConnection ?? null,
    status === CallStatus.ACTIVE,
  );

  const streaming = useStreamingTranslation({
    wsUrl: ASR_MT_WS_URL,
    sampleRate: SAMPLE_RATE,
    chunkFrames: AUDIO_CHUNK_FRAMES,
    vadThreshold: VAD_THRESHOLD,
    minSpeechMs: VAD_MIN_SPEECH_MS,
    minSilenceMs: VAD_MIN_SILENCE_MS,
    maxSegmentMs: VAD_MAX_SEGMENT_MS,
    hangoverMs: VAD_HANGOVER_MS,
    sourceLang: myLang,
    targetLang: remoteLang,
    onSubtitle: (text, isFinal) => {
      const originTsMs = Date.now();
      const sequence = subtitleSeqRef.current++;
      const next = updateCaptionTrack(
        localSubtitleConfirmedRef.current,
        localSubtitleTrackRef.current.lastHypothesis,
        localSubtitleTrackRef.current.stableCount,
        text,
        isFinal,
      );
      localSubtitleTrackRef.current = {
        lastHypothesis: next.lastHypothesis,
        stableCount: next.stableCount,
      };
      localSubtitleConfirmedRef.current = next.confirmed;
      setLocalSubtitleConfirmed(next.confirmed);
      setLocalSubtitleHypothesis(next.hypothesis);
      if (!isFinal) {
        hypothesisSentRef.current += 1;
      }
      const payload = {
        type: 'subtitle',
        caption_id: `cap-${sequence}`,
        text,
        is_final: isFinal,
        origin_ts_ms: originTsMs,
        seq: sequence,
      };

      if (isFinal) {
        appendTranscriptEntry(sessionRef.current?.displayName || 'You', text);
        if (captionsCommitChannelRef.current?.readyState === 'open') {
          captionsCommitChannelRef.current.send(JSON.stringify(payload));
        } else if (dataConnRef.current?.open) {
          dataConnRef.current.send(payload);
        }
      } else {
        if (captionsHypChannelRef.current?.readyState === 'open') {
          captionsHypChannelRef.current.send(JSON.stringify(payload));
        } else {
          hypothesisDroppedRef.current += 1;
        }
      }
      if (isFinal) {
        setTimeout(() => {
          localSubtitleConfirmedRef.current = '';
          setLocalSubtitleConfirmed('');
          setLocalSubtitleHypothesis('');
          localSubtitleTrackRef.current = { lastHypothesis: '', stableCount: 0 };
        }, 3000);
      }
    },
  });

  const {
    latencyMs,
    connectionState: translationConnectionState,
    reconnectAttempts: translationReconnectAttempts,
    setSendActive,
    setEndpointingConfig,
    start: startStreaming,
    stop: stopStreaming,
  } = streaming;

  const hasUnreadPeerMessages = !isChatOpen && messages.some((msg) => msg.sender === 'peer');
  const myLangName = SUPPORTED_LANGUAGES.find((l) => l.code === myLang)?.name || myLang;
  const remoteLangName = SUPPORTED_LANGUAGES.find((l) => l.code === remoteLang)?.name || remoteLang;
  const ui = UI_TEXTS[uiLocale];
  const localSubtitle = `${localSubtitleConfirmed} ${localSubtitleHypothesis}`.trim();
  const remoteSubtitle = `${remoteSubtitleConfirmed} ${remoteSubtitleHypothesis}`.trim();

  const recording = useRecording({
    localVideoRef,
    remoteVideoRef,
    canvasRef,
    getLocalStream: () => cameraStreamRef.current,
    getRemoteStream: () => remoteStreamRef.current,
    isScreenSharing,
    localSubtitle,
    remoteSubtitle,
  });

  const applyBitrateLimit = useCallback(async (call: any, maxBitrate: number) => {
    if (!call?.peerConnection) return;
    const senders = call.peerConnection.getSenders();
    const videoSender = senders.find((s: any) => s.track && s.track.kind === 'video');
    if (videoSender) {
      const parameters = videoSender.getParameters();
      if (!parameters.encodings) parameters.encodings = [{}];
      parameters.encodings[0].maxBitrate = maxBitrate;
      await videoSender.setParameters(parameters);
      console.log(`Applied bitrate limit: ${maxBitrate / 1000}kbps`);
    }
  }, []);

  const tryEnableE2EE = useCallback((call: any) => {
    if (!ENABLE_INSERTABLE_E2EE) {
      setE2eeState('off');
      return;
    }
    const pc: RTCPeerConnection | null = call?.peerConnection ?? null;
    if (!pc) return;
    if (!supportsInsertableStreams()) {
      setE2eeState('unsupported');
      setNetworkNotice('Insertable-stream E2EE is not supported in this browser.');
      trackTelemetryRef.current('e2ee_unsupported', { topology: CALL_TOPOLOGY });
      return;
    }
    const applied = applyInsertableE2EE(pc, E2EE_SHARED_KEY);
    if (applied) {
      setE2eeState('enabled');
      trackTelemetryRef.current('e2ee_enabled', { topology: CALL_TOPOLOGY });
    } else {
      setE2eeState('error');
      setNetworkNotice('E2EE key missing or invalid. Falling back to transport encryption only.');
      trackTelemetryRef.current('e2ee_error', { topology: CALL_TOPOLOGY });
    }
  }, []);

  const handleIncomingSubtitle = useCallback((payload: any) => {
    const text = typeof payload?.text === 'string' ? payload.text : '';
    if (!text) return;
    const captionId = typeof payload?.caption_id === 'string' ? payload.caption_id : '';
    if (captionId) {
      if (seenCaptionIdsRef.current.includes(captionId)) {
        return;
      }
      seenCaptionIdsRef.current.push(captionId);
      if (seenCaptionIdsRef.current.length > 300) {
        seenCaptionIdsRef.current.splice(0, seenCaptionIdsRef.current.length - 300);
      }
    }
    const seq = typeof payload?.seq === 'number' ? payload.seq : Number(payload?.seq ?? -1);
    const isFinal = Boolean(payload?.is_final);
    const orderState = remoteSubtitleOrderRef.current;
    if (Number.isFinite(seq) && seq >= 0) {
      if (isFinal) {
        if (seq <= orderState.lastCommitSeq) {
          return;
        }
        orderState.lastCommitSeq = seq;
        if (orderState.lastHypSeq < seq) {
          orderState.lastHypSeq = seq;
        }
      } else {
        if (seq <= Math.max(orderState.lastHypSeq, orderState.lastCommitSeq)) {
          return;
        }
        orderState.lastHypSeq = seq;
      }
    }
    const originTsMs =
      typeof payload.origin_ts_ms === 'number'
        ? payload.origin_ts_ms
        : Number(payload.origin_ts_ms || 0);
    if (originTsMs > 0) {
      const lag = Date.now() - originTsMs;
      if (lag >= 0 && lag < 120000) {
        if (captionLagSamplesRef.current.length >= 200) {
          captionLagSamplesRef.current.shift();
        }
        captionLagSamplesRef.current.push(lag);
      }
    }
    if (!firstRemoteSubtitleAtRef.current && callStartedAtRef.current) {
      firstRemoteSubtitleAtRef.current = Date.now();
      trackTelemetryRef.current('caption_ttfc', {
        ttfc_ms: firstRemoteSubtitleAtRef.current - callStartedAtRef.current,
      });
    }
    const next = updateCaptionTrack(
      remoteSubtitleConfirmedRef.current,
      remoteSubtitleTrackRef.current.lastHypothesis,
      remoteSubtitleTrackRef.current.stableCount,
      text,
      isFinal,
    );
    remoteSubtitleTrackRef.current = {
      lastHypothesis: next.lastHypothesis,
      stableCount: next.stableCount,
    };
    remoteSubtitleConfirmedRef.current = next.confirmed;
    if (isFinal) {
      appendTranscriptEntry('Peer', text);
    }
    setRemoteSubtitleConfirmed(next.confirmed);
    setRemoteSubtitleHypothesis(next.hypothesis);
    const subtitleTimeout = isFinal ? 4000 : 1800;
    setTimeout(() => {
      if (isFinal) {
        remoteSubtitleConfirmedRef.current = '';
        setRemoteSubtitleConfirmed('');
        setRemoteSubtitleHypothesis('');
        remoteSubtitleTrackRef.current = { lastHypothesis: '', stableCount: 0 };
      } else if (remoteSubtitleTrackRef.current.lastHypothesis === next.lastHypothesis) {
        setRemoteSubtitleHypothesis('');
      }
    }, subtitleTimeout);
  }, [appendTranscriptEntry]);

  const setupCaptionChannels = useCallback((call: any, isInitiator: boolean) => {
    const pc: RTCPeerConnection | null = call?.peerConnection ?? null;
    if (!pc) return;

    const bindIncoming = (channel: RTCDataChannel) => {
      if (channel.label === 'captions_hyp') {
        captionsHypChannelRef.current = channel;
      } else if (channel.label === 'captions_commit') {
        captionsCommitChannelRef.current = channel;
      } else {
        return;
      }

      channel.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type !== 'subtitle') return;
          handleIncomingSubtitle(payload);
        } catch {
          // Ignore malformed caption payloads.
        }
      };
    };

    pc.ondatachannel = (event) => {
      bindIncoming(event.channel);
    };

    if (isInitiator) {
      if (!captionsHypChannelRef.current) {
        const hyp = pc.createDataChannel('captions_hyp', {
          ordered: false,
          maxRetransmits: 0,
        });
        bindIncoming(hyp);
      }
      if (!captionsCommitChannelRef.current) {
        const commit = pc.createDataChannel('captions_commit', {
          ordered: true,
        });
        bindIncoming(commit);
      }
    }
  }, [handleIncomingSubtitle]);

  const setupDataChannel = useCallback((conn: any) => {
    conn.on('open', () => {
      setNetworkNotice('');
    });

    conn.on('data', (data: any) => {
      if (data.type === 'subtitle') {
        // Legacy fallback path through PeerJS data connection.
        handleIncomingSubtitle(data);
      } else if (data.type === 'chat') {
        const newMessage: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          sender: 'peer',
          text: data.text,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, newMessage]);
        setIsChatOpen(true);
      }
    });

    conn.on('close', () => {
      if (statusRef.current === CallStatus.ACTIVE) {
        setNetworkNotice('Data channel closed. Chat/subtitles sync may be limited.');
      }
    });

    conn.on('error', () => {
      if (statusRef.current === CallStatus.ACTIVE) {
        setNetworkNotice('Data channel error detected.');
      }
    });
  }, [handleIncomingSubtitle]);

  const handleCall = useCallback((call: any, stream: MediaStream) => {
    setupCaptionChannels(call, false);
    tryEnableE2EE(call);
    setStatus(CallStatus.ACTIVE);
    setNetworkNotice('');
    localSubtitleConfirmedRef.current = '';
    remoteSubtitleConfirmedRef.current = '';
    localSubtitleTrackRef.current = { lastHypothesis: '', stableCount: 0 };
    remoteSubtitleTrackRef.current = { lastHypothesis: '', stableCount: 0 };
    setLocalSubtitleConfirmed('');
    setLocalSubtitleHypothesis('');
    setRemoteSubtitleConfirmed('');
    setRemoteSubtitleHypothesis('');
    setTranscriptEntries([]);
    remoteSubtitleOrderRef.current = { lastHypSeq: -1, lastCommitSeq: -1 };
    seenCaptionIdsRef.current = [];
    callStartedAtRef.current = Date.now();
    firstRemoteSubtitleAtRef.current = null;
    captionLagSamplesRef.current = [];
    hypothesisSentRef.current = 0;
    hypothesisDroppedRef.current = 0;
    subtitleSeqRef.current = 0;
    trackTelemetryRef.current('call_started', { quality });
    call.on('stream', (remoteStream: MediaStream) => {
      remoteStreamRef.current = remoteStream;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.volume = remoteVolumeRef.current;
      }
    });
    call.on('close', () => {
      setNetworkNotice('Call ended or dropped.');
      resetCallStateRef.current();
    });
    call.on('error', () => {
      setNetworkNotice('Call transport error. Trying to recover.');
      trackTelemetryRef.current('call_transport_error');
    });
    streamingStartRef.current(stream);
  }, [quality, setupCaptionChannels, tryEnableE2EE]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isMuted ? 0 : remoteVolume;
    }
    remoteVolumeRef.current = remoteVolume;
  }, [remoteVolume, isMuted]);

  // Re-bind streams after ACTIVE view mounts; avoids blank local preview on mobile/desktop.
  useEffect(() => {
    if (status !== CallStatus.ACTIVE) return;

    const localStream = isScreenSharing ? screenStreamRef.current : cameraStreamRef.current;
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => undefined);
    }

    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.volume = isMuted ? 0 : remoteVolumeRef.current;
      remoteVideoRef.current.play().catch(() => undefined);
    }
  }, [status, isScreenSharing, isMuted]);

  useEffect(() => {
    handsFreeActiveRef.current = isHandsFree;
    setSendActive(isHandsFree || pttActiveRef.current);
  }, [isHandsFree, setSendActive]);

  useEffect(() => {
    qualityRef.current = quality;
  }, [quality]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!ENABLE_E2E_HOOKS) return;
    (window as any).__E2E_SEND_SUBTITLE = (text: string) => {
      const payload = {
        type: 'subtitle',
        caption_id: `cap-${subtitleSeqRef.current}`,
        text,
        is_final: true,
        origin_ts_ms: Date.now(),
        seq: subtitleSeqRef.current++,
      };
      if (captionsCommitChannelRef.current?.readyState === 'open') {
        captionsCommitChannelRef.current.send(JSON.stringify(payload));
        return true;
      }
      if (dataConnRef.current?.open) {
        dataConnRef.current.send(payload);
        return true;
      }
      return false;
    };
    return () => {
      delete (window as any).__E2E_SEND_SUBTITLE;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, uiLocale);
  }, [uiLocale]);

  useEffect(() => {
    localStorage.setItem(SHOW_HYPOTHESIS_STORAGE_KEY, showHypothesisSubtitles ? 'true' : 'false');
  }, [showHypothesisSubtitles]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get(ROOM_QUERY_PARAM);
    if (room && !targetPeerId) {
      setTargetPeerId(normalizeRoomCode(room));
    }
  }, [targetPeerId]);

  useEffect(() => {
    if (!peerId || targetPeerId) return;
    setTargetPeerId(`ROOM-${peerId}`);
  }, [peerId, targetPeerId]);

  useEffect(() => {
    if (CALL_TOPOLOGY === 'sfu') {
      if (ENABLE_INSERTABLE_E2EE) {
        const support = supportsInsertableStreams();
        setE2eeState(support ? 'enabled' : 'unsupported');
      }
      setNetworkNotice('SFU topology enabled: call join redirects to external SFU room.');
      return;
    }
    if (!HAS_TURN_SERVER) {
      setNetworkNotice(
        'TURN not configured. Calls may fail on restrictive NAT/firewall networks.',
      );
    }
  }, []);

  useEffect(() => {
    if (status !== CallStatus.ACTIVE) return;
    if (translationConnectionState === 'reconnecting') {
      if (lastSubtitleReconnectAttemptRef.current !== translationReconnectAttempts) {
        lastSubtitleReconnectAttemptRef.current = translationReconnectAttempts;
        trackTelemetryRef.current('subtitle_reconnecting', { attempt: translationReconnectAttempts });
      }
      setNetworkNotice(
        `Translation stream reconnecting (attempt ${translationReconnectAttempts}/${5})...`,
      );
      return;
    }
    if (translationConnectionState === 'error') {
      setNetworkNotice('Translation stream disconnected. Subtitles may be delayed.');
      trackTelemetryRef.current('subtitle_error');
      return;
    }
    if (translationConnectionState === 'connected') {
      setNetworkNotice('');
    }
  }, [status, translationConnectionState, translationReconnectAttempts]);

  useEffect(() => {
    if (status !== CallStatus.ACTIVE) return;
    const jitterMs = webrtcStats.jitterMs ?? 0;
    const lossPct = webrtcStats.packetLossPct ?? 0;
    const shouldBeAggressive = jitterMs >= 35 || lossPct >= 3;
    const nextProfile: 'normal' | 'aggressive' = shouldBeAggressive ? 'aggressive' : 'normal';
    if (endpointProfileRef.current === nextProfile) return;
    endpointProfileRef.current = nextProfile;
    if (nextProfile === 'aggressive') {
      setEndpointingConfig({
        minSpeechMs: 160,
        minSilenceMs: 260,
        maxSegmentMs: 1800,
        hangoverMs: 80,
      });
    } else {
      setEndpointingConfig({
        minSpeechMs: VAD_MIN_SPEECH_MS,
        minSilenceMs: VAD_MIN_SILENCE_MS,
        maxSegmentMs: VAD_MAX_SEGMENT_MS,
        hangoverMs: VAD_HANGOVER_MS,
      });
    }
    trackTelemetryRef.current('endpointing_profile_changed', {
      profile: nextProfile,
      jitter_ms: jitterMs,
      packet_loss_pct: lossPct,
    });
  }, [
    setEndpointingConfig,
    status,
    webrtcStats.jitterMs,
    webrtcStats.packetLossPct,
  ]);

  useEffect(() => {
    if (status !== CallStatus.ACTIVE) return;
    const jitterMs = webrtcStats.jitterMs ?? 0;
    const lossPct = webrtcStats.packetLossPct ?? 0;
    const lagMs = latencyMs ?? 0;

    let nextProfile: 'fast' | 'normal' | 'stable' = 'normal';
    if (lossPct >= 4 || jitterMs >= 45 || lagMs >= 1500) {
      nextProfile = 'stable';
    } else if (lossPct <= 1 && jitterMs <= 20 && lagMs > 0 && lagMs <= 800) {
      nextProfile = 'fast';
    }
    if (chunkProfileRef.current === nextProfile) return;
    chunkProfileRef.current = nextProfile;

    if (nextProfile === 'fast') {
      setEndpointingConfig({ chunkSize: 240 });
    } else if (nextProfile === 'stable') {
      setEndpointingConfig({ chunkSize: 480 });
    } else {
      setEndpointingConfig({ chunkSize: AUDIO_CHUNK_FRAMES });
    }

    trackTelemetryRef.current('audio_chunk_profile_changed', {
      profile: nextProfile,
      chunk_frames:
        nextProfile === 'fast'
          ? 240
          : nextProfile === 'stable'
            ? 480
            : AUDIO_CHUNK_FRAMES,
      jitter_ms: jitterMs,
      packet_loss_pct: lossPct,
      subtitle_latency_ms: lagMs || null,
    });
  }, [
    latencyMs,
    setEndpointingConfig,
    status,
    webrtcStats.jitterMs,
    webrtcStats.packetLossPct,
  ]);

  const recordingStopRef = useRef(recording.stopRecording);
  const streamingStartRef = useRef(startStreaming);
  const streamingStopRef = useRef(stopStreaming);
  useEffect(() => {
    recordingStopRef.current = recording.stopRecording;
    streamingStartRef.current = startStreaming;
    streamingStopRef.current = stopStreaming;
  }, [recording.stopRecording, startStreaming, stopStreaming]);

  const apiPost = useCallback(async <T,>(path: string, payload: Record<string, unknown>): Promise<T> => {
    const response = await fetch(`${ASR_MT_HTTP_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  }, []);

  const trackTelemetry = useCallback(async (eventType: string, payload: TelemetryEventPayload = {}) => {
    if (!session?.token) return;
    try {
      await apiPost('/api/telemetry/events', {
        token: session.token,
        call_id: activeCallIdRef.current || 'n/a',
        events: [
          {
            type: eventType,
            timestamp_ms: Date.now(),
            payload,
          },
        ],
      });
    } catch (error) {
      console.error('Telemetry send failed:', error);
    }
  }, [apiPost, session?.token]);

  const triggerDownload = useCallback((filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const exportTranscriptVtt = useCallback(() => {
    if (!transcriptEntries.length) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    triggerDownload(`anclora-transcript-${stamp}.vtt`, toVtt(transcriptEntries), 'text/vtt;charset=utf-8');
  }, [transcriptEntries, triggerDownload]);

  const exportTranscriptSrt = useCallback(() => {
    if (!transcriptEntries.length) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    triggerDownload(`anclora-transcript-${stamp}.srt`, toSrt(transcriptEntries), 'application/x-subrip;charset=utf-8');
  }, [transcriptEntries, triggerDownload]);

  useEffect(() => {
    trackTelemetryRef.current = (eventType: string, payload: TelemetryEventPayload = {}) => {
      trackTelemetry(eventType, payload);
    };
  }, [trackTelemetry]);

  useEffect(() => {
    const restoreSession = async () => {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        setAuthLoading(false);
        return;
      }
      try {
        const stored = JSON.parse(raw) as SessionInfo;
        const validation = await apiPost<{ valid: boolean; display_name: string; role: 'agent' | 'investor'; user_id: string; expires_at: number }>(
          '/api/auth/validate',
          { token: stored.token },
        );
        if (!validation.valid) throw new Error('invalid session');
        const sessionData: SessionInfo = {
          token: stored.token,
          userId: validation.user_id,
          displayName: validation.display_name,
          role: validation.role,
          expiresAt: validation.expires_at,
        };
        setSession(sessionData);
      } catch (error) {
        console.error('Session restore failed:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setAuthLoading(false);
      }
    };

    restoreSession();
  }, [apiPost]);

  const refreshUsageSummary = useCallback(async (authToken: string) => {
    try {
      const summary = await apiPost<UsageSummary>('/api/sessions/usage', { token: authToken });
      setUsageSummary(summary);
    } catch (error) {
      console.error('Usage summary error:', error);
    }
  }, [apiPost]);

  const runCpuProbe = useCallback(() => {
    const probeWindowMs = 250;
    const start = performance.now();
    let ops = 0;
    let accumulator = 0;
    while (performance.now() - start < probeWindowMs) {
      for (let i = 0; i < 500; i += 1) {
        accumulator += Math.sin((ops + i) * 0.01);
      }
      ops += 500;
    }
    if (!Number.isFinite(accumulator)) return 0;
    const elapsed = Math.max(1, performance.now() - start);
    return Math.round(ops / elapsed);
  }, []);

  const runWebRtcProbe = useCallback(async () => {
    const pc1 = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const pc2 = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    let dc1: RTCDataChannel | null = null;
    let dc2: RTCDataChannel | null = null;
    let resolved = false;

    const cleanup = () => {
      try {
        dc1?.close();
      } catch {
        // noop
      }
      try {
        dc2?.close();
      } catch {
        // noop
      }
      try {
        pc1.close();
      } catch {
        // noop
      }
      try {
        pc2.close();
      } catch {
        // noop
      }
    };

    const waitForConnected = () => new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => {
        if (resolved) return;
        resolved = true;
        resolve(false);
      }, 8000);
      const maybeResolve = () => {
        if (resolved) return;
        const connected =
          (pc1.iceConnectionState === 'connected' || pc1.iceConnectionState === 'completed')
          && (pc2.iceConnectionState === 'connected' || pc2.iceConnectionState === 'completed');
        if (connected) {
          window.clearTimeout(timeout);
          resolved = true;
          resolve(true);
        }
      };
      pc1.oniceconnectionstatechange = maybeResolve;
      pc2.oniceconnectionstatechange = maybeResolve;
      maybeResolve();
    });

    try {
      pc1.onicecandidate = (event) => {
        if (event.candidate) {
          pc2.addIceCandidate(event.candidate).catch(() => undefined);
        }
      };
      pc2.onicecandidate = (event) => {
        if (event.candidate) {
          pc1.addIceCandidate(event.candidate).catch(() => undefined);
        }
      };

      dc1 = pc1.createDataChannel('precheck');
      pc2.ondatachannel = (event) => {
        dc2 = event.channel;
        dc2.onmessage = (msg) => {
          if (typeof msg.data === 'string' && msg.data.startsWith('ping:')) {
            dc2?.send(msg.data.replace('ping:', 'pong:'));
          }
        };
      };

      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);
      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      const connected = await waitForConnected();
      if (!connected) {
        cleanup();
        return { ok: false, rttMs: -1, usesTurnRelay: false };
      }

      const pingRtt = await new Promise<number>((resolve) => {
        if (!dc1) {
          resolve(-1);
          return;
        }
        const timeout = window.setTimeout(() => resolve(-1), 2000);
        const sentAt = performance.now();
        dc1.onmessage = (msg) => {
          if (typeof msg.data === 'string' && msg.data.startsWith('pong:')) {
            window.clearTimeout(timeout);
            resolve(Math.round(performance.now() - sentAt));
          }
        };
        dc1.onopen = () => {
          dc1?.send(`ping:${Date.now()}`);
        };
        if (dc1.readyState === 'open') {
          dc1.send(`ping:${Date.now()}`);
        }
      });

      const stats = await pc1.getStats();
      let usesTurnRelay = false;
      const selectedPairIds = new Set<string>();
      stats.forEach((stat: any) => {
        if (stat.type === 'transport' && stat.selectedCandidatePairId) {
          selectedPairIds.add(stat.selectedCandidatePairId);
        }
      });
      stats.forEach((stat: any) => {
        if (stat.type === 'candidate-pair' && selectedPairIds.has(stat.id)) {
          const localCandidate = stat.localCandidateId ? stats.get(stat.localCandidateId as string) : null;
          const remoteCandidate = stat.remoteCandidateId ? stats.get(stat.remoteCandidateId as string) : null;
          if (
            (localCandidate as any)?.candidateType === 'relay'
            || (remoteCandidate as any)?.candidateType === 'relay'
          ) {
            usesTurnRelay = true;
          }
        }
      });

      cleanup();
      return { ok: true, rttMs: pingRtt, usesTurnRelay };
    } catch {
      cleanup();
      return { ok: false, rttMs: -1, usesTurnRelay: false };
    }
  }, []);

  const runPrecallCheck = useCallback(async () => {
    setIsRunningPrecallCheck(true);
    setPreCallStatus('');
    try {
      let mediaOk = false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach((track) => track.stop());
        mediaOk = true;
      } catch {
        mediaOk = false;
      }

      const networkOk = navigator.onLine;
      let backendOk = false;
      const backendLatencySamples: number[] = [];
      try {
        for (let i = 0; i < 3; i += 1) {
          const startedAt = performance.now();
          const response = await fetch(`${ASR_MT_HTTP_URL}/health`);
          const elapsed = Math.round(performance.now() - startedAt);
          if (response.ok) {
            backendLatencySamples.push(elapsed);
          }
          backendOk = response.ok;
          if (!response.ok) break;
        }
      } catch {
        backendOk = false;
      }
      const backendLatencyMs = backendLatencySamples.length
        ? Math.round(
          backendLatencySamples.reduce((sum, value) => sum + value, 0) / backendLatencySamples.length,
        )
        : -1;
      const cpuOpsPerMs = runCpuProbe();
      const webrtcProbe = await runWebRtcProbe();
      const performanceOk = backendLatencyMs > 0 && backendLatencyMs <= 1200 && cpuOpsPerMs >= 250;
      const webrtcOk = webrtcProbe.ok && (webrtcProbe.rttMs < 0 || webrtcProbe.rttMs <= 1600);

      const ok = mediaOk && networkOk && backendOk && performanceOk && webrtcOk;
      const perfSummary = `API ${backendLatencyMs > 0 ? backendLatencyMs : '--'}ms | CPU ${cpuOpsPerMs} ops/ms | ICE ${webrtcProbe.ok ? 'ok' : 'fail'} | RTT ${webrtcProbe.rttMs > 0 ? webrtcProbe.rttMs : '--'}ms`;
      setPreCallStatus(ok ? `${ui.precheckOk} (${perfSummary})` : `${ui.precheckFail} (${perfSummary})`);
      trackTelemetry('precheck_result', {
        ok,
        media_ok: mediaOk,
        network_ok: networkOk,
        backend_ok: backendOk,
        ice_ok: webrtcProbe.ok,
        turn_relay: webrtcProbe.usesTurnRelay,
        backend_latency_ms: backendLatencyMs,
        cpu_ops_per_ms: cpuOpsPerMs,
        precheck_rtt_ms: webrtcProbe.rttMs,
        rtt_ms: webrtcStats.rttMs ?? -1,
        jitter_ms: webrtcStats.jitterMs ?? -1,
        packet_loss_pct: webrtcStats.packetLossPct ?? -1,
      });
    } finally {
      setIsRunningPrecallCheck(false);
    }
  }, [
    runWebRtcProbe,
    runCpuProbe,
    trackTelemetry,
    ui.precheckFail,
    ui.precheckOk,
    webrtcStats.jitterMs,
    webrtcStats.packetLossPct,
    webrtcStats.rttMs,
  ]);

  const registerRoomPresence = useCallback(async (roomCode: string) => {
    if (!session?.token || !peerId) return;
    await apiPost('/api/rooms/register', {
      token: session.token,
      room_code: roomCode,
      peer_id: peerId,
    });
  }, [apiPost, peerId, session?.token]);

  const waitForRoomPeerViaSse = useCallback((roomCode: string): Promise<RoomResolveResponse | null> => {
    if (!session?.token || !peerId) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const params = new URLSearchParams({
        token: session.token,
        room_code: roomCode,
        requester_peer_id: peerId,
      });
      const url = `${ASR_MT_HTTP_URL}/api/rooms/subscribe?${params.toString()}`;
      const source = new EventSource(url);
      const timeout = window.setTimeout(() => {
        source.close();
        resolve(null);
      }, 10000);

      const clean = () => {
        window.clearTimeout(timeout);
      };

      source.addEventListener('paired', (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data) as RoomResolveResponse;
          clean();
          source.close();
          resolve(parsed);
        } catch {
          clean();
          source.close();
          resolve(null);
        }
      });

      source.addEventListener('timeout', () => {
        clean();
        source.close();
        resolve(null);
      });

      source.onerror = () => {
        clean();
        source.close();
        resolve(null);
      };
    });
  }, [peerId, session?.token]);

  const waitForRoomPeer = useCallback(async (roomCode: string): Promise<RoomResolveResponse> => {
    if (!session?.token || !peerId) {
      throw new Error('missing session or peer');
    }
    const timeoutMs = 25000;
    const startTime = Date.now();
    await registerRoomPresence(roomCode);
    const sseResolved = await waitForRoomPeerViaSse(roomCode);
    if (sseResolved?.target_peer_id && sseResolved?.initiator_peer_id) {
      trackTelemetry('room_pair_resolved', {
        room_code: roomCode,
        time_to_pair_ms: Date.now() - startTime,
        attempts: 1,
        transport: 'sse',
      });
      return sseResolved;
    }

    let attempt = 1;
    while ((Date.now() - startTime) < timeoutMs) {
      await registerRoomPresence(roomCode);
      const resolved = await apiPost<RoomResolveResponse>('/api/rooms/resolve', {
        token: session.token,
        room_code: roomCode,
        requester_peer_id: peerId,
      });
      if (resolved.target_peer_id && resolved.initiator_peer_id) {
        trackTelemetry('room_pair_resolved', {
          room_code: roomCode,
          time_to_pair_ms: Date.now() - startTime,
          attempts: attempt + 1,
          transport: 'polling',
        });
        return resolved;
      }
      setPreCallStatus(ui.waitingInRoom);
      const delayMs = attempt < 3 ? 200 : attempt < 6 ? 500 : 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    }
    throw new Error('room participant timeout');
  }, [
    apiPost,
    peerId,
    registerRoomPresence,
    session?.token,
    trackTelemetry,
    ui.waitingInRoom,
    waitForRoomPeerViaSse,
  ]);

  useEffect(() => {
    if (!session?.token) return;
    refreshUsageSummary(session.token);
  }, [session?.token, refreshUsageSummary]);

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = authName.trim();
    if (!cleanName) {
      setAuthError(ui.authNameError);
      return;
    }

    setIsAuthenticating(true);
    setAuthError('');
    try {
      const sessionResponse = await apiPost<{ token: string; user_id: string; expires_at: number }>(
        '/api/auth/session',
        { display_name: cleanName, role: authRole },
      );
      const newSession: SessionInfo = {
        token: sessionResponse.token,
        userId: sessionResponse.user_id,
        displayName: cleanName,
        role: authRole,
        expiresAt: sessionResponse.expires_at,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
    } catch (error) {
      console.error('Authentication failed:', error);
      setAuthError(ui.authCreateError);
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const peer = new Peer(randomId, {
      host: PEER_SERVER_HOST,
      port: PEER_SERVER_PORT,
      path: PEER_SERVER_PATH,
      secure: PEER_SERVER_SECURE,
      config: { iceServers: ICE_SERVERS },
    });

    peer.on('open', (id: string) => {
      setPeerId(id);
      setPeerConnectionState('connected');
      console.log(`My peer ID is: ${id}`);
    });

    peer.on('call', async (call: any) => {
      if (!sessionRef.current) {
        call.close();
        alert('Authenticate before answering calls.');
        return;
      }
      try {
        const profile = QUALITY_PROFILES[qualityRef.current];
        const stream = cameraStreamRef.current ?? await navigator.mediaDevices.getUserMedia({
          video: { width: profile.width, height: profile.height },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        cameraStreamRef.current = stream;
        activeCallIdRef.current = crypto.randomUUID();
        consentRegisteredRef.current = false;
        setRecordingConsentGranted(false);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        call.answer(stream);
        currentCallRef.current = call;
        handleCall(call, stream);
        applyBitrateLimit(call, profile.maxBitrate);
      } catch (err) {
        console.error('Failed to answer call:', err);
        alert('Could not access camera/microphone to answer the call.');
      }
    });

    peer.on('connection', (conn: any) => {
      dataConnRef.current = conn;
      setupDataChannel(conn);
    });

    peer.on('error', (err: any) => {
      console.error('PeerJS error:', err);
      setPeerConnectionState('down');
      if (statusRef.current === CallStatus.ACTIVE) {
        setNetworkNotice(`Peer connection error: ${err.type}. Attempting recovery.`);
      }
    });

    peer.on('disconnected', () => {
      setPeerConnectionState('reconnecting');
      setNetworkNotice('Signaling disconnected. Reconnecting...');
      trackTelemetry('peer_reconnecting');
      peer.reconnect();
    });

    peer.on('close', () => {
      setPeerConnectionState('down');
    });

    peerRef.current = peer;

    return () => {
      recordingStopRef.current?.();
      streamingStopRef.current?.();
      peer.destroy();
    };
  }, [applyBitrateLimit, handleCall, setupDataChannel, trackTelemetry]);

  const sendChatMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !dataConnRef.current) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'me',
      text: chatInput,
      timestamp: Date.now(),
    };

    dataConnRef.current.send({ type: 'chat', text: chatInput });
    setMessages((prev) => [...prev, newMessage]);
    setChatInput('');
  };

  const translateMessage = async (msg: ChatMessage) => {
    if (translatingMessageId || !session) return;
    setTranslatingMessageId(msg.id);

    try {
      const source = msg.sender === 'peer' ? remoteLang : myLang;
      const target = msg.sender === 'peer' ? myLang : remoteLang;
      const response = await apiPost<{ translated_text: string }>('/api/chat/translate', {
        token: session.token,
        text: msg.text,
        source_lang: source,
        target_lang: target,
      });

      if (response.translated_text) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, translatedText: response.translated_text } : m)),
        );
        if (session?.token) refreshUsageSummary(session.token);
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setTranslatingMessageId(null);
    }
  };

  const speakMessage = async (msg: ChatMessage) => {
    if (speakingMessageId || !session) return;
    setSpeakingMessageId(msg.id);

    try {
      const source = msg.sender === 'peer' ? remoteLang : myLang;
      const target = msg.sender === 'peer' ? myLang : remoteLang;
      const ttsResponse = await apiPost<{ text_to_speak: string; voice_lang: string }>('/api/chat/tts', {
        token: session.token,
        text: msg.translatedText || msg.text,
        source_lang: source,
        target_lang: target,
      });
      const textToSpeak = ttsResponse.text_to_speak;

      if (!textToSpeak) return;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = ttsResponse.voice_lang || (msg.sender === 'peer' ? myLang : remoteLang);
      utterance.rate = 1;
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      refreshUsageSummary(session.token);
    } catch (error) {
      console.error('TTS error:', error);
      setSpeakingMessageId(null);
    }
  };

  const initiateCall = async () => {
    if (!session) return alert('Authenticate before starting calls.');
    if (CALL_TOPOLOGY === 'sfu') {
      if (ENABLE_INSERTABLE_E2EE && REQUIRE_INSERTABLE_E2EE && !supportsInsertableStreams()) {
        alert('This browser does not support Insertable Streams required for E2EE in SFU mode.');
        trackTelemetry('sfu_e2ee_blocked', { reason: 'unsupported_browser' });
        return;
      }
      if (ENABLE_INSERTABLE_E2EE && REQUIRE_INSERTABLE_E2EE && !E2EE_SHARED_KEY.trim()) {
        alert('E2EE shared key is required in SFU mode but not configured.');
        trackTelemetry('sfu_e2ee_blocked', { reason: 'missing_key' });
        return;
      }
      const normalizedRoomCode = extractRoomCode(targetPeerId || `ROOM-${peerId}`);
      if (!SFU_JOIN_URL) {
        alert('SFU mode is enabled but VITE_SFU_JOIN_URL is not configured.');
        return;
      }
      const joinUrl = `${SFU_JOIN_URL}${SFU_JOIN_URL.includes('?') ? '&' : '?'}room=${encodeURIComponent(normalizedRoomCode)}&name=${encodeURIComponent(session.displayName)}`;
      trackTelemetry('sfu_redirect', { room_code: normalizedRoomCode, topology: 'sfu' });
      window.open(joinUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (peerConnectionState !== 'connected') {
      return alert('Signaling is reconnecting. Wait a moment and try again.');
    }
    if (!targetPeerId) return alert(ui.joinRoomPlaceholder);

    setStatus(CallStatus.CONNECTING);
    setPreCallStatus('');

    try {
      const normalizedRoomCode = extractRoomCode(targetPeerId);
      const room = await waitForRoomPeer(normalizedRoomCode);
      if (!room.target_peer_id || !room.initiator_peer_id) {
        throw new Error('room has no counterpart');
      }

      const profile = QUALITY_PROFILES[quality];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: profile.width, height: profile.height },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      cameraStreamRef.current = stream;
      activeCallIdRef.current = crypto.randomUUID();
      consentRegisteredRef.current = false;
      setRecordingConsentGranted(false);

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const shouldInitiate = shouldInitiateCall(peerId, room.initiator_peer_id);
      if (!shouldInitiate) {
        setPreCallStatus(ui.waitingInRoom);
        setStatus(CallStatus.CONNECTING);
        trackTelemetry('waiting_in_room', { room_code: normalizedRoomCode });
        return;
      }

      const call = peerRef.current?.call(room.target_peer_id, stream);
      const conn = peerRef.current?.connect(room.target_peer_id);
      if (!call || !conn) throw new Error('Peer connection unavailable');

      setupCaptionChannels(call, true);
      currentCallRef.current = call;
      dataConnRef.current = conn;
      setupDataChannel(conn);
      handleCall(call, stream);
      applyBitrateLimit(call, profile.maxBitrate);
      trackTelemetry('call_attempt_started', { room_code: normalizedRoomCode });
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setStatus(CallStatus.IDLE);
      alert('Error: camera/mic denied or room connection timeout.');
    }
  };

  const isRecording = recording.isRecording;

  const toggleScreenShare = async () => {
    if (!currentCallRef.current || status !== CallStatus.ACTIVE) return;

    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];

        const sender = currentCallRef.current.peerConnection
          .getSenders()
          .find((s: any) => s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        videoTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (cameraStreamRef.current && currentCallRef.current) {
      const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
      const sender = currentCallRef.current.peerConnection
        .getSenders()
        .find((s: any) => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = cameraStreamRef.current;
      }
    }

    setIsScreenSharing(false);
  };

  const registerConsent = async () => {
    if (!session || !activeCallIdRef.current || consentRegisteredRef.current) return;
    const response = await apiPost<ConsentResponse>('/api/sessions/consent', {
      token: session.token,
      call_id: activeCallIdRef.current,
      consent_recording: true,
    });
    if (response.status === 'ok') {
      consentRegisteredRef.current = true;
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      recording.toggleRecording();
      return;
    }

    if (!recordingConsentGranted) {
      setShowConsentModal(true);
      return;
    }

    try {
      await registerConsent();
      recording.toggleRecording();
    } catch (error) {
      console.error('Consent registration failed:', error);
      alert('Could not register recording consent. Recording was not started.');
    }
  };

  const resetCallState = useCallback(() => {
    setStatus(CallStatus.IDLE);
    setIsScreenSharing(false);
    setIsPttPressed(false);
    setIsHandsFree(false);
    localSubtitleConfirmedRef.current = '';
    remoteSubtitleConfirmedRef.current = '';
    localSubtitleTrackRef.current = { lastHypothesis: '', stableCount: 0 };
    remoteSubtitleTrackRef.current = { lastHypothesis: '', stableCount: 0 };
    setLocalSubtitleConfirmed('');
    setLocalSubtitleHypothesis('');
    setRemoteSubtitleConfirmed('');
    setRemoteSubtitleHypothesis('');
    setShowSettings(false);
    setRecordingConsentGranted(false);
    setE2eeState('off');
    consentRegisteredRef.current = false;

    currentCallRef.current = null;
    dataConnRef.current = null;

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    stopMediaStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    stopMediaStream(screenStreamRef.current);
    screenStreamRef.current = null;
    stopMediaStream(remoteStreamRef.current);
    remoteStreamRef.current = null;
    captionsHypChannelRef.current = null;
    captionsCommitChannelRef.current = null;
    subtitleSeqRef.current = 0;
    remoteSubtitleOrderRef.current = { lastHypSeq: -1, lastCommitSeq: -1 };
    seenCaptionIdsRef.current = [];
    callStartedAtRef.current = null;
    firstRemoteSubtitleAtRef.current = null;
    captionLagSamplesRef.current = [];
    hypothesisSentRef.current = 0;
    hypothesisDroppedRef.current = 0;
  }, []);

  useEffect(() => {
    resetCallStateRef.current = resetCallState;
  }, [resetCallState]);

  const endCall = () => {
    if (isRecording) recording.stopRecording();
    stopStreaming();

    if (dataConnRef.current?.open) {
      dataConnRef.current.close();
    }
    if (currentCallRef.current) {
      currentCallRef.current.close();
    }

    const lagSamples = captionLagSamplesRef.current;
    const p50 = percentile(lagSamples, 50);
    const p95 = percentile(lagSamples, 95);
    const droppedRate =
      hypothesisSentRef.current > 0
        ? Number(((hypothesisDroppedRef.current / hypothesisSentRef.current) * 100).toFixed(2))
        : 0;
    trackTelemetry('caption_metrics', {
      ttfc_ms:
        callStartedAtRef.current && firstRemoteSubtitleAtRef.current
          ? firstRemoteSubtitleAtRef.current - callStartedAtRef.current
          : -1,
      caption_lag_p50_ms: p50 ?? -1,
      caption_lag_p95_ms: p95 ?? -1,
      caption_lag_samples_ms: lagSamples.slice(-120),
      hypothesis_sent: hypothesisSentRef.current,
      hypothesis_dropped: hypothesisDroppedRef.current,
      dropped_hypothesis_rate_pct: droppedRate,
    });
    trackTelemetry('call_ended', {
      bitrate_kbps: webrtcStats.bitrateKbps ?? -1,
      packet_loss_pct: webrtcStats.packetLossPct ?? -1,
      latency_ms: latencyMs ?? -1,
    });
    resetCallState();
  };

  const handleQualityChange = (newQuality: string) => {
    setQuality(newQuality);
    if (currentCallRef.current) {
      applyBitrateLimit(currentCallRef.current, QUALITY_PROFILES[newQuality].maxBitrate);
    }
  };

  const toggleHypothesisVisibility = () => {
    const next = !showHypothesisSubtitles;
    setShowHypothesisSubtitles(next);
    trackTelemetry('caption_hypothesis_visibility', { visible: next });
  };

  const handlePttDown = () => {
    if (isHandsFree) return;
    setIsPttPressed(true);
    pttActiveRef.current = true;
    setSendActive(true);
  };

  const handlePttUp = () => {
    if (isHandsFree) return;
    setIsPttPressed(false);
    pttActiveRef.current = false;
    setSendActive(false);
  };

  const signOut = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    endCall();
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400 text-sm">{ui.validatingSession}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen w-full bg-black text-white flex items-center justify-center px-6 relative">
        <div className="absolute top-4 left-4 z-20">
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 rounded-xl px-3 py-2">
            <i className="fas fa-globe text-zinc-300 text-xs"></i>
            <select
              value={uiLocale}
              onChange={(e) => setUiLocale(e.target.value as UiLocale)}
              className="bg-transparent text-zinc-200 text-sm outline-none"
            >
              {UI_LOCALE_OPTIONS.map((locale) => (
                <option key={locale.code} value={locale.code} className="bg-zinc-900">
                  {locale.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <form
          onSubmit={handleAuthenticate}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
        >
          <h1 className="text-2xl font-bold">{ui.secureAccess}</h1>
          <p className="text-sm text-zinc-400">{ui.secureAccessDesc}</p>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-zinc-500">{ui.name}</label>
            <input
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              placeholder={ui.namePlaceholder}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-zinc-500">{ui.role}</label>
            <select
              value={authRole}
              onChange={(e) => setAuthRole(e.target.value as 'agent' | 'investor')}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="agent">{ui.agent}</option>
              <option value="investor">{ui.investor}</option>
            </select>
          </div>
          {authError ? <p className="text-sm text-red-400">{authError}</p> : null}
          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg py-2 font-semibold"
          >
            {isAuthenticating ? ui.creatingSession : ui.enterWorkspace}
          </button>
        </form>
      </div>
    );
  }

  if (status === CallStatus.IDLE || status === CallStatus.CONNECTING) {
    return (
      <div className="bg-black min-h-[100dvh]">
        <div className="px-3 pt-3 sm:px-5 sm:pt-4">
          <div className="mx-auto w-full max-w-[900px] flex flex-wrap items-center justify-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 rounded-xl px-3 py-2">
              <i className="fas fa-globe text-zinc-300 text-xs"></i>
              <select
                value={uiLocale}
                onChange={(e) => setUiLocale(e.target.value as UiLocale)}
                className="bg-transparent text-zinc-200 text-sm outline-none"
              >
                {UI_LOCALE_OPTIONS.map((locale) => (
                  <option key={locale.code} value={locale.code} className="bg-zinc-900">
                    {locale.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={signOut}
              className="bg-zinc-900 border border-zinc-700 text-xs px-3 py-2 rounded-lg text-zinc-300 hover:text-white max-w-full truncate"
            >
              {ui.signOut} ({session.displayName})
            </button>
          </div>
        </div>
        <CallSetup
          status={status}
          peerId={peerId}
          myLang={myLang}
          remoteLang={remoteLang}
          quality={quality}
          targetPeerId={targetPeerId}
          supportedLanguages={SUPPORTED_LANGUAGES}
          qualityProfiles={QUALITY_PROFILES}
          onStartCall={initiateCall}
          onQualityChange={handleQualityChange}
          onMyLangChange={setMyLang}
          onRemoteLangChange={setRemoteLang}
          onTargetPeerChange={(value) => setTargetPeerId(extractRoomCode(value))}
          onCopyPeerId={() => {
            navigator.clipboard.writeText(peerId);
            alert('Copied!');
          }}
          onCopyInviteLink={() => {
            const room = targetPeerId || `ROOM-${peerId}`;
            const url = buildInviteLink(window.location.origin, window.location.pathname, room);
            navigator.clipboard.writeText(url);
            alert('Invite link copied.');
          }}
          onRunPrecallCheck={runPrecallCheck}
          isRunningPrecallCheck={isRunningPrecallCheck}
          preCallStatus={preCallStatus}
          uiText={{
            title: ui.appTitle,
            subtitle: ui.appSubtitle,
            yourPeerId: ui.yourPeerId,
            iSpeak: ui.iSpeak,
            theySpeak: ui.theySpeak,
            callQuality: ui.callQuality,
            joinRoom: ui.joinRoom,
            joinRoomPlaceholder: ui.joinRoomPlaceholder,
            connecting: ui.connecting,
            startCall: ui.startCall,
            copyHint: ui.copyHint,
            copyInviteLink: ui.copyInviteLink,
            runPrecheck: ui.runPrecheck,
            checkingPrecheck: ui.checkingPrecheck,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden relative">
      <button
        onClick={signOut}
        className="absolute top-4 right-4 z-20 bg-zinc-900/90 border border-zinc-700 text-[11px] px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white"
      >
        {session.displayName} ({session.role})
      </button>
      <CallHeader
        peerId={peerId}
        qualityLabel={QUALITY_PROFILES[quality].label.split(' ')[0]}
        isRecording={isRecording}
        latencyMs={latencyMs}
        bitrateKbps={webrtcStats.bitrateKbps}
        packetLossPct={webrtcStats.packetLossPct}
        peerConnectionState={peerConnectionState}
        translationConnectionState={translationConnectionState}
        translationReconnectAttempts={translationReconnectAttempts}
        e2eeState={e2eeState}
      />

      {networkNotice ? (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs max-w-[90vw] text-center">
          {networkNotice}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 relative flex">
        <div className="flex-1 p-4 md:p-6 min-h-0">
          <VideoGrid
            remoteVideoRef={remoteVideoRef}
            localVideoRef={localVideoRef}
            remoteSubtitleConfirmed={remoteSubtitleConfirmed}
            remoteSubtitleHypothesis={remoteSubtitleHypothesis}
            localSubtitleConfirmed={localSubtitleConfirmed}
            localSubtitleHypothesis={localSubtitleHypothesis}
            isScreenSharing={isScreenSharing}
            isPttPressed={isPttPressed}
            isHandsFree={isHandsFree}
            showHypothesis={showHypothesisSubtitles}
          />
        </div>

        <ChatSidebar
          isChatOpen={isChatOpen}
          messages={messages}
          chatInput={chatInput}
          speakingMessageId={speakingMessageId}
          translatingMessageId={translatingMessageId}
          canExportTranscript={transcriptEntries.length > 0}
          onClose={() => setIsChatOpen(false)}
          onExportVtt={exportTranscriptVtt}
          onExportSrt={exportTranscriptSrt}
          onTranslate={translateMessage}
          onSpeak={speakMessage}
          onChatInputChange={setChatInput}
          onSendMessage={sendChatMessage}
          chatEndRef={chatEndRef}
        />
      </div>

      <SettingsModal
        show={showSettings}
        quality={quality}
        showHypothesis={showHypothesisSubtitles}
        qualityProfiles={QUALITY_PROFILES}
        onSelectQuality={handleQualityChange}
        onToggleHypothesis={toggleHypothesisVisibility}
        onClose={() => setShowSettings(false)}
      />

      {showConsentModal ? (
        <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 space-y-4">
            <h2 className="text-xl font-bold">Recording consent required</h2>
            <p className="text-sm text-zinc-300">
              By starting recording, you confirm all participants gave explicit consent for recording
              and storage according to your legal obligations.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConsentModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setRecordingConsentGranted(true);
                  setShowConsentModal(false);
                  await handleToggleRecording();
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white"
              >
                I confirm consent
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ControlBar
        isHandsFree={isHandsFree}
        isPttPressed={isPttPressed}
        isMuted={isMuted}
        remoteVolume={remoteVolume}
        isScreenSharing={isScreenSharing}
        isRecording={isRecording}
        showSettings={showSettings}
        isChatOpen={isChatOpen}
        hasUnreadPeerMessages={hasUnreadPeerMessages}
        myLangName={myLangName}
        remoteLangName={remoteLangName}
        onToggleHandsFree={() => setIsHandsFree(!isHandsFree)}
        onPttDown={handlePttDown}
        onPttUp={handlePttUp}
        onToggleMute={() => setIsMuted(!isMuted)}
        onRemoteVolumeChange={(value) => {
          setRemoteVolume(value);
          if (isMuted) setIsMuted(false);
        }}
        onToggleScreenShare={toggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onShowSettings={() => setShowSettings(true)}
        onEndCall={endCall}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
      />

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
