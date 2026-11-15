import type { ComponentType } from 'react';
import type { GameProps } from './common';
import Reaction from './Reaction';
import Scribble from './Scribble';
import Trivia from './Trivia';
import TruthOrDare from './TruthOrDare';
import TwoTruths from './TwoTruths';
import WordChain from './WordChain';

/** Game id (see Backend/gathyr/games) -> screen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAME_COMPONENTS: Record<string, ComponentType<GameProps<any>>> = {
  scribble: Scribble,
  trivia: Trivia,
  reaction: Reaction,
  wordchain: WordChain,
  'truth-or-dare': TruthOrDare,
  'two-truths': TwoTruths,
};
