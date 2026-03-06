import React from 'react';

interface VideoGridProps {
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteSubtitleConfirmed: string;
  remoteSubtitleHypothesis: string;
  localSubtitleConfirmed: string;
  localSubtitleHypothesis: string;
  isScreenSharing: boolean;
  isPttPressed: boolean;
  isHandsFree: boolean;
}

const VideoGrid: React.FC<VideoGridProps> = ({
  remoteVideoRef,
  localVideoRef,
  remoteSubtitleConfirmed,
  remoteSubtitleHypothesis,
  localSubtitleConfirmed,
  localSubtitleHypothesis,
  isScreenSharing,
  isPttPressed,
  isHandsFree,
}) => {
  return (
    <div className="video-grid">
      <div className="video-box group">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-lg text-xs font-bold text-white">Remote Participant</div>

        {(remoteSubtitleConfirmed || remoteSubtitleHypothesis) && (
          <div className="subtitle-area">
            <div className="subtitle-bubble">
              <p className="text-xl md:text-3xl font-bold text-white tracking-wide text-center leading-tight">
                <span>{remoteSubtitleConfirmed}</span>
                {remoteSubtitleHypothesis ? (
                  <span className="opacity-60 ml-2">{remoteSubtitleHypothesis}</span>
                ) : null}
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

        {(localSubtitleConfirmed || localSubtitleHypothesis) && (
          <div className="subtitle-area">
            <div className="subtitle-bubble opacity-60 scale-90">
              <p className="text-lg font-bold text-white tracking-wide text-center">
                <span>{localSubtitleConfirmed}</span>
                {localSubtitleHypothesis ? (
                  <span className="opacity-60 ml-2">{localSubtitleHypothesis}</span>
                ) : null}
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
  );
};

export default VideoGrid;
