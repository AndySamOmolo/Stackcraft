import AsyncStorage from '@react-native-async-storage/async-storage';
import { CodeLanguage } from '../data/types';
import { FSRSCardState, createInitialCardState, scheduleNextReview, Rating } from './fsrs';
import { CURRICULUM_MODULES } from '../data/curriculum';

const STORAGE_KEY = '@stackcraft/learner_profile_v1';

export interface LearnerProfile {
  xp: number;
  streakDays: number;
  lastActiveDate: string;
  preferredLanguage: CodeLanguage;
  completedModuleIds: string[];
  moduleScores: Record<string, number>;
  fsrsStates: Record<string, FSRSCardState>;
}

const DEFAULT_PROFILE: LearnerProfile = {
  xp: 0,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  preferredLanguage: 'typescript',
  completedModuleIds: [],
  moduleScores: {},
  fsrsStates: {},
};

function computeUpdatedStreak(lastActiveDate: string, currentStreak: number, today: string): number {
  if (!lastActiveDate || lastActiveDate === today) {
    return Math.max(1, currentStreak);
  }
  const prevMs = Date.parse(`${lastActiveDate}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(prevMs) || Number.isNaN(todayMs)) {
    return Math.max(1, currentStreak);
  }
  const diffDays = Math.round((todayMs - prevMs) / (86400 * 1000));
  if (diffDays === 1) {
    return currentStreak + 1;
  }
  return 1;
}

export async function loadLearnerProfile(): Promise<LearnerProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return initializeFlashcards(DEFAULT_PROFILE);
    }
    const parsed: LearnerProfile = JSON.parse(raw);
    return initializeFlashcards({ ...DEFAULT_PROFILE, ...parsed });
  } catch {
    return initializeFlashcards(DEFAULT_PROFILE);
  }
}

function initializeFlashcards(profile: LearnerProfile): LearnerProfile {
  const nextStates = { ...profile.fsrsStates };
  for (const mod of CURRICULUM_MODULES) {
    for (const card of mod.flashcards) {
      if (!nextStates[card.id]) {
        nextStates[card.id] = createInitialCardState(card.id);
      }
    }
  }
  return { ...profile, fsrsStates: nextStates };
}

export async function saveLearnerProfile(profile: LearnerProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Offline fallback safe
  }
}

export async function resetLearnerProfile(): Promise<LearnerProfile> {
  const fresh = initializeFlashcards({
    ...DEFAULT_PROFILE,
    lastActiveDate: new Date().toISOString().slice(0, 10),
  });
  await saveLearnerProfile(fresh);
  return fresh;
}

export async function completeModuleAndAwardXp(
  moduleId: string,
  xpReward: number,
  accuracyPct: number
): Promise<LearnerProfile> {
  const current = await loadLearnerProfile();
  const isFirstCompletion = !current.completedModuleIds.includes(moduleId);
  const completedModuleIds = isFirstCompletion
    ? [...current.completedModuleIds, moduleId]
    : current.completedModuleIds;

  const today = new Date().toISOString().slice(0, 10);
  const streakDays = computeUpdatedStreak(current.lastActiveDate, current.streakDays, today);

  const updated: LearnerProfile = {
    ...current,
    xp: isFirstCompletion ? current.xp + xpReward : current.xp + Math.round(xpReward * 0.25),
    streakDays,
    lastActiveDate: today,
    completedModuleIds,
    moduleScores: {
      ...current.moduleScores,
      [moduleId]: Math.max(current.moduleScores[moduleId] || 0, accuracyPct),
    },
  };
  await saveLearnerProfile(updated);
  return updated;
}

export async function recordFlashcardReview(
  cardId: string,
  rating: Rating
): Promise<LearnerProfile> {
  const current = await loadLearnerProfile();
  const prevCard = current.fsrsStates[cardId] || createInitialCardState(cardId);
  const updatedCard = scheduleNextReview(prevCard, rating);
  const today = new Date().toISOString().slice(0, 10);
  const streakDays = computeUpdatedStreak(current.lastActiveDate, current.streakDays, today);

  const updated: LearnerProfile = {
    ...current,
    xp: current.xp + 15,
    streakDays,
    lastActiveDate: today,
    fsrsStates: {
      ...current.fsrsStates,
      [cardId]: updatedCard,
    },
  };
  await saveLearnerProfile(updated);
  return updated;
}
