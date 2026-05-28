import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RoomPage from '../components/RoomPage';
import { websocketService, useRoomHandlers, useGameHandlers, useProposalHandlers } from '../services/websocket';
import { apiService } from '../services/api';
import { Room, Participant } from '../types/Room';
import { Room as LiveKitRoom, RoomOptions, VideoPresets } from "livekit-client";
import { config } from '../services/config'
import { LiveKitRoomContext } from "../services/livekit";
import { LocalPreferencesProvider } from '../services/LocalPreferencesContext';

function RoomRoute() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const mediaRoomRef = useRef<LiveKitRoom | null>(null);
  const lkTokenRef = useRef<string | null>(
    (window.history.state?.usr?.token as string | undefined) ?? null
  );

  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }

    // If we already have a user (e.g. from state update after rejoin), connect immediately.
    if (currentUser) {
      if (!lkTokenRef.current) {
        // Shouldn't happen, but bail to landing as a safety net.
        navigate(`/?room=${roomCode}`);
        return;
      }

      if (!mediaRoomRef.current) {
        const roomOptions: RoomOptions = {
          videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
          },
          publishDefaults: {
            videoCodec: "vp9",
            simulcast: true,
            screenShareEncoding: {
              maxBitrate: 3_000_000,
              maxFramerate: 30,
              priority: "high",
            },
          },
          adaptiveStream: false,
          dynacast: true,
        };
        mediaRoomRef.current = new LiveKitRoom(roomOptions);
      }

      websocketService.connect(roomCode, currentUser.id);

      const join = async () => {
        await mediaRoomRef.current!.connect(config.liveKitUrl, lkTokenRef.current!);
        const savedMic = localStorage.getItem('gathyr_user_mic') !== 'false';
        const savedVideo = localStorage.getItem('gathyr_user_video') !== 'false';
        await mediaRoomRef.current!.localParticipant.setMicrophoneEnabled(savedMic);
        await mediaRoomRef.current!.localParticipant.setCameraEnabled(savedVideo);
      };

      join();

      return () => {
        console.log('cleanup: disconnecting');
        websocketService.disconnect();
        mediaRoomRef.current?.disconnect();
      };
    }

    // No currentUser — try to auto-rejoin from localStorage (e.g. page refresh).
    const savedParticipantStr = localStorage.getItem('participant');
    const savedRoomCode = localStorage.getItem('roomCode');

    if (savedParticipantStr && savedRoomCode?.toUpperCase() === roomCode.toUpperCase()) {
      let savedParticipant: Participant;
      try {
        savedParticipant = JSON.parse(savedParticipantStr) as Participant;
      } catch {
        navigate(`/?room=${roomCode}`);
        return;
      }

      apiService.rejoinRoom(roomCode, savedParticipant.id)
        .then(({ participant, token }) => {
          lkTokenRef.current = token;
          localStorage.setItem('participant', JSON.stringify(participant));
          setCurrentUser(participant); // triggers effect rerun → connect
        })
        .catch(() => navigate(`/?room=${roomCode}`));
    } else {
      // No saved session, go to landing so user can enter their name.
      navigate(`/?room=${roomCode}`);
    }
  }, [roomCode, currentUser?.id, navigate]);

  // Register room-related handlers
  useRoomHandlers({
    setRoom: setCurrentRoom,
    setUser: setCurrentUser,
    currentUserId: currentUser?.id || '',
  });

  // Register game-related handlers
  useGameHandlers({
    setRoom: setCurrentRoom,
    onGameEvent: (event) => {
      // Game events are handled by individual game components
      console.log('Game event received in RoomRoute:', event);
    },
  });

  // Register proposal-related handlers
  useProposalHandlers({
    setRoom: setCurrentRoom,
  });

  const handleLeaveRoom = async () => {
    if (currentRoom && currentUser) {
      websocketService.disconnect();
      localStorage.removeItem('participant');
      localStorage.removeItem('participantId');
      localStorage.removeItem('roomCode');
      await apiService.leaveRoom(currentRoom.code, currentUser.id);
    }
    navigate('/');
  };

  const handleUpdateRoom = useCallback((room: Room) => {
    setCurrentRoom(room);
    if (room.currentGame) {
      websocketService.startGame(room.currentGame);
    } else {
      websocketService.endGame();
    }
  }, []);

  const handleUpdateUser = useCallback((user: Participant) => {
    setCurrentUser(user);
    websocketService.updateParticipant({
      voice_enabled: user.voiceEnabled,
      is_speaking: user.isSpeaking,
      video_enabled: user.videoEnabled,
    });
  }, []);

  if (!currentRoom || !currentUser) return null;

  return (
    <LiveKitRoomContext.Provider value={mediaRoomRef.current}>
      <LocalPreferencesProvider>
        <RoomPage
          room={currentRoom}
          currentUser={currentUser}
          onLeaveRoom={handleLeaveRoom}
          onUpdateRoom={handleUpdateRoom}
          onUpdateUser={handleUpdateUser}
        />
      </LocalPreferencesProvider>
    </LiveKitRoomContext.Provider>
  );
}

export default RoomRoute;