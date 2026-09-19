/**
 * Bodo (brx, Devanagari), Manipuri (mni, Bengali script) and, where the game had none, Bengali (bn)
 * and Nepali (ne) strings for this game. brx/mni are LLM-assisted and NOT yet checked by a native
 * speaker: every string is listed with a confidence rating in docs/translation-review.md.
 */

export const FROG_LEAP_NORTHEAST = {
  brx: {
    games: {
      frogMemoryLeap: {
        gameUI: {
          level: "लेभेल {level}",
          watch: "लांनाय नुनो",
          repeat: "दानि नों बेबादिनो लां",
          correct: "मोजां लांनाय!",
          gameOver: "पुरा ठिक नङा, फिन नाजा खालाम",
          start: "शुरु",
          score: "स्कोर: {score}",
          highScore: "सबसे मोजां: {score}",
          tryAgain: "फिन नाजा खालाम",
          settings: "सेटिंस",
          startLevel: "शुरुनि लेभेल",
          cancel: "रद्द खालाम",
          save: "सेभ खालाम"
        }
      }
    }
  },
  mni: {
    games: {
      frogMemoryLeap: {
        gameUI: {
          level: "লেবেল {level}",
          watch: "লাংনবা উবিয়ু",
          repeat: "হৌজিক নহাক্না অসিগুম্না লাংলু",
          correct: "ফজবা লাংবা!",
          gameOver: "চুম্দ্রে, অমুক হোৎনবিয়ু",
          start: "হৌবিয়ু",
          score: "স্কোর: {score}",
          highScore: "ফজবা: {score}",
          tryAgain: "অমুক হোৎনসি",
          settings: "সেটিংস",
          startLevel: "হৌখিবগী লেবেল",
          cancel: "রদ্দ তৌ",
          save: "সেভ তৌ"
        }
      }
    }
  },
  bn: {
    games: {
      frogMemoryLeap: {
        gameUI: {
          level: "স্তর {level}",
          watch: "লাফ দেখুন",
          repeat: "এবার আপনি একইভাবে লাফ দিন",
          correct: "দারুণ লাফ!",
          gameOver: "ঠিক হয়নি, আবার চেষ্টা করুন",
          start: "শুরু",
          score: "স্কোর: {score}",
          highScore: "সেরা: {score}",
          tryAgain: "আবার চেষ্টা করুন",
          settings: "সেটিংস",
          startLevel: "শুরুর স্তর",
          cancel: "বাতিল করুন",
          save: "সংরক্ষণ করুন"
        }
      }
    }
  },
  ne: {
    games: {
      frogMemoryLeap: {
        gameUI: {
          level: "तह {level}",
          watch: "हेर्नुपर्ने उफ्राइ",
          repeat: "अब तपाईं त्यसैगरी उफ्रनुहोस्",
          correct: "राम्रो उफ्राइ!",
          gameOver: "ठ्याक्कै भएन, फेरि प्रयास गर्नुहोस्",
          start: "सुरु",
          score: "स्कोर: {score}",
          highScore: "उत्कृष्ट: {score}",
          tryAgain: "फेरि प्रयास गर्नुहोस्",
          settings: "सेटिङ",
          startLevel: "सुरुको तह",
          cancel: "रद्द गर्नुहोस्",
          save: "सुरक्षित गर्नुहोस्"
        }
      }
    }
  }
};
