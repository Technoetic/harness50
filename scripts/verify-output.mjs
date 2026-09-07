#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { physicalWorkspace, readSafe, writeSafe, sha256 } from './lib/quality-files.mjs';
import { readRouteManifestBytes, ROUTE_ENTRY_PATH, UNKNOWN_ROUTE_PATH } from './lib/route-contract.mjs';

const ENTRY = 'http://harness50.local/index.html';
const ARTIFACT = 'dist/index.html';
const REPORT = 'step_archive/outputs/browser-output.json';

const ORIGIN = 'http://harness50.local';
const VIEWPORTS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const routeUrl = (routing, path) => routing.mode === 'hash' ? `${ENTRY}#${path}` : `${ORIGIN}${path}`;

async function probeNavigationApi(page, unavailable) {
  const observed = await page.evaluate(() => ({
    available: typeof window.navigation?.navigate === 'function' && typeof window.navigation.addEventListener === 'function' && window.navigation.currentEntry != null &&
      typeof window.NavigateEvent?.prototype?.intercept === 'function',
    property_present: 'navigation' in window
  }));
  if (unavailable && (observed.available || observed.property_present)) throw new Error('Navigation API absence could not be verified');
  return observed;
}

async function assertScreen(page, routing, route, phase, unavailable) {
  await probeNavigationApi(page, unavailable);
  try {
    await page.waitForFunction(({ routing, id, url }) => {
      if (location.href !== url) return false;
      const declarations = [...document.querySelectorAll('#harness50-routes')];
      if (declarations.length !== 1 || declarations[0].tagName !== 'SCRIPT' || declarations[0].parentElement !== document.head || declarations[0].getAttribute('type') !== 'application/json') return false;
      let manifest;
      try { manifest = JSON.parse(declarations[0].textContent); } catch { return false; }
      if (manifest.schema_version !== routing.schema_version || manifest.mode !== routing.mode || manifest.fallback !== routing.fallback ||
        !Array.isArray(manifest.routes) || manifest.routes.length !== routing.routes.length ||
        !manifest.routes.every((route, index) => route?.id === routing.routes[index].id && route?.path === routing.routes[index].path)) return false;
      const roots = [...document.querySelectorAll('[data-harness-screen]')];
      if (roots.length !== routing.routes.length) return false;
      return routing.routes.every(route => {
        const matching = roots.filter(root => root.getAttribute('data-harness-screen') === route.id);
        if (matching.length !== 1) return false;
        const root = matching[0];
        const visible = root.getClientRects().length > 0 && root.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        return visible === (route.id === id);
      });
    }, { routing, id: route.id, url: routeUrl(routing, route.path) }, { timeout: 3000 });
  } catch { throw new Error(`Route ${route.id} failed ${phase}: URL and visible screen must agree`); }
  return probeNavigationApi(page, unavailable);
}

async function measure(page, AxeBuilder) {
  const metrics = await page.evaluate(() => ({
    horizontal_overflow: document.documentElement.scrollWidth > innerWidth + 1,
    visible_text_length: document.body.innerText.trim().length,
    dom_content_loaded_ms: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? null,
    focusable_elements: [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0).length
  }));
  const analysis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return { ...metrics, violations: analysis.violations.map(item => ({ id: item.id, impact: item.impact, affected_nodes: item.nodes.length })), accessibility_incomplete: analysis.incomplete.map(item => item.id) };
}

function passes(metrics) {
  return metrics.errors.length === 0 && metrics.blocked_requests === 0 && metrics.violations.length === 0 && !metrics.horizontal_overflow && metrics.visible_text_length > 0;
}

async function outgoingLink(page, routing, route) {
  const links = page.locator('a[href]');
  for (let index = 0; index < await links.count(); index++) {
    const link = links.nth(index);
    if (!await link.isVisible() || await link.getAttribute('download') !== null || ![null, '', '_self'].includes(await link.getAttribute('target'))) continue;
    const href = await link.evaluate(node => node.href);
    const target = routing.routes.find(item => item.id !== route.id && routeUrl(routing, item.path) === href);
    if (target) return { link, target };
  }
  throw new Error(`Route ${route.id} has no visible link to another declared screen`);
}

