import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, link } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { makeWorkspace, makeDirectoryLink } from './helpers/workspace.mjs';

const api = await import('../../scripts/lib/qa-report.mjs').catch(() => ({}));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture() {
  assert.equal(typeof api.snapshotQa, 'function', 'QA snapshot API must exist');
  const root = await makeWorkspace();
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'step_archive', 'outputs'), { recursive: true });
  await writeFile(join(root, 'src', 'app.js'), 'export const total = 7;');
  await writeFile(join(root, 'step_archive', 'outputs', 'test.json'), '{"total":7}');
  const snapshot = await api.snapshotQa(root, 49, {
    artifacts: ['src/app.js'],
    checks: [{ id: 'total', requirement: 'The displayed total equals seven.' }]
  });
  return { root, snapshot };
}

function report(snapshot, status = 'pass') {
  return {
    snapshot_id: snapshot.snapshot_id,
    verifier: { id: 'reviewer-2', mode: 'independent' },
    outcomes: [{ id: 'total', status, observation: status === 'pass' ? 'Observed seven.' : 'Observed a wrong total.',
      evidence_paths: ['step_archive/outputs/test.json'], next_check: status === 'pass' ? '' : 'Recheck the displayed total.' }],
    next_actions: status === 'pass' ? [] : ['Correct the total calculation.']
  };
}

test('a recorded failure remains incomplete and supplies the next attempt with evidence', async () => {
  const { root, snapshot } = await fixture();
  const saved = await api.recordQa(root, 49, report(snapshot, 'fail'));
  assert.equal(saved.verdict, 'INCOMPLETE');
  const inspected = await api.inspectQa(root, 49);
  assert.equal(inspected.status, 'current');
  assert.equal(inspected.verdict, 'INCOMPLETE');
  assert.deepEqual(inspected.preserve, []);
  assert.deepEqual(inspected.report.next_actions, ['Correct the total calculation.']);
  assert.equal(inspected.report.outcomes[0].evidence[0].sha256, digest('{"total":7}'));
});

test('source and evidence changes invalidate preserved PASS while keeping historical findings', async () => {
  for (const path of ['src/app.js', 'step_archive/outputs/test.json']) {
    const { root, snapshot } = await fixture();
    await api.recordQa(root, 49, report(snapshot));
    assert.deepEqual((await api.inspectQa(root, 49)).preserve, ['total']);
    await writeFile(join(root, path), 'changed');
    const stale = await api.inspectQa(root, 49);
    assert.equal(stale.status, 'stale');
    assert.equal(stale.verdict, 'INCOMPLETE');
    assert.deepEqual(stale.preserve, []);
  }
});

test('snapshot requirements cannot be dropped or invented when recording outcomes', async () => {
  for (const mutate of [p => { p.outcomes = []; }, p => { p.outcomes.push(p.outcomes[0]); }, p => { p.outcomes[0].id = 'other'; },
    p => { p.outcomes[0].required = false; }, p => { p.verdict = 'PASS'; }, p => { p.outcomes[0].evidence_paths = []; }]) {
    const { root, snapshot } = await fixture();
    const input = report(snapshot); mutate(input);
    await assert.rejects(() => api.recordQa(root, 49, input));
    assert.equal((await api.inspectQa(root, 49)).status, 'missing');
  }
});

test('missing execution can be reported honestly without fabricated evidence', async () => {
  const { root, snapshot } = await fixture();
  const input = report(snapshot, 'unverified');
  input.outcomes[0].evidence_paths = [];
  await api.recordQa(root, 49, input);
  const inspected = await api.inspectQa(root, 49);
  assert.equal(inspected.verdict, 'INCOMPLETE');
  assert.equal(inspected.report.outcomes[0].status, 'unverified');
});

test('recording cannot reuse a changed candidate or a different step snapshot', async () => {
  const { root, snapshot } = await fixture();
  await assert.rejects(() => api.recordQa(root, 50, report(snapshot)));
  await writeFile(join(root, 'src', 'app.js'), 'new version');
  await assert.rejects(() => api.recordQa(root, 49, report(snapshot)));
  assert.equal((await api.inspectQa(root, 49)).status, 'missing');
});

test('recorded outcomes are immutable and an unsuccessful overwrite keeps the first result', async () => {
  const { root, snapshot } = await fixture();
  await api.recordQa(root, 49, report(snapshot, 'fail'));
  await assert.rejects(() => api.recordQa(root, 49, report(snapshot)));
  const inspected = await api.inspectQa(root, 49);
  assert.equal(inspected.verdict, 'INCOMPLETE');
  assert.equal(inspected.report.outcomes[0].status, 'fail');
});

