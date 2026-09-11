import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateCompletionEvidence } from '../scripts/lib/acceptance.mjs';
import { validateBrowserReportBytes } from '../../scripts/lib/browser-report.mjs';
import { readRouteManifestBytes } from '../../scripts/lib/route-contract.mjs';
import { makeWorkspace } from './helpers/workspace.mjs';
import { prepareQuality, prepareFinalRegression } from './helpers/completion-quality.mjs';
import { completionHtml, passingBrowserReport, routeManifestScript, singleRouteManifest } from './helpers/routing.mjs';

const contract = { number: 50, id: 'step050', acceptance: [
  { id: 'html', kind: 'artifact', required: true, description: 'HTML', path: 'dist/index.html', validator: 'html-document' },
  { id: 'browser', kind: 'artifact', required: true, description: 'Browser', path: 'step_archive/outputs/browser-output.json', validator: 'browser-output' }
] };
const evidence = contract.acceptance.map(item => ({ acceptance_id: item.id, kind: 'artifact', ok: true, detail: 'measured', artifact_path: item.path }));
async function completion(html = completionHtml, mutate = () => {}) {
  const root = await makeWorkspace();
  await mkdir(join(root, 'dist'));
  await mkdir(join(root, 'step_archive/outputs'), { recursive: true });
  const report = passingBrowserReport(createHash('sha256').update(html).digest('hex'));
  mutate(report);
  await writeFile(join(root, 'dist/index.html'), html);
  await writeFile(join(root, 'step_archive/outputs/browser-output.json'), JSON.stringify(report));
  await prepareQuality(root);
  await prepareFinalRegression(root);
  return validateCompletionEvidence({ contract, evidence, workspaceRoot: root });
}

