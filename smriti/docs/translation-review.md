# Bodo (brx) and Manipuri (mni) translation review

**Status: none of the Bodo or Manipuri text below has been checked by a native speaker.** It was written by an AI model from limited knowledge of both languages, with the Hindi, Assamese and Bengali catalogs as meaning references. No machine-translation service (Bhashini) could be used: its keys live in `.env*` files which this task was not allowed to read. Treat every "low" and "medium" row as a proposal, and do not present this text to patients as reviewed.

## How to read this
- **Confidence** — `high`: a language self-name, a unit/number/symbol, or a loanword written the way speakers write it. `medium`: short, common wording that matches what the earlier machine pass produced or a very common loanword. `low`: everything else, including all sentences. Every row that is not `high` needs native review.
- **Scripts** — Bodo is written in Devanagari. Manipuri is written in **Bengali script**, following `src/lib/i18n/languages.ts` (no Meitei Mayek font is loaded). Meitei Mayek is the official script of Manipuri; a font plus a transliteration pass would be needed to offer it.
- **Loanwords** — where I did not know a native word I used a widely understood Hindi/Assamese/English (Bodo) or Bengali/English (Manipuri) loanword inside Bodo/Manipuri grammar. These are marked low. No Hindi sentence was labelled Bodo: the parity test rejects any brx/mni value identical to Hindi, Assamese, Bengali or Nepali (apart from a short allowlist of loanwords).
- **Pre-existing values** — the 66 brx and 66 mni strings that were already in the repo were kept unless noted, and are rated low because their origin (an earlier machine pass) is unverified. Two suspect ones: brx `game.correct` was "सोमोन्दो!" (looks like a different word) and was replaced by "ठिक!"; brx "गोबां" is used for "good" in several existing strings but I believe it means "much/many", so those may read wrongly.
- **Bengali/Nepali** — bn and ne text added in this change (per-game catalogs, objects, new keys) is ordinary written Bengali/Nepali by the same author and is not listed here; a quick native check is still sensible.

## Review first (medical, reminder, safety wording)
Ask the reviewer to look at these before anything else. A wrong word here can make a patient miss medicine, water or an appointment.

| Key | English | Bodo (Devanagari) | Manipuri (Bengali script) |
|---|---|---|---|
| `home.pinTitle` | Enter caregiver PIN | हेफाजाब खालामग्रानि पिन लिरनो | কেয়ারগিভরগী পিন ইখৈবিয়ু |
| `home.pinForCaregiver` | For the caregiver only. | हेफाजाब खालामग्रानि थाखाय जानाय। | কেয়ারগিভর অমদমক। |
| `home.pinLocked` | Too many wrong tries. Try again in {seconds} seconds. | गोबांबार गलत जादों। {seconds} सेकेन्डनि उनाव फिन नाजा खालाम। | য়াম্না অচুম্বা হোৎনখ্রে। সেকেন্দ {seconds} গী মতুংদা অমুক হোৎনবিয়ু। |
| `reminder.medication` | Time for your medicine | नोंनि दोरै जानाय समो | নহাক্কী মশিং থাক্কদবা মতম |
| `reminder.hydration` | Time to drink water | दोइ लांनाय समो | ঈশিং থাক্কদবা মতম |
| `reminder.activity` | Time for your walk | बेड़नाय समो | চৎনবগী মতম |
| `reminder.appointment` | Time for your appointment | नोंनि अपोइन्टमेन्टनि समो | নহাক্কী থীংনবগী মতম |
| `reminder.appointmentTomorrowAt` | You have an appointment tomorrow at {time} at {facility} | नोंनि थाखाय गाहाय {time} बजिआव {facility} आव अपोइन्टमेन्ट दं | নহাক্কী হায়েং {time} বজিদা {facility} দা এপয়েন্টমেন্ট অমা লৈ |
| `reminder.appointmentTomorrow` | You have an appointment tomorrow at {time} | नोंनि थाखाय गाहाय {time} बजिआव अपोइन्टमेन्ट दं | নহাক্কী হায়েং {time} বজিদা এপয়েন্টমেন্ট অমা লৈ |
| `reminder.appointmentTodayAt` | You have an appointment today at {time} at {facility} | नोंनि थाखाय दिनै {time} बजिआव {facility} आव अपोइन्टमेन्ट दं | নহাক্কী ঙসি {time} বজিদা {facility} দা এপয়েন্টমেন্ট অমা লৈ |
| `reminder.appointmentToday` | You have an appointment today at {time} | नोंनि थाखाय दिनै {time} बजिआव अपोइन्टमेन्ट दं | নহাক্কী ঙসি {time} বজিদা এপয়েন্টমেন্ট অমা লৈ |
| `reminder.whereToGo` | How to get there | माबादि थांनो | মখোয়দা ফাওবগী মরম |
| `reminder.whatToBring` | What to bring | मा लांनो | করি ফংগদবনো |
| `reminder.done` | Done | मोनथिबाय | লোইখ্রে |
| `reminder.snooze` | Later | सिगांनो | মতুংদা |
| `reminder.timeFor` | It is time for: | समो जायो: | মতম ওইখ্রে: |
| `reminder.remindLater` | Remind me in 15 minutes | आंखौ १५ मिनिटनि उनाव सिनायथि होनो | মিনিট ১৫ গী মতুংদা ঐবু নিংশিংহল্লু |
| `disclaimer` | SMRITI supports cognitive care but does not diagnose or treat any medical condition. Always consult a qualified clinician. | SMRITI आ बुद्धिनि सुरक्षाआव हेल्फ खालामो, नाथाय गोनां रोगनि सिनायथि एबा फिसायथि खालामाखै। हांख्रि डाक्टारजों हलादिं मंत्राव खालाम। | SMRITI না লৈরিক্কী থৌওংদা মতেং পাংই, অদুবু লাইনা অমত্তা তাথিবা নত্রগা এনথোকপা তৌদে। চান্নবা ডাক্তর অমাদা হায় থানবা তৌবিয়ু। |
| `companion.notSure` | I'm not sure about that. You could ask your caregiver. | आं बेखौ बुजियाखै। नों हेफाजाब खालामग्राखौ सोंनो हागोन। | ঐ মসি খঙদ্রে। নহাক্না কেয়ারগিভরবু হাংগনি। |
| `companion.unavailable` | I can't check that right now. Try again in a moment, or ask your caregiver. | आं दानि बेखौ नाजा खालामनो हायाखै। कुछ समोनि उनाव फिन नाजा खालाम, एबा हेफाजाब खालामग्राखौ सोंनो। | ঐ হৌজিক মসি চেক তৌনা য়াদ্রে। অকিবা মতুংদা অমুক হোৎনবিয়ু, নত্রগা কেয়ারগিভরবু হাংবিয়ু। |
| `companion.distress` | It sounds like you might be going through something hard right now. Please call 14416 (Tele-MANAS) to talk with someone, or tell your caregiver. | दानि नोंनि थाखाय मुश्किल समो दं बादि। 14416 (Tele-MANAS) आव फोन खालाम आरो बुंनो, एबा हेफाजाब खालामग्राखौ बुंनो। | নহাক্না হৌজিক মুশকিল মতম অমা ফংরি খ্রি। 14416 (Tele-MANAS) দা ফোন তৌনা মীওইনা হায়বিয়ু, নত্রগা কেয়ারগিভরদা হায়বিয়ু। |
| `reminders.title` | Reminders | रिमाइन्डार | রিমাইন্ডার |
| `reminders.today` | Today | दिनै | ঙসি |
| `reminders.noneToday` | No reminders today. | दिनै रिमाइन्डार दंखै। | ঙসি রিমাইন্ডার লৈদে। |
| `reminders.doneAt` | Done at {time} | {time} आव मोनथिबाय | {time} দা লোইখ্রে |
| `reminders.notDoneYet` | Not done yet | मोनथिनाय जायाखै | লোইদ্রে |
| `reminderType.medication` | Medicine | दोरै | ঔষধ |
| `reminderType.hydration` | Water | दै | ঈশিং |
| `reminderType.activity` | Activity | बेड़नाय | চৎনবা |
| `reminderType.appointment` | Appointment | अपोइन्टमेन्ट | এপয়েন্টমেন্ট |

## App catalog (`src/lib/i18n/locales/brx.json`, `mni.json`)

Rating column shows Bodo / Manipuri. "existing" = value was already in the repo; "new" = added here.

