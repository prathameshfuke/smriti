/** next-intl messages for the copied block-memory-challenge PatternRecallGame. */

import { MEMORY_BLOCKS_NORTHEAST } from './messages.northeast';

const gameUI = {
  en: {
    level: 'Level',
    watchSequence: 'Watch the pattern',
    repeatSequence: 'Now repeat it',
    wellDone: 'Well done!',
    bestScore: 'Best',
    startLevelLabel: 'Starting level: {count}',
    starting: 'Starting…',
    startGame: 'Start',
    gameOver: 'Round finished',
    finalScore: 'Score',
    playAgain: 'Play again',
    share: 'Share',
  },
  hi: {
    level: 'स्तर',
    watchSequence: 'पैटर्न देखें',
    repeatSequence: 'अब दोहराएँ',
    wellDone: 'शाबाश!',
    bestScore: 'सर्वश्रेष्ठ',
    startLevelLabel: 'शुरुआती स्तर: {count}',
    starting: 'शुरू हो रहा है…',
    startGame: 'शुरू करें',
    gameOver: 'दौर समाप्त',
    finalScore: 'स्कोर',
    playAgain: 'फिर से खेलें',
    share: 'साझा करें',
  },
  as: {
    level: 'স্তৰ',
    watchSequence: 'আৰ্হি চাওক',
    repeatSequence: 'এতিয়া পুনৰাবৃত্তি কৰক',
    wellDone: 'বাহ!',
    bestScore: 'সৰ্বোত্তম',
    startLevelLabel: 'আৰম্ভণিৰ স্তৰ: {count}',
    starting: 'আৰম্ভ হৈছে…',
    startGame: 'আৰম্ভ কৰক',
    gameOver: 'ৰাউণ্ড শেষ',
    finalScore: 'স্ক\'ৰ',
    playAgain: 'পুনৰ খেলক',
    share: 'শ্বেয়াৰ কৰক',
  },
};

export const MEMORY_BLOCKS_MESSAGES = {
  en: { games: { blockMemoryChallenge: { gameUI: gameUI.en } } },
  hi: { games: { blockMemoryChallenge: { gameUI: gameUI.hi } } },
  as: { games: { blockMemoryChallenge: { gameUI: gameUI.as } } },
  ...MEMORY_BLOCKS_NORTHEAST,
};
