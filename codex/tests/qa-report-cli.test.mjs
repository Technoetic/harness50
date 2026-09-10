import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../scripts/qa-report.mjs', import.meta.url));
const diagnostic = { error: { code: 'QA_COMMAND_FAILED', message: 'QA report command failed' } };

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'harness50-qa-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist'));
  await mkdir(join(root, 'step_archive', 'outputs'), { recursive: true });
  await writeFile(join(root, 'dist', 'index.html'), '<html><body>Candidate</body></html>');
  await writeFile(join(root, 'step_archive', 'outputs', 'check.json'), '{"passed":true}');
  return root;
}

function run(args, input = '') {
  const result = spawnSync(process.execPath, [cli, ...args], {
    input, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  return result;
}

function success(result, exit = 0) {
  assert.equal(result.status, exit, result.stderr || result.stdout);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function failure(result) {
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), diagnostic);
}

function snapshot(root) {
  return success(run(['snapshot', '--workspace', root, '--step', '44', '--input', '-'], JSON.stringify({
    artifacts: ['dist/index.html'],
    checks: [{ id: 'navigation', requirement: 'Declared route navigation works' }]
  })));
}

function record(root, snapshotId, status) {
  return run(['record', '--workspace', root, '--step', '44', '--input', '-'], JSON.stringify({
    snapshot_id: snapshotId,
    verifier: { id: 'reviewer', mode: 'independent' },
    outcomes: [{
      id: 'navigation', status, observation: status === 'pass' ? 'Navigation verified' : 'Navigation failed',
      evidence_paths: ['step_archive/outputs/check.json'], next_check: 'Verify route navigation'
    }],
    next_actions: status === 'pass' ? [] : ['Repair navigation and rerun the check']
  }));
}

test('QA CLI rejects ambiguous or unsupported flags without creating reports or echoing input', async t => {
  const root = await workspace(t);
  const base = ['inspect', '--workspace', root, '--step', '44'];
  for (const args of [
    [], ['unknown'], [...base, '--extra', 'private-value'], [...base, '--step', '45'],
    ['inspect', '--workspace', root], ['inspect', '--workspace', root, '--step', '0'],
    ['inspect', '--workspace', root, '--step', '51'], ['inspect', '--workspace', root, '--step', '1.5'],
    ['inspect', '--workspace', root, '--step', '44junk'], [...base, '--input', '-'],
    ['snapshot', '--workspace', root, '--step', '44'],
    ['record', '--workspace', root, '--step', '44', '--input', 'private-file.json'],
    ['inspect', '--workspace=' + root, '--step', '44'], [...base, 'private-value']
  ]) failure(run(args));
  assert.deepEqual(await readdir(join(root, 'step_archive', 'outputs')), ['check.json']);
});

test('QA CLI bounds stdin and rejects malformed UTF-8 or non-object JSON without echo', async t => {
  const root = await workspace(t);
  const args = ['snapshot', '--workspace', root, '--step', '44', '--input', '-'];
  for (const input of [
    '', '{"private-value":', '[]', 'null', '{} {}', Buffer.from([0xc3, 0x28]),
    JSON.stringify({ private: 'private-value'.repeat(6000) })
  ]) failure(run(args, input));
  assert.deepEqual(await readdir(join(root, 'step_archive', 'outputs')), ['check.json']);
});

test('QA CLI returns missing inspection with exit two', async t => {
  const root = await workspace(t);
  const result = success(run(['inspect', '--workspace', root, '--step', '44']), 2);
  assert.equal(result.status, 'missing');
  assert.equal(result.verdict, 'INCOMPLETE');
  assert.deepEqual(result.preserve, []);
});

test('QA CLI records a failing review successfully but inspection exits one', async t => {
  const root = await workspace(t);
  const candidate = snapshot(root);
  assert.equal(typeof candidate.snapshot_id, 'string');
  const saved = success(record(root, candidate.snapshot_id, 'fail'));
  assert.equal(saved.status, 'recorded');
  assert.equal(saved.verdict, 'INCOMPLETE');
  const inspected = success(run(['inspect', '--workspace', root, '--step', '44']), 1);
  assert.equal(inspected.status, 'current');
  assert.equal(inspected.verdict, 'INCOMPLETE');
});

test('QA CLI distinguishes current PASS from stale source and evidence', async t => {
  const root = await workspace(t);
  const candidate = snapshot(root);
  assert.equal(success(record(root, candidate.snapshot_id, 'pass')).verdict, 'PASS');
  const current = success(run(['inspect', '--workspace', root, '--step', '44']));
  assert.equal(current.status, 'current');
  assert.equal(current.verdict, 'PASS');
  assert.deepEqual(current.preserve, ['navigation']);
  await writeFile(join(root, 'step_archive', 'outputs', 'check.json'), '{"passed":false}');
  const staleEvidence = success(run(['inspect', '--workspace', root, '--step', '44']), 2);
  assert.equal(staleEvidence.status, 'stale');
  assert.deepEqual(staleEvidence.preserve, []);
  await writeFile(join(root, 'step_archive', 'outputs', 'check.json'), '{"passed":true}');
  await writeFile(join(root, 'dist', 'index.html'), '<html><body>Changed</body></html>');
  const staleSource = success(run(['inspect', '--workspace', root, '--step', '44']), 2);
  assert.equal(staleSource.status, 'stale');
  assert.deepEqual(staleSource.preserve, []);
});

test('QA CLI hides filesystem and rejected payload details', async t => {
  const root = await workspace(t);
  failure(run(['snapshot', '--workspace', root, '--step', '44', '--input', '-'], JSON.stringify({
    artifacts: ['private-value-does-not-exist.txt'],
    checks: [{ id: 'navigation', requirement: 'Verify navigation' }]
  })));
  failure(run(['record', '--workspace', root, '--step', '44', '--input', '-'], JSON.stringify({
    snapshot_id: 'private-value', password: 'private-value'
  })));
});