| Key | English | Bodo | Manipuri | Rating (brx/mni) | Origin (brx/mni) |
|---|---|---|---|---|---|
| `home.whoIsPlaying` | Who is playing? | खेला खालामग्रानि मुं मा? | খেল তৌরিবা কনানো? | low / low | new / new |
| `home.tapYourName` | Tap your name. | नोंनि मुंआव टाप खालाम। | নহাক্কী মিংদা তাপ তৌ। | medium / low | new / new |
| `home.notYou` | Not {name}? | नों {name} जायाखै? | {name} নত্রা? | low / low | new / new |
| `home.chooseWhoTitle` | Choose who uses this phone | बे फोनखौ बाहायग्रानि मुं बाछा खालाम | ফোন অসি ইশেংনবা মীওইদু বাছাই তৌবিয়ু | low / low | new / new |
| `home.chooseWhoBody` | A caregiver needs to pick the person, or people, who will play on this phone. | बे फोनआव खेला खालामग्रा एबा खेला खालामग्राफोरखौ हेफाजाब खालामग्रा बाछा खालामनो हागोन। | ফোন অসিদা খেল তৌগদবা মীওই অমা নত্রগা মীওইশিংদু কেয়ারগিভরনা বাছাই তৌগদ্রি। | low / low | new / new |
| `home.caregiver` | Caregiver | हेफाजाब खालामग्रा | কেয়ারগিভর | low / low | new / new |
| `home.greeting` | Hello | नमस्कार | খুরুমজরি | low / low | existing / existing |
| `home.startSession` | Start Playing | खेल' शुरु खालाम | খেল শুরু তৌগে | low / low | existing / existing |
| `home.reminders` | My Reminders | आं'नि रिमाइन्डार | ঐগী রিমাইন্ডার | low / low | existing / existing |
| `home.myProgress` | My progress | आं'नि उन्नति | ঐগী অগ্রগতি | low / low | existing / existing |
| `home.streakCount` | day streak | सान लगातार | লগাতার নুমিৎ | low / low | new / new |
| `home.streakStart` | Play today to start a streak | दिनै खेला खालाम, लगातार सान सुरु खालाम | ঙসি খেল তৌনা লগাতার নুমিৎ হৌবিয়ু | low / low | new / new |
| `home.askSmriti` | Ask Smriti | स्मृतिखौ सोंनो | স্মৃতিবু হাংবিয়ু | low / low | new / new |
| `home.chooseGame` | Choose a game | खेला मोनसे बाछा खालाम | খেল অমা বাছাই তৌবিয়ু | low / low | new / new |
| `home.caregiverAccess` | Caregiver access | हेफाजाब खालामग्रानि थाखाय | কেয়ারগিভরগী মতমদা | low / low | new / new |
| `home.pinTitle` | Enter caregiver PIN | हेफाजाब खालामग्रानि पिन लिरनो | কেয়ারগিভরগী পিন ইখৈবিয়ু | low / low | new / new |
| `home.pinForCaregiver` | For the caregiver only. | हेफाजाब खालामग्रानि थाखाय जानाय। | কেয়ারগিভর অমদমক। | low / low | new / new |
| `home.pinLocked` | Too many wrong tries. Try again in {seconds} seconds. | गोबांबार गलत जादों। {seconds} सेकेन्डनि उनाव फिन नाजा खालाम। | য়াম্না অচুম্বা হোৎনখ্রে। সেকেন্দ {seconds} গী মতুংদা অমুক হোৎনবিয়ু। | low / low | new / new |
| `home.forgotPin` | Forgot PIN? | पिन सिनायथि जायाखै? | পিন নিংশিংদ্রবনো? | low / low | new / new |
| `home.messageForYou` | A message for you | नोंनि थाखाय मेसेज मोनसे | নহাক্কী দমক মেসেজ অমা | low / low | new / new |
| `home.thankYou` | Thank you! | धन्यवाद! | ধন্যবাদ! | medium / medium | new / new |
| `home.noPatientTitle` | Nobody is set up on this phone | बे फोनआव मानसिबो सेट अप जायाखै | ফোন অসিদা কনাবু হৌদোকখ্রদ্রে | low / low | new / new |
| `home.noPatientBody` | A caregiver needs to sign in to set up this phone. | बे फोनखौ सेट अप खालामनो हेफाजाब खालामग्रा साइन इन खालामनो हागोन। | ফোন অসি হৌদোকনবা কেয়ারগিভর সাইন ইন তৌগদ্রি। | low / low | new / new |
| `home.caregiverLogin` | Caregiver sign in | हेफाजाब खालामग्रानि साइन इन | কেয়ারগিভর সাইন ইন | low / low | new / new |
| `home.today` | Today | दिनै | ঙসি | medium / medium | new / new |
| `game.objectHunt.name` | Object Hunt | बस्तु नागिरनाय | মরি থিবা | low / low | existing / existing |
| `game.objectHunt.instruction` | Remember where each picture is hidden. Tap a tile to look. | फोटो मानो नुनाय दं सिनायथि खालाम। नुनोखौ टाइलआव टाप खालाम। | ফটো কয়া মফম অমুক্তা লোনখিবা নিংশিং। উবগী টাইল অদুদা তাপ তৌ। | low / low | existing / existing |
| `game.objectHunt.whereWasThe` | Where was the | मानो दं | কদাইদা লৈরবগে | low / low | existing / existing |
| `game.objectHunt.rememberThis` | Remember this picture | बे फोटोखौ सिनायथि खालाम | ফটো অসি নিংশিংবিয়ু | medium / medium | new / new |
| `game.wordStream.name` | Market List | बजार लिस्ट | কেথেলগী লিস্ট | low / low | existing / existing |
| `game.wordStream.instruction` | Remember these things. We will ask you later. | बे मुवा फोरखौ सिनायथि खालाम। जों बिबाब सोंगाय। | পোৎ অসিসিং নিংশিং। ঐখোয়না মতুংদা হাংগনি। | low / low | existing / existing |
| `game.wordStream.rememberLater` | Remember these for later. | बेफोरखौ सिगांनि थाखाय सिनायथि खालाम। | মতুংগী ওইনা অসিসিং নিংশিং। | low / low | existing / existing |
| `game.wordStream.okRemember` | OK, I remember! | हाय, आंनि सिनायथि दंमोन! | ঠিক অই, ঐগী নিংশিংই! | low / low | existing / existing |
| `game.wordStream.whichItems` | Which items did we show you? | जों नोंखौ मानो मुवाफोर दिखाबाय? | ঐখোয়না নহাক্কী পোৎ কয়া উৎখিবগে? | low / low | existing / existing |
| `game.wordStream.imDone` | I am done! | आं मोनथिबाय! | লোইরবা! | low / low | existing / existing |
| `game.quickTap.name` | Quick Tap | थांखि थांखि | থুনা থুনা | low / low | existing / existing |
| `game.quickTap.instruction` | Tap the picture as soon as you see it. | फोटोखौ नुबोबो सिगांआवनो टाप खालाम। | ফটো অদু উবগী মতম মমাংদা তাপ তৌ। | low / low | existing / existing |
| `game.quickTap.targetIs` | Tap this picture: | बे फोटोआव टाप खालाम: | ফটো অসিদা তাপ তৌ: | medium / low | new / new |
| `game.quickTap.itemOf` | Picture {n} of {total} | फोटो {n}/{total} | ফটো {n}/{total} | medium / medium | new / new |
| `game.quickTap.hits` | You tapped {count} pictures correctly | नों {count} फोटोआव ठिकसे टाप खालामबाय | নহাক্না ফটো {count} চুম্না তাপ তৌখ্রে | low / low | new / new |
| `game.pathMatch.name` | Path Match | रास्ता मिलाव | লম্বী মিলাদবা | low / low | existing / existing |
| `game.pathMatch.instruction` | Join the numbers in order, from 1 onwards. | अंखनफोरखौ क्रमआव जोड़ाव, १ निफ्राय। | নম্বরশিং অদু মান্নবা মথৌদা পুন্না তৌ, ১ দগী হৌরগা। | low / low | existing / existing |
| `game.pathMatch.good` | Good! | गोबां सान! | ফজেই! | low / low | existing / existing |
| `game.pathMatch.pointOf` | Number {n} of {total} | अंखन {n}/{total} | নম্বর {n}/{total} | medium / medium | new / new |
| `game.pathMatch.connected` | {count} out of {total} joined | {total}नि {count} जोड़ जाबाय | {count}/{total} পুন্না তৌখ্রে | low / low | new / new |
| `game.memoryMatch.name` | Memory Match | सिनायथि मिलाव | নিংশিং মিলাদবা | low / low | existing / existing |
| `game.memoryMatch.instruction` | Tap two cards. If they match, they stay open. | कार्ड बर टाप खालाम। मिलबोबो खेवसिनथोन खोलामोन। | কার্ড অনি তাপ তৌ। মান্নরবদি হাংনা লৈগনি। | low / low | existing / existing |
| `game.memoryMatch.goodMatch` | Good match | गोबां मिलाव | ফজবা মিলাবা | low / low | existing / existing |
| `game.memoryMatch.tryAnotherOne` | Let's try another one | गुबुन एखा नाजा खालामनो | অতোপ্পা অমা হোৎনসি | low / low | existing / existing |
| `game.memoryMatch.progress` | {count} of {total} pairs found | जोड़ा {total}नि {count} मोनबाय | জোড়া {count}/{total} ফংখ্রে | low / low | new / new |
| `game.memoryMatch.done` | All {total} pairs found! | गासै {total} जोड़ा मोनबाय! | জোড়া {total} মাথক ফংখ্রে! | low / low | new / new |
| `game.memoryBlocks.name` | Memory Blocks | सिनायथि ब्लक | নিংশিং ব্লক | low / low | existing / existing |
| `game.frogLeap.name` | Frog Leap | बेंग लांगोन | খরাগী থোরাক্না চোংবা | low / low | existing / existing |
| `game.countingBoxes.name` | Counting Boxes | बाकस मुनथिनाय | বাকস মসিং | low / low | existing / existing |
| `game.nBack.name` | N-Back | एन-बेक | এন-বেক | low / low | existing / existing |
| `game.largerNumber.name` | Larger Number | गेदेर अंखन | অহেনবা নম্বর | low / low | existing / existing |
| `game.memorySpan.name` | Memory Span | सिनायथि विस्तार | নিংশিং হেন্না | low / low | existing / existing |
| `game.fishTrace.name` | Fish Trace | ना नाजा | নগা তুংগৈনবা | low / low | existing / existing |
| `game.doubleDecision.name` | Double Decision | बांसिन फैसला | অনিরকশোন | low / low | existing / existing |
| `game.reminiscenceQuiz.name` | Family & Life Quiz | नोगोर आरो जिउ क्वीज | ইমুং অমসুং হিংবা কুইজ | low / low | existing / existing |
| `game.reminiscenceQuiz.noQuiz` | The quiz needs at least 3 people or memories in the Memory Book. Ask your caregiver to add them. | क्वीजनि थाखाय सिनायथि बिजाबआव कमसे 3 मानसि एबा सिनायथि दंनो हागोन। हेफाजाब खालामग्राखौ बेफोर जोड़नो बुंनो। | কুইজ অসিদমক মেমরি বুকতা মীওই নত্রগা নিংশিংবা অহুম ফাওবা লৈহংগদ্রি। কেয়ারগিভরদু হাংবিয়ু। | low / low | new / new |
| `game.reminiscenceQuiz.whoIsThis` | Who is this? | बेनि मुं मा? | মসি কনানো? | low / low | new / new |
| `game.reminiscenceQuiz.whoIsYour` | Who is your {relationship}? | नोंनि {relationship}नि मुं मा? | নহাক্কী {relationship} কনানো? | low / low | new / new |
| `game.reminiscenceQuiz.whichIsAbout` | Who or what is this about? “{detail}” | बे मानि थाखाय? “{detail}” | মসি কনা নত্রগা করিগী ওইবনো? “{detail}” | low / low | new / new |
| `game.correct` | Correct! | ठिक! | চুম্মি! | low / low | replaced / existing |
| `game.tryAgain` | Try again | फिन नाजा खालाम | অমুক হোৎনসি | low / low | existing / existing |
| `game.sessionComplete` | Well done! You finished today's session. | गोबां! नों दिनैनि सेसनखौ मोनथिबाय। | ফজেই! নহাক্না ঙসিগী সেসন লোইশিনখ্রে। | low / low | existing / existing |
| `game.stars` | Stars earned | मोनबाय तारा | ফংখিবা থবী | low / low | existing / existing |
| `game.sessionEnd.star5` | Perfect! Wonderful work today! | गोबां! दिनै गोबां हाबा खालामबाय! | য়াম্না ফজে! ঙসি ফজবা থবক তৌখ্রে! | low / low | existing / existing |
| `game.sessionEnd.star4` | Excellent! You are doing great! | गोबां! नों गोबां खालामदों! | ফজেই! নহাক্না য়াম্না ফজে তৌরি! | low / low | existing / existing |
| `game.sessionEnd.star3` | Great job today! Keep it up! | दिनै गोबां खालामबाय! बेनि सिगांनो थांगोन! | ঙসি ফজবা থবক তৌখ্রে! মসিগুম্না চটহল্লু! | low / low | existing / existing |
| `game.sessionEnd.star2` | Good effort! Every session helps. | गोबां नाजा! समनदो मोनथिनाय गोबां! | ফজবা হোৎনবা! সেসন খুদিংমক্না মতেং পাংই। | low / low | existing / existing |
| `game.sessionEnd.star1` | Well done for trying! Each day gets better. | नाजा खालामनायनि थाखाय गोबां! सान सान गोबां जागोन। | হোৎনখিবগীদমক থাগৎচরি! নুমিৎ খুদিংগী হেন্না ফজগনি। | low / low | existing / existing |
| `game.backToHome` | Back to home | होमआव फिन थांनो | হোম অদুদা অমুক ৎচৎলু | low / low | new / new |
| `game.start` | Start! | शुरु खालाम! | হৌবিয়ু! | low / medium | new / new |
| `game.anotherRound` | Play again | फिन खेला खालाम | অমুক খেল তৌ | low / low | new / new |
| `game.keepGoing` | Keep going | थांनो | চৎনা চৎলু | low / low | new / new |
| `game.finishSession` | Finish for now | दानि बन्द खालाम | হৌজিক লোইশিনবিয়ু | low / low | new / new |
| `game.outOfCorrect` | {count} out of {total} correct | {total}नि {count} ठिक | {count}/{total} চুম্মি | low / low | new / new |
| `game.starsLabel` | {count} of 5 stars | 5 तारानि {count} | থবী ৫ গী {count} | low / low | new / new |
| `game.routineRecall.name` | Routine Recall | दिनैनि खालामनाय सिनायथि | নুমিৎগী থবক নিংশিং | low / low | new / new |
| `game.routineRecall.loading` | Getting today's routine ready… | दिनैनि खालामनाय सजाय दं… | ঙসিগী থবক লোড তৌরি… | low / low | new / new |
| `game.routineRecall.notEnough` | Not enough reminders done yet today | दिनै रिमाइन्डार गोबां मोनथिनाय जायाखै | ঙসি রিমাইন্ডার ফাওদ্রে | low / low | new / new |
| `game.routineRecall.comeBack` | Come back after a few more reminders are done today. | दिनै रिमाइन्डार कुछ मोनथिनायनि उनाव फिन फै। | রিমাইন্ডার অহুম লোইরবদগী মতুংদা অমুক ফৈলু। | low / low | new / new |
| `game.routineRecall.instruction` | Tap them in the order you did them today | दिनै नों खालामनाय क्रमआव टाप खालाम | ঙসি নহাক্না তৌখিবা মান্নবা মথৌদা তাপ তৌ | low / low | new / new |
| `game.routineRecall.placed` | {count} of {total} placed | {total}नि {count} सजाय जाबाय | {count}/{total} থখ্রে | low / low | new / new |
| `game.routineRecall.correct` | Wonderful! That is exactly how today went. | मोजां! दिनै बेबादि जाबाय। | ফজেই! ঙসি অসিগুম্না ওইখ্রে। | low / low | new / new |
| `game.routineRecall.remember` | Let's remember together. | जों गासै सिनायथि खालाम। | মখোয় অমদি নিংশিংগদবনি। | low / low | new / new |
| `game.encourage.1.0` | You're learning! Keep trying. | नों फोराय दं! नाजा खालामनो। | নহাক্না ৎচাদ্রি! হোৎনবা তৌলু। | low / low | new / new |
| `game.encourage.1.1` | That's alright, let's try again. | बे मोजां, जों फिन नाजा खालाम। | য়াম্না ফজে, অমুক হোৎনসি। | low / low | new / new |
| `game.encourage.1.2` | Keep going, you can do it. | थांनो, नों खालामनो हायो। | চৎনা চৎলু, নহাক্না তৌগনি। | low / low | new / new |
| `game.encourage.2.0` | Good try! You're getting there. | मोजां नाजा! नों फैनायाव दं। | ফজবা হোৎনবা! নহাক্না ফাওরি। | low / low | new / new |
| `game.encourage.2.1` | Almost there! | अनसे बाकि! | ফাওখ্রে ওইনা! | low / low | new / new |
| `game.encourage.2.2` | You're improving! | नों दिनै दिनै मोजां जादों! | নহাক্না হেন্না ফজরি! | low / low | new / new |
| `game.encourage.3.0` | Nice work! | मोजां खालामनाय! | ফজবা থবক! | low / low | new / new |
| `game.encourage.3.1` | Well done! | मोजां जाबाय! | ফজেই! | low / medium | new / new |
| `game.encourage.3.2` | You're doing great! | नों गोबां खालामदों! | নহাক্না য়াম্না ফজে তৌরি! | medium / low | new / new |
| `game.encourage.4.0` | Great job! | गोजोन खालामनाय! | ফজবা থবক! | low / low | new / new |
| `game.encourage.4.1` | Excellent work! | खुबै मोजां खालामनाय! | য়াম্না ফজে! | low / low | new / new |
| `game.encourage.4.2` | Fantastic effort! | खुबै मोजां नाजा! | য়াম্না ফজবা হোৎনবা! | low / low | new / new |
| `game.encourage.5.0` | Wonderful! You remembered everything! | मोजां! नों गासैखौ सिनायथि खालामबाय! | য়াম্না ফজে! নহাক্না মথৌদা খুদিংমক নিংশিংখ্রে! | low / low | new / new |
| `game.encourage.5.1` | Perfect memory! | ठिक सिनायथि! | ফজবা নিংশিং! | low / low | new / new |
| `game.encourage.5.2` | Amazing! Every one correct! | मोजां! गासै ठिक! | য়াম্না ফজে! খুদিংমক চুম্মি! | low / low | new / new |
| `game.extraTaps` | {count} extra taps on other pictures | गुबुन फोटोआव {count} बार टाप खालामबाय | অতোপ্পা ফটোদা তাপ {count} অহেনবা | low / low | new / new |
| `game.celebrate.0` | Hooray! You did it! | मोजां! नों खालामबाय! | হুরে! নহাক্না তৌখ্রে! | low / low | new / new |
| `game.celebrate.1` | Wonderful! Session complete! | मोजां! सेसन मोनथिबाय! | ফজেই! সেসন লোইখ্রে! | low / medium | new / new |
| `game.celebrate.2` | Well played! Great to see you today! | मोजां खेला! दिनै नोंखौ नुनायाव गोजोन! | ফজবা খেল! ঙসি নহাকবু উবা ফজে! | low / low | new / new |
| `game.tutorial.howToPlay` | How to play | माबादि खेलानो | খেল তৌবগী মরম | low / low | new / new |
| `game.tutorial.title` | How to play | माबादि खेलानो | খেল তৌবগী মরম | low / low | new / new |
| `game.tutorial.stepOf` | Step {n} of {total} | स्टेप {n}/{total} | স্টেপ {n}/{total} | medium / medium | new / new |
| `game.tutorial.next` | Next | उनाव | মতুংদা | low / low | new / new |
| `game.tutorial.back` | Back | फिन थांनो | অমুক | low / low | new / new |
| `game.tutorial.gotIt` | Got it, let's play! | बुजिबाय, खेला खालाम! | খঙ্খ্রে, খেল তৌগদ্রি! | low / low | new / new |
| `game.tutorial.quickTap.step1` | First you see one picture. Remember it — this is the picture to catch. | सिगांनि नों फोटो मोनसे नुनो। बेखौ सिनायथि खालाम — बे फोटोखौ धरनो हागोन। | অহন্বা ফটো অমা উগনি। অসি নিংশিংলু — ফটো অসিনি ছাগদবা। | low / low | new / new |
| `game.tutorial.quickTap.step2` | Then pictures appear one at a time in the middle of the screen. | उनाव फोटोफोर मोनसे मोनसे स्क्रीननि बीचआव नुनायो। | মতুংদা ফটোশিং অমা অমা স্ক্রীনগী মাঝাদা উগনি। | low / low | new / new |
| `game.tutorial.quickTap.step3` | When you see your picture, tap the screen quickly. | नोंनि फोटो नुनायाव, जल्दी स्क्रीनआव टाप खालाम। | নহাক্কী ফটো উরবদা, থুনা স্ক্রীনদা তাপ তৌ। | low / low | new / new |
| `game.tutorial.quickTap.step4` | For any other picture, don't tap. Tapping other pictures takes points away. | गुबुन फोटोआव टाप खालामनो नङा। टाप खालामनायाव अंक कम जायो। | অতোপ্পা ফটোদা তাপ তৌদ্রবিয়ু। তাপ তৌবদা পয়েন্ট হাপ্লগনি। | low / low | new / new |
| `game.tutorial.pathMatch.step1` | Numbered circles are spread across the screen. | अंखन थानाय गोलफोर स्क्रीनआव दं। | নম্বর লৈবা গোলশিং স্ক্রীনদা লৈ। | low / low | new / new |
| `game.tutorial.pathMatch.step2` | Tap circle 1, then circle 2. A line joins them. | गोल 1 टाप खालाम, उनाव गोल 2। लाइन जोड़ जायो। | গোল ১ তাপ তৌ, মতুংদা গোল ২। লাইন অমা পুন্না তৌগনি। | low / low | new / new |
| `game.tutorial.pathMatch.step3` | Keep going in order — 3, 4, 5 — until every circle is joined. | क्रमआव थांनो — 3, 4, 5 — गासै गोल जोड़ जानाय सिफाय। | মান্নবা মথৌদা চৎলু — ৩, ৪, ৫ — গোল খুদিংমক পুন্না তৌবগা। | low / low | new / new |
| `game.tutorial.pathMatch.step4` | In higher levels there is a timer. Take your time; accuracy matters most. | गेदेर लेभेलआव टाइमार दं। आराम खालाम; ठिकसे खालामनायआव जोर होनो। | মখা লেবেলদা টাইমর লৈ। অহৈবা মতম ফংলু; চুম্না তৌবা য়াম্না মখল। | low / low | new / new |
| `game.tutorial.countingBoxes.step1` | A stack of boxes appears for a few seconds. | बाकसफोर कुछ सेकेन्डनि थाखाय नुनायो। | বাকস অহুম সেকেন্দ অহুমদা উগনি। | low / low | new / new |
| `game.tutorial.countingBoxes.step2` | Count every box, including the ones stacked behind or on top. | गासै बाकसखौ मुनो; उनावआव एबा गेदेरआव दंनायफोरखौ मुननो। | বাকস খুদিংমক মসিং তৌ, মতুংদা নত্রগা মখাদা লৈবসু। | low / low | new / new |
| `game.tutorial.countingBoxes.step3` | When the boxes disappear, enter how many you counted. | बाकसफोर नुनो हायाखै जानायाव, नों मुनायनि अंखन लिरनो। | বাকস অদু লৌরকপদা নহাক্না মসিং তৌখিবা নম্বর হাংবিয়ু। | low / low | new / new |
| `game.tutorial.iAmReady` | I'm ready! | आं सजायबाय! | ঐ তৈরি! | low / low | new / new |
| `game.tile` | Tile {n} | टाइल {n} | টাইল {n} | low / low | new / new |
| `game.card` | Card {n} | कार्ड {n} | কার্ড {n} | low / low | new / new |
| `game.pathPuzzle` | Path connecting puzzle | लाइन जोड़ खेला | লম্বী পুন্নবা খেল | low / low | new / new |
| `reminder.medication` | Time for your medicine | नोंनि दोरै जानाय समो | নহাক্কী মশিং থাক্কদবা মতম | low / low | existing / existing |
| `reminder.hydration` | Time to drink water | दोइ लांनाय समो | ঈশিং থাক্কদবা মতম | low / low | existing / existing |
| `reminder.activity` | Time for your walk | बेड़नाय समो | চৎনবগী মতম | low / low | existing / existing |
| `reminder.appointment` | Time for your appointment | नोंनि अपोइन्टमेन्टनि समो | নহাক্কী থীংনবগী মতম | low / low | existing / existing |
| `reminder.appointmentTomorrowAt` | You have an appointment tomorrow at {time} at {facility} | नोंनि थाखाय गाहाय {time} बजिआव {facility} आव अपोइन्टमेन्ट दं | নহাক্কী হায়েং {time} বজিদা {facility} দা এপয়েন্টমেন্ট অমা লৈ | low / low | new / new |
| `reminder.appointmentTomorrow` | You have an appointment tomorrow at {time} | नोंनि थाखाय गाहाय {time} बजिआव अपोइन्टमेन्ट दं | নহাক্কী হায়েং {time} বজিদা এপয়েন্টমেন্ট অমা লৈ | low / low | new / new |
| `reminder.appointmentTodayAt` | You have an appointment today at {time} at {facility} | नोंनि थाखाय दिनै {time} बजिआव {facility} आव अपोइन्टमेन्ट दं | নহাক্কী ঙসি {time} বজিদা {facility} দা এপয়েন্টমেন্ট অমা লৈ | low / low | new / new |
| `reminder.appointmentToday` | You have an appointment today at {time} | नोंनि थाखाय दिनै {time} बजिआव अपोइन्टमेन्ट दं | নহাক্কী ঙসি {time} বজিদা এপয়েন্টমেন্ট অমা লৈ | low / low | new / new |
| `reminder.whereToGo` | How to get there | माबादि थांनो | মখোয়দা ফাওবগী মরম | low / low | new / new |
| `reminder.whatToBring` | What to bring | मा लांनो | করি ফংগদবনো | low / low | new / new |
| `reminder.done` | Done | मोनथिबाय | লোইখ্রে | low / low | existing / existing |
| `reminder.snooze` | Later | सिगांनो | মতুংদা | low / low | existing / existing |
| `reminder.timeFor` | It is time for: | समो जायो: | মতম ওইখ্রে: | low / low | existing / existing |
| `reminder.remindLater` | Remind me in 15 minutes | आंखौ १५ मिनिटनि उनाव सिनायथि होनो | মিনিট ১৫ গী মতুংদা ঐবু নিংশিংহল্লু | low / low | existing / existing |
| `caregiver.dashboard` | Dashboard | ड्यासबोर्ड | ড্যাশবোর্ড | low / low | existing / existing |
| `caregiver.patients` | Patients | रोगिफोर | লাইনবাশিং | low / low | existing / existing |
| `caregiver.alerts` | Alerts | जागायनाय | চেক্শিন | low / low | existing / existing |
| `caregiver.lastSynced` | Last synced | जोबथा साइन | আরোইবা সিংক | low / low | existing / existing |
| `caregiver.syncNow` | Sync now | दानि साइन खालाम | হৌজিক সিংক তৌ | low / low | existing / existing |
| `sync.synced` | Synced | साइन जायो | সিংক তৌখ্রে | low / low | existing / existing |
| `sync.offline` | Offline | अफलाइन | অফলাইন | low / low | existing / existing |
| `sync.syncing` | Syncing | साइन जानाय दं | সিংক তৌরি | low / low | existing / existing |
| `sync.pending` | Waiting to sync | साइननि थाखाय गोरजोन | সিংকনবগী ঙাইরি | low / low | existing / existing |
| `sync.notSyncedYet` | Not synced yet | दानिस्लायनो साइन जायाखै | হৌজিক ফাওবা সিংক তৌদ্রি | low / low | existing / existing |
| `sync.lastOn` | · last {date} | · जोबथा {date} | · আরোইবা {date} | low / low | new / new |
| `disclaimer` | SMRITI supports cognitive care but does not diagnose or treat any medical condition. Always consult a qualified clinician. | SMRITI आ बुद्धिनि सुरक्षाआव हेल्फ खालामो, नाथाय गोनां रोगनि सिनायथि एबा फिसायथि खालामाखै। हांख्रि डाक्टारजों हलादिं मंत्राव खालाम। | SMRITI না লৈরিক্কী থৌওংদা মতেং পাংই, অদুবু লাইনা অমত্তা তাথিবা নত্রগা এনথোকপা তৌদে। চান্নবা ডাক্তর অমাদা হায় থানবা তৌবিয়ু। | low / low | existing / existing |
| `lang.as` | অসমীয়া | অসমীয়া | অসমীয়া | high / high | self-name / self-name |
| `lang.hi` | हिन्दी | हिन्दी | हिन्दी | high / high | self-name / self-name |
| `lang.en` | English | English | English | high / high | self-name / self-name |
| `lang.brx` | बड़ो | बड़ो | बड़ो | high / high | self-name / self-name |
| `lang.mni` | মৈতৈলোন্ | মৈতৈলোন্ | মৈতৈলোন্ | high / high | self-name / self-name |
| `lang.bn` | বাংলা | বাংলা | বাংলা | high / high | self-name / self-name |
| `lang.ne` | नेपाली | नेपाली | नेपाली | high / high | self-name / self-name |
| `common.back` | Back | फिन थांनो | অমুক | low / low | new / new |
| `common.goBack` | Go back | फिन थांनो | অমুক ৎচৎলু | low / low | new / new |
| `common.cancel` | Cancel | रद्द खालाम | রদ্দ তৌ | low / low | new / new |
| `common.loading` | Loading | लोड जायो | লোড তৌরি | low / low | new / new |
| `common.close` | Close | बन्द खालाम | থাদোক | low / low | new / new |
| `common.somethingWrong` | Something went wrong. Let us go back home. | मोनसे समस्या जादों। होमआव फिन थांनो। | করিবা অচম্বা ওইখ্রে। হোম অদুদা অমুক ৎচৎলু। | low / low | new / new |
| `common.goHome` | Go home | होमआव थांनो | হোমদা ৎচৎলু | low / low | new / new |
| `common.chooseLanguage` | Choose language | राव बाछा खालाम | লোন বাছাই তৌবিয়ু | low / low | new / new |
| `companion.title` | Ask Smriti | स्मृतिखौ सोंनो | স্মৃতিবু হাংবিয়ু | low / low | new / new |
| `companion.askMeSomething` | Ask me something | आंखौ मोनसे सोंनो | ঐবু করিবা হাংবিয়ু | low / low | new / new |
| `companion.listening` | Listening… | सुनाय दं… | শুনরি… | low / low | new / new |
| `companion.thinking` | Thinking… | सिनाय दं… | নিংশিংরি… | low / low | new / new |
| `companion.askQuestion` | Ask a question | प्रश्न सोंनो | হাংনবা অমা হাংবিয়ু | low / low | new / new |
| `companion.stopAsking` | Stop asking | सोंनाय बन्द खालाम | হাংনবা থাদোকবিয়ু | low / low | new / new |
| `companion.tapAndSpeak` | Tap and speak | टाप खालामनो आरो बुं | তাপ তৌনা হায়বিয়ু | low / low | new / new |
| `companion.tapWhenFinished` | Tap when you finish | मोनथिनायाव टाप खालाम | লোইরবদা তাপ তৌ | low / low | new / new |
| `companion.typeQuestion` | Type your question | नोंनि प्रश्न लिरनो | নহাক্কী হাংনবা ইখৈ | low / low | new / new |
| `companion.ask` | Ask | सोंनो | হাংবিয়ু | low / low | new / new |
| `companion.youAsked` | You asked | नों सोंबाय | নহাক্না হাংখিবা | low / low | new / new |
| `companion.aiAnswer` | AI-generated answer | एआइ-नि उत्तर | এআই-গী ঙাক্তবা | low / low | new / new |
| `companion.fromEarlier` | From earlier | सिगांनिफ्राय | অসিগী মখা | low / low | new / new |
| `companion.askAgain` | Ask again | फिन सोंनो | অমুক হাংবিয়ু | low / low | new / new |
| `companion.notSure` | I'm not sure about that. You could ask your caregiver. | आं बेखौ बुजियाखै। नों हेफाजाब खालामग्राखौ सोंनो हागोन। | ঐ মসি খঙদ্রে। নহাক্না কেয়ারগিভরবু হাংগনি। | low / low | new / new |
| `companion.unavailable` | I can't check that right now. Try again in a moment, or ask your caregiver. | आं दानि बेखौ नाजा खालामनो हायाखै। कुछ समोनि उनाव फिन नाजा खालाम, एबा हेफाजाब खालामग्राखौ सोंनो। | ঐ হৌজিক মসি চেক তৌনা য়াদ্রে। অকিবা মতুংদা অমুক হোৎনবিয়ু, নত্রগা কেয়ারগিভরবু হাংবিয়ু। | low / low | new / new |
| `companion.distress` | It sounds like you might be going through something hard right now. Please call 14416 (Tele-MANAS) to talk with someone, or tell your caregiver. | दानि नोंनि थाखाय मुश्किल समो दं बादि। 14416 (Tele-MANAS) आव फोन खालाम आरो बुंनो, एबा हेफाजाब खालामग्राखौ बुंनो। | নহাক্না হৌজিক মুশকিল মতম অমা ফংরি খ্রি। 14416 (Tele-MANAS) দা ফোন তৌনা মীওইনা হায়বিয়ু, নত্রগা কেয়ারগিভরদা হায়বিয়ু। | low / low | new / new |
| `companion.fromMemoryBook` | From your memory book | नोंनि सिनायथि बिजाबनिफ्राय | নহাক্কী মেমরি বুকতগী | low / low | new / new |
| `companion.consentNeeded` | Ask Smriti is not turned on. Your caregiver can turn it on in Settings. | स्मृतिखौ सोंनो चालु जायाखै। हेफाजाब खालामग्रा सेटिंसआव चालु खालामनो हागोन। | স্মৃতিবু হাংবা চালু ওইদ্রে। কেয়ারগিভরনা সেটিংসতা চালু তৌগনি। | low / low | new / new |
| `companion.typeInstead` | Type instead | लिरनो | ইখৈনা থীবিয়ু | low / low | new / new |
| `companion.speakInstead` | Speak instead | बुंनो | হায়নবা | low / low | new / new |
| `companion.micUnavailable` | The microphone could not be used. You can type your question. | माइक्रोफोन बाहाय जायाखै। नों नोंनि प्रश्न लिरनो हागोन। | মাইক্রোফোন ইশেংনবা য়াদ্রে। নহাক্কী হাংনবা ইখৈবিয়ু। | low / low | new / new |
| `companion.conversation` | Conversation with Smriti | स्मृतिजों बुंनाय | স্মৃতিগা ওয়াখল | low / low | new / new |
| `companion.you` | You | नों | নহাক | medium / medium | new / new |
| `companion.smriti` | Smriti | स्मृति | স্মৃতি | medium / medium | new / new |
| `companion.tapToReply` | Tap to reply | उत्तर होनो टाप खालाम | ঙাক্নবা তাপ তৌ | low / low | new / new |
| `companion.newConversation` | Start a new conversation | गोदान बुंनाय शुरु खालाम | অহান্বা ওয়াখল হৌবিয়ু | low / low | new / new |
| `companion.didNotHear` | I didn't catch that. Please tap and say it again. | आं बेखौ सुनायाखै। टाप खालाम आरो फिन बुंनो। | ঐ মসি খঙদ্রে। তাপ তৌনা অমুক হায়বিয়ু। | low / low | new / new |
| `reminders.title` | Reminders | रिमाइन्डार | রিমাইন্ডার | medium / medium | new / new |
| `reminders.today` | Today | दिनै | ঙসি | medium / medium | new / new |
| `reminders.noneToday` | No reminders today. | दिनै रिमाइन्डार दंखै। | ঙসি রিমাইন্ডার লৈদে। | low / low | new / new |
| `reminders.doneAt` | Done at {time} | {time} आव मोनथिबाय | {time} দা লোইখ্রে | low / low | new / new |
| `reminders.notDoneYet` | Not done yet | मोनथिनाय जायाखै | লোইদ্রে | low / low | new / new |
| `reminderType.medication` | Medicine | दोरै | ঔষধ | low / low | new / new |
| `reminderType.hydration` | Water | दै | ঈশিং | low / low | new / new |
| `reminderType.activity` | Activity | बेड़नाय | চৎনবা | low / low | new / new |
| `reminderType.appointment` | Appointment | अपोइन्टमेन्ट | এপয়েন্টমেন্ট | low / low | new / new |
| `family.messagesTitle` | Messages from family | नोगोरनिफ्राय मेसेज | ইমুংগী ওয়াখল | low / low | new / new |
| `family.from` | From {name} | {name}निफ्राय | {name} গী | low / low | new / new |
| `family.seen` | Seen | नुबाय | উখ্রে | low / low | new / new |
| `pin.keypad` | PIN keypad | पिन कीपैड | পিন কীপেড | low / low | new / new |
| `pin.backspace` | Backspace | बेकस्पेस | বেকস্পেস | low / low | new / new |
| `login.title` | Who is using SMRITI? | SMRITI जोबोर बाहायनाय? | SMRITI ইশেংনবা কনানো? | low / low | new / new |
| `login.subtitle` | Choose one. You can switch later. | मोनसे बाछा खालाम। उनाव फिन सोलायनो हागोन। | অমা থীংবিয়ু। মতুংদা অমুক হেৎপা য়াই। | low / low | new / new |
| `login.patient` | I am the Patient | आं रोगि | ঐ রোগী | low / low | new / new |
| `login.patientHint` | Play games and see my reminders | खेला खालाम आरो आं'नि रिमाइन्डार नुनो | খেল তৌনা ঐগী রিমাইন্ডার উবিয়ু | low / low | new / new |
| `login.caregiver` | I am the Caregiver | आं हेफाजाब खालामग्रा | ঐ কেয়ারগিভর | low / low | new / new |
| `login.caregiverHint` | Check progress and set things up | प्रगति नुनो आरो सेट अप खालाम | অগ্রগতি চেক তৌনা হৌদোকবিয়ু | low / low | new / new |

