# Navigation API and compatible single-file routing

The user approved the proposed HTTP(S) Navigation API preference, existing
History/hash fallback, and continued direct-file hash support. This extends the
existing addressable-screen implementation at `33d8c0c` on draft PR #4.

## Runtime contract

- Keep one HTML file and the existing manifest schema 1 with a static `hash` or
  `history` URL mode. API selection must not silently change that URL contract.
- On HTTP(S), select Navigation API only when its methods, non-null current entry
  and interception capability are usable. Otherwise select the conventional
  backend for the URL mode. Direct-file operation uses a hash manifest; a history
  manifest requires HTTP(S) and must not be silently changed at runtime.
- Install one backend, bootstrap the initial URL explicitly, and handle real app
  links, direct entry/reload, Back/Forward and canonical unknown-route replacement.
  Native event interception requires `canIntercept` and an in-scope app URL.
- Preserve new-tab/modified links, downloads, external navigation, forms and
  ordinary anchors. App hash paths use `#/...`. Avoid duplicate renders/history
  entries; maintain title, active-link semantics and focus.
- Deployment rewrites remain a separate requirement for history URLs.

## Measured completion evidence

Browser report schema 3 retains normal `viewports` and adds mandatory
`compatibility.navigation_api_unavailable.viewports`. Both contain exactly two
desktop/mobile results and the full HTML route inventory. The compatibility run
removes `window.navigation` before every document starts and verifies absence
throughout the measured actions. Failure to establish absence fails verification.
Both runs share the existing deadline, network restrictions and stable HTML hash.

Observed `navigation_api.available` and `property_present` metadata are diagnostic,
not proof of implementation choice. Example and generated-app E2E separately
demonstrate real native interception, forced unavailability, a present but unusable
API and direct-file compatibility. Fresh completion rejects old/incomplete reports;
historical persisted receipt replay retains its existing semantics.

## Delivery and verification

Use the existing isolated worktree and draft PR. Add genuine failing tests before
changing the example and verifier. Run focused and full unit/browser/Claude/step
checks, independently review the result, update the local Codex installation via
its CLI with a backup, verify installed bytes, and record the outcome in the
existing vault tool note. No live model-generated workflow, public main merge,
server deployment or vault hook/trust change is part of this task.

Verification commands/results, limitations and independent reviewers belong in
`docs/verification/2026-09-07-navigation-api.md` after execution.
