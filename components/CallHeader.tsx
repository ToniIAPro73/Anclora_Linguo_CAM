import React from 'react';

interface CallHeaderProps {
  peerId: string;
  qualityLabel: string;
  isRecording: boolean;
  latencyMs: number | null;
  bitrateKbps: number | null;
  packetLossPct: number | null;
  peerConnectionState: 'connected' | 'reconnecting' | 'down';
  translationConnectionState: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  translationReconnectAttempts: number;
}

const CallHeader: React.FC<CallHeaderProps> = ({
  peerId,
  qualityLabel,
  isRecording,
  latencyMs,
  bitrateKbps,
  packetLossPct,
  peerConnectionState,
  translationConnectionState,
  translationReconnectAttempts,
}) => {
  const peerStateColor =
    peerConnectionState === 'connected'
      ? 'text-green-400 border-green-500/20 bg-green-500/10'
      : peerConnectionState === 'reconnecting'
        ? 'text-amber-300 border-amber-500/20 bg-amber-500/10'
        : 'text-red-400 border-red-500/20 bg-red-500/10';

  const translationStateColor =
    translationConnectionState === 'connected'
      ? 'text-blue-300 border-blue-500/20 bg-blue-500/10'
      : translationConnectionState === 'reconnecting'
        ? 'text-amber-300 border-amber-500/20 bg-amber-500/10'
        : translationConnectionState === 'error'
          ? 'text-red-400 border-red-500/20 bg-red-500/10'
          : 'text-zinc-300 border-zinc-500/20 bg-zinc-500/10';

  return (
    <>
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-50 flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/10">
        <div className="bg-blue-600 w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center">
          <i className="fas fa-link text-white"></i>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Session ID</h2>
          <p className="font-mono font-bold text-white">{peerId}</p>
        </div>
      </div>

      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex flex-col items-end gap-2">
        <div className="hidden lg:flex px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-[10px] font-bold tracking-widest items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
          {qualityLabel} QUALITY
        </div>
        <div className="hidden lg:flex px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-300 text-[10px] font-bold tracking-widest items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
          LAT {latencyMs ?? '--'}ms | {bitrateKbps ?? '--'}kbps | LOSS {packetLossPct ?? '--'}%
        </div>
        <div className={`px-3 md:px-4 py-2 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-2 border ${peerStateColor}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
          SIGNAL {peerConnectionState.toUpperCase()}
        </div>
        <div className={`hidden md:flex px-4 py-2 rounded-full text-[10px] font-bold tracking-widest items-center gap-2 border ${translationStateColor}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
          SUBTITLES {translationConnectionState.toUpperCase()}
          {translationConnectionState === 'reconnecting' ? ` #${translationReconnectAttempts}` : ''}
        </div>
        {isRecording && (
          <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-[10px] font-bold tracking-widest flex items-center gap-2 animate-pulse">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
            REC RECORDING CALL
          </div>
        )}
      </div>
    </>
  );
};

export default CallHeader;