## Per-game catalogs (`src/components/games/*/messages.northeast.ts`)

### n-back

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.dualNBack.title` | N-Back | एन-बेक | এন-বেক | medium / medium |
| `games.dualNBack.gameUI.title` | N-Back | एन-बेक | এন-বেক | medium / medium |
| `games.dualNBack.gameUI.loading` | Loading… | लोड जायो… | লোড তৌরি… | low / low |
| `games.dualNBack.gameUI.starting` | Get ready… | सजाय जानो… | তৈরি ওইলু… | low / low |
| `games.dualNBack.gameUI.startTraining` | Start | शुरु | হৌবিয়ু | low / low |
| `games.dualNBack.gameUI.playAgain` | Play again | फिन खेला खालाम | অমুক খেল তৌ | low / low |
| `games.dualNBack.gameUI.settings` | Settings | सेटिंस | সেটিংস | low / low |
| `games.dualNBack.gameUI.gameSettings` | Activity settings | खेलानि सेटिंस | খেলগী সেটিংস | low / low |
| `games.dualNBack.gameUI.nBackLevel` | N-back level | एन-बेक लेभेल | এন-বেক লেবেল | low / low |
| `games.dualNBack.gameUI.back` | {level}-back | {level}-बेक | {level}-বেক | low / low |
| `games.dualNBack.gameUI.voiceType` | Voice | सोदोब | লোল | low / low |
| `games.dualNBack.gameUI.male` | Male | पुरुष | পুরুষ | medium / low |
| `games.dualNBack.gameUI.female` | Female | महिला | মহিলা | medium / low |
| `games.dualNBack.gameUI.trainingMode` | What to track | मा नुनो | করি উবগে | low / low |
| `games.dualNBack.gameUI.position` | Position | जायगा | মফম | low / low |
| `games.dualNBack.gameUI.audio` | Sound | सोदोब | খোংজেল | low / low |
| `games.dualNBack.gameUI.dual` | Position and sound | जायगा आरो सोदोब | মফম অমসুং খোংজেল | low / low |
| `games.dualNBack.gameUI.trialsPerRound` | Number of rounds | राउन्डनि अंखन | রাউন্দগী নম্বর | low / low |
| `games.dualNBack.gameUI.trials` | {count} rounds | {count} राउन्ड | রাউন্দ {count} | low / low |
| `games.dualNBack.gameUI.trialSpeed` | Speed | गति | থুনা | low / low |
| `games.dualNBack.gameUI.seconds` | {seconds}s | {seconds}से | {seconds}সে | low / low |
| `games.dualNBack.gameUI.saveChanges` | Save | सेभ खालाम | সেভ তৌ | low / low |
| `games.dualNBack.gameUI.needBothButtons` | Keep at least one of Position or Sound turned on. | जायगा एबा सोदोब, कमसे मोनसे चालु खालामनो हागोन। | মফম নত্রগা খোংজেল, অকিবা অমা চালু তৌবিয়ু। | low / low |
| `games.dualNBack.gameUI.level` | Level | लेभेल | লেবেল | medium / low |
| `games.dualNBack.gameUI.levelLabel` | Level {level} | लेभेल {level} | লেবেল {level} | medium / low |
| `games.dualNBack.gameUI.trial` | Round {current} of {total} | राउन्ड {current}/{total} | রাউন্দ {current}/{total} | medium / low |
| `games.dualNBack.gameUI.challenge` | Watch the tile, listen for the letter, and say whether it matches from {level} step(s) back. | टाइलखौ नुनो, हरफखौ सुनो, आरो {level} स्टेप सिगांनिजों मिलनाय जाबाय ला नङा बुंनो। | টাইল উবিয়ু, অক্ষর শুনবিয়ু, অদুগা {level} স্টেপ মখাগী মান্নরবা নত্রগা মান্নদ্রবা হায়বিয়ু। | low / low |
| `games.dualNBack.gameUI.positionMatch` | Same position | जायगा मिलाव | মফম মান্নবা | low / low |
| `games.dualNBack.gameUI.soundMatch` | Same sound | सोदोब मिलाव | খোংজেল মান্নবা | low / low |
| `games.dualNBack.gameUI.correct` | Correct | ठिक | চুম্মি | low / low |
| `games.dualNBack.gameUI.incorrect` | Not quite | पुरा ठिक नङा | চুম্দ্রে | low / low |
| `games.dualNBack.gameUI.missed` | Missed one | मोनसे छुटबाय | অমা লোয়খ্রে | low / low |
| `games.dualNBack.gameUI.falseAlarms` | False alarms | गलत जागायनाय | অচুম্বা চেক্শিন | low / low |
| `games.dualNBack.gameUI.accuracy` | Accuracy | ठिकनाय | চুম্বা | low / low |
| `games.dualNBack.gameUI.accuracyPercent` | {value}% | {value}% | {value}% | high / high |
| `games.dualNBack.gameUI.howToPlay` | How to play | माबादि खेलानो | খেল তৌবগী মরম | low / low |
| `games.dualNBack.gameUI.overallPerformance` | Overall performance | गासैनि खालामनाय | মপুমক থবক | low / low |
| `games.dualNBack.gameUI.trainingResults` | Activity complete | खेला मोनथिबाय | খেল লোইখ্রে | low / low |
| `games.dualNBack.gameUI.playingAudio` | Playing sound… | सोदोब चालु जायो… | খোংজেল চালু ওইরি… | low / low |
| `games.dualNBack.gameUI.replayAudio` | Play sound again | सोदोब फिन चालु खालाम | খোংজেল অমুক চালু তৌ | low / low |
| `games.dualNBack.gameUI.isPositionHighlight` | Position lit up | जायगा जोलोंबाय | মফম মৈখ্রে | low / low |
| `games.dualNBack.gameUI.continueTraining` | Keep exploring | फिन नाजा खालामनो | অমুক হোৎনবিয়ু | low / low |
| `games.dualNBack.gameUI.allGames` | Back to games | खेलाफोरआव फिन थांनो | খেলশিংদা অমুক ৎচৎলু | low / low |
| `games.dualNBack.gameUI.loadPrompt` | Loading the tutorial… | टिउटोरियाल लोड जायो… | টিউটোরিয়েল লোড তৌরি… | low / low |
| `games.dualNBack.gameUI.testMyLevel` | Try this level | बे लेभेल नाजा खालाम | লেবেল অসি হোৎনবিয়ু | low / low |
| `games.dualNBack.gameUI.tutorial.title` | How this activity works | बे खेला माबादि जायो | খেল অসি করিগুম্না তৌবনো | low / low |
| `games.dualNBack.gameUI.tutorial.whatIsNBack` | What is N-back? | एन-बेक मा? | এন-বেক করিনো? | low / low |
| `games.dualNBack.gameUI.tutorial.nBackExplanation` | A tile lights up and a letter plays, one at a time. You say whether the tile position (or the letter) is the same as it was a few steps earlier. | टाइल मोनसे जोलोंयो आरो हरफ मोनसे सुनायो, मोनसे मोनसे। टाइलनि जायगा (एबा हरफ) कुछ स्टेप सिगांनिजों मिलनाय जाबाय ला नङा बुंनो। | টাইল অমা মৈরি অমসুং অক্ষর অমা শুম্বা ঙমরি, অমা অমা। টাইলগী মফম (নত্রগা অক্ষর) স্টেপ অহুম মখাগীদা মান্নরবা নত্রগা মান্নদ্রবা হায়বিয়ু। | low / low |
| `games.dualNBack.gameUI.tutorial.stepProgress` | Step {current} of {total} | स्टेप {current}/{total} | স্টেপ {current}/{total} | medium / low |
| `games.dualNBack.gameUI.tutorial.nextStep` | Next | उनाव | মতুংদা | low / low |
| `games.dualNBack.gameUI.tutorial.prevStep` | Back | फिन थांनो | অমুক | low / low |
| `games.dualNBack.gameUI.tutorial.completeTutorial` | Start the real activity | असल खेला शुरु खालाम | অসল খেল হৌবিয়ু | low / low |
| `games.dualNBack.gameUI.tutorial.tutorialNote` | This is a practice walk-through. Nothing here is scored. | बे अभ्यासनि थाखाय। बेआव अंक होयाखै। | মসি অভ্যাসকী দমক। মসিদা স্কোর তৌদে। | low / low |
| `games.dualNBack.gameUI.tutorial.replayAudio` | Play sound again | सोदोब फिन चालु खालाम | খোংজেল অমুক চালু তৌ | low / low |
| `games.dualNBack.gameUI.tutorial.playingAudio` | Playing sound… | सोदोब चालु जायो… | খোংজেল চালু ওইরি… | low / low |
| `games.dualNBack.gameUI.tutorial.positionMatch` | Same position | जायगा मिलाव | মফম মান্নবা | low / low |
| `games.dualNBack.gameUI.tutorial.audioMatch` | Same sound | सोदोब मिलाव | খোংজেল মান্নবা | low / low |
| `games.dualNBack.gameUI.tutorial.correct` | Correct | ठिक | চুম্মি | low / low |
| `games.dualNBack.gameUI.tutorial.incorrect` | Not quite | पुरा ठिक नङा | চুম্দ্রে | low / low |
| `games.dualNBack.gameUI.tutorial.needBothButtons` | Keep at least one of Position or Sound turned on. | जायगा एबा सोदोब, कमसे मोनसे चालु खालामनो हागोन। | মফম নত্রগা খোংজেল, অকিবা অমা চালু তৌবিয়ু। | low / low |
| `games.dualNBack.gameUI.tutorial.step1` | A tile lights up here, and you hear a letter. Nothing to compare yet, just watch and listen. | टाइल मोनसे बेआव जोलोंयो, आरो नों हरफ मोनसे सुनो। दानि मिलानो आखै, नुनो आरो सुनो। | টাইল অমা মসিদা মৈরি, অদুগা নহাক্না অক্ষর অমা শুম্বগনি। হৌজিক মান্নবা লৈদে, উবিয়ু অমসুং শুনবিয়ু। | low / low |
| `games.dualNBack.gameUI.tutorial.step2` | A new tile lights up in a different spot, with a new letter. Still nothing to compare against. | गोदान टाइल गुबुन जायगाआव जोलोंयो, गोदान हरफजों। दानिबो मिलानो आखै। | অহান্বা টাইল অমা অতোপ্পা মফমদা মৈরি, অহান্বা অক্ষরগা। হৌজিকতা মান্নবা লৈদে। | low / low |
| `games.dualNBack.gameUI.tutorial.step3` | Watch closely: this tile is in the same spot as one step back. That is a position match: tap "Same position." | मोजां नुनो: बे टाइल स्टेप मोनसे सिगांनि जायगाआव दं। बे जायगा मिलाव: "जायगा मिलाव" टाप खालाम। | মথৌ ইনা উবিয়ু: টাইল অসি স্টেপ অমা মখাগী মফমদা লৈ। মসি মফম মান্নবা: "মফম মান্নবা" তাপ তৌ। | low / low |
| `games.dualNBack.gameUI.tutorial.step4` | This time the position is new, but the letter sounds the same as one step back. That is a sound match: tap "Same sound." | बे खेवआव जायगा गोदान, नाथाय हरफनि सोदोब स्टेप मोनसे सिगांनि बादि। बे सोदोब मिलाव: "सोदोब मिलाव" टाप खालाम। | মসি মতমদা মফম অহান্বা, অদুবু অক্ষরগী খোংজেল স্টেপ অমা মখাগী অসিগুম্না। মসি খোংজেল মান্নবা: "খোংজেল মান্নবা" তাপ তৌ। | low / low |
| `games.dualNBack.gameUI.tutorial.step5` | Both the position and the sound match one step back. Tap both: this is what a full match looks like. | जायगा आरो सोदोब गुबुन स्टेप मोनसे सिगांनिजों मिलो। ननि टाप खालाम: बे पुरा मिलाव। | মফম অমসুং খোংজেল অনিসু স্টেপ অমা মখাগীগা মান্নরি। অনিবু তাপ তৌ: মসি মপুম মান্নবানি। | low / low |
| `games.dualNBack.gameUI.interactiveTutorial` | Interactive tutorial | इन्टारेक्टिभ टिउटोरियाल | ইন্টারেক্টিভ টিউটোরিয়েল | low / low |
| `games.dualNBack.gameUI.cardTitle` | Fastest clears | जल्दी मोनथिनाय | থুনা লোইবা | low / low |
| `games.dualNBack.gameUI.cardSubtitle` | Recent completions | दानिनि मोनथिनाय | হৌজিকগী লোইবা | low / low |
| `games.dualNBack.gameUI.improveMemorySubtitle` | Practice regularly to build working memory | सिनायथि मोजां खालामनो दिनदिन अभ्यास खालाम | নিংশিং ফজহনবা লগাতার অভ্যাস তৌবিয়ু | low / low |
| `games.dualNBack.gameUI.empty` | No activity recorded yet. | दानिस्लायनो खेला रेकर्ड जायाखै। | হৌজিক খেল রেকর্ড ওইদ্রে। | low / low |
| `games.dualNBack.gameUI.totalClears` | Completions | मोनथिनाय | লোইবা | low / low |
| `games.dualNBack.gameUI.averagePassTime` | Average time | औसत समो | গড় মতম | low / low |
| `games.dualNBack.gameUI.you` | You | नों | নহাক | medium / medium |
| `games.dualNBack.gameUI.columns.player` | Name | मुं | মিং | medium / low |
| `games.dualNBack.gameUI.columns.level` | Level | लेभेल | লেবেল | medium / low |
| `games.dualNBack.gameUI.columns.accuracy` | Accuracy | ठिकनाय | চুম্বা | low / low |
| `games.dualNBack.gameUI.columns.duration` | Time | समो | মতম | medium / low |
| `games.dualNBack.gameUI.columns.clearedAt` | Date | तारिख | তারিখ | low / low |
| `games.dualNBack.gameUI.columns.order` | # | # | # | high / high |
| `games.dualNBack.gameMessages.keepOneMode` | Keep at least one of Position or Sound turned on. | जायगा एबा सोदोब, कमसे मोनसे चालु खालामनो हागोन। | মফম নত্রগা খোংজেল, অকিবা অমা চালু তৌবিয়ু। | low / low |
| `common.progressShare.button` | Share progress | प्रगति शेयार खालाम | অগ্রগতি শেয়ার তৌ | low / low |
| `common.progressShare.correctResponses` | Correct responses | ठिक उत्तर | চুম্বা উত্তর | low / low |
| `common.progressShare.sessionTime` | Session time | सेसननि समो | সেসনগী মতম | low / low |
| `common.progressShare.customSession` | Custom session | कस्टम सेसन | কাস্টম সেসন | low / low |
| `common.progressShare.standardMode` | Standard mode | साधारण मोड | সাধারণ মোড | low / low |
| `common.progressShare.firstTrackedSession` | First tracked session | सिगांनि रेकर्ड सेसन | অহান্বা রেকর্দ তৌবা সেসন | low / low |
| `common.progressShare.higherThanLast` | {value} higher than last time | सिगांनि खेवनिफ्राय {value} बेसी | মখাগী মতমদগী {value} হেন্না | low / low |
| `common.progressShare.lowerThanLast` | {value} lower than last time | सिगांनि खेवनिफ्राय {value} कम | মখাগী মতমদগী {value} কম | low / low |
| `common.progressShare.sessionsTracked` | {count} sessions tracked | {count} सेसन रेकर्ड जादों | সেসন {count} রেকর্ড ওইখ্রে | low / low |
| `common.leaderboard.unitPercent` | % | % | % | high / high |
| `common.leaderboard.unitSec` | s | से | সে | low / low |

### memory-span

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.freeShortTermMemoryTest.wordBank[0]` | River | दैमा | তুরেল | low / low |
| `games.freeShortTermMemoryTest.wordBank[1]` | Basket | टोकरी | টোকরী | low / low |
| `games.freeShortTermMemoryTest.wordBank[2]` | Lamp | बत्ती | বাতি | low / low |
| `games.freeShortTermMemoryTest.wordBank[3]` | Bicycle | साइकेल | সাইকেল | low / low |
| `games.freeShortTermMemoryTest.wordBank[4]` | Umbrella | छाता | ছাতা | low / low |
| `games.freeShortTermMemoryTest.wordBank[5]` | Kettle | केतली | কেটলী | low / low |
| `games.freeShortTermMemoryTest.wordBank[6]` | Blanket | कम्बल | কম্বল | low / low |
| `games.freeShortTermMemoryTest.wordBank[7]` | Mango | आम | আম | low / low |
| `games.freeShortTermMemoryTest.wordBank[8]` | Window | खिरिकी | খিড়কী | low / low |
| `games.freeShortTermMemoryTest.wordBank[9]` | Ladder | सिढी | সিঁড়ি | low / low |
| `games.freeShortTermMemoryTest.wordBank[10]` | Candle | मोमबत्ती | মোমবাতি | low / low |
| `games.freeShortTermMemoryTest.wordBank[11]` | Pillow | बालिस | বালিশ | low / low |
| `games.freeShortTermMemoryTest.wordBank[12]` | Garden | बगान | বাগান | low / low |
| `games.freeShortTermMemoryTest.wordBank[13]` | Bridge | साको | সেতু | low / low |
| `games.freeShortTermMemoryTest.wordBank[14]` | Mirror | आइना | আয়না | low / low |
| `games.freeShortTermMemoryTest.wordBank[15]` | Bucket | बाल्टि | বাল্টি | low / low |
| `games.freeShortTermMemoryTest.memorizeTheseWords` | Memorize these words | बे रावफोरखौ सिनायथि खालाम | শব্দ অসিসিং নিংশিংবিয়ু | low / low |
| `games.freeShortTermMemoryTest.studyAtYourPace` | Take your time. Tap Ready when you have looked at all of them. | नों समो लाना। गासै नुनायनि उनाव 'सजाय' टाप खालाम। | মতম ফংলু। খুদিংমক উরবদগী মতুংদা 'তৈরি' তাপ তৌ। | low / low |
| `games.freeShortTermMemoryTest.ready` | Ready | सजाय | তৈরি | low / low |
| `games.freeShortTermMemoryTest.voice.hearWords` | Hear the words | रावफोर सुनो | শব্দশিং শুনবিয়ু | low / low |
| `games.freeShortTermMemoryTest.voice.stopReading` | Stop reading | फोरनाय बन्द खालाम | পড়া থাদোকবিয়ু | low / low |
| `games.freeShortTermMemoryTest.voice.sayWords` | Say the words | रावफोर बुंनो | শব্দশিং হায়বিয়ু | low / low |
| `games.freeShortTermMemoryTest.voice.stopListening` | Stop | बन्द | থাদোক | low / low |
| `games.freeShortTermMemoryTest.voice.listening` | Listening… say the words you remember. | सुनाय दं… नों सिनायथि खालामनाय रावफोर बुंनो। | শুনরি… নহাক্না নিংশিংখিবা শব্দশিং হায়বিয়ু। | low / low |
| `games.freeShortTermMemoryTest.voice.transcribing` | Understanding what you said… | नों बुंनायखौ बुजिनाय दं… | নহাক্না হায়খিবদু খঙবা… | low / low |
| `games.freeShortTermMemoryTest.voice.error` | Could not hear you. You can type the words instead. | आं सुनायाखै। रावफोर लिरनो हागोन। | ঐ শুম্দ্রে। শব্দশিং ইখৈবা য়াই। | low / low |
| `games.freeShortTermMemoryTest.voice.heard` | Heard: "{text}" | सुनायबाय: "{text}" | শুম্খ্রে: "{text}" | low / low |
| `games.freeShortTermMemoryTest.recall.title` | What did you see? | नों मा नुनाय? | নহাক্না করি উখিবনো? | low / low |
| `games.freeShortTermMemoryTest.recall.gridInstruction` | Say or type as many words as you remember, in any order. | नों सिनायथि खालामनाय रावफोर गासैखौ बुंनो एबा लिरनो। | নহাক্না নিংশিংখিবা শব্দশিং খুদিংমক হায়বিয়ু নত্রগা ইখৈবিয়ু। | low / low |
| `games.freeShortTermMemoryTest.recall.inputLabel` | Your answers | नोंनि उत्तर | নহাক্কী উত্তর | low / low |
| `games.freeShortTermMemoryTest.submitRecall` | Done recalling | सिनायथि मोनथिबाय | নিংশিংবা লোইখ্রে | low / low |
| `games.freeShortTermMemoryTest.setup.title` | A couple of questions | कुछ प्रश्न | প্রশ্ন অহুম | low / low |
| `games.freeShortTermMemoryTest.setup.description` | This helps us understand your result. | बेयाव नोंनि रिजल्ट बुजिनो हेल्फ जायो। | মসিনা নহাক্কী রিজল্ট খঙবদা মতেং পাংই। | low / low |
| `games.freeShortTermMemoryTest.setup.ageGroup` | Age group | उमेरनि दल | বয়সগী দল | low / low |
| `games.freeShortTermMemoryTest.setup.ageUnder18` | Under 18 | 18 निफ्राय कम | ১৮ কম | low / low |
| `games.freeShortTermMemoryTest.setup.age18to25` | 18–25 | 18–25 | 18–25 | high / high |
| `games.freeShortTermMemoryTest.setup.age26to45` | 26–45 | 26–45 | 26–45 | high / high |
| `games.freeShortTermMemoryTest.setup.age46to65` | 46–65 | 46–65 | 46–65 | high / high |
| `games.freeShortTermMemoryTest.setup.age65plus` | 65+ | 65+ | 65+ | high / high |
| `games.freeShortTermMemoryTest.setup.gender` | Gender | लिंग | লিঙ্গ | low / low |
| `games.freeShortTermMemoryTest.setup.male` | Male | पुरुष | পুরুষ | medium / low |
| `games.freeShortTermMemoryTest.setup.female` | Female | महिला | মহিলা | medium / low |
| `games.freeShortTermMemoryTest.setup.other` | Other | गुबुन | অতোপ্পা | low / low |
| `games.freeShortTermMemoryTest.setup.submit` | See my result | आं'नि रिजल्ट नुनो | ঐগী রিজল্ট উবিয়ু | low / low |
| `games.freeShortTermMemoryTest.results.title` | Your result | नोंनि रिजल्ट | নহাক্কী রিজল্ট | low / low |
| `games.freeShortTermMemoryTest.results.excellent` | Excellent memory today! | दिनै खुबै मोजां सिनायथि! | ঙসি য়াম্না ফজবা নিংশিং! | low / low |
| `games.freeShortTermMemoryTest.results.good` | Good work today! | दिनै मोजां खालामनाय! | ঙসি ফজবা থবক! | low / low |
| `games.freeShortTermMemoryTest.results.keepPracticing` | Every attempt helps your memory. | नाजा खालामनाय गासैयाव नोंनि सिनायथिखौ हेल्फ खालामो। | হোৎনবা খুদিংমক্না নহাক্কী নিংশিংদা মতেং পাংই। | low / low |
| `games.freeShortTermMemoryTest.results.performance` | Performance | खालामनाय | থবক | low / low |
| `games.freeShortTermMemoryTest.results.wordsRecalled` | Words remembered | सिनायथि खालामनाय राव | নিংশিংখিবা শব্দ | low / low |
| `games.freeShortTermMemoryTest.results.accuracy` | Accuracy | ठिकनाय | চুম্বা | low / low |
| `games.freeShortTermMemoryTest.results.timeSpent` | Time taken | लानाय समो | চৎখিবা মতম | low / low |
| `games.freeShortTermMemoryTest.results.percentile` | Percentile | पर्सेन्टाइल | পার্সেন্টাইল | low / low |
| `games.freeShortTermMemoryTest.results.correctWords` | Words you remembered | नों सिनायथि खालामनाय राव | নহাক্না নিংশিংখিবা শব্দ | low / low |
| `games.freeShortTermMemoryTest.results.noMatches` | No matches this time. That is alright. | बे खेवआव मिलाव जायाखै। बे मोजां। | মসি মতমদা মান্নদ্রে। ফজে। | low / low |
| `games.freeShortTermMemoryTest.results.missedWords` | Words to notice next time | उनाव खेवआव नुनोनायनि राव | মতুংগী মতমদা চেক তৌগদবা শব্দ | low / low |
| `games.freeShortTermMemoryTest.results.encouragement` | Well done for trying | नाजा खालामनायनि थाखाय मोजां | হোৎনখিবগী দমক ফজেই | low / low |
| `games.freeShortTermMemoryTest.results.trainingTip` | Playing this activity regularly can help keep your memory active. | बे खेला दिनदिन खालामनाय नोंनि सिनायथि सक्रिय थानो हेल्फ खालामो। | খেল অসি লগাতার তৌবদা নহাক্কী নিংশিং সক্রিয় লৈনবদা মতেং পাংই। | low / low |
| `games.freeShortTermMemoryTest.tryAgain` | Play again | फिन खेला खालाम | অমুক খেল তৌ | low / low |

