/** next-intl messages for the reminiscence quiz — UI chrome only. The quiz
 * questions themselves are AI-generated in English regardless of the
 * patient's language (see the plan's Decision 5); this file never
 * localizes their content. */

const gameUI = {
  en: {
    heading: 'Memory Match: Family & Life',
    correct: 'Correct!',
    tryTogether: "Let's remember together.",
    next: 'Next',
    finish: 'Finish',
    noQuizYet: 'No quiz is ready yet. Ask your caregiver to set one up.',
    backHome: 'Back to Home',
  },
  hi: {
    heading: 'यादों की प्रश्नोत्तरी',
    correct: 'सही!',
    tryTogether: 'आइए साथ मिलकर याद करें।',
    next: 'आगे',
    finish: 'समाप्त करें',
    noQuizYet: 'अभी कोई प्रश्नोत्तरी तैयार नहीं है। अपने देखभालकर्ता से पूछें।',
    backHome: 'घर वापस जाएं',
  },
  as: {
    heading: 'সোঁৱৰণৰ প্ৰশ্নোত্তৰ',
    correct: 'শুদ্ধ!',
    tryTogether: 'আহক একেলগে মনত পেলাওঁ।',
    next: 'পিছলৈ',
    finish: 'সমাপ্ত কৰক',
    noQuizYet: 'এতিয়াও কোনো প্ৰশ্নোত্তৰ প্ৰস্তুত হোৱা নাই। আপোনাৰ যত্নকাৰীক সুধিব।',
    backHome: 'ঘৰলৈ উভতি যাওক',
  },
};

export const REMINISCENCE_QUIZ_MESSAGES = {
  en: { games: { reminiscenceQuiz: { gameUI: gameUI.en } } },
  hi: { games: { reminiscenceQuiz: { gameUI: gameUI.hi } } },
  as: { games: { reminiscenceQuiz: { gameUI: gameUI.as } } },
};
