import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Load and transpile src/lib/fsrs.ts stripped of TS type annotations so it runs in zero-dependency Node
const fsrsPath = path.resolve('src/lib/fsrs.ts');
const tsCode = fs.readFileSync(fsrsPath, 'utf8');

const jsCode = tsCode
  .replace(/export type .*?;/g, '')
  .replace(/export interface FSRSCardState \{[\s\S]*?\}/g, '')
  .replace(/export function /g, 'function ')
  .replace(/: FSRSCardState/g, '')
  .replace(/: Rating/g, '')
  .replace(/: string/g, '')
  .replace(/: number/g, '')
  .replace(/: boolean/g, '') +
  '\nmodule.exports = { createInitialCardState, computeRetrievability, scheduleNextReview, isCardDue };';

const sandbox = { module: { exports: {} }, Date, Math, Number };
vm.runInNewContext(jsCode, sandbox, { filename: 'fsrs.ts' });
const { createInitialCardState, computeRetrievability, scheduleNextReview, isCardDue } = sandbox.module.exports;

const t0 = new Date('2026-11-17T12:00:00Z');
const init = createInitialCardState('fc-test-1', t0);
assert.equal(init.stability, 0);
assert.equal(init.reps, 0);
assert.equal(isCardDue(init, t0), true);

// First review rated Easy (4) -> stability = 7.5d
const r1 = scheduleNextReview(init, 4, t0);
assert.equal(r1.stability, 7.5);
assert.equal(r1.reps, 1);
assert.equal(isCardDue(r1, t0), false);

// At exactly elapsed = 7.5 days, retrievability R should be 0.90 (90% recall)
const tDue = new Date(t0.getTime() + 7.5 * 86400 * 1000);
const retrAtDue = computeRetrievability(r1, tDue);
assert.equal(retrAtDue, 0.9);

// Same-day spam check: reviewing 1 minute later should dampen stability gain compared to waiting full 7.5 days
const tOneMin = new Date(t0.getTime() + 60 * 1000);
const rSpam = scheduleNextReview(r1, 4, tOneMin);
const rSpaced = scheduleNextReview(r1, 4, tDue);
assert.ok(
  rSpam.stability < rSpaced.stability,
  `Expected same-day review stability (${rSpam.stability}) < spaced review stability (${rSpaced.stability})`
);
assert.ok(
  rSpam.stability < 10.5,
  `Expected same-day review stability (${rSpam.stability}) to be dampened below 10.5d`
);

// Lapse check: Rating 1 (Again) increments lapses and cuts stability
const rLapse = scheduleNextReview(rSpaced, 1, tDue);
assert.equal(rLapse.lapses, 1);
assert.ok(rLapse.stability < rSpaced.stability);

console.log('[PASS] FSRS v4.5 unit tests succeeded: initial state, 90% retrievability curve, same-day anti-spam damping, and lapse recovery verified.');
