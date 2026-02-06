import React from 'react';

interface QualityProfile {
  label: string;
  width: number;
  height: number;
  maxBitrate: number;
}

interface SettingsModalProps {
  show: boolean;
  quality: string;
  qualityProfiles: Record<string, QualityProfile>;
  onSelectQuality: (quality: string) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  show,
  quality,
  qualityProfiles,
  onSelectQuality,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-8 space-y-6 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-white">Call Settings</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Video Quality & Bandwidth</label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(qualityProfiles).map(([key, profile]) => (
                <button
                  key={key}
                  onClick={() => onSelectQuality(key)}
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
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-2xl transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