test('the latest pointer cannot import another step or silently accept modified report bytes', async () => {
  const { root, snapshot } = await fixture();
  const saved = await api.recordQa(root, 49, report(snapshot));
  const base = join(root, 'step_archive', 'outputs', 'qa-reports');
  const pointer = await readFile(join(base, 'step049.latest.json'));
  await writeFile(join(base, 'step050.latest.json'), pointer);
  assert.equal((await api.inspectQa(root, 50)).status, 'invalid');
  await writeFile(join(base, `${saved.report_sha256}.report.json`), '{}');
  const invalid = await api.inspectQa(root, 49);
  assert.equal(invalid.status, 'invalid');
  assert.deepEqual(invalid.preserve, []);
});

test('explicit artifact lists avoid reading unrelated or private workspace files', async () => {
  const root = await makeWorkspace();
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'app.js'), 'ok');
  await writeFile(join(root, '.env'), 'PRIVATE_VALUE=not-for-evidence');
  assert.equal(typeof api.snapshotQa, 'function');
  const saved = await api.snapshotQa(root, 38, { artifacts: ['src/app.js'], checks: [{ id: 'build', requirement: 'Build works.' }] });
  const bytes = await readFile(join(root, 'step_archive', 'outputs', 'qa-reports', `${saved.snapshot_id}.snapshot.json`), 'utf8');
  assert.ok(!bytes.includes('PRIVATE_VALUE'));
  assert.equal(JSON.parse(bytes).artifacts.length, 1);
});

test('paths refuse traversal, private state, secret files, links, hardlinks and evidence recursion', async () => {
  const { root } = await fixture();
  for (const path of ['../x', 'C:/x', 'src/app.js:stream', 'src\\app.js', '.env', 'src/.env.local',
    'step_archive/progress.json', 'step_archive/.harness50-codex/state.json', 'src/id_rsa', 'src/token.pem']) {
    await assert.rejects(() => api.snapshotQa(root, 49, { artifacts: [path], checks: [{ id: 'x', requirement: 'Check.' }] }));
  }
  await link(join(root, 'src', 'app.js'), join(root, 'src', 'linked.js'));
  await assert.rejects(() => api.snapshotQa(root, 49, { artifacts: ['src/linked.js'], checks: [{ id: 'x', requirement: 'Check.' }] }));
  const outside = await makeWorkspace(); await writeFile(join(outside, 'app.js'), 'outside');
  await makeDirectoryLink(outside, join(root, 'alias'));
  await assert.rejects(() => api.snapshotQa(root, 49, { artifacts: ['alias/app.js'], checks: [{ id: 'x', requirement: 'Check.' }] }));
});

test('secret-bearing input and oversized text are rejected without becoming a report', async () => {
  for (const value of ['Authorization: Bearer TEST_SECRET_SENTINEL', 'password=TEST_SECRET_SENTINEL', 'x'.repeat(3000)]) {
    const { root, snapshot } = await fixture();
    const input = report(snapshot); input.outcomes[0].observation = value;
    await assert.rejects(() => api.recordQa(root, 49, input), error => !error.message.includes('TEST_SECRET_SENTINEL'));
    assert.equal((await api.inspectQa(root, 49)).status, 'missing');
  }
});

test('failure records bind their source evidence again when recording', async () => {
  const { root, snapshot } = await fixture();
  const input = report(snapshot, 'fail');
  input.outcomes[0].evidence_paths = ['step_archive/.harness50-codex/state.json'];
  await assert.rejects(() => api.recordQa(root, 49, input));
  input.outcomes[0].evidence_paths = ['step_archive/outputs/qa-reports/step049.latest.json'];
  await assert.rejects(() => api.recordQa(root, 49, input));
});

test('identifiers cannot leak recognizable credentials into inspected handoffs', async () => {
  const fake = 'ghp_FAKE_SENTINEL_01234567890123456789';
  const { root, snapshot } = await fixture();
  const input = report(snapshot);
  input.verifier.id = fake;
  await assert.rejects(() => api.recordQa(root, 49, input), error => !error.message.includes(fake));
  await assert.rejects(() => api.snapshotQa(root, 49, { artifacts: ['src/app.js'], checks: [{ id: fake, requirement: 'Check.' }] }));
});
