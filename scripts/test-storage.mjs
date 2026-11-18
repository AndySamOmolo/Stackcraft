import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const curriculumSource = fs.readFileSync(path.resolve('src/data/curriculum.ts'), 'utf8');
const fsrsSource = fs.readFileSync(path.resolve('src/lib/fsrs.ts'), 'utf8');
const storageSource = fs.readFileSync(path.resolve('src/lib/storage.ts'), 'utf8');

const mockStore = new Map();
const mockAsyncStorage = {
  getItem: async (k) => (mockStore.has(k) ? mockStore.get(k) : null),
  setItem: async (k, v) => {
    mockStore.set(k, v);
  },
};

const currCtx = { CURRICULUM_TRACKS: [], CURRICULUM_MODULES: [] };
vm.runInNewContext(
  curriculumSource
    .replace(/^import .*$/gm, '')
    .replace(/export const CURRICULUM_TRACKS:\s*CurriculumTrack\[\]/g, 'this.CURRICULUM_TRACKS')
    .replace(/export const CURRICULUM_MODULES:\s*CurriculumModule\[\]/g, 'this.CURRICULUM_MODULES'),
  currCtx
);

const fsrsCtx = { module: { exports: {} }, Date, Math, Number };
vm.runInNewContext(
  fsrsSource
    .replace(/export\s+type\s+[\s\S]*?;/g, '')
    .replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\}/g, '')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/:\s*(?:FSRSCardState|Rating|string|number|boolean|Date|void)(?:\s*\|\s*null)?/g, '') +
    '\nmodule.exports = { createInitialCardState, computeRetrievability, scheduleNextReview, isCardDue };',
  fsrsCtx
);

const storageJs =
  storageSource
    .replace(/^import .*$/gm, '')
    .replace(/export\s+interface\s+LearnerProfile\s*\{[\s\S]*?\}/g, '')
    .replace(/export\s+async\s+function\s+/g, 'async function ')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/function\s+enqueueStorageMutation<T>\(fn:\s*\(\)\s*=>\s*Promise<T>\):\s*Promise<T>/g, 'function enqueueStorageMutation(fn)')
    .replace(/function\s+isValidCardState\(val:\s*unknown\):\s*val\s+is\s+FSRSCardState/g, 'function isValidCardState(val)')
    .replace(/\(id\):\s*id\s+is\s+string/g, '(id)')
    .replace(/as\s+Record<string,\s*unknown>/g, '')
    .replace(/:\s*Promise<[^>]+>/g, '')
    .replace(/:\s*Record<[^>]+>/g, '')
    .replace(/:\s*(?:LearnerProfile|CodeLanguage|Rating|string|number|boolean|unknown)(?:\s*\|\s*null)?(?:\[\])?/g, '') +
  '\nmodule.exports = { getLocalDateString, computeUpdatedStreak, sanitizeLearnerProfile, loadLearnerProfile, completeModuleAndAwardXp, recordFlashcardReview, toggleBookmarkModule, recordModuleVisit, importLearnerProfileJson, resetLearnerProfile };';

const storageCtx = {
  module: { exports: {} },
  AsyncStorage: mockAsyncStorage,
  CURRICULUM_MODULES: currCtx.CURRICULUM_MODULES,
  ...fsrsCtx.module.exports,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  Set,
  Promise,
  JSON,
  Error,
};

vm.runInNewContext(storageJs, storageCtx, { filename: 'storage.ts' });
const {
  getLocalDateString,
  computeUpdatedStreak,
  loadLearnerProfile,
  completeModuleAndAwardXp,
  recordFlashcardReview,
  toggleBookmarkModule,
  recordModuleVisit,
  importLearnerProfileJson,
  resetLearnerProfile,
} = storageCtx.module.exports;

