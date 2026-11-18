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
  bookmarkedModuleIds: string[];
  lastVisitedModuleId: string | null;
  activityLog: Record<string, number>; // YYYY-MM-DD -> count of actions (labs + card reviews)
}

/**
 * Formats a Date into the user's local calendar date (YYYY-MM-DD) rather than UTC,
 * preventing premature streak resets across non-UTC timezones (I18N-01).
 */
export function getLocalDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DEFAULT_PROFILE: LearnerProfile = {
  xp: 0,
  streakDays: 1,
  lastActiveDate: getLocalDateString(),
  preferredLanguage: 'typescript',
  completedModuleIds: [],
  moduleScores: {},
  fsrsStates: {},
  bookmarkedModuleIds: [],
  lastVisitedModuleId: null,
  activityLog: {},
};

let inMemoryProfile: LearnerProfile | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueStorageMutation<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function computeUpdatedStreak(
  lastActiveDate: string,
  currentStreak: number,
  today: string
): number {
  const safeStreak =
    typeof currentStreak === 'number' && Number.isFinite(currentStreak) && currentStreak >= 1
      ? Math.floor(currentStreak)
      : 1;
  if (!lastActiveDate || typeof lastActiveDate !== 'string' || lastActiveDate === today) {
    return safeStreak;
  }
  const prevParts = lastActiveDate.split('-').map(Number);
  const todayParts = today.split('-').map(Number);
  if (prevParts.length !== 3 || todayParts.length !== 3) {
    return safeStreak;
  }
  const prevUtcMs = Date.UTC(prevParts[0], prevParts[1] - 1, prevParts[2]);
  const todayUtcMs = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
  if (Number.isNaN(prevUtcMs) || Number.isNaN(todayUtcMs)) {
    return safeStreak;
  }
  const diffDays = Math.round((todayUtcMs - prevUtcMs) / (86400 * 1000));
  if (diffDays === 0) {
    return safeStreak;
  }
  if (diffDays === 1) {
    return safeStreak + 1;
  }
  return 1;
}

function isValidCardState(val: unknown): val is FSRSCardState {
  if (!val || typeof val !== 'object') return false;
  const c = val as Record<string, unknown>;
  return (
    typeof c.cardId === 'string' &&
    typeof c.stability === 'number' &&
    Number.isFinite(c.stability) &&
    typeof c.difficulty === 'number' &&
    Number.isFinite(c.difficulty) &&
    typeof c.reps === 'number' &&
    Number.isFinite(c.reps) &&
    typeof c.lapses === 'number' &&
    Number.isFinite(c.lapses) &&
    (c.lastReviewIso === null || typeof c.lastReviewIso === 'string') &&
    typeof c.nextDueIso === 'string'
  );
}

/**
 * Validates and sanitizes an untrusted JSON object into a safe LearnerProfile,
 * preventing crashes on corrupted AsyncStorage payloads or imported backups (SEC-03).
 */
export function sanitizeLearnerProfile(rawObj: unknown): LearnerProfile {
  const today = getLocalDateString();
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    return initializeFlashcards({ ...DEFAULT_PROFILE, lastActiveDate: today });
  }
  const obj = rawObj as Record<string, unknown>;

  const xp =
    typeof obj.xp === 'number' && Number.isFinite(obj.xp) && obj.xp >= 0
      ? Math.round(obj.xp)
      : 0;
  const streakDays =
    typeof obj.streakDays === 'number' && Number.isFinite(obj.streakDays) && obj.streakDays >= 1
      ? Math.round(obj.streakDays)
      : 1;
  const lastActiveDate =
    typeof obj.lastActiveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.lastActiveDate)
      ? obj.lastActiveDate
      : today;
  const preferredLanguage: CodeLanguage =
    obj.preferredLanguage === 'typescript' ||
    obj.preferredLanguage === 'python' ||
    obj.preferredLanguage === 'c'
      ? obj.preferredLanguage
      : 'typescript';

  const validModuleIds = new Set(CURRICULUM_MODULES.map((m) => m.id));
  const completedModuleIds = Array.isArray(obj.completedModuleIds)
    ? Array.from(
        new Set(
          obj.completedModuleIds.filter(
            (id): id is string => typeof id === 'string' && validModuleIds.has(id)
          )
        )
      )
    : [];

  const bookmarkedModuleIds = Array.isArray(obj.bookmarkedModuleIds)
    ? Array.from(
        new Set(
          obj.bookmarkedModuleIds.filter(
            (id): id is string => typeof id === 'string' && validModuleIds.has(id)
          )
        )
      )
    : [];

  const lastVisitedModuleId =
    typeof obj.lastVisitedModuleId === 'string' && validModuleIds.has(obj.lastVisitedModuleId)
      ? obj.lastVisitedModuleId
      : null;

  const moduleScores: Record<string, number> = {};
  if (obj.moduleScores && typeof obj.moduleScores === 'object' && !Array.isArray(obj.moduleScores)) {
    for (const [k, v] of Object.entries(obj.moduleScores as Record<string, unknown>)) {
      if (validModuleIds.has(k) && typeof v === 'number' && Number.isFinite(v)) {
        moduleScores[k] = Math.min(100, Math.max(0, Math.round(v)));
      }
    }
  }

  const fsrsStates: Record<string, FSRSCardState> = {};
  if (obj.fsrsStates && typeof obj.fsrsStates === 'object' && !Array.isArray(obj.fsrsStates)) {
    for (const [k, v] of Object.entries(obj.fsrsStates as Record<string, unknown>)) {
      if (isValidCardState(v)) {
        fsrsStates[k] = v;
      }
    }
  }

  const activityLog: Record<string, number> = {};
  if (obj.activityLog && typeof obj.activityLog === 'object' && !Array.isArray(obj.activityLog)) {
    for (const [k, v] of Object.entries(obj.activityLog as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        activityLog[k] = Math.round(v);
      }
    }
  }

  return initializeFlashcards({
    xp,
    streakDays,
    lastActiveDate,
    preferredLanguage,
    completedModuleIds,
    moduleScores,
    fsrsStates,
    bookmarkedModuleIds,
    lastVisitedModuleId,
    activityLog,
  });
}

