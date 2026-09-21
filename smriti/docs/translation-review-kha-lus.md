# Khasi and Mizo machine-translated text: evaluation (rejected, not shipped)

**Outcome: neither catalog was shipped.** Bhashini's `bhashini/iiith/nmt-all` output was read line by line and is not fit for a dementia-care app. Examples: Mizo returns a looped line ("Fakin fakin fakin ..."), Bengali characters inside a Mizo sentence, "Right!" for "Correct!", and "this phone is used by women" for "Choose who uses this phone". Khasi renders "Ask Smriti" as roughly "ask my spirit" and "Caregiver" as a servant title. `kha.json` and `lus.json` were reset to empty, so neither language is offered. This sheet is kept so a native speaker can correct it if one is found; nothing below is approved.

**Status: machine translation from Bhashini, not checked by a native speaker.** Lines left out (medicine, appointment, PIN, distress, sign-in wording, and anything whose placeholders were lost) show in English until a reviewer supplies text.

## Khasi (kha), service `bhashini/iiith/nmt-all`

| Key | English | Machine translation |
|---|---|---|
| `home.whoIsPlaying` | Who is playing? | Mano ba lehkai? |
| `home.tapYourName` | Tap your name. | Tap ka kyrteng jongphi. |
| `home.chooseWhoTitle` | Choose who uses this phone | Jied iano ba pyndonkam iakane ka phone. |
| `home.chooseWhoBody` | A caregiver needs to pick the person, or people, who will play on this phone. | Phi lah ban jied ia i briew ne ia i briew kiba nang ban leh ia kane ha phone. |
| `home.caregiver` | Caregiver | Shakri kum u Rangbah Lyngdoh |
| `home.greeting` | Hello | Kumno |
| `home.startSession` | Start Playing | Nga sdang ban lehkai. |
| `home.reminders` | My Reminders | Ki jingmaham jong nga |
| `home.myProgress` | My progress | Ka jingshlei jong nga |
| `home.streakCount` | day streak | Shatei ka Sngi |
| `home.streakStart` | Play today to start a streak | To shim iaka kyndon ban sdang mynta ka sngi. |
| `home.askSmriti` | Ask Smriti | Kylli na U Mynsiem jong nga. |
| `home.chooseGame` | Choose a game | Jied iaka game. |
| `home.caregiverAccess` | Caregiver access | Ai jakarieh ia u nongsumar |
| `home.forgotPin` | Forgot PIN? | Pha klet noh ia u snar? |
| `home.messageForYou` | A message for you | Ka khubor iaphi. |
| `home.thankYou` | Thank you! | Khublei! |
| `home.noPatientTitle` | Nobody is set up on this phone | Ym don ba set ha kane ka phone. |
| `home.noPatientBody` | A caregiver needs to sign in to set up this phone. | U nongsharai u donkam sign i'u ban set kane ka phone. |
| `home.today` | Today | Mynta ka sngi |
| `game.objectHunt.name` | Object Hunt | Ka Jingthoh Bakhuid |
| `game.objectHunt.instruction` | Remember where each picture is hidden. Tap a tile to look. | Da kynmaw hangno la buhrieh ia kaei kaei baroh. Tap ia ka tyllai ban peit. |
| `game.objectHunt.whereWasThe` | Where was the | Haei ka don? |
| `game.objectHunt.rememberThis` | Remember this picture | Kynmaw iakane ka dur. |
| `game.wordStream.instruction` | Remember these things. We will ask you later. | To kynmaw ïa kine kiei kiei. Ngin kylli iaphi hadien. |
| `game.wordStream.rememberLater` | Remember these for later. | To kynmaw ia kine kiei kiei hadien. |
| `game.wordStream.okRemember` | OK, I remember! | Ok, nga kynmaw! |
| `game.wordStream.whichItems` | Which items did we show you? | Ngi la pyn-i ia kiei kiei. |
| `game.wordStream.imDone` | I am done! | Nga Lah Leh! |
| `game.quickTap.name` | Quick Tap | Wut wut. |
| `game.quickTap.instruction` | Tap the picture as soon as you see it. | Tap ia ka dur kumba phi ïohi. |
| `game.quickTap.targetIs` | Tap this picture: | Tap ia kane ka dur. |
| `game.pathMatch.name` | Path Match | Ka Lynti Ka Match |
| `game.pathMatch.instruction` | Join the numbers in order, from 1 onwards. | Ïasoh bad ki jingbun ki dkhot ha ka kyrdon kaba nyngkong; |
| `game.pathMatch.good` | Good! | Bha bha! |
| `game.memoryMatch.name` | Memory Match | Ka Memori Balei |
| `game.memoryMatch.instruction` | Tap two cards. If they match, they stay open. | To tap ar tylli ki kot. Lada ki pyndait lang ïa ki, kin plie. |
| `game.memoryMatch.tryAnotherOne` | Let's try another one | To pyrshang biang sa uwei. |
| `game.memoryBlocks.name` | Memory Blocks | Block jingmut |
| `game.frogLeap.name` | Frog Leap | Kynthih ia u shñiuh |
| `game.countingBoxes.name` | Counting Boxes | Kheiñ ki iit. |
| `game.nBack.name` | N-Back | Phai shadien. |
| `game.largerNumber.name` | Larger Number | Ka jingkhraw jong |
| `game.memorySpan.name` | Memory Span | Ka Jingpynkynmaw |
| `game.fishTrace.name` | Fish Trace | Ka dohkha. |
| `game.doubleDecision.name` | Double Decision | Ka Jingbishar kaba ar |
| `game.reminiscenceQuiz.name` | Family & Life Quiz | Ka Khubor Babha Na U Blei Badonbor Baroh |
| `game.reminiscenceQuiz.noQuiz` | The quiz needs at least 3 people or memories in the Memory Book. Ask your caregiver to add them. | Ka donkam tang kumba 3 ngut ki rangbah lane bun ngut ki mynsiem ha ka kot lyngkdop. Kylli na u nongpeit phatok ban pynïasoh ia ki. |
| `game.reminiscenceQuiz.whoIsThis` | Who is this? | Kane dei mano? |
| `game.correct` | Correct! | Biang! |
| `game.tryAgain` | Try again | Leh biang. |
| `game.sessionComplete` | Well done! You finished today's session. | Bha bha! Phi lah dep kamisam mynta. |
| `game.stars` | Stars earned | Ki khlur ki ïohnong. |
| `game.sessionEnd.star5` | Perfect! Wonderful work today! | Biang! Ka kam bhabriew mynta! |
| `game.sessionEnd.star4` | Excellent! You are doing great! | Tynnad! Me leh bniah bha! |
| `game.sessionEnd.star3` | Great job today! Keep it up! | Kaba itynnad mynta ka sngi! Ïeng khop! |
| `game.sessionEnd.star2` | Good effort! Every session helps. | Trei bha! Baroh session ka iarap. |
| `game.sessionEnd.star1` | Well done for trying! Each day gets better. | Ka best ban leh iakata! Ka kham bha man ka sngi. |
| `game.backToHome` | Back to home | Nangta ki leit phai sha ïing. |
| `game.start` | Start! | Sdang! |
| `game.anotherRound` | Play again | To leh biang. |
| `game.keepGoing` | Keep going | Ïai leh. |
| `game.finishSession` | Finish for now | Lah dep. |
| `game.routineRecall.name` | Routine Recall | Rakhe lypa. |
| `game.routineRecall.loading` | Getting today's routine ready… | To pynkloi mynta ka sngi. |
| `game.routineRecall.notEnough` | Not enough reminders done yet today | Ym pat leh klet kumno mynta ka sngi. |
| `game.routineRecall.comeBack` | Come back after a few more reminders are done today. | To wan phai mynta, bad phin sa sngewthuh sa katto katne ki jingpynkynmaw. |
| `game.routineRecall.instruction` | Tap them in the order you did them today | Sumar bad lehhok ïa ki, kumba phi la leh ha kane ka sngi; |
| `game.routineRecall.correct` | Wonderful! That is exactly how today went. | Bha bha! Kata kadei kaba la jia mynta ka sngi. |
| `game.routineRecall.remember` | Let's remember together. | To ngin kynmaw lang. |
| `game.encourage.1.0` | You're learning! Keep trying. | Phi nang! Ïai pyrshang. |
| `game.encourage.1.1` | That's alright, let's try again. | Ka biang, ngi dei ban pyrshang biang. |
| `game.encourage.1.2` | Keep going, you can do it. | Ïai leh, me lah ban leh. |
| `game.encourage.2.0` | Good try! You're getting there. | Pyrshang bha! Phi wan hangne. |
| `game.encourage.2.1` | Almost there! | Don hangne! |
| `game.encourage.2.2` | You're improving! | Me khih! |
| `game.encourage.3.0` | Nice work! | Trei bha! |
| `game.encourage.3.1` | Well done! | Bha bha! |
| `game.encourage.3.2` | You're doing great! | Me leh bniah bha! |
| `game.encourage.4.0` | Great job! | Bha bha ka jingtrei! |
| `game.encourage.4.1` | Excellent work! | Trei bha! |
| `game.encourage.4.2` | Fantastic effort! | Tynjuh bha! |
| `game.encourage.5.0` | Wonderful! You remembered everything! | Bha bha! Pha kynmaw ia kiei kiei baroh! |
| `game.encourage.5.1` | Perfect memory! | Tip bha! |
| `game.encourage.5.2` | Amazing! Every one correct! | Ka jingsngewtynnad! Baroh kidei! |
| `game.celebrate.0` | Hooray! You did it! | Ho! Phi leh ia kato! |
| `game.celebrate.1` | Wonderful! Session complete! | Ka jingsngewtynnad! Ka kamram ka la kut! |
| `game.celebrate.2` | Well played! Great to see you today! | Ryngkat bha! Bha bha iaphi mynta ka sngi. |
| `game.tutorial.howToPlay` | How to play | Kumno ban lehkai |
| `game.tutorial.title` | How to play | Kumno ban lehkai |
| `game.tutorial.next` | Next | Hadien |
| `game.tutorial.back` | Back | Phai shadien. |
| `game.tutorial.gotIt` | Got it, let's play! | Ale, ngin lehkai! |
| `game.tutorial.quickTap.step1` | First you see one picture. Remember it — this is the picture to catch. | Phi dei ban peit shisha kawei ka dur. Kynmaw iakane-kane ka dei ka dur ban sngewtynnad iaka. |
| `game.tutorial.quickTap.step2` | Then pictures appear one at a time in the middle of the screen. | Nangta ki dur khyllah ki paw ha kawei ka sien hapoh ka skul. |
| `game.tutorial.quickTap.step3` | When you see your picture, tap the screen quickly. | Haba phi peit ka durkhmat jongphi, tap kloi ïa kato ka lyngkhot jaiñ. |
| `game.tutorial.quickTap.step4` | For any other picture, don't tap. Tapping other pictures takes points away. | To tap ia ka dur na kawei pat, wat ju tap ia kato. To tap ia ki dur kiwei pat, ki lah ban pynphai sha ki dur. |
| `game.tutorial.pathMatch.step1` | Numbered circles are spread across the screen. | Ki thup kyrdon kiba ïarap ki saphriang kylleng ka jingtap. |
| `game.tutorial.pathMatch.step2` | Tap circle 1, then circle 2. A line joins them. | U Toi u bteng, ïa ka lyngkor jong ka Ïingjaiñ, nangta ïa ka jingker jong ka arliang. |
| `game.tutorial.pathMatch.step3` | Keep going in order — 3, 4, 5 — until every circle is joined. | To ïaineh skhem haduh ba yn kha ïa ki — 3, 4, 5 bad ïa ka kynhun shipai jong uwei pa uwei na phi. |
| `game.tutorial.pathMatch.step4` | In higher levels there is a timer. Take your time; accuracy matters most. | Ki jaitbynriew kiba don halor ka kam ki long kum ki diengthang. Ka ïadei bad ka por; ka long kaba donkam bha, bad kaei kaba donkam ka long kaba dei. |
| `game.tutorial.countingBoxes.step1` | A stack of boxes appears for a few seconds. | Ki pla kynshew ki paw na bynta katto-katne minit. |
| `game.tutorial.countingBoxes.step2` | Count every box, including the ones stacked behind or on top. | Kheiñ ia kita ki shalyntem, kawei nadien kawei bad kawei pat halor. |
| `game.tutorial.countingBoxes.step3` | When the boxes disappear, enter how many you counted. | Haba ki dabor ki la jah, thoh katno phi la dep lum. |
| `game.tutorial.iAmReady` | I'm ready! | Nga La Pynkhreh! |
| `game.tile` | Tile {n} | {n} ka lyngkor |
| `game.card` | Card {n} | Kot {n} |
| `game.pathPuzzle` | Path connecting puzzle | Ka lynti kaba kdew ia ka lynti kaba iahap. |
| `caregiver.dashboard` | Dashboard | Ka kali ïapom |
| `caregiver.patients` | Patients | Kito kiba pang |
| `caregiver.alerts` | Alerts | To shahshkor bha! |
| `caregiver.lastSynced` | Last synced | Uba khatduh u don lang. |
| `caregiver.syncNow` | Sync now | Pynjai jai. |
| `sync.synced` | Synced | La synreit ha u |
| `sync.syncing` | Syncing | Shukor. |
| `sync.pending` | Waiting to sync | Ap ia ka synduk. |
| `sync.notSyncedYet` | Not synced yet | Ym pat ju kynjah lut. |
| `common.back` | Back | Phai shadien. |
| `common.goBack` | Go back | Khie noh. |
| `common.cancel` | Cancel | Sangeh. |
| `common.loading` | Loading | Boi. |
| `common.close` | Close | Wat wit. |
| `common.somethingWrong` | Something went wrong. Let us go back home. | Kaei re kaei kaba jia. Ngi dei ban leit phai sha ïing. |
| `common.goHome` | Go home | Khie leit mynta sha ïing. |
| `common.chooseLanguage` | Choose language | Jied ia ka ktien. |
| `companion.title` | Ask Smriti | Kylli na U Mynsiem jong nga. |
| `companion.askMeSomething` | Ask me something | Kylli ianga kawei ka jingkylli. |
| `companion.listening` | Listening… | Sngap.. |
| `companion.thinking` | Thinking… | Tip. |
| `companion.askQuestion` | Ask a question | Kylli jingkylli ianga. |
| `companion.stopAsking` | Stop asking | Wat kylli. |
| `companion.tapAndSpeak` | Tap and speak | To khynñiuh bad to kren. |
| `companion.tapWhenFinished` | Tap when you finish | Tap ia ka por ba phin sdang. |
| `companion.typeQuestion` | Type your question | Thoh ia ka jingkylli jong phi. |
| `companion.ask` | Ask | Kylli |
| `companion.youAsked` | You asked | Phi Kylli |
| `companion.aiAnswer` | AI-generated answer | Ka AI-la pynmih jubab |
| `companion.fromEarlier` | From earlier | Naduh mynshuwa |
| `companion.askAgain` | Ask again | Kylli biang. |
| `companion.fromMemoryBook` | From your memory book | Na ka kot kynmaw jongphi |
| `companion.consentNeeded` | Ask Smriti is not turned on. Your caregiver can turn it on in Settings. | To pan ba ki jingmaham kim don ei ei, bad u nongpeit phatok un sa pdiang ïa ki ha ka rukom kaba dei. |
| `companion.typeInstead` | Type instead | Typia nalor |
| `companion.speakInstead` | Speak instead | Kren nalor kaba dei. |
| `companion.micUnavailable` | The microphone could not be used. You can type your question. | Ka microphone kam lah ban pyndonkam. Phi lah ban thoh ia ka jingkylli jong phi. |
| `companion.conversation` | Conversation with Smriti | Kren bad ka Smriti: |
| `companion.you` | You | Me |
| `companion.smriti` | Smriti | Kynmaw |
| `companion.tapToReply` | Tap to reply | Tap ia ka jubab. |
| `companion.newConversation` | Start a new conversation | Sdang ka jingïakren kaba thymmai. |
| `companion.didNotHear` | I didn't catch that. Please tap and say it again. | Nga khlem ktah ia kato. Sngewbha tap biang ia u. |
| `family.messagesTitle` | Messages from family | Khubor na ïng ka sem |
| `family.seen` | Seen | La ïohi ïa kane. |

Left in English: `home.notYou`, `home.caregiverLogin`, `game.wordStream.name`, `game.quickTap.itemOf`, `game.quickTap.hits`, `game.pathMatch.pointOf`, `game.pathMatch.connected`, `game.memoryMatch.goodMatch`, `game.memoryMatch.progress`, `game.memoryMatch.done`, `game.reminiscenceQuiz.whoIsYour`, `game.reminiscenceQuiz.whichIsAbout`, `game.outOfCorrect`, `game.starsLabel`, `game.routineRecall.placed`, `game.extraTaps`, `game.tutorial.stepOf`, `sync.offline`, `sync.lastOn`, `family.from`

## Mizo (lus), service `bhashini/iiith/nmt-all`

| Key | English | Machine translation |
|---|---|---|
| `home.tapYourName` | Tap your name. | A hming lam hawi lamah ka insiam a. |
| `home.chooseWhoTitle` | Choose who uses this phone | He phone hi hmeichhiate chuan an hmang a. |
| `home.chooseWhoBody` | A caregiver needs to pick the person, or people, who will play on this phone. | Caregiver chuan he phone-a khelh tur hi mi emaw, a nih loh leh a nih loh tur a ni. |
| `home.startSession` | Start Playing | khelh ṭan suh. |
| `home.myProgress` | My progress | Ka hmasawnna. |
| `home.streakCount` | day streak | Nimahsela. |
| `home.askSmriti` | Ask Smriti | Smriti chu han ngen ang che. |
| `home.chooseGame` | Choose a game | Game অমা thlang la. |
| `home.forgotPin` | Forgot PIN? | Pin chu ka hre lo em? |
| `home.messageForYou` | A message for you | Message i la theh lutuk. |
| `home.noPatientTitle` | Nobody is set up on this phone | He phone-ah hian mi tam tak a awm lo. |
| `home.today` | Today | Today's |
| `game.objectHunt.instruction` | Remember where each picture is hidden. Tap a tile to look. | Photography phei hi ka hmun a ni tih hre reng ang che. |
| `game.objectHunt.whereWasThe` | Where was the | Kewah chu? |
| `game.objectHunt.rememberThis` | Remember this picture | He image hi mima. |
| `game.wordStream.instruction` | Remember these things. We will ask you later. | Heng thingte hi chhinchhiah i la. Nangta keinin ka zingawi ang? |
| `game.wordStream.rememberLater` | Remember these for later. | Hengte hi hnu laia tiin ka hre chhuak ang. |
| `game.wordStream.whichItems` | Which items did we show you? | Kaei Item tih chu kan hawng a? |
| `game.wordStream.imDone` | I am done! | A lo hawng leh ta! |
| `game.quickTap.name` | Quick Tap | Tap nghal rawh. |
| `game.quickTap.instruction` | Tap the picture as soon as you see it. | I thlawhmun apiang chu i la thlawm ang. |
| `game.quickTap.targetIs` | Tap this picture: | He image hi tap: |
| `game.pathMatch.name` | Path Match | kawng inkhelhna |
| `game.pathMatch.good` | Good! | Faktu! |
| `game.memoryMatch.instruction` | Tap two cards. If they match, they stay open. | Card pahnih khar a, an inkhelh chuan an inkhar a. |
| `game.memoryMatch.goodMatch` | Good match | Match ṭha tak a ni. |
| `game.memoryMatch.tryAnotherOne` | Let's try another one | A dang pakhat kan tynjuh bawk. |
| `game.memoryMatch.progress` | {count} of {total} pairs found | {count} of {total} pair hmuh a ni |
| `game.memoryMatch.done` | All {total} pairs found! | Pair zawng zawng {total} hmuh a ni. |
| `game.largerNumber.name` | Larger Number | A tam zawk. |
| `game.reminiscenceQuiz.noQuiz` | The quiz needs at least 3 people or memories in the Memory Book. Ask your caregiver to add them. | Quiz chuan memory book-a mi 3 emaw memories emaw tam ber a ngai a, a enkawltu hnenah an dah belh turin a ngen. |
| `game.reminiscenceQuiz.whoIsThis` | Who is this? | Hei hi tu nge? |
| `game.correct` | Correct! | Right! |
| `game.tryAgain` | Try again | Try leh sauh. |
| `game.sessionEnd.star2` | Good effort! Every session helps. | Fakin tharai! Inkhelhnain a tul ang. |
| `game.sessionEnd.star1` | Well done for trying! Each day gets better. | Fakin fakin fakin fakin fakin fakin fakin fakin! |
| `game.backToHome` | Back to home | Kuminah chuan kuminah chuan |
| `game.keepGoing` | Keep going | Kal kal chhunzawm zel |
| `game.finishSession` | Finish for now | Tunah chuan tihtawp kar sa. |
| `game.routineRecall.loading` | Getting today's routine ready… | Today’s Routine Timing |
| `game.routineRecall.notEnough` | Not enough reminders done yet today | Vawiinah pawh hriattirna tam tak a awm lo. |
| `game.routineRecall.comeBack` | Come back after a few more reminders are done today. | Vawiin khan hriattirna engemaw zat neih hnuah haw phai. |
| `game.routineRecall.instruction` | Tap them in the order you did them today | Chutichuan, tuna i tih ang chiah hi ka inpek a ni. |
| `game.routineRecall.correct` | Wonderful! That is exactly how today went. | Amazing! Chutiang bawkin, tun ni hian kan tâwk a. |
| `game.routineRecall.remember` | Let's remember together. | Khawngaihin han ngaihtuah teh. |
| `game.encourage.1.0` | You're learning! Keep trying. | You’re learning! Trei reng rawh. |
| `game.encourage.1.1` | That's alright, let's try again. | Chutiang bawk chu a ṭha tak zet a ni. |
| `game.encourage.1.2` | Keep going, you can do it. | chhunzawm pate, i ti thei. |
| `game.encourage.2.0` | Good try! You're getting there. | Mak tak ka beisei! You're there! |
| `game.encourage.2.1` | Almost there! | Chutah chuan! |
| `game.encourage.2.2` | You're improving! | You’re improving! |
| `game.encourage.3.0` | Nice work! | Hnathawh ṭha tak! |
| `game.encourage.3.1` | Well done! | Fakkim ka hle! |
| `game.encourage.4.0` | Great job! | Ka hlawh lutuk! |
| `game.encourage.4.1` | Excellent work! | Thawk tha takin hna a thawk! |
| `game.encourage.4.2` | Fantastic effort! | Faktu nasa takin! |
| `game.encourage.5.1` | Perfect memory! | Kynmaw thianghlim! |
| `game.encourage.5.2` | Amazing! Every one correct! | Amazing! Everyone is right! |
| `game.celebrate.2` | Well played! Great to see you today! | Fakin Fakin Fakin Fakin Fakin Fakin! |
| `game.tutorial.next` | Next | A hnu lama. |
| `game.tutorial.back` | Back | Kawngah. |
| `game.tutorial.quickTap.step3` | When you see your picture, tap the screen quickly. | I thlawhchhiat chuan i thlawhchhiat chuan i thlawhchhiat ang. |
| `game.tutorial.quickTap.step4` | For any other picture, don't tap. Tapping other pictures takes points away. | Photo dang eng pawh tap suh. Photo dang eng pawh tap suh. |
| `game.tutorial.pathMatch.step2` | Tap circle 1, then circle 2. A line joins them. | Round 1, then round 2. A line chu an inzawm tlat a. |
| `game.tutorial.pathMatch.step3` | Keep going in order — 3, 4, 5 — until every circle is joined. | 3, 4, 5-te chu karawn hrang hranga kaltlangin chhunzawm zel a ni. |
| `game.tutorial.pathMatch.step4` | In higher levels there is a timer. Take your time; accuracy matters most. | Higher level-ah chuan timer a awm a, a hun takah chuan accuracy a pawimawh hle. |
| `game.tutorial.countingBoxes.step2` | Count every box, including the ones stacked behind or on top. | chutah chuan box zawng zawng chu a hnuhnung emaw, a chung lam emaw a ni. |
| `game.tutorial.countingBoxes.step3` | When the boxes disappear, enter how many you counted. | Boxes an lo awm tawh chuan, you've entered the number of counts. |
| `caregiver.lastSynced` | Last synced | A tawp berah chuan |
| `caregiver.syncNow` | Sync now | tunah chuan synchronize. |
| `sync.pending` | Waiting to sync | Sync turin a nghak |
| `sync.notSyncedYet` | Not synced yet | A la inpe tawh lo. |
| `common.back` | Back | Kawngah. |
| `common.goBack` | Go back | Kuminah chuan kut thumah a ding. |
| `common.somethingWrong` | Something went wrong. Let us go back home. | Either way, something went wrong. Home ka la ka lo niang. |
| `common.goHome` | Go home | Kuminah chuan kuminah chuan kuminah chuan kuminah chuan |
| `common.chooseLanguage` | Choose language | Language thlang la. |
| `companion.title` | Ask Smriti | Smriti chu han ngen ang che. |
| `companion.askMeSomething` | Ask me something | Ani chu i bang la. |
| `companion.listening` | Listening… | Ngaihsak. |
| `companion.thinking` | Thinking… | Nga ngaihtuah teh. |
| `companion.askQuestion` | Ask a question | I zawhna apiangah i la. |
| `companion.stopAsking` | Stop asking | Tiin, i ngaihtuah tawh suh. |
| `companion.tapAndSpeak` | Tap and speak | Tlap leh talkawih. |
| `companion.tapWhenFinished` | Tap when you finish | tihtawp a nih chuan. |
| `companion.typeQuestion` | Type your question | i zawhna chu type sawi rawh. |
| `companion.youAsked` | You asked | A haw, haw, haw, |
| `companion.aiAnswer` | AI-generated answer | AI-in a chhanna a siam |
| `companion.fromEarlier` | From earlier | A tawpah chuan. |
| `companion.askAgain` | Ask again | Angin, i ngaihtuah tur a. |
| `companion.fromMemoryBook` | From your memory book | A Memories Book-ah chuan |
| `companion.typeInstead` | Type instead | Chu ai chuan |
| `companion.speakInstead` | Speak instead | Chu ai chuan ka hrethiam tlat lo. |
| `companion.micUnavailable` | The microphone could not be used. You can type your question. | Microphone hman theih a ni lo. I zawhna chu i type thei a. |
| `companion.conversation` | Conversation with Smriti | Smriti nen inbiakna |
| `companion.you` | You | You're |
| `companion.newConversation` | Start a new conversation | Inbiakna thar ṭanpui |
| `companion.didNotHear` | I didn't catch that. Please tap and say it again. | I la hmuh hi ka hok lo. Please tla leh sa tharai. |
| `family.seen` | Seen | hmuhnung. |

