// Checks the web's copy of the app's sub planner (src/utils/gamePlan.js)
// against plans the iOS app actually builds. The fixtures come from the
// Swift test PlanParityFixtures:
//   TEST_RUNNER_PLAN_FIXTURE_OUT=$PWD/scripts/local-stack/plan-fixtures.json \
//     xcodebuild test -scheme PlayBall -only-testing:PlayBallTests/PlanParityFixtures …
// Usage: node scripts/local-stack/plan-parity.mjs [fixtures.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.join(here, 'plan-fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(file, 'utf8'));
const { buildSubstitutionPlan, effectivePlan } = await import(pathToFileURL(path.join(here, '../../src/utils/gamePlan.js')).href);

let failed = 0;
for (const f of fixtures) {
  const problems = [];
  const plan = buildSubstitutionPlan(f.game);
  if (Math.abs(plan.subDuration - f.subDuration) > 0.001) problems.push(`interval ${plan.subDuration} vs app ${f.subDuration}`);
  const want = f.segments.map(s => s.map(id => id.toLowerCase()).join(','));
  const got = plan.segments.map(s => s.map(id => String(id).toLowerCase()).join(','));
  if (want.length !== got.length) problems.push(`${got.length} shifts vs app ${want.length}`);
  want.forEach((w, i) => { if (got[i] !== w) problems.push(`shift ${i + 1} differs`); });

  // Minutes per player from the displayed shifts, keeper time included.
  const totals = {};
  for (const s of effectivePlan(f.game).shifts) {
    for (const id of [...s.fieldIDs, ...(s.goalieID ? [s.goalieID] : [])]) {
      const k = String(id).toLowerCase();
      totals[k] = (totals[k] || 0) + (s.end - s.start);
    }
  }
  for (const [id, secs] of Object.entries(f.seconds)) {
    const mine = totals[id.toLowerCase()] || 0;
    if (Math.abs(mine - secs) > 0.5) problems.push(`${id.slice(-4)}: ${Math.round(mine)}s vs app ${Math.round(secs)}s`);
  }
  if (problems.length) { failed++; console.log(`✗ ${f.name}\n    ${problems.slice(0, 6).join('\n    ')}`); }
  else console.log(`✓ ${f.name}`);
}
console.log(`\n${fixtures.length - failed} of ${fixtures.length} games match the app`);
process.exit(failed ? 1 : 0);
