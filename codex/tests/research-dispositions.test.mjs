import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStepContract, validateCompletionEvidence } from '../scripts/lib/acceptance.mjs';
import { makeWorkspace } from './helpers/workspace.mjs';

const pluginRoot = fileURLToPath(new URL('../../', import.meta.url));

// Exercise the actual completion consumer, not prose matching. Independent research
// review remains the source of semantic checks; the runtime binds its artifacts.
async function fixture(t, step, disposition) {
  const root = await makeWorkspace();
  const contract = await loadStepContract(pluginRoot, step);
  const evidence = [];
  for (const item of contract.acceptance.filter(item => item.required)) {
    const entry = { acceptance_id: item.id, kind: item.kind, ok: true, detail: disposition };
    if (item.kind === 'artifact') {
      const path = join(root, item.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, item.path.endsWith('.json') ? '{"items":[]}' : disposition);
      entry.artifact_path = item.path;
    }
    if (item.kind === 'command') {
      entry.command = item.command;
      entry.exit_code = 0;
    }
    evidence.push(entry);
  }
  return { root, contract, evidence };
}

test('optional c8 disposition completes without inventing a successful version command', async t => {
  const { root, contract, evidence } = await fixture(t, 5, 'SKIP: c8 unavailable; Step 6 Jest coverage selected');
  assert.equal(contract.acceptance.find(item => item.id === 'c8-disposition')?.kind, 'check');
  assert.ok(!evidence.some(item => item.kind === 'command'));
  const result = await validateCompletionEvidence({ contract, evidence, workspaceRoot: root });
  assert.deepEqual(result.missing_required, []);
  const missing = evidence.filter(item => item.acceptance_id !== 'c8-disposition');
  await assert.rejects(validateCompletionEvidence({ contract, evidence: missing, workspaceRoot: root }));
});

for (const step of [17, 19, 26, 28]) {
  test(`step ${step} consumes a reviewed no-reference disposition without requiring invented clone evidence`, async t => {
    const { root, contract, evidence } = await fixture(t, step,
      'exhausted-no-reference: three persisted successful queries independently reviewed; no usable candidates; zero clone-backed decisions');
    const result = await validateCompletionEvidence({ contract, evidence, workspaceRoot: root });
    assert.deepEqual(result.missing_required, []);
    assert.ok(result.evidence.filter(item => item.kind === 'artifact').every(item => /^[a-f0-9]{64}$/.test(item.artifact_sha256)));
    const failed = evidence.map(item => item.kind === 'check' ? { ...item, ok: false } : item);
    await assert.rejects(validateCompletionEvidence({ contract, evidence: failed, workspaceRoot: root }));
    const artifact = result.evidence.find(item => item.kind === 'artifact');
    await writeFile(join(root, artifact.artifact_path), 'changed research disposition');
    await assert.rejects(validateCompletionEvidence({ contract, evidence: result.evidence, workspaceRoot: root }));
  });
}

test('step24 completion binds the final supplemental manifest and rejects failed independent review', async t => {
  const { root, contract, evidence } = await fixture(t, 24,
    'round 1 FAIL: missing mobile capture; round 2 PASS: current attempt supplemental manifest, SHA-256, reanalysis and independent inspection');
  assert.equal(contract.network, true);
  const result = await validateCompletionEvidence({ contract, evidence, workspaceRoot: root });
  const report = result.evidence.find(item => item.acceptance_id === 'sufficiency-verification-round-1');
  assert.match(report.artifact_sha256, /^[a-f0-9]{64}$/);
  await assert.rejects(validateCompletionEvidence({ contract, workspaceRoot: root,
    evidence: evidence.map(item => item.acceptance_id === 'pass-verdict' ? { ...item, ok: false } : item) }));
  await writeFile(join(root, report.artifact_path), 'unreviewed replacement analysis');
  await assert.rejects(validateCompletionEvidence({ contract, evidence: result.evidence, workspaceRoot: root }));
});
