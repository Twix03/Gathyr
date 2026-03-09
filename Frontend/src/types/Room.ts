export interface Participant {
  id: string;
  name: string;
  avatar: string;
  voiceEnabled: boolean;
  isSpeaking: boolean;
  videoEnabled: boolean;
  isConnected: boolean;
}

export interface GameProposal {
  game_id: string;
  proposer_id: string;
  created_at: number;
  expires_at: number;
  type: 'START' | 'END';
  votes: Record<string, boolean>;
}

export interface Room {
  id: string;
  code: string;
  participants: Participant[];
  currentGame: string | null;
  lastPlayed: string | null;
  proposal: GameProposal | null;
}