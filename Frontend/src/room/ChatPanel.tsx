import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useParticipantMap, useRoom, useRoomStore } from '../lib/roomStore';
import { Avatar } from '../ui/Avatar';
import { cn } from '../ui/cn';
import { toast } from 'sonner';

const time = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function ChatPanel() {
  const store = useRoomStore();
  const chat = useRoom((s) => s.chat);
  const me = useRoom((s) => s.me);
  const people = useParticipantMap();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (store.send('chat', { text: value })) setText('');
    else toast.error("You're offline — message not sent.");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chat.length === 0 && (
          <p className="text-sm text-muted text-center mt-10">No messages yet. Say hi 👋</p>
        )}
        {chat.map((m, i) => {
          const mine = m.sender_id === me;
          const grouped = i > 0 && chat[i - 1].sender_id === m.sender_id && m.ts - chat[i - 1].ts < 120_000;
          const person = people.get(m.sender_id);
          return (
            <div key={m.id} className={cn('flex gap-2.5', grouped && '-mt-2')}>
              <div className="w-7 shrink-0">
                {!grouped && <Avatar name={m.sender_name} color={person?.color} size={28} />}
              </div>
              <div className="min-w-0">
                {!grouped && (
                  <div className="flex items-baseline gap-2">
                    <span className={cn('text-sm font-semibold', mine && 'text-accent')}>{mine ? 'You' : m.sender_name}</span>
                    <span className="text-[11px] text-faint">{time(m.ts)}</span>
                  </div>
                )}
                <p className="text-sm text-text/90 whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="p-3 border-t border-line flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Message everyone"
          className="flex-1 h-10 rounded-xl bg-raised border border-line px-3 text-sm placeholder:text-faint focus:outline-none focus:border-line-strong"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send"
          className="size-10 inline-flex items-center justify-center rounded-xl bg-accent text-accent-ink disabled:opacity-30">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
