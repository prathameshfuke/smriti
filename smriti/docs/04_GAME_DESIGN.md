# SMRITI — Game Design & Adaptive Difficulty Specification

---

## 1. Design Philosophy

Every game in SMRITI is reverse-engineered from a clinically validated neuropsychological assessment, adapted with NER-specific cultural imagery, and playable by a 70-year-old with no prior smartphone experience.

**Three rules that override everything else:**
1. **No game should ever make the patient feel stupid.** Difficulty floors exist. Encouraging audio plays on every attempt, not just correct ones.
2. **Every game must be playable without reading a single word.** Instructions are delivered via animated demo + audio narration.
3. **Every game must be completable in 2-4 minutes.** A full session is 3-4 games = 10-15 minutes total.

---

## 2. Game Specifications

### Game 1: Kotha Khoj (Object Hunt) — Episodic Memory
**Clinical basis:** CANTAB Paired Associates Learning (PAL)

**Mechanic:**
1. A grid of 2x2 (easiest) to 4x3 (hardest) "doors" appears
2. Doors open one by one, each revealing a culturally familiar NER object (gamosa, jaapi hat, bamboo basket, mekhela chador, dhol, xorai, tamul-paan, one-horned rhino)
3. All doors close
4. A target object appears in the center: "Where was this?"
5. Patient taps the door they think contained it
6. Correct: door opens with a satisfying animation + encouraging audio
7. Wrong: correct door briefly highlights, no negative sound — just "try the next one"

**Difficulty levels (1-10):**
| Level | Grid Size | Objects to Remember | Reveal Duration |
|-------|-----------|---------------------|-----------------|
| 1 | 2x2 (4) | 2 | 3 seconds each |
| 2 | 2x2 (4) | 3 | 3 seconds each |
| 3 | 2x2 (4) | 4 | 2.5 seconds each |
| 4 | 2x3 (6) | 3 | 2.5 seconds each |
| 5 | 2x3 (6) | 4 | 2 seconds each |
| 6 | 2x3 (6) | 6 | 2 seconds each |
| 7 | 3x3 (9) | 4 | 2 seconds each |
| 8 | 3x3 (9) | 6 | 1.5 seconds each |
| 9 | 3x4 (12) | 6 | 1.5 seconds each |
| 10 | 3x4 (12) | 8 | 1 second each |

**Telemetry captured per round:**
- Which objects shown, which locations
- Target object, selected location, correct location
- Response time (ms from target shown to tap)
- Correct/incorrect

**Image assets needed:** ~30 NER-cultural object illustrations (flat, high-contrast, no small details)

---

### Game 2: Xobdo Xuwori (Word Stream) — Delayed Recall
**Clinical basis:** MoCA Delayed Recall + LASI-DAD word-list recall protocol

**Mechanic:**
1. At session start (before any games), 3-5 culturally familiar items are shown with audio names (e.g., "Rice," "Fish," "Banana," "Gamosa," "Tea" in Assamese)
2. Patient plays other games for 5-10 minutes
3. At session end, the recall game launches: "Which items did we show you at the start?"
4. A grid of 8-12 items appears (including the originals + distractors)
5. Patient taps the ones they remember
6. Scoring: hits, misses, false alarms

**Difficulty levels (1-6):**
| Level | Items to Remember | Distractors | Delay Duration |
|-------|-------------------|-------------|----------------|
| 1 | 3 | 3 (total grid: 6) | ~5 minutes |
| 2 | 3 | 5 (total grid: 8) | ~8 minutes |
| 3 | 4 | 4 (total grid: 8) | ~8 minutes |
| 4 | 4 | 6 (total grid: 10) | ~10 minutes |
| 5 | 5 | 5 (total grid: 10) | ~10 minutes |
| 6 | 5 | 7 (total grid: 12) | ~12 minutes |

**Telemetry:** Items shown, items selected, hits, misses, false alarms, delay duration, response time per selection

---

### Game 3: Beg Beg (Quick Quick) — Processing Speed & Attention
**Clinical basis:** BrainHQ Double Decision / CANTAB Rapid Visual Processing (RVP)

**Mechanic:**
1. Objects flash on screen one at a time (fish, bird, flower, fruit, etc.)
2. Patient must tap ONLY when the target object appears (e.g., "Tap when you see the FISH")
3. Target announced via audio + shown as reference in corner
4. Non-targets must be ignored (inhibition)
5. Round = 20 items, ~6-8 are targets

