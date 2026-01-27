
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { SUPPORTED_LANGUAGES, GEMINI_MODEL, SAMPLE_RATE, OUTPUT_SAMPLE_RATE, FRAME_RATE, JPEG_QUALITY } from './constants';
import { CallStatus } from './types';
import { encode, decode, decodeAudioData, blobToBase64 } from './utils/audioUtils';

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
  const [isRecording, setIsRecording] = useState(false);
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
  
  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingRequestRef = useRef<number | null>(null);
  
  // Communication refs
  const peerRef = useRef<any>(null);
  const currentCallRef = useRef<any>(null);
  const dataConnRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  
  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  // Sync volume with remote video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isMuted ? 0 : remoteVolume;
    }
  }, [remoteVolume, isMuted]);

  // Sync handsfree ref
  useEffect(() => {
    handsFreeActiveRef.current = isHandsFree;
  }, [isHandsFree]);

  // Initialization of PeerJS
  useEffect(() => {
    const randomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const peer = new Peer(randomId);
    
    peer.on('open', (id: string) => {
      setPeerId(id);
      console.log('My peer ID is: ' + id);
    });

    peer.on('call', async (call: any) => {
      try {
        const profile = QUALITY_PROFILES[quality];
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: profile.width, height: profile.height }, 
          audio: true 
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
      if (recordingRequestRef.current) cancelAnimationFrame(recordingRequestRef.current);
      peer.destroy();
    };
  }, []);

  const applyBitrateLimit = async (call: any, maxBitrate: number) => {
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
  };

  const setupDataChannel = (conn: any) => {
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
        if (!isChatOpen) setIsChatOpen(true);
      }
    });
  };

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

  const handleCall = (call: any, stream: MediaStream) => {
    setStatus(CallStatus.ACTIVE);
    call.on('stream', (remoteStream: MediaStream) => {
      remoteStreamRef.current = remoteStream;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.volume = remoteVolume;
      }
    });
    startGeminiTranslation(stream);
  };

  const initiateCall = async () => {
    if (!targetPeerId) return alert('Enter a Peer ID to call');
    if (targetPeerId === peerId) return alert('You cannot call yourself. Please ask for the other person\'s Peer ID.');
    
    setStatus(CallStatus.CONNECTING);
    
    try {
      const profile = QUALITY_PROFILES[quality];
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: profile.width, height: profile.height }, 
        audio: true 
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

  // Recording Logic
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    if (!cameraStreamRef.current || !remoteStreamRef.current) {
      alert("Call must be active to start recording");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions (composting side-by-side)
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    recordedChunksRef.current = [];

    // Audio Mixing
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();

    const localAudioSource = audioCtx.createMediaStreamSource(cameraStreamRef.current);
    const remoteAudioSource = audioCtx.createMediaStreamSource(remoteStreamRef.current);
    
    localAudioSource.connect(dest);
    remoteAudioSource.connect(dest);

    // Canvas Compositing Loop
    const drawFrame = () => {
      if (!isRecording) return;
      
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Remote Video (Left)
      if (remoteVideoRef.current) {
        ctx.drawImage(remoteVideoRef.current, 0, 0, canvas.width / 2, canvas.height);
      }

      // Draw Local Video (Right)
      if (localVideoRef.current) {
        // Handle mirroring if it's camera
        if (!isScreenSharing) {
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(localVideoRef.current, 0, 0, canvas.width / 2, canvas.height);
          ctx.restore();
        } else {
          ctx.drawImage(localVideoRef.current, canvas.width / 2, 0, canvas.width / 2, canvas.height);
        }
      }

      // Draw Subtitles
      const drawSub = (text: string, yPos: number, bgColor: string) => {
        if (!text) return;
        ctx.font = 'bold 32px Inter, Arial';
        const padding = 20;
        const textWidth = ctx.measureText(text).width;
        
        ctx.fillStyle = bgColor;
        ctx.roundRect(canvas.width / 2 - textWidth / 2 - padding, yPos - 40, textWidth + padding * 2, 60, 10);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(text, canvas.width / 2, yPos);
      };

      drawSub(remoteSubtitle, canvas.height - 120, 'rgba(0, 122, 255, 0.8)');
      drawSub(localSubtitle, canvas.height - 50, 'rgba(255, 255, 255, 0.2)');

      recordingRequestRef.current = requestAnimationFrame(drawFrame);
    };

    setIsRecording(true);
    requestAnimationFrame(drawFrame);

    // Combine canvas stream and mixed audio
    const canvasStream = canvas.captureStream(30);
    const finalStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp9,opus' });
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linguocam-call-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingRequestRef.current) cancelAnimationFrame(recordingRequestRef.current);
    setIsRecording(false);
  };

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

  const startGeminiTranslation = async (stream: MediaStream) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    audioContextRef.current = inputCtx;

    const myLangName = SUPPORTED_LANGUAGES.find(l => l.code === myLang)?.name;
    const remoteLangName = SUPPORTED_LANGUAGES.find(l => l.code === remoteLang)?.name;

    const systemInstruction = `
      You are a real-time translator for a 2-way call.
      The user (me) is speaking ${myLangName}.
      The other person is speaking ${remoteLangName}.
      YOUR ROLE:
      1. Listen to the user's audio input.
      2. Immediately translate it into ${remoteLangName}.
      3. Return the translation via 'outputAudioTranscription'.
      4. DO NOT provide audio output, ONLY text transcription of the TRANSLATED message.
      5. The audio stream is continuous. Generate subtitles as you hear speech.
      6. If you hear silence or non-speech, do not output anything.
    `;

    const sessionPromise = ai.live.connect({
      model: GEMINI_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          console.debug('Live session opened');
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            const translatedText = message.serverContent.outputTranscription.text;
            setLocalSubtitle(translatedText);
            
            if (dataConnRef.current && dataConnRef.current.open) {
              dataConnRef.current.send({ type: 'subtitle', text: translatedText });
            }
          }
          if (message.serverContent?.turnComplete) {
            setTimeout(() => setLocalSubtitle(''), 3000);
          }
        },
        onerror: (e: ErrorEvent) => {
          console.debug('Live session error:', e);
        },
        onclose: (e: CloseEvent) => {
          console.debug('Live session closed:', e);
        },
      }
    });

    const source = inputCtx.createMediaStreamSource(stream);
    const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
    scriptProcessor.onaudioprocess = (e) => {
      // Send if PTT is active OR if Hands-Free mode is enabled
      if (!pttActiveRef.current && !handsFreeActiveRef.current) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
      
      sessionPromise.then((activeSession) => {
        activeSession.sendRealtimeInput({
          media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
        });
      });
    };
    source.connect(scriptProcessor);
    scriptProcessor.connect(inputCtx.destination);
  };

  const endCall = () => {
    if (isRecording) stopRecording();
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
  };

  const handlePttUp = () => {
    if (isHandsFree) return;
    setIsPttPressed(false);
    pttActiveRef.current = false;
  };

  if (status === CallStatus.IDLE || status === CallStatus.CONNECTING) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black px-6">
        <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
          <div className="text-center relative">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/20">
              <i className="fas fa-globe-americas text-4xl text-white"></i>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">LinguoCam</h1>
            <p className="text-zinc-500 font-medium">Global communication, zero barriers.</p>
          </div>

          <div className="glass-panel rounded-3xl p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-zinc-500 tracking-widest px-1">Your Peer ID</label>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group">
                  <span className="text-2xl font-mono font-bold text-blue-400">{peerId || '...'}</span>
                  <button onClick={() => {navigator.clipboard.writeText(peerId); alert('Copied!')}} className="text-zinc-500 hover:text-white transition-colors">
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-zinc-500 px-1">I speak</label>
                  <select value={myLang} onChange={(e) => setMyLang(e.target.value)} className="bg-zinc-800 rounded-xl p-3 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-white">
                    {SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-zinc-500 px-1">They speak</label>
                  <select value={remoteLang} onChange={(e) => setRemoteLang(e.target.value)} className="bg-zinc-800 rounded-xl p-3 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-white">
                    {SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-zinc-500 px-1">Call Quality</label>
                <select 
                  value={quality} 
                  onChange={(e) => handleQualityChange(e.target.value)} 
                  className="bg-zinc-800 rounded-xl p-3 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-white"
                >
                  {Object.entries(QUALITY_PROFILES).map(([key, profile]) => (
                    <option key={key} value={key}>{profile.label}</option>
                  ))}
                </select>
              </div>

              <div className="h-px bg-white/10 my-2"></div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-zinc-500 px-1">Join Room</label>
                <input 
                  type="text" 
                  placeholder="Enter Peer ID to call..." 
                  value={targetPeerId}
                  onChange={(e) => setTargetPeerId(e.target.value.toUpperCase())}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
                />
              </div>
            </div>

            <button 
              onClick={initiateCall}
              disabled={status === CallStatus.CONNECTING}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3"
            >
              {status === CallStatus.CONNECTING ? (
                <i className="fas fa-circle-notch animate-spin"></i>
              ) : (
                <i className="fas fa-phone"></i>
              )}
              {status === CallStatus.CONNECTING ? 'Connecting...' : 'Start Translation Call'}
            </button>
          </div>

          <p className="text-center text-zinc-600 text-xs">
            Ask the other person for their Peer ID to connect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden relative">
      {/* Call Header */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-4 bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/10">
        <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center">
          <i className="fas fa-link text-white"></i>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Session ID</h2>
          <p className="font-mono font-bold text-white">{peerId}</p>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-50 flex flex-col items-end gap-2">
        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-[10px] font-bold tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
          {QUALITY_PROFILES[quality].label.split(' ')[0]} QUALITY
        </div>
        {isRecording && (
          <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-[10px] font-bold tracking-widest flex items-center gap-2 animate-pulse">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
            REC • RECORDING CALL
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative flex">
        <div className="flex-1 p-4 md:p-6 min-h-0">
          <div className="video-grid">
            <div className="video-box group">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-lg text-xs font-bold text-white">Remote Participant</div>
              
              {remoteSubtitle && (
                <div className="subtitle-area">
                  <div className="subtitle-bubble">
                    <p className="text-xl md:text-3xl font-bold text-white tracking-wide text-center leading-tight">
                      {remoteSubtitle}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="video-box border-blue-500/30">
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className={`w-full h-full object-cover ${!isScreenSharing ? 'scale-x-[-1]' : ''}`} 
              />
              <div className="absolute top-4 left-4 bg-blue-600/50 px-3 py-1 rounded-lg text-xs font-bold text-white">
                {isScreenSharing ? 'Sharing Screen' : 'You (Host)'}
              </div>
              
              {localSubtitle && (
                <div className="subtitle-area">
                  <div className="subtitle-bubble opacity-60 scale-90">
                    <p className="text-lg font-bold text-white tracking-wide text-center">
                      {localSubtitle}
                    </p>
                  </div>
                </div>
              )}

              {(isPttPressed || isHandsFree) && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className={`w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center animate-ping absolute ${isHandsFree ? 'duration-[2000ms]' : ''}`}></div>
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center z-10 shadow-2xl shadow-blue-500/50">
                    <i className="fas fa-microphone text-white text-2xl"></i>
                  </div>
                  <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.2em] mt-4 z-10">{isHandsFree ? 'Auto-Translate ON' : 'Listening...'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className={`transition-all duration-300 ease-in-out bg-zinc-900/40 backdrop-blur-2xl border-l border-white/5 flex flex-col ${isChatOpen ? 'w-80 md:w-96' : 'w-0 overflow-hidden opacity-0'}`}>
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-400">Live Chat</h3>
            <button onClick={() => setIsChatOpen(false)} className="text-zinc-500 hover:text-white">
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50 text-center px-6">
                <i className="fas fa-comments text-3xl mb-2"></i>
                <p className="text-xs">No messages yet.<br/>Type below to start chatting.</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm relative group ${msg.sender === 'me' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-200 rounded-tl-none'}`}>
                    {msg.text}
                    
                    {msg.translatedText && (
                      <div className="mt-2 pt-2 border-t border-white/10 text-blue-300 italic text-xs">
                        <i className="fas fa-language mr-2"></i>
                        {msg.translatedText}
                      </div>
                    )}

                    {msg.sender === 'peer' && (
                      <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => translateMessage(msg)}
                          disabled={translatingMessageId === msg.id || !!msg.translatedText}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${translatingMessageId === msg.id ? 'text-blue-400 animate-pulse' : msg.translatedText ? 'text-green-500 cursor-default' : 'text-zinc-500 hover:text-white'}`}
                          title="Translate message"
                        >
                          {translatingMessageId === msg.id ? (
                            <i className="fas fa-circle-notch animate-spin text-[10px]"></i>
                          ) : (
                            <i className="fas fa-language text-[10px]"></i>
                          )}
                        </button>
                        <button 
                          onClick={() => speakMessage(msg)}
                          disabled={speakingMessageId === msg.id}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${speakingMessageId === msg.id ? 'text-blue-400 animate-pulse' : 'text-zinc-500 hover:text-white'}`}
                          title="Translate & Read aloud"
                        >
                          {speakingMessageId === msg.id ? (
                            <i className="fas fa-circle-notch animate-spin text-[10px]"></i>
                          ) : (
                            <i className="fas fa-volume-up text-[10px]"></i>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-600 mt-1 uppercase font-bold tracking-tighter">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendChatMessage} className="p-4 bg-black/20 border-t border-white/5 flex gap-2">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
            />
            <button type="submit" className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 transition-colors">
              <i className="fas fa-paper-plane text-xs text-white"></i>
            </button>
          </form>
        </div>
      </div>

      {/* Settings Modal (Overlay) */}
      {showSettings && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-8 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">Call Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-zinc-500">Video Quality & Bandwidth</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(QUALITY_PROFILES).map(([key, profile]) => (
                    <button
                      key={key}
                      onClick={() => handleQualityChange(key)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${quality === key ? 'bg-blue-600/20 border-blue-600 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      <span className="font-semibold">{profile.label}</span>
                      <span className="text-[10px] opacity-70">Up to {profile.maxBitrate / 1000000}Mbps</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="h-24 glass-panel flex items-center justify-center gap-2 md:gap-5 px-4 md:px-12 rounded-t-[3rem] mt-auto relative">
        
        {/* Toggle Continuous Mode */}
        <div className="flex flex-col items-center">
          <button 
            onClick={() => setIsHandsFree(!isHandsFree)}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${isHandsFree ? 'bg-green-600 text-white ring-4 ring-green-500/20' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700'}`}
            title={isHandsFree ? 'Disable Auto-Translate' : 'Enable Auto-Translate (Continuous)'}
          >
            <i className={`fas ${isHandsFree ? 'fa-magic animate-pulse' : 'fa-headset'}`}></i>
          </button>
          <span className="text-[9px] font-bold text-zinc-500 mt-1 uppercase tracking-tighter">{isHandsFree ? 'LIVE' : 'AUTO'}</span>
        </div>

        {/* Push to Talk Button */}
        {!isHandsFree && (
          <div className="flex flex-col items-center">
            <button 
              onMouseDown={handlePttDown}
              onMouseUp={handlePttUp}
              onMouseLeave={handlePttUp}
              onTouchStart={handlePttDown}
              onTouchEnd={handlePttUp}
              className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all select-none touch-none ${isPttPressed ? 'bg-blue-600 scale-90 shadow-inner' : 'bg-zinc-800/50 hover:bg-zinc-700 shadow-lg'}`}
              title="Hold to Speak"
            >
              <i className={`fas fa-microphone ${isPttPressed ? 'text-white' : 'text-zinc-400'}`}></i>
            </button>
            <span className="text-[9px] font-bold text-zinc-500 mt-1 uppercase tracking-tighter">PTT</span>
          </div>
        )}

        {/* Remote Volume Control */}
        <div className="flex items-center gap-2 bg-zinc-800/50 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/5 group">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`text-sm md:text-base ${isMuted || remoteVolume === 0 ? 'text-red-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <i className={`fas ${isMuted || remoteVolume === 0 ? 'fa-volume-mute' : remoteVolume < 0.5 ? 'fa-volume-down' : 'fa-volume-up'}`}></i>
          </button>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={isMuted ? 0 : remoteVolume} 
            onChange={(e) => {
              setRemoteVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-16 md:w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
        
        <button 
          onClick={toggleScreenShare}
          className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-600 text-white' : 'bg-zinc-800/50 text-white hover:bg-zinc-700'}`}
          title="Share Screen"
        >
          <i className={`fas ${isScreenSharing ? 'fa-desktop' : 'fa-laptop-code'}`}></i>
        </button>

        {/* Record Button */}
        <button 
          onClick={toggleRecording}
          className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-zinc-800/50 text-white hover:bg-zinc-700'}`}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          <i className={`fas ${isRecording ? 'fa-stop-circle' : 'fa-record-vinyl'}`}></i>
        </button>

        <button 
          onClick={() => setShowSettings(true)}
          className={`w-10 h-10 md:w-14 md:h-14 rounded-full bg-zinc-800/50 text-white hover:bg-zinc-700 flex items-center justify-center transition-all ${showSettings ? 'text-blue-400' : ''}`}
          title="Settings"
        >
          <i className="fas fa-cog text-white"></i>
        </button>

        <button 
          onClick={endCall}
          className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-600 text-white hover:bg-red-500 flex items-center justify-center shadow-xl shadow-red-600/30 transition-all transform hover:scale-110 mx-1"
        >
          <i className="fas fa-phone-slash text-base md:text-xl text-white"></i>
        </button>
        
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all relative ${isChatOpen ? 'bg-blue-600 text-white' : 'bg-zinc-800/50 text-white hover:bg-zinc-700'}`}
          title="Chat"
        >
          <i className="fas fa-comment-alt text-white"></i>
          {!isChatOpen && messages.filter(m => m.sender === 'peer').length > 0 && (
             <span className="absolute top-0 right-0 w-3 h-3 bg-blue-400 border-2 border-black rounded-full animate-pulse"></span>
          )}
        </button>

        <div className="hidden lg:flex h-8 w-px bg-white/10 mx-2"></div>
        <div className="hidden lg:flex flex-col items-center">
           <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter mb-1">Translating</span>
           <div className="flex items-center gap-2">
             <span className="text-sm font-bold text-blue-400">{SUPPORTED_LANGUAGES.find(l=>l.code===myLang)?.name}</span>
             <i className="fas fa-exchange-alt text-[10px] text-zinc-600"></i>
             <span className="text-sm font-bold text-white">{SUPPORTED_LANGUAGES.find(l=>l.code===remoteLang)?.name}</span>
           </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