### larger-number

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.largerNumber.gameUI.level` | Level | लेभेल | লেবেল | medium / low |
| `games.largerNumber.gameUI.target` | Get {accuracy}% correct across {attempts} tries | {attempts} बारआव {accuracy}% ठिक खालाम | হোৎনবা {attempts} দা {accuracy}% চুম্মি ফংবিয়ু | low / low |
| `games.largerNumber.gameUI.challenge` | Tap the larger number, {attempts} times, aiming for {accuracy}% correct | गेदेर अंखनखौ {attempts} बार टाप खालाम, {accuracy}% ठिक खालामनो | অহেনবা নম্বরদা {attempts} খ্রাং তাপ তৌ, {accuracy}% চুম্মি ফংনা | low / low |
| `games.largerNumber.gameUI.starting` | Starting… | शुरु जायो… | হৌরি… | low / low |
| `games.largerNumber.gameUI.startChallenge` | Start | शुरु | হৌবিয়ু | low / low |
| `games.largerNumber.gameUI.whichIsLarger` | Which number is larger? | मा अंखन गेदेर? | নম্বর কনা অহেনবনো? | low / low |
| `games.largerNumber.gameUI.timeUp` | Time's up | समो मोनथिबाय | মতম লোইখ্রে | low / low |
| `games.largerNumber.gameUI.totalAttempts` | Tries | नाजा | হোৎনবা | low / low |
| `games.largerNumber.gameUI.correctAnswers` | Correct | ठिक | চুম্মি | low / low |
| `games.largerNumber.gameUI.accuracy` | Accuracy | ठिकनाय | চুম্বা | low / low |
| `games.largerNumber.gameUI.nextLevel` | Next level | उनावनि लेभेल | মতুংগী লেবেল | low / low |
| `games.largerNumber.gameUI.nextLevelTarget` | Get {accuracy}% correct across {attempts} tries | {attempts} बारआव {accuracy}% ठिक खालाम | হোৎনবা {attempts} দা {accuracy}% চুম্মি ফংবিয়ু | low / low |
| `games.largerNumber.gameUI.adjustDifficultyDescription` | Would you like an easier round, or try this level again? | आसान राउन्ड नाजा खालामनो ला बे लेभेल फिन नाजा खालामनो? | আসান রাউন্দ হোৎনবা নত্রগা লেবেল অসিদা অমুক হোৎনবা? | low / low |
| `games.largerNumber.gameUI.decreaseDifficulty` | Make it easier | आसान खालाम | আসান তৌ | low / low |
| `games.largerNumber.gameUI.keepCurrentDifficulty` | Try again at this level | बे लेभेलआव फिन नाजा खालाम | লেবেল অসিদা অমুক হোৎনবিয়ু | low / low |
| `games.largerNumber.gameUI.continueChallenge` | Continue | थांनो | চৎলু | low / low |
| `games.largerNumber.gameUI.playAgain` | Play again | फिन खेला खालाम | অমুক খেল তৌ | low / low |
| `games.largerNumber.gameUI.share` | Share | शेयार खालाम | শেয়ার তৌ | low / low |
| `games.largerNumber.gameUI.congratulations` | Well done! | मोजां जाबाय! | ফজেই! | low / medium |
| `games.largerNumber.gameUI.keepGoing` | Good try, keep going. | मोजां नाजा, थांनो। | ফজবা হোৎনবা, চৎলু। | low / low |

### double-decision

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.doubleDecision.gameUI.title` | Double Decision | डबल डिसिजन | ডাবল ডিসিজন | low / low |
| `games.doubleDecision.gameUI.intro` | A shape flashes in the middle of the screen, and a sign appears somewhere around it. Notice both. | स्क्रीननि बीचआव आकार मोनसे जोलायो, आरो एनखौ साइन मोनसे नुनायो। गासैखौ नुनो। | স্ক্রীনগী মাঝাদা আকার অমা লাংখ্রে, অদুগী মখাদা চিহ্ন অমা উরে। অনিবু ফংলু। | low / low |
| `games.doubleDecision.gameUI.fixationTip` | Keep looking at the red dot in the center. | बीचआव लाल बिन्दुखौ नुनो। | মাঝাদা লাল বিন্দুদু উলু। | low / low |
| `games.doubleDecision.gameUI.startPractice` | Try one practice round | अभ्यास राउन्ड मोनसे नाजा खालाम | অভ্যাস রাউন্দ অমা হোৎনবিয়ু | low / low |
| `games.doubleDecision.gameUI.startReal` | Start the real activity | असल खेला शुरु खालाम | অসল খেল হৌবিয়ু | low / low |
| `games.doubleDecision.gameUI.practiceDoneTitle` | That's the idea | बेबादिनो | মসিগুম্না | low / low |
| `games.doubleDecision.gameUI.practiceDoneBody` | One quick look at the middle, then find where the sign appeared. Ready to begin? | बीचआव मोनसे नुनो, उनाव साइन नुनायाबाय जायगा नाजा खालाम। शुरु खालामनो सजाय ला? | মাঝাদা অমা উ, মতুংদা চিহ্ন উখিবা মফম চেক তৌ। হৌবা তৈরি? | low / low |
| `games.doubleDecision.gameUI.bestRating` | Best rating: {score} | सबसे मोजां रेटिं: {score} | ফজবা রেটিং: {score} | low / low |
| `games.doubleDecision.gameUI.bestScore` | Best accuracy: {score}% | सबसे मोजां ठिकनाय: {score}% | ফজবা চুম্বা: {score}% | low / low |
| `games.doubleDecision.gameUI.chooseVehicle` | Which vehicle did you see? | नों मा गाड़ि नुनाय? | নহাক্না গাড়ী করি উখিবনো? | low / low |
| `games.doubleDecision.gameUI.vehicles.sedan` | Car | कार | কার | low / low |
| `games.doubleDecision.gameUI.vehicles.taxi` | Taxi | टैक्सि | ট্যাক্সি | low / low |
| `games.doubleDecision.gameUI.vehicles.bus` | Bus | बास | বাস | low / low |
| `games.doubleDecision.gameUI.vehicles.truck` | Truck | ट्रक | ট্রাক | low / low |
| `games.doubleDecision.gameUI.chooseLocation` | Tap where the sign appeared | साइन नुनायाबाय जायगाआव टाप खालाम | চিহ্ন উখিবা মফমদা তাপ তৌ | low / low |
| `games.doubleDecision.gameUI.locationLabel` | Position {number} | जायगा {number} | মফম {number} | low / low |
| `games.doubleDecision.gameUI.correct` | Right! | ठिक! | চুম্মি! | low / low |
| `games.doubleDecision.gameUI.vehicleMissed` | Not quite that vehicle | बे गाड़ि नङा | গাড়ী অসি নত্তে | low / low |
| `games.doubleDecision.gameUI.signMissed` | Not quite that spot | बे जायगा नङा | মফম অসি নত্তে | low / low |
| `games.doubleDecision.gameUI.answerReveal` | It was a {vehicle}, near position {location}. | {vehicle} जायगा {location} आव दं। | {vehicle} অদু মফম {location} দা লৈখিবনি। | low / low |
| `games.doubleDecision.gameUI.round` | Round {current} of {total} | राउन्ड {current}/{total} | রাউন্দ {current}/{total} | medium / low |
| `games.doubleDecision.gameUI.score` | Accuracy {score}% | ठिकनाय {score}% | চুম্বা {score}% | low / low |
| `games.doubleDecision.gameUI.settings` | Settings | सेटिंस | সেটিংস | low / low |
| `games.doubleDecision.gameUI.settingsTitle` | Activity settings | खेलानि सेटिंस | খেলগী সেটিংস | low / low |
| `games.doubleDecision.gameUI.settingsRounds` | Number of rounds | राउन्डनि अंखन | রাউন্দগী নম্বর | low / low |
| `games.doubleDecision.gameUI.settingsSpeed` | Starting speed | शुरुनि गति | হৌখিবগী থুনা | low / low |
| `games.doubleDecision.gameUI.settingsSpeedHelp` | How long the shape shows at first. It adjusts automatically as you play. | आकार सिगांआव माब समो नुनायो बुंनो। खेला खालामनायाव बे आपे सोलायो। | আকার অদু হৌখিবদা কয়া মতম উরবনো। খেল তৌরিবদা মসি নিজে হেৎলগনি। | low / low |
| `games.doubleDecision.gameUI.settingsField` | Starting field size | शुरुनि क्षेत्रनि गेदेर | হৌখিবগী ক্ষেত্র অহেনবা | low / low |
| `games.doubleDecision.gameUI.settingsFieldHelp` | How spread out the signs are. This also adjusts automatically. | साइनफोर माबादि सारायो बुंनो। बेबो आपे सोलायो। | চিহ্নশিং করিগুম্না ফাংলমবনো। মসিসু নিজে হেৎলগনি। | low / low |
| `games.doubleDecision.gameUI.settingsHint` | You can leave these as they are. The activity adapts to you as you go. | बेफोरखौ बेबादिनो थाखो। खेला नोंजों मिलायो। | মসিশিং অসিগুম্না লৈরকপিয়ু। খেল অদু নহাক্কী মওংদা মান্নগনি। | low / low |
| `games.doubleDecision.gameUI.levelValue` | Level {level} | लेभेल {level} | লেবেল {level} | medium / low |
| `games.doubleDecision.gameUI.resultsTitle` | Activity complete | खेला मोनथिबाय | খেল লোইখ্রে | low / low |
| `games.doubleDecision.gameUI.resultsBody` | {correct} out of {total} correct | {total}नि {correct} ठिक | {correct}/{total} চুম্মি | low / low |
| `games.doubleDecision.gameUI.resultAccuracy` | Accuracy | ठिकनाय | চুম্বা | low / low |
| `games.doubleDecision.gameUI.resultField` | Widest field reached | सबसे गेदेर क्षेत्र | অহেনবা ক্ষেত্র ফাওখ্রে | low / low |
| `games.doubleDecision.gameUI.resultFastest` | Fastest correct look | सबसे जल्दी ठिक नुनाय | থুনা চুম্মি উবা | low / low |
| `games.doubleDecision.gameUI.ratingUnit` | rating | रेटिं | রেটিং | low / low |
| `games.doubleDecision.gameUI.progressSaved` | Saved to your progress. Your caregiver can see this on your dashboard. | नोंनि प्रगतिआव सेभ जायो। हेफाजाब खालामग्रा बेखौ ड्यासबोर्डआव नुनो हायो। | নহাক্কী অগ্রগতিদা সেভ ওইখ্রে। কেয়ারগিভরনা ড্যাশবোর্ডতা উগনি। | low / low |
| `games.doubleDecision.gameUI.playAgain` | Play again | फिन खेला खालाम | অমুক খেল তৌ | low / low |