**Difficulty levels (1-8):**
| Level | Display Duration | Items/Round | Target % | Distractor Similarity |
|-------|-----------------|-------------|----------|----------------------|
| 1 | 2000ms | 15 | 40% | Very different |
| 2 | 1500ms | 15 | 40% | Very different |
| 3 | 1500ms | 20 | 35% | Moderate |
| 4 | 1200ms | 20 | 35% | Moderate |
| 5 | 1000ms | 20 | 30% | Similar |
| 6 | 800ms | 25 | 30% | Similar |
| 7 | 600ms | 25 | 25% | Very similar |
| 8 | 500ms | 30 | 25% | Very similar |

**Telemetry:** Per-item: shown, is_target, was_tapped, response_time_ms. Summary: hits, misses, false_alarms, d_prime (signal detection sensitivity)

---

### Game 4: Baat Milao (Path Match) — Executive Function
**Clinical basis:** Trail Making Test (TMT) Part A/B

**Mechanic:**
1. Numbered circles (1, 2, 3...) scattered on screen
2. Patient traces a path connecting them in order by tapping sequentially
3. Correct sequence: path draws between points with a satisfying line
4. Wrong tap: gentle vibration, circle flashes, no penalty — just redirect

**Difficulty levels (1-8):**
| Level | Points | Layout Complexity | Time Limit |
|-------|--------|-------------------|------------|
| 1 | 4 | Linear arrangement | None |
| 2 | 5 | Slight scatter | None |
| 3 | 6 | Moderate scatter | 60 seconds |
| 4 | 7 | Moderate scatter | 45 seconds |
| 5 | 8 | High scatter | 45 seconds |
| 6 | 9 | High scatter, overlapping zones | 40 seconds |
| 7 | 10 | Complex layout | 35 seconds |
| 8 | 12 | Complex, some numbers partially occluded | 30 seconds |

**Telemetry:** Sequence of taps (correct/incorrect), per-tap response time, total completion time, errors

---

## 3. Adaptive Difficulty Engine

### 3.1 MVP: Rule-Based (Targeting 80-85% accuracy)

```typescript
// src/lib/engine/difficulty.ts

interface DifficultyState {
  currentLevel: number;
  consecutiveHighScores: number;  // Tracks runs of >80%
  consecutiveLowScores: number;   // Tracks runs of <50%
}

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY: Record<string, number> = {
  object_hunt: 10,
  word_stream: 6,
  quick_tap: 8,
  path_match: 8,
};

export function adjustDifficulty(
  state: DifficultyState,
  gameType: string,
  sessionAccuracy: number
): DifficultyState {
  const maxLevel = MAX_DIFFICULTY[gameType];

  if (sessionAccuracy >= 80) {
    const newConsecutiveHigh = state.consecutiveHighScores + 1;
    if (newConsecutiveHigh >= 3 && state.currentLevel < maxLevel) {
      return {
        currentLevel: state.currentLevel + 1,
        consecutiveHighScores: 0,
        consecutiveLowScores: 0,
      };
    }
    return { ...state, consecutiveHighScores: newConsecutiveHigh, consecutiveLowScores: 0 };
  }

  if (sessionAccuracy < 50) {
    const newConsecutiveLow = state.consecutiveLowScores + 1;
    if (newConsecutiveLow >= 2 && state.currentLevel > MIN_DIFFICULTY) {
      return {
        currentLevel: state.currentLevel - 1,
        consecutiveHighScores: 0,
        consecutiveLowScores: 0,
      };
    }
    return { ...state, consecutiveLowScores: newConsecutiveLow, consecutiveHighScores: 0 };
  }

  // 50-79%: sweet spot, no change
  return { ...state, consecutiveHighScores: 0, consecutiveLowScores: 0 };
}
```

**As shipped**, this streak counter is the innermost of three layers, and no
game page calls it directly any more:

1. `src/lib/engine/difficulty.ts` — the streak counter above, with the
   bootstrapped classifier in `src/lib/games/difficulty-ml.ts` in front of it.
2. `src/lib/engine/adaptive.ts` — `decideNextLevel`, which steers towards a
   70–85% accuracy band, caps any change at one level per session, applies the
   education bonus, and holds a patient back from a step up while their 14-day
   score band reads "needs support" or "needs close support". A step *down* is
   never blocked. Every decision carries a plain-language `reason`.
