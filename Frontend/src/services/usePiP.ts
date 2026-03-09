import { useEffect, useRef, useState, useCallback } from 'react';

// CSS injection: copy all styles from main document into PiP window
function copyStylesToWindow(targetWindow: Window) {
    [...document.styleSheets].forEach(sheet => {
        try {
            if (sheet.cssRules) {
                const style = targetWindow.document.createElement('style');
                style.textContent = [...sheet.cssRules].map((r: CSSRule) => r.cssText).join('');
                targetWindow.document.head.appendChild(style);
            }
        } catch {
            // Cross-origin sheet — link it instead
            if (sheet.href) {
                const link = targetWindow.document.createElement('link');
                link.rel = 'stylesheet';
                link.href = sheet.href;
                targetWindow.document.head.appendChild(link);
            }
        }
    });
}

interface UsePiPOptions {
    /** Only attempt to open PiP when this is true (e.g. when there are participants) */
    enabled: boolean;
    width?: number;
    height?: number;
}

export function usePiP({ enabled, width = 420, height = 360 }: UsePiPOptions) {
    const pipWindowRef = useRef<Window | null>(null);
    const [isPiPOpen, setIsPiPOpen] = useState(false);
    const [isPiPSupported] = useState(() => 'documentPictureInPicture' in window);

    const openPiP = useCallback(async () => {
        if (!enabled || !isPiPSupported) return;
        // Already open
        if (pipWindowRef.current && !pipWindowRef.current.closed) return;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pipWindow: Window = await (window as any).documentPictureInPicture.requestWindow({
                width,
                height,
                disallowReturnToOpener: false,
            });

            // Style the PiP window chrome
            pipWindow.document.documentElement.style.height = '100%';
            const body = pipWindow.document.body;
            body.style.margin = '0';
            body.style.padding = '0';
            body.style.height = '100%';
            body.style.overflow = 'hidden';
            body.style.backgroundColor = '#13111b';

            // Inject all CSS from our main document
            copyStylesToWindow(pipWindow);

            pipWindowRef.current = pipWindow;
            setIsPiPOpen(true);

            // Handle user closing PiP manually (X button on the window)
            pipWindow.addEventListener('pagehide', () => {
                pipWindowRef.current = null;
                setIsPiPOpen(false);
            });
        } catch (e) {
            console.warn('Could not open Picture-in-Picture window:', e);
        }
    }, [enabled, isPiPSupported, width, height]);

    const closePiP = useCallback(() => {
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
            pipWindowRef.current.close();
        }
        pipWindowRef.current = null;
        setIsPiPOpen(false);
    }, []);

    // Auto-trigger on tab visibility change
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) {
                openPiP();
            } else {
                closePiP();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [openPiP, closePiP]);

    return {
        isPiPOpen,
        isPiPSupported,
        pipWindow: pipWindowRef.current,
        openPiP,
        closePiP,
    };
}
