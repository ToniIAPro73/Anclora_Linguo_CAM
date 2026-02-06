import { useCallback, useEffect, useRef, useState } from 'react';

interface StreamingTranslationOptions {
  wsUrl: string;
  sampleRate: number;
  chunkFrames: number;
  vadThreshold: number;
  sourceLang: string;
  targetLang: string;
  onSubtitle: (text: string, isFinal: boolean) => void;
}

export function useStreamingTranslation(options: StreamingTranslationOptions) {
  const {
    wsUrl,
    sampleRate,
    chunkFrames,
    vadThreshold,
    sourceLang,
    targetLang,
    onSubtitle,
  } = options;

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const lastChunkSentAtRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedRef = useRef(false);
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

  const setSendActive = useCallback((active: boolean) => {
    const node = workletNodeRef.current;
    if (node) node.port.postMessage({ type: 'state', active });
  }, []);

  const start = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    startedRef.current = true;
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate,
    });
    audioContextRef.current = inputCtx;

    await inputCtx.audioWorklet.addModule(
      new URL('../audio-worklet-processor.js', import.meta.url),
    );
    const source = inputCtx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(inputCtx, 'pcm-worklet', {
      processorOptions: { chunkSize: chunkFrames, vadThreshold },
    });
    const zeroGain = inputCtx.createGain();
    zeroGain.gain.value = 0;

    workletNode.port.onmessage = (event) => {
      if (event.data?.type !== 'audio') return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(event.data.payload);
      lastChunkSentAtRef.current = performance.now();
    };

    source.connect(workletNode);
    workletNode.connect(zeroGain).connect(inputCtx.destination);

    audioSourceRef.current = source;
    workletNodeRef.current = workletNode;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    const sessionId = Math.random().toString(36).substring(2, 10);

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
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== 'partial' && payload.type !== 'final') return;
        const translatedText = payload.translated_text || payload.text;
        if (!translatedText) return;
        onSubtitle(translatedText, payload.type === 'final');
        if (lastChunkSentAtRef.current) {
          const nextLatency = Math.round(performance.now() - lastChunkSentAtRef.current);
          setLatencyMs(nextLatency);
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('ASR/MT WS error:', event);
    };
  }, [chunkFrames, normalizeLangConfig, onSubtitle, sampleRate, vadThreshold, wsUrl]);

  const stop = useCallback(() => {
    startedRef.current = false;
    setSendActive(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
    }
    workletNodeRef.current = null;
    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    lastChunkSentAtRef.current = null;
    streamRef.current = null;
  }, [setSendActive]);

  const restartIfReady = useCallback(() => {
    if (!startedRef.current || !streamRef.current) return;
    if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) return;
    stop();
    start(streamRef.current);
  }, [start, stop]);

  useEffect(() => {
    sourceLangRef.current = sourceLang;
    targetLangRef.current = targetLang;
    restartIfReady();
  }, [sourceLang, targetLang, restartIfReady]);

  return {
    latencyMs,
    setSendActive,
    start,
    stop,
    restartIfReady,
  };
}
