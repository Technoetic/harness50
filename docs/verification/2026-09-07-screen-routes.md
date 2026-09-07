# Addressable-screen integration verification

- task_id: harness50-screen-routes
- artifact_paths: `docs/ROUTING.md`; `examples/routed-single-file.html`; `scripts/lib/route-contract.mjs`; `scripts/lib/browser-report.mjs`; `scripts/lib/final-output.mjs`; `scripts/verify-output.mjs`; `scripts/quality-gate.mjs`; `codex/scripts/lib/acceptance.mjs`; both `hooks/step-progress-writer` variants; Claude/Codex Steps 1, 25, 30, 37, 45, 46, 50; runtime test packet in this directory.
- verification_commands_and_results: full unit suite 1,085 tests, 1,083 passed and 2 platform skips; Brave browser suite 18/18; isolated native Claude security regressions 45/45; native PowerShell and forced Bash lifecycle/final-gate checks 20/20 each; step-contract checks 190/190; index validator 50/50. Exact commands are below.
- assumptions: user requested retaining one HTML file with a URL for every independent screen; hash routing is the portable default; optional history routing requires a deployment fallback to the same HTML.
- unresolved: no confirmed implementation or review findings. Actual deployed-server rewrites and live model-generated applications were not exercised. Existing generated apps are not automatically rewritten.
- next_safe_action: use the updated plugin in a fresh conversation to generate an application, inspect its complete screen inventory, and run its project-specific E2E plus the measured route verifier.
- verified_by: `/root/route_contract_audit`, 2026-09-07 11:41 KST, spec/quality PASS; independently reran all five Claude final-evidence tests and the 50-step validator. `/root/inspect_harness_routes`, 2026-09-07, whole-change spec/quality PASS; independently reran 31 routing/completion tests (30 pass, one Windows file-symlink permission skip) and both correct hash/history Brave cases (2/2). Neither reviewer edited production code.

## Behavior and evidence

The implementation extends the existing single-file pipeline. Planning inventories
independent screens; design maps their URLs; implementation embeds the routing
manifest and visible-screen identifiers; E2E and the final browser verifier test
URL and screen agreement. HTML remains one file with inline runtime assets.

Fresh completion requires schema-v2 browser evidence that covers the HTML's exact
route inventory. Missing manifests, URL-less tab switching, URL-only switching,
broken direct entry/reload/history/fallback, omitted or duplicate screens, old or
incomplete reports and changed HTML cannot pass. The existing external-network,
WebSocket, artifact-path and stable-handle checks remain in force.

Claude's writer now checks current quality and browser evidence before adding a
new Step 50. Its Stop report inspects the final milestone at 49 completed steps and
current step 50. Inspection neither executes project commands nor launches browsers.
Historical completed records and persisted Codex receipts keep their existing
recovery semantics; their replay is not a new route verification.

## Commands and results

```powershell
npm.cmd test
# 1085 tests: 1083 pass, 2 platform skips, 0 failures (70.99 s).

$env:HARNESS50_BROWSER_PATH='C:/Users/corei/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe'
npm.cmd run test:browser
# 18/18 passed (82.17 s), fresh temporary profile/contexts.

node --test codex/tests/claude-final-output.test.mjs codex/tests/quality-hook.test.mjs codex/tests/claude-lifecycle.test.mjs
# Native PowerShell: 20/20 passed (19 initial checks + final expanded test).

$env:H50_TEST_BASH='1'
node --test codex/tests/claude-final-output.test.mjs codex/tests/quality-hook.test.mjs codex/tests/claude-lifecycle.test.mjs
# Exact Bash shipping scripts: 20/20 passed (52.11 s).

powershell.exe -NoProfile -ExecutionPolicy Bypass -File codex/tests/claude-regression-copy.ps1 -SourceRoot .
# Isolated copy: PASS=45 FAIL=0; CLAUDE_REGRESSION_COPY_OK.

node --test codex/tests/steps-validator.test.mjs codex/tests/steps-parity.test.mjs
# 190/190 passed. Reviewed source and target digests updated; mutation checks retained.

node codex/scripts/validate-steps.mjs
# validated 50 indexed step(s)

git diff --check
```

The shipped three-screen example also passed the standalone verifier using Brave.
Its initial desktop/mobile screenshots were opened for visual inspection. A separate
`file://` probe opened each screen in a fresh context and verified direct entry,
reload, real navigation, Back, Forward and unknown-route fallback: 3/3 passed with
no page errors. The verified example HTML SHA-256 was
`358ea3cbaed88e9b306304b8ae13d7839e911cc0d176b2753f725a26a0bbb353`.

## Test-first and review record

Runtime RED/GREEN results are recorded in
`2026-09-07-routing-runtime.md`. Claude final-gate tests additionally reproduced
three old failures before implementation: completion text recorded Step 50 without
browser evidence, an unrecognized final-inspection flag ran project commands, and
the final Stop gate released while only quality evidence was present. Historical
completion preservation already passed. All corrected cases and valid schema-v2
completion subsequently passed on both shipping shell implementations.

The frozen whole-change review package SHA-256 was
`9d98c12d90d6359cf738caa03863272c230936eb9cddd233edf70be9f6402462`.
Independent reviewers reported no confirmed blocking or minor findings. Later
documentation-only changes record the verification outcome and extractor limits.

## Plugin validation profile

The generic `plugin-creator/scripts/validate_plugin.py` helper rejects this
repository's pre-existing Codex manifest layout (`hooks`, `codex/skills`, and no
`interface` object). The unchanged installed 2.2.0 source produces the same three
errors. No manifest layout change is part of this feature. Repository-native
package/step tests pass; installation is verified with the installed Codex CLI
and byte comparison rather than claiming this generic scaffold profile passed.
