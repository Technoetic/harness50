# Navigation API Implementation Plan

> For agentic workers: use subagent-driven development, test-driven development
> and independent review. File ownership below avoids shared edits.

**Goal:** Prefer usable Navigation API on HTTP(S), preserve conventional routing,
and prove that every generated screen also works without the new API.

**Architecture:** The inline example selects one compatible router backend for
its existing URL mode. Schema-3 browser verification exercises normal and forced
unavailable environments; existing completion readers enforce the shared schema.

**Tech stack:** Node 22+, pinned Playwright/axe, inline HTML/CSS/JavaScript, Brave.

**Spec:** `docs/superpowers/specs/2026-09-07-navigation-api.md`

## Global constraints

One output HTML file; static manifest schema 1; hash for direct-file use; one router
backend; deployment fallback independently verified; no external runtime assets;
shared verification deadline and network isolation; historical receipts preserved.

## Task 1: Compatible inline router

Owner: `inspect_harness_routes`. Files: `examples/routed-single-file.html`,
`tests/navigation-api.test.mjs` and a test helper only if needed.

- [x] Add real-browser native/forced-fallback/partial-capability/file tests and
  observe failures against the previous router.
- [x] Implement guarded Navigation API selection and mutually exclusive backends.
- [x] Verify route behavior, browser link semantics and focus/title in Brave.

## Task 2: Two-scenario completion evidence

Owner: `implement_route_verifier`. Files: `scripts/verify-output.mjs`,
`scripts/lib/browser-report.mjs`, browser-output tests and affected Codex fixtures.

- [x] Reproduce native-only success with a broken fallback and old/missing evidence.
- [x] Add schema 3, forced API removal and complete route checks in both scenarios.
- [x] Require both scenarios through the shared report reader without changing
  the stable artifact or historical receipt contracts.
- [x] Pass targeted unit and Brave browser regressions.

## Task 3: Generation contract

Owner: `route_contract_audit`. Files: Claude command and relevant Claude/Codex
steps, source index and existing source/target digest fixtures.

- [x] Carry backend selection and both real execution paths through design,
  implementation, E2E and final schema-3 completion requirements.
- [x] Update reviewed digests without weakening step contract checks; pass them.

## Task 4: Integration and delivery

Owner: root. Files: README, routing/quality documentation, package browser script,
this specification/plan and final verification report.

- [x] Integrate public documentation and both browser suites.
- [x] Run full required checks and obtain independent review with rerun evidence.
- [ ] Commit/push the feature branch and update the existing draft PR; verify CI.
- [ ] Back up and update the local Codex plugin through its CLI; independently
  verify installed bytes and dependency-free completion inspection.
- [ ] Update the existing vault tool note/index/log, commit only owned changes and
  mirror locally. Record exact limitations and final artifacts.
