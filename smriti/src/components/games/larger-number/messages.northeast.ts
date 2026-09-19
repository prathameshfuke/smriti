/**
 * Bodo (brx, Devanagari), Manipuri (mni, Bengali script) and, where the game had none, Bengali (bn)
 * and Nepali (ne) strings for this game. brx/mni are LLM-assisted and NOT yet checked by a native
 * speaker: every string is listed with a confidence rating in docs/translation-review.md.
 */

export const LARGER_NUMBER_NORTHEAST = {
  brx: {
    games: {
      largerNumber: {
        gameUI: {
          level: "लेभेल",
          target: "{attempts} बारआव {accuracy}% ठिक खालाम",
          challenge: "गेदेर अंखनखौ {attempts} बार टाप खालाम, {accuracy}% ठिक खालामनो",
          starting: "शुरु जायो…",
          startChallenge: "शुरु",
          whichIsLarger: "मा अंखन गेदेर?",
          timeUp: "समो मोनथिबाय",
          totalAttempts: "नाजा",
          correctAnswers: "ठिक",
          accuracy: "ठिकनाय",
          nextLevel: "उनावनि लेभेल",
          nextLevelTarget: "{attempts} बारआव {accuracy}% ठिक खालाम",
          adjustDifficultyDescription: "आसान राउन्ड नाजा खालामनो ला बे लेभेल फिन नाजा खालामनो?",
          decreaseDifficulty: "आसान खालाम",
          keepCurrentDifficulty: "बे लेभेलआव फिन नाजा खालाम",
          continueChallenge: "थांनो",
          playAgain: "फिन खेला खालाम",
          share: "शेयार खालाम",
          congratulations: "मोजां जाबाय!",
          keepGoing: "मोजां नाजा, थांनो।"
        }
      }
    }
  },
  mni: {
    games: {
      largerNumber: {
        gameUI: {
          level: "লেবেল",
          target: "হোৎনবা {attempts} দা {accuracy}% চুম্মি ফংবিয়ু",
          challenge: "অহেনবা নম্বরদা {attempts} খ্রাং তাপ তৌ, {accuracy}% চুম্মি ফংনা",
          starting: "হৌরি…",
          startChallenge: "হৌবিয়ু",
          whichIsLarger: "নম্বর কনা অহেনবনো?",
          timeUp: "মতম লোইখ্রে",
          totalAttempts: "হোৎনবা",
          correctAnswers: "চুম্মি",
          accuracy: "চুম্বা",
          nextLevel: "মতুংগী লেবেল",
          nextLevelTarget: "হোৎনবা {attempts} দা {accuracy}% চুম্মি ফংবিয়ু",
          adjustDifficultyDescription: "আসান রাউন্দ হোৎনবা নত্রগা লেবেল অসিদা অমুক হোৎনবা?",
          decreaseDifficulty: "আসান তৌ",
          keepCurrentDifficulty: "লেবেল অসিদা অমুক হোৎনবিয়ু",
          continueChallenge: "চৎলু",
          playAgain: "অমুক খেল তৌ",
          share: "শেয়ার তৌ",
          congratulations: "ফজেই!",
          keepGoing: "ফজবা হোৎনবা, চৎলু।"
        }
      }
    }
  },
  bn: {
    games: {
      largerNumber: {
        gameUI: {
          level: "স্তর",
          target: "{attempts}টি চেষ্টায় {accuracy}% সঠিক করুন",
          challenge: "বড় সংখ্যাটি চাপুন, {attempts} বার, {accuracy}% সঠিক লক্ষ্যে",
          starting: "শুরু হচ্ছে…",
          startChallenge: "শুরু",
          whichIsLarger: "কোন সংখ্যাটি বড়?",
          timeUp: "সময় শেষ",
          totalAttempts: "চেষ্টা",
          correctAnswers: "সঠিক",
          accuracy: "নির্ভুলতা",
          nextLevel: "পরের স্তর",
          nextLevelTarget: "{attempts}টি চেষ্টায় {accuracy}% সঠিক করুন",
          adjustDifficultyDescription: "আরও সহজ রাউন্ড চান, নাকি এই স্তর আবার চেষ্টা করবেন?",
          decreaseDifficulty: "আরও সহজ করুন",
          keepCurrentDifficulty: "এই স্তরে আবার চেষ্টা করুন",
          continueChallenge: "চালিয়ে যান",
          playAgain: "আবার খেলুন",
          share: "শেয়ার",
          congratulations: "খুব ভালো!",
          keepGoing: "ভালো চেষ্টা, চালিয়ে যান।"
        }
      }
    }
  },
  ne: {
    games: {
      largerNumber: {
        gameUI: {
          level: "तह",
          target: "{attempts} प्रयासमा {accuracy}% सही गर्नुहोस्",
          challenge: "ठूलो संख्या थिच्नुहोस्, {attempts} पटक, {accuracy}% सही हुने लक्ष्यमा",
          starting: "सुरु हुँदैछ…",
          startChallenge: "सुरु",
          whichIsLarger: "कुन संख्या ठूलो छ?",
          timeUp: "समय सकियो",
          totalAttempts: "प्रयास",
          correctAnswers: "सही",
          accuracy: "शुद्धता",
          nextLevel: "अर्को तह",
          nextLevelTarget: "{attempts} प्रयासमा {accuracy}% सही गर्नुहोस्",
          adjustDifficultyDescription: "के अझ सजिलो राउन्ड चाहनुहुन्छ, वा यही तह फेरि प्रयास गर्नुहुन्छ?",
          decreaseDifficulty: "अझ सजिलो बनाउनुहोस्",
          keepCurrentDifficulty: "यही तहमा फेरि प्रयास गर्नुहोस्",
          continueChallenge: "जारी राख्नुहोस्",
          playAgain: "फेरि खेल्नुहोस्",
          share: "साझा गर्नुहोस्",
          congratulations: "धेरै राम्रो!",
          keepGoing: "राम्रो प्रयास, जारी राख्नुहोस्।"
        }
      }
    }
  }
};
