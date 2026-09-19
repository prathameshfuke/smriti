/**
 * Bodo (brx, Devanagari), Manipuri (mni, Bengali script) and, where the game had none, Bengali (bn)
 * and Nepali (ne) strings for this game. brx/mni are LLM-assisted and NOT yet checked by a native
 * speaker: every string is listed with a confidence rating in docs/translation-review.md.
 */

export const COUNTING_BOXES_NORTHEAST = {
  brx: {
    games: {
      countingBoxes: {
        gameUI: {
          observing: "बाकसफोरखौ नुनो",
          nextLevel: "{seconds} सेकेन्डआव उनावनि लेभेल",
          startGame: "शुरु",
          howMany: "बाकसनि अंखन मा जायो?",
          enter: "लिरनो",
          correct: "ठिक",
          incorrect: "पुरा ठिक नङा",
          actualCount: "{count} दं",
          gameOver: "खेला मोनथिबाय",
          accuracyLabel: "ठिक राउन्ड",
          totalTimeLabel: "लानाय समो",
          seconds: "से",
          encouragement: {
            perfect: "ठिक! दिनै मोजां मुनायनाय।",
            great: "दिनै गोजोन खालामनाय!",
            good: "मोजां नाजा, थांनो।",
            keepTrying: "दिनै नाजा खालामनायनि थाखाय मोजां।"
          },
          playAgain: "फिन खेला खालाम"
        }
      }
    }
  },
  mni: {
    games: {
      countingBoxes: {
        gameUI: {
          observing: "বাকসশিং উবিয়ু",
          nextLevel: "{seconds} সেকেন্দতা মতুংগী লেবেল",
          startGame: "হৌবিয়ু",
          howMany: "নহাক্না বাকস কয়া উখিবনো?",
          enter: "ইখৈবিয়ু",
          correct: "চুম্মি",
          incorrect: "চুম্দ্রে",
          actualCount: "{count} লৈরিবনি",
          gameOver: "খেল লোইখ্রে",
          accuracyLabel: "চুম্মি রাউন্দ",
          totalTimeLabel: "চৎখিবা মতম",
          seconds: "সে",
          encouragement: {
            perfect: "চুম্মি! ঙসি ফজবা মসিং।",
            great: "ঙসি ফজবা থবক!",
            good: "ফজবা হোৎনবা, চৎলু।",
            keepTrying: "ঙসি হোৎনখিবগী দমক ফজেই।"
          },
          playAgain: "অমুক খেল তৌ"
        }
      }
    }
  },
  bn: {
    games: {
      countingBoxes: {
        gameUI: {
          observing: "বাক্সগুলো দেখুন",
          nextLevel: "{seconds} সেকেন্ডে পরের স্তর",
          startGame: "শুরু",
          howMany: "আপনি কতগুলো বাক্স দেখলেন?",
          enter: "দিন",
          correct: "সঠিক",
          incorrect: "ঠিক হয়নি",
          actualCount: "ছিল {count}টি",
          gameOver: "খেলা শেষ",
          accuracyLabel: "সঠিক রাউন্ড",
          totalTimeLabel: "লেগেছে",
          seconds: "সে",
          encouragement: {
            perfect: "নিখুঁত! আজ দারুণ গুনেছেন।",
            great: "আজ চমৎকার করেছেন!",
            good: "ভালো চেষ্টা, চালিয়ে যান।",
            keepTrying: "আজ চেষ্টা করার জন্য ধন্যবাদ।"
          },
          playAgain: "আবার খেলুন"
        }
      }
    }
  },
  ne: {
    games: {
      countingBoxes: {
        gameUI: {
          observing: "बाकसहरू हेर्नुहोस्",
          nextLevel: "{seconds} सेकेन्डमा अर्को तह",
          startGame: "सुरु",
          howMany: "तपाईंले कतिवटा बाकस देख्नुभयो?",
          enter: "हाल्नुहोस्",
          correct: "सही",
          incorrect: "ठ्याक्कै भएन",
          actualCount: "{count} वटा थिए",
          gameOver: "खेल सकियो",
          accuracyLabel: "सही राउन्ड",
          totalTimeLabel: "लागेको समय",
          seconds: "से",
          encouragement: {
            perfect: "उत्तम! आज राम्रो गन्नुभयो।",
            great: "आज उत्कृष्ट काम!",
            good: "राम्रो प्रयास, जारी राख्नुहोस्।",
            keepTrying: "आज प्रयास गरेकोमा धन्यवाद।"
          },
          playAgain: "फेरि खेल्नुहोस्"
        }
      }
    }
  }
};
