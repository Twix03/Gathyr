# Frontend Integration Guide

## WebSocket Connection

The frontend needs to connect to the WebSocket endpoint after joining/creating a room.

### WebSocket URL
```
ws://localhost:8000/ws/room/{room_code}?participant_id={participant_id}
```

### Message Types

#### 1. Receive Messages

**Room State (on connect)**
```json
{
  "type": "room_state",
  "data": {
    "room": {...},
    "participants": [...]
  }
}
```

**Participant Joined**
```json
{
  "type": "participant_joined",
  "data": {
    "participant": {...}
  }
}
```

**Participant Left**
```json
{
  "type": "participant_left",
  "data": {
    "participant_id": "uuid"
  }
}
```

**Participant Updated**
```json
{
  "type": "participant_updated",
  "data": {
    "participant": {...}
  }
}
```

**WebRTC Offer**
```json
{
  "type": "webrtc_offer",
  "data": {
    "offer": {...},
    "from_participant_id": "uuid"
  }
}
```

**WebRTC Answer**
```json
{
  "type": "webrtc_answer",
  "data": {
    "answer": {...},
    "from_participant_id": "uuid"
  }
}
```

**ICE Candidate**
```json
{
  "type": "ice_candidate",
  "data": {
    "candidate": {...},
    "from_participant_id": "uuid"
  }
}
```

**Game Started**
```json
{
  "type": "game_started",
  "data": {
    "game_id": "scribble"
  }
}
```

**Game State Updated**
```json
{
  "type": "game_state_updated",
  "data": {
    "game_id": "scribble",
    "state": {...}
  }
}
```

**Chat Message**
```json
{
  "type": "chat_message",
  "data": {
    "sender_id": "uuid",
    "sender_name": "John",
    "sender_avatar": "url",
    "content": "Hello!"
  }
}
```

#### 2. Send Messages

**WebRTC Offer**
```json
{
  "type": "webrtc_offer",
  "data": {
    "offer": {...},
    "target_participant_id": "uuid"
  }
}
```

**WebRTC Answer**
```json
{
  "type": "webrtc_answer",
  "data": {
    "answer": {...},
    "target_participant_id": "uuid"
  }
}
```

**ICE Candidate**
```json
{
  "type": "ice_candidate",
  "data": {
    "candidate": {...},
    "target_participant_id": "uuid"
  }
}
```

**Update Participant**
```json
{
  "type": "participant_update",
  "data": {
    "voice_enabled": true,
    "video_enabled": false
  }
}
```

**Start Game**
```json
{
  "type": "game_start",
  "data": {
    "game_id": "scribble"
  }
}
```

**Update Game State**
```json
{
  "type": "game_state_update",
  "data": {
    "game_id": "scribble",
    "state": {...}
  }
}
```

**Send Chat Message**
```json
{
  "type": "chat_message",
  "data": {
    "content": "Hello everyone!"
  }
}
```

## REST API Usage

### Create Room
```javascript
const response = await fetch('http://localhost:8000/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    participant: {
      name: 'John Doe',
      avatar: 'optional-avatar-url'
    }
  })
});
const { room, participant } = await response.json();
```

### Join Room
```javascript
const response = await fetch(`http://localhost:8000/api/rooms/${roomCode}/join`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    participant: {
      name: 'Jane Doe',
      avatar: 'optional-avatar-url'
    },
    room_code: roomCode
  })
});
const { room, participant } = await response.json();
```

### Get Room Info
```javascript
const response = await fetch(`http://localhost:8000/api/rooms/${roomCode}`);
const room = await response.json();
```

## Room Code URL Routing

For URL-based room joining (e.g., `domain.com/room/ABC123`), the frontend should:

1. Parse the URL path: `/room/{room_code}`
2. Check if room exists via REST API
3. If valid, show join dialog or auto-join if user info available
4. Connect WebSocket after joining

Example React Router setup:
```typescript
<Route path="/room/:roomCode" element={<RoomRedirect />} />
```

