import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const curriculumPath = path.resolve('src/data/curriculum.ts');
const typesPath = path.resolve('src/data/types.ts');
const source = fs.readFileSync(curriculumPath, 'utf8');
const typesSource = fs.readFileSync(typesPath, 'utf8');

const requiredTracks = [
  'track-1-memory',
  'track-2-dsa',
  'track-3-auditing',
  'track-4-systems',
  'track-5-distributed',
  'track-6-security-ai',
];

const requiredEngines = [
  'memory-tracer',
  'ai-auditor',
  'chaos-architect',
  'incident-commander',
];

let errors = 0;

if (/export\s+interface[A-Za-z]/.test(typesSource)) {
  console.error('[ERROR] Malformed interface keyword in src/data/types.ts');
  errors++;
}

let parsedCtx = { CURRICULUM_TRACKS: [], CURRICULUM_MODULES: [] };
try {
  const executableJs = source
    .replace(/^import .*$/gm, '')
    .replace(/export const CURRICULUM_TRACKS:\s*CurriculumTrack\[\]/g, 'this.CURRICULUM_TRACKS')
    .replace(/export const CURRICULUM_MODULES:\s*CurriculumModule\[\]/g, 'this.CURRICULUM_MODULES');
  vm.runInNewContext(executableJs, parsedCtx, { filename: 'src/data/curriculum.ts' });
} catch (err) {
  console.error('[ERROR] Syntax error in src/data/curriculum.ts:', err.message);
  errors++;
}

for (const trackId of requiredTracks) {
  const count = parsedCtx.CURRICULUM_MODULES.filter((m) => m.trackId === trackId).length;
  if (count < 2) {
    console.error(`[ERROR] Track ${trackId} has only ${count} module(s); minimum 2 required.`);
    errors++;
  }
}

for (const engine of requiredEngines) {
  const count = parsedCtx.CURRICULUM_MODULES.filter((m) => m.engineType === engine).length;
  if (count < 2) {
    console.error(`[ERROR] Engine ${engine} has only ${count} module(s); minimum 2 required.`);
    errors++;
  }
}

const tsCount = (source.match(/typescript:\s*\[/g) || []).length;
const pyCount = (source.match(/python:\s*\[/g) || []).length;
const cCount = (source.match(/c:\s*\[/g) || []).length;

if (tsCount < 8 || pyCount < 8 || cCount < 8) {
  console.error(
    `[ERROR] Multi-language parity check failed: typescript=${tsCount}, python=${pyCount}, c=${cCount}`
  );
  errors++;
}

if (errors > 0) {
  console.error(`Curriculum schema audit failed with ${errors} error(s).`);
  process.exit(1);
}

console.log(
  `[PASS] StackCraft curriculum audit succeeded: ${parsedCtx.CURRICULUM_TRACKS.length} tracks verified (2+ modules each), ${parsedCtx.CURRICULUM_MODULES.length} total interactive labs, ${tsCount} multi-language (TS/Python/C) code labs verified, 0 syntax errors.`
);
