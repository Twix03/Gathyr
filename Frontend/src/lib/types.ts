export interface Participant {
  id: string;
  name: string;
  color: number;
  connected: boolean;
}

export interface Proposal {
  id: string;
  type: 'START' | 'END';
  game_id: string;
  game_name: string;
  proposer_id: string;
  votes: Record<string, boolean>;
  rule: string;
  /** local performance.now() timestamp when voting closes */
  deadlineAt: number;
}

export interface RoomSnapshot {
  code: string;
  host_id: string;
  participants: Participant[];
  game: { id: string; name: string; finished: boolean } | null;
  last_played: string | null;
  proposal: Proposal | null;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  ts: number;
}

export interface LeaderboardRow {
  id: string;
  name: string;
  score: number;
}

/** Fields every game view has (see Backend/gathyr/games/base.py). */
export interface BaseGameState {
  phase: string;
  /** local performance.now() timestamp of the current phase deadline */
  deadlineAt: number | null;
  scores: Record<string, number>;
  finished: boolean;
  leaderboard: LeaderboardRow[] | null;
}

export interface SessionResponse {
  room: RoomSnapshot;
  participant: Participant;
  session_token: string;
  livekit_token: string;
}