export async function verifyOutput(workspaceRoot, { timeoutMs = 60000, executablePath } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) throw new Error('Invalid browser timeout');
  if (executablePath !== undefined && (typeof executablePath !== 'string' || !executablePath.trim())) throw new Error('Invalid browser executable path');
  const root = await physicalWorkspace(workspaceRoot);
  const report = { schema_version: 3, generated_at: new Date().toISOString(), artifact_path: ARTIFACT, verdict: 'FAIL', viewports: [],
    compatibility: { navigation_api_unavailable: { viewports: [] } } };
  let browser, deadline;
  try {
    const bytes = await readSafe(root, ARTIFACT);
    const routing = readRouteManifestBytes(bytes);
    report.routing = routing;
    report.artifact_sha256 = sha256(bytes);
    const started = Date.now();
    deadline = setTimeout(() => { report.error = 'Browser verification exceeded its deadline'; browser?.close().catch(() => {}); }, timeoutMs);
    const [{ chromium }, { default: AxeBuilder }] = await Promise.all([import('playwright'), import('@axe-core/playwright')]);
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), timeout: Math.max(1, Math.min(timeoutMs - (Date.now() - started), 15000)) });
    if (report.error) throw new Error(report.error);
    const allowed = new Set([ROUTE_ENTRY_PATH, ...(routing.mode === 'history' ? [...routing.routes.map(route => route.path), UNKNOWN_ROUTE_PATH] : [])]);
    async function withPage(viewport, unavailable, run) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: 'block', acceptDownloads: false, reducedMotion: 'reduce' });
      if (unavailable) await context.addInitScript(() => {
        // Delete instead of assigning undefined: applications may feature-detect
        // with `in`. Run before application scripts on every new document.
        if (!Reflect.deleteProperty(window, 'navigation') || 'navigation' in window || typeof window.navigation !== 'undefined') {
          throw new Error('Navigation API could not be made unavailable');
        }
      });
      const errors = [];
      let blockedRequests = 0;
      let page;
      const recordError = kind => { if (errors.length < 100) errors.push(kind); };
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.isNavigationRequest() && request.frame() === page?.mainFrame() && url.origin === ORIGIN && !url.search && allowed.has(url.pathname)) await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: bytes });
        else { blockedRequests++; await route.abort('blockedbyclient'); }
      });
      await context.routeWebSocket('**/*', socket => { blockedRequests++; socket.close(); });
      page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', () => recordError('pageerror'));
      page.on('console', message => { if (message.type() === 'error') recordError('console.error'); });
      page.on('crash', () => recordError('crash'));
      page.on('dialog', dialog => { recordError('unexpected-dialog'); dialog.dismiss().catch(() => {}); });
      page.on('popup', popup => { recordError('unexpected-popup'); popup.close().catch(() => {}); });
      page.on('requestfailed', () => recordError('requestfailed'));
      try {
        const result = await run(page);
        return { ...result, errors, blocked_requests: blockedRequests };
      } finally { await context.close(); }
    }
    const fallback = routing.routes.find(route => route.id === routing.fallback);
    for (const scenario of [{ unavailable: false, viewports: report.viewports },
      { unavailable: true, viewports: report.compatibility.navigation_api_unavailable.viewports }]) {
      for (const viewport of VIEWPORTS) {
        const initial = await withPage(viewport, scenario.unavailable, async page => {
          const historyBefore = await page.evaluate(() => history.length);
          await page.goto(ENTRY, { waitUntil: 'load', timeout: 10000 });
          const navigationApi = await assertScreen(page, routing, fallback, 'initial entry', scenario.unavailable);
          if (await page.evaluate(() => history.length) !== historyBefore + 1) throw new Error('Initial fallback must replace its URL');
          await page.evaluate(() => document.fonts.ready);
          const metrics = await measure(page, AxeBuilder);
          await page.keyboard.press('Tab');
          const keyboardFocus = await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== document.documentElement);
          const screenshot = `step_archive/screenshots/verified-${scenario.unavailable ? 'navigation-api-unavailable-' : ''}${viewport.name}.png`;
          await writeSafe(root, screenshot, await page.screenshot({ fullPage: true, animations: 'disabled', timeout: 10000 }));
          const historyAtEntry = await page.evaluate(() => history.length);
          await page.goto(routeUrl(routing, UNKNOWN_ROUTE_PATH), { waitUntil: 'load', timeout: 10000 });
          await assertScreen(page, routing, fallback, 'unknown fallback', scenario.unavailable);
          if (await page.evaluate(() => history.length) !== historyAtEntry + 1) throw new Error('Unknown fallback must replace its URL');
          return { ...metrics, navigation_api: navigationApi, keyboard_focus: keyboardFocus, screenshot, initial_entry: true, unknown_fallback: true };
        });
        const view = { ...viewport, ...initial, routes: [], pass: false };
        scenario.viewports.push(view);
        for (const route of routing.routes) {
          const result = await withPage(viewport, scenario.unavailable, async page => {
            await page.goto(routeUrl(routing, route.path), { waitUntil: 'load', timeout: 10000 });
            const navigationApi = await assertScreen(page, routing, route, 'direct entry', scenario.unavailable);
            await page.evaluate(() => document.fonts.ready);
            const direct = await measure(page, AxeBuilder);
            await page.reload({ waitUntil: 'load', timeout: 10000 });
            await assertScreen(page, routing, route, 'reload', scenario.unavailable);
            const reloaded = await measure(page, AxeBuilder);
            let navigation = { status: 'not-applicable', reason: 'single-screen' };
            if (routing.routes.length > 1) {
              const { link, target } = await outgoingLink(page, routing, route);
              await link.click();
              await assertScreen(page, routing, target, 'navigation', scenario.unavailable);
              await page.goBack({ waitUntil: 'load', timeout: 10000 });
              await assertScreen(page, routing, route, 'back', scenario.unavailable);
              await page.goForward({ waitUntil: 'load', timeout: 10000 });
              await assertScreen(page, routing, target, 'forward', scenario.unavailable);
              navigation = { status: 'pass', target_id: target.id, back: true, forward: true };
            }
            return { ...route, ...reloaded, horizontal_overflow: direct.horizontal_overflow || reloaded.horizontal_overflow,
              visible_text_length: Math.min(direct.visible_text_length, reloaded.visible_text_length),
              violations: [...direct.violations, ...reloaded.violations], accessibility_incomplete: [...new Set([...direct.accessibility_incomplete, ...reloaded.accessibility_incomplete])],
              direct_entry: true, reload: true, navigation, navigation_api: navigationApi };
          });
          result.pass = passes(result);
          view.routes.push(result);
          view.errors.push(...result.errors);
          view.blocked_requests += result.blocked_requests;
          view.violations.push(...result.violations);
          view.horizontal_overflow ||= result.horizontal_overflow;
          view.accessibility_incomplete = [...new Set([...view.accessibility_incomplete, ...result.accessibility_incomplete])];
        }
        view.pass = passes(view) && (view.focusable_elements === 0 || view.keyboard_focus) && view.routes.every(route => route.pass);
      }
    }
    if (sha256(await readSafe(root, ARTIFACT)) !== report.artifact_sha256) throw new Error('HTML changed during browser verification');
    const allViews = [...report.viewports, ...report.compatibility.navigation_api_unavailable.viewports];
    if (!report.error && allViews.length === 4 && allViews.every(view => view.pass)) report.verdict = 'PASS';
  } catch (error) { report.error = error.code === 'ERR_MODULE_NOT_FOUND' ? 'Browser tools missing: run npm ci in the plugin checkout, then npx playwright install chromium' : error.message; }
  finally { clearTimeout(deadline); await browser?.close().catch(() => {}); }
  await writeSafe(root, REPORT, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isMainModule()) {
  const args = process.argv.slice(2);
  const offset = args.indexOf('--workspace');
  const root = offset === -1 ? process.cwd() : args[offset + 1];
  const executableOffset = args.indexOf('--executable-path');
  const executablePath = executableOffset === -1 ? undefined : args[executableOffset + 1];
  if (!root || (executableOffset !== -1 && !executablePath)) { console.error('--workspace and --executable-path require values'); process.exitCode = 1; }
  else verifyOutput(root, { executablePath }).then(report => {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.verdict === 'PASS' ? 0 : 1;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
