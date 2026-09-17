/** next-intl messages for the reminiscence quiz — UI chrome only. The
 * question wording comes from the app locales (`game.reminiscenceQuiz.*`),
 * filled with the Memory Bank text exactly as the caregiver wrote it. */

const gameUI = {
  en: {
    heading: 'Family & Life Quiz',
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
  bn: {
    heading: 'পরিবার ও জীবনের কুইজ',
    correct: 'ঠিক!',
    tryTogether: 'চলুন একসাথে মনে করি।',
    next: 'পরের',
    finish: 'শেষ করুন',
    noQuizYet: 'এখনও কোনো কুইজ তৈরি নেই। আপনার পরিচর্যাকারীকে জিজ্ঞাসা করুন।',
    backHome: 'বাড়িতে ফিরুন',
  },
  ne: {
    heading: 'परिवार र जीवनको प्रश्नोत्तरी',
    correct: 'सही!',
    tryTogether: 'आउनुहोस् सँगै सम्झौं।',
    next: 'अर्को',
    finish: 'सकियो',
    noQuizYet: 'अहिलेसम्म कुनै प्रश्नोत्तरी तयार छैन। आफ्नो हेरचाह गर्नेलाई सोध्नुहोस्।',
    backHome: 'घर फर्कनुहोस्',
  },
};

export const REMINISCENCE_QUIZ_MESSAGES = {
  en: { games: { reminiscenceQuiz: { gameUI: gameUI.en } } },
  hi: { games: { reminiscenceQuiz: { gameUI: gameUI.hi } } },
  as: { games: { reminiscenceQuiz: { gameUI: gameUI.as } } },
  bn: { games: { reminiscenceQuiz: { gameUI: gameUI.bn } } },
  ne: { games: { reminiscenceQuiz: { gameUI: gameUI.ne } } },
};
