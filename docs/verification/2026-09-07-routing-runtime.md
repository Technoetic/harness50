# Addressable-screen runtime verification

- task_id: harness50-screen-routes/runtime
- artifact_paths: `scripts/verify-output.mjs`; `scripts/lib/route-contract.mjs`; `scripts/lib/browser-report.mjs`; `scripts/lib/final-output.mjs`; `codex/scripts/lib/acceptance.mjs`; `tests/browser-output.test.mjs`; `codex/tests/routing-contract.test.mjs`; `codex/tests/helpers/routing.mjs`; `codex/tests/representative-steps.test.mjs`
- verification_commands_and_results: RED/GREEN evidence below; focused completion 31 tests, 30 passed and 1 Windows file-symlink permission skip; Brave browser suite 17/17 passed before the final property-order regression, and that new regression passed separately after its fix; `git diff --check` passed. Root integration will run the final full suites and independent review.
- assumptions: final output remains one inline `dist/index.html`; the manifest is an explicit direct child script of an ordinary `head`; one canonical route per independent screen; history deployment rewrite configuration is outside this local simulation.
- unresolved: full integration suite, independent review and installation belong to the parent task; timing and asynchronous effects after the bounded observation window cannot be guaranteed; title/active navigation/focus transitions require project-specific E2E assertions beyond measured URL/screen agreement.
- next_safe_action: freeze these runtime files for parent integration and read-only independent review; address concrete review findings before committing.

## Test-first evidence

Before production changes:

- `node --test --test-name-pattern='URL-less|working document' tests/browser-output.test.mjs`: 2 expected failures. The old verifier reported schema 1 for a working screen and incorrectly passed a document without a routing manifest.
- `node --test --test-name-pattern='historical v1' codex/tests/routing-contract.test.mjs`: 1 expected failure, `Missing expected rejection`; fresh completion accepted an old schema-1 report.
- `node --test --test-name-pattern='hash routing|URL-less' tests/browser-output.test.mjs`: 2 expected failures; a correct three-route SPA still had no measured schema-2 route inventory.

Self-review regressions were added and observed failing before their corrections:

- A second script whose ID used `&#45;` escaped the conservative extraction scan. HTML ID attributes now require literal values without character references.
- Boolean route IDs were coerced by regular-expression tests. IDs and fallback now require actual JSON strings.
- Reordering `id` and `path` keys changed the browser verdict despite unchanged screen identity. Browser comparison now compares fields, preserving array route order while ignoring object property order.

## Green verification

Local browser command uses the installed Brave executable with a newly launched temporary profile and fresh isolated contexts. CI retains Playwright Chromium by omitting the environment variable.

```powershell
$env:HARNESS50_BROWSER_PATH='C:/Users/corei/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe'
node --test tests/browser-output.test.mjs
```

17 tests passed in 65.49 seconds before the final property-order regression was added. Coverage includes a single screen with explicit non-applicable navigation; correct three-screen hash/history apps; URL-less navigation; incorrect direct entry, reload, back/forward and unknown fallback; duplicate/undeclared screen roots; errors, network requests, overflow and inaccessible controls on a non-initial screen; the existing stalled-script deadline; the shipped three-screen example.

```powershell
node --test --test-name-pattern='property order' tests/browser-output.test.mjs
```

The new regression passed in 6.75 seconds after its observed failure.

```powershell
node --test codex/tests/routing-contract.test.mjs codex/tests/representative-steps.test.mjs
git diff --check
```

31 tests: 30 passed, one Windows file-symlink creation skip (`EPERM`), no failures. Completion rejects missing, stale, incomplete, duplicated and different route reports. Existing reordered evidence, stable-handle mutation/replacement checks, final HTML recheck and durable receipt replay remain exercised.

## Interfaces and limits

- `readRouteManifestBytes(bytes)` and `validateRouteManifest(value)` return the normalized manifest in `scripts/lib/route-contract.mjs`.
- `readBrowserReportBytes(bytes, expectedRouting?)` returns a validated schema-2 report; `validateBrowserReportBytes` retains its digest-returning interface.
- `inspectBrowserOutput(workspaceRoot)` performs dependency-free, read-only HTML/report inspection and returns structured `PASS`/`FAIL`; both files are reread before success.
- Manifest JSON is at most 32 KiB, with 1–50 routes, actual string IDs matching `[A-Za-z][A-Za-z0-9_-]{0,63}`, and paths at most 256 ASCII characters. Root `/` and slash-separated segments beginning with alphanumeric, underscore or hyphen are supported; later segment characters may also include dot and tilde. `/index.html` and `/__harness50_unknown_route__` are reserved. Query, fragment, percent encoding, backslash, empty/traversal segments and trailing slash are rejected.
- Manifest extraction intentionally fails unsupported/ambiguous HTML: require one direct inline script in an explicit head, quoted literal ID/type, no inert/foreign head wrappers, no duplicate attributes/JSON keys, and no script escaped-state syntax (`<!--` or raw `<script`). It does not attempt browser-complete HTML error recovery.
- Each fresh viewport and route uses a new browser context. Only same-origin main-frame navigation at the explicit entry, declared history paths and one controlled unknown probe receives the same HTML bytes. External requests, extra assets, subframes and WebSockets remain blocked.
- Schema-2 reports retain initial viewport metrics/screenshots and add exact `routing`, `initial_entry`, `unknown_fallback`, and per-route direct/reload/navigation/back/forward and quality measurements. Unknown and initial fallback are checked for history replacement. Multi-screen navigation follows a visible real link to any other declared screen; all-to-all navigation is unnecessary.

No reviewer result is claimed in this packet. Parent integration records the independent `verified_by` result.
