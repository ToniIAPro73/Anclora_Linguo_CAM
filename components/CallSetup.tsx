import React from 'react';

import { CallStatus, Language } from '../types';

interface QualityProfile {
  label: string;
  width: number;
  height: number;
  maxBitrate: number;
}

interface CallSetupProps {
  status: CallStatus;
  peerId: string;
  myLang: string;
  remoteLang: string;
  quality: string;
  targetPeerId: string;
  supportedLanguages: Language[];
  qualityProfiles: Record<string, QualityProfile>;
  onStartCall: () => void;
  onQualityChange: (quality: string) => void;
  onMyLangChange: (lang: string) => void;
  onRemoteLangChange: (lang: string) => void;
  onTargetPeerChange: (peerId: string) => void;
  onCopyPeerId: () => void;
}

const CallSetup: React.FC<CallSetupProps> = ({
  status,
  peerId,
  myLang,
  remoteLang,
  quality,
  targetPeerId,
  supportedLanguages,
  qualityProfiles,
  onStartCall,
  onQualityChange,
  onMyLangChange,
  onRemoteLangChange,
  onTargetPeerChange,
  onCopyPeerId,
}) => {
  const isConnecting = status === CallStatus.CONNECTING;
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
                <button onClick={onCopyPeerId} className="text-zinc-500 hover:text-white transition-colors">
                  <i className="fas fa-copy"></i>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-zinc-500 px-1">I speak</label>
                <select value={myLang} onChange={(e) => onMyLangChange(e.target.value)} className="bg-zinc-800 rounded-xl p-3 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-white">
                  {supportedLanguages.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-zinc-500 px-1">They speak</label>
                <select value={remoteLang} onChange={(e) => onRemoteLangChange(e.target.value)} className="bg-zinc-800 rounded-xl p-3 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-white">
                  {supportedLanguages.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase text-zinc-500 px-1">Call Quality</label>
              <select
                value={quality}
                onChange={(e) => onQualityChange(e.target.value)}
                className="bg-zinc-800 rounded-xl p-3 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-white"
              >
                {Object.entries(qualityProfiles).map(([key, profile]) => (
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
                onChange={(e) => onTargetPeerChange(e.target.value.toUpperCase())}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xl font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
              />
            </div>
          </div>

          <button
            onClick={onStartCall}
            disabled={isConnecting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3"
          >
            {isConnecting ? (
              <i className="fas fa-circle-notch animate-spin"></i>
            ) : (
              <i className="fas fa-phone"></i>
            )}
            {isConnecting ? 'Connecting...' : 'Start Translation Call'}
          </button>
        </div>

        <p className="text-center text-zinc-600 text-xs">
          Ask the other person for their Peer ID to connect.
        </p>
      </div>
    </div>
  );
};

export default CallSetup;