### frog-leap

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.frogMemoryLeap.gameUI.level` | Level {level} | लेभेल {level} | লেবেল {level} | medium / low |
| `games.frogMemoryLeap.gameUI.watch` | jumps to watch | लांनाय नुनो | লাংনবা উবিয়ু | low / low |
| `games.frogMemoryLeap.gameUI.repeat` | Now you jump the same way | दानि नों बेबादिनो लां | হৌজিক নহাক্না অসিগুম্না লাংলু | low / low |
| `games.frogMemoryLeap.gameUI.correct` | Well jumped! | मोजां लांनाय! | ফজবা লাংবা! | low / low |
| `games.frogMemoryLeap.gameUI.gameOver` | Not quite, try again | पुरा ठिक नङा, फिन नाजा खालाम | চুম্দ্রে, অমুক হোৎনবিয়ু | low / low |
| `games.frogMemoryLeap.gameUI.start` | Start | शुरु | হৌবিয়ু | low / low |
| `games.frogMemoryLeap.gameUI.score` | Score: {score} | स्कोर: {score} | স্কোর: {score} | low / low |
| `games.frogMemoryLeap.gameUI.highScore` | Best: {score} | सबसे मोजां: {score} | ফজবা: {score} | low / low |
| `games.frogMemoryLeap.gameUI.tryAgain` | Try again | फिन नाजा खालाम | অমুক হোৎনসি | medium / low |
| `games.frogMemoryLeap.gameUI.settings` | Settings | सेटिंस | সেটিংস | low / low |
| `games.frogMemoryLeap.gameUI.startLevel` | Starting level | शुरुनि लेभेल | হৌখিবগী লেবেল | low / low |
| `games.frogMemoryLeap.gameUI.cancel` | Cancel | रद्द खालाम | রদ্দ তৌ | low / low |
| `games.frogMemoryLeap.gameUI.save` | Save | सेभ खालाम | সেভ তৌ | low / low |

### fish-trace

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.fishTrace.title` | Fish Trace | ना नाजा | ঙা তুংগৈনবা | medium / low |
| `games.fishTrace.level` | Level | लेभेल | লেবেল | medium / low |
| `games.fishTrace.scorePrefix` | Score | स्कोर | স্কোর | low / low |
| `games.fishTrace.bestScore` | Best | सबसे मोजां | ফজবা | low / low |
| `games.fishTrace.start` | Watch the glowing fish | जोलोंनाय नाखौ नुनो | মৈখিবা ঙা উবিয়ু | low / low |
| `games.fishTrace.glowEnding` | Remember them… | बेफोरखौ सिनायथि खालाम… | অসিসিং নিংশিংবিয়ু… | low / low |
| `games.fishTrace.tracking` | Keep watching, do not lose them | नुनायनो थानो; हारायनो नङा | উরি চৎলু, লোয়ননা | low / low |
| `games.fishTrace.selection` | Tap the fish you were following | नों नुनोनाय नाखौ टाप खालाम | নহাক্না উরিবা ঙাদু তাপ তৌ | low / low |
| `games.fishTrace.perfect` | You found them all! | नों गासैखौ मोनबाय! | নহাক্না খুদিংমক ফংখ্রে! | low / low |
| `games.fishTrace.partial` | Good! You found some | मोजां! नों कुछ मोनबाय | ফজে! নহাক্না অহুম ফংখ্রে | low / low |
| `games.fishTrace.gameOver` | Not this time | बे खेव नङा | মসি মতমদা নত্তে | low / low |
| `games.fishTrace.startBtn` | Start | शुरु | হৌবিয়ু | low / low |
| `games.fishTrace.confirmSelection` | Done selecting | बाछा मोनथिबाय | বাছাই লোইখ্রে | low / low |
| `games.fishTrace.tryAgain` | Try again | फिन नाजा खालाम | অমুক হোৎনসি | medium / low |
| `games.fishTrace.round` | Level {level} | लेभेल {level} | লেবেল {level} | medium / low |
| `games.fishTrace.settings` | Settings | सेटिंस | সেটিংস | low / low |
| `games.fishTrace.startLevel` | Starting level | शुरुनि लेभेल | হৌখিবগী লেবেল | low / low |
| `games.fishTrace.cancel` | Cancel | रद्द खालाम | রদ্দ তৌ | low / low |
| `games.fishTrace.save` | Save | सेभ खालाम | সেভ তৌ | low / low |

