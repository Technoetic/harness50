# Addressable Screens Implementation Plan

> For agentic workers: use test-driven development and independent code review.

**Goal:** Keep one HTML file while requiring and verifying a URL for every independent screen.

**Architecture:** An embedded route manifest describes the single-file SPA. The
browser verifier exercises that manifest and emits measured schema-v2 evidence;
fresh completion binds the full route inventory to stable HTML bytes.

**Tech Stack:** Node 22+, existing Playwright and axe, inline HTML/CSS/JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-07-screen-routes.md`

## Global constraints

- Application output is `dist/index.html` with inline runtime assets.
- Hash routing is the portable default; history mode requires deployment fallback.
- External-network and WebSocket blocking, deadlines, stable artifact hashing and
  historical receipt recovery stay intact.
- No live workflow execution, hook trust changes, or vault engine modifications.

## Task 1: Runtime verification and completion

Files: `scripts/verify-output.mjs`, new routing helpers under `scripts/lib/`,
`scripts/lib/browser-report.mjs`, `codex/scripts/lib/acceptance.mjs`,
`tests/browser-output.test.mjs`, relevant `codex/tests/` unit/completion fixtures.

- [x] Add failing tests for routing manifest, missing route evidence and correct/broken SPA behavior.
- [x] Run focused tests and record the expected red failures.
- [x] Implement bounded manifest parsing, route behavior measurement, schema-v2
  validation and stable-HTML route binding; retain existing receipt replay.
- [x] Pass focused unit tests and Brave browser fixtures, including existing failure fixtures.
- [x] Self-review and independent review with exact test results.

## Task 2: Generation contract and runnable example

Files: `commands/webapp.md`, relevant `assets/steps/` and `codex/assets/steps/`,
`codex/assets/steps/index.json`, associated source-digest regression fixtures,
`README.md`, `docs/QUALITY.md`, `docs/ROUTING.md`, `examples/routed-single-file.html`.

- [x] Carry independent-screen inventories, URL mapping and required route E2E
  evidence through the existing design and implementation contracts.
- [x] Document the exact runtime contract and supply a working inline hash SPA.
- [x] Align Codex source hashes without weakening acceptance or unrelated tests.
- [x] Validate step contracts and verify the example using the new browser verifier.

## Task 3: Integration and delivery

- [x] Run the full existing regression suite and browser suite once after integration.
- [x] Obtain a read-only independent review and rerun task-critical commands.
- [x] Record six-field verification and any material limitations in `docs/verification/`.
- [ ] Commit only task files; update the user's installed local Harness50 using the
  existing CLI workflow and verify installed bytes when supported.
- [ ] Preserve D:/NS pre-existing dirty files and record the completed work in its
  existing Harness50 note without changing unrelated state.

Repository baseline: `569d717`. Worktree: `D:/harness50-worktrees/screen-routes`.
User approval is the request to reinforce the previously proposed single-HTML routing design.
