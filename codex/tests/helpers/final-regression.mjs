import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { snapshotQa, recordQa } from '../../../scripts/lib/qa-report.mjs';

// Synthetic local evidence for exercising gates; this does not run browser QA.
export async function recordPassingFinalRegression(root) {
  const ids = ['e2e-regression', 'screenshot-regression', 'keyboard-regression',
    'mouse-regression', 'design-regression', 'console-regression'];
  await mkdir(join(root, 'step_archive/outputs'), { recursive: true });
  const snapshot = await snapshotQa(root, 50, {
    artifacts: ['dist/index.html'],
    checks: ids.map(id => ({ id, requirement: `Full final ${id} matrix.` }))
  });
  const outcomes = [];
  for (const id of ids) {
    const path = `step_archive/outputs/final-${id}.json`;
    await writeFile(join(root, path), JSON.stringify({ fixture: true, check: id, passed: true }));
    outcomes.push({ id, status: 'pass', observation: 'Synthetic fixture outcome.',
      evidence_paths: [path], next_check: '' });
  }
  return recordQa(root, 50, { snapshot_id: snapshot.snapshot_id,
    verifier: { id: 'fixture-reviewer', mode: 'independent' }, outcomes, next_actions: [] });
}
