import { useCallback, useEffect, useRef, useState } from 'react';

interface StreamingTranslationOptions {
  wsUrl: string;
  sampleRate: number;
  chunkFrames: number;
  maxBufferedBytes: number;
  vadThreshold: number;
  minSpeechMs: number;
  minSilenceMs: number;
  maxSegmentMs: number;
  hangoverMs: number;
  sourceLang: string;
  targetLang: string;
  onSubtitle: (text: string, isFinal: boolean, rawText?: string) => void;
}

type WsConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 500;

export function useStreamingTranslation(options: StreamingTranslationOptions) {
  const {
    wsUrl,
    sampleRate,
    chunkFrames,
    maxBufferedBytes,
    vadThreshold,
    minSpeechMs,
    minSilenceMs,
    maxSegmentMs,
    hangoverMs,
    sourceLang,
    targetLang,
    onSubtitle,
  } = options;

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState<WsConnectionState>('idle');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [droppedAudioChunks, setDroppedAudioChunks] = useState(0);
  const [isBackpressured, setIsBackpressured] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const lastChunkSentAtRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastPartialTextRef = useRef('');
  const lastCommittedTextRef = useRef('');
  const droppedAudioChunksRef = useRef(0);
  const backpressuredRef = useRef(false);
  const lowWatermarkRef = useRef(Math.max(4096, Math.floor(maxBufferedBytes * 0.5)));

  const sourceLangRef = useRef(sourceLang);
  const targetLangRef = useRef(targetLang);

  const normalizeLangConfig = useCallback((source: string, target: string) => {
    const normalizedSource = source === 'auto' ? '' : source;
    let normalizedTarget = target === 'auto' ? '' : target;
    if (!normalizedTarget) {
      normalizedTarget = normalizedSource || 'en';
    }
    return { normalizedSource, normalizedTarget };
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const setSendActive = useCallback((active: boolean) => {
    const node = workletNodeRef.current;
    if (node) node.port.postMessage({ type: 'state', active });
  }, []);

  const cleanupWs = useCallback((sendEnd: boolean) => {
    const ws = wsRef.current;
    if (!ws) return;
    if (sendEnd && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end' }));
    }
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close();
    wsRef.current = null;
    backpressuredRef.current = false;
    setIsBackpressured(false);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!startedRef.current || !streamRef.current || intentionalStopRef.current) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionState('error');
      return;
    }
    const nextAttempt = reconnectAttempts + 1;
    const delay = RECONNECT_BASE_DELAY_MS * 2 ** (nextAttempt - 1);
    setReconnectAttempts(nextAttempt);
    setConnectionState('reconnecting');
    clearReconnectTimer();
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      const stream = streamRef.current;
      if (!stream || !startedRef.current) return;
      const sessionId = Math.random().toString(36).substring(2, 10);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const { normalizedSource, normalizedTarget } = normalizeLangConfig(
          sourceLangRef.current,
          targetLangRef.current,
        );
        ws.send(
          JSON.stringify({
            type: 'config',
            session_id: sessionId,
            source_lang: normalizedSource,
            target_lang: normalizedTarget,
            sample_rate: sampleRate,
            format: 's16le',
          }),
        );
        setConnectionState('connected');
        setReconnectAttempts(0);
        backpressuredRef.current = false;
        setIsBackpressured(false);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type !== 'partial' && payload.type !== 'final') return;
          const translatedText = payload.translated_text || payload.text;
          if (!translatedText) return;
          if (payload.type === 'final' && translatedText === lastCommittedTextRef.current) {
            lastPartialTextRef.current = '';
            return;
          }
          onSubtitle(translatedText, payload.type === 'final', payload.text || translatedText);
          if (payload.type === 'partial') {
            lastPartialTextRef.current = translatedText;
          } else {
            lastCommittedTextRef.current = translatedText;
            lastPartialTextRef.current = '';
          }
          if (lastChunkSentAtRef.current) {
            const nextLatency = Math.round(performance.now() - lastChunkSentAtRef.current);
            setLatencyMs(nextLatency);
          }
        } catch (err) {
          console.error('WS message parse error:', err);
        }
      };

      ws.onerror = () => {
        setConnectionState('error');
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!intentionalStopRef.current) scheduleReconnect();
      };
    }, delay);
  }, [
    clearReconnectTimer,
    normalizeLangConfig,
    onSubtitle,
    reconnectAttempts,
    sampleRate,
    wsUrl,
  ]);

  const createWebSocket = useCallback(() => {
    const sessionId = Math.random().toString(36).substring(2, 10);
    setConnectionState(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const { normalizedSource, normalizedTarget } = normalizeLangConfig(
        sourceLangRef.current,
        targetLangRef.current,
      );
      ws.send(
        JSON.stringify({
          type: 'config',
          session_id: sessionId,
          source_lang: normalizedSource,
          target_lang: normalizedTarget,
          sample_rate: sampleRate,
          format: 's16le',
        }),
      );
      setConnectionState('connected');
      setReconnectAttempts(0);
      backpressuredRef.current = false;
      setIsBackpressured(false);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== 'partial' && payload.type !== 'final') return;
        const translatedText = payload.translated_text || payload.text;
        if (!translatedText) return;
        if (payload.type === 'final' && translatedText === lastCommittedTextRef.current) {
          lastPartialTextRef.current = '';
          return;
        }
        onSubtitle(translatedText, payload.type === 'final', payload.text || translatedText);
        if (payload.type === 'partial') {
          lastPartialTextRef.current = translatedText;
        } else {
          lastCommittedTextRef.current = translatedText;
          lastPartialTextRef.current = '';
        }
        if (lastChunkSentAtRef.current) {
          const nextLatency = Math.round(performance.now() - lastChunkSentAtRef.current);
          setLatencyMs(nextLatency);
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    };

    ws.onerror = () => {
      setConnectionState('error');
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!intentionalStopRef.current) {
        scheduleReconnect();
      }
    };
  }, [normalizeLangConfig, onSubtitle, reconnectAttempts, sampleRate, scheduleReconnect, wsUrl]);

  const start = useCallback(async (stream: MediaStream) => {
    intentionalStopRef.current = false;
    startedRef.current = true;
    streamRef.current = stream;
    clearReconnectTimer();
    cleanupWs(false);

    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate,
    });
    audioContextRef.current = inputCtx;

    await inputCtx.audioWorklet.addModule(new URL('../audio-worklet-processor.js', import.meta.url));

    const source = inputCtx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(inputCtx, 'pcm-worklet', {
      processorOptions: {
        chunkSize: chunkFrames,
        vadThreshold,
        minSpeechMs,
        minSilenceMs,
        maxSegmentMs,
        hangoverMs,
      },
    });
    const zeroGain = inputCtx.createGain();
    zeroGain.gain.value = 0;

    workletNode.port.onmessage = (event) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (event.data?.type === 'segment_end') {
        ws.send(JSON.stringify({ type: 'segment_end', reason: event.data.reason || 'vad' }));
        if (lastPartialTextRef.current && lastPartialTextRef.current !== lastCommittedTextRef.current) {
          onSubtitle(lastPartialTextRef.current, true, lastPartialTextRef.current);
          lastCommittedTextRef.current = lastPartialTextRef.current;
          lastPartialTextRef.current = '';
        }
        return;
      }
      if (event.data?.type !== 'audio') return;
      const buffered = ws.bufferedAmount;
      if (backpressuredRef.current && buffered <= lowWatermarkRef.current) {
        backpressuredRef.current = false;
        setIsBackpressured(false);
      }
      if (buffered >= maxBufferedBytes) {
        droppedAudioChunksRef.current += 1;
        if (droppedAudioChunksRef.current % 5 === 0) {
          setDroppedAudioChunks(droppedAudioChunksRef.current);
        }
        if (!backpressuredRef.current) {
          backpressuredRef.current = true;
          setIsBackpressured(true);
        }
        return;
      }
      ws.send(event.data.payload);
      lastChunkSentAtRef.current = performance.now();
    };

    source.connect(workletNode);
    workletNode.connect(zeroGain).connect(inputCtx.destination);

    audioSourceRef.current = source;
    workletNodeRef.current = workletNode;

    createWebSocket();
  }, [
    chunkFrames,
    cleanupWs,
    clearReconnectTimer,
    createWebSocket,
    hangoverMs,
    maxSegmentMs,
    minSilenceMs,
    minSpeechMs,
    onSubtitle,
    sampleRate,
    vadThreshold,
    maxBufferedBytes,
  ]);

  const stop = useCallback(() => {
    intentionalStopRef.current = true;
    startedRef.current = false;
    setSendActive(false);
    clearReconnectTimer();
    cleanupWs(true);

    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    droppedAudioChunksRef.current = 0;
    setDroppedAudioChunks(0);
    lastChunkSentAtRef.current = null;
    lastPartialTextRef.current = '';
    lastCommittedTextRef.current = '';
    setDroppedAudioChunks(droppedAudioChunksRef.current);
    backpressuredRef.current = false;
    setIsBackpressured(false);
    streamRef.current = null;
    setConnectionState('idle');
    setReconnectAttempts(0);
  }, [cleanupWs, clearReconnectTimer, setSendActive]);

  const restartIfReady = useCallback(() => {
    if (!startedRef.current || !streamRef.current) return;
    const stream = streamRef.current;
    stop();
    start(stream);
  }, [start, stop]);

  const setEndpointingConfig = useCallback((config: {
    chunkSize?: number;
    minSpeechMs?: number;
    minSilenceMs?: number;
    maxSegmentMs?: number;
    hangoverMs?: number;
    vadThreshold?: number;
  }) => {
    const node = workletNodeRef.current;
    if (!node) return;
    node.port.postMessage({ type: 'config', ...config });
  }, []);

  useEffect(() => {
    sourceLangRef.current = sourceLang;
    targetLangRef.current = targetLang;
    restartIfReady();
  }, [sourceLang, targetLang, restartIfReady]);

  useEffect(() => {
    lowWatermarkRef.current = Math.max(4096, Math.floor(maxBufferedBytes * 0.5));
  }, [maxBufferedBytes]);

  return {
    latencyMs,
    connectionState,
    reconnectAttempts,
    droppedAudioChunks,
    isBackpressured,
    setSendActive,
    setEndpointingConfig,
    start,
    stop,
    restartIfReady,
  };
}
