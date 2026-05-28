# Frontend-Backend Integration

## Overview

The frontend has been integrated with the FastAPI backend for real-time communication, room management, and game state synchronization.

## Services Added

### 1. API Service (`src/services/api.ts`)
- Handles REST API calls for room operations
- Methods: `createRoom()`, `joinRoom()`, `getRoom()`, `leaveRoom()`
- Transforms backend response format to frontend format

### 2. WebSocket Service (`src/services/websocket.ts`)
- Manages WebSocket connection for real-time communication
- Handles reconnection with exponential backoff
- Provides methods for:
  - WebRTC signaling (offer, answer, ICE candidates)
  - Participant state updates
  - Chat messaging
  - Game state synchronization
- Message handler system for listening to backend events

### 3. Config Service (`src/services/config.ts`)
- Centralized API configuration
- Supports environment variables

## Integration Points

### App.tsx
- `handleCreateRoom()`: Calls API service and connects WebSocket
- `handleJoinRoom()`: Calls API service and connects WebSocket
- `handleLeaveRoom()`: Disconnects WebSocket and calls API
- WebSocket message handlers for real-time updates:
  - Room state synchronization
  - Participant join/leave events
  - Participant state updates
  - Game start/end events

### ChatPanel.tsx
- Integrated with WebSocket for sending/receiving messages
- Listens to `chat_message` events from backend
- Sends messages via `websocketService.sendChatMessage()`

### LandingPage.tsx
- Added URL parsing to extract room code from query parameters
- Auto-fills room code if present in URL (e.g., `?room=ABC123`)

## Environment Variables

Create a `.env` file in the Frontend directory:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

For production, update these to your production backend URLs.

## Usage

1. **Start the backend server** (from Backend directory):
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the frontend** (from Frontend directory):
   ```bash
   npm run dev
   ```

3. **Create or join a room** - The UI will automatically connect to the backend

## WebSocket Message Flow

### When a user creates/joins a room:
1. REST API call to create/join room
2. Receive room and participant data
3. Connect WebSocket with room code and participant ID
4. Receive `room_state` message with current room data

### Real-time updates:
- **Participant joined/left**: All participants receive notifications
- **Participant state changed** (mute/video): Broadcasted to all
- **Game started/ended**: Synchronized across all participants
- **Chat messages**: Broadcasted to all room participants

## WebRTC Signaling

The WebSocket service provides methods for WebRTC signaling:
- `sendWebRTCOffer()` - Send WebRTC offer to another participant
- `sendWebRTCAnswer()` - Send WebRTC answer
- `sendICECandidate()` - Send ICE candidate for NAT traversal

These can be used with the `RTCPeerConnection` API for peer-to-peer video/audio.

## Notes

- All state is synchronized with the backend via WebSocket
- The UI remains unchanged - only connection logic was added
- Reconnection is handled automatically with exponential backoff
- Error handling is in place for API failures

