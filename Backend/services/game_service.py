"""Game state management service."""
from typing import Dict, Optional, Any


class GameService:
    """Service for managing game states."""
    
    def __init__(self):
        """Initialize the game service."""
        # room_code -> game_state
        self._game_states: Dict[str, Dict[str, Any]] = {}
    
    def set_game_state(self, room_code: str, game_id: str, state: Dict[str, Any]) -> None:
        """Set the game state for a room."""
        room_code = room_code.upper()
        if room_code not in self._game_states:
            self._game_states[room_code] = {}
        self._game_states[room_code][game_id] = state
    
    def get_game_state(self, room_code: str, game_id: str) -> Optional[Dict[str, Any]]:
        """Get the game state for a room."""
        room_code = room_code.upper()
        return self._game_states.get(room_code, {}).get(game_id)
    
    def update_game_state(self, room_code: str, game_id: str, updates: Dict[str, Any]) -> bool:
        """Update the game state for a room."""
        room_code = room_code.upper()
        if room_code not in self._game_states:
            self._game_states[room_code] = {}
        if game_id not in self._game_states[room_code]:
            self._game_states[room_code][game_id] = {}
        
        self._game_states[room_code][game_id].update(updates)
        return True
    
    def clear_game_state(self, room_code: str, game_id: str) -> bool:
        """Clear the game state for a room."""
        room_code = room_code.upper()
        if room_code in self._game_states and game_id in self._game_states[room_code]:
            del self._game_states[room_code][game_id]
            return True
        return False
    
    def clear_all_game_states(self, room_code: str) -> None:
        """Clear all game states for a room."""
        room_code = room_code.upper()
        if room_code in self._game_states:
            del self._game_states[room_code]


# Singleton instance
game_service = GameService()

