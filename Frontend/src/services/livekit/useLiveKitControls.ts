import { useEffect, useCallback } from "react";
import { RoomEvent, DataPacket_Kind, Track, LocalParticipant } from "livekit-client";
import { useLiveKitRoom } from "./liveKitRoom";
import { useLocalPreferences } from "../LocalPreferencesContext";

type ControlMessage = {
    type: "MUTE_REQ" | "DISABLE_VIDEO_REQ";
    targetIdentity: string;
};

export function useLiveKitControls() {
    const room = useLiveKitRoom();
    const { setUserMediaPrefs } = useLocalPreferences();

    const sendControlMessage = useCallback((type: "MUTE_REQ" | "DISABLE_VIDEO_REQ", targetIdentity: string) => {
        const payload: ControlMessage = { type, targetIdentity };
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(payload));

        room.localParticipant.publishData(data, { reliable: true });
    }, [room]);

    const toggleMute = useCallback((identity: string, isLocal: boolean) => {
        if (isLocal) {
            const nextState = !room.localParticipant.isMicrophoneEnabled;
            room.localParticipant.setMicrophoneEnabled(nextState).then(() => {
                setUserMediaPrefs(nextState, room.localParticipant.isCameraEnabled);
            });
        } else {
            sendControlMessage("MUTE_REQ", identity);
        }
    }, [room, sendControlMessage, setUserMediaPrefs]);

    const toggleVideo = useCallback((identity: string, isLocal: boolean) => {
        if (isLocal) {
            const nextState = !room.localParticipant.isCameraEnabled;
            room.localParticipant.setCameraEnabled(nextState).then(() => {
                setUserMediaPrefs(room.localParticipant.isMicrophoneEnabled, nextState);
            });
        } else {
            sendControlMessage("DISABLE_VIDEO_REQ", identity);
        }
    }, [room, sendControlMessage, setUserMediaPrefs]);

    const toggleScreenShare = useCallback(async () => {
        const isEnabled = room.localParticipant.isScreenShareEnabled;
        try {
            if (!isEnabled) {
                // Enable with audio capture (user can choose in browser prompt)
                await room.localParticipant.setScreenShareEnabled(true, { audio: true });
            } else {
                await room.localParticipant.setScreenShareEnabled(false);
            }
        } catch (e) {
            console.error("Error toggling screen share:", e);
        }
    }, [room]);

    useEffect(() => {
        const handleDataReceived = (payload: Uint8Array, participant: any) => {
            try {
                const decoder = new TextDecoder();
                const msg = JSON.parse(decoder.decode(payload)) as ControlMessage;

                if (msg.targetIdentity === room.localParticipant.identity) {
                    console.log("Received control message:", msg);
                    if (msg.type === "MUTE_REQ") {
                        // Moderator requested mute
                        room.localParticipant.setMicrophoneEnabled(false).then(() => {
                            setUserMediaPrefs(false, room.localParticipant.isCameraEnabled);
                        });
                    } else if (msg.type === "DISABLE_VIDEO_REQ") {
                        // Moderator requested video off
                        room.localParticipant.setCameraEnabled(false).then(() => {
                            setUserMediaPrefs(room.localParticipant.isMicrophoneEnabled, false);
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to parse control message", err);
            }
        };

        room.on(RoomEvent.DataReceived, handleDataReceived);
        return () => {
            room.off(RoomEvent.DataReceived, handleDataReceived);
        };
    }, [room, setUserMediaPrefs]);

    return { toggleMute, toggleVideo, toggleScreenShare };
}