### counting-boxes

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.countingBoxes.gameUI.observing` | Watch the boxes | बाकसफोरखौ नुनो | বাকসশিং উবিয়ু | low / low |
| `games.countingBoxes.gameUI.nextLevel` | Next level in {seconds} | {seconds} सेकेन्डआव उनावनि लेभेल | {seconds} সেকেন্দতা মতুংগী লেবেল | low / low |
| `games.countingBoxes.gameUI.startGame` | Start | शुरु | হৌবিয়ু | low / low |
| `games.countingBoxes.gameUI.howMany` | How many boxes did you see? | बाकसनि अंखन मा जायो? | নহাক্না বাকস কয়া উখিবনো? | low / low |
| `games.countingBoxes.gameUI.enter` | Enter | लिरनो | ইখৈবিয়ু | low / low |
| `games.countingBoxes.gameUI.correct` | Correct | ठिक | চুম্মি | low / low |
| `games.countingBoxes.gameUI.incorrect` | Not quite | पुरा ठिक नङा | চুম্দ্রে | low / low |
| `games.countingBoxes.gameUI.actualCount` | There were {count} | {count} दं | {count} লৈরিবনি | low / low |
| `games.countingBoxes.gameUI.gameOver` | Activity complete | खेला मोनथिबाय | খেল লোইখ্রে | low / low |
| `games.countingBoxes.gameUI.accuracyLabel` | Correct rounds | ठिक राउन्ड | চুম্মি রাউন্দ | low / low |
| `games.countingBoxes.gameUI.totalTimeLabel` | Time taken | लानाय समो | চৎখিবা মতম | low / low |
| `games.countingBoxes.gameUI.seconds` | s | से | সে | low / low |
| `games.countingBoxes.gameUI.encouragement.perfect` | Perfect! Wonderful counting today. | ठिक! दिनै मोजां मुनायनाय। | চুম্মি! ঙসি ফজবা মসিং। | low / low |
| `games.countingBoxes.gameUI.encouragement.great` | Great work today! | दिनै गोजोन खालामनाय! | ঙসি ফজবা থবক! | low / low |
| `games.countingBoxes.gameUI.encouragement.good` | Good effort, keep going. | मोजां नाजा, थांनो। | ফজবা হোৎনবা, চৎলু। | low / low |
| `games.countingBoxes.gameUI.encouragement.keepTrying` | Well done for trying today. | दिनै नाजा खालामनायनि थाखाय मोजां। | ঙসি হোৎনখিবগী দমক ফজেই। | low / low |
| `games.countingBoxes.gameUI.playAgain` | Play again | फिन खेला खालाम | অমুক খেল তৌ | low / low |

### memory-blocks

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.blockMemoryChallenge.gameUI.level` | Level | लेभेल | লেবেল | medium / low |
| `games.blockMemoryChallenge.gameUI.watchSequence` | Watch the pattern | पैटार्नखौ नुनो | প্যাটার্ন উবিয়ু | low / low |
| `games.blockMemoryChallenge.gameUI.repeatSequence` | Now repeat it | दानि बेखौ फिन खालाम | হৌজিক অদু অমুক তৌবিয়ু | low / low |
| `games.blockMemoryChallenge.gameUI.wellDone` | Well done! | मोजां जाबाय! | ফজেই! | low / medium |
| `games.blockMemoryChallenge.gameUI.bestScore` | Best | सबसे मोजां | ফজবা | low / low |
| `games.blockMemoryChallenge.gameUI.startLevelLabel` | Starting level: {count} | शुरुनि लेभेल: {count} | হৌখিবগী লেবেল: {count} | low / low |
| `games.blockMemoryChallenge.gameUI.starting` | Starting… | शुरु जायो… | হৌরি… | low / low |
| `games.blockMemoryChallenge.gameUI.startGame` | Start | शुरु | হৌবিয়ু | low / low |
| `games.blockMemoryChallenge.gameUI.gameOver` | Round finished | राउन्ड मोनथिबाय | রাউন্দ লোইখ্রে | low / low |
| `games.blockMemoryChallenge.gameUI.finalScore` | Score | स्कोर | স্কোর | low / low |
| `games.blockMemoryChallenge.gameUI.playAgain` | Play again | फिन खेला खालाम | অমুক খেল তৌ | low / low |
| `games.blockMemoryChallenge.gameUI.share` | Share | शेयार खालाम | শেয়ার তৌ | low / low |

