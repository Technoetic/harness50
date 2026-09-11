# Codex active-turn continuous execution

## Request and observed failure

A single `$harness50:webapp <topic>` request should keep progressing through the
authorized workflow instead of requiring another prompt after each step.

The previous skill required exactly one step per turn and delegated all further
work to Stop. A read-only installed-host `hooks/list` query showed all four
Harness50 hooks enabled but untrusted. An independent baseline agent, given the
old skill and a valid Step 2 continuation after Step 1, ended the turn and asked
for hook trust plus another resume. This reproduced the reported failure.

## Change

The skill now runs one manager-selected work unit at a time within the active
turn. After an accepted completion, it consumes only the state and marker returned
by that operation to start the next work unit. Step-local stop wording returns to
the orchestrator. Intermediate success produces progress commentary.

The manager already supports this sequence, so its implementation, schemas,
receipts, acceptance gates, hook handlers, hook definitions, and permissions were
not changed. Existing-topic invocation enters the existing resume procedure once.
Completed import or recovery results are reported with their original provenance.
Recoverable failures stay on the same step and preserve the manager's three-failure
limit. User pause and actual external blockers stop further execution; a running
workflow is paused before yielding for external input to prevent repeated scheduling.
Ordinary tool confirmation within the active turn remains awaited.

Hook trust is still required to execute hooks. The current-turn loop does not
execute them or synthesize hook events. Recovery after actual host termination is
a separate capability and is not promised when hooks or host delivery are unavailable.

## Verification

- Behavioral RED: independent agent followed the old skill and stopped after one
  successful unit with untrusted hooks.
- Contract RED: updated package checks failed against the old skill; supplemental
  checks failed before the terminal recovery and external-blocker fixes.
- Behavioral GREEN: a fresh independent agent followed the revised skill and
  selected Step 2 immediately with the returned marker; it respected blocked,
  paused, missing-marker, and host-termination conditions.
- `node --test codex/tests/autopilot-startup.test.mjs`: 4 passed. Includes the
  existing trusted-hook fixture, a direct-response 50-step fixture preserving the
  Korean request and TOPIC hash, three-failure blocking, and pause enforcement.
- `node --test --test-concurrency=4 codex/tests/*.test.mjs`: 1,155 passed, 0 failed,
  2 skipped, out of 1,157 tests. Skips were a POSIX-only symlink check and a symlink
  creation check unavailable under Windows permissions. This full run preceded
  the final two skill clarifications; their affected suite was rerun below.
- Final `node --test codex/tests/package.test.mjs`: 20 passed, 0 failed, including
  targeted mutations for completed import/reconciliation, pause before yielding
  for external blockers, and awaiting ordinary confirmation.
- `python -X utf8 <skill-creator>/scripts/quick_validate.py codex/skills/webapp`:
  passed. UTF-8 mode is required for this validator on the tested Windows locale.
- `node codex/scripts/validate-steps.mjs`: all 50 indexed steps validated.
- Independent change review: two edge cases were found and corrected; follow-up
  review found both resolved and no introduced issues.

The generic scaffold plugin validator rejects the already-existing adapter's
custom `hooks` and `skills` layout; that is a baseline tool/schema mismatch. The
repository's adapter-specific package tests validate the actual manifest and the
normal Codex plugin installer is used for installation. No hook fields were
removed merely to satisfy the scaffold validator.

These are orchestration and instruction checks with isolated test fixtures, not
a claim that the requested game has already completed 50 product steps or that a
live host can restart an ended session. The existing game workspace was preserved.

Historical design documents describing one-step-per-turn scheduling are prior
design records. The current webapp skill, both READMEs, and the step-porting
contract describe the new work-unit boundary.
