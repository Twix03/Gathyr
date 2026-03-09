"""Room management service."""
import secrets
import string
from typing import Dict, Optional, Any
from datetime import datetime
from uuid import uuid4

from ..models.room import Room
from ..models.schemas import Participant, ParticipantCreate
from ..config import settings
# from livekit import api
# from livekit import AccessToken, VideoGrants
from livekit.api import AccessToken, VideoGrants



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
    
    def generate_livekit_token(self, user_id: str, name: str, room_name: str) -> str:
        token = AccessToken(
                settings.livekit_api_key,
                settings.livekit_api_secret
            ).with_identity(user_id).with_name(name).with_grants(
                VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                )
            ).to_jwt()

        return token

    def create_room(self, participant_data: ParticipantCreate) -> tuple[Room, Participant, str]:
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
        return room, participant, self.generate_livekit_token(participant.id, participant.name, room_code)
    
    def get_room(self, room_code: str) -> Optional[Room]:
        """Get a room by code."""
        return self._rooms.get(room_code.upper())
    
    def join_room(self, room_code: str, participant_data: ParticipantCreate) -> tuple[Room, Participant, str]:
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
        
        return room, participant, self.generate_livekit_token(participant.id, participant.name, room_code)
    
    def rejoin_room(self, room_code: str, participant_id: str):
        room = self.get_room(room_code)

        if not room:
            raise ValueError("Room not found")

        participant = room.get_participant(participant_id)

        if not participant:
            raise ValueError("Participant not found in room")

        # Mark participant as active again
        participant.is_connected = True

        return room, participant, self.generate_livekit_token(participant.id, participant.name, room_code)

    def leave_room(self, room_code: str, participant_id: str) -> Optional[Participant]:
        """Remove a participant from a room."""
        room = self.get_room(room_code)
        if not room:
            return None
        
        participant = room.remove_participant(participant_id)
        self._participant_rooms.pop(participant_id, None)
        
        # Clean up empty rooms after timeout (could be moved to background task)
        if len(room.participants) == 0:
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
                
            # Clean up game state
            if room.game_state:
                room.game_state.end_game()
                room.game_state = None
                
            room.current_game = None
        else:
            room.current_game = game_id
            
            # Initialize Game Instance
            if game_id == "scribble":
                from ..games.scribble import ScribbleGame
                room.game_state = ScribbleGame(room_code)
                # Add existing participants
                for p_id in room.participants:
                    room.game_state.add_player(p_id)
                room.game_state.start_game()
            
        
        room.updated_at = datetime.now()
        return True
        
    def handle_game_action(self, room_code: str, participant_id: str, action_type: str, payload: Any) -> Dict[str, Any]:
        """Forward actions to the active game."""
        room = self.get_room(room_code)
        if not room or not room.game_state:
            return {}
            
        return room.game_state.handle_event(action_type, payload, participant_id)
    
    def get_game_state(self, room_code: str, participant_id: str) -> Optional[Dict[str, Any]]:
        """Get the current game state for a participant."""
        room = self.get_room(room_code)
        if not room or not room.game_state:
            return None
            
        # If the game has a method for player-specific state, use it
        if hasattr(room.game_state, "get_player_state"):
            return room.game_state.get_player_state(participant_id)
            
        return room.game_state.get_state()
    
    def get_all_rooms(self) -> Dict[str, Room]:
        """Get all rooms (for debugging/admin)."""
        return self._rooms.copy()
    
    def propose_game(self, room_code: str, game_id: str, proposer_id: str, proposal_type: str = 'START') -> bool:
        """Propose a game (or end game) in a room."""
        room = self.get_room(room_code)
        if not room:
            return False
            
        # Create a new proposal
        import time
        from ..models.room import GameProposal
        
        now = time.time()
        # 15 seconds expiration
        expires_at = now + 15
        
        room.proposal = GameProposal(
            game_id=game_id,
            proposer_id=proposer_id,
            created_at=now,
            expires_at=expires_at,
            type=proposal_type,
            votes={proposer_id: True} # Proposer vote yes by default
        )
        room.updated_at = datetime.now()
        return True

    def vote_proposal(self, room_code: str, participant_id: str, vote: bool) -> bool:
        """Vote on the current proposal."""
        room = self.get_room(room_code)
        if not room or not room.proposal:
            return False
            
        room.proposal.votes[participant_id] = vote
        room.updated_at = datetime.now()
        return True

    def finalize_proposal(self, room_code: str) -> bool:
        """Check the proposal status and execute if passed."""
        room = self.get_room(room_code)
        if not room or not room.proposal:
            return False
            
        # Decision Logic:
        # Pass if: Downvotes < 50%
        # Fail if: Downvotes >= 50%
        
        total_participants = len(room.participants)
        votes = room.proposal.votes
        
        # Count explicit downvotes
        downvotes = sum(1 for v in votes.values() if v is False)
        
        passed = downvotes < (total_participants / 2)
        
        if passed:
            if room.proposal.type == 'START':
                self.update_game_state(room_code, room.proposal.game_id)
            elif room.proposal.type == 'END':
                self.update_game_state(room_code, None)
            
        # Clear proposal
        room.proposal = None
        room.updated_at = datetime.now()
        
        return passed

    def cancel_proposal(self, room_code: str) -> bool:
        """Cancel the current proposal."""
        room = self.get_room(room_code)
        if not room:
            return False
            
        room.proposal = None
        room.updated_at = datetime.now()
        return True


# Singleton instance
room_service = RoomService()

