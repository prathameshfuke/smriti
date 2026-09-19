/**
 * Bodo (brx, Devanagari), Manipuri (mni, Bengali script) and, where the game had none, Bengali (bn)
 * and Nepali (ne) strings for this game. brx/mni are LLM-assisted and NOT yet checked by a native
 * speaker: every string is listed with a confidence rating in docs/translation-review.md.
 */

export const DOUBLE_DECISION_NORTHEAST = {
  brx: {
    games: {
      doubleDecision: {
        gameUI: {
          title: "डबल डिसिजन",
          intro: "स्क्रीननि बीचआव आकार मोनसे जोलायो, आरो एनखौ साइन मोनसे नुनायो। गासैखौ नुनो।",
          fixationTip: "बीचआव लाल बिन्दुखौ नुनो।",
          startPractice: "अभ्यास राउन्ड मोनसे नाजा खालाम",
          startReal: "असल खेला शुरु खालाम",
          practiceDoneTitle: "बेबादिनो",
          practiceDoneBody: "बीचआव मोनसे नुनो, उनाव साइन नुनायाबाय जायगा नाजा खालाम। शुरु खालामनो सजाय ला?",
          bestRating: "सबसे मोजां रेटिं: {score}",
          bestScore: "सबसे मोजां ठिकनाय: {score}%",
          chooseVehicle: "नों मा गाड़ि नुनाय?",
          vehicles: {
            sedan: "कार",
            taxi: "टैक्सि",
            bus: "बास",
            truck: "ट्रक"
          },
          chooseLocation: "साइन नुनायाबाय जायगाआव टाप खालाम",
          locationLabel: "जायगा {number}",
          correct: "ठिक!",
          vehicleMissed: "बे गाड़ि नङा",
          signMissed: "बे जायगा नङा",
          answerReveal: "{vehicle} जायगा {location} आव दं।",
          round: "राउन्ड {current}/{total}",
          score: "ठिकनाय {score}%",
          settings: "सेटिंस",
          settingsTitle: "खेलानि सेटिंस",
          settingsRounds: "राउन्डनि अंखन",
          settingsSpeed: "शुरुनि गति",
          settingsSpeedHelp: "आकार सिगांआव माब समो नुनायो बुंनो। खेला खालामनायाव बे आपे सोलायो।",
          settingsField: "शुरुनि क्षेत्रनि गेदेर",
          settingsFieldHelp: "साइनफोर माबादि सारायो बुंनो। बेबो आपे सोलायो।",
          settingsHint: "बेफोरखौ बेबादिनो थाखो। खेला नोंजों मिलायो।",
          levelValue: "लेभेल {level}",
          resultsTitle: "खेला मोनथिबाय",
          resultsBody: "{total}नि {correct} ठिक",
          resultAccuracy: "ठिकनाय",
          resultField: "सबसे गेदेर क्षेत्र",
          resultFastest: "सबसे जल्दी ठिक नुनाय",
          ratingUnit: "रेटिं",
          progressSaved: "नोंनि प्रगतिआव सेभ जायो। हेफाजाब खालामग्रा बेखौ ड्यासबोर्डआव नुनो हायो।",
          playAgain: "फिन खेला खालाम"
        }
      }
    }
  },
  mni: {
    games: {
      doubleDecision: {
        gameUI: {
          title: "ডাবল ডিসিজন",
          intro: "স্ক্রীনগী মাঝাদা আকার অমা লাংখ্রে, অদুগী মখাদা চিহ্ন অমা উরে। অনিবু ফংলু।",
          fixationTip: "মাঝাদা লাল বিন্দুদু উলু।",
          startPractice: "অভ্যাস রাউন্দ অমা হোৎনবিয়ু",
          startReal: "অসল খেল হৌবিয়ু",
          practiceDoneTitle: "মসিগুম্না",
          practiceDoneBody: "মাঝাদা অমা উ, মতুংদা চিহ্ন উখিবা মফম চেক তৌ। হৌবা তৈরি?",
          bestRating: "ফজবা রেটিং: {score}",
          bestScore: "ফজবা চুম্বা: {score}%",
          chooseVehicle: "নহাক্না গাড়ী করি উখিবনো?",
          vehicles: {
            sedan: "কার",
            taxi: "ট্যাক্সি",
            bus: "বাস",
            truck: "ট্রাক"
          },
          chooseLocation: "চিহ্ন উখিবা মফমদা তাপ তৌ",
          locationLabel: "মফম {number}",
          correct: "চুম্মি!",
          vehicleMissed: "গাড়ী অসি নত্তে",
          signMissed: "মফম অসি নত্তে",
          answerReveal: "{vehicle} অদু মফম {location} দা লৈখিবনি।",
          round: "রাউন্দ {current}/{total}",
          score: "চুম্বা {score}%",
          settings: "সেটিংস",
          settingsTitle: "খেলগী সেটিংস",
          settingsRounds: "রাউন্দগী নম্বর",
          settingsSpeed: "হৌখিবগী থুনা",
          settingsSpeedHelp: "আকার অদু হৌখিবদা কয়া মতম উরবনো। খেল তৌরিবদা মসি নিজে হেৎলগনি।",
          settingsField: "হৌখিবগী ক্ষেত্র অহেনবা",
          settingsFieldHelp: "চিহ্নশিং করিগুম্না ফাংলমবনো। মসিসু নিজে হেৎলগনি।",
          settingsHint: "মসিশিং অসিগুম্না লৈরকপিয়ু। খেল অদু নহাক্কী মওংদা মান্নগনি।",
          levelValue: "লেবেল {level}",
          resultsTitle: "খেল লোইখ্রে",
          resultsBody: "{correct}/{total} চুম্মি",
          resultAccuracy: "চুম্বা",
          resultField: "অহেনবা ক্ষেত্র ফাওখ্রে",
          resultFastest: "থুনা চুম্মি উবা",
          ratingUnit: "রেটিং",
          progressSaved: "নহাক্কী অগ্রগতিদা সেভ ওইখ্রে। কেয়ারগিভরনা ড্যাশবোর্ডতা উগনি।",
          playAgain: "অমুক খেল তৌ"
        }
      }
    }
  },
  bn: {
    games: {
      doubleDecision: {
        gameUI: {
          title: "ডাবল ডিসিশন",
          intro: "পর্দার মাঝখানে একটি আকৃতি ঝলক দেয়, আর তার আশপাশে কোথাও একটি চিহ্ন দেখা দেয়। দুটোই লক্ষ করুন।",
          fixationTip: "মাঝখানের লাল বিন্দুটির দিকে তাকিয়ে থাকুন।",
          startPractice: "একটি অনুশীলন রাউন্ড চেষ্টা করুন",
          startReal: "আসল খেলা শুরু করুন",
          practiceDoneTitle: "এই তো ব্যাপার",
          practiceDoneBody: "মাঝখানে একবার দ্রুত তাকান, তারপর খুঁজুন চিহ্নটি কোথায় এসেছিল। শুরু করতে তৈরি?",
          bestRating: "সেরা রেটিং: {score}",
          bestScore: "সেরা নির্ভুলতা: {score}%",
          chooseVehicle: "আপনি কোন গাড়িটি দেখলেন?",
          vehicles: {
            sedan: "গাড়ি",
            taxi: "ট্যাক্সি",
            bus: "বাস",
            truck: "ট্রাক"
          },
          chooseLocation: "চিহ্নটি যেখানে এসেছিল সেখানে চাপুন",
          locationLabel: "অবস্থান {number}",
          correct: "ঠিক!",
          vehicleMissed: "ঠিক এই গাড়িটি নয়",
          signMissed: "ঠিক এই জায়গাটি নয়",
          answerReveal: "এটি ছিল {vehicle}, অবস্থান {location}-এর কাছে।",
          round: "রাউন্ড {current}/{total}",
          score: "নির্ভুলতা {score}%",
          settings: "সেটিংস",
          settingsTitle: "খেলার সেটিংস",
          settingsRounds: "রাউন্ডের সংখ্যা",
          settingsSpeed: "শুরুর গতি",
          settingsSpeedHelp: "শুরুতে আকৃতিটি কতক্ষণ দেখা যায়। খেলতে খেলতে এটি নিজে থেকেই বদলায়।",
          settingsField: "শুরুর ক্ষেত্রের আকার",
          settingsFieldHelp: "চিহ্নগুলো কতটা ছড়ানো। এটিও নিজে থেকেই বদলায়।",
          settingsHint: "এগুলো যেমন আছে তেমনই রাখতে পারেন। খেলা আপনার সঙ্গে মানিয়ে নেয়।",
          levelValue: "স্তর {level}",
          resultsTitle: "খেলা শেষ",
          resultsBody: "{total}টির মধ্যে {correct}টি সঠিক",
          resultAccuracy: "নির্ভুলতা",
          resultField: "সবচেয়ে বড় ক্ষেত্র",
          resultFastest: "সবচেয়ে দ্রুত সঠিক দেখা",
          ratingUnit: "রেটিং",
          progressSaved: "আপনার অগ্রগতিতে সংরক্ষিত হয়েছে। আপনার পরিচর্যাকারী ড্যাশবোর্ডে এটি দেখতে পাবেন।",
          playAgain: "আবার খেলুন"
        }
      }
    }
  },
  ne: {
    games: {
      doubleDecision: {
        gameUI: {
          title: "डबल डिसिजन",
          intro: "स्क्रिनको बीचमा एउटा आकार झिलिक्क देखिन्छ, र वरिपरि कतै एउटा चिन्ह देखिन्छ। दुवै ध्यान दिनुहोस्।",
          fixationTip: "बीचको रातो थोप्लोमा हेरिरहनुहोस्।",
          startPractice: "एउटा अभ्यास राउन्ड प्रयास गर्नुहोस्",
          startReal: "वास्तविक खेल सुरु गर्नुहोस्",
          practiceDoneTitle: "यही हो विचार",
          practiceDoneBody: "बीचमा एक छिन हेर्नुहोस्, अनि चिन्ह कहाँ देखियो भेट्टाउनुहोस्। सुरु गर्न तयार हुनुहुन्छ?",
          bestRating: "उत्कृष्ट रेटिङ: {score}",
          bestScore: "उत्कृष्ट शुद्धता: {score}%",
          chooseVehicle: "तपाईंले कुन गाडी देख्नुभयो?",
          vehicles: {
            sedan: "कार",
            taxi: "ट्याक्सी",
            bus: "बस",
            truck: "ट्रक"
          },
          chooseLocation: "चिन्ह देखिएको ठाउँमा थिच्नुहोस्",
          locationLabel: "स्थान {number}",
          correct: "ठिक!",
          vehicleMissed: "यो गाडी होइन",
          signMissed: "यो ठाउँ होइन",
          answerReveal: "यो {vehicle} थियो, स्थान {location} नजिक।",
          round: "राउन्ड {current}/{total}",
          score: "शुद्धता {score}%",
          settings: "सेटिङ",
          settingsTitle: "खेलको सेटिङ",
          settingsRounds: "राउन्डको संख्या",
          settingsSpeed: "सुरुको गति",
          settingsSpeedHelp: "सुरुमा आकार कति बेर देखिन्छ। खेल्दै जाँदा यो आफैँ मिल्छ।",
          settingsField: "सुरुको क्षेत्रको आकार",
          settingsFieldHelp: "चिन्हहरू कति फैलिएका छन्। यो पनि आफैँ मिल्छ।",
          settingsHint: "यीलाई जस्ताको तस्तै राख्न सक्नुहुन्छ। खेलले तपाईंसँग मिलाउँछ।",
          levelValue: "तह {level}",
          resultsTitle: "खेल सकियो",
          resultsBody: "{total} मध्ये {correct} सही",
          resultAccuracy: "शुद्धता",
          resultField: "सबैभन्दा फराकिलो क्षेत्र",
          resultFastest: "सबैभन्दा छिटो सही हेराइ",
          ratingUnit: "रेटिङ",
          progressSaved: "तपाईंको प्रगतिमा सुरक्षित भयो। तपाईंका हेरचाहकर्ताले ड्यासबोर्डमा यो देख्न सक्छन्।",
          playAgain: "फेरि खेल्नुहोस्"
        }
      }
    }
  }
};
