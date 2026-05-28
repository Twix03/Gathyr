"""WebSocket connection manager."""
from typing import Dict, Set
from fastapi import WebSocket
import json


class WebSocketManager:
    """Manages WebSocket connections for rooms and participants."""
    
    def __init__(self):
        """Initialize the WebSocket manager."""
        # room_code -> Set[WebSocket]
        self._room_connections: Dict[str, Set[WebSocket]] = {}
        # participant_id -> WebSocket
        self._participant_connections: Dict[str, WebSocket] = {}
        # WebSocket -> (room_code, participant_id)
        self._connection_info: Dict[WebSocket, tuple[str, str]] = {}
    
    async def connect(self, websocket: WebSocket, room_code: str, participant_id: str) -> None:
        """Connect a WebSocket to a room."""
        await websocket.accept()
        
        room_code = room_code.upper()
        
        # Store connections
        if room_code not in self._room_connections:
            self._room_connections[room_code] = set()
        self._room_connections[room_code].add(websocket)
        
        self._participant_connections[participant_id] = websocket
        self._connection_info[websocket] = (room_code, participant_id)
    
    async def disconnect(self, websocket: WebSocket) -> tuple[str, str] | None:
        """Disconnect a WebSocket."""
        info = self._connection_info.pop(websocket, None)
        if not info:
            return None
        
        room_code, participant_id = info
        
        # Remove from room connections
        if room_code in self._room_connections:
            self._room_connections[room_code].discard(websocket)
            if not self._room_connections[room_code]:
                del self._room_connections[room_code]
        
        # Remove participant connection
        self._participant_connections.pop(participant_id, None)
        
        return (room_code, participant_id)
    
    async def send_to_participant(self, participant_id: str, message: dict) -> bool:
        """Send a message to a specific participant."""
        websocket = self._participant_connections.get(participant_id)
        if websocket:
            try:
                await websocket.send_json(message)
                return True
            except Exception:
                return False
        return False
    
    async def broadcast_to_room(self, room_code: str, message: dict, exclude_participant: str | None = None) -> int:
        """Broadcast a message to all participants in a room."""
        room_code = room_code.upper()
        connections = self._room_connections.get(room_code, set()).copy()
        
        sent_count = 0
        disconnected = []
        
        for websocket in connections:
            # Skip excluded participant
            info = self._connection_info.get(websocket)
            if info and info[1] == exclude_participant:
                continue
            
            try:
                await websocket.send_json(message)
                sent_count += 1
            except Exception:
                disconnected.append(websocket)
        
        # Clean up disconnected connections
        for websocket in disconnected:
            await self.disconnect(websocket)
        
        return sent_count
    
    def get_room_connections_count(self, room_code: str) -> int:
        """Get the number of active connections in a room."""
        return len(self._room_connections.get(room_code.upper(), set()))
    
    def is_participant_connected(self, participant_id: str) -> bool:
        """Check if a participant is connected via WebSocket."""
        return participant_id in self._participant_connections


# Singleton instance
ws_manager = WebSocketManager()

