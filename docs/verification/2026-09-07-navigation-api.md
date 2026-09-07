# Navigation API integration verification

- task_id: harness50-navigation-api
- artifact_paths: `examples/routed-single-file.html`; `tests/navigation-api.test.mjs`; `scripts/verify-output.mjs`; `scripts/lib/browser-report.mjs`; `scripts/quality-gate.mjs`; browser/completion fixtures; Claude/Codex Steps 1, 30, 37, 45, 46, 50; `docs/ROUTING.md`; `docs/QUALITY.md`.
- verification_commands_and_results: Full unit suite 1,087 tests: 1,085 passed, two platform skips, zero failures. Complete Brave browser-output suite 21/21 and new Navigation API suite 24/24 passed (45 total). Native isolated Claude regressions 45/45, forced Bash lifecycle/final gates 20/20, and native final-output checks 5/5 after the last message-only correction. Step contracts/parity 190/190; step index validator 50/50. Exact commands and scope are below.
- assumptions: The user approved Navigation API preference on capable HTTP(S), conventional History/hash fallback, and direct-file hash support. URL mode stays statically declared; a history manifest requires HTTP(S) hosting and deployment rewrites.
- unresolved: No confirmed runtime/spec findings remain. Actual model-generated full workflows, deployed-server rewrites and non-Chromium browser engines were not exercised. Forced API absence tests compatibility behavior, not every old-browser implementation. Final remote CI is reported on the exact delivery commit in draft PR #4; earlier routing CI does not validate this change.
- next_safe_action: Publish this reviewed delivery commit to existing draft PR #4 and verify its CI. Use the installed skills from a fresh Codex conversation and a separate app workspace, with the matching validation checkout at `D:/harness50-worktrees/screen-routes`; public main has not yet received schema 3.
- verified_by: `/root/route_contract_audit`, independent read-only review, 2026-09-07 12:44:02 KST. Core tests 37 passed plus one existing Windows file-symlink EPERM skip; measured verifier 3/3; frozen example/native/fallback/file/anchor cases 9/9. P2 history-anchor restoration and P3 stale schema wording were reproduced/reviewed and resolved. Generation instructions authored by that reviewer were excluded from its independent scope.

## Resulting behavior

The inline example keeps one HTML file and its existing hash manifest. On HTTP(S),
it uses native navigation only when `navigate`, `addEventListener`, a non-null
current entry and event interception are usable. Otherwise it selects the existing
backend for its declared URL mode. Exactly one backend is installed. Initial
entry is explicitly rendered; ordinary browser links and non-app navigation are
preserved. A history variant changes the manifest and hrefs together; file use
keeps the default hash manifest.

Schema-3 browser output contains normal `viewports` plus mandatory
`compatibility.navigation_api_unavailable.viewports`. The verifier deletes the
Navigation API before each fallback document loads, confirms absence throughout
route checks, and repeats all desktop/mobile route and quality measurements.
Both scenarios share one deadline, network isolation and the exact artifact hash.
The existing completion readers enforce the new shared report schema; persisted
historical receipts retain their prior recovery behavior.

API capability probes do not prove which backend an application used. The new
example tests wrap and call the actual browser interception method to verify the
native branch, then exercise genuine deletion and partial-capability cases. They
also verify actual new tabs/modified clicks, GET forms, document anchors and
single-render/history behavior. The HTTP test fixture uses a real loopback server;
its deployment behavior is not claimed as evidence for a user's production host.

## Commands and results

```powershell
npm.cmd test
# 1087 tests; 1085 pass; 2 platform skips; 0 fail; 64.94 seconds.

$env:HARNESS50_BROWSER_PATH='C:/Users/corei/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe'
node --test tests/browser-output.test.mjs
# Complete suite: 21/21 pass; 153.44 seconds.
node --test tests/navigation-api.test.mjs
# Complete suite: 24/24 pass; 7.27 seconds.
# npm run test:browser now includes both files; 45 tests in total.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File codex/tests/claude-regression-copy.ps1 -SourceRoot .
# PASS=45 FAIL=0; CLAUDE_REGRESSION_COPY_OK.

$env:H50_TEST_BASH='1'
node --test codex/tests/claude-final-output.test.mjs codex/tests/quality-hook.test.mjs codex/tests/claude-lifecycle.test.mjs
# Exact Bash scripts: 20/20 pass; 122.18 seconds.

# A separate native PowerShell process, without H50_TEST_BASH:
node --test codex/tests/claude-final-output.test.mjs
# 5/5 pass after schema-v3 repair-message correction; 10.42 seconds.

node --test codex/tests/steps-validator.test.mjs codex/tests/steps-parity.test.mjs
# 190/190 pass; source and target digests updated, mutation checks retained.
node codex/scripts/validate-steps.mjs
# 50 indexed steps validated.
git diff --check
```

