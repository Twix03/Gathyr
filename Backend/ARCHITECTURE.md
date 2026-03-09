# Backend Architecture

## Overview

The backend is built with FastAPI and uses WebSockets for real-time communication. 

## Directory Structure

```
Backend/
├── main.py                 # FastAPI app entry point
├── config.py              # Configuration settings
├── models/
│   ├── schemas.py         # Pydantic schemas for validation
│   └── room.py            # Room data model
├── services/
│   ├── room_service.py    # Room management (create, join, leave)
│   ├── websocket_manager.py  # WebSocket connection management
│   └── game_service.py    # Game state management
└── routers/
    ├── rooms.py           # REST API for room operations
    └── websocket.py       # WebSocket endpoint for signaling
```

## Data Flow

### Room Creation/Joining
1. Frontend sends REST API request to create/join room
2. Backend creates room/participant in memory
3. Returns room and participant data
4. Frontend connects WebSocket with participant_id

### Media Streaming 
- All activity related to media streaming is handled by LiveKit

### State Synchronization
- Participant updates (mute, video) broadcasted to all room members
- Game state changes broadcasted to all participants
- Chat messages broadcasted to room
- Room state sent on WebSocket connection

## In-Memory Storage

All state is stored in memory using dictionaries:
- `RoomService._rooms`: Room code -> Room object
- `RoomService._participant_rooms`: Participant ID -> Room code
- `WebSocketManager._room_connections`: Room code -> Set of WebSockets
- `WebSocketManager._participant_connections`: Participant ID -> WebSocket
- `GameService._game_states`: Room code -> Game states

## Future Database Migration

To migrate to a database:
1. Replace dictionary storage in services with DB queries
2. Keep in-memory WebSocket connections (or use Redis Pub/Sub for scaling)
3. Add database models using SQLAlchemy/ORM
4. Add migration scripts

## WebSocket Message Protocol

All WebSocket messages follow this structure:
```json
{
  "type": "message_type",
  "data": {...}
}
```

See `INTEGRATION.md` for complete message specifications.

## Security Considerations

Current implementation is minimal for development:
- No authentication (add JWT tokens)
- No rate limiting (add throttling)
- No input sanitization beyond Pydantic validation
- CORS allows all configured origins

## Scaling Considerations

For production scaling:
1. Use Redis for shared state across instances
2. Use Redis Pub/Sub for WebSocket message broadcasting
4. Add load balancer for multiple backend instances
5. Consider database for persistent state

