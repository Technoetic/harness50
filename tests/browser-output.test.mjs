import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { makeWorkspace } from '../codex/tests/helpers/workspace.mjs';
import { verifyOutput } from '../scripts/verify-output.mjs';
import { routeManifestScript } from '../codex/tests/helpers/routing.mjs';

const browserOptions = process.env.HARNESS50_BROWSER_PATH ? { executablePath: process.env.HARNESS50_BROWSER_PATH } : {};

test('browser CLI invoked through a directory alias rejects a missing artifact', async () => {
  const root = await makeWorkspace();
  const alias = join(root, 'cli');
  await symlink(fileURLToPath(new URL('../scripts/', import.meta.url)), alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(promisify(execFile)(process.execPath, [join(alias, 'verify-output.mjs'), '--workspace', root]),
    error => error.code === 1 && JSON.parse(error.stdout).verdict === 'FAIL');
});

const document = (body, { routed = true } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Interactive example</title><style>body{margin:24px;background:#fff;color:#111;font:18px Arial}button{font:inherit;padding:12px}</style>${routed ? routeManifestScript() : ''}</head><body><main ${routed ? 'data-harness-screen="home"' : ''}><h1>Interactive example</h1>${body}</main>${routed ? '<script>function render(){if(location.hash!=="#/")history.replaceState(null,"","#/")}addEventListener("hashchange",render);render()</script>' : ''}</body></html>`;
async function fixture(body) {
  const root = await makeWorkspace();
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'dist', 'index.html'), document(body));
  return root;
}

test('Chromium validates a working document at desktop and mobile sizes', async () => {
  const root = await fixture('<p>Explore an accessible interactive example.</p><button onclick="this.textContent=\'Activated\'">Activate</button>');
  const report = await verifyOutput(root, browserOptions);
  assert.equal(report.verdict, 'PASS', JSON.stringify(report));
  assert.equal(report.viewports.length, 2);
  for (const viewport of report.viewports) assert.ok((await readFile(join(root, viewport.screenshot))).length > 100);
  assert.match(report.artifact_sha256, /^[a-f0-9]{64}$/);
  assert.equal(report.schema_version, 2);
  assert.equal(report.viewports[0].routes[0].navigation.status, 'not-applicable');
});

test('runtime errors, inaccessible controls and unavailable network dependencies fail', async () => {
  const root = await fixture('<button></button><script>throw new Error("fixture failure")</script><script src="https://example.invalid/dependency.js"></script>');
  const report = await verifyOutput(root, browserOptions);
  assert.equal(report.verdict, 'FAIL');
  assert.ok(report.viewports.some(view => view.errors.length > 0));
  assert.ok(report.viewports.some(view => view.violations.some(item => item.id === 'button-name')));
  assert.ok(report.viewports.some(view => view.blocked_requests > 0));
});

test('mobile overflow is a measurable failure', async () => {
  const root = await fixture('<p style="width:1000px">Overflow</p>');
  const report = await verifyOutput(root, browserOptions);
  assert.equal(report.verdict, 'FAIL');
  assert.equal(report.viewports.find(item => item.name === 'mobile').horizontal_overflow, true);
});

test('a nonterminating page is closed by the verification deadline', { timeout: 20000 }, async () => {
  const root = await fixture('<script>while (true) {}</script>');
  const started = Date.now();
  const report = await verifyOutput(root, { ...browserOptions, timeoutMs: 1000 });
  assert.equal(report.verdict, 'FAIL');
  assert.ok(report.error);
  assert.ok(Date.now() - started < 15000, 'browser deadline did not bound the stalled page');
});

test('a URL-less single HTML without the screen manifest fails fresh verification', async () => {
  const root = await fixture('<p>Screen tabs do not create addresses.</p><button>Orders</button>');
  await writeFile(join(root, 'dist/index.html'), document('<button>Orders</button>', { routed: false }));
  const report = await verifyOutput(root, browserOptions);
  assert.equal(report.verdict, 'FAIL');
  assert.match(report.error, /manifest/i);
});

async function routingFixture(mode = 'hash', fault = '') {
  const manifest = { schema_version: 1, mode, fallback: 'home', routes: [{ id: 'home', path: '/' }, { id: 'orders', path: '/orders' }, { id: 'settings', path: '/settings.html' }] };
  const href = path => mode === 'hash' ? `#${path}` : path;
  const screens = manifest.routes.map((route, index) => `<section data-harness-screen="${route.id}" hidden><h2>${route.id}</h2><p>Independent ${route.id} screen.</p><a href="${href(manifest.routes[(index + 1) % 3].path)}">Next screen</a>${fault === 'route-errors' && route.id === 'orders' ? '<button></button><p style="width:2000px">Orders overflow</p>' : ''}</section>`).join('');
  const app = `<script>
    const routes=${JSON.stringify(manifest.routes)}, mode=${JSON.stringify(mode)}, fault=${JSON.stringify(fault)};
    function path(){return mode==='hash'?location.hash.slice(1):location.pathname}
    function href(path){return mode==='hash'?'#'+path:path}
    function show(route){document.querySelectorAll('[data-harness-screen]').forEach(el=>el.hidden=el.dataset.harnessScreen!==route.id);document.title=route.id}
    function render(initial=false){
      let route=routes.find(route=>route.path===path());
      if(!route){if(fault==='unknown'&&path().includes('__harness50_unknown'))return;route=routes[0];history.replaceState(null,'',href(route.path))}
      if(fault==='direct'&&initial)route=routes[0];
      if(fault==='reload'&&performance.getEntriesByType('navigation')[0]?.type==='reload')route=routes[0];
      show(route);
      if(fault==='route-errors'&&route.id==='orders'){console.error('orders only');fetch('https://example.invalid/orders')}
    }
    addEventListener(mode==='hash'?'hashchange':'popstate',()=>{if(fault!=='history')render()});
    document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;event.preventDefault();const target=routes.find(route=>href(route.path)===link.getAttribute('href'));if(fault!=='url-less')history.pushState(null,'',href(target.path));show(target)});
    render(true);
  </script>`;
  let html = document(screens, { routed: false }).replace('</head>', `${routeManifestScript(manifest)}</head>`).replace('</body>', `${app}</body>`);
  if(fault==='duplicate-root')html=html.replace('</main>','<section data-harness-screen="orders" hidden>Duplicate</section></main>');
  if(fault==='omitted-root')html=html.replace('data-harness-screen="orders"','data-harness-screen="undeclared"');
  if(fault==='property-order')html=html.replace(routeManifestScript(manifest),routeManifestScript({...manifest,routes:manifest.routes.map(route=>({path:route.path,id:route.id}))}));
  const root = await makeWorkspace();
  await mkdir(join(root,'dist'));
  await writeFile(join(root,'dist/index.html'),html);
  return root;
}

for (const mode of ['hash', 'history']) test(`${mode} routing verifies cold entry, reload, real links and back/forward for every screen`, async () => {
  const root = await routingFixture(mode);
  const report = await verifyOutput(root, browserOptions);
  assert.equal(report.verdict,'PASS',JSON.stringify(report));
  assert.equal(report.schema_version,2);
  for(const view of report.viewports){
    assert.deepEqual(view.routes.map(route=>route.id),['home','orders','settings']);
    assert.equal(view.initial_entry,true);assert.equal(view.unknown_fallback,true);
    for(const route of view.routes){assert.equal(route.direct_entry,true);assert.equal(route.reload,true);assert.equal(route.navigation.status,'pass');assert.equal(route.navigation.back,true);assert.equal(route.navigation.forward,true);}
  }
});

test('route JSON property order does not change screen identity',async()=>{
  const report=await verifyOutput(await routingFixture('hash','property-order'),browserOptions);
  assert.equal(report.verdict,'PASS',JSON.stringify(report));
});

for(const fault of ['url-less','direct','reload','history','unknown','duplicate-root','omitted-root'])test(`route verifier rejects ${fault} application behavior`,async()=>{
  const report=await verifyOutput(await routingFixture('hash',fault),{...browserOptions,timeoutMs:20000});
  assert.equal(report.verdict,'FAIL',JSON.stringify(report));
});

test('errors, overflow, accessibility and network are checked on non-initial screens',async()=>{
  const report=await verifyOutput(await routingFixture('hash','route-errors'),browserOptions);
  assert.equal(report.verdict,'FAIL');
  const orders=report.viewports[0].routes.find(route=>route.id==='orders');
  assert.equal(orders.horizontal_overflow,true);
  assert.ok(orders.violations.some(item=>item.id==='button-name'));
  assert.ok(orders.errors.length>0);assert.ok(orders.blocked_requests>0);
});

test('the shipped three-screen example passes the measured verifier',async()=>{
  const root=await makeWorkspace();await mkdir(join(root,'dist'));
  await writeFile(join(root,'dist/index.html'),await readFile(new URL('../examples/routed-single-file.html',import.meta.url)));
  const report=await verifyOutput(root,browserOptions);
  assert.equal(report.verdict,'PASS',JSON.stringify(report));
  assert.deepEqual(report.routing.routes.map(route=>route.id),['home','orders','settings']);
});
