
export interface Language {
  code: string;
  name: string;
}

export interface TranscriptionItem {
  id: string;
  text: string;
  isUser: boolean;
  language: string;
  timestamp: number;
}

export enum CallStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR'
}
