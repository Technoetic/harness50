import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { makeWorkspace } from '../codex/tests/helpers/workspace.mjs';

const example = await readFile(new URL('../examples/routed-single-file.html', import.meta.url), 'utf8');
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.HARNESS50_BROWSER_PATH ? { executablePath: process.env.HARNESS50_BROWSER_PATH } : {}) });
});
after(async () => { await browser?.close(); });

async function fixture(t, { mode = 'hash', capability = 'native', file = false, forceCannotIntercept = false, ordinaryAnchor = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  t.after(() => context.close());
  let html = mode === 'history' ? example.replace('"mode":"hash"', '"mode":"history"').replaceAll('href="#/', 'href="/') : example;
  if (ordinaryAnchor) html = html.replace('<p>Sample orders for this demonstration.</p>', '<p>Sample orders for this demonstration.</p><a href="#details">Order details</a><p id="details">Order details anchor.</p>');
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (file && url.href === entry && route.request().isNavigationRequest()) await route.continue();
    else if (url.origin === origin && route.request().isNavigationRequest()) await route.continue();
    else await route.abort();
  });
  await context.addInitScript(({ capability, forceCannotIntercept }) => {
    window.__routerProbe = { intercepts: 0, renders: 0, pushes: 0, replaces: 0, errors: [] };
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (...args) {
      if (this.matches('h1') && this.closest('[data-harness-screen]')) window.__routerProbe.renders++;
      return focus.apply(this, args);
    };
    for (const [method, metric] of [['pushState', 'pushes'], ['replaceState', 'replaces']]) {
      const original = history[method];
      history[method] = function (...args) { window.__routerProbe[metric]++; return original.apply(this, args); };
    }
    addEventListener('error', event => window.__routerProbe.errors.push(event.message));
    addEventListener('unhandledrejection', event => window.__routerProbe.errors.push(String(event.reason)));
    if (window.NavigateEvent?.prototype.intercept) {
      const intercept = NavigateEvent.prototype.intercept;
      NavigateEvent.prototype.intercept = function (...args) { window.__routerProbe.intercepts++; return intercept.apply(this, args); };
    }
    if (forceCannotIntercept) navigation.addEventListener('navigate', event => Object.defineProperty(event, 'canIntercept', { value: false }));
    if (capability === 'absent') {
      Reflect.deleteProperty(window, 'navigation');
      if ('navigation' in window) throw new Error('Navigation API removal fixture failed');
    }
    if (capability === 'opaque') Object.defineProperty(window.navigation, 'currentEntry', { get: () => null });
    if (capability === 'no-intercept') Object.defineProperty(NavigateEvent.prototype, 'intercept', { value: undefined });
    if (capability === 'no-navigate') Object.defineProperty(window.navigation, 'navigate', { value: undefined });
    if (capability === 'no-listener') Object.defineProperty(window.navigation, 'addEventListener', { value: undefined });
  }, { capability, forceCannotIntercept });
  const page = await context.newPage();
  let entry = `${origin}/index.html`;
  if (file) {
    const workspace = await makeWorkspace();
    const path = join(workspace, 'example.html');
    await writeFile(path, html);
    entry = pathToFileURL(path).href;
  }
  const url = path => mode === 'hash' ? `${entry}#${path}` : `${origin}${path}`;
  const go = async path => { await page.goto(url(path)); await screen(page, path === '/' ? 'home' : path.slice(1), url(path)); };
  return { context, page, entry, url, go, requests };
}

async function screen(page, id, url, { checkFocus = true } = {}) {
  await page.waitForFunction(({ id, url }) => location.href === url &&
    [...document.querySelectorAll('[data-harness-screen]')].every(node => (node.getClientRects().length > 0) === (node.dataset.harnessScreen === id)), { id, url }, { timeout: 3000 });
  const state = await page.evaluate(() => ({
    title: document.title,
    focus: document.activeElement.closest('[data-harness-screen]')?.dataset.harnessScreen,
    current: [...document.querySelectorAll('nav a[aria-current="page"]')].map(node => node.textContent),
    errors: window.__routerProbe.errors
  }));
  assert.ok(state.title.includes(id === 'home' ? 'Your work' : id[0].toUpperCase() + id.slice(1)));
  if (checkFocus) assert.equal(state.focus, id);
  assert.deepEqual(state.current, [id[0].toUpperCase() + id.slice(1)]);
  assert.deepEqual(state.errors, []);
}

