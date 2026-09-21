# Mizo (lus): draft translation, needs a native speaker

**Status: drafted with the Google Translate website and pasted in by hand. No native speaker has checked any line.** Nothing here reaches patients until a reviewer approves it and `apply` is run.

Drafted 139, passed the mechanical checks 110, flagged 29, meaning may have drifted on 24 (round trip below 0.25).

Reviewer: for each row, write `approve`, or replace the draft with the right text, in the last column. "Back to English" is what Google Translate says the draft means: read it against the English column. The round-trip score is a rough word-overlap screen and misses meaning errors, so read every row, not only the marked ones.

| Key | English | Draft | Back to English | Check | Round trip | Reviewer |
|---|---|---|---|---|---|---|
| `home.whoIsPlaying` | Who is playing? | Tu nge khel? | Who's playing? | ok | 0.25 |  |
| `home.tapYourName` | Tap your name. | I hming kha tap rawh. | Tap your name. | blocked-word | 1.00 |  |
| `home.notYou` | Not {name}? | {name} a ni lo em ni? | {name} isn't it? | ok | 0.25 |  |
| `home.chooseWhoTitle` | Choose who uses this phone | He phone hmangtu tur thlang rawh | Select the user of this phone | ok (drifted) | 0.22 |  |
| `home.chooseWhoBody` | A caregiver needs to pick the person, or people, who will play on this phone. | Enkawltu chuan he phone-a khel tur mi, a nih loh leh mi, a thlan a ngai a ni. | The caregiver needs to select the person, or persons, to play on this phone. | ok | 0.63 |  |
| `home.caregiver` | Caregiver | Enkawltu | Management | ok (drifted) | 0.00 |  |
| `home.greeting` | Hello | Chibai | Hello | ok | 1.00 |  |
| `home.startSession` | Start Playing | Playing tan rawh | Start playing | ok | 1.00 |  |
| `home.reminders` | My Reminders | Ka Hriat Nawn Tirna | I Remember You | ok (drifted) | 0.00 |  |
| `home.myProgress` | My progress | Ka hmasawnna | My progress | ok | 1.00 |  |
| `home.streakCount` | day streak | ni khata streak | the streak of the day | ok | 0.50 |  |
| `home.streakStart` | Play today to start a streak | Vawiin hian khel la, streak tan rawh | Play today and start the streak | ok | 0.57 |  |
| `home.askSmriti` | Ask Smriti | Smriti chu zawt rawh | Ask Smriti | ok | 1.00 |  |
| `home.chooseGame` | Choose a game | Game pakhat thlang rawh | Pick a game | ok | 0.33 |  |
| `home.messageForYou` | A message for you | I tan thuchah a ni | It's a message for you | ok | 0.75 |  |
| `home.thankYou` | Thank you! | Ka lawm e! | Thank you! | ok | 1.00 |  |
| `home.noPatientTitle` | Nobody is set up on this phone | He phone ah hian tumah an set up lo | No one is set up on this phone | ok | 0.67 |  |
| `home.noPatientBody` | A caregiver needs to sign in to set up this phone. | He phone set up tur hian caregiver chuan a sign in a ngai a ni. | The caregiver must sign in to set up this phone. | mostly-english | 0.73 |  |
| `home.today` | Today | Vawiin | Today | ok | 1.00 |  |
| `game.objectHunt.name` | Object Hunt | Thil neih zawng zawng (Object Hunt). | Object Hunt. | ok | 1.00 |  |
| `game.objectHunt.instruction` | Remember where each picture is hidden. Tap a tile to look. | Thlalak tin hi khawiah nge an inthup tih hre reng ang che. Tile pakhat tap la, en rawh. | Remember where each photo is hidden. Tap a tile and watch. | blocked-word | 0.54 |  |
| `game.objectHunt.whereWasThe` | Where was the | Khawiah nge a awm | Where is it? | ok (drifted) | 0.20 |  |
| `game.objectHunt.rememberThis` | Remember this picture | He thlalak hi hre reng ang che | Remember this picture | ok | 1.00 |  |
| `game.wordStream.name` | Market List | Market List a ni | Market List | mostly-english | 1.00 |  |
| `game.wordStream.instruction` | Remember these things. We will ask you later. | Hengte hi hre reng ang che. Nakinah kan zawt ang che. | Remember these things. We'll ask you later. | ok | 0.67 |  |
| `game.wordStream.rememberLater` | Remember these for later. | Hengte hi nakin lawkah hre reng ang che. | Remember these in the future. | ok | 0.29 |  |
| `game.wordStream.okRemember` | OK, I remember! | OK, ka hre reng! | OK, I remember! | ok | 1.00 |  |
| `game.wordStream.whichItems` | Which items did we show you? | Eng thil nge kan hmuhtir che? | What have we shown you? | ok (drifted) | 0.22 |  |
| `game.wordStream.imDone` | I am done! | Ka zo ta! | I'm done! | ok | 0.33 |  |
| `game.quickTap.name` | Quick Tap | Quick Tap rawh | Quick Tap on it | blocked-word | 0.50 |  |
| `game.quickTap.instruction` | Tap the picture as soon as you see it. | Thlalak i hmuh veleh tap nghal rawh. | Cry as soon as you see the picture. | blocked-word | 0.67 |  |
| `game.quickTap.targetIs` | Tap this picture: | He thlalak hi tap rawh: | Tap this picture: | blocked-word | 1.00 |  |
| `game.quickTap.itemOf` | Picture {n} of {total} | Thlalak {n} of {total}. | {n} photos of {total}. | mostly-english | 0.50 |  |
| `game.quickTap.hits` | You tapped {count} pictures correctly | Thlalak {count} dik tak i tap a | You tapped the right {count} of pictures | blocked-word | 0.50 |  |
| `game.pathMatch.name` | Path Match | Path Match a ni | It's a Path Match | mostly-english | 0.67 |  |
| `game.pathMatch.instruction` | Join the numbers in order, from 1 onwards. | Number te chu a hnuaia mi ang hian join rawh, 1 atang hian. | Join the numbers in order, starting with 1 . | ok | 0.56 |  |
| `game.pathMatch.good` | Good! | Tha! | Good! | ok | 1.00 |  |
| `game.pathMatch.pointOf` | Number {n} of {total} | {total} atanga {n} zat. | {total} to {n} numbers. | ok (drifted) | 0.20 |  |
| `game.pathMatch.connected` | {count} out of {total} joined | {count} out of {total} a zawm | {count} out of {total} follows | mostly-english | 0.67 |  |
| `game.memoryMatch.name` | Memory Match | Memory Match a ni | It's a Memory Match | mostly-english | 0.67 |  |
| `game.memoryMatch.instruction` | Tap two cards. If they match, they stay open. | Card pahnih tap rawh. An match a nih chuan an inhawng reng. | Tap two cards. If they're a match, they're always open. | blocked-word | 0.60 |  |
| `game.memoryMatch.goodMatch` | Good match | Match tha tak a ni | It was a good match | ok | 0.50 |  |
| `game.memoryMatch.tryAnotherOne` | Let's try another one | A dang i han enchhin leh teh ang | Let's try another one | ok | 1.00 |  |
| `game.memoryMatch.progress` | {count} of {total} pairs found | {count} of {total} pairs hmuhchhuah a ni | {count} of {total} pairs detected | mostly-english | 0.67 |  |
| `game.memoryMatch.done` | All {total} pairs found! | {total} pair zawng zawng hmuh chhuah vek! | {total} all pairs found! | ok | 1.00 |  |
| `game.memoryBlocks.name` | Memory Blocks | Memory Blocks a awm bawk | Memory Blocks | mostly-english | 1.00 |  |
| `game.frogLeap.name` | Frog Leap | Frog Leap a ni | It's Frog Leap | mostly-english | 0.67 |  |
| `game.countingBoxes.name` | Counting Boxes | Counting Box te chu a awm | Counting Boxes | ok | 1.00 |  |
| `game.nBack.name` | N-Back | N-A hnunglam | N-A background | ok (drifted) | 0.00 |  |
| `game.largerNumber.name` | Larger Number | Number lian zawk | Larger numbers | ok | 0.33 |  |
| `game.memorySpan.name` | Memory Span | Hriatrengna Span | Memory Span | mostly-english | 1.00 |  |
| `game.fishTrace.name` | Fish Trace | Nga Trace a awm | There is a Trace of Fish | ok | 0.40 |  |
| `game.doubleDecision.name` | Double Decision | Thutlukna pahnih siam | Making two decisions | ok (drifted) | 0.00 |  |
| `game.reminiscenceQuiz.name` | Family & Life Quiz | Chhungkaw & Nun Quiz | Family & Life Quiz | ok | 1.00 |  |
| `game.reminiscenceQuiz.noQuiz` | The quiz needs at least 3 people or memories in the Memory Book. Ask your caregiver to add them. | Quiz hian mi 3 tal emaw Memory Book-a hriatrengna emaw a mamawh a ni. I enkawltu hnenah chuan anmahni chu add turin hrilh rawh. | The quiz requires at least 3 participants or a memory in the Memory Book. Ask your caregiver to add them. | ok | 0.74 |  |
| `game.reminiscenceQuiz.whoIsThis` | Who is this? | Hei hi tunge? | Who is this? | ok | 1.00 |  |
| `game.reminiscenceQuiz.whoIsYour` | Who is your {relationship}? | I {relationship} chu tu nge ni? | Who is your {relationship}? | ok | 1.00 |  |
| `game.reminiscenceQuiz.whichIsAbout` | Who or what is this about? “{detail}” | Hei hi tu chungchang nge, eng nge ni? "{detail}" | Who and what is this about? "{detail}" | ok | 0.75 |  |
| `game.correct` | Correct! | Dik! | Right! | ok (drifted) | 0.00 |  |
| `game.tryAgain` | Try again | Ti leh teh | Do it again | ok | 0.25 |  |
| `game.sessionComplete` | Well done! You finished today's session. | I ti tha e! Vawiin session chu i zo ta. | Well done! You're done with today's session. | ok | 0.50 |  |
| `game.stars` | Stars earned | Stars a hlawh chhuak | He earned stars | ok | 0.67 |  |
| `game.sessionEnd.star5` | Perfect! Wonderful work today! | Sawisel bo! Vawiin hian hna ropui tak a thawk! | Perfect! He did a great job today! | ok | 0.25 |  |
| `game.sessionEnd.star4` | Excellent! You are doing great! | A tha lutuk! I ti ropui hle mai! | Excellent! You're doing great! | ok | 0.50 |  |
| `game.sessionEnd.star3` | Great job today! Keep it up! | Vawiin hian hna ropui tak a thawk! Ti zel rawh! | He did a great job today! Keep it up! | ok | 0.75 |  |
| `game.sessionEnd.star2` | Good effort! Every session helps. | Thawhrimna tha tak! Session tin hian a pui thin. | Good effort! Every session helps. | ok | 1.00 |  |
| `game.sessionEnd.star1` | Well done for trying! Each day gets better. | I beih avangin i lawm e! Nitin a tha chho zel. | Thank you for trying! It's getting better every day. | ok | 0.31 |  |
| `game.backToHome` | Back to home | In lam pan lehin | On the way home | ok (drifted) | 0.17 |  |
| `game.start` | Start! | Tan! | For! | ok (drifted) | 0.00 |  |
| `game.anotherRound` | Play again | Play leh rawh | Play it again | ok | 0.67 |  |
| `game.keepGoing` | Keep going | Hmasawn zel rawh | Keep moving forward | ok | 0.25 |  |
| `game.finishSession` | Finish for now | Tunah chuan ti zo rawh | Now do it | ok (drifted) | 0.20 |  |
| `game.outOfCorrect` | {count} out of {total} correct | {count} out of {total} dik tak | {count} out of {total} exactly | mostly-english | 0.67 |  |
| `game.starsLabel` | {count} of 5 stars | {count} chu arsi 5 a ni | {count} is 5 stars | ok | 0.50 |  |
| `game.routineRecall.name` | Routine Recall | Routine Recall tih hi a ni | Routine Recall | mostly-english | 1.00 |  |
| `game.routineRecall.loading` | Getting today's routine ready… | Vawiin kan tih dan tur inbuatsaih... | Preparing for today's. | ok (drifted) | 0.17 |  |
| `game.routineRecall.notEnough` | Not enough reminders done yet today | Vawiin hian hriattirna tih a la tling lo | Today, it is not enough to announce | ok | 0.30 |  |
| `game.routineRecall.comeBack` | Come back after a few more reminders are done today. | Vawiin hian hriattirna tlemte tih belh a nih hnuah lo kir leh rawh. | Come back today with a few additional reminders. | ok | 0.45 |  |
| `game.routineRecall.instruction` | Tap them in the order you did them today | Vawiin a i tih dan tur angin tap rawh | Cry as you would today | blocked-word | 0.18 |  |
| `game.routineRecall.placed` | {count} of {total} placed | {count} of {total} dah a ni | {count} of {total} stored | ok | 0.60 |  |
| `game.routineRecall.correct` | Wonderful! That is exactly how today went. | Duhawm! Chutiang chiah chuan vawiin chu a kal ta a ni. | Cute! That's exactly how today went. | ok | 0.44 |  |
| `game.routineRecall.remember` | Let's remember together. | I hre reng ang u. | Let's remember. | ok | 0.67 |  |
| `game.encourage.1.0` | You're learning! Keep trying. | I zir chhuak ta! Bei chhunzawm zel rawh. | You've learned! Keep trying. | ok | 0.33 |  |
| `game.encourage.1.1` | That's alright, let's try again. | Chu chu a tha e, han tum leh teh ang. | That's fine, let's try again. | ok | 0.67 |  |
| `game.encourage.1.2` | Keep going, you can do it. | Kal zel rawh, i ti thei ang. | Keep going, you can. | ok | 0.67 |  |
| `game.encourage.2.0` | Good try! You're getting there. | Tha takin enchhin rawh! I thleng dawn ta. | Try it out! I'm about to arrive. | ok (drifted) | 0.09 |  |
| `game.encourage.2.1` | Almost there! | Chutah chuan a awm tawh mai! | It's almost there! | ok | 0.67 |  |
| `game.encourage.2.2` | You're improving! | I hmasawn chho zel a ni! | You are making progress! | ok (drifted) | 0.00 |  |
| `game.encourage.3.0` | Nice work! | Hnathawh nuam tak! | Enjoyable work! | ok | 0.33 |  |
| `game.encourage.3.1` | Well done! | I ti tha e! | Well done! | ok | 1.00 |  |
| `game.encourage.3.2` | You're doing great! | I ti ropui hle mai! | You're doing great! | ok | 1.00 |  |
| `game.encourage.4.0` | Great job! | Hna ropui tak a ni! | It's a great job! | ok | 0.67 |  |
| `game.encourage.4.1` | Excellent work! | Hnathawh tha tak a ni! | It's a good job! | ok (drifted) | 0.00 |  |
| `game.encourage.4.2` | Fantastic effort! | Thawhrimna ropui tak! | Great effort! | ok | 0.33 |  |
| `game.encourage.5.0` | Wonderful! You remembered everything! | Duhawm! Engkim i hrechhuak vek! | Cute! You remember everything! | ok | 0.33 |  |
| `game.encourage.5.1` | Perfect memory! | Hriatrengna ṭha famkim! | The perfect memory! | ok | 0.67 |  |
| `game.encourage.5.2` | Amazing! Every one correct! | Mak! Mi zawng zawng dik! | Weird! Everyone's right! | ok (drifted) | 0.00 |  |
| `game.extraTaps` | {count} extra taps on other pictures | Thlalak dang ah {count} extra taps a awm | There are {count} extra taps in the next picture | blocked-word | 0.25 |  |
| `game.celebrate.0` | Hooray! You did it! | Hooray a ni! I ti ta a ni! | Hooray for it! I'm sorry! | ok | 0.29 |  |
| `game.celebrate.1` | Wonderful! Session complete! | Duhawm! Session a zo tawh! | Cute! The session is over! | ok (drifted) | 0.14 |  |
| `game.celebrate.2` | Well played! Great to see you today! | A khel tha hle mai! Vawiin hian kan hmu che hi a ropui hle! | He played very well! Great to see you today! | ok | 0.78 |  |
| `game.tutorial.howToPlay` | How to play | Inkhelh dan tur | The rules of the game | ok (drifted) | 0.00 |  |
| `game.tutorial.title` | How to play | Inkhelh dan tur | The rules of the game | ok (drifted) | 0.00 |  |
| `game.tutorial.stepOf` | Step {n} of {total} | Step {n} chu {total} a ni. | The {n} steps are {total}. | ok (drifted) | 0.17 |  |
| `game.tutorial.next` | Next | Dawtchiah | Next | ok | 1.00 |  |
| `game.tutorial.back` | Back | Hnung | Back | ok | 1.00 |  |
| `game.tutorial.gotIt` | Got it, let's play! | Got it, i khel ang u! | Got it, let's play! | mostly-english | 1.00 |  |
| `game.tutorial.quickTap.step1` | First you see one picture. Remember it — this is the picture to catch. | A hmasa berin thlalak pakhat i hmu a. Hriat reng tur — hei hi thlalak man tur chu a ni. | First you see a picture. Remember — this is what the photo costs. | ok | 0.53 |  |
| `game.tutorial.quickTap.step2` | Then pictures appear one at a time in the middle of the screen. | Tichuan screen lai takah thlalak pakhat hnu pakhatin a rawn lang ta a. | Then one image after another appeared in the middle of the screen. | ok | 0.47 |  |
| `game.tutorial.quickTap.step3` | When you see your picture, tap the screen quickly. | I thlalak i hmuh chuan screen kha tap vat rawh. | When you see your picture, quickly tap the screen. | blocked-word | 1.00 |  |
| `game.tutorial.quickTap.step4` | For any other picture, don't tap. Tapping other pictures takes points away. | Thlalak dang eng pawh tan chuan tap suh. Thlalak dang tap hian point a la bo thin. | Don't cry for any other picture. Tapping another picture takes away points. | blocked-word | 0.69 |  |
| `game.tutorial.pathMatch.step1` | Numbered circles are spread across the screen. | Numbered circle te chu screen ah hian a inzar pharh a. | Numbered circles extend across the screen. | ok | 0.63 |  |
| `game.tutorial.pathMatch.step2` | Tap circle 1, then circle 2. A line joins them. | Circle 1 kha tap la, chutah chuan circle 2. Line pakhatin a inzawm khawm leh a. | Tap circle 1, then circle 2. A line connects again. | blocked-word | 0.50 |  |
| `game.tutorial.pathMatch.step3` | Keep going in order — 3, 4, 5 — until every circle is joined. | Circle tin a inzawm vek hma loh chuan a hnuaia mi ang hian kal zel rawh — 3, 4, 5 —. | Continue in order — 3, 4, 5 — until each circle is connected. | ok | 0.42 |  |
| `game.tutorial.pathMatch.step4` | In higher levels there is a timer. Take your time; accuracy matters most. | Level sang zawkah chuan timer a awm. I hun hmang la; dikna hi a pawimawh ber. | Higher levels have a timer. Take your time; accuracy is the most important thing. | ok | 0.56 |  |
| `game.tutorial.countingBoxes.step1` | A stack of boxes appears for a few seconds. | Second tlemte chhung chu box stack a rawn lang a. | A stack of boxes appeared for a few seconds. | ok | 0.75 |  |
| `game.tutorial.countingBoxes.step2` | Count every box, including the ones stacked behind or on top. | Box tin chhiar la, a hnung lamah emaw, a chungah emaw dah khawm te pawh chhiar tel bawk ang che. | Count each box, including those stacked on the back or top. | ok | 0.57 |  |
| `game.tutorial.countingBoxes.step3` | When the boxes disappear, enter how many you counted. | Box te a bo chuan engzat nge i chhiar tih ziak rawh. | If the boxes are missing, write down how many you read. | ok | 0.33 |  |
| `game.tutorial.iAmReady` | I'm ready! | Ka inpeih tawh! | I'm ready! | ok | 1.00 |  |
| `game.tile` | Tile {n} | Tile {n} tih a ni. | Tiles {n} are called. | ok (drifted) | 0.00 |  |
| `game.card` | Card {n} | Card {n} tih a ni. | Cards {n} are called. | ok (drifted) | 0.00 |  |
| `game.pathPuzzle` | Path connecting puzzle | Kawng inzawm puzzle | The puzzle of connecting paths | ok | 0.33 |  |
| `sync.synced` | Synced | Synced a ni | It's synced | mostly-english | 0.50 |  |
| `sync.offline` | Offline | Offline a ni | It's offline | mostly-english | 0.50 |  |
| `sync.syncing` | Syncing | Syncing a ni | It's syncing | mostly-english | 0.50 |  |
| `sync.pending` | Waiting to sync | Sync tur nghah a ni | Waiting for sync | ok | 0.50 |  |
| `sync.notSyncedYet` | Not synced yet | Synced a la ni lo | It has not been synced yet | ok | 0.50 |  |
| `sync.lastOn` | · last {date} | · hnuhnung ber {date}. | · last {date}. | ok | 1.00 |  |
| `common.back` | Back | Hnung | Back | ok | 1.00 |  |
| `common.goBack` | Go back | Haw leh rawh | Haw and come back | ok (drifted) | 0.20 |  |
| `common.cancel` | Cancel | Titawp | Cancel | ok | 1.00 |  |
| `common.loading` | Loading | Loading a ni | Loading is not available | mostly-english | 0.25 |  |
| `common.close` | Close | Khar | Close | ok | 1.00 |  |
| `common.somethingWrong` | Something went wrong. Let us go back home. | Thil engemaw a kal sual a. In lamah i haw leh ang u. | Something went wrong. Let's go home. | ok | 0.56 |  |
| `common.goHome` | Go home | In lamah haw rawh | Go home | ok | 1.00 |  |
| `common.chooseLanguage` | Choose language | Ṭawng thlang rawh | Select the language | ok | 0.25 |  |
| `family.messagesTitle` | Messages from family | Chhungte hnen atanga thuchah | Message from the family | ok | 0.40 |  |
| `family.from` | From {name} | {name} atang hian. | From {name}. | ok | 1.00 |  |
| `family.seen` | Seen | Hmu tawh | Seen | ok | 1.00 |  |

Never drafted, stays English until a reviewer supplies it (medicine, appointment, PIN, distress, sign-in, disclaimer): 104 strings.
