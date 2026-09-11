# Workflow Flow Repair Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** Correct the eight approved workflow findings without changing the 50-step structure.

**Architecture:** Reuse measured-quality and QA report validators at completion boundaries. Keep research repair within its active step and align host instructions with runtime gates.

**Tech Stack:** Node.js >=22 ES modules, node:test, PowerShell, Markdown step contracts.

**Spec:** `docs/superpowers/specs/2026-09-12-workflow-flow-repair.md`

## Global constraints

- Preserve old receipts as history, current-step ownership and existing permission boundaries.
- Keep dependencies and release versions unchanged; no release, installation or remote push.
- Shared `codex/assets/steps/index.json` and source hash updates belong to the parent integrator.
- New gate failures must leave the current attempt incomplete and create no completion receipt.

## Task 1: Measured quality at new completion

Files: `codex/scripts/lib/acceptance.mjs`, related workflow tests/fixtures, step038/044 instructions. Consume `inspectQualityReport(workspaceRoot)` and the new `inspectFinalRegression(workspaceRoot)` for step 50. The parent supplies the latter helper.

- [x] Reproduce acceptance without quality evidence, failed quality and stale quality in real validator/completion tests.
- [x] Require current PASS before new 38/44/50 completion; include validated report digests in evidence without breaking idempotent receipt recovery.
- [x] Integrate the final-regression inspector at 50; update touched fixtures to run real quality checks.
- [x] Run targeted acceptance/workflow/receipt tests and review the diff.

## Task 2: Research and tool transitions

Files: steps001/005/006/017/019/024, research-related contract validation/tests. Parent integrates index changes.

- [x] Make preflight runner discovery consistent with the later selection and optional c8 outcome.
- [x] Implement bounded usable-candidate selection and an explicit exhausted/no-reference outcome through steps 17–19.
- [x] Define bounded, provenance-preserving supplemental work in step 24 and its downstream inputs.
- [x] Test consuming contracts and review no-reference/deficiency scenarios across dependencies.

## Task 3: Claude planning and failure behavior

Files: Claude steps025–030, 032, 039/040/041/043/046/047/048, `hooks/step-progress-writer.ps1`, relevant PowerShell/Node tests. Parent owns step050 and deployment edits.

- [x] Put final independent planning validation after 29's final augmentation and fix downstream artifact names.
- [x] Replace required-failure skip/advance instructions with bounded retry and INCOMPLETE.
- [x] Exercise completion writer behavior on missing/failed/stale/current QA evidence and enforce required QA gates.
- [x] Carry selected HTTP/file serving context into input tests and remove obsolete step references.

## Task 4: Final candidate regression and deployment boundary

Files: `scripts/lib/final-regression.mjs`, its CLI/tests, both step049/050 instructions, step044/045 routing clauses, `docs/QUALITY.md`, `docs/QA-REPORTS.md`, `docs/ROUTING.md`.

- [x] Write and run failing tests for incomplete categories, changed final HTML, changed evidence and all-six current PASS.
- [x] Implement a read-only inspector using `inspectQa(root, 50)`; require all six named checks and the current final HTML artifact hash.
- [x] Enforce this inspector in the Claude final gate and coordinate Codex integration with Task 1.
- [x] Specify complete final-matrix rerun after the last build and local-vs-deployment evidence explicitly.

## Task 5: Integration and independent verification

- [x] Merge shared contract metadata, recalculate source SHA-256 and run the 50-step validator.
- [x] Run the complete Node suite, relevant PowerShell tests and browser suite on Brave.
- [x] Independently review all eight fixes and re-execute critical regressions; address verified findings.
- [x] Record commands, outcomes, limits and artifact paths in `docs/verification/2026-09-12-workflow-flow-repair.md`.
- [x] Commit only this task's files locally and leave a clean worktree for review.
