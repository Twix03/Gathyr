import React, { useCallback } from 'react';
import LandingPage from '../components/LandingPage';
import { apiService } from '../services/api';
import { useNavigate } from 'react-router-dom';

function LandingRoute() {
  const navigate = useNavigate();

  const handleCreateRoom = async (userName: string) => {
    const { room, participant, token } = await apiService.createRoom({
      name: userName,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`,
    });

    localStorage.setItem('participant', JSON.stringify(participant));
    localStorage.setItem('roomCode', room.code);

    navigate(`/rooms/${room.code}`, {
      state: { participant, token },
    });
  };

  const handleJoinRoom = async (roomCode: string, userName: string) => {
    const { room, participant, token } = await apiService.joinRoom(roomCode, {
      name: userName,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`,
    });

    localStorage.setItem('participant', JSON.stringify(participant));
    localStorage.setItem('roomCode', room.code);
    navigate(`/rooms/${room.code}`, {
      state: { participant, token },
    });
  };

  return (
    <LandingPage
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
    />
  );
}

export default LandingRoute;







