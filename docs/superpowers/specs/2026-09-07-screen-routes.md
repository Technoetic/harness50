# Single-file applications with addressable screens

The user approved retaining one HTML deliverable while giving every independent
screen a stable URL. This extends the existing generation and browser verification
flow; no generated application or Harness50 workflow is started in the vault.

## Contract

- The application deliverable remains `dist/index.html`, with its runtime assets inline.
- Default routing is hash routing, usable without server rewrites. History routing
  is available when deployment maps the declared paths to the same HTML; the
  verifier's simulated fallback does not prove a deployed server is configured.
- Design inventories every independent screen and assigns one canonical route.
  A truly single-screen application declares one route; do not invent empty pages.
  Tabs, filters and dialogs need routes only when they represent independent screens.
- The final HTML contains exactly one real script element with
  `id="harness50-routes"` and `type="application/json"`:

```json
{"schema_version":1,"mode":"hash","fallback":"home","routes":[{"id":"home","path":"/"},{"id":"orders","path":"/orders"}]}
```

- Route IDs are unique, bounded ASCII identifiers; paths are unique canonical
  same-origin absolute paths without query, fragment, traversal or encoded separators.
  Both `/orders` and `/orders.html` may be declared. Bounds and rejected path forms
  must be documented with the implemented validator.
- Each screen has exactly one `[data-harness-screen="<id>"]` root. Exactly the
  routed screen is visible; all other declared screen roots are hidden. Every
  marked screen must occur in the manifest. The manifest lists finite concrete
  routes, including representative detail screens where applicable.
- On multi-screen applications every screen has a visible real `a[href]` link to
  another declared screen. The verifier follows a link actually present on that
  screen; global all-to-all menus are not required.
- The URL selects the screen on cold entry, reload and history traversal. Unknown
  routes replace the URL with the declared fallback route and render that screen.
- Initial entry at `index.html` resolves to the fallback. Screen navigation updates
  the document title, active navigation and focus using project-appropriate E2E
  assertions; the measured verifier guarantees route and visible-screen agreement.

## Measured verification and completion

- Browser reports use schema version 2. Fresh completion cannot accept a version
  1 report or a report without exact per-route coverage.
- Verify every declared route on desktop and mobile: direct entry, reload, one
  real outgoing navigation, back and forward, plus initial and unknown-route
  fallback. Single-screen cases record an explicit non-applicable navigation
  result rather than inventing an extra screen.
- Measure console/runtime/network errors, overflow and accessibility on every
  declared screen, retaining the existing initial keyboard-focus and timing checks.
- The verifier serves only the same HTML bytes at permitted same-origin navigation
  paths. Existing external-network and WebSocket blocking remains intact. One
  common deadline bounds the run, including stalled application code.
- The stable final HTML digest binds its embedded routing manifest. The completion
  validator compares the report inventory and measured coverage against the
  manifest extracted from those same stable HTML bytes, including final rechecks.
  Commented, inert or duplicate fake manifest elements cannot satisfy the contract.
- Historical persisted receipts retain their existing replay semantics. A replay
  is not a new route verification, and new verification requires a version 2 report.
- Tests must include correct hash and history apps, a URL-less tab app, incorrect
  direct/reload/history restoration, unknown fallback, omitted/duplicate routes,
  unsafe paths, incomplete/old reports, and existing browser failure fixtures.
- Use installed Brave for local browser checks with fresh temporary contexts.
  CI can use its installed Chromium; no user's persistent profile is opened.

## Generation integration

Both Claude and Codex instructions must carry the contract from topic/planning
through Step 30 design, Step 37 implementation, Step 45 E2E, Step 46 interaction
checks and Step 50 final verification. Shared public documentation and an executable
single-file example explain the markup, hash/history behavior and deployment limits.
Codex step source digests and contract regression fixtures must match changed files.

## Verification handoff

- task_id: harness50-screen-routes
- artifact_paths: this spec; implementation plan; final verification packet
- verification_commands_and_results: recorded after execution in the final packet
- assumptions: user approved the previously presented design and verification scope
- unresolved: implementation and independent review pending
- next_safe_action: implement tests first, then runtime and generation contract
