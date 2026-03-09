from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union
import time
import asyncio
from enum import Enum
from dataclasses import dataclass, field

class GamePhase(str, Enum):
    LOBBY = "LOBBY"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    ENDED = "ENDED"

@dataclass
class TimerState:
    duration: int
    started_at: Optional[float] = None
    paused_at: Optional[float] = None
    
    @property
    def remaining(self) -> int:
        if not self.started_at:
            return self.duration
        
        now = time.time()
        elapsed = now - self.started_at
        if self.paused_at:
            elapsed = self.paused_at - self.started_at
            
        return max(0, int(self.duration - elapsed))

class Game(ABC):
    """Abstract base class for all games."""
    
    def __init__(self, room_code: str):
        self.room_code = room_code
        self.phase = GamePhase.LOBBY
        self.players: List[str] = [] # List of participant IDs
        self.teams: Dict[str, List[str]] = {} # team_id -> list of participant IDs
        self.scores: Dict[str, int] = {} # entity_id (player or team) -> score
        self.timer: Optional[TimerState] = None
        self.current_turn_index: int = -1
        self.created_at = time.time()
        
    def add_player(self, player_id: str):
        if player_id not in self.players:
            self.players.append(player_id)
            if player_id not in self.scores:
                self.scores[player_id] = 0
                
    def remove_player(self, player_id: str):
        if player_id in self.players:
            self.players.remove(player_id)
            
    def start_game(self):
        self.phase = GamePhase.IN_PROGRESS
        self.current_turn_index = -1
        
    def end_game(self):
        self.phase = GamePhase.ENDED
        self.stop_timer()
        
    def next_turn(self) -> Optional[str]:
        """Advances turn and returns the ID of the next player/team."""
        if not self.players:
            return None
            
        self.current_turn_index = (self.current_turn_index + 1) % len(self.players)
        return self.players[self.current_turn_index]
        
    def start_timer(self, duration: int):
        self.timer = TimerState(duration=duration, started_at=time.time())
        
    def stop_timer(self):
        self.timer = None
        
    def pause_timer(self):
        if self.timer and not self.timer.paused_at:
            self.timer.paused_at = time.time()
            
    def resume_timer(self):
        if self.timer and self.timer.paused_at and self.timer.started_at:
            paused_duration = time.time() - self.timer.paused_at
            self.timer.started_at += paused_duration
            self.timer.paused_at = None

    def update_score(self, entity_id: str, points: int):
        if entity_id in self.scores:
            self.scores[entity_id] += points
        else:
            self.scores[entity_id] = points
            
    @abstractmethod
    def handle_event(self, event_type: str, payload: Any, player_id: str) -> Dict[str, Any]:
        """
        Handle game-specific events.
        Returns a dict of updates to be broadcasted, or None.
        """
        pass
        
    def get_state(self) -> Dict[str, Any]:
        """Return the full game state."""
        return {
            "room_code": self.room_code,
            "phase": self.phase,
            "players": self.players,
            "teams": self.teams,
            "scores": self.scores,
            "timer": {
                "duration": self.timer.duration,
                "remaining": self.timer.remaining,
                "active": self.timer.started_at is not None and self.timer.paused_at is None
            } if self.timer else None,
            "current_turn": self.players[self.current_turn_index] if 0 <= self.current_turn_index < len(self.players) else None
        }
