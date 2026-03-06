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
  onCopyInviteLink: () => void;
  onRunPrecallCheck: () => void;
  isRunningPrecallCheck: boolean;
  preCallStatus: string;
  uiText: {
    title: string;
    subtitle: string;
    yourPeerId: string;
    iSpeak: string;
    theySpeak: string;
    callQuality: string;
    joinRoom: string;
    joinRoomPlaceholder: string;
    connecting: string;
    startCall: string;
    copyHint: string;
    copyInviteLink: string;
    runPrecheck: string;
    checkingPrecheck: string;
  };
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
  onCopyInviteLink,
  onRunPrecallCheck,
  isRunningPrecallCheck,
  preCallStatus,
  uiText,
}) => {
  const isConnecting = status === CallStatus.CONNECTING;
  return (
    <div className="min-h-[100dvh] bg-black px-3 py-2 sm:px-5 sm:py-4 overflow-y-auto">
      <div className="min-h-full flex items-start sm:items-center justify-center">
        <div className="w-full max-w-[520px] space-y-3 sm:space-y-5 max-[820px]:space-y-2 animate-in fade-in duration-700">
          <div className="text-center relative">
            <div className="w-14 h-14 sm:w-16 sm:h-16 max-[820px]:w-12 max-[820px]:h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-2xl shadow-blue-500/20">
              <i className="fas fa-globe-americas text-2xl sm:text-3xl max-[820px]:text-xl text-white"></i>
            </div>
            <h1 className="text-3xl sm:text-4xl max-[820px]:text-2xl font-extrabold tracking-tight mb-1">{uiText.title}</h1>
            <p className="text-zinc-500 font-medium text-sm max-[820px]:text-xs">{uiText.subtitle}</p>
          </div>

          <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 max-[820px]:p-3 space-y-3 sm:space-y-4 max-[820px]:space-y-2">
            <div className="space-y-2 sm:space-y-3 max-[820px]:space-y-1.5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] sm:text-xs font-bold uppercase text-zinc-500 tracking-widest px-1">{uiText.yourPeerId}</label>
                <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 max-[820px]:p-2.5 flex justify-between items-center group">
                  <span className="text-lg sm:text-xl max-[820px]:text-base font-mono font-bold text-blue-400">{peerId || '...'}</span>
                  <button onClick={onCopyPeerId} className="text-zinc-500 hover:text-white transition-colors">
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] sm:text-xs font-bold uppercase text-zinc-500 px-1">{uiText.iSpeak}</label>
                  <select value={myLang} onChange={(e) => onMyLangChange(e.target.value)} className="bg-zinc-800 rounded-lg sm:rounded-xl p-2.5 sm:p-3 max-[820px]:p-2 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-white">
                    {supportedLanguages.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] sm:text-xs font-bold uppercase text-zinc-500 px-1">{uiText.theySpeak}</label>
                  <select value={remoteLang} onChange={(e) => onRemoteLangChange(e.target.value)} className="bg-zinc-800 rounded-lg sm:rounded-xl p-2.5 sm:p-3 max-[820px]:p-2 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-white">
                    {supportedLanguages.filter(l => l.code !== 'auto').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] sm:text-xs font-bold uppercase text-zinc-500 px-1">{uiText.callQuality}</label>
                <select
                  value={quality}
                  onChange={(e) => onQualityChange(e.target.value)}
                  className="bg-zinc-800 rounded-lg sm:rounded-xl p-2.5 sm:p-3 max-[820px]:p-2 border border-white/5 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-white"
                >
                  {Object.entries(qualityProfiles).map(([key, profile]) => (
                    <option key={key} value={key}>{profile.label}</option>
                  ))}
                </select>
              </div>

              <div className="h-px bg-white/10 my-2"></div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] sm:text-xs font-bold uppercase text-zinc-500 px-1">{uiText.joinRoom}</label>
                <input
                  type="text"
                  placeholder={uiText.joinRoomPlaceholder}
                  value={targetPeerId}
                  onChange={(e) => onTargetPeerChange(e.target.value.toUpperCase())}
                  className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 max-[820px]:p-2.5 text-lg sm:text-xl max-[820px]:text-base font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onCopyInviteLink}
                    className="flex-1 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-100 text-xs sm:text-sm py-2 rounded-lg border border-white/10"
                  >
                    {uiText.copyInviteLink}
                  </button>
                  <button
                    type="button"
                    onClick={onRunPrecallCheck}
                    className="flex-1 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-100 text-xs sm:text-sm py-2 rounded-lg border border-white/10"
                  >
                    {isRunningPrecallCheck ? uiText.checkingPrecheck : uiText.runPrecheck}
                  </button>
                </div>
                {preCallStatus ? (
                  <p className="text-[11px] text-zinc-400 px-1">{preCallStatus}</p>
                ) : null}
              </div>
            </div>

            <button
              onClick={onStartCall}
              disabled={isConnecting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 sm:py-3 max-[820px]:py-2 rounded-xl sm:rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2.5"
            >
              {isConnecting ? (
                <i className="fas fa-circle-notch animate-spin"></i>
              ) : (
                <i className="fas fa-phone"></i>
              )}
              {isConnecting ? uiText.connecting : uiText.startCall}
            </button>
          </div>

          <p className="text-center text-zinc-600 text-[11px] max-[820px]:hidden">
            {uiText.copyHint}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CallSetup;
