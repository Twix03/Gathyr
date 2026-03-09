"""Room management service."""
import secrets
import string
from typing import Dict, Optional
from datetime import datetime
from uuid import uuid4

from ..models.room import Room
from ..models.schemas import Participant, ParticipantCreate
from ..config import settings


class RoomService:
    """Service for managing rooms in memory."""
    
    def __init__(self):
        """Initialize the room service."""
        self._rooms: Dict[str, Room] = {}  # room_code -> Room
        self._participant_rooms: Dict[str, str] = {}  # participant_id -> room_code
    
    def generate_room_code(self) -> str:
        """Generate a unique room code."""
        while True:
            code = ''.join(
                secrets.choice(string.ascii_uppercase + string.digits)
                for _ in range(settings.room_code_length)
            )
            if code not in self._rooms:
                return code
    
    def create_room(self, participant_data: ParticipantCreate) -> tuple[Room, Participant]:
        """Create a new room with a participant."""
        room_code = self.generate_room_code()
        room_id = room_code  # Using code as ID for simplicity
        
        # Create participant
        participant_id = str(uuid4())
        avatar = participant_data.avatar or f"https://api.dicebear.com/7.x/avataaars/svg?seed={participant_data.name}"
        
        participant = Participant(
            id=participant_id,
            name=participant_data.name,
            avatar=avatar,
            voice_enabled=True,
            is_speaking=False,
            video_enabled=True,
        )
        
        # Create room
        room = Room(id=room_id, code=room_code)
        room.add_participant(participant)
        
        # Store room and mapping
        self._rooms[room_code] = room
        self._participant_rooms[participant_id] = room_code
        
        return room, participant
    
    def get_room(self, room_code: str) -> Optional[Room]:
        """Get a room by code."""
        return self._rooms.get(room_code.upper())
    
    def join_room(self, room_code: str, participant_data: ParticipantCreate) -> tuple[Room, Participant]:
        """Join an existing room."""
        room = self.get_room(room_code)
        if not room:
            raise ValueError(f"Room {room_code} not found")
        
        if len(room.participants) >= settings.max_room_participants:
            raise ValueError(f"Room {room_code} is full")
        
        # Create participant
        participant_id = str(uuid4())
        avatar = participant_data.avatar or f"https://api.dicebear.com/7.x/avataaars/svg?seed={participant_data.name}"
        
        participant = Participant(
            id=participant_id,
            name=participant_data.name,
            avatar=avatar,
            voice_enabled=True,
            is_speaking=False,
            video_enabled=True,
        )
        
        # Add to room
        room.add_participant(participant)
        self._participant_rooms[participant_id] = room_code.upper()
        
        return room, participant
    
    def rejoin_room(self, room_code: str, participant_id: str):
        room = self.get_room(room_code)

        if not room:
            raise ValueError("Room not found")

        participant = room.get_participant(participant_id)

        if not participant:
            raise ValueError("Participant not found in room")

        # Mark participant as active again
        participant.is_connected = True

        return room, participant

    def leave_room(self, room_code: str, participant_id: str) -> Optional[Participant]:
        """Remove a participant from a room."""
        room = self.get_room(room_code)
        if not room:
            return None
        
        participant = room.remove_participant(participant_id)
        self._participant_rooms.pop(participant_id, None)
        
        # Clean up empty rooms after timeout (could be moved to background task)
        if len(room.participants) == 0:
            # Don't delete immediately, keep for potential rejoin within timeout
            pass
        
        return participant
    
    def get_room_by_participant(self, participant_id: str) -> Optional[Room]:
        """Get the room a participant is in."""
        room_code = self._participant_rooms.get(participant_id)
        if room_code:
            return self.get_room(room_code)
        return None
    
    def update_participant(
        self,
        room_code: str,
        participant_id: str,
        voice_enabled: Optional[bool] = None,
        is_speaking: Optional[bool] = None,
        video_enabled: Optional[bool] = None,
        is_connected: Optional[bool] = None,
    ) -> Optional[Participant]:
        """Update participant state."""
        room = self.get_room(room_code)
        if not room:
            return None
        
        updates = {}
        if voice_enabled is not None:
            updates['voice_enabled'] = voice_enabled
        if is_speaking is not None:
            updates['is_speaking'] = is_speaking
        if video_enabled is not None:
            updates['video_enabled'] = video_enabled
        if is_connected is not None:
            updates['is_connected'] = is_connected
        
        return room.update_participant(participant_id, **updates)
    
    def update_game_state(self, room_code: str, game_id: Optional[str]) -> bool:
        """Update the current game in a room."""
        room = self.get_room(room_code)
        if not room:
            return False
        
        if game_id is None:
            # Ending game, update last_played
            if room.current_game:
                room.last_played = room.current_game
            room.current_game = None
        else:
            room.current_game = game_id
        
        room.updated_at = datetime.now()
        return True
    
    def get_all_rooms(self) -> Dict[str, Room]:
        """Get all rooms (for debugging/admin)."""
        return self._rooms.copy()


# Singleton instance
room_service = RoomService()

