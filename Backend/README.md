# Gathyr Backend

FastAPI WebSocket backend server for real-time video/audio calling and game sessions.

## Features

- WebSocket-based real-time communication
- LiveKIT signaling for peer-to-peer connections
- Room management (create, join, leave)
- Participant state management
- Game state synchronization
- In-memory state storage (ready for DB migration)

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
# From the Backend directory
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or using Python module syntax
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## WebSocket Endpoints

- `/ws/room/{room_code}` - Main room WebSocket connection for signaling and events

## REST Endpoints

- `POST /api/rooms` - Create a new room
- `GET /api/rooms/{room_code}` - Get room information
- `POST /api/rooms/{room_code}/join` - Join a room
- `DELETE /api/rooms/{room_code}/participants/{participant_id}` - Leave a room

