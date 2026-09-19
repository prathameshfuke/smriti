/**
 * Bodo (brx, Devanagari), Manipuri (mni, Bengali script) and, where the game had none, Bengali (bn)
 * and Nepali (ne) strings for this game. brx/mni are LLM-assisted and NOT yet checked by a native
 * speaker: every string is listed with a confidence rating in docs/translation-review.md.
 */

export const MEMORY_SPAN_NORTHEAST = {
  brx: {
    games: {
      freeShortTermMemoryTest: {
        wordBank: [
          "दैमा",
          "टोकरी",
          "बत्ती",
          "साइकेल",
          "छाता",
          "केतली",
          "कम्बल",
          "आम",
          "खिरिकी",
          "सिढी",
          "मोमबत्ती",
          "बालिस",
          "बगान",
          "साको",
          "आइना",
          "बाल्टि"
        ],
        memorizeTheseWords: "बे रावफोरखौ सिनायथि खालाम",
        studyAtYourPace: "नों समो लाना। गासै नुनायनि उनाव 'सजाय' टाप खालाम।",
        ready: "सजाय",
        voice: {
          hearWords: "रावफोर सुनो",
          stopReading: "फोरनाय बन्द खालाम",
          sayWords: "रावफोर बुंनो",
          stopListening: "बन्द",
          listening: "सुनाय दं… नों सिनायथि खालामनाय रावफोर बुंनो।",
          transcribing: "नों बुंनायखौ बुजिनाय दं…",
          error: "आं सुनायाखै। रावफोर लिरनो हागोन।",
          heard: "सुनायबाय: \"{text}\""
        },
        recall: {
          title: "नों मा नुनाय?",
          gridInstruction: "नों सिनायथि खालामनाय रावफोर गासैखौ बुंनो एबा लिरनो।",
          inputLabel: "नोंनि उत्तर"
        },
        submitRecall: "सिनायथि मोनथिबाय",
        setup: {
          title: "कुछ प्रश्न",
          description: "बेयाव नोंनि रिजल्ट बुजिनो हेल्फ जायो।",
          ageGroup: "उमेरनि दल",
          ageUnder18: "18 निफ्राय कम",
          age18to25: "18–25",
          age26to45: "26–45",
          age46to65: "46–65",
          age65plus: "65+",
          gender: "लिंग",
          male: "पुरुष",
          female: "महिला",
          other: "गुबुन",
          submit: "आं'नि रिजल्ट नुनो"
        },
        results: {
          title: "नोंनि रिजल्ट",
          excellent: "दिनै खुबै मोजां सिनायथि!",
          good: "दिनै मोजां खालामनाय!",
          keepPracticing: "नाजा खालामनाय गासैयाव नोंनि सिनायथिखौ हेल्फ खालामो।",
          performance: "खालामनाय",
          wordsRecalled: "सिनायथि खालामनाय राव",
          accuracy: "ठिकनाय",
          timeSpent: "लानाय समो",
          percentile: "पर्सेन्टाइल",
          correctWords: "नों सिनायथि खालामनाय राव",
          noMatches: "बे खेवआव मिलाव जायाखै। बे मोजां।",
          missedWords: "उनाव खेवआव नुनोनायनि राव",
          encouragement: "नाजा खालामनायनि थाखाय मोजां",
          trainingTip: "बे खेला दिनदिन खालामनाय नोंनि सिनायथि सक्रिय थानो हेल्फ खालामो।"
        },
        tryAgain: "फिन खेला खालाम"
      }
    }
  },
  mni: {
    games: {
      freeShortTermMemoryTest: {
        wordBank: [
          "তুরেল",
          "টোকরী",
          "বাতি",
          "সাইকেল",
          "ছাতা",
          "কেটলী",
          "কম্বল",
          "আম",
          "খিড়কী",
          "সিঁড়ি",
          "মোমবাতি",
          "বালিশ",
          "বাগান",
          "সেতু",
          "আয়না",
          "বাল্টি"
        ],
        memorizeTheseWords: "শব্দ অসিসিং নিংশিংবিয়ু",
        studyAtYourPace: "মতম ফংলু। খুদিংমক উরবদগী মতুংদা 'তৈরি' তাপ তৌ।",
        ready: "তৈরি",
        voice: {
          hearWords: "শব্দশিং শুনবিয়ু",
          stopReading: "পড়া থাদোকবিয়ু",
          sayWords: "শব্দশিং হায়বিয়ু",
          stopListening: "থাদোক",
          listening: "শুনরি… নহাক্না নিংশিংখিবা শব্দশিং হায়বিয়ু।",
          transcribing: "নহাক্না হায়খিবদু খঙবা…",
          error: "ঐ শুম্দ্রে। শব্দশিং ইখৈবা য়াই।",
          heard: "শুম্খ্রে: \"{text}\""
        },
        recall: {
          title: "নহাক্না করি উখিবনো?",
          gridInstruction: "নহাক্না নিংশিংখিবা শব্দশিং খুদিংমক হায়বিয়ু নত্রগা ইখৈবিয়ু।",
          inputLabel: "নহাক্কী উত্তর"
        },
        submitRecall: "নিংশিংবা লোইখ্রে",
        setup: {
          title: "প্রশ্ন অহুম",
          description: "মসিনা নহাক্কী রিজল্ট খঙবদা মতেং পাংই।",
          ageGroup: "বয়সগী দল",
          ageUnder18: "১৮ কম",
          age18to25: "18–25",
          age26to45: "26–45",
          age46to65: "46–65",
          age65plus: "65+",
          gender: "লিঙ্গ",
          male: "পুরুষ",
          female: "মহিলা",
          other: "অতোপ্পা",
          submit: "ঐগী রিজল্ট উবিয়ু"
        },
        results: {
          title: "নহাক্কী রিজল্ট",
          excellent: "ঙসি য়াম্না ফজবা নিংশিং!",
          good: "ঙসি ফজবা থবক!",
          keepPracticing: "হোৎনবা খুদিংমক্না নহাক্কী নিংশিংদা মতেং পাংই।",
          performance: "থবক",
          wordsRecalled: "নিংশিংখিবা শব্দ",
          accuracy: "চুম্বা",
          timeSpent: "চৎখিবা মতম",
          percentile: "পার্সেন্টাইল",
          correctWords: "নহাক্না নিংশিংখিবা শব্দ",
          noMatches: "মসি মতমদা মান্নদ্রে। ফজে।",
          missedWords: "মতুংগী মতমদা চেক তৌগদবা শব্দ",
          encouragement: "হোৎনখিবগী দমক ফজেই",
          trainingTip: "খেল অসি লগাতার তৌবদা নহাক্কী নিংশিং সক্রিয় লৈনবদা মতেং পাংই।"
        },
        tryAgain: "অমুক খেল তৌ"
      }
    }
  },
  bn: {
    games: {
      freeShortTermMemoryTest: {
        wordBank: [
          "নদী",
          "ঝুড়ি",
          "প্রদীপ",
          "সাইকেল",
          "ছাতা",
          "কেটলি",
          "কম্বল",
          "আম",
          "জানালা",
          "মই",
          "মোমবাতি",
          "বালিশ",
          "বাগান",
          "সেতু",
          "আয়না",
          "বালতি"
        ],
        memorizeTheseWords: "এই শব্দগুলো মনে রাখুন",
        studyAtYourPace: "ধীরে দেখুন। সব দেখা হলে 'তৈরি' চাপুন।",
        ready: "তৈরি",
        voice: {
          hearWords: "শব্দগুলো শুনুন",
          stopReading: "পড়া বন্ধ করুন",
          sayWords: "শব্দগুলো বলুন",
          stopListening: "থামুন",
          listening: "শুনছি… যে শব্দগুলো মনে আছে বলুন।",
          transcribing: "আপনি যা বললেন তা বোঝার চেষ্টা করছি…",
          error: "আপনার কথা শুনতে পাইনি। বদলে শব্দগুলো লিখতে পারেন।",
          heard: "শুনেছি: \"{text}\""
        },
        recall: {
          title: "আপনি কী দেখলেন?",
          gridInstruction: "যতগুলো শব্দ মনে আছে, যেকোনো ক্রমে বলুন বা লিখুন।",
          inputLabel: "আপনার উত্তর"
        },
        submitRecall: "মনে করা শেষ",
        setup: {
          title: "কয়েকটি প্রশ্ন",
          description: "এতে আপনার ফল বুঝতে সুবিধা হয়।",
          ageGroup: "বয়সের গোষ্ঠী",
          ageUnder18: "১৮-র কম",
          age18to25: "১৮–২৫",
          age26to45: "২৬–৪৫",
          age46to65: "৪৬–৬৫",
          age65plus: "৬৫+",
          gender: "লিঙ্গ",
          male: "পুরুষ",
          female: "মহিলা",
          other: "অন্যান্য",
          submit: "আমার ফল দেখুন"
        },
        results: {
          title: "আপনার ফল",
          excellent: "আজ চমৎকার স্মৃতিশক্তি!",
          good: "আজ ভালো করেছেন!",
          keepPracticing: "প্রতিটি চেষ্টা আপনার স্মৃতিকে সাহায্য করে।",
          performance: "ফল",
          wordsRecalled: "মনে রাখা শব্দ",
          accuracy: "নির্ভুলতা",
          timeSpent: "লেগেছে",
          percentile: "পার্সেন্টাইল",
          correctWords: "আপনি যে শব্দগুলো মনে রেখেছেন",
          noMatches: "এবার কোনো মিল হয়নি। ঠিক আছে।",
          missedWords: "পরের বার যে শব্দগুলোতে মনোযোগ দেবেন",
          encouragement: "চেষ্টা করার জন্য ধন্যবাদ",
          trainingTip: "নিয়মিত এই খেলা খেললে স্মৃতি সক্রিয় থাকতে পারে।"
        },
        tryAgain: "আবার খেলুন"
      }
    }
  },
  ne: {
    games: {
      freeShortTermMemoryTest: {
        wordBank: [
          "नदी",
          "डोको",
          "बत्ती",
          "साइकल",
          "छाता",
          "केतली",
          "कम्बल",
          "आँप",
          "झ्याल",
          "भर्याङ",
          "मैनबत्ती",
          "सिरानी",
          "बगैँचा",
          "पुल",
          "ऐना",
          "बाल्टी"
        ],
        memorizeTheseWords: "यी शब्दहरू सम्झनुहोस्",
        studyAtYourPace: "आफ्नै गतिमा हेर्नुहोस्। सबै हेरिसकेपछि 'तयार' थिच्नुहोस्।",
        ready: "तयार",
        voice: {
          hearWords: "शब्दहरू सुन्नुहोस्",
          stopReading: "पढ्न रोक्नुहोस्",
          sayWords: "शब्दहरू भन्नुहोस्",
          stopListening: "रोक्नुहोस्",
          listening: "सुन्दैछु… सम्झेका शब्दहरू भन्नुहोस्।",
          transcribing: "तपाईंले भनेको बुझ्दैछु…",
          error: "तपाईंको कुरा सुन्न सकिएन। बरु शब्दहरू टाइप गर्न सक्नुहुन्छ।",
          heard: "सुनियो: \"{text}\""
        },
        recall: {
          title: "तपाईंले के देख्नुभयो?",
          gridInstruction: "सम्झेजति शब्दहरू जुनसुकै क्रममा भन्नुहोस् वा टाइप गर्नुहोस्।",
          inputLabel: "तपाईंका उत्तरहरू"
        },
        submitRecall: "सम्झन सकियो",
        setup: {
          title: "केही प्रश्नहरू",
          description: "यसले तपाईंको नतिजा बुझ्न मद्दत गर्छ।",
          ageGroup: "उमेर समूह",
          ageUnder18: "१८ भन्दा कम",
          age18to25: "१८–२५",
          age26to45: "२६–४५",
          age46to65: "४६–६५",
          age65plus: "६५+",
          gender: "लिङ्ग",
          male: "पुरुष",
          female: "महिला",
          other: "अन्य",
          submit: "मेरो नतिजा हेर्नुहोस्"
        },
        results: {
          title: "तपाईंको नतिजा",
          excellent: "आज उत्कृष्ट स्मरणशक्ति!",
          good: "आज राम्रो गर्नुभयो!",
          keepPracticing: "हरेक प्रयासले तपाईंको स्मरणशक्तिलाई मद्दत गर्छ।",
          performance: "प्रदर्शन",
          wordsRecalled: "सम्झिएका शब्द",
          accuracy: "शुद्धता",
          timeSpent: "लागेको समय",
          percentile: "प्रतिशतक",
          correctWords: "तपाईंले सम्झिएका शब्दहरू",
          noMatches: "यस पटक कुनै मिलेन। कुनै समस्या छैन।",
          missedWords: "अर्को पटक ध्यान दिने शब्दहरू",
          encouragement: "प्रयास गरेकोमा धन्यवाद",
          trainingTip: "यो खेल नियमित खेल्दा स्मरणशक्ति सक्रिय राख्न मद्दत गर्न सक्छ।"
        },
        tryAgain: "फेरि खेल्नुहोस्"
      }
    }
  }
};
