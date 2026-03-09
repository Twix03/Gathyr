import React from 'react';
import ReactDOM from 'react-dom';

interface PiPPortalProps {
    pipWindow: Window | null;
    children: React.ReactNode;
}

/**
 * Renders children into a DocumentPiP window via a React portal.
 * React context (LiveKit, LocalPreferences, etc.) flows through portals
 * automatically — no need to re-provide context inside the PiP window.
 */
export function PiPPortal({ pipWindow, children }: PiPPortalProps) {
    if (!pipWindow || pipWindow.closed) return null;
    return ReactDOM.createPortal(children, pipWindow.document.body);
}
