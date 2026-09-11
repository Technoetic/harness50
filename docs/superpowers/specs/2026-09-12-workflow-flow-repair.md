# Workflow flow repair

The user approved correction of the eight findings in the 2026-09-12 review of public v2.4.1 (`b4b4b8f`). Keep 50 numbered steps and both host integrations. This change is a local implementation, not a release or installation.

## Required behavior

1. New Codex completions at 38, 44 and 50 inspect the existing measured quality report against current source, configuration and coverage. Missing, failed or stale evidence prevents a new receipt. Historical receipt recovery remains historical recovery.
2. After the final build, Step 50 reruns the full E2E, screenshot, keyboard, mouse, design and console matrices on the same final HTML. A current QA snapshot/report at step 50 binds `dist/index.html` and all six required regression categories. Any subsequent change requires a new build and rerun. Both host completion gates inspect this evidence.
3. GitHub research retains bounded attempts but stops only after usable related candidates are obtained. Empty/unrelated HTTP-success results allow the remaining queries. Exhaustion has an explicit no-reference disposition rather than an impossible mandatory clone.
4. Step 24 owns bounded deficiency-directed collection and reanalysis inside its current attempt. It must preserve earlier evidence, record supplemental provenance and independently recheck. No implicit receipt/state rewinds or uncontrolled network research.
5. Claude planning receives independent validation after the last 26–29 augmentation; downstream design consumes the final planning artifacts.
6. Test runner selection precedes its installation requirement. c8 optionality is consistent across preflight and step 5; actual measured coverage remains mandatory at quality gates.
7. Claude required failures, exhausted retries and missing checks remain incomplete. Remove contradictory skip-and-advance instructions and enforce current QA evidence where completion uses it.
8. History routing is locally testable on an HTTP server with fallback. Actual deployment verification is conditional on an already authorized and available deployment target; it is explicitly pending otherwise and is not silently counted as live deployment proof. Subsequent tests reuse the selected serving mode.

## Interfaces and constraints

- Reuse `inspectQualityReport` and the immutable QA snapshot/record/inspect implementation; do not create parallel report formats.
- The final QA snapshot uses required check IDs `e2e-regression`, `screenshot-regression`, `keyboard-regression`, `mouse-regression`, `design-regression`, `console-regression` and includes `dist/index.html` among artifact hashes.
- Add `inspectFinalRegression(workspaceRoot)` in `scripts/lib/final-regression.mjs`; it returns a structured PASS/INCOMPLETE result and is read-only. Gate callers cannot turn a missing or stale report into PASS.
- No new dependency, project command execution from Stop, network approval bypass, automatic installation, release, push or existing receipt rewrite.
- Parent owns shared index/hash regeneration. Tests must exercise missing/stale/failing/current evidence and receipt behavior, not just new prose wording.

## Validation

The baseline targeted suite has 215 passes and one skip. Run meaningful failing regression tests before runtime edits, targeted suites after each task, the complete Node suite and applicable PowerShell/browser checks after integration, and an independent final review.