### reminiscence-quiz

| Key | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `games.reminiscenceQuiz.gameUI.heading` | Family & Life Quiz | नोगोर आरो जिउ क्वीज | ইমুং অমসুং হিংবা কুইজ | medium / medium |
| `games.reminiscenceQuiz.gameUI.correct` | Correct! | ठिक! | চুম্মি! | low / low |
| `games.reminiscenceQuiz.gameUI.tryTogether` | Let's remember together. | जों गासै सिनायथि खालाम। | মখোয় অমদি নিংশিংগদবনি। | low / low |
| `games.reminiscenceQuiz.gameUI.next` | Next | उनाव | মতুংদা | low / low |
| `games.reminiscenceQuiz.gameUI.finish` | Finish | मोनथि | লোইশিনবা | low / low |
| `games.reminiscenceQuiz.gameUI.noQuizYet` | No quiz is ready yet. Ask your caregiver to set one up. | दानिस्लायनो क्वीज सजाय जायाखै। हेफाजाब खालामग्राखौ सजायनो बुंनो। | কুইজ হৌজিক তৈরি ওইদ্রে। কেয়ারগিভরদু হাংবিয়ু। | low / low |
| `games.reminiscenceQuiz.gameUI.backHome` | Back to Home | होमआव फिन थांनो | হোম অদুদা অমুক ৎচৎলু | low / low |

