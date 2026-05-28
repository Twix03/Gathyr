import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface LocalPreferencesContextType {
    locallyMuted: Set<string>;
    toggleLocalMute: (identity: string) => void;
    isLocallyMuted: (identity: string) => boolean;
    setUserMediaPrefs: (micEnabled: boolean, videoEnabled: boolean) => void;
}

const LocalPreferencesContext = createContext<LocalPreferencesContextType | null>(null);

export const LocalPreferencesProvider = ({ children }: { children: React.ReactNode }) => {
    const [locallyMuted, setLocallyMuted] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem('gathyr_locally_muted');
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (e) {
            console.error("Failed to load mute preferences", e);
            return new Set();
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('gathyr_locally_muted', JSON.stringify(Array.from(locallyMuted)));
        } catch (e) {
            console.error("Failed to save mute preferences", e);
        }
    }, [locallyMuted]);

    const toggleLocalMute = useCallback((identity: string) => {
        setLocallyMuted(prev => {
            const next = new Set(prev);
            if (next.has(identity)) {
                next.delete(identity);
            } else {
                next.add(identity);
            }
            return next;
        });
    }, []);

    const isLocallyMuted = useCallback((identity: string) => {
        return locallyMuted.has(identity);
    }, [locallyMuted]);

    const setUserMediaPrefs = useCallback((micEnabled: boolean, videoEnabled: boolean) => {
        try {
            localStorage.setItem('gathyr_user_mic', String(micEnabled));
            localStorage.setItem('gathyr_user_video', String(videoEnabled));
        } catch (e) {
            console.error("Failed to save user media preferences", e);
        }
    }, []);

    return (
        <LocalPreferencesContext.Provider value={{ locallyMuted, toggleLocalMute, isLocallyMuted, setUserMediaPrefs }}>
            {children}
        </LocalPreferencesContext.Provider>
    );
};

export const useLocalPreferences = () => {
    const context = useContext(LocalPreferencesContext);
    if (!context) {
        throw new Error("useLocalPreferences must be used within a LocalPreferencesProvider");
    }
    return context;
};