A persistent copy of the final three-screen example was independently run through
the complete standalone Brave verifier: PASS, schema 3, three routes in both
desktop/mobile scenarios. Its HTML SHA-256 is
`08c92aa5a6ef97cd8a3c5fd983ccd5cb88636bc7d633a321347fa35dde2465d2`.
The workspace is `D:/harness50-worktrees/review-notes/navigation-example-check`.

## Test-first and review evidence

- The old router failed native interception (`0` observed instead of `1`) and
  history direct-entry restoration. Missing native methods reproduced a wrong
  backend selection and a TypeError before the guard was corrected.
- The old verifier passed an app whose normal navigation worked but whose links
  broke when the API was removed. Schema 2 and reports missing compatibility
  evidence also passed before the schema-3 reader was implemented.
- Invalid, duplicate and truncated compatibility results are rejected. A page
  that recreates the API property after reload cannot masquerade as an API-absent
  environment merely by assigning `undefined`.
- Independent review reproduced `/orders#details` becoming home. Native and
  fallback regression tests now cover direct entry, reload, actual anchor links
  and traversal back to the anchored screen. Both passed after correction.
- Two Claude repair messages still said schema-v2; the final wording names
  schema-v3 and both required scenarios. Native final-gate tests passed again.

The separate read-only review packet is
`D:/harness50-worktrees/review-notes/navigation-api-independent-review.md`, SHA-256
`293fd88fcea1c6ac36b9894e5f6a23b4d5d9579f3833a4c284d559cfd332c102`.

## Delivery status

Generation contracts received a separate independent read-only review by
`/root/implement_route_verifier`, 2026-09-07 12:47:52 KST: PASS, with 50/50 indexed
steps and 190/190 contract/parity tests independently rerun. A wording conflict
about direct-file use was resolved: choose a hash manifest for files; a history
manifest requires HTTP(S); never silently change the declared mode. The report is
`D:/harness50-worktrees/review-notes/navigation-generation-review.md`, SHA-256
`9a8fe292679fab19dbce19b07b1aa5b7af53273d99ce5c157d764bee9cf7cf36`.

The existing draft PR #4 is the integration destination. No public main merge,
release tag, live generated-app workflow or deployment-server change is implied.
The existing generic plugin scaffold validator mismatch is unchanged; see the
initial routing verification packet for the reproduced pre-existing limitation.

## Local CLI installation and handoff

Functional commit `97f3118b7982ac02d76d33fc246eaeaead11184d` was installed through
the supported personal-marketplace CLI flow as
`harness50@personal` version `2.2.0+codex.20260907035038`. The subsequent delivery
commit changes only this verification packet and the implementation plan.

- Personal source: `C:/Users/corei/plugins/harness50`.
- Codex cache: `C:/Users/corei/.codex/plugins/cache/personal/harness50/2.2.0+codex.20260907035038`.
- Backup: `C:/Users/corei/plugins/.backups/harness50-before-navigation-api-20260907-035038.zip`,
  SHA-256 `e6dc00e2ff231f383bad75f26d09346baf732e05b81953b358756d173ca4d1c7`.
- Independent report: `D:/harness50-worktrees/review-notes/navigation-installed-review.md`,
  SHA-256 `c1fd44d6f14f9504d35c81c8f4db39b02b1daa83bdf86bc00ead8b703b54f7da`.

Independent read-only verification by `/root/route_contract_audit` at
2026-09-07 12:56:08 KST confirmed the CLI reports installed/enabled true and all
245 tracked personal-source/cache file pairs are byte-identical. The cache's two
additional files are CLI-generated migrated command skills. Against raw Git blobs,
221 files match exactly, 23 differ only by CRLF/LF, and the Codex manifest differs
by the cachebuster version and JSON serialization; its other fields match.
The 241-file backup matches the previous functional revision with the same
line-ending and manifest qualifications. No files were deleted during the update.

The actual installed `inspectBrowserOutput` passed against the saved schema-3
example report and its recorded HTML digest, covering all three routes in both
desktop/mobile scenarios. The installed step validator passed 50/50. Both checks
work without `node_modules` in the source or cache. This inspection reuses the
measured browser artifact; it is not a live model-generated workflow.

Claude remains version 2.2.0 with its existing settings: disabled specifically in
`D:/NS`, enabled at the user-default scope. No Claude installation or settings
were changed. A new Codex conversation is needed to load the updated skills.

The existing vault tool note, index and audit log were updated in local commit
`9f8a62414cbc4cd93e2b3b4bd6d7c5df1a64905c` and mirrored to the existing local bare
repository. Unrelated untracked work was preserved without reading or staging it.
The final PR-head CI result will be recorded in the PR and vault follow-up rather
than creating another source commit that would invalidate the checked head.