## Object names (`src/lib/engine/objects.ts`)

Names of the 66 pictures in Object Hunt / Market List / Quick Tap / Memory Match. Regional items (Gamosa, Jaapi, Xorai, Mekhela ...) are proper nouns and are transliterated. A wrong name here means a patient is asked to find "the X" while shown a different picture, so verify these against the pictures.

| Object id | English | Bodo | Manipuri | Rating (brx/mni) |
|---|---|---|---|---|
| `gamosa` | Gamosa | गामोसा | গামোসা | low / low |
| `jaapi` | Jaapi | जापि | জাপি | low / low |
| `bamboo_basket` | Bamboo Basket | वाफांनि टोकरी | মৈকুপ | low / low |
| `mekhela` | Mekhela | मेखेला | মেখেলা | low / low |
| `dhol` | Dhol | ढोल | ঢোল | medium / medium |
| `xorai` | Xorai | शराइ | শরাই | low / low |
| `tamul` | Betel Nut | ताम्बुल | গুয়া | low / low |
| `rhino` | Rhino | गैंडा | গণ্ডার | low / low |
| `tea_leaf` | Tea Leaf | चा पाता | চা পাতা | low / low |
| `clay_pot` | Clay Pot | माटिनि हाँड़ि | মাটিগী হাঁড়ি | low / low |
| `pepa` | Pepa | पेपा | পেপা | low / low |
| `muga_silk` | Muga Silk | मुगा रेशम | মুগা রেশম | low / low |
| `rice` | Rice | मै | চাক | low / low |
| `fish` | Fish | ना | ঙা | medium / medium |
| `banana` | Banana | केला | কেলা | low / low |
| `mango` | Mango | आम | আম | low / low |
| `elephant` | Elephant | हाथि | সমু | low / medium |
| `cow` | Cow | गाइ | গাই | low / low |
| `duck` | Duck | हाँस | হাঁস | low / low |
| `peacock` | Peacock | मयूर | ময়ূর | low / low |
| `umbrella` | Umbrella | छाता | ছাতা | low / low |
| `lamp` | Oil Lamp | बत्ती | বাতি | low / low |
| `book` | Book | बिजाब | পুথি | medium / low |
| `key` | Key | चाबि | চাবি | low / low |
| `bell` | Bell | घण्टा | ঘণ্টা | low / low |
| `bicycle` | Bicycle | साइकेल | সাইকেল | low / low |
| `boat` | Boat | नाव | নাও | low / low |
| `sun` | Sun | सान | নুমিৎ | medium / medium |
| `moon` | Moon | चाँद | থা | low / medium |
| `flower` | Flower | बिबार | ফুল | medium / low |
| `tree` | Tree | बिफांग | গাছ | medium / low |
| `pitha` | Pitha | पिठा | পিঠা | low / low |
| `khar` | Khar | खार | খার | low / low |
| `bamboo_shoot` | Bamboo Shoot | वा गुदि | উঙ্গৌট | low / low |
| `kaji_nemu` | Assam Lemon | असम लेबु | আসাম লেবু | low / low |
| `jackfruit` | Jackfruit | कटहल | কাঁঠাল | low / low |
| `betel_leaf` | Betel Leaf | पान | পান | low / low |
| `curd` | Curd | दही | দই | low / low |
| `king_chili` | King Chili | भूत जोलोकिया | ভূত জলকিয়া | low / low |
| `ginger` | Ginger | आदा | আদা | low / low |
| `sticky_rice` | Black Sticky Rice | गोसोम मै | ময়ূম চাক | low / low |
| `fish_curry` | Fish Curry | ना जोबाय | ঙা তেঙা | low / low |
| `duck_egg` | Duck Egg | हाँसनि गुदि | হাঁসগী কোনি | low / low |
| `orange` | Orange | कमला | কমলা | low / low |
| `pineapple` | Pineapple | अनानास | আনারস | low / low |
| `hoolock_gibbon` | Hoolock Gibbon | हुलक गिब्बन | হুলক গিবন | low / low |
| `golden_langur` | Golden Langur | सोनाली लंगुर | সোনালী লঙ্গুর | low / low |
| `hornbill` | Hornbill | धनेश चराइ | ধনেশ চড়াই | low / low |
| `tiger` | Tiger | मैजि | কেই | low / medium |
| `water_buffalo` | Water Buffalo | मेस | মেস | low / low |
| `gogona` | Gogona | गगोना | গগনা | low / low |
| `taal` | Taal | ताल | তাল | low / low |
| `eri_silk` | Eri Silk | एरि रेशम | এরি রেশম | low / low |
| `sador` | Sador | चादर | চাদর | low / low |
| `handloom` | Handloom | ताँत | তাঁত | low / low |
| `tokou` | Tokou | टोकौ | টোকৌ | low / low |
| `hand_fan` | Hand Fan | हात पाखा | হাত পাখা | low / low |
| `bell_metal_plate` | Bell Metal Plate | काँसानि थाली | কাঁসার থালী | low / low |
| `fishing_net` | Fishing Net | ना गनायनि जाल | ঙা ছাংবগী জাল | low / low |
| `mortar_pestle` | Dheki | ढेकि | ঢেঁকী | low / low |
| `earthen_stove` | Earthen Stove | माटिनि चुला | মাটিগী চুলা | low / low |
| `bihu_dance` | Bihu Dance | बिहु नृत्य | বিহু নৃত্য | low / low |
| `bihu_bonfire` | Bihu Bonfire | मेजि | মেজি | low / low |
| `river` | River | दैमा | তুরেল | medium / medium |
| `water_lily` | Water Lily | पदुम बिबार | পদ্ম ফুল | low / low |
| `paddy_field` | Paddy Field | मै फाला | ফৌ পাডী | low / low |

## Push and alert opt-in strings (26 keys each)

`push.*`, `alertPush.*` and `alertOptIn.*` (closed-app reminders and caregiver alerts) were translated into Bodo and Manipuri by the assistant, not by a native speaker. **All 26 keys per language are LOW confidence** and need native review, starting with `alertPush.*` and `push.body`. Loanwords (notification, reminder, home screen) are used where no known native term exists. Manipuri is in Bengali script per `languages.ts`.

## Khasi (kha) and Mizo (lus)

Text-only. Their catalogs (`src/lib/i18n/locales/kha.json`, `lus.json`) are empty until someone runs `node --env-file=.env.local scripts/translate-locale.mjs kha lus`, which fills them from Bhashini's own translation service and writes a review sheet to `docs/translation-review-kha-lus.md`. Until then the caregiver picker does not offer either language. Medicine, appointment, PIN, distress and sign-in wording is never machine-translated: it stays English until a native speaker supplies it. Per-game catalogs and the 66 object names also stay English for these two. Not written or checked by a native speaker.
