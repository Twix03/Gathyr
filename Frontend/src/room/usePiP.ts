import { useCallback, useEffect, useRef, useState } from 'react';

function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.document.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      target.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dpip = () => (window as any).documentPictureInPicture as
  | { requestWindow: (o: { width: number; height: number }) => Promise<Window> } | undefined;

/**
 * Document Picture-in-Picture.
 * Browsers only allow opening it from a user gesture — the old code tried on
 * `visibilitychange`, which is always rejected, so PiP never appeared. We now:
 *  - open it from a button, and
 *  - register the Media Session "enterpictureinpicture" action, which Chrome invokes
 *    automatically when a tab that is in a video call gets hidden.
 */
export function usePiP(auto: boolean) {
  const [win, setWin] = useState<Window | null>(null);
  const winRef = useRef<Window | null>(null);
  const supported = !!dpip();

  const open = useCallback(async () => {
    const api = dpip();
    if (!api || (winRef.current && !winRef.current.closed)) return;
    try {
      const w = await api.requestWindow({ width: 360, height: 420 });
      copyStyles(w);
      w.document.body.className = 'bg-ink';
      w.addEventListener('pagehide', () => { winRef.current = null; setWin(null); });
      winRef.current = w;
      setWin(w);
    } catch { /* user dismissed / not allowed */ }
  }, []);

  const close = useCallback(() => {
    winRef.current?.close();
    winRef.current = null;
    setWin(null);
  }, []);

  useEffect(() => {
    if (!supported || !auto || !('mediaSession' in navigator)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigator.mediaSession.setActionHandler('enterpictureinpicture' as any, () => { void open(); });
    } catch { /* not supported in this browser */ }
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { navigator.mediaSession.setActionHandler('enterpictureinpicture' as any, null); } catch { /* */ }
    };
  }, [supported, auto, open]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && auto) close(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [auto, close]);

  useEffect(() => () => winRef.current?.close(), []);

  return { pipWindow: win, supported, open, close, isOpen: !!win };
}
