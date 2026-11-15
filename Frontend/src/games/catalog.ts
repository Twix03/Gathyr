import { Brain, Link2, MessageCircleQuestion, Pencil, Theater, Zap, type LucideIcon } from 'lucide-react';

export interface GameInfo {
  id: string;
  name: string;
  tagline: string;
  players: string;
  minPlayers: number;
  length: string;
  icon: LucideIcon;
  color: string;
}

/** Must match ids and min_players in Backend/gathyr/games. */
export const GAMES: GameInfo[] = [
  { id: 'scribble', name: 'Scribble', tagline: 'One person draws, everyone else races to guess the word.',
    players: '2–12', minPlayers: 2, length: '~8 min', icon: Pencil, color: '#ff7043' },
  { id: 'trivia', name: 'Trivia', tagline: 'Ten quick questions. Faster correct answers score more.',
    players: '1–16', minPlayers: 1, length: '~4 min', icon: Brain, color: '#5b8def' },
  { id: 'reaction', name: 'Quick Draw', tagline: "Wait for green, then tap. Jump the gun and you're out for the round.",
    players: '1–16', minPlayers: 1, length: '~2 min', icon: Zap, color: '#f5b841' },
  { id: 'wordchain', name: 'Word Chain', tagline: 'Say a word that starts with the last letter. Run out of time, lose a life.',
    players: '2–10', minPlayers: 2, length: '~6 min', icon: Link2, color: '#3dd68c' },
  { id: 'truth-or-dare', name: 'Truth or Dare', tagline: 'A spin picks someone. They choose — on camera.',
    players: '2–12', minPlayers: 2, length: 'Open-ended', icon: Theater, color: '#ff5c8a' },
  { id: 'two-truths', name: 'Two Truths & a Lie', tagline: 'Everyone writes three facts. Spot each other’s lie.',
    players: '2–12', minPlayers: 2, length: '~8 min', icon: MessageCircleQuestion, color: '#c77dff' },
];

export const gameById = (id: string | null | undefined) => GAMES.find((g) => g.id === id);
