# One HTML file, a URL for every screen

Generated applications keep one self-contained `dist/index.html`. Each independent
screen has a canonical URL that restores that screen when opened directly, shared,
reloaded, or reached with the browser's Back and Forward buttons.

Hash routing is the default: `index.html#/`, `index.html#/orders`, and
`index.html#/settings`. It works on a static host and when the HTML is opened as a
file. History routing can use `/orders` or `/orders.html`, but the deployment server
must serve the same HTML for those navigation paths. Changing a URL must also
change the visible screen; changing a screen must update the URL.

## Design and markup

Inventory independent screens during planning. In Step 30, record each screen's
ID, purpose, canonical path, incoming links, and expected screen after reload.
Carry the complete inventory through subsequent design and implementation work.
Filters, transient dialogs and controls do not need their own route unless they
represent independent screens. A genuinely one-screen application declares one
route; do not add empty screens to satisfy a count.

Place exactly one manifest script directly in the explicit HTML `<head>`:

```html
<script id="harness50-routes" type="application/json">
{
  "schema_version": 1,
  "mode": "hash",
  "fallback": "home",
  "routes": [
    { "id": "home", "path": "/" },
    { "id": "orders", "path": "/orders" },
    { "id": "settings", "path": "/settings" }
  ]
}
</script>
```

Each route ID identifies one screen root. The active root is visible and all
other screen roots are hidden. Every marked root must occur in the manifest.

```html
<nav aria-label="Main navigation">
  <a href="#/">Home</a>
  <a href="#/orders">Orders</a>
</nav>
<main>
  <section data-harness-screen="home"><h1>Home</h1></section>
  <section data-harness-screen="orders" hidden><h1>Orders</h1></section>
</main>
```

The router reads the current URL at startup and after hash/history changes.
Navigation uses real `a[href]` links. Each screen in a multi-screen app must have
at least one visible link to another declared screen; an all-to-all menu is not
required. Handle modified clicks normally so users can open links in new tabs.
Update the title, active-navigation semantics and focus when the screen changes.
Ensure CSS cannot accidentally override `[hidden]`.

An empty entry URL and unknown route must render `fallback` and replace the URL
with that route's canonical URL, without creating an extra history entry. The
fallback names a declared route ID. Do not silently leave the wrong URL visible.

Use [the complete inline example](../examples/routed-single-file.html) as a working
reference. It contains three screens, ordinary links, title/focus updates and no
external runtime assets. Its content is a small example, not a required app layout.

## Bounded route contract

- `schema_version` is `1`; `mode` is `hash` or `history`.
- Manifest JSON is at most 32 KiB and contains 1–50 routes.
- IDs match `[A-Za-z][A-Za-z0-9_-]{0,63}` and are unique.
- Paths are unique, at most 256 ASCII characters, and begin with `/`.
- `/` is valid. Other paths contain nonempty slash-separated segments starting
  with a letter, digit, underscore or hyphen; subsequent characters may also be
  dot or tilde. `/orders/123` and `/orders.html` are valid concrete routes.
- Query strings, fragments, percent escapes, backslashes, duplicate/trailing
  slashes, and traversal segments are rejected. `/index.html` is the reserved
  entry point; `/__harness50_unknown_route__` is reserved for the fallback probe.
- Use literal quoted `id` and `type` attributes on the manifest script. Commented,
  duplicate, inert, foreign-content and ambiguously placed manifests are rejected.
  Place the manifest directly in a normal explicit head, not inside a template,
  noscript element, or another script's text.
- The conservative extractor requires literal HTML ID values throughout the
  document (no character references), unique attributes, and ordinary script raw
  text without escaped-state `<!--` or literal `<script` sequences. It rejects
  ambiguous markup instead of attempting browser HTML error recovery.

The manifest describes finite concrete routes. An app with dynamic detail IDs
must include representative concrete detail routes and separately test its other
valid and invalid parameter cases. A finite manifest is not proof of every
possible application state.

## Verification

Run the verifier from a checkout with the pinned browser dependencies installed:

```text
node "<validation-checkout>/scripts/verify-output.mjs" --workspace "<project-root>"
```

To select an installed browser explicitly, including Brave on Windows:

```text
node "<validation-checkout>/scripts/verify-output.mjs" --workspace "<project-root>" --executable-path "C:/Users/corei/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe"
```

The browser report uses **schema version 2**, with the exact `routing` manifest,
the final HTML SHA-256, and desktop/mobile results. Every route is checked for:

1. Cold direct entry and visible-screen/URL agreement.
2. Reload restoring the same route and screen.
3. A real outgoing link, its destination screen, Back, and Forward.
4. Runtime/console/network errors, accessibility and horizontal overflow.

Initial entry and an unknown route must both resolve to the declared fallback.
One-screen apps explicitly record navigation as `not-applicable` with reason
`single-screen`; direct entry, reload, fallback and quality checks still run.
Failures, omitted routes, duplicate results, old reports and changed HTML cannot
satisfy fresh completion. Existing historical receipts retain their recovery
semantics; replaying a receipt does not perform a new browser verification.

Codex validates the route inventory against the same stable HTML bytes it hashes.
Claude checks current quality and browser evidence before recording a new Step 50.
The inspection command does not execute project commands or launch a browser:

```text
node "<plugin-root>/scripts/quality-gate.mjs" --inspect-final --workspace "<project-root>"
```

History-mode verification serves the same HTML at the declared paths in an isolated
browser context. **This proves application routing, not deployment rewrites.**
Step 45 must also check direct entry and refresh on the real deployment server
when history mode is selected. Keep project-specific E2E for title, focus, active
navigation, dialogs, filters, asynchronous data, and other states.
