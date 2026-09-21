/**
 * How often a game's "how to play" walk-through opens by itself.
 *
 * A patient who has seen it a handful of times does not need it every visit,
 * and repeating it makes every game feel slow to start. The count is kept
 * per patient and per game (a shared phone has several patients, and each
 * one is new to each game), and stops auto-opening after
 * {@link TUTORIAL_AUTO_SHOW_LIMIT} visits. The "How to play" button is
 * unaffected: a patient can always ask for it again.
 *
 * Kept in localStorage, like the flag it replaces, so it works offline and
 * needs no schema change. Storage that is blocked reads as "already seen":
 * never auto-open when the count cannot be saved, or it would open forever.
 */
export const TUTORIAL_AUTO_SHOW_LIMIT = 7;

const countKey = (patientId: string, gameId: string) => `smriti.tutorialShown.${patientId}.${gameId}`;

/** How many times this patient has had this game's tutorial open by itself. */
export function tutorialShownCount(patientId: string, gameId: string): number {
  try {
    const raw = window.localStorage.getItem(countKey(patientId, gameId));
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return TUTORIAL_AUTO_SHOW_LIMIT;
  }
}

/**
 * True when the tutorial should open by itself for this visit, and records
 * the visit. Call once per visit; calling again counts another visit.
 */
export function claimAutoTutorial(patientId: string | null | undefined, gameId: string): boolean {
  if (!patientId) return false;
  const shown = tutorialShownCount(patientId, gameId);
  if (shown >= TUTORIAL_AUTO_SHOW_LIMIT) return false;
  try {
    window.localStorage.setItem(countKey(patientId, gameId), String(shown + 1));
  } catch {
    return false;
  }
  return true;
}
