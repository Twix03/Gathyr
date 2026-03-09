"""WebSocket routes for real-time communication."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from typing import Optional
import json

from ..services.room_service import room_service
from ..services.websocket_manager import ws_manager
from ..services.game_service import game_service

router = APIRouter()


@router.websocket("/ws/room/{room_code}")
async def websocket_room_endpoint(
    websocket: WebSocket,
    room_code: str,
    participant_id: str = Query(..., description="Participant ID"),
):
    """WebSocket endpoint for room communication"""

    # Verify participant is in room
    room = room_service.get_room(room_code)
    if not room:
        await websocket.close(code=1008, reason="Room not found")
        return
    
    participant = room.get_participant(participant_id)
    if not participant:
        await websocket.close(code=1008, reason="Participant not in room")
        return
    
    await ws_manager.connect(websocket, room_code, participant_id)
    
    # Send current room state to new participant
    game_state = None
    if room.current_game:
        game_state = room_service.get_game_state(room_code, participant_id)

    await websocket.send_json({
        "type": "room_state",
        "data": {
            "room": room.to_response(),
            "participants": [p.model_dump() for p in room.participants.values()],
            "game_state": game_state
        }
    })
    
    # Notify others of new connection
    print("participant joined");
    await ws_manager.broadcast_to_room(
        room_code,
        {
            "type": "participant_joined",
            "data": {
                "participant_id": participant_id,
            }
        },
        exclude_participant=participant_id
    )
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "participant_update":
                # Update participant state
                updates = data.get("data", {})
                updated = room_service.update_participant(
                    room_code,
                    participant_id,
                    voice_enabled=updates.get("voice_enabled"),
                    is_speaking=updates.get("is_speaking"),
                    video_enabled=updates.get("video_enabled"),
                )
                
                if updated:
                    # Broadcast update to all participants
                    await ws_manager.broadcast_to_room(
                        room_code,
                        {
                            "type": "participant_updated",
                            "data": {
                                "participant": updated.model_dump(),
                            }
                        }
                    )
            
            elif message_type == "game_state_update":
                # Update game state
                game_id = data.get("data", {}).get("game_id")
                state = data.get("data", {}).get("state", {})
                
                if game_id:
                    game_service.set_game_state(room_code, game_id, state)
                    
                    # Broadcast to all participants
                    await ws_manager.broadcast_to_room(
                        room_code,
                        {
                            "type": "game_state_updated",
                            "data": {
                                "game_id": game_id,
                                "state": state,
                            }
                        },
                        exclude_participant=participant_id
                    )
            
            elif message_type == "game_start":
                # Start a game
                game_id = data.get("data", {}).get("game_id")
                if game_id:
                    room_service.update_game_state(room_code, game_id)
                    
                    # Broadcast to all participants
                    await ws_manager.broadcast_to_room(
                        room_code,
                        {
                            "type": "game_started",
                            "data": {
                                "game_id": game_id,
                            }
                        }
                    )
            
                # Broadcast to all participants
                await ws_manager.broadcast_to_room(
                    room_code,
                    {
                        "type": "game_ended",
                        "data": {}
                    }
                )
            
            elif message_type == "propose_game":
                # Propose a game (or end)
                game_id = data.get("data", {}).get("game_id")
                proposal_type = data.get("data", {}).get("type", "START")
                
                if game_id:
                    room_service.propose_game(room_code, game_id, participant_id, proposal_type)
                    
                    # Broadcast to all participants
                    room_data = room_service.get_room(room_code)
                    if room_data and room_data.proposal:
                        await ws_manager.broadcast_to_room(
                            room_code,
                            {
                                "type": "proposal_created",
                                "data": {
                                    "game_id": room_data.proposal.game_id,
                                    "proposer_id": room_data.proposal.proposer_id,
                                    "created_at": room_data.proposal.created_at,
                                    "expires_at": room_data.proposal.expires_at,
                                    "type": room_data.proposal.type,
                                    "votes": room_data.proposal.votes
                                }
                            }
                        )

            elif message_type == "vote_game":
                # Vote on proposal
                vote = data.get("data", {}).get("vote") # boolean
                if vote is not None:
                    # Check for instant pass BEFORE voting, so we know the type
                    # Actually, we can just check after voting
                    room_before = room_service.get_room(room_code)
                    proposal_type = room_before.proposal.type if room_before and room_before.proposal else "START"
                    
                    if room_service.vote_proposal(room_code, participant_id, vote):
                        # Broadcast vote update
                        room_data = room_service.get_room(room_code)
                        if room_data and room_data.proposal:
                             await ws_manager.broadcast_to_room(
                                room_code,
                                {
                                    "type": "proposal_updated",
                                    "data": {
                                        "votes": room_data.proposal.votes
                                    }
                                }
                            )
                            
                        # Check for "Instant Start" condition: All participants voted YES
                        if room_data and room_data.proposal:
                            all_voted_yes = False
                            if len(room_data.proposal.votes) == len(room_data.participants):
                                 if all(v for v in room_data.proposal.votes.values()):
                                     all_voted_yes = True
                            
                            if all_voted_yes:
                                 # Capture game_id before finalizing (which clears it)
                                 game_id = room_data.proposal.game_id
                                 
                                 # Auto-finalize
                                 passed = room_service.finalize_proposal(room_code)
                                 if passed:
                                     if proposal_type == 'START':
                                         await ws_manager.broadcast_to_room(
                                            room_code,
                                            {
                                                "type": "game_started",
                                                "data": {
                                                    "game_id": game_id,
                                                }
                                            }
                                        )
                                     elif proposal_type == 'END':
                                         await ws_manager.broadcast_to_room(
                                            room_code,
                                            {
                                                "type": "game_ended",
                                                "data": {}
                                            }
                                        )

            elif message_type == "finalize_proposal":
                # Triggered by client timeout
                
                # Peek at type before finalizing
                room_data = room_service.get_room(room_code)
                proposal_type = "START"
                game_id = ""
                if room_data and room_data.proposal:
                    proposal_type = room_data.proposal.type
                    game_id = room_data.proposal.game_id

                passed = room_service.finalize_proposal(room_code)
                if passed:
                     if proposal_type == 'START':
                        await ws_manager.broadcast_to_room(
                            room_code,
                            {
                                "type": "game_started",
                                "data": {
                                    "game_id": game_id,
                                }
                            }
                        )
                     elif proposal_type == 'END':
                        await ws_manager.broadcast_to_room(
                            room_code,
                            {
                                "type": "game_ended",
                                "data": {}
                            }
                        )
                else:
                    # Proposal Failed
                    await ws_manager.broadcast_to_room(
                        room_code,
                        {
                            "type": "proposal_failed",
                            "data": {}
                        }
                    )
            
            elif message_type == "chat_message":
                # Broadcast chat message
                message = data.get("data", {}).get("content")
                if message:
                    await ws_manager.broadcast_to_room(
                        room_code,
                        {
                            "type": "chat_message",
                            "data": {
                                "sender_id": participant_id,
                                "sender_name": participant.name,
                                "sender_avatar": participant.avatar,
                                "content": message,
                            }
                        }
                    )

            elif message_type == "game_action":
                action = data.get("data", {}).get("action")
                payload = data.get("data", {}).get("payload")
                
                if action:
                    updates = room_service.handle_game_action(room_code, participant_id, action, payload)
                    if updates:
                        await ws_manager.broadcast_to_room(
                            room_code,
                            {
                                "type": "game_event",
                                "data": updates
                            }
                        )
            
            else:
                # Unknown message type
                await websocket.send_json({
                    "type": "error",
                    "data": {
                        "message": f"Unknown message type: {message_type}"
                    }
                })
    
    except WebSocketDisconnect:
        pass

    except Exception as e:        
        print(f"WebSocket error: {e}")
    
    finally:
        # Cleanup on disconnect
        info = await ws_manager.disconnect(websocket)
        if info:
            room_code_disconnect, participant_id_disconnect = info
            
            # Participant stays in room, but only updated status
            room_service.update_participant(room_code_disconnect, participant_id_disconnect, is_connected=False);
            
            # Notify others
            await ws_manager.broadcast_to_room(
                room_code_disconnect,
                {
                    "type": "participant_disconnected",
                    "data": {
                        "participant_id": participant_id_disconnect,
                    }
                }
            )

