import type { Room } from 'livekit-client';

/**
 * Host moderation over LiveKit data packets. LiveKit authenticates the sender's
 * identity, and receivers only obey messages whose sender is the current host.
 */
export type ModerationAction = 'mute';

export function sendModeration(room: Room, target: string, action: ModerationAction): void {
  const data = new TextEncoder().encode(JSON.stringify({ kind: 'moderation', action, target }));
  void room.localParticipant.publishData(data, { reliable: true, destinationIdentities: [target] });
}

export function parseModeration(payload: Uint8Array): { action: ModerationAction; target: string } | null {
  try {
    const msg = JSON.parse(new TextDecoder().decode(payload));
    return msg?.kind === 'moderation' && msg.action === 'mute' ? msg : null;
  } catch {
    return null;
  }
}
