import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ChatMessage, Participant, RoomSnapshot } from './types';
import { withDeadlines } from './time';
import type { ConnectionStatus, FatalReason, RealtimeClient, ServerMessage } from './realtime';

export interface GameStateEnvelope {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
}

export interface GameEvent {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export interface RoomState {
  status: ConnectionStatus;
  fatal: FatalReason | null;
  me: string;
  room: RoomSnapshot;
  game: GameStateEnvelope | null;
  chat: ChatMessage[];
  lastError: { message: string; at: number } | null;
  lastProposalResult: { passed: boolean; type: string; game_id: string; at: number } | null;
}

type Listener = () => void;

/** Single source of truth for a joined room; fed by the realtime connection. */
export class RoomStore {
  private state: RoomState;
  private listeners = new Set<Listener>();
  private gameListeners = new Set<(e: GameEvent) => void>();
  private chatListeners = new Set<(m: ChatMessage) => void>();
  client: RealtimeClient | null = null;

  constructor(me: string, room: RoomSnapshot) {
    this.state = {
      status: 'connecting', fatal: null, me, room, game: null, chat: [],
      lastError: null, lastProposalResult: null,
    };
  }

  getState = (): RoomState => this.state;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  onGameEvent(fn: (e: GameEvent) => void): () => void {
    this.gameListeners.add(fn);
    return () => this.gameListeners.delete(fn);
  }

  onChat(fn: (m: ChatMessage) => void): () => void {
    this.chatListeners.add(fn);
    return () => this.chatListeners.delete(fn);
  }

  private set(patch: Partial<RoomState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  setStatus = (status: ConnectionStatus): void => this.set({ status });
  setFatal = (fatal: FatalReason): void => this.set({ fatal });

  handle = (msg: ServerMessage): void => {
    switch (msg.type) {
      case 'room_state':
        this.set({ room: withDeadlines(msg.data) });
        break;
      case 'game_state':
        this.set({ game: msg.data ? { id: msg.data.game_id, state: withDeadlines(msg.data.state) } : null });
        break;
      case 'game_event':
        this.gameListeners.forEach((l) => l(msg.data));
        break;
      case 'chat_history':
        this.set({ chat: msg.data.messages });
        break;
      case 'chat':
        this.set({ chat: [...this.state.chat.slice(-199), msg.data] });
        this.chatListeners.forEach((l) => l(msg.data));
        break;
      case 'proposal_result':
        this.set({ lastProposalResult: { ...msg.data, at: Date.now() } });
        break;
      case 'error':
        this.set({ lastError: { message: msg.data?.message ?? 'Something went wrong.', at: Date.now() } });
        break;
    }
  };

  send(type: string, data?: unknown): boolean {
    return this.client?.send(type, data) ?? false;
  }

  gameAction(action: string, payload: Record<string, unknown> = {}): boolean {
    return this.send('game_action', { action, payload });
  }
}

export const RoomStoreContext = createContext<RoomStore | null>(null);

export function useRoomStore(): RoomStore {
  const store = useContext(RoomStoreContext);
  if (!store) throw new Error('useRoomStore outside RoomStoreContext');
  return store;
}

export function useRoom<T>(selector: (s: RoomState) => T): T {
  const store = useRoomStore();
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export function useParticipantMap(): Map<string, Participant> {
  const participants = useRoom((s) => s.room.participants);
  // participants array identity only changes with a new snapshot
  return participantMapCache(participants);
}

const cache = new WeakMap<Participant[], Map<string, Participant>>();
function participantMapCache(list: Participant[]): Map<string, Participant> {
  let m = cache.get(list);
  if (!m) {
    m = new Map(list.map((p) => [p.id, p]));
    cache.set(list, m);
  }
  return m;
}
