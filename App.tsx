import React, { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'peerjs';
import {
  SUPPORTED_LANGUAGES,
  SAMPLE_RATE,
  ASR_MT_WS_URL,
  ASR_MT_HTTP_URL,
  AUDIO_CHUNK_FRAMES,
  VAD_THRESHOLD,
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

type UiLocale = 'es' | 'en' | 'de' | 'ru' | 'fr' | 'it';

const QUALITY_PROFILES: Record<string, QualityProfile> = {
  low: { label: 'Low (360p)', width: 640, height: 360, maxBitrate: 500000 },
  medium: { label: 'Medium (720p)', width: 1280, height: 720, maxBitrate: 1500000 },
  high: { label: 'High (1080p)', width: 1920, height: 1080, maxBitrate: 4000000 },
};

const SESSION_STORAGE_KEY = 'anclora_linguo_session';
const UI_LOCALE_STORAGE_KEY = 'anclora_linguo_ui_locale';

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
    appTitle: 'LinguoCam',
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
    appTitle: 'LinguoCam',
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
    appTitle: 'LinguoCam',
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
    appTitle: 'LinguoCam',
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
    appTitle: 'LinguoCam',
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
    appTitle: 'LinguoCam',
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

  const [localSubtitle, setLocalSubtitle] = useState('');
  const [remoteSubtitle, setRemoteSubtitle] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState<'agent' | 'investor'>('agent');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [uiLocale, setUiLocale] = useState<UiLocale>(() => {
    const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY) as UiLocale | null;
    return stored && UI_TEXTS[stored] ? stored : 'es';
  });
  const [peerConnectionState, setPeerConnectionState] = useState<'connected' | 'reconnecting' | 'down'>('connected');
  const [networkNotice, setNetworkNotice] = useState<string>('');

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

  const peerRef = useRef<Peer | null>(null);
  const currentCallRef = useRef<any>(null);
  const dataConnRef = useRef<any>(null);

  const webrtcStats = useWebRtcStats(
    currentCallRef.current?.peerConnection ?? null,
    status === CallStatus.ACTIVE,
  );

  const streaming = useStreamingTranslation({
    wsUrl: ASR_MT_WS_URL,
    sampleRate: SAMPLE_RATE,
    chunkFrames: AUDIO_CHUNK_FRAMES,
    vadThreshold: VAD_THRESHOLD,
    sourceLang: myLang,
    targetLang: remoteLang,
    onSubtitle: (text, isFinal) => {
      setLocalSubtitle(text);
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({ type: 'subtitle', text });
      }
      if (isFinal) {
        setTimeout(() => setLocalSubtitle(''), 3000);
      }
    },
  });

  const {
    latencyMs,
    connectionState: translationConnectionState,
    reconnectAttempts: translationReconnectAttempts,
    setSendActive,
    start: startStreaming,
    stop: stopStreaming,
  } = streaming;

  const hasUnreadPeerMessages = !isChatOpen && messages.some((msg) => msg.sender === 'peer');
  const myLangName = SUPPORTED_LANGUAGES.find((l) => l.code === myLang)?.name || myLang;
  const remoteLangName = SUPPORTED_LANGUAGES.find((l) => l.code === remoteLang)?.name || remoteLang;
  const ui = UI_TEXTS[uiLocale];

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

  const setupDataChannel = useCallback((conn: any) => {
    conn.on('open', () => {
      setNetworkNotice('');
    });

    conn.on('data', (data: any) => {
      if (data.type === 'subtitle') {
        setRemoteSubtitle(data.text);
        setTimeout(() => setRemoteSubtitle((prev) => (prev === data.text ? '' : prev)), 4000);
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
  }, []);

  const handleCall = useCallback((call: any, stream: MediaStream) => {
    setStatus(CallStatus.ACTIVE);
    setNetworkNotice('');
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
    });
    streamingStartRef.current(stream);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isMuted ? 0 : remoteVolume;
    }
    remoteVolumeRef.current = remoteVolume;
  }, [remoteVolume, isMuted]);

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
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, uiLocale);
  }, [uiLocale]);

  useEffect(() => {
    if (!HAS_TURN_SERVER) {
      setNetworkNotice(
        'TURN not configured. Calls may fail on restrictive NAT/firewall networks.',
      );
    }
  }, []);

  useEffect(() => {
    if (status !== CallStatus.ACTIVE) return;
    if (translationConnectionState === 'reconnecting') {
      setNetworkNotice(
        `Translation stream reconnecting (attempt ${translationReconnectAttempts}/${5})...`,
      );
      return;
    }
    if (translationConnectionState === 'error') {
      setNetworkNotice('Translation stream disconnected. Subtitles may be delayed.');
      return;
    }
    if (translationConnectionState === 'connected') {
      setNetworkNotice('');
    }
  }, [status, translationConnectionState, translationReconnectAttempts]);

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
        const stream = await navigator.mediaDevices.getUserMedia({
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
  }, [applyBitrateLimit, handleCall, setupDataChannel]);

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
    if (peerConnectionState !== 'connected') {
      return alert('Signaling is reconnecting. Wait a moment and try again.');
    }
    if (!targetPeerId) return alert('Enter a Peer ID to call');
    if (targetPeerId === peerId) {
      return alert("You cannot call yourself. Please ask for the other person's Peer ID.");
    }

    setStatus(CallStatus.CONNECTING);

    try {
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

      const call = peerRef.current?.call(targetPeerId, stream);
      const conn = peerRef.current?.connect(targetPeerId);
      if (!call || !conn) throw new Error('Peer connection unavailable');

      currentCallRef.current = call;
      dataConnRef.current = conn;
      setupDataChannel(conn);
      handleCall(call, stream);
      applyBitrateLimit(call, profile.maxBitrate);
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setStatus(CallStatus.IDLE);
      alert('Error: Camera or Microphone access was denied. Please allow permissions and try again.');
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
    setLocalSubtitle('');
    setRemoteSubtitle('');
    setShowSettings(false);
    setRecordingConsentGranted(false);
    consentRegisteredRef.current = false;

    currentCallRef.current = null;
    dataConnRef.current = null;

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
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

    resetCallState();
  };

  const handleQualityChange = (newQuality: string) => {
    setQuality(newQuality);
    if (currentCallRef.current) {
      applyBitrateLimit(currentCallRef.current, QUALITY_PROFILES[newQuality].maxBitrate);
    }
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
      <div className="relative">
        <div className="absolute top-4 left-4 z-10">
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
        <button
          onClick={signOut}
          className="absolute top-4 right-4 z-10 bg-zinc-900 border border-zinc-700 text-xs px-3 py-2 rounded-lg text-zinc-300 hover:text-white"
        >
          {ui.signOut} ({session.displayName})
        </button>
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
          onTargetPeerChange={setTargetPeerId}
          onCopyPeerId={() => {
            navigator.clipboard.writeText(peerId);
            alert('Copied!');
          }}
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
      {usageSummary ? (
        <div className="absolute top-14 right-4 z-20 bg-zinc-900/90 border border-zinc-700 text-[11px] px-3 py-1.5 rounded-lg text-zinc-300">
          MT {usageSummary.translated_chars}/{usageSummary.translated_limit} | TTS {usageSummary.tts_chars}/{usageSummary.tts_limit}
        </div>
      ) : null}

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
      />

      {networkNotice ? (
        <div className="absolute top-24 left-6 z-50 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          {networkNotice}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 relative flex">
        <div className="flex-1 p-4 md:p-6 min-h-0">
          <VideoGrid
            remoteVideoRef={remoteVideoRef}
            localVideoRef={localVideoRef}
            remoteSubtitle={remoteSubtitle}
            localSubtitle={localSubtitle}
            isScreenSharing={isScreenSharing}
            isPttPressed={isPttPressed}
            isHandsFree={isHandsFree}
          />
        </div>

        <ChatSidebar
          isChatOpen={isChatOpen}
          messages={messages}
          chatInput={chatInput}
          speakingMessageId={speakingMessageId}
          translatingMessageId={translatingMessageId}
          onClose={() => setIsChatOpen(false)}
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
        qualityProfiles={QUALITY_PROFILES}
        onSelectQuality={handleQualityChange}
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
