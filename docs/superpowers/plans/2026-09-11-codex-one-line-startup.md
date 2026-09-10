# Codex one-line startup and recovery

> Execute in this isolated checkout with independent agents for parsing and review. The user approved local fixes, GitHub integration, reinstallation, and recovery of the current failed game workflow.

## Accepted design

One natural-language request must produce a complete topic contract before hashing. Preserve the entire original request, explicit constraints, and complete Markdown/YAML contracts. Missing values receive visibly labelled defaults. Reuse the pre-existing local draft without discarding local edits.

Existing native workflows stuck before Step 1 completion need a manager-owned `repair-topic` command. It derives the repaired contract only from the pinned original, accepts no replacement topic, backs up original bytes, and never advances a step. It rejects changed source, imported workflows, completed receipts, and active unfinished attempts. Persisted backups allow safe retry if interruption happens between topic and state publication. A successful repair leaves the workflow paused for explicit resume.

Normal Stop-hook continuation and hook trust are preserved. Do not fabricate host continuation events or change trust settings. Verify the 50-step lifecycle with real manager and hook handlers in isolated test fixtures, distinguishing those tests from live host execution.

## Tasks and interfaces

- [x] Topic parser: `codex/scripts/lib/topic.mjs`, `codex/tests/topic-init.test.mjs`. Keep `prepareTopicContract(topic: string): string`. Reproduce existing comment-only YAML and nested Markdown failures, fix the narrow parser, preserve CRLF/original bytes, and test fenced examples and empty fields.
- [x] Recovery: `codex/scripts/lib/workflow.mjs`, `codex/scripts/harness-state.mjs`, new `codex/tests/topic-repair.test.mjs`. Expose `repairTopicWorkflow({ workspaceRoot, now? })` through `repair-topic --workspace`. Test legacy one-line recovery, original backup, source hash mismatch, repeat calls, interrupted publication, active attempts, imported/advanced state, and unchanged receipts.
- [x] Workflow instructions: update webapp SKILL, Step 1, README and changelog to describe normalization, bounded recovery, and automatic handoffs. Verify a fresh agent selects the actual commands without requesting six internal fields from the user.
- [ ] Integration: run the native Node test suite and focused continuation regression, review the full diff, and publish the reviewed change to GitHub. Preserve source edits and use the official cachebuster/reinstall helper for `harness50@personal`.
- [ ] Actual workspace recovery: use the verified installed manager to repair the existing game topic, resume and validate Step 1, and report verified state. Report separately if live continuation requires a new thread or human hook trust.

## Verification ledger

- Baseline: `node --test codex/tests/cli.test.mjs codex/tests/workflow.test.mjs codex/tests/hooks-lifecycle.test.mjs` — 195 passed, 0 failed.
- Source audit: GitHub main `79a2998` matches installed 2.4.0 cache; local source contains an unpublished draft. Imported its 10 relevant source/doc/test files into this checkout, preserving the public manifest until installation.
- No native workflow state has been edited directly. All real recovery will use the tested manager command.
- Parser regressions: 17 passed. Recovery regressions: 25 passed, including process termination between backup link/unlink and between topic/state publication.
- Final native suite: `node --test codex/tests/*.test.mjs` — 1,150 tests, 1,148 passed, 0 failed, 2 platform skips. This includes all 50 manager/hook handoffs.
- Browser regressions: `npm run test:browser` — 45 passed, 0 failed.
- Independent review found and resolved generated-fence corruption, interrupted backup publication, recovery selection after topic publication, and cachebuster version-test drift. Final scoped review reported no remaining important defects.
- The generic plugin-scaffold validator reports the same three schema incompatibilities against both unchanged 2.4.0 and this update (dual-host hooks, custom skills path, absent interface). Preserve the established manifest; use this repository's package contract tests and the actual Codex installer to validate it.
- A read-only live host check found the four Harness50 hooks untrusted. Isolated scheduling tests do not establish live automatic continuation, and installation/recovery must not alter hook trust.
