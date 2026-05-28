import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Monitor, X, Pin, PinOff } from 'lucide-react';
import { MediaParticipant } from "../services/livekit";
import { useLocalPreferences } from "../services/LocalPreferencesContext";
import { Track, TrackEvent } from 'livekit-client';
import { Rnd } from "react-rnd";

export interface VideoTileData {
    id: string;
    participant: MediaParticipant;
    type: 'camera' | 'screen';
    track?: Track;
}

export interface VideoTilePosition {
    x: number;
    y: number;
}
export interface VideoTileSize {
    width: number;
    height: number;
}

export const VideoTile = ({
    tile,
    controls,
    className,
    isDraggable,
    isResizable,
    parentRef,
    hideScreenShareButton,
    onHide,
    onPin,
    isPinned,
    position,
    size,
    defaultPosition,
    defaultSize,
    onDragStop,
    onResizeStop,
}: {
    tile: VideoTileData,
    controls: {
        toggleMute: (id: string, isLocal: boolean) => void;
        toggleVideo: (id: string, isLocal: boolean) => void;
        toggleScreenShare: () => void;
    },
    className?: string,
    isDraggable?: boolean,
    isResizable?: boolean,
    parentRef?: React.RefObject<HTMLDivElement | null>,
    hideScreenShareButton?: boolean,
    onHide?: () => void;
    onPin?: () => void;
    isPinned?: boolean;
    position?: VideoTilePosition;
    size?: VideoTileSize;
    defaultPosition?: VideoTilePosition;
    defaultSize?: VideoTileSize;
    onDragStop?: (e: unknown, d: { x: number; y: number }) => void;
    onResizeStop?: (e: unknown, direction: unknown, ref: HTMLElement, delta: { width: number; height: number }) => void;
}) => {

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const screenAudioRef = useRef<HTMLAudioElement>(null);

    const { isLocallyMuted, toggleLocalMute } = useLocalPreferences();
    const { participant, type, track } = tile;

    const locallyMuted = isLocallyMuted(participant.identity);
    const screenAudioMuted = isLocallyMuted(`${participant.identity}:screen`);
    const isScreen = type === 'screen';

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl || !track) return;

        const attach = () => {
            track.attach(videoEl);
            void videoEl.play().catch(() => {
                /* autoplay policy / not yet playable */
            });
        };

        attach();

        // Re-attach only when the underlying MediaStream is replaced (Restarted/Unmuted).
        // Do NOT re-attach on VideoDimensionsChanged — that fires constantly during screenshare
        // as the encoder adjusts resolution, and re-attaching causes a black-frame stutter
        // on the receiver every time. The existing MediaStream handles dimension changes fine.
        const onRestarted = () => attach();
        const onUnmuted = () => attach();

        track.on(TrackEvent.Restarted, onRestarted);
        track.on(TrackEvent.Unmuted, onUnmuted);

        return () => {
            track.off(TrackEvent.Restarted, onRestarted);
            track.off(TrackEvent.Unmuted, onUnmuted);
            track.detach(videoEl);
        };
        // Include track?.isMuted: when camera is off we render the avatar (no <video>). LiveKit
        // often keeps the same Track instance when video is toggled, so [track] alone does not
        // re-run — the new <video> never receives attach() and stays blank.
    }, [track, track?.isMuted]);

    useEffect(() => {
        if (type !== 'camera' || participant.isLocal) return;

        const audioEl = audioRef.current;
        if (!audioEl || !participant.audioTrack) return;

        participant.audioTrack.attach(audioEl);
        audioEl.play().catch(e => console.error("Audio play failed", e));

        return () => {
            participant.audioTrack?.detach(audioEl);
        };
    }, [participant.audioTrack, participant.isLocal, type]);

    useEffect(() => {
        if (type !== 'screen' || participant.isLocal) return;

        const audioEl = screenAudioRef.current;
        if (!audioEl || !participant.screenShareAudioTrack) return;

        participant.screenShareAudioTrack.attach(audioEl);
        audioEl.play().catch(e => console.error("Screen audio play failed", e));

        return () => {
            participant.screenShareAudioTrack?.detach(audioEl);
        };
    }, [participant.screenShareAudioTrack, participant.isLocal, type]);

    const isVideoEnabled = track ? !track.isMuted : false;
    const isAudioEnabled = participant.audioTrack ? !participant.audioTrack.isMuted : false;
    const isSpeaking = participant.isSpeaking;

    const tileContent = (
        <motion.div
            // layoutId causes Framer Motion to animate position/size changes across the DOM.
            // For screenshare tiles this fires on every tile-list reorder (e.g. when share starts)
            // and the layout animation competes with video decode, producing stutter.
            // Camera tiles keep layoutId for the smooth swap animation; screen tiles skip it.
            layoutId={isScreen ? undefined : tile.id}
            className={`relative group rounded-2xl overflow-hidden border bg-zinc-900 ${isSpeaking && !isScreen
                ? 'border-purple-500 shadow-lg shadow-purple-500/30'
                : 'border-white/10'
                } ${className || ''}`}
        >

            {/* ================= BACKGROUND ================= */}
            {isVideoEnabled ? (
                <>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={participant.isLocal}
                        className={`absolute inset-0 w-full h-full ${isScreen ? 'object-contain bg-zinc-950 [will-change:transform]' : 'object-cover'}`}
                    />
                    {!isScreen && <div className="absolute inset-0 bg-black/10" />}
                </>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-teal-900/30">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center">
                        {isScreen ? (
                            <Monitor className="w-10 h-10 text-white" />
                        ) : (
                            <span className="text-3xl text-white">
                                {participant.name.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* AUDIO */}
            {type === 'camera' && (
                <audio ref={audioRef} autoPlay muted={participant.isLocal || locallyMuted} />
            )}

            {type === 'screen' && (
                <audio ref={screenAudioRef} autoPlay muted={participant.isLocal || screenAudioMuted} />
            )}

            {/* SPEAKING INDICATOR */}
            {isSpeaking && !isScreen && (
                <motion.div
                    className="absolute inset-0 border-4 border-purple-500 rounded-2xl pointer-events-none z-10"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                />
            )}

            {/* PIN & HIDE BUTTONS */}
            <div className="absolute top-2 right-2 z-30 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onPin && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPin(); }}
                        className={`p-1.5 rounded-full shadow-md transition-colors ${
                            isPinned 
                                ? 'bg-purple-500 hover:bg-purple-600 text-white' 
                                : 'bg-black/60 hover:bg-purple-500/80 text-white'
                        }`}
                        title={isPinned ? 'Unpin' : 'Pin'}
                    >
                        {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                )}
                {onHide && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onHide(); }}
                        className="p-1.5 rounded-full bg-black/60 hover:bg-red-500/80 text-white shadow-md transition-colors"
                        title="Hide for me"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* BOTTOM BAR */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">

                <div className="flex items-center gap-2 truncate flex-1">
                    {isScreen && <Monitor size={14} className="text-purple-400" />}
                    <span className="font-medium truncate text-sm text-white">
                        {participant.name} {participant.isLocal ? '(You)' : ''}
                        {isScreen && ' (Screen)'}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">

                    {!participant.isLocal && type === 'camera' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleLocalMute(participant.identity); }}
                            className={`p-1.5 rounded-full backdrop-blur-sm ${!locallyMuted ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
                        >
                            {locallyMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                    )}

                    {type === 'camera' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                controls.toggleMute(participant.identity, participant.isLocal);
                            }}
                            className={`p-1.5 rounded-full backdrop-blur-sm ${isAudioEnabled ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
                        >
                            {isAudioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                        </button>
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (participant.isLocal && type === 'camera') {
                                controls.toggleVideo(participant.identity, participant.isLocal);
                            }
                        }}
                        disabled={!participant.isLocal || type === 'screen'}
                        className={`p-1.5 rounded-full backdrop-blur-sm ${isVideoEnabled ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
                    >
                        {isVideoEnabled ? <Video size={14} /> : <VideoOff size={14} />}
                    </button>

                    {participant.isLocal && !hideScreenShareButton && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                controls.toggleScreenShare();
                            }}
                            className={`p-1.5 rounded-full backdrop-blur-sm ${participant.screenShareTrack
                                ? 'bg-purple-500 text-white'
                                : 'bg-white/20 hover:bg-white/40 text-white'
                                }`}
                        >
                            <Monitor size={14} />
                        </button>
                    )}

                </div>
            </div>

        </motion.div>
    );

    if (!isResizable && !isDraggable) return tileContent;

    const isControlled = position !== undefined && size !== undefined;
    const defaultPos = defaultPosition ?? { x: 0, y: 0 };
    const defaultSz = defaultSize ?? { width: 320, height: 200 };

    return (
        <Rnd
            position={isControlled ? position : undefined}
            size={isControlled ? size : undefined}
            default={{
                x: defaultPos.x,
                y: defaultPos.y,
                width: defaultSz.width,
                height: defaultSz.height,
            }}
            bounds={parentRef?.current ?? "parent"}
            minWidth={220}
            minHeight={140}
            enableResizing={isResizable ? { bottomRight: true } : false}
            disableDragging={!isDraggable}
            onDragStop={onDragStop}
            onResizeStop={onResizeStop}
        >
            {tileContent}
        </Rnd>
    );
};