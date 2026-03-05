import React from 'react';

interface CallHeaderProps {
  peerId: string;
  qualityLabel: string;
  isRecording: boolean;
  latencyMs: number | null;
  bitrateKbps: number | null;
  packetLossPct: number | null;
}

const CallHeader: React.FC<CallHeaderProps> = ({
  peerId,
  qualityLabel,
  isRecording,
  latencyMs,
  bitrateKbps,
  packetLossPct,
}) => {
  return (
    <>
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
          {qualityLabel} QUALITY
        </div>
        <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-300 text-[10px] font-bold tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
          LAT {latencyMs ?? '--'}ms | {bitrateKbps ?? '--'}kbps | LOSS {packetLossPct ?? '--'}%
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
