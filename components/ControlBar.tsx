import React from 'react';

interface ControlBarProps {
  isHandsFree: boolean;
  isPttPressed: boolean;
  isMuted: boolean;
  remoteVolume: number;
  isScreenSharing: boolean;
  isRecording: boolean;
  showSettings: boolean;
  isChatOpen: boolean;
  hasUnreadPeerMessages: boolean;
  myLangName: string;
  remoteLangName: string;
  onToggleHandsFree: () => void;
  onPttDown: () => void;
  onPttUp: () => void;
  onToggleMute: () => void;
  onRemoteVolumeChange: (value: number) => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onShowSettings: () => void;
  onEndCall: () => void;
  onToggleChat: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  isHandsFree,
  isPttPressed,
  isMuted,
  remoteVolume,
  isScreenSharing,
  isRecording,
  showSettings,
  isChatOpen,
  hasUnreadPeerMessages,
  myLangName,
  remoteLangName,
  onToggleHandsFree,
  onPttDown,
  onPttUp,
  onToggleMute,
  onRemoteVolumeChange,
  onToggleScreenShare,
  onToggleRecording,
  onShowSettings,
  onEndCall,
  onToggleChat,
}) => {
  return (
    <div className="h-24 glass-panel flex items-center justify-center gap-2 md:gap-5 px-4 md:px-12 rounded-t-[3rem] mt-auto relative">
      <div className="flex flex-col items-center">
        <button
          onClick={onToggleHandsFree}
          className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${isHandsFree ? 'bg-green-600 text-white ring-4 ring-green-500/20' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700'}`}
          title={isHandsFree ? 'Disable Auto-Translate' : 'Enable Auto-Translate (Continuous)'}
        >
          <i className={`fas ${isHandsFree ? 'fa-magic animate-pulse' : 'fa-headset'}`}></i>
        </button>
        <span className="text-[9px] font-bold text-zinc-500 mt-1 uppercase tracking-tighter">{isHandsFree ? 'LIVE' : 'AUTO'}</span>
      </div>

      {!isHandsFree && (
        <div className="flex flex-col items-center">
          <button
            onMouseDown={onPttDown}
            onMouseUp={onPttUp}
            onMouseLeave={onPttUp}
            onTouchStart={onPttDown}
            onTouchEnd={onPttUp}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all select-none touch-none ${isPttPressed ? 'bg-blue-600 scale-90 shadow-inner' : 'bg-zinc-800/50 hover:bg-zinc-700 shadow-lg'}`}
            title="Hold to Speak"
          >
            <i className={`fas fa-microphone ${isPttPressed ? 'text-white' : 'text-zinc-400'}`}></i>
          </button>
          <span className="text-[9px] font-bold text-zinc-500 mt-1 uppercase tracking-tighter">PTT</span>
        </div>
      )}

      <div className="flex items-center gap-2 bg-zinc-800/50 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/5 group">
        <button
          onClick={onToggleMute}
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
          onChange={(e) => onRemoteVolumeChange(parseFloat(e.target.value))}
          className="w-16 md:w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      <button
        onClick={onToggleScreenShare}
        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-600 text-white' : 'bg-zinc-800/50 text-white hover:bg-zinc-700'}`}
        title="Share Screen"
      >
        <i className={`fas ${isScreenSharing ? 'fa-desktop' : 'fa-laptop-code'}`}></i>
      </button>

      <button
        onClick={onToggleRecording}
        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-zinc-800/50 text-white hover:bg-zinc-700'}`}
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
      >
        <i className={`fas ${isRecording ? 'fa-stop-circle' : 'fa-record-vinyl'}`}></i>
      </button>

      <button
        onClick={onShowSettings}
        className={`w-10 h-10 md:w-14 md:h-14 rounded-full bg-zinc-800/50 text-white hover:bg-zinc-700 flex items-center justify-center transition-all ${showSettings ? 'text-blue-400' : ''}`}
        title="Settings"
      >
        <i className="fas fa-cog text-white"></i>
      </button>

      <button
        onClick={onEndCall}
        className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-600 text-white hover:bg-red-500 flex items-center justify-center shadow-xl shadow-red-600/30 transition-all transform hover:scale-110 mx-1"
      >
        <i className="fas fa-phone-slash text-base md:text-xl text-white"></i>
      </button>

      <button
        onClick={onToggleChat}
        className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all relative ${isChatOpen ? 'bg-blue-600 text-white' : 'bg-zinc-800/50 text-white hover:bg-zinc-700'}`}
        title="Chat"
      >
        <i className="fas fa-comment-alt text-white"></i>
        {!isChatOpen && hasUnreadPeerMessages && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-blue-400 border-2 border-black rounded-full animate-pulse"></span>
        )}
      </button>

      <div className="hidden lg:flex h-8 w-px bg-white/10 mx-2"></div>
      <div className="hidden lg:flex flex-col items-center">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter mb-1">Translating</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-400">{myLangName}</span>
          <i className="fas fa-exchange-alt text-[10px] text-zinc-600"></i>
          <span className="text-sm font-bold text-white">{remoteLangName}</span>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
