/**
 * Room WebSocket with authentication, heartbeat and endless reconnect.
 * Close codes mirror Backend/gathyr/hub.py.
 */
export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting';
export type FatalReason = 'replaced' | 'kicked' | 'invalid';

export interface ServerMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

interface Options {
  url: string;
  token: string;
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  onFatal: (reason: FatalReason) => void;
}

const FATAL: Record<number, FatalReason> = { 4001: 'replaced', 4003: 'kicked', 4004: 'invalid' };
const HEARTBEAT_MS = 15_000;
const STALE_MS = 40_000;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private ready = false;

  constructor(private opts: Options) {}

  start(): void {
    this.stopped = false;
    window.addEventListener('online', this.reconnectNow);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener('online', this.reconnectNow);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.clearTimers();
    this.ws?.close(1000);
    this.ws = null;
  }

  /** Returns false if the message could not be sent (offline). */
  send(type: string, data?: unknown): boolean {
    if (!this.ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, data }));
    return true;
  }

  private connect(): void {
    this.clearTimers();
    this.ready = false;
    this.opts.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: this.opts.token }));
    };
    ws.onmessage = (event) => {
      this.lastMessageAt = Date.now();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
        this.ready = true;
        this.attempt = 0;
        this.opts.onStatus('open');
        this.startHeartbeat();
      }
      if (msg.type !== 'pong') this.opts.onMessage(msg);
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.ready = false;
      this.clearTimers();
      if (this.stopped) return;
      const fatal = FATAL[event.code];
      if (fatal) {
        this.stopped = true;
        this.opts.onFatal(fatal);
        return;
      }
      this.scheduleReconnect();
    };
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastMessageAt > STALE_MS) {
        this.ws?.close(4000); // half-open socket: force a reconnect
        return;
      }
      this.send('ping');
    }, HEARTBEAT_MS);
  }

  private scheduleReconnect(): void {
    this.attempt += 1;
    const base = Math.min(10_000, 500 * 2 ** (this.attempt - 1));
    const delay = base / 2 + Math.random() * base / 2;
    this.opts.onStatus('reconnecting');
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private reconnectNow = (): void => {
    if (this.stopped || this.ready) return;
    this.connect();
  };

  private onVisibility = (): void => {
    if (document.visibilityState === 'visible') this.reconnectNow();
  };

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.retryTimer = null;
    this.heartbeat = null;
  }
}
