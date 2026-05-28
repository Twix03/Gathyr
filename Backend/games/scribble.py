from typing import Dict, Any, List, Optional
import random
import time
from .base import Game, GamePhase

WORDS = [
    "APPLE", "BANANA", "CAT", "DOG", "ELEPHANT", "FISH", "GRAPE", "HOUSE", "ICE CREAM", "JELLYFISH",
    "KITE", "LION", "MOUSE", "NEST", "ORANGE", "PENGUIN", "QUEEN", "RABBIT", "SUN", "TREE",
    "UMBRELLA", "VIOLIN", "WHALE", "XYLOPHONE", "YACHT", "ZEBRA", "AIRPLANE", "BOAT", "CAR", "DUCK"
]

class ScribbleGame(Game):
    def __init__(self, room_code: str):
        super().__init__(room_code)
        self.canvas_data: List[Dict[str, Any]] = []
        self.current_word: str = ""
        self.masked_word: str = ""
        self.drawer_id: str = ""
        self.round_duration = 60
        self.round_start_time: Optional[float] = None
        self.round_end_time: Optional[float] = None
        self.guessed_players: Dict[str, float] = {}
        self.round_number: int = 0
        
    def start_game(self):
        super().start_game()
        self.round_number = 0
        self.start_round()
        
    def start_round(self):
        self.round_number += 1
        
        # Select new drawer
        self.drawer_id = self.next_turn()
        if not self.drawer_id:
            self.end_game()
            return
            
        # Select word
        self.current_word = random.choice(WORDS)
        self.masked_word = self._create_masked_word(self.current_word)
        
        # Reset state
        self.canvas_data = []
        self.guessed_players = {}
        
        # Set round timing
        self.round_start_time = time.time()
        self.round_end_time = self.round_start_time + self.round_duration
        
        # Start timer
        self.start_timer(self.round_duration)
    
    def _create_masked_word(self, word: str) -> str:
        """Create masked version of word with underscores."""
        return " ".join("_" if c != " " else " " for c in word)
        
    def handle_event(self, event_type: str, payload: Any, player_id: str) -> Dict[str, Any]:
        if event_type == "DRAW":
            # Only drawer can draw
            if player_id != self.drawer_id:
                return {}
            
            action = payload.get("action")
            
            if action == "CLEAR":
                self.canvas_data = []
                return {"type": "CANVAS_CLEAR", "payload": {}}
            elif action == "DRAW":
                draw_data = {
                    "x": payload.get("x"),
                    "y": payload.get("y"),
                    "color": payload.get("color"),
                    "lineWidth": payload.get("lineWidth"),
                    "isStart": payload.get("isStart", False)
                }
                self.canvas_data.append(draw_data)
                return {"type": "DRAW_UPDATE", "payload": draw_data}
                
            return {}
            
        elif event_type == "GUESS":
            # Drawer cannot guess
            if player_id == self.drawer_id:
                return {}
            
            # Check if round is still active
            if not self.round_start_time or not self.round_end_time:
                return {}
                
            # Already guessed correctly
            if player_id in self.guessed_players:
                return {}
                
            guess = payload.get("guess", "").upper().strip()
            
            if guess == self.current_word:
                guess_time = time.time()
                self.guessed_players[player_id] = guess_time
                
                # Calculate score based on how fast they guessed
                time_elapsed = guess_time - self.round_start_time
                time_remaining = self.round_end_time - guess_time
                
                # Score: 50 base + up to 50 bonus for speed
                time_ratio = max(0, time_remaining / self.round_duration)
                time_bonus = int(time_ratio * 50)
                guesser_points = 50 + time_bonus
                
                self.update_score(player_id, guesser_points)
                
                # Drawer gets 10 points for each correct guess
                drawer_points = 10
                self.update_score(self.drawer_id, drawer_points)
                
                # Check if everyone guessed
                total_guessers = len(self.players) - 1
                if len(self.guessed_players) >= total_guessers:
                    # Everyone guessed, end round early
                    self.end_round()
                    return {
                        "type": "GUESS_CORRECT", 
                        "payload": {
                            "player_id": player_id, 
                            "points": guesser_points,
                            "round_complete": True,
                            "word": self.current_word
                        }
                    }
                    
                return {
                    "type": "GUESS_CORRECT", 
                    "payload": {
                        "player_id": player_id, 
                        "points": guesser_points,
                        "round_complete": False
                    }
                }
            else:
                return {
                    "type": "GUESS_WRONG", 
                    "payload": {
                        "player_id": player_id, 
                        "guess": guess
                    }
                }
                 
        elif event_type == "ROUND_TIMEOUT":
            # Round timer expired
            self.end_round()
            return {
                "type": "ROUND_TIMEOUT", 
                "payload": {
                    "word": self.current_word
                }
            }
             
        elif event_type == "NEXT_ROUND":
            self.start_round()
            return {
                "type": "ROUND_START", 
                "payload": self.get_round_state()
            }
             
        return {}
        
    def end_round(self):
        """End the current round and stop timer."""
        self.stop_timer()
        self.round_start_time = None
        self.round_end_time = None
    
    def get_round_state(self) -> Dict[str, Any]:
        """Get the current round state for broadcasting."""
        return {
            "round_number": self.round_number,
            "drawer_id": self.drawer_id,
            "round_start_time": self.round_start_time,
            "round_end_time": self.round_end_time,
            "round_duration": self.round_duration,
            "guessed_players": list(self.guessed_players.keys()),
            "scores": self.scores
        }

    def get_state(self) -> Dict[str, Any]:
        """Get full game state."""
        base_state = super().get_state()
        return {
            **base_state,
            "drawer_id": self.drawer_id,
            "round_number": self.round_number,
            "round_start_time": self.round_start_time,
            "round_end_time": self.round_end_time,
            "round_duration": self.round_duration,
            "guessed_players": list(self.guessed_players.keys()),
            "canvas_data": self.canvas_data
        } 
        
    def get_player_state(self, player_id: str) -> Dict[str, Any]:
        """Get state filtered for specific player."""
        state = self.get_state()
        
        # Only send the word to the drawer
        if player_id == self.drawer_id:
            state["word"] = self.current_word
            state["is_drawer"] = True
        else:
            state["word"] = self.masked_word
            state["is_drawer"] = False
            state["has_guessed"] = player_id in self.guessed_players
            
        return state
