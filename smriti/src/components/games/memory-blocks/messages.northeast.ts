/**
 * Bodo (brx, Devanagari), Manipuri (mni, Bengali script) and, where the game had none, Bengali (bn)
 * and Nepali (ne) strings for this game. brx/mni are LLM-assisted and NOT yet checked by a native
 * speaker: every string is listed with a confidence rating in docs/translation-review.md.
 */

export const MEMORY_BLOCKS_NORTHEAST = {
  brx: {
    games: {
      blockMemoryChallenge: {
        gameUI: {
          level: "लेभेल",
          watchSequence: "पैटार्नखौ नुनो",
          repeatSequence: "दानि बेखौ फिन खालाम",
          wellDone: "मोजां जाबाय!",
          bestScore: "सबसे मोजां",
          startLevelLabel: "शुरुनि लेभेल: {count}",
          starting: "शुरु जायो…",
          startGame: "शुरु",
          gameOver: "राउन्ड मोनथिबाय",
          finalScore: "स्कोर",
          playAgain: "फिन खेला खालाम",
          share: "शेयार खालाम"
        }
      }
    }
  },
  mni: {
    games: {
      blockMemoryChallenge: {
        gameUI: {
          level: "লেবেল",
          watchSequence: "প্যাটার্ন উবিয়ু",
          repeatSequence: "হৌজিক অদু অমুক তৌবিয়ু",
          wellDone: "ফজেই!",
          bestScore: "ফজবা",
          startLevelLabel: "হৌখিবগী লেবেল: {count}",
          starting: "হৌরি…",
          startGame: "হৌবিয়ু",
          gameOver: "রাউন্দ লোইখ্রে",
          finalScore: "স্কোর",
          playAgain: "অমুক খেল তৌ",
          share: "শেয়ার তৌ"
        }
      }
    }
  },
  bn: {
    games: {
      blockMemoryChallenge: {
        gameUI: {
          level: "স্তর",
          watchSequence: "নকশাটি দেখুন",
          repeatSequence: "এবার সেটি পুনরাবৃত্তি করুন",
          wellDone: "খুব ভালো!",
          bestScore: "সেরা",
          startLevelLabel: "শুরুর স্তর: {count}",
          starting: "শুরু হচ্ছে…",
          startGame: "শুরু",
          gameOver: "রাউন্ড শেষ",
          finalScore: "স্কোর",
          playAgain: "আবার খেলুন",
          share: "শেয়ার"
        }
      }
    }
  },
  ne: {
    games: {
      blockMemoryChallenge: {
        gameUI: {
          level: "तह",
          watchSequence: "ढाँचा हेर्नुहोस्",
          repeatSequence: "अब त्यसलाई दोहोर्याउनुहोस्",
          wellDone: "धेरै राम्रो!",
          bestScore: "उत्कृष्ट",
          startLevelLabel: "सुरुको तह: {count}",
          starting: "सुरु हुँदैछ…",
          startGame: "सुरु",
          gameOver: "राउन्ड सकियो",
          finalScore: "स्कोर",
          playAgain: "फेरि खेल्नुहोस्",
          share: "साझा गर्नुहोस्"
        }
      }
    }
  }
};
