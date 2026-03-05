
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import {
  SUPPORTED_LANGUAGES,
  SAMPLE_RATE,
  ASR_MT_WS_URL,
  AUDIO_CHUNK_FRAMES,
  VAD_THRESHOLD,
  PEER_SERVER_HOST,
  PEER_SERVER_PORT,
  PEER_SERVER_PATH,
  PEER_SERVER_SECURE,
  ICE_SERVERS,
} from './constants';
import { CallStatus } from './types';
import { decode, decodeAudioData } from './utils/audioUtils';
import { useWebRtcStats } from './hooks/useWebRtcStats';
import { useStreamingTranslation } from './hooks/useStreamingTranslation';
import { useRecording } from './hooks/useRecording';
import CallHeader from './components/CallHeader';
import CallSetup from './components/CallSetup';
import ChatSidebar from './components/ChatSidebar';
import VideoGrid from './components/VideoGrid';
import ControlBar from './components/ControlBar';
import SettingsModal from './components/SettingsModal';

// Explicitly declare PeerJS for the environment
declare const Peer: any;

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

const QUALITY_PROFILES: Record<string, QualityProfile> = {
  low: { label: 'Low (360p)', width: 640, height: 360, maxBitrate: 500000 },
  medium: { label: 'Medium (720p)', width: 1280, height: 720, maxBitrate: 1500000 },
  high: { label: 'High (1080p)', width: 1920, height: 1080, maxBitrate: 4000000 },
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
  
  // Translation & Chat states
  const [localSubtitle, setLocalSubtitle] = useState('');
  const [remoteSubtitle, setRemoteSubtitle] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [translatingMessageId, setTranslatingMessageId] = useState<string | null>(null);
  
  // Media refs
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
  
  // Recording refs
  // Communication refs
  const peerRef = useRef<any>(null);
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
  const { latencyMs, setSendActive, start: startStreaming, stop: stopStreaming } = streaming;
  const hasUnreadPeerMessages = !isChatOpen && messages.some((msg) => msg.sender === 'peer');
  const myLangName = SUPPORTED_LANGUAGES.find(l => l.code === myLang)?.name || myLang;
  const remoteLangName = SUPPORTED_LANGUAGES.find(l => l.code === remoteLang)?.name || remoteLang;
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
  
  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  // Sync volume with remote video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isMuted ? 0 : remoteVolume;
    }
    remoteVolumeRef.current = remoteVolume;
  }, [remoteVolume, isMuted]);

  // Sync handsfree ref
  useEffect(() => {
    handsFreeActiveRef.current = isHandsFree;
    setSendActive(isHandsFree || pttActiveRef.current);
  }, [isHandsFree, setSendActive]);

  useEffect(() => {
    qualityRef.current = quality;
  }, [quality]);

  const recordingStopRef = useRef(recording.stopRecording);
  const streamingStartRef = useRef(startStreaming);
  const streamingStopRef = useRef(stopStreaming);
  useEffect(() => {
    recordingStopRef.current = recording.stopRecording;
    streamingStartRef.current = startStreaming;
    streamingStopRef.current = stopStreaming;
  }, [recording.stopRecording, startStreaming, stopStreaming]);

  // Initialization of PeerJS
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
      console.log('My peer ID is: ' + id);
    });

    peer.on('call', async (call: any) => {
      try {
        const profile = QUALITY_PROFILES[qualityRef.current];
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: profile.width, height: profile.height }, 
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });
        cameraStreamRef.current = stream;
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
      setStatus(CallStatus.IDLE);
      alert('Connection error: ' + err.type);
    });

    peerRef.current = peer;
    return () => {
      recordingStopRef.current?.();
      streamingStopRef.current?.();
      peer.destroy();
    };
  }, [applyBitrateLimit, handleCall, setupDataChannel]);

  const applyBitrateLimit = useCallback(async (call: any, maxBitrate: number) => {
    if (!call.peerConnection) return;
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
    conn.on('data', (data: any) => {
      if (data.type === 'subtitle') {
        setRemoteSubtitle(data.text);
        setTimeout(() => setRemoteSubtitle(prev => prev === data.text ? '' : prev), 4000);
      } else if (data.type === 'chat') {
        const newMessage: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          sender: 'peer',
          text: data.text,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
        setIsChatOpen(prev => prev || true);
      }
    });
  }, []);

  const sendChatMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !dataConnRef.current) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'me',
      text: chatInput,
      timestamp: Date.now()
    };

    dataConnRef.current.send({ type: 'chat', text: chatInput });
    setMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  const translateMessage = async (msg: ChatMessage) => {
    if (translatingMessageId) return;
    setTranslatingMessageId(msg.id);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const myLangName = SUPPORTED_LANGUAGES.find(l => l.code === myLang)?.name || 'English';
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following text into ${myLangName}. Only return the translated text: "${msg.text}"`,
      });

      const translatedText = response.text?.trim();
      if (translatedText) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, translatedText } : m));
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setTranslatingMessageId(null);
    }
  };

  const speakMessage = async (msg: ChatMessage) => {
    if (speakingMessageId) return;
    setSpeakingMessageId(msg.id);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const myLangName = SUPPORTED_LANGUAGES.find(l => l.code === myLang)?.name || 'English';
      
      const prompt = `Translate this message to ${myLangName} if it's in another language, then say it clearly: "${msg.text}"`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          outputAudioContext,
          24000,
          1,
        );
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        source.onended = () => {
          setSpeakingMessageId(null);
          outputAudioContext.close();
        };
        source.start();
      } else {
        setSpeakingMessageId(null);
      }
    } catch (error) {
      console.error('TTS error:', error);
      setSpeakingMessageId(null);
    }
  };

  const handleCall = useCallback((call: any, stream: MediaStream) => {
    setStatus(CallStatus.ACTIVE);
    call.on('stream', (remoteStream: MediaStream) => {
      remoteStreamRef.current = remoteStream;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.volume = remoteVolumeRef.current;
      }
    });
    streamingStartRef.current(stream);
  }, []);

  const initiateCall = async () => {
    if (!targetPeerId) return alert('Enter a Peer ID to call');
    if (targetPeerId === peerId) return alert('You cannot call yourself. Please ask for the other person\'s Peer ID.');
    
    setStatus(CallStatus.CONNECTING);
    
    try {
      const profile = QUALITY_PROFILES[quality];
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: profile.width, height: profile.height }, 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      cameraStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      const call = peerRef.current.call(targetPeerId, stream);
      currentCallRef.current = call;
      const conn = peerRef.current.connect(targetPeerId);
      
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
        
        const sender = currentCallRef.current.peerConnection.getSenders().find((s: any) => s.track.kind === 'video');
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
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    if (cameraStreamRef.current && currentCallRef.current) {
      const videoTrack = cameraStreamRef.current.getVideoTracks()[0];
      const sender = currentCallRef.current.peerConnection.getSenders().find((s: any) => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = cameraStreamRef.current;
      }
    }

    setIsScreenSharing(false);
  };


  const endCall = () => {
    if (isRecording) recording.stopRecording();
    stopStreaming();
    window.location.reload();
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

  if (status === CallStatus.IDLE || status === CallStatus.CONNECTING) {
    return (
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
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden relative">
      <CallHeader
        peerId={peerId}
        qualityLabel={QUALITY_PROFILES[quality].label.split(' ')[0]}
        isRecording={isRecording}
        latencyMs={latencyMs}
        bitrateKbps={webrtcStats.bitrateKbps}
        packetLossPct={webrtcStats.packetLossPct}
      />

      {/* Main Content Area */}
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
        onToggleRecording={recording.toggleRecording}
        onShowSettings={() => setShowSettings(true)}
        onEndCall={endCall}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
      />

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