for (const mode of ['hash', 'history']) {
  for (const capability of ['native', 'absent', ...(mode === 'history' ? ['opaque', 'no-intercept', 'no-navigate', 'no-listener'] : [])]) {
    test(`${mode} router ${capability} restores direct/reload/link/back/forward with one render per transition`, async t => {
      const { page, go, url } = await fixture(t, { mode, capability });
      await go('/orders');
      await page.reload();
      await screen(page, 'orders', url('/orders'));
      const before = await page.evaluate(() => ({ ...window.__routerProbe, length: history.length }));
      await page.getByRole('link', { name: 'Settings', exact: true }).click();
      await screen(page, 'settings', url('/settings'));
      const next = await page.evaluate(() => ({ ...window.__routerProbe, length: history.length }));
      assert.equal(next.length, before.length + 1);
      assert.equal(next.renders, before.renders + 1);
      assert.equal(next.intercepts - before.intercepts, capability === 'native' ? 1 : 0);
      await page.goBack();
      await screen(page, 'orders', url('/orders'));
      assert.equal(await page.evaluate(() => window.__routerProbe.renders), next.renders + 1);
      await page.goForward();
      await screen(page, 'settings', url('/settings'));
      assert.equal(await page.evaluate(() => window.__routerProbe.renders), next.renders + 2);
    });
  }
}

test('file URLs retain ordinary hash routing even when Navigation API is exposed', async t => {
  const { page, go, url } = await fixture(t, { file: true });
  await go('/orders');
  await page.reload();
  await screen(page, 'orders', url('/orders'));
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await screen(page, 'settings', url('/settings'));
  await page.goBack(); await screen(page, 'orders', url('/orders'));
  await page.goForward(); await screen(page, 'settings', url('/settings'));
  assert.equal(await page.evaluate(() => window.__routerProbe.intercepts), 0);
});

for (const capability of ['native', 'absent']) {
  test(`${capability} hash routing replaces an active unknown route and preserves ordinary anchors`, async t => {
    const { page, go, url } = await fixture(t, { capability });
    await go('/orders');
    const unknownBefore = await page.evaluate(() => ({ ...window.__routerProbe, length: history.length }));
    await page.evaluate(() => { location.hash = '/missing'; });
    await screen(page, 'home', url('/'));
    const unknownAfter = await page.evaluate(() => ({ ...window.__routerProbe, length: history.length }));
    assert.equal(unknownAfter.length, unknownBefore.length + 1);
    assert.equal(unknownAfter.replaces, unknownBefore.replaces + 1);
    assert.equal(unknownAfter.renders, unknownBefore.renders + 1);
    assert.equal(unknownAfter.intercepts - unknownBefore.intercepts, capability === 'native' ? 1 : 0);
    await page.evaluate(() => {
      const anchor = document.createElement('a'); anchor.href = '#local-heading'; anchor.textContent = 'Local anchor';
      const target = document.createElement('p'); target.id = 'local-heading'; target.textContent = 'Anchor target';
      document.querySelector('[data-harness-screen="home"]').append(anchor, target);
    });
    const before = await page.evaluate(() => ({ ...window.__routerProbe }));
    await page.getByRole('link', { name: 'Local anchor' }).click();
    await page.waitForURL('**#local-heading');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.ok(page.url().endsWith('#local-heading'));
    const after = await page.evaluate(() => ({ ...window.__routerProbe }));
    assert.equal(after.renders, before.renders);
    assert.equal(after.intercepts, before.intercepts);
    assert.equal(await page.locator('[data-harness-screen="home"]').isVisible(), true);
  });
}

for (const mode of ['hash', 'history']) for (const capability of ['native', 'absent']) {
  test(`${mode} ${capability} cold entry and unknown routes replace the URL without extra history`, async t => {
    const { page, entry, url } = await fixture(t, { mode, capability });
    const before = await page.evaluate(() => history.length);
    await page.goto(entry);
    await screen(page, 'home', url('/'));
    assert.equal(await page.evaluate(() => history.length), before + 1);
    const entered = await page.evaluate(() => history.length);
    await page.goto(url('/missing'));
    await screen(page, 'home', url('/'));
    assert.equal(await page.evaluate(() => history.length), entered + 1);
    assert.deepEqual(await page.evaluate(() => window.__routerProbe.errors), []);
  });
}

