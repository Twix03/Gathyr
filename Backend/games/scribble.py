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
        self.canvas_data: List[Dict[str, Any]] = [] # List of draw events
        self.current_word: str = ""
        self.masked_word: str = ""
        self.drawer_id: str = ""
        self.round_duration = 60 # seconds
        self.guessed_ids: set = set()
        
    def start_game(self):
        super().start_game()
        self.start_round()
        
    def start_round(self):
        # 1. Select new drawer
        self.drawer_id = self.next_turn()
        if not self.drawer_id:
            self.end_game()
            return
            
        # 2. Select word
        self.current_word = random.choice(WORDS)
        self.masked_word = "_ " * len(self.current_word)
        
        # 3. Reset state
        self.canvas_data = []
        self.guessed_ids = set()
        
        # 4. Start timer
        self.start_timer(self.round_duration)
        
    def handle_event(self, event_type: str, payload: Any, player_id: str) -> Dict[str, Any]:
        if event_type == "DRAW":
            # Only drawer can draw
            if player_id != self.drawer_id:
                return {}
            
            action = payload.get("action")
            data = payload.get("data")
            
            if action == "CLEAR":
                self.canvas_data = []
            else:
                self.canvas_data.append(payload)
                
            return {"type": "DRAW_UPDATE", "payload": payload}
            
        elif event_type == "GUESS":
            # Drawer cannot guess
            if player_id == self.drawer_id:
                return {}
                
            guess = payload.get("guess", "").upper().strip()
            
            if player_id in self.guessed_ids:
                return {} # Already guessed
                
            if guess == self.current_word:
                self.guessed_ids.add(player_id)
                
                # Calculate score based on remaining time
                # Max 100, Min 10
                time_bonus = 0
                if self.timer:
                    time_bonus = int((self.timer.remaining / self.round_duration) * 50)
                points = 50 + time_bonus
                
                self.update_score(player_id, points)
                # Drawer gets points too for good drawing
                self.update_score(self.drawer_id, 10)
                
                # Check if everyone guessed
                # Total guessers = Players - 1 (drawer)
                if len(self.guessed_ids) >= len(self.players) - 1:
                    self.end_round()
                    
                return {"type": "GUESS_CORRECT", "payload": {"player_id": player_id, "score": points}}
            else:
                 return {"type": "GUESS_WRONG", "payload": {"player_id": player_id, "guess": guess}}
                 
        elif event_type == "NEXT_ROUND":
             # Admin or logic to start next round
             # For now, maybe auto-start? Or explicit call?
             # Let's assume explicitly called or triggered by timer
             self.start_round()
             return {"type": "ROUND_START", "payload": self.get_state()}
             
        return {}
        
    def end_round(self):
        # Logic to handle round end (show word, etc)
        # For simplicity, just start next round immediately or wait?
        # Ideally, we have a REVEAL phase.
        # Let's just start next round for MVP or set phase to REVEAL
        self.start_round()

    def get_state(self) -> Dict[str, Any]:
        base_state = super().get_state()
        return {
            **base_state,
            "drawer_id": self.drawer_id,
            "masked_word": self.masked_word, # Only show masked word to guessers
            # Note: client needs to handle hiding 'current_word' from guessers
            # But the backend should ideally not even send it unless it's the drawer
            "round_duration": self.round_duration,
            "canvas_data_count": len(self.canvas_data) # Send full data separately on connect
        } 
        
    def get_player_state(self, player_id: str) -> Dict[str, Any]:
        """Get state filtered for specific player."""
        state = self.get_state()
        if player_id == self.drawer_id:
            state["word"] = self.current_word
        else:
             state["word"] = self.masked_word
        return state