Left in English: `home.whoIsPlaying`, `home.notYou`, `home.caregiver`, `home.greeting`, `home.reminders`, `home.streakStart`, `home.caregiverAccess`, `home.thankYou`, `home.noPatientBody`, `home.caregiverLogin`, `game.objectHunt.name`, `game.wordStream.name`, `game.wordStream.okRemember`, `game.quickTap.itemOf`, `game.quickTap.hits`, `game.pathMatch.instruction`, `game.pathMatch.pointOf`, `game.pathMatch.connected`, `game.memoryMatch.name`, `game.memoryBlocks.name`, `game.frogLeap.name`, `game.countingBoxes.name`, `game.nBack.name`, `game.memorySpan.name`, `game.fishTrace.name`, `game.doubleDecision.name`, `game.reminiscenceQuiz.name`, `game.reminiscenceQuiz.whoIsYour`, `game.reminiscenceQuiz.whichIsAbout`, `game.sessionComplete`, `game.stars`, `game.sessionEnd.star5`, `game.sessionEnd.star4`, `game.sessionEnd.star3`, `game.start`, `game.anotherRound`, `game.outOfCorrect`, `game.starsLabel`, `game.routineRecall.name`, `game.routineRecall.placed`, `game.encourage.3.2`, `game.encourage.5.0`, `game.extraTaps`, `game.celebrate.0`, `game.celebrate.1`, `game.tutorial.howToPlay`, `game.tutorial.title`, `game.tutorial.stepOf`, `game.tutorial.gotIt`, `game.tutorial.quickTap.step1`, `game.tutorial.quickTap.step2`, `game.tutorial.pathMatch.step1`, `game.tutorial.countingBoxes.step1`, `game.tutorial.iAmReady`, `game.tile`, `game.card`, `game.pathPuzzle`, `caregiver.dashboard`, `caregiver.patients`, `caregiver.alerts`, `sync.synced`, `sync.offline`, `sync.syncing`, `sync.lastOn`, `common.cancel`, `common.loading`, `common.close`, `companion.ask`, `companion.consentNeeded`, `companion.smriti`, `companion.tapToReply`, `family.messagesTitle`, `family.from`
