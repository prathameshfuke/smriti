# Khasi (kha): draft translation, needs a native speaker

**Status: drafted with the Google Translate website and pasted in by hand. No native speaker has checked any line.** Nothing here reaches patients until a reviewer approves it and `apply` is run.

Drafted 139, passed the mechanical checks 137, flagged 2, meaning may have drifted on 19 (round trip below 0.25).

Reviewer: for each row, write `approve`, or replace the draft with the right text, in the last column. "Back to English" is what Google Translate says the draft means: read it against the English column. The round-trip score is a rough word-overlap screen and misses meaning errors, so read every row, not only the marked ones.

| Key | English | Draft | Back to English | Check | Round trip | Reviewer |
|---|---|---|---|---|---|---|
| `home.whoIsPlaying` | Who is playing? | Mano ba ialehkai? | Who is playing? | ok | 1.00 |  |
| `home.tapYourName` | Tap your name. | Tap ia ka kyrteng jong u. | Tap on your name. | ok | 0.75 |  |
| `home.notYou` | Not {name}? | Bad {name}? | Bad {name}? | ok | 0.33 |  |
| `home.chooseWhoTitle` | Choose who uses this phone | Jied mano ba pyndonkam ia kane ka phone . | Select who is using this phone | ok | 0.38 |  |
| `home.chooseWhoBody` | A caregiver needs to pick the person, or people, who will play on this phone. | U nongsumar u donkam ban jied ia u briew, ne ki briew, ki ban ialehkai ha kane ka phone. | The therapist needs to select the person, or persons, who will play on this phone call. | ok | 0.61 |  |
| `home.caregiver` | Caregiver | U nongsumar | Caregiver | ok | 1.00 |  |
| `home.greeting` | Hello | Khublei | Hello | ok | 1.00 |  |
| `home.startSession` | Start Playing | Sdang ban ialehkai | Start playing | ok | 1.00 |  |
| `home.reminders` | My Reminders | Ki jingpynkynmaw jong nga | My reminders | ok | 1.00 |  |
| `home.myProgress` | My progress | Ka jingkiew jong nga | My progress | ok | 1.00 |  |
| `home.streakCount` | day streak | ka sngi | sun | ok (drifted) | 0.00 |  |
| `home.streakStart` | Play today to start a streak | Ialehkai mynta ka sngi ban sdang ia ka jingialehkai | Play today to start the game | ok | 0.57 |  |
| `home.askSmriti` | Ask Smriti | Kylli ia ka Smriti . | Ask for the Smriti | ok | 0.50 |  |
| `home.chooseGame` | Choose a game | Jied ia ka jingialehkai | Select a game | ok | 0.33 |  |
| `home.messageForYou` | A message for you | Ka khubor na ka bynta jong phi . | A message for you . | ok | 1.00 |  |
| `home.thankYou` | Thank you! | Khublei! | Hello! | ok (drifted) | 0.00 |  |
| `home.noPatientTitle` | Nobody is set up on this phone | Ym don ba set up ia kane ka phone . | You don't have to set up this phone | ok | 0.36 |  |
| `home.noPatientBody` | A caregiver needs to sign in to set up this phone. | U nongsumar u donkam ban sign in ban buh ia kane ka phone. | The caregiver needs to sign in to set up this phone. | ok | 0.90 |  |
| `home.today` | Today | Mynta ka sngi | Today | ok | 1.00 |  |
| `game.objectHunt.name` | Object Hunt | Ka jingwad ia kiei kiei | Looking for things | ok (drifted) | 0.00 |  |
| `game.objectHunt.instruction` | Remember where each picture is hidden. Tap a tile to look. | Kynmaw shano la buhrieh ia kawei pa kawei ka dur. Tap ia ka tile ban peit. | Remember where each picture is hidden. Tap the tile to view. | ok | 0.75 |  |
| `game.objectHunt.whereWasThe` | Where was the | Hangno ka don ka | Where is the | ok | 0.50 |  |
| `game.objectHunt.rememberThis` | Remember this picture | Kynmaw ia kane ka dur . | Remember this picture | ok | 1.00 |  |
| `game.wordStream.name` | Market List | Ka thup iew | Marketplace | ok (drifted) | 0.00 |  |
| `game.wordStream.instruction` | Remember these things. We will ask you later. | Kynmaw ia kine kiei kiei. Ngin sa kylli ia phi hadien. | Remember these things. We'll ask you later. | ok | 0.67 |  |
| `game.wordStream.rememberLater` | Remember these for later. | Kynmaw ia kine na ka bynta hadien. | Remember these for later. | ok | 1.00 |  |
| `game.wordStream.okRemember` | OK, I remember! | OK, nga kynmaw! | OK, I remember! | ok | 1.00 |  |
| `game.wordStream.whichItems` | Which items did we show you? | Kiei ki tiar kiba ngi la pyni ia phi? | What tools did we show you? | ok | 0.50 |  |
| `game.wordStream.imDone` | I am done! | Nga la dep! | I'm done! | ok | 0.33 |  |
| `game.quickTap.name` | Quick Tap | Tap kloi | - | mostly-english | 0.00 |  |
| `game.quickTap.instruction` | Tap the picture as soon as you see it. | Tap ia ka dur tang shu iohi ia ka. | Tap on the picture as soon as you see it. | ok | 0.89 |  |
| `game.quickTap.targetIs` | Tap this picture: | Tap ia kane ka dur: | Tap this image: | ok | 0.50 |  |
| `game.quickTap.itemOf` | Picture {n} of {total} | Ka dur {n} jong ka {total} | The number {n} of {total} | ok | 0.40 |  |
| `game.quickTap.hits` | You tapped {count} pictures correctly | U la tap {count} ia ki dur ha ka rukom kaba dei | You have counted the number of photos in the correct order | ok (drifted) | 0.07 |  |
| `game.pathMatch.name` | Path Match | Jingiahap lynti | Roadmap | ok (drifted) | 0.00 |  |
| `game.pathMatch.instruction` | Join the numbers in order, from 1 onwards. | Pyniasoh ia ki nombar katkum ka jingpynbeit, naduh 1 shaneng. | Add the numbers in order, from 1 upwards. | ok | 0.56 |  |
| `game.pathMatch.good` | Good! | Babha! | Good! | ok | 1.00 |  |
| `game.pathMatch.pointOf` | Number {n} of {total} | Jingkhein {n} jong ka {total} | Number {n} of {total} | ok | 1.00 |  |
| `game.pathMatch.connected` | {count} out of {total} joined | {count} na ka {total} ba la pyniasoh | {count} from {total} connected | ok | 0.29 |  |
| `game.memoryMatch.name` | Memory Match | Jingiahap jingkynmaw | Memory Matching | ok | 0.33 |  |
| `game.memoryMatch.instruction` | Tap two cards. If they match, they stay open. | Tap ar tylli ki karta. Lada ki iadei, ki sah plie. | Tap two cards. If they match, they stay open. | ok | 1.00 |  |
| `game.memoryMatch.goodMatch` | Good match | Ka jingiadei kaba bha | Good relationship | ok | 0.33 |  |
| `game.memoryMatch.tryAnotherOne` | Let's try another one | To ngin pyrshang sa kawei pat . | Let's try something else . | ok | 0.33 |  |
| `game.memoryMatch.progress` | {count} of {total} pairs found | {count} jong ki {total} ki pairs ba la lap | {count} of {total} pairs found | ok | 1.00 |  |
| `game.memoryMatch.done` | All {total} pairs found! | Baroh {total} ki pairs la lap! | All {total} pairs found! | ok | 1.00 |  |
| `game.memoryBlocks.name` | Memory Blocks | Ki jingkhang jingkynmaw | Memory Doors | ok | 0.33 |  |
| `game.frogLeap.name` | Frog Leap | Ka jingkiew jong u khnai | The Rise of the Monkey | ok (drifted) | 0.00 |  |
| `game.countingBoxes.name` | Counting Boxes | Ki synduk jingkhein | Counting boxes | ok | 1.00 |  |
| `game.nBack.name` | N-Back | N-Badien | N-Back | ok | 1.00 |  |
| `game.largerNumber.name` | Larger Number | U nombar uba kham heh | The higher number | ok | 0.25 |  |
| `game.memorySpan.name` | Memory Span | Ka jingkynmaw | Memory | ok | 0.50 |  |
| `game.fishTrace.name` | Fish Trace | Ka jingbud ia ki dohkha | Following the fish | ok | 0.25 |  |
| `game.doubleDecision.name` | Double Decision | Ka rai kaba arsien | Second Decision | ok | 0.33 |  |
| `game.reminiscenceQuiz.name` | Family & Life Quiz | Ka jingkylli shaphang ka longïing bad ka jingim | Family & Lifestyle Questionnaire | ok (drifted) | 0.20 |  |
| `game.reminiscenceQuiz.noQuiz` | The quiz needs at least 3 people or memories in the Memory Book. Ask your caregiver to add them. | Ka quiz ka donkam ym duna ia ka 3 ngut ne ki jingkynmaw ha ka Kot Jingkynmaw. Kylli ia u nongsumar jong phi ban pyndap ia ki. | The quiz requires at least 3 people or memories in the Memory Book. Ask your healthcare provider to fill them out. | ok | 0.64 |  |
| `game.reminiscenceQuiz.whoIsThis` | Who is this? | Mano ine? | Who is this? | ok | 1.00 |  |
| `game.reminiscenceQuiz.whoIsYour` | Who is your {relationship}? | Uei u {relationship} jong phi? | Who is your relationship? | ok | 1.00 |  |
| `game.reminiscenceQuiz.whichIsAbout` | Who or what is this about? “{detail}” | Kane ka dei shaphang jongno ne aiu? "{detail}" | Who or what is this about? "{detail}" | ok | 1.00 |  |
| `game.correct` | Correct! | Badei! | Consistent! | ok (drifted) | 0.00 |  |
| `game.tryAgain` | Try again | Pyrshang biang | Try again | ok | 1.00 |  |
| `game.sessionComplete` | Well done! You finished today's session. | Kaba la leh paka! U la pyndep ia ka jingialang mynta ka sngi. | Well done! He finished the meeting today. | ok | 0.30 |  |
| `game.stars` | Stars earned | Ki khlur ba la kamai | Stars earned | ok | 1.00 |  |
| `game.sessionEnd.star5` | Perfect! Wonderful work today! | Ba janai! Ka kam kaba phylla mynta ka sngi! | Perfect! Wonderful job today! | ok | 0.60 |  |
| `game.sessionEnd.star4` | Excellent! You are doing great! | Biang palat! Ka jingleh kaba khraw! | Excellent! You're doing great! | ok | 0.50 |  |
| `game.sessionEnd.star3` | Great job today! Keep it up! | Ka kam kaba khraw mynta ka sngi! Iaileh! | Great job today! Keep it up! | ok | 1.00 |  |
| `game.sessionEnd.star2` | Good effort! Every session helps. | Ka jingpyrshang kaba bha! Kawei pa kawei ka jingïalang ka ïarap. | Good effort! Every session helps. | ok | 1.00 |  |
| `game.sessionEnd.star1` | Well done for trying! Each day gets better. | Ka jingleh bha ia ka jingpyrshang! Man la ka sngi ka nang kham bha. | Well done for the effort! Every day it gets better. | ok | 0.50 |  |
| `game.backToHome` | Back to home | Ka jingleit phai sha la iing | Going back home | ok | 0.50 |  |
| `game.start` | Start! | Sdang! | Begin! | ok (drifted) | 0.00 |  |
| `game.anotherRound` | Play again | Ialehkai biang | Play again | ok | 1.00 |  |
| `game.keepGoing` | Keep going | Nang iai bteng | Continued | ok (drifted) | 0.00 |  |
| `game.finishSession` | Finish for now | Pyndep noh na ka bynta mynta | Done for now | ok | 0.50 |  |
| `game.outOfCorrect` | {count} out of {total} correct | {count} na ka {total} kaba dei | {count} from {total} | ok | 0.33 |  |
| `game.starsLabel` | {count} of 5 stars | {count} ia ki 5 tylli ki khlur | {count} to 5 stars | ok | 0.50 |  |
| `game.routineRecall.name` | Routine Recall | Ka jingpynkynmaw ia ka rukom | A reminder of the method | ok (drifted) | 0.00 |  |
| `game.routineRecall.loading` | Getting today's routine ready… | Ka jingpynkhreh ia ka rukom leh mynta ka sngi... | Preparing for today's procedure… | ok (drifted) | 0.14 |  |
| `game.routineRecall.notEnough` | Not enough reminders done yet today | Ym pat biang ki jingpynkynmaw ba la leh mynta ka sngi | Not enough reminders made today | ok | 0.57 |  |
| `game.routineRecall.comeBack` | Come back after a few more reminders are done today. | To wan biang hadien ba la dep sa katto katne ki jingpynkynmaw mynta ka sngi. | Come back after a few more recalls today. | ok | 0.60 |  |
| `game.routineRecall.instruction` | Tap them in the order you did them today | Tap ia ki ha ka rukom ba phi la leh mynta ka sngi . | Tap them the way you did today . | ok | 0.67 |  |
| `game.routineRecall.placed` | {count} of {total} placed | {count} jong ka {total} ba la buh | {count} of {total} specified | ok | 0.60 |  |
| `game.routineRecall.correct` | Wonderful! That is exactly how today went. | Kaba sngewtynnad! Ka long thik kumta mynta ka sngi. | Wonderful! That's exactly what it is today. | ok | 0.40 |  |
| `game.routineRecall.remember` | Let's remember together. | To ngin ia kynmaw lang. | Let us remember together. | ok | 0.40 |  |
| `game.encourage.1.0` | You're learning! Keep trying. | Ka jingnang jingstad! To iai pyrshang. | You're knowledgeable! Keep trying. | ok | 0.60 |  |
| `game.encourage.1.1` | That's alright, let's try again. | Kata ka long kaba bha, to ngin pyrshang biang. | That's great, let's try again. | ok | 0.67 |  |
| `game.encourage.1.2` | Keep going, you can do it. | To nang iaid shakhmat, phi lah ban leh ia kata. | Keep going, you can do it. | ok | 1.00 |  |
| `game.encourage.2.0` | Good try! You're getting there. | Ka jingpyrshang kaba bha! Ka jingpoi shata. | Good effort! You got there. | ok | 0.25 |  |
| `game.encourage.2.1` | Almost there! | La jan poi! | It's almost a holiday! | ok | 0.25 |  |
| `game.encourage.2.2` | You're improving! | Ka jingpynbha! | You're improving! | ok | 1.00 |  |
| `game.encourage.3.0` | Nice work! | Ka kam kaba bha! | Good job! | ok (drifted) | 0.00 |  |
| `game.encourage.3.1` | Well done! | Kaba la leh paka! | Well done! | ok | 1.00 |  |
| `game.encourage.3.2` | You're doing great! | Ka jingleh kaba khraw! | You're doing great! | ok | 1.00 |  |
| `game.encourage.4.0` | Great job! | Ka kam kaba khraw! | Great job! | ok | 1.00 |  |
| `game.encourage.4.1` | Excellent work! | Ka kam kaba bha tam! | Excellent job! | ok | 0.33 |  |
| `game.encourage.4.2` | Fantastic effort! | Ka jingpyrshang kaba phylla! | Wonderful effort! | ok | 0.33 |  |
| `game.encourage.5.0` | Wonderful! You remembered everything! | Kaba sngewtynnad! U la kynmaw lut ia kiei kiei baroh! | Wonderful! He remembered everything! | ok | 0.60 |  |
| `game.encourage.5.1` | Perfect memory! | Ka jingkynmaw kaba janai! | A perfect memory! | ok | 1.00 |  |
| `game.encourage.5.2` | Amazing! Every one correct! | Baphylla! Kawei pa kawei ka dei! | Amazing! Every one is right! | ok | 0.50 |  |
| `game.extraTaps` | {count} extra taps on other pictures | {count} ki tap ba kham heh ha kiwei pat ki dur | {count} extra taps in other images | ok | 0.50 |  |
| `game.celebrate.0` | Hooray! You did it! | Khublei! U la leh ia kata! | Hello! You did it! | ok | 0.60 |  |
| `game.celebrate.1` | Wonderful! Session complete! | Kaba sngewtynnad! Ka jingïalang ka la dep! | Wonderful! The event is over! | ok (drifted) | 0.14 |  |
| `game.celebrate.2` | Well played! Great to see you today! | Ka jinglehkai kaba bha! Ka long kaba sngewtynnad ban iohi ia phi mynta ka sngi! | Good performance! It's great to see you today! | ok | 0.50 |  |
| `game.tutorial.howToPlay` | How to play | Kumno ban lehkai . | How to play | ok | 1.00 |  |
| `game.tutorial.title` | How to play | Kumno ban lehkai . | How to play | ok | 1.00 |  |
| `game.tutorial.stepOf` | Step {n} of {total} | Ka step {n} jong ka {total} | Step {n} of {total} | ok | 1.00 |  |
| `game.tutorial.next` | Next | Babud | Next | ok | 1.00 |  |
| `game.tutorial.back` | Back | Ka met | Back | ok | 1.00 |  |
| `game.tutorial.gotIt` | Got it, let's play! | La ioh, to ngin ialehkai! | Got it, let's play! | ok | 1.00 |  |
| `game.tutorial.quickTap.step1` | First you see one picture. Remember it — this is the picture to catch. | Nyngkong ngi iohi ia kawei ka dur. Kynmaw ia ka — kane ka dei ka dur ban kem. | First we see a picture. Remember it — this is an image to capture. | ok | 0.50 |  |
| `game.tutorial.quickTap.step2` | Then pictures appear one at a time in the middle of the screen. | Nangta ki dur ki paw kawei hadien kawei hapdeng ka screen. | The images then appear one by one in the middle of the screen. | ok | 0.62 |  |
| `game.tutorial.quickTap.step3` | When you see your picture, tap the screen quickly. | Ynda phi la iohi ia ka dur jong phi, tap ia ka screen stet. | When you see your photo, tap the screen quickly. | ok | 0.80 |  |
| `game.tutorial.quickTap.step4` | For any other picture, don't tap. Tapping other pictures takes points away. | Na ka bynta kano kano ka dur, wat tap. Ka jingtap ia kiwei pat ki dur ka shim ia ki point. | For any image, do not tap. Tapping other pictures takes points. | ok | 0.57 |  |
| `game.tutorial.pathMatch.step1` | Numbered circles are spread across the screen. | Ki circle ba la ai nombar la pynphriang kylleng ka screen. | Numbered circles are scattered across the screen. | ok | 0.75 |  |
| `game.tutorial.pathMatch.step2` | Tap circle 1, then circle 2. A line joins them. | Tap ia ka circle 1, nangta circle 2. U lain u pyniasoh ia ki. | Tap circle 1, then circle 2. The line connects them. | ok | 0.63 |  |
| `game.tutorial.pathMatch.step3` | Keep going in order — 3, 4, 5 — until every circle is joined. | To iaid beit ha ka jingpynbeit — 3, 4, 5 — haduh ba kawei pa kawei ka circle kan iasoh lang. | Keep going in the order — 3, 4, 5 — until each circle is connected. | ok | 0.58 |  |
| `game.tutorial.pathMatch.step4` | In higher levels there is a timer. Take your time; accuracy matters most. | Ha ki kyrdan kiba kham halor ka don ka por. Pyndonkam ia ka por jong phi; ka jinglong thikna ka long kaba kongsan tam. | At higher levels there is time. Take your time; accuracy is of utmost importance. | ok | 0.50 |  |
| `game.tutorial.countingBoxes.step1` | A stack of boxes appears for a few seconds. | Ka stack jong ki synduk ka paw tang katto katne sekhon. | The stack of boxes appears for a few seconds. | ok | 0.88 |  |
| `game.tutorial.countingBoxes.step2` | Count every box, including the ones stacked behind or on top. | Khmih ia kawei pa kawei ka synduk, kynthup ia kiba la buh shadien ne halor. | Count each box, including those stacked behind or on top. | ok | 0.62 |  |
| `game.tutorial.countingBoxes.step3` | When the boxes disappear, enter how many you counted. | Ynda ki synduk ki la jah, pynrung katno phi la khein. | When the boxes are gone, add how many you counted. | ok | 0.58 |  |
| `game.tutorial.iAmReady` | I'm ready! | Nga la pynkhreh! | I'm ready! | ok | 1.00 |  |
| `game.tile` | Tile {n} | Ka tile {n} | - | mostly-english | 0.00 |  |
| `game.card` | Card {n} | Kard {n} | Card {n} | ok | 1.00 |  |
| `game.pathPuzzle` | Path connecting puzzle | Ka jingkylli kaba pyniasoh ia ka lynti | Path Connecting Question | ok | 0.50 |  |
| `sync.synced` | Synced | La pyniadei | Linked | ok (drifted) | 0.00 |  |
| `sync.offline` | Offline | Lait khlem lain | Lineless Light | ok (drifted) | 0.00 |  |
| `sync.syncing` | Syncing | Ka jingpyniadei | Regard | ok (drifted) | 0.00 |  |
| `sync.pending` | Waiting to sync | Ka jingap ban pyniadei | Waiting to connect | ok | 0.50 |  |
| `sync.notSyncedYet` | Not synced yet | Ym pat lah ban sync | Could not sync yet | ok | 0.40 |  |
| `sync.lastOn` | · last {date} | · {date} ba khatduh | · last {date} | ok | 1.00 |  |
| `common.back` | Back | Ka met | Back | ok | 1.00 |  |
| `common.goBack` | Go back | Leit biang | Go Back | ok | 1.00 |  |
| `common.cancel` | Cancel | Pyndam | Cancel | ok | 1.00 |  |
| `common.loading` | Loading | Ka jingpynrung | Introduction | ok (drifted) | 0.00 |  |
| `common.close` | Close | Khang | Close | ok | 1.00 |  |
| `common.somethingWrong` | Something went wrong. Let us go back home. | Kaei kaei ka la iaid bakla. To ngin leit phai noh sha la iing. | Something went wrong. Let's go back home. | ok | 0.67 |  |
| `common.goHome` | Go home | Leit noh sha la iing | Go home | ok | 1.00 |  |
| `common.chooseLanguage` | Choose language | Jied ia ka ktien | Select Language | ok | 0.33 |  |
| `family.messagesTitle` | Messages from family | Ki khubor na ka iing ka sem | News from the family | ok | 0.40 |  |
| `family.from` | From {name} | Na ka {name} | Object {name} | ok | 0.33 |  |
| `family.seen` | Seen | Ba iohi | Seen | ok | 1.00 |  |

Never drafted, stays English until a reviewer supplies it (medicine, appointment, PIN, distress, sign-in, disclaimer): 104 strings.