for (const capability of ['native', 'absent']) {
  test(`${capability} history routing preserves ordinary anchors on direct entry, reload, click and traversal`, async t => {
    const { page, go, url } = await fixture(t, { mode: 'history', capability, ordinaryAnchor: true });
    const anchorUrl = `${url('/orders')}#details`;
    await page.goto(anchorUrl);
    await screen(page, 'orders', anchorUrl, { checkFocus: false });
    await page.reload();
    await screen(page, 'orders', anchorUrl, { checkFocus: false });
    await go('/orders');
    const before = await page.evaluate(() => ({ ...window.__routerProbe, length: history.length }));
    await page.getByRole('link', { name: 'Order details' }).click();
    await page.waitForURL(anchorUrl);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await screen(page, 'orders', anchorUrl, { checkFocus: false });
    const anchored = await page.evaluate(() => ({ ...window.__routerProbe, length: history.length }));
    assert.equal(anchored.length, before.length + 1);
    assert.equal(anchored.renders, before.renders, 'ordinary anchor scrolling must not rerender the screen');
    assert.equal(anchored.intercepts, before.intercepts);
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await screen(page, 'settings', url('/settings'));
    await page.goBack();
    await screen(page, 'orders', anchorUrl, { checkFocus: false });
    await page.goForward();
    await screen(page, 'settings', url('/settings'));
  });

  test(`${capability} GET forms to an app path still submit a new document`, async t => {
    const { page, go, url, requests } = await fixture(t, { mode: 'history', capability });
    await go('/orders');
    await page.evaluate(() => {
      const form = document.createElement('form'); form.action = '/settings'; form.method = 'get';
      const button = document.createElement('button'); button.type = 'submit'; button.textContent = 'Submit settings';
      form.append(button); document.querySelector('[data-harness-screen="orders"]').append(form);
    });
    const documents = requests.length;
    await page.getByRole('button', { name: 'Submit settings' }).click();
    await screen(page, 'settings', url('/settings'));
    assert.ok(requests.length > documents, 'GET form was intercepted as an app link');
    assert.equal(await page.evaluate(() => window.__routerProbe.intercepts), 0);
  });

  test(`${capability} real new-tab and modified clicks preserve the current screen`, async t => {
    const { page, context, go, url } = await fixture(t, { mode: 'history', capability });
    await go('/orders');
    for (const target of ['_blank', '']) {
      const link = page.getByRole('link', { name: 'Settings', exact: true });
      await link.evaluate((node, target) => { node.target = target; }, target);
      const popupPromise = context.waitForEvent('page');
      await link.click(target ? {} : { modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
      const popup = await popupPromise;
      await popup.waitForLoadState();
      try { await screen(popup, 'settings', url('/settings')); }
      catch (error) {
        throw new Error(`Popup target=${JSON.stringify(target)} url=${popup.url()} state=${JSON.stringify(await popup.evaluate(() => ({ ready: document.readyState, title: document.title, probe: window.__routerProbe, body: document.body.innerText.slice(0, 100) })))}`, { cause: error });
      }
      await screen(page, 'orders', url('/orders'), { checkFocus: false });
      assert.equal(await page.evaluate(() => window.__routerProbe.intercepts), 0);
      assert.equal(await page.evaluate(() => window.__routerProbe.renders), 1);
      await popup.close();
    }
  });
}

test('native navigation honors canIntercept=false and permits a normal document navigation', async t => {
  const { page, go, url, requests } = await fixture(t, { mode: 'history', forceCannotIntercept: true });
  await go('/orders');
  const documents = requests.length;
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await screen(page, 'settings', url('/settings'));
  assert.ok(requests.length > documents, 'link should load a new document when interception is unavailable');
  assert.equal(await page.evaluate(() => window.__routerProbe.intercepts), 0);
});

for (const capability of ['native', 'absent']) {
  test(`${capability} router leaves modified, new-tab, download, external, anchor and form actions native`, async t => {
    const { page, go } = await fixture(t, { mode: 'history', capability });
    await go('/orders');
    const results = await page.evaluate(() => {
      const results = [];
      const root = document.querySelector('[data-harness-screen="orders"]');
      document.addEventListener('click', event => { results.push(event.defaultPrevented); event.preventDefault(); });
      const cases = [
        { href: '/settings', ctrlKey: true }, { href: '/settings', metaKey: true },
        { href: '/settings', shiftKey: true }, { href: '/settings', altKey: true },
        { href: '/settings', button: 1 }, { href: '/settings', target: '_blank' },
        { href: '/settings', download: 'settings.html' }, { href: 'https://example.invalid/settings' },
        { href: '#details' }
      ];
      for (const item of cases) {
        const link = document.createElement('a'); link.href = item.href;
        if (item.target) link.target = item.target;
        if (item.download) link.download = item.download;
        root.append(link);
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: item.button ?? 0,
          ctrlKey: item.ctrlKey, metaKey: item.metaKey, shiftKey: item.shiftKey, altKey: item.altKey }));
        link.remove();
      }
      const form = document.createElement('form'); form.action = '/settings'; root.append(form);
      let formPrevented;
      document.addEventListener('submit', event => { formPrevented = event.defaultPrevented; event.preventDefault(); }, { once: true });
      form.requestSubmit();
      return { results, formPrevented, probe: window.__routerProbe, path: location.pathname };
    });
    assert.deepEqual(results.results, Array(9).fill(false));
    assert.equal(results.formPrevented, false);
    assert.equal(results.path, '/orders');
    assert.equal(results.probe.renders, 1);
    assert.equal(results.probe.intercepts, 0);
  });
}
