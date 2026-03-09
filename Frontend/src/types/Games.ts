import {Room, Participant} from './Room'

export interface GameSessionProps {
    gameId: string;
    room: Room;
    currentUser: Participant;
    onEndGame: () => void;
    onUpdateUser: (user: Participant) => void;
  }