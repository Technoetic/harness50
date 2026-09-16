// Aside backend for scripts/verify-output.mjs (see the dispatcher for the contract).
// Runs the same unit sequence as the Playwright backend inside the user's Aside Browser through
// `aside repl`: one CLI call ("chunk") per scenario x viewport x unit, each against a fresh
// 127.0.0.1 origin (fresh storage) that serves the artifact with an injected bridge script.
// Measured constraints (docs/BROWSER-TOOLS.md): no file://, 120 s per call, output only inside
// the CLI session directory, shared profile, fixed 1440x900 tab (viewports are iframes).
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';
import { BLANK_PAGE, HARNESS_PREFIX, bridgeScript, chunkScript, hostPage } from './aside/page-scripts.mjs';

const ASIDE = 'aside';
const DEADLINE = 'Browser verification exceeded its deadline';
const MISSING_ASIDE = 'Browser tools missing: install the Aside CLI (aside --version) and start the Aside app';
const MISSING_AXE = 'Browser tools missing: run npm ci in the plugin checkout (axe-core)';
const RESULT_PREFIX = '__H50__';
// Like Playwright's route abort: nothing may load from the network, including same-origin
// subresources; data:/blob: never leave the page (Playwright does not intercept them either).
// No base-uri/form-action directives: Playwright polices neither (a `<base>` element is a
// contract-permitted head child), and a form submission still ends in a blocked request.
const CSP_APP = "default-src data: blob:; script-src 'unsafe-inline' 'unsafe-eval' data: blob:; style-src 'unsafe-inline' data: blob:; connect-src data: blob:";
const CSP_HOST = "default-src 'none'; frame-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:";

function exec(args, { timeout, maxBuffer = 16 * 1024 * 1024 } = {}) {
  return new Promise(resolve => {
    execFile(ASIDE, args, { windowsHide: true, maxBuffer, timeout, encoding: 'utf8' }, (error, stdout, stderr) => resolve({ error, stdout: stdout ?? '', stderr: stderr ?? '' }));
  });
}

export async function available() {
  try {
    const { error, stdout } = await exec(['--version'], { timeout: 10000 });
    return !error && /\d/.test(stdout);
  } catch { return false; }
}

let versionCache;
export async function toolVersion() {
  try {
    versionCache ??= await exec(['--version'], { timeout: 10000 }).then(({ error, stdout }) => (!error && stdout.trim()) || null);
    return versionCache;
  } catch { return null; }
}

async function loadAxe() {
  try { return await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js')); }
  catch { throw new Error(MISSING_AXE); }
}

// Places the bridge right after <head …> (else after <html …>, else first) without parsing
// the untrusted document; byte offsets come from the latin1 view so the artifact bytes are kept.
// Tags inside `<!-- … -->` are skipped, as the route contract skips comments before the head.
function inject(bytes, bridge) {
  const text = bytes.toString('latin1');
  const comments = [];
  let scan = text.indexOf('<!--');
  while (scan >= 0) {
    const end = text.indexOf('-->', scan + 4);
    comments.push([scan, end < 0 ? text.length : end + 3]);
    scan = end < 0 ? -1 : text.indexOf('<!--', end + 3);
  }
  const commented = index => comments.some(([start, end]) => index >= start && index < end);
  const locate = pattern => { for (const match of text.matchAll(pattern)) if (!commented(match.index)) return match; return null; };
  const tag = locate(/<head(?:\s(?:[^"'>]|"[^"]*"|'[^']*')*)?>/gi) ?? locate(/<html(?:\s(?:[^"'>]|"[^"]*"|'[^']*')*)?>/gi);
  const at = tag ? tag.index + tag[0].length : 0;
  return Buffer.concat([bytes.subarray(0, at), Buffer.from(bridge, 'utf8'), bytes.subarray(at)]);
}

function startServer({ document, allowed, axe }) {
  const state = { blocked: 0 };
  const html = (response, body, csp) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': csp, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-length': Buffer.byteLength(body) });
    response.end(body);
  };
  const server = createServer((request, response) => {
    let url;
    try { url = new URL(request.url, 'http://127.0.0.1'); } catch { url = null; }
    const pathname = url?.pathname, size = name => Math.min(4096, Math.max(1, Math.trunc(Number(url.searchParams.get(name))) || 1));
    if (!url || request.method !== 'GET') { state.blocked++; response.writeHead(404); response.end(); }
    else if (pathname === `${HARNESS_PREFIX}host.html`) html(response, hostPage(size('w'), size('h')), CSP_HOST);
    else if (pathname === `${HARNESS_PREFIX}blank.html`) html(response, BLANK_PAGE, CSP_HOST);
    else if (pathname === `${HARNESS_PREFIX}axe.min.js`) { response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store', 'content-length': axe.length }); response.end(axe); }
    else if (!url.search && allowed.has(pathname)) html(response, document, CSP_APP);
    else { state.blocked++; response.writeHead(404, { 'cache-control': 'no-store' }); response.end(); }
  });
  server.on('connection', socket => socket.setNoDelay(true));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      origin: `http://127.0.0.1:${server.address().port}`, state,
      close: () => new Promise(done => { server.closeAllConnections(); server.close(() => done()); })
    }));
  });
}

const stripAnsi = text => text.replace(/\x1b\[[0-9;]*m/g, '');

function parseResult(stdout) {
  for (const line of stripAnsi(stdout).split(/\r?\n/)) {
    if (!line.startsWith(RESULT_PREFIX)) continue;
    try { return JSON.parse(line.slice(RESULT_PREFIX.length)); } catch { return null; }
  }
  return null;
}

function failureMessage(error, stdout, stderr) {
  const text = stripAnsi(`${stderr}\n${stdout}`);
  const notRunning = /Aside isn't running[^\r\n]*/.exec(text);
  if (notRunning) return notRunning[0].trim();
  if (error?.code === 'ENOENT') return MISSING_ASIDE;
  const first = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('✔') && !/^\[ok \|/.test(line));
  return `aside repl failed${first ? `: ${first.slice(0, 300)}` : ''}`;
}

async function screenshotBytes(sessionDir, name) {
  if (typeof sessionDir !== 'string' || !isAbsolute(sessionDir)) throw new Error('Aside session directory was not reported');
  const path = join(sessionDir, 'artifacts', name);
  let bytes;
  try { bytes = await readFile(path); }
  catch { throw new Error('Screenshot was not produced'); }
  await unlink(path).catch(() => {});
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47) throw new Error('Screenshot was not a PNG');
  return bytes;
}

export async function run(ctx) {
  const { root, bytes, routing, report, timeoutMs, viewports, origin: contractOrigin, routeUrl, passes, screenshotPath, writeSafe, ROUTE_ENTRY_PATH, UNKNOWN_ROUTE_PATH } = ctx;
  const axe = await loadAxe();
  const tool_version = await toolVersion();
  report.environment = { backend: 'aside', isolation: 'shared-profile', deadline_scope: 'chunk', viewport_mode: 'iframe', screenshot_mode: 'viewport-clip',
    browser: null, dpr: null, color_scheme: null, reduced_motion: null, language: null, tool_version };
  const allowed = new Set([ROUTE_ENTRY_PATH, ...(routing.mode === 'history' ? [...routing.routes.map(route => route.path), UNKNOWN_ROUTE_PATH] : [])]);
  const documents = { available: inject(bytes, bridgeScript(false)), unavailable: inject(bytes, bridgeScript(true)) };
  // The chunk script rebuilds route URLs on its own origin; refuse silently diverging schemes.
  for (const path of [...routing.routes.map(route => route.path), UNKNOWN_ROUTE_PATH]) {
    if (routeUrl(routing, path) !== `${contractOrigin}${routing.mode === 'hash' ? `${ROUTE_ENTRY_PATH}#${path}` : path}`) throw new Error('Aside backend cannot map the route URL scheme');
  }

  // deadline_scope is 'chunk': timeoutMs bounds each CLI call. Measured: a chunk killed at the
  // deadline leaves its tab visible for about 40 s until the Aside daemon reaps the session.
  async function chunk({ unavailable, viewport, unit, routeIndex, shotName }) {
    const server = await startServer({ document: unavailable ? documents.unavailable : documents.available, allowed, axe });
    const started = Date.now();
    try {
      // The dispatcher's ORIGIN/routeUrl name the routes; this chunk serves them from its own origin.
      const script = chunkScript({ routing, unavailable, origin: server.origin, width: viewport.width, height: viewport.height, unit, routeIndex, shotName,
        entryPath: ROUTE_ENTRY_PATH, unknownPath: UNKNOWN_ROUTE_PATH });
      const { error, stdout, stderr } = await exec(['repl', script], { timeout: timeoutMs });
      if (error?.killed) throw new Error(DEADLINE);
      const result = parseResult(stdout);
      if (process.env.HARNESS50_ASIDE_DEBUG) process.stderr.write(`[aside] ${unit}${routeIndex >= 0 ? `#${routeIndex}` : ''} exit=${error?.code ?? 0} stdout=${JSON.stringify(stripAnsi(stdout).slice(-1500))} stderr=${JSON.stringify(stderr.slice(0, 500))}\n`);
      if (!result) throw new Error(failureMessage(error, stdout, stderr));
      if (!result.ok) {
        ctx.onChunk?.({ unavailable, viewport: viewport.name, unit, routeIndex, ms: Date.now() - started, timings: result.timings, error: result.error });
        throw new Error(result.error || 'aside repl failed');
      }
      if (report.environment.browser === null && result.env) {
        const chrome = /Chrome\/(\d+)/.exec(result.env.ua ?? '');
        Object.assign(report.environment, { browser: chrome ? `Chrome/${chrome[1]}` : null, dpr: result.env.dpr ?? null,
          color_scheme: result.env.dark ? 'dark' : 'light', reduced_motion: result.env.reduced_motion ?? null, language: result.env.language ?? null });
      }
      const errors = [...result.errors];
      for (let count = 0; count < server.state.blocked && errors.length < 100; count++) errors.push('requestfailed');
      const value = { ...result.result, errors, blocked_requests: result.blocked + server.state.blocked };
      if (shotName) value.screenshot_bytes = await screenshotBytes(result.pwd, shotName);
      ctx.onChunk?.({ unavailable, viewport: viewport.name, unit, routeIndex, ms: Date.now() - started, timings: result.timings });
      return value;
    } finally { await server.close(); }
  }

  for (const scenario of [{ unavailable: false, viewports: report.viewports }, { unavailable: true, viewports: report.compatibility.navigation_api_unavailable.viewports }]) {
    for (const viewport of viewports) {
      const shotName = `h50-${scenario.unavailable ? 'compat' : 'main'}-${viewport.name}-${randomBytes(4).toString('hex')}.png`;
      const { screenshot_bytes, ...initial } = await chunk({ unavailable: scenario.unavailable, viewport, unit: 'initial', routeIndex: -1, shotName });
      initial.screenshot = screenshotPath(scenario.unavailable, viewport.name);
      await writeSafe(root, initial.screenshot, screenshot_bytes);
      const view = { ...viewport, ...initial, routes: [], pass: false };
      scenario.viewports.push(view);
      for (const [routeIndex] of routing.routes.entries()) {
        const result = await chunk({ unavailable: scenario.unavailable, viewport, unit: 'route', routeIndex, shotName: null });
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
}
