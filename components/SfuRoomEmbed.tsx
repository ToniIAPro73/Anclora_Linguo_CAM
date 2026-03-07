import React from 'react';

interface SfuRoomEmbedProps {
  url: string;
}

const SfuRoomEmbed: React.FC<SfuRoomEmbedProps> = ({ url }) => {
  return (
    <div className="w-full h-full rounded-3xl overflow-hidden border border-white/10 bg-zinc-900">
      <iframe
        src={url}
        title="SFU Room"
        className="w-full h-full"
        allow="camera; microphone; fullscreen; display-capture"
      />
    </div>
  );
};

export default SfuRoomEmbed;
