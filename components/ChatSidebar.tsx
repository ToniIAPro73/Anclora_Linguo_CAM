import React from 'react';

interface ChatMessage {
  id: string;
  sender: 'me' | 'peer';
  text: string;
  translatedText?: string;
  timestamp: number;
}

interface ChatSidebarProps {
  isChatOpen: boolean;
  messages: ChatMessage[];
  chatInput: string;
  speakingMessageId: string | null;
  translatingMessageId: string | null;
  canExportTranscript: boolean;
  onClose: () => void;
  onExportVtt: () => void;
  onExportSrt: () => void;
  onTranslate: (msg: ChatMessage) => void;
  onSpeak: (msg: ChatMessage) => void;
  onChatInputChange: (value: string) => void;
  onSendMessage: (event: React.FormEvent) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isChatOpen,
  messages,
  chatInput,
  speakingMessageId,
  translatingMessageId,
  canExportTranscript,
  onClose,
  onExportVtt,
  onExportSrt,
  onTranslate,
  onSpeak,
  onChatInputChange,
  onSendMessage,
  chatEndRef,
}) => {
  return (
    <div className={`transition-all duration-300 ease-in-out bg-zinc-900/40 backdrop-blur-2xl border-l border-white/5 flex flex-col ${isChatOpen ? 'w-80 md:w-96' : 'w-0 overflow-hidden opacity-0'}`}>
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-400">Live Chat</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onExportVtt}
            disabled={!canExportTranscript}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              canExportTranscript
                ? 'border-white/20 text-zinc-300 hover:text-white hover:border-white/40'
                : 'border-white/10 text-zinc-600 cursor-not-allowed'
            }`}
            title="Export transcript as VTT"
          >
            VTT
          </button>
          <button
            onClick={onExportSrt}
            disabled={!canExportTranscript}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              canExportTranscript
                ? 'border-white/20 text-zinc-300 hover:text-white hover:border-white/40'
                : 'border-white/10 text-zinc-600 cursor-not-allowed'
            }`}
            title="Export transcript as SRT"
          >
            SRT
          </button>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50 text-center px-6">
            <i className="fas fa-comments text-3xl mb-2"></i>
            <p className="text-xs">No messages yet.<br/>Type below to start chatting.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm relative group ${msg.sender === 'me' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-200 rounded-tl-none'}`}>
                {msg.text}

                {msg.translatedText && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-blue-300 italic text-xs">
                    <i className="fas fa-language mr-2"></i>
                    {msg.translatedText}
                  </div>
                )}

                {msg.sender === 'peer' && (
                  <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => onTranslate(msg)}
                      disabled={translatingMessageId === msg.id || !!msg.translatedText}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${translatingMessageId === msg.id ? 'text-blue-400 animate-pulse' : msg.translatedText ? 'text-green-500 cursor-default' : 'text-zinc-500 hover:text-white'}`}
                      title="Translate message"
                    >
                      {translatingMessageId === msg.id ? (
                        <i className="fas fa-circle-notch animate-spin text-[10px]"></i>
                      ) : (
                        <i className="fas fa-language text-[10px]"></i>
                      )}
                    </button>
                    <button
                      onClick={() => onSpeak(msg)}
                      disabled={speakingMessageId === msg.id}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${speakingMessageId === msg.id ? 'text-blue-400 animate-pulse' : 'text-zinc-500 hover:text-white'}`}
                      title="Translate & Read aloud"
                    >
                      {speakingMessageId === msg.id ? (
                        <i className="fas fa-circle-notch animate-spin text-[10px]"></i>
                      ) : (
                        <i className="fas fa-volume-up text-[10px]"></i>
                      )}
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-zinc-600 mt-1 uppercase font-bold tracking-tighter">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={onSendMessage} className="p-4 bg-black/20 border-t border-white/5 flex gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
        />
        <button type="submit" className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 transition-colors">
          <i className="fas fa-paper-plane text-xs text-white"></i>
        </button>
      </form>
    </div>
  );
};

export default ChatSidebar;
