import { createContext, useContext } from 'react';
import { Room, ScreenSharePresets, VideoPresets, type RoomOptions } from 'livekit-client';

/**
 * Media settings. Rationale:
 * - VP8 + simulcast: hardware/cheap to encode everywhere (VP9 was software-encoded on most
 *   laptops and all iPhones, so the encoder was CPU-starved and dropped resolution).
 * - 720p @ 2.5 Mbps top layer, 360p/180p lower layers for small tiles.
 * - adaptiveStream: each tile only downloads the layer it needs for its on-screen size, so
 *   big tiles get full quality and weak devices aren't decoding 16 × 720p streams.
 */
export const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
    facingMode: 'user',
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  publishDefaults: {
    videoCodec: 'vp8',
    videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 },
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
    screenShareSimulcastLayers: [],
    dtx: true,
    red: true,
  },
};

export function createMediaRoom(): Room {
  return new Room(ROOM_OPTIONS);
}

export const MediaRoomContext = createContext<Room | null>(null);

export function useMediaRoom(): Room {
  const room = useContext(MediaRoomContext);
  if (!room) throw new Error('useMediaRoom outside MediaRoomContext');
  return room;
}