function initializeFlashcards(profile: LearnerProfile): LearnerProfile {
  const nextStates: Record<string, FSRSCardState> = { ...profile.fsrsStates };
  for (const mod of CURRICULUM_MODULES) {
    for (const card of mod.flashcards) {
      if (!nextStates[card.id]) {
        nextStates[card.id] = createInitialCardState(card.id);
      }
    }
  }
  return { ...profile, fsrsStates: nextStates };
}

export async function loadLearnerProfile(forceReload = false): Promise<LearnerProfile> {
  if (inMemoryProfile && !forceReload) {
    return inMemoryProfile;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = initializeFlashcards({
        ...DEFAULT_PROFILE,
        lastActiveDate: getLocalDateString(),
      });
      inMemoryProfile = fresh;
      return fresh;
    }
    const parsed: unknown = JSON.parse(raw);
    const sanitized = sanitizeLearnerProfile(parsed);
    inMemoryProfile = sanitized;
    return sanitized;
  } catch {
    const fallback = initializeFlashcards({
      ...DEFAULT_PROFILE,
      lastActiveDate: getLocalDateString(),
    });
    inMemoryProfile = fallback;
    return fallback;
  }
}

export async function saveLearnerProfile(profile: LearnerProfile): Promise<void> {
  const sanitized = sanitizeLearnerProfile(profile);
  inMemoryProfile = sanitized;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Offline fallback safe
  }
}

export async function toggleBookmarkModule(moduleId: string): Promise<LearnerProfile> {
  return enqueueStorageMutation(async () => {
    const current = await loadLearnerProfile();
    const exists = current.bookmarkedModuleIds.includes(moduleId);
    const bookmarkedModuleIds = exists
      ? current.bookmarkedModuleIds.filter((id) => id !== moduleId)
      : [...current.bookmarkedModuleIds, moduleId];
    const updated: LearnerProfile = { ...current, bookmarkedModuleIds };
    await saveLearnerProfile(updated);
    return updated;
  });
}

export async function recordModuleVisit(moduleId: string): Promise<LearnerProfile> {
  return enqueueStorageMutation(async () => {
    const current = await loadLearnerProfile();
    if (current.lastVisitedModuleId === moduleId) return current;
    const updated: LearnerProfile = { ...current, lastVisitedModuleId: moduleId };
    await saveLearnerProfile(updated);
    return updated;
  });
}

export async function importLearnerProfileJson(jsonString: string): Promise<LearnerProfile> {
  return enqueueStorageMutation(async () => {
    const parsed: unknown = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid backup JSON payload: expected an object.');
    }
    const sanitized = sanitizeLearnerProfile(parsed);
    await saveLearnerProfile(sanitized);
    return sanitized;
  });
}

export async function resetLearnerProfile(): Promise<LearnerProfile> {
  return enqueueStorageMutation(async () => {
    const fresh = initializeFlashcards({
      ...DEFAULT_PROFILE,
      lastActiveDate: getLocalDateString(),
    });
    await saveLearnerProfile(fresh);
    return fresh;
  });
}

export async function completeModuleAndAwardXp(
  moduleId: string,
  xpReward: number,
  accuracyPct: number,
  now = new Date()
): Promise<LearnerProfile> {
  return enqueueStorageMutation(async () => {
    const current = await loadLearnerProfile();
    const isFirstCompletion = !current.completedModuleIds.includes(moduleId);
    const completedModuleIds = isFirstCompletion
      ? [...current.completedModuleIds, moduleId]
      : current.completedModuleIds;

    const today = getLocalDateString(now);
    const streakDays = computeUpdatedStreak(current.lastActiveDate, current.streakDays, today);
    const deltaXp = isFirstCompletion ? xpReward : Math.round(xpReward * 0.25);

    const updated: LearnerProfile = {
      ...current,
      xp: current.xp + deltaXp,
      streakDays,
      lastActiveDate: today,
      lastVisitedModuleId: moduleId,
      completedModuleIds,
      moduleScores: {
        ...current.moduleScores,
        [moduleId]: Math.max(current.moduleScores[moduleId] || 0, accuracyPct),
      },
      activityLog: {
        ...current.activityLog,
        [today]: (current.activityLog[today] || 0) + 1,
      },
    };
    await saveLearnerProfile(updated);
    return updated;
  });
}

export async function recordFlashcardReview(
  cardId: string,
  rating: Rating,
  now = new Date()
): Promise<LearnerProfile> {
  return enqueueStorageMutation(async () => {
    const current = await loadLearnerProfile();
    const prevCard = current.fsrsStates[cardId] || createInitialCardState(cardId, now);
    const updatedCard = scheduleNextReview(prevCard, rating, now);
    const today = getLocalDateString(now);
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
      activityLog: {
        ...current.activityLog,
        [today]: (current.activityLog[today] || 0) + 1,
      },
    };
    await saveLearnerProfile(updated);
    return updated;
  });
}
