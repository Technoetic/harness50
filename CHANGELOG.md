# Changelog

## 2.3.0 — 2026-09-07

- Require a stable URL for every independent screen while keeping a single self-contained HTML entry point. Carry the route contract through Claude and Codex design, implementation and completion steps.
- Prefer the Navigation API on capable HTTP(S) pages, with a single History/hash backend when unavailable. Restore the initial URL, preserve ordinary links and document anchors, and retain direct-file support through an explicit hash manifest.
- Validate deep links, reloads, traversal, active navigation and screen titles for every declared route at desktop and mobile sizes. Schema-3 evidence also requires the same checks with the Navigation API actually removed before page startup.
- Bind completion evidence to the exact HTML and route manifest, reject incomplete compatibility reports, and preserve recovery of existing historical completion receipts.
- Add a complete inline router example, routing and server-fallback guidance, and a combined 45-case browser regression suite covering native interception, fallback, partial capabilities, anchors, forms and new tabs.

Existing apps are not migrated automatically. History paths require an HTTP(S) server fallback; direct-file use requires hash routing. Browser evidence covers Chromium/Brave and does not certify Firefox, Safari, production rewrite settings or live-model workflow completion.

## 2.2.0

- Repair Windows PowerShell 5.1 parsing by shipping compatible bytes; test installed scripts without encoding repair copies.
- Register Claude hooks using the native envelope schema and dispatch only the current operating system's shell.
- Resolve Claude project roots from host context, isolate Stop retries by project/session, and consistently use the first unfinished step.
- Limit Claude automatic approval to eligible project edits and WebSearch in valid active workflows. Shell commands and WebFetch retain host permission handling. Protect canonical sensitive paths and versioned plugin cache locations.
- Isolate Codex parent control from subagent prompts, recognize qualified plugin skill names and recover stale empty locks with generation checks.
- Replace directory-presence Trust5 scores with bounded command outcomes, measured coverage and source fingerprints.
- Validate final HTML and provide a Chromium/axe verifier with desktop/mobile reports and screenshots.
- Test Node 22/24 across Windows, Linux and macOS, and pin validation dependencies and CI actions.
- Run CLI entry points through physical path aliases correctly; exercise crash gaps using deterministic fault injection.

This release validates software behavior and deliberately broken output fixtures. It does not claim a live-model tutorial benchmark or guaranteed aesthetic/learning-quality rating.
