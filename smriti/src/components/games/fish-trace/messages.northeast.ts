/**
 * Bodo (brx, Devanagari), Manipuri (mni, Bengali script) and, where the game had none, Bengali (bn)
 * and Nepali (ne) strings for this game. brx/mni are LLM-assisted and NOT yet checked by a native
 * speaker: every string is listed with a confidence rating in docs/translation-review.md.
 */

export const FISH_TRACE_NORTHEAST = {
  brx: {
    games: {
      fishTrace: {
        title: "ना नाजा",
        level: "लेभेल",
        scorePrefix: "स्कोर",
        bestScore: "सबसे मोजां",
        start: "जोलोंनाय नाखौ नुनो",
        glowEnding: "बेफोरखौ सिनायथि खालाम…",
        tracking: "नुनायनो थानो; हारायनो नङा",
        selection: "नों नुनोनाय नाखौ टाप खालाम",
        perfect: "नों गासैखौ मोनबाय!",
        partial: "मोजां! नों कुछ मोनबाय",
        gameOver: "बे खेव नङा",
        startBtn: "शुरु",
        confirmSelection: "बाछा मोनथिबाय",
        tryAgain: "फिन नाजा खालाम",
        round: "लेभेल {level}",
        settings: "सेटिंस",
        startLevel: "शुरुनि लेभेल",
        cancel: "रद्द खालाम",
        save: "सेभ खालाम"
      }
    }
  },
  mni: {
    games: {
      fishTrace: {
        title: "ঙা তুংগৈনবা",
        level: "লেবেল",
        scorePrefix: "স্কোর",
        bestScore: "ফজবা",
        start: "মৈখিবা ঙা উবিয়ু",
        glowEnding: "অসিসিং নিংশিংবিয়ু…",
        tracking: "উরি চৎলু, লোয়ননা",
        selection: "নহাক্না উরিবা ঙাদু তাপ তৌ",
        perfect: "নহাক্না খুদিংমক ফংখ্রে!",
        partial: "ফজে! নহাক্না অহুম ফংখ্রে",
        gameOver: "মসি মতমদা নত্তে",
        startBtn: "হৌবিয়ু",
        confirmSelection: "বাছাই লোইখ্রে",
        tryAgain: "অমুক হোৎনসি",
        round: "লেবেল {level}",
        settings: "সেটিংস",
        startLevel: "হৌখিবগী লেবেল",
        cancel: "রদ্দ তৌ",
        save: "সেভ তৌ"
      }
    }
  },
  bn: {
    games: {
      fishTrace: {
        title: "মাছ অনুসরণ",
        level: "স্তর",
        scorePrefix: "স্কোর",
        bestScore: "সেরা",
        start: "জ্বলজ্বলে মাছগুলো দেখুন",
        glowEnding: "এগুলো মনে রাখুন…",
        tracking: "দেখতে থাকুন, হারিয়ে ফেলবেন না",
        selection: "যে মাছগুলো অনুসরণ করছিলেন সেগুলো চাপুন",
        perfect: "আপনি সবগুলো খুঁজে পেয়েছেন!",
        partial: "ভালো! কয়েকটি খুঁজে পেয়েছেন",
        gameOver: "এবার নয়",
        startBtn: "শুরু",
        confirmSelection: "বাছাই শেষ",
        tryAgain: "আবার চেষ্টা করুন",
        round: "স্তর {level}",
        settings: "সেটিংস",
        startLevel: "শুরুর স্তর",
        cancel: "বাতিল করুন",
        save: "সংরক্ষণ করুন"
      }
    }
  },
  ne: {
    games: {
      fishTrace: {
        title: "माछा पछ्याउनु",
        level: "तह",
        scorePrefix: "स्कोर",
        bestScore: "उत्कृष्ट",
        start: "चम्किरहेका माछा हेर्नुहोस्",
        glowEnding: "यिनलाई सम्झनुहोस्…",
        tracking: "हेरिरहनुहोस्, नगुमाउनुहोस्",
        selection: "पछ्याइरहेका माछाहरू थिच्नुहोस्",
        perfect: "तपाईंले सबै भेट्टाउनुभयो!",
        partial: "राम्रो! तपाईंले केही भेट्टाउनुभयो",
        gameOver: "यस पटक होइन",
        startBtn: "सुरु",
        confirmSelection: "छनोट सकियो",
        tryAgain: "फेरि प्रयास गर्नुहोस्",
        round: "तह {level}",
        settings: "सेटिङ",
        startLevel: "सुरुको तह",
        cancel: "रद्द गर्नुहोस्",
        save: "सुरक्षित गर्नुहोस्"
      }
    }
  }
};
