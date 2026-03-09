"""Room management REST API routes."""
from fastapi import APIRouter, HTTPException, status
from typing import Optional

from ..models.schemas import RoomCreate, RoomJoin, RoomResponse, Participant
from ..services.room_service import room_service
from ..services.websocket_manager import ws_manager

router = APIRouter(prefix="/api/rooms", tags=["rooms"])
import traceback

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_room(request: RoomCreate) -> dict:
    """Create a new room."""
    try:
        room, participant, participant_token = room_service.create_room(request.participant)
        return {
            "room": room.to_response(),
            "participant": participant.model_dump(),
            "token": participant_token,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create room: {str(e)}"
        )


@router.get("/{room_code}", response_model=RoomResponse)
async def get_room(room_code: str) -> RoomResponse:
    """Get room information."""
    room = room_service.get_room(room_code)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room {room_code} not found"
        )
    
    room_data = room.to_response()
    return RoomResponse(**room_data)


@router.post("/{room_code}/join", response_model=dict)
async def join_room(room_code: str, request: RoomJoin) -> dict:
    """Join an existing room."""
    try:
        room, participant, participant_token = room_service.join_room(room_code, request.participant)
        
        # Notify other participants via WebSocket
        await ws_manager.broadcast_to_room(
            room_code,
            {
                "type": "participant_joined",
                "data": {
                    "participant": participant.model_dump(),
                }
            },
            exclude_participant=participant.id
        )
        
        return {
            "room": room.to_response(),
            "participant": participant.model_dump(),
            "token": participant_token,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to join room: {str(e)}"
        )

@router.post("/{room_code}/rejoin", response_model=dict)
async def rejoin_room(room_code: str, request: dict) -> dict:
    """
    Rejoin an existing room using participant_id.
    Used on page refresh / reconnect.
    """
    try:
        participant_id = request.get("participant_id")
        if not participant_id:
            raise ValueError("participant_id is required")

        room, participant, participant_token = room_service.rejoin_room(room_code, participant_id)

        # Notify others that participant is back
        await ws_manager.broadcast_to_room(
            room_code,
            {
                "type": "participant_rejoined",
                "data": {
                    "participant": participant.model_dump(),
                }
            },
            exclude_participant=participant.id
        )

        return {
            "room": room.to_response(),
            "participant": participant.model_dump(),
            "token": participant_token,
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rejoin room: {str(e)}"
        )


@router.delete("/{room_code}/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def leave_room(room_code: str, participant_id: str) -> None:
    """Leave a room."""
    participant = room_service.leave_room(room_code, participant_id)
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant or room not found"
        )
    
    # Disconnect WebSocket if connected
    if ws_manager.is_participant_connected(participant_id):
        # WebSocket handler will handle cleanup
        pass
    
    # Notify other participants
    await ws_manager.broadcast_to_room(
        room_code,
        {
            "type": "participant_left",
            "data": {
                "participant_id": participant_id,
            }
        }
    )

