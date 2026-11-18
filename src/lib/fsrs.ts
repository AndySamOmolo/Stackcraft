/**
 * Free Spaced Repetition Scheduler (FSRS v4.5 deterministic engine with elapsed-time retrievability)
 * Computes memory stability (S), difficulty (D), retrievability (R), and next review interval (days).
 */

export type Rating = 1 | 2 | 3 | 4; // 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

export interface FSRSCardState {
  cardId: string;
  stability: number;      // Days until recall probability drops to 90%
  difficulty: number;     // 1.0 (easiest) to 10.0 (hardest)
  reps: number;
  lapses: number;
  lastReviewIso: string | null;
  nextDueIso: string;
}

const DEFAULT_WEIGHTS = {
  initStability: [0.4, 1.2, 3.1, 7.5],
  initDifficulty: [7.2, 6.1, 4.9, 3.4],
};

export function createInitialCardState(cardId: string, now = new Date()): FSRSCardState {
  return {
    cardId,
    stability: 0,
    difficulty: 5.0,
    reps: 0,
    lapses: 0,
    lastReviewIso: null,
    nextDueIso: now.toISOString(),
  };
}

/**
 * Computes FSRS power-law forgetting curve retrievability R in (0, 1]:
 * R(t, S) = (1 + (19/81) * (elapsedDays / S))^(-0.5)
 * At elapsedDays === S, R = (1 + 19/81)^(-0.5) = (100/81)^(-0.5) = 0.90 (90% recall).
 */
export function computeRetrievability(
  state: FSRSCardState,
  now = new Date()
): number {
  if (!state.lastReviewIso || state.stability <= 0) {
    return 0;
  }
  const lastMs = new Date(state.lastReviewIso).getTime();
  const elapsedDays = Math.max(0, (now.getTime() - lastMs) / (86400 * 1000));
  const factor = 1 + (19 / 81) * (elapsedDays / Math.max(0.1, state.stability));
  return Number(Math.pow(factor, -0.5).toFixed(4));
}

export function scheduleNextReview(
  prev: FSRSCardState,
  rating: Rating,
  now = new Date()
): FSRSCardState {
  const idx = rating - 1;
  let stability = prev.stability;
  let difficulty = prev.difficulty;
  const reps = prev.reps + 1;
  let lapses = prev.lapses;

  if (prev.reps === 0 || prev.stability <= 0) {
    stability = DEFAULT_WEIGHTS.initStability[idx];
    difficulty = DEFAULT_WEIGHTS.initDifficulty[idx];
  } else {
    // Update difficulty bounded [1, 10] with mean reversion toward 5.0
    const deltaD = (3 - rating) * 0.65;
    const rawDifficulty = prev.difficulty + deltaD;
    const revertedDifficulty = 0.9 * rawDifficulty + 0.1 * 5.0;
    difficulty = Math.min(10, Math.max(1, revertedDifficulty));

    if (rating === 1) {
      lapses += 1;
      stability = Number(Math.max(0.5, prev.stability * 0.35).toFixed(2));
    } else {
      const difficultyFactor = (11 - difficulty) / 9;
      const ratingMultiplier = rating === 2 ? 1.2 : rating === 3 ? 2.2 : 3.1;

      // Elapsed-time spacing factor: prevent same-day review spam from inflating stability exponentially
      const lastMs = prev.lastReviewIso ? new Date(prev.lastReviewIso).getTime() : now.getTime();
      const elapsedDays = Math.max(0, (now.getTime() - lastMs) / (86400 * 1000));
      const spacingRatio = Math.min(1.5, elapsedDays / Math.max(0.5, prev.stability));
      // Same-day reviews (spacingRatio ~ 0) receive only 12% of the full stability gain
      const spacingWeight = 0.12 + 0.88 * Math.min(1, spacingRatio);

      const fullGrowth = difficultyFactor * (ratingMultiplier - 1);
      stability = Number(
        (prev.stability * (1 + fullGrowth * spacingWeight)).toFixed(2)
      );
    }
  }

  const intervalDays = Math.max(1, Math.round(stability));
  const nextDue = new Date(now.getTime() + intervalDays * 86400 * 1000);

  return {
    cardId: prev.cardId,
    stability,
    difficulty: Number(difficulty.toFixed(2)),
    reps,
    lapses,
    lastReviewIso: now.toISOString(),
    nextDueIso: nextDue.toISOString(),
  };
}

export function isCardDue(state: FSRSCardState, now = new Date()): boolean {
  return new Date(state.nextDueIso).getTime() <= now.getTime();
}