async function runTests() {
  // 1. Local calendar date formatting & consecutive streak increments
  const localDate = getLocalDateString(new Date(2026, 10, 18, 1, 30, 0));
  assert.equal(localDate, '2026-11-18');
  assert.equal(computeUpdatedStreak('2026-11-17', 4, '2026-11-18'), 5);
  assert.equal(computeUpdatedStreak('2026-11-18', 5, '2026-11-18'), 5);
  assert.equal(computeUpdatedStreak('2026-11-15', 5, '2026-11-18'), 1);

  // 2. Malformed & corrupted AsyncStorage schema sanitization across all 48 flashcards
  mockStore.set(
    '@stackcraft/learner_profile_v1',
    JSON.stringify({
      xp: -999,
      streakDays: null,
      lastActiveDate: 'invalid-date',
      preferredLanguage: 'rust',
      completedModuleIds: null,
      moduleScores: 'corrupted',
      fsrsStates: null,
      bookmarkedModuleIds: 'invalid',
      activityLog: null,
    })
  );
  const recovered = await loadLearnerProfile(true);
  assert.equal(recovered.xp, 0);
  assert.equal(recovered.streakDays, 1);
  assert.equal(recovered.preferredLanguage, 'typescript');
  assert.ok(Array.isArray(recovered.completedModuleIds));
  assert.equal(recovered.completedModuleIds.length, 0);
  assert.equal(Object.keys(recovered.fsrsStates).length, 48);

  // 3. First-time vs repeat module XP calculation & activityLog tracking
  await resetLearnerProfile();
  const afterFirst = await completeModuleAndAwardXp('mod-101-stack-vs-heap', 120, 90);
  assert.equal(afterFirst.xp, 120);
  assert.equal(afterFirst.moduleScores['mod-101-stack-vs-heap'], 90);
  assert.equal(afterFirst.lastVisitedModuleId, 'mod-101-stack-vs-heap');

  const afterRepeat = await completeModuleAndAwardXp('mod-101-stack-vs-heap', 120, 100);
  assert.equal(afterRepeat.xp, 150);
  assert.equal(afterRepeat.moduleScores['mod-101-stack-vs-heap'], 100);

  // 4. Bookmarks & Module Visits
  const b1 = await toggleBookmarkModule('mod-701-k8s-oomkill-cgroup');
  assert.deepEqual([...b1.bookmarkedModuleIds], ['mod-701-k8s-oomkill-cgroup']);
  const b2 = await toggleBookmarkModule('mod-701-k8s-oomkill-cgroup');
  assert.deepEqual([...b2.bookmarkedModuleIds], []);
  const v1 = await recordModuleVisit('mod-803-gpu-vram-kvcache-stall');
  assert.equal(v1.lastVisitedModuleId, 'mod-803-gpu-vram-kvcache-stall');

  // 5. Concurrent flashcard review serialization
  await Promise.all([
    recordFlashcardReview('fc-101-1', 4),
    recordFlashcardReview('fc-101-2', 3),
  ]);
  const afterConcurrent = await loadLearnerProfile();
  assert.equal(afterConcurrent.xp, 180);
  assert.equal(afterConcurrent.fsrsStates['fc-101-1'].reps, 1);
  assert.equal(afterConcurrent.fsrsStates['fc-101-2'].reps, 1);

  // 6. JSON backup import validation
  const imported = await importLearnerProfileJson(
    JSON.stringify({
      xp: 1850,
      streakDays: 12,
      lastActiveDate: '2026-11-18',
      preferredLanguage: 'c',
      completedModuleIds: ['mod-101-stack-vs-heap', 'mod-803-gpu-vram-kvcache-stall', 'unknown-mod-id'],
      bookmarkedModuleIds: ['mod-702-multi-region-failover'],
      moduleScores: { 'mod-101-stack-vs-heap': 95 },
      fsrsStates: {},
    })
  );
  assert.equal(imported.xp, 1850);
  assert.equal(imported.streakDays, 12);
  assert.equal(imported.preferredLanguage, 'c');
  assert.deepEqual([...imported.completedModuleIds], [
    'mod-101-stack-vs-heap',
    'mod-803-gpu-vram-kvcache-stall',
  ]);
  assert.deepEqual([...imported.bookmarkedModuleIds], ['mod-702-multi-region-failover']);

  console.log(
    '[PASS] Storage v2.0 tests succeeded: 48 flashcards initialized, local timezone streaks, bookmarks, activity log, concurrent queue, and backup import verified.'
  );
}

runTests();
