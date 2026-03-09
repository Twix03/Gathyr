"""Room data models."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional, List, Any
from .schemas import Participant


@dataclass
class GameProposal:
    """Game proposal data."""
    game_id: str
    proposer_id: str
    created_at: float  # timestamp
    expires_at: float  # timestamp
    type: str # 'START' or 'END'
    votes: Dict[str, bool] = field(default_factory=dict)  # participant_id -> True(yes)/False(no)


@dataclass
class Room:
    """In-memory room representation."""
    id: str
    code: str
    participants: Dict[str, Participant] = field(default_factory=dict)
    current_game: Optional[str] = None
    game_state: Optional[Any] = None # Holds active Game instance
    last_played: Optional[str] = None
    proposal: Optional[GameProposal] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def add_participant(self, participant: Participant) -> None:
        """Add a participant to the room."""
        self.participants[participant.id] = participant
        self.updated_at = datetime.now()
    
    def remove_participant(self, participant_id: str) -> Optional[Participant]:
        """Remove a participant from the room."""
        participant = self.participants.pop(participant_id, None)
        if participant:
            self.updated_at = datetime.now()
        return participant
    
    def update_participant(self, participant_id: str, **updates) -> Optional[Participant]:
        """Update participant properties."""
        participant = self.participants.get(participant_id)
        if participant:
            for key, value in updates.items():
                if hasattr(participant, key) and value is not None:
                    setattr(participant, key, value)
            self.updated_at = datetime.now()
        return participant
    
    def get_participant(self, participant_id: str) -> Optional[Participant]:
        """Get a participant by ID."""
        return self.participants.get(participant_id)
            
    def to_response(self) -> Dict:
        """Convert room to API response format."""
        return {
            "id": self.id,
            "code": self.code,
            "participants": [p.model_dump() for p in self.participants.values()],
            "current_game": self.current_game,
            "last_played": self.last_played,
            "proposal": {
                "game_id": self.proposal.game_id,
                "proposer_id": self.proposal.proposer_id,
                "created_at": self.proposal.created_at,
                "expires_at": self.proposal.expires_at,
                "type": self.proposal.type,
                "votes": self.proposal.votes,
            } if self.proposal else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

