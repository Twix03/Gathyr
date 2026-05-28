import { useEffect, useCallback, useRef } from "react";
import { RoomEvent, DataPacket_Kind, Track, LocalParticipant } from "livekit-client";
import { useLiveKitRoom } from "./liveKitRoom";
import { useLocalPreferences } from "../LocalPreferencesContext";

// Watches a screenshare MediaStreamTrack and dynamically switches contentHint
// between "motion" and "detail" based on how much the frame content is changing.
// This gives smooth playback during fast motion AND sharp rendering when static.
function startContentHintAdaptor(mediaTrack: MediaStreamTrack): () => void {
    const SAMPLE_INTERVAL_MS = 800;   // check every 800ms
    const MOTION_THRESHOLD = 0.04;    // fraction of pixels that must change to be "motion"
    const MOTION_TO_DETAIL_GRACE = 3; // consecutive "still" samples before switching to detail

    const video = document.createElement("video");
    video.srcObject = new MediaStream([mediaTrack]);
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    let prevData: Uint8ClampedArray | null = null;
    let stillCount = 0;
    let handle: ReturnType<typeof setInterval>;

    video.play().then(() => {
        canvas.width = 160;   // small sample size — fast to diff, accurate enough
        canvas.height = 90;

        handle = setInterval(() => {
            if (video.readyState < 2) return;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (prevData) {
                let diff = 0;
                const total = data.length / 4;
                for (let i = 0; i < data.length; i += 4) {
                    const dr = Math.abs(data[i]     - prevData[i]);
                    const dg = Math.abs(data[i + 1] - prevData[i + 1]);
                    const db = Math.abs(data[i + 2] - prevData[i + 2]);
                    if ((dr + dg + db) > 30) diff++;  // threshold per-pixel change
                }
                const motionFraction = diff / total;
                const isMotion = motionFraction > MOTION_THRESHOLD;

                if (isMotion) {
                    stillCount = 0;
                    if (mediaTrack.contentHint !== "motion") {
                        mediaTrack.contentHint = "motion";
                    }
                } else {
                    stillCount++;
                    if (stillCount >= MOTION_TO_DETAIL_GRACE && mediaTrack.contentHint !== "text") {
                        mediaTrack.contentHint = "text";  // "text" = detail/sharpness mode
                    }
                }
            }

            prevData = new Uint8ClampedArray(data);
        }, SAMPLE_INTERVAL_MS);
    }).catch(() => { /* track may have ended before play */ });

    return () => {
        clearInterval(handle);
        video.srcObject = null;
    };
}

type ControlMessage = {
    type: "MUTE_REQ" | "DISABLE_VIDEO_REQ";
    targetIdentity: string;
};

export function useLiveKitControls() {
    const room = useLiveKitRoom();
    const { setUserMediaPrefs } = useLocalPreferences();
    const stopContentHintAdaptorRef = useRef<(() => void) | null>(null);

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
                await room.localParticipant.setScreenShareEnabled(true, {
                    video: true,
                    // Explicit audio constraints for system/tab audio capture.
                    // autoGainControl + noiseSuppression cause periodic volume dips and
                    // unnatural sound on system audio — they're designed for mic voice,
                    // not for music/app audio from a shared screen.
                    // echoCancellation is also off: system audio doesn't need it and it
                    // can cause phase cancellation artifacts on media playback.
                    audio: {
                        autoGainControl: false,
                        noiseSuppression: false,
                        echoCancellation: false,
                        sampleRate: 48000,
                        channelCount: 2,
                    },
                    // "motion" tells the encoder to prioritise frame rate over sharpness.
                    // Better for fast-paced content (scrolling, video, dragging windows).
                    // "detail" would prioritise sharpness but drop frames under motion load.
                    contentHint: "motion",
                    selfBrowserSurface: "include",
                    resolution: { width: 1920, height: 1080, frameRate: 60 },
                }, {
                    simulcast: false,
                    screenShareEncoding: {
                        // 6 Mbps ceiling: fast-paced content generates large inter-frame
                        // differences that VP9 can't compress efficiently at 3 Mbps, causing
                        // the encoder to drop frames. Both users are on 50+ Mbps links so
                        // the extra headroom costs nothing in practice.
                        maxBitrate: 10_000_000,
                        maxFramerate: 60,
                        priority: "high",
                    },
                    degradationPreference: "maintain-framerate",
                });

                // Start adaptive content hint switching after track is published.
                const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
                const mediaTrack = screenPub?.track?.mediaStreamTrack;
                if (mediaTrack) {
                    stopContentHintAdaptorRef.current = startContentHintAdaptor(mediaTrack);
                }
            } else {
                stopContentHintAdaptorRef.current?.();
                stopContentHintAdaptorRef.current = null;
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
