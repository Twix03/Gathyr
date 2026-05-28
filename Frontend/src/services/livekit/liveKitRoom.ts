// LiveKitContext.ts
import { createContext, useContext } from "react";
import { Room as LiveKitRoom } from "livekit-client";

export const LiveKitRoomContext = createContext<LiveKitRoom | null>(null);

export function useLiveKitRoom() {
  const room = useContext(LiveKitRoomContext);
  if (!room) {
    throw new Error("useLiveKitRoom must be used inside LiveKitRoomContext");
  }
  return room;
}
