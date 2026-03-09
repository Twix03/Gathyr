"""Pydantic schemas for request/response validation."""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class ParticipantBase(BaseModel):
    """Base participant schema."""
    name: str = Field(..., min_length=1, max_length=50)
    avatar: Optional[str] = None


class ParticipantCreate(ParticipantBase):
    """Schema for creating a participant."""
    pass


class Participant(ParticipantBase):
    """Full participant schema."""
    id: str
    voice_enabled: bool = True
    is_speaking: bool = False
    video_enabled: bool = True
    is_connected: bool = True

    class Config:
        from_attributes = True


class RoomCreate(BaseModel):
    """Schema for creating a room."""
    participant: ParticipantCreate


class RoomJoin(BaseModel):
    """Schema for joining a room."""
    participant: ParticipantCreate
    room_code: str = Field(..., min_length=1, max_length=10)


class RoomResponse(BaseModel):
    """Schema for room response."""
    id: str
    code: str
    participants: list[Participant]
    current_game: Optional[str] = None
    last_played: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class GameStateUpdate(BaseModel):
    """Game state update schema."""
    game_id: str
    state: Dict[str, Any]


class ChatMessage(BaseModel):
    """Chat message schema."""
    content: str = Field(..., min_length=1, max_length=1000)
    sender_id: str


# WebSocket message types
class WebSocketMessage(BaseModel):
    """Base WebSocket message schema."""
    type: str
    data: Optional[Dict[str, Any]] = None


class ParticipantUpdate(BaseModel):
    """Participant update schema."""
    participant_id: str
    voice_enabled: Optional[bool] = None
    is_speaking: Optional[bool] = None
    video_enabled: Optional[bool] = None