3. `src/hooks/useDifficulty.ts` — what game pages use. It loads the level and
   the patient's recent standing, and saves the new level.

The level is local to the device: the server `patients` table has no column for
it, so a change is written to Dexie only and is never queued for sync.

### 3.2 Phase 2: Per-Domain Elo Rating

```typescript
// Per-domain Elo with dynamic K-value (Pelánek 2016)

interface EloState {
  playerRating: number;   // Patient ability estimate
  uncertainty: number;     // Decreases with more data
}

const BASE_K = 40;
const MIN_K = 10;

function dynamicK(gamesPlayed: number): number {
  // K decreases as we have more data (prevents overreaction)
  return Math.max(MIN_K, BASE_K / (1 + gamesPlayed / 20));
}

export function updateElo(
  state: EloState,
  puzzleDifficulty: number,  // Rating of the puzzle
  isCorrect: boolean,
  gamesPlayed: number
): EloState {
  const K = dynamicK(gamesPlayed);
  const expectedScore = 1 / (1 + Math.pow(10, (puzzleDifficulty - state.playerRating) / 400));
  const actualScore = isCorrect ? 1 : 0;
  const newRating = state.playerRating + K * (actualScore - expectedScore);

  return {
    playerRating: Math.max(200, Math.min(2400, newRating)), // Clamp
    uncertainty: state.uncertainty * 0.99, // Slowly decreases
  };
}

// Select next puzzle: target ~70% expected success
export function selectPuzzleDifficulty(playerRating: number): number {
  // Solve: 0.7 = 1 / (1 + 10^((d - r) / 400))
  // d = r + 400 * log10(1/0.7 - 1) = r - 146
  return playerRating - 146;
}
```

### 3.3 Education Adjustment (MoCA-Inspired)

```typescript
// Scoring normalization for low-literacy users
export function adjustScoreForEducation(
  rawScore: number,
  educationYears: number
): number {
  // MoCA adds 1 point for ≤12 years education
  // SMRITI adds a proportional bonus for ≤6 years (NER-calibrated)
  if (educationYears <= 6) return rawScore + 2;
  if (educationYears <= 12) return rawScore + 1;
  return rawScore;
}
```

---

## 4. Session Flow

```
Caregiver taps "Start Session" for [Patient Name]
    │
    ▼
INTRO SCREEN: Patient photo + name + "Namaste [Name]!" (audio)
    │
    ▼
WORD STREAM SETUP: Show 3-5 items to remember (audio names)
    │   Patient taps "OK" (large green button)
    │
    ▼
GAME 1: Kotha Khoj (Object Hunt) — 3-4 rounds (~3 min)
    │
    ▼
GAME 2: Beg Beg (Quick Quick) — 2 rounds (~2 min)
    │
    ▼
GAME 3: Baat Milao (Path Match) — 2 rounds (~2 min)
    │
    ▼
WORD STREAM RECALL: "Which items did we show you?" (~2 min)
    │
    ▼
SESSION COMPLETE SCREEN:
    - Stars earned (1-5, always at least 1)
    - Encouraging audio: "Bhaal kaam!" (Good work!)
    - Score saved locally
    - Sync attempted in background
    │
    ▼
REMINDER CHECK: Any pending reminders? Show now.
    │
    ▼
HOME SCREEN (ready for caregiver to take device back)
```

---

## 5. Cultural Asset Inventory

### NER-Specific Objects (for games):
| Category | Items |
|----------|-------|
| **Textiles** | Gamosa (Assamese towel), Mekhela Chador, Muga silk, Eri shawl |
| **Food** | Tamul-paan (betel nut), Jolpaan (rice snack), Pitika (mashed potato), Masor tenga (sour fish curry), Laru (sesame ball) |
| **Nature** | One-horned rhino, Hoolock gibbon, Mithun (gayal), Elephant, Golden langur, Tea leaf |
| **Household** | Xorai (bell-metal plate), Bota-tambula tray, Dheki (rice husker), Bamboo basket, Clay pot |
| **Instruments** | Dhol, Pepa (buffalo horn), Gogona (bamboo jaw harp), Taal (cymbal) |
| **Landmarks** | Kamakhya temple, Kaziranga, Majuli island, Tea garden, Bamboo bridge |

**Art style:** Flat illustration, thick outlines, high contrast, warm earthy palette. NOT photorealistic. Think: children's book illustration meets folk art.
