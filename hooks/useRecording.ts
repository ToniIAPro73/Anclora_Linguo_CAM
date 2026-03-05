import { useRef, useState } from 'react';

interface RecordingOptions {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  getLocalStream: () => MediaStream | null;
  getRemoteStream: () => MediaStream | null;
  isScreenSharing: boolean;
  localSubtitle: string;
  remoteSubtitle: string;
}

export function useRecording(options: RecordingOptions) {
  const {
    localVideoRef,
    remoteVideoRef,
    canvasRef,
    getLocalStream,
    getRemoteStream,
    isScreenSharing,
    localSubtitle,
    remoteSubtitle,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingRequestRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

  const cleanupRecordingResources = () => {
    if (recordingRequestRef.current !== null) {
      cancelAnimationFrame(recordingRequestRef.current);
      recordingRequestRef.current = null;
    }

    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach((track) => track.stop());
      canvasStreamRef.current = null;
    }

    if (mixedStreamRef.current) {
      mixedStreamRef.current.getTracks().forEach((track) => track.stop());
      mixedStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const startRecording = () => {
    const localStream = getLocalStream();
    const remoteStream = getRemoteStream();
    if (!localStream || !remoteStream) {
      alert('Call must be active to start recording');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    recordedChunksRef.current = [];

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();

    const localAudioSource = audioCtx.createMediaStreamSource(localStream);
    const remoteAudioSource = audioCtx.createMediaStreamSource(remoteStream);

    localAudioSource.connect(dest);
    remoteAudioSource.connect(dest);

    isRecordingRef.current = true;
    setIsRecording(true);

    const drawFrame = () => {
      if (!isRecordingRef.current) return;

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (remoteVideoRef.current) {
        ctx.drawImage(remoteVideoRef.current, 0, 0, canvas.width / 2, canvas.height);
      }

      if (localVideoRef.current) {
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

      const drawSub = (text: string, yPos: number, bgColor: string) => {
        if (!text) return;
        ctx.font = 'bold 32px Inter, Arial';
        const padding = 20;
        const textWidth = ctx.measureText(text).width;

        ctx.fillStyle = bgColor;
        ctx.roundRect(
          canvas.width / 2 - textWidth / 2 - padding,
          yPos - 40,
          textWidth + padding * 2,
          60,
          10,
        );
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(text, canvas.width / 2, yPos);
      };

      drawSub(remoteSubtitle, canvas.height - 120, 'rgba(0, 122, 255, 0.8)');
      drawSub(localSubtitle, canvas.height - 50, 'rgba(255, 255, 255, 0.2)');

      recordingRequestRef.current = requestAnimationFrame(drawFrame);
    };

    recordingRequestRef.current = requestAnimationFrame(drawFrame);

    const canvasStream = canvas.captureStream(30);
    canvasStreamRef.current = canvasStream;
    const finalStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    mixedStreamRef.current = finalStream;

    const recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm;codecs=vp9,opus' });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `linguocam-call-${Date.now()}.webm`;
      anchor.click();
      URL.revokeObjectURL(url);
      cleanupRecordingResources();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }

    cleanupRecordingResources();
  };

  const toggleRecording = () => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return { isRecording, toggleRecording, stopRecording };
}
