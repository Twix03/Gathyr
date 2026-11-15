import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

export function FeedbackDialog({ open, onOpenChange, roomCode }: {
  open: boolean; onOpenChange: (o: boolean) => void; roomCode: string;
}) {
  const [type, setType] = useState<'bug' | 'suggestion'>('suggestion');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await api.feedback(type, text.trim(), roomCode);
      toast.success('Thanks — we read every one.');
      setText('');
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Send feedback" description="Found a bug or have an idea?">
      <div className="inline-flex rounded-xl bg-raised p-1 border border-line mb-3">
        {(['suggestion', 'bug'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={cn('h-8 px-3 rounded-lg text-sm capitalize', type === t ? 'bg-text text-ink font-semibold' : 'text-muted')}>
            {t === 'bug' ? 'Bug' : 'Idea'}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5}
        placeholder={type === 'bug' ? 'What happened, and what did you expect?' : 'What would make Gathyr better?'}
        className="w-full rounded-xl bg-raised border border-line p-3 text-sm placeholder:text-faint focus:outline-none focus:border-line-strong resize-none" />
      <div className="mt-3 flex justify-end">
        <Button variant="primary" disabled={!text.trim() || sending} onClick={submit}>
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </Dialog>
  );
}