test('fresh completion rejects a historical v1 browser report', async () => {
  await assert.rejects(completion(completionHtml, report => { report.schema_version = 1; }), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
});

test('fresh completion rejects a historical v2 report without measured compatibility', async () => {
  await assert.rejects(completion(completionHtml, report => { report.schema_version = 2; }), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
});

test('fresh completion requires complete, unique and API-absent compatibility measurements', async () => {
  await completion();
  for (const mutate of [
    report => { delete report.compatibility; },
    report => { report.compatibility.navigation_api_unavailable = null; },
    report => { report.compatibility.navigation_api_unavailable.viewports.pop(); },
    report => { report.compatibility.navigation_api_unavailable.viewports[1] = report.compatibility.navigation_api_unavailable.viewports[0]; },
    report => { report.compatibility.navigation_api_unavailable.viewports[0].routes = []; },
    report => { report.compatibility.navigation_api_unavailable.viewports[0].routes.push(report.compatibility.navigation_api_unavailable.viewports[0].routes[0]); },
    report => { report.compatibility.navigation_api_unavailable.viewports[0].routes[0].reload = false; },
    report => { report.compatibility.navigation_api_unavailable.viewports[0].navigation_api.available = true; },
    report => { report.compatibility.navigation_api_unavailable.viewports[0].routes[0].navigation_api.property_present = true; },
    report => { delete report.compatibility.navigation_api_unavailable.viewports[0].routes[0].navigation_api; },
    report => { report.compatibility.navigation_api_unavailable.viewports[0].screenshot = 'step_archive/screenshots/verified-desktop.png'; },
    report => { report.viewports[0].navigation_api.available = 'true'; }
  ]) await assert.rejects(completion(completionHtml, mutate), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
});

test('fresh completion accepts exact route coverage and rejects incomplete, duplicate or different route reports', async () => {
  await completion();
  for (const mutate of [
    report => { delete report.routing; },
    report => { report.viewports[0].routes = []; },
    report => { report.viewports[0].routes.push(report.viewports[0].routes[0]); },
    report => { report.viewports[1].routes[0].id = 'other'; },
    report => { report.viewports[0].routes[0].direct_entry = false; },
    report => { report.viewports[0].routes[0].reload = false; },
    report => { report.viewports[0].unknown_fallback = false; },
    report => { report.routing.routes[0].path = '/other'; for (const view of report.viewports) view.routes[0].path = '/other'; },
    report => { report.viewports[0].routes[0].navigation = { status: 'pass', target_id: 'home', back: true, forward: true }; }
  ]) await assert.rejects(completion(completionHtml, mutate), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
});

test('manifest extraction ignores commented and raw-text fakes and rejects inert, duplicated or missing declarations', async () => {
  const script = routeManifestScript();
  await completion(completionHtml.replace(script, `<!-- ${script} -->${script}`));
  await completion(completionHtml.replace(script, `<title>${script}</title>${script}`));
  for (const fragment of ['', `<!-- ${script} -->`, `<template>${script}</template>`, `<noscript>${script}</noscript>`, `<svg>${script}</svg>`, `${script}${script}`, script.replace('application/json', 'text/plain'), script.replace(' id=', ' src="data:," id=')]) {
    await assert.rejects(completion(completionHtml.replace(script, fragment)), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
  }
  await assert.rejects(completion(completionHtml.replace('</body>', `${script}</body>`)), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
  await assert.rejects(completion(completionHtml.replace(script, script.replace('harness50-routes', 'harness50&#45;routes'))), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
});

test('unsafe, duplicate and unbounded route manifests cannot authorize completion', async () => {
  for (const path of ['https://example.com/', '//host/x', '/a?b', '/a#b', '/a%2fb', '/a\\b', '/a/../b', '/./a', '/a//b', '/a/', '/index.html', '/__harness50_unknown_route__', '/한글', '/' + 'a'.repeat(256)]) {
    const manifest = structuredClone(singleRouteManifest);
    manifest.routes[0].path = path;
    await assert.rejects(completion(completionHtml.replace(routeManifestScript(), routeManifestScript(manifest))), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
  }
  for (const mutate of [
    value => { value.schema_version = 2; }, value => { value.fallback = 'missing'; },
    value => { value.fallback = true; value.routes[0].id = true; },
    value => { value.mode = 'query'; }, value => { value.routes = []; },
    value => { value.routes.push({ id: 'home', path: '/other' }); },
    value => { value.routes.push({ id: 'other', path: '/' }); },
    value => { value.routes[0].id = 'x'.repeat(65); },
    value => { value.extra = true; },
    value => { value.routes = Array.from({ length: 51 }, (_, i) => ({ id: `r${i}`, path: `/r${i}` })); value.fallback = 'r0'; }
  ]) {
    const manifest = structuredClone(singleRouteManifest); mutate(manifest);
    await assert.rejects(completion(completionHtml.replace(routeManifestScript(), routeManifestScript(manifest))), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
  }
});

test('literal IDs, JSON keys and HTML attributes cannot disguise a second manifest', async () => {
  const script = routeManifestScript();
  for (const html of [
    completionHtml.replace('</body>', `${script.replace('harness50-routes', 'harness50&#45;routes')}</body>`),
    completionHtml.replace(script, script.replace('id="harness50-routes"', 'id="harness50-routes" ID="another"')),
    completionHtml.replace(script, script.replace('"schema_version":1', '"schema_version":0,"schema_version":1')),
    completionHtml.replace(script, script.replace('type="application/json"', 'type=application/json'))
  ]) await assert.rejects(completion(html), error => error.code === 'ACCEPTANCE_ARTIFACT_CONTENT');
});

test('route identifiers must be actual strings without JSON coercion', () => {
  const manifest = { schema_version: 1, mode: 'hash', fallback: true, routes: [{ id: true, path: '/' }] };
  assert.throws(() => readRouteManifestBytes(Buffer.from(completionHtml.replace(routeManifestScript(), routeManifestScript(manifest)))));
});

test('multi-screen report requires actual navigation and history coverage to another declared screen', () => {
  const manifest = { schema_version: 1, mode: 'history', fallback: 'home', routes: [{ id: 'home', path: '/' }, { id: 'orders', path: '/orders.html' }] };
  const report = passingBrowserReport('a'.repeat(64), manifest);
  assert.doesNotThrow(() => validateBrowserReportBytes(Buffer.from(JSON.stringify(report))));
  for (const mutate of [
    value => { value.viewports[0].routes[0].navigation.back = false; },
    value => { value.viewports[0].routes[0].navigation.forward = false; },
    value => { value.viewports[0].routes[0].navigation.target_id = 'home'; },
    value => { value.viewports[0].routes[0].navigation.target_id = 'missing'; },
    value => { value.viewports[0].routes[0].navigation = { status: 'not-applicable', reason: 'single-screen' }; }
  ]) {
    const changed = structuredClone(report); mutate(changed);
    assert.throws(() => validateBrowserReportBytes(Buffer.from(JSON.stringify(changed))));
  }
});
