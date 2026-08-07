# Phase 33 — handover prompt

Written **2026-08-07**, at the end of a short, focused session that fixed the live
regression the previous session's handover led with, then drove ALPHA-007's actual
report composer for the first time — reaching it correctly via the main-process
inspector rather than `npm run cdp` — and found a second live defect (**F104**) while
doing it, which a human watching live also hit independently before the cause was
known. Measured at `7d640495`. Replaces the same-day `fa377ccd`/`4f4d0b2e` handover,
superseded in full: the stale-URL regression is fixed, ALPHA-007's composer location
is now correctly documented (not just corrected-but-untested), and B4 is confirmed
already done — the two prior handovers both carried it as still-owed, which was wrong
by the time of this session (`gh label list` confirms all nine labels have been live
since 2026-08-06).

**The next session's job, in priority order: (1) there is very little pure-engineering
work left that isn't blocked on Richard — read the human-gated section below and chase
it, starting with B6 (two minutes of his time, unblocks ALPHA-007 criterion 3); (2) if
the composer is still fresh in mind, redo ALPHA-007 criterion 4 (the hostile-fixture
redaction demonstration) live now that the composer is known-reachable — it was never
actually driven, only unit-tested; (3) once Richard has done B5's two GitHub actions,
do the actual `opennoodl-docs` repo strip and repoint `getDocsEndpoint()`/`nodeDocsPath()`.**

Paste the block below into a fresh session.

---

Continue phase 33 alpha-launch work against `dev-docs/tasks/phase-33-alpha-launch`. Work
on `cline-dev`, commit straight to it, no branches, no PRs.

Read these first, in this order:

1. `dev-docs/tasks/phase-33-alpha-launch/PROGRESS.md` — task status and the full findings
   register. Its head carries a standing warning, still true: **re-measure a row before
   acting on it** — this session caught its own predecessor's stale "B4 owed" claim by
   actually running `gh label list` instead of trusting the doc. The 2026-08-07 log
   entries at the bottom (the enrichment fix, B5 decided, §4 done, the stale-URL fix +
   ALPHA-007's first live drive + F104) are the most recent state.
2. `dev-docs/tasks/phase-33-alpha-launch/HUMAN-GATED-ITEMS.md` — B5, B6, B2 all still
   open, in that rough order of how soon each blocks something. Read in full; it is
   short and the summary below trims detail that matters.
3. `dev-docs/tasks/phase-33-alpha-launch/ALPHA-007-NOTES.md` — updated this session with
   what's now been seen live (the composer's whole render, criterion 2, the layering
   question, the bundle contents) versus what's still reasoned-not-observed (B6,
   criterion 4, Windows/Linux reveal-in-file-manager, the macOS menubar-blur risk).

## What this session did

**Fixed and verified the live regression** the prior handover led with:
`HelpCenter.tsx:49` and `FailedStep.tsx:94` still read `The-Low-Code-Foundation/OpenNoodl`
— B3's rename grepped for `OpenNoodl` and missed both, which produced the blank-issue
bug Richard hit clicking "Report a bug" himself. Fixed (`d7c3f131`), re-grepped clean
across `packages/*/src`. Verified **without** repeating the accidental real-issue-filing
the discovery session caused: patched `electron.shell.openExternal` in the running
renderer to capture the composed URL instead of launching a browser, then clicked
"Report a bug" for real and read the captured value — correct repo, `?template=` intact.

**Drove ALPHA-007's composer for the first time**, correctly this time. The prior
session's own handover explained why it had failed: `Help → Report a problem…` is a
native `Menu`/`MenuItem` in `main.js`, invisible to `npm run cdp` (renderer-DOM only).
This session used its own recommended fix — `npm run dev:debug -- --inspect-main`,
connect to the main-process inspector on `:9229` with a small `ws`-based script — and
it worked on the first try:

```js
const electron = process.mainModule.require('electron'); // plain `require` is NOT a
                                                            // global in this context;
                                                            // process.mainModule.require is.
const { Menu } = electron;
const item = Menu.getApplicationMenu().items
  .find(i => i.label === 'Help').submenu.items
  .find(i => i.label === 'Report a problem…');
item.click();
```

**Criterion 2 confirmed real** — opened the sheet-selector's "All sheets" popup, then
triggered the composer over it. The popup stayed visible behind the dialog, live and in
the captured screenshot thumbnail inside the dialog. This was one of the build notes'
explicit "could not verify — needs the live editor" items, now closed.

**F104, found and fixed en route.** With "What happened" filled in, the composer's own
content exceeded 90vh and the Send/Cancel buttons became unreachable — not "pushed
below the fold", genuinely unreachable, no scroll anywhere. **Richard, watching live,
hit this independently before the cause was diagnosed** ("I can't scroll the report a
problem modal"). Root cause: `packages/noodl-core-ui/.../BaseDialog.module.scss`'s
`.VisibleDialog` sets `overflow: hidden` with `max-height: 90vh` and no inner scroll
container — the `::-webkit-scrollbar` rules already authored on the same class were
dead code, only ever mattering once this became `auto`. **This is a general
`CoreBaseDialog` defect, affecting every dialog built on it, not just this one.** Fixed
with `overflow-y: auto` / `overflow-x: hidden` (`022fb20a`), reloaded (not trusted to
HMR), and re-verified end to end: scrolls, buttons reachable, popup still visible
behind it.

**Then drove Send itself** — patched `shell.openExternal` again rather than actually
opening a browser, deliberately not attempting B6 to avoid a second accidental
real-issue-filing. Captured URL (3.1KB, under the 6KB budget) carried every field
correctly against real composed data — `what-happened`, `surface`, `severity` (with its
em dash), `version`, `os`, `fresh-project`, a redacted `errors` tail (an Electron CSP
warning's own URL correctly collapsed to `<url>` — a real redaction firing on real
output), and the full `diagnostics` JSON matching the spec's schema. The on-disk bundle
(`<userData>/reports/<reportId>/`) held exactly `report.md` + `diagnostics.json` +
`screenshot.jpg` as specced — confirmed by reading all three, then cleaned up.

**Full gate sweep re-run clean on the settled tree** (see baselines below) — nothing
regressed from either fix.

## What's actually left, and why it's mostly not engineering

Read this section literally: after this session, the overwhelming majority of what
remains on phase 33 is **blocked on Richard**, not on more driving or more code. Chase
these in roughly this order:

1. **B6 — verify the GitHub prefill by hand.** Two minutes: `node
   scripts/alpha-007/prefill-probe.js`, open the URL in a signed-in browser, check the
   eight points beside it (the four dropdowns matter most), close without submitting.
   This session's own captured URL is good evidence the *values* are right; B6 is the
   only remaining check on whether GitHub's own form actually *honours* a dropdown
   prefill from a query param — that can only be answered by a human with a session
   cookie. **If the dropdowns come back empty, the field contract changes shape** — do
   this before trusting ALPHA-007 criterion 3 is actually met.
2. **B5's two GitHub admin actions** (decided, not yet done): rename `opennoodl-docs`,
   then enable GitHub Pages on `NodeGX` for `docs-site/`. Once both are done — **not
   before** — the actual repo strip + `getDocsEndpoint()`/`nodeDocsPath()` repoint
   becomes real engineering work again (see the prior handover's notes on
   `nodeDocsPath()`'s URL-shape mismatch, still true, not touched this session).
3. **B2 — the leaked GitHub OAuth client secret.** Unrelated to this session, has been
   sitting open a while, and is a live security exposure until Richard revokes it and
   enables Device Flow on the OAuth app (two checkbox-level actions on GitHub's own
   settings page — see `HUMAN-GATED-ITEMS.md` B2 for the exact path). Worth surfacing
   again if it comes up in conversation; not something an agent can push forward.
4. **A1/A2/A3** — signing credentials (mostly already on Richard's machine per A1's own
   note) and, the actual long pole, **recruiting testers who are not Richard**. Nothing
   in phase 33 can reach its exit criterion without this.
5. **C1** — an outside reader for `PRIVACY.md`/`TERMS.md`.
6. **`docs-site-content/`** is still a stale duplicate of `docs-site/docs/` —
   `git rm -r` was blocked by the destructive-action classifier twice across sessions
   now. Needs a human to do it directly or explicitly pre-authorise an agent to.

**The one piece of real, unblocked engineering left**: ALPHA-007 criterion 4 (redaction
verified against a hostile fixture — an API key in a node parameter, a backend
endpoint, a component named after a client, a path outside the project root). This
session's spot-check (a real Electron CSP-warning URL correctly redacted) is encouraging
but is not the criterion — the existing 87-test unit suite covers the fixture case, but
it has never been driven through the actual live composer end to end. Worth doing next,
using the exact inspector recipe above (now proven to work) plus a QA-fixture project
seeded with the hostile strings the spec names.

## Gate baselines — full sweep re-run clean this session at `7d640495`

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests   # clean
npm run catalog:check                       # 175 nodes, up to date
npm run cloud-library:check                 # 84 nodes, up to date
npm run catalog:merge:check -- --require-coverage   # 175/175 documented, up to date
npx jest (from packages/noodl-editor)       # 933/933, 67 suites
npm run lint:ci                             # 860 errors vs 3916 baseline — unchanged from the prior session
npm run test:ci                             # Jasmine: 2418 specs, 0 failures — unchanged from the prior session
```

Not re-run this session (nothing touched them): `docs:nodes:check`, `docs-site:build`.
**`npm run typecheck:core-ui` is still not a gate**, red on files nobody owns — worth a
second look given this session touched a `noodl-core-ui` file (`BaseDialog.module.scss`);
`typecheck:editor` (which consumes core-ui) stayed clean, so nothing broke that a gate
would catch, but the module itself is still ungated.

## Driving traps — one new one from today, on top of everything already in `run-editor`

- **The main-process inspector needs `process.mainModule.require`, not bare
  `require`.** Connecting to `:9229` via a raw `ws` client and calling
  `Runtime.evaluate` lands in a context where `require` is not a global —
  `ReferenceError: require is not defined`. `process.mainModule.require('electron')`
  works. A small standalone Node script using the repo's own `node_modules/ws` is
  enough; no new dependency needed.
- **`Menu.getApplicationMenu().items.find(...).submenu.items.find(...).click()`**
  reaches any native menu item without displaying the menu itself — faster than OS
  automation, and it runs the exact same click handler a real selection would. One
  caveat, not yet resolved: because the native menu is never actually *displayed*,
  this does not exercise whatever focus/blur behaviour macOS applies when a human
  opens the real menubar. Still an open risk per `ALPHA-007-NOTES.md` item B — worth a
  real `osascript`-driven pass if it ever matters.
- Everything from the prior handover's list still holds — native menus invisible to
  `npm run cdp`, verify which project opened by name, `--target=editor` can attach to
  the launcher, occluded-Electron timer clamp, don't trust HMR for a mounted panel,
  the `text=...` selector syntax doesn't exist. Use the `run-editor` skill; it has all
  of this baked in.
- **A live session can trigger a real external side effect with no undo** — still true,
  still worth checking for before clicking anything report/submit-shaped. This session
  avoided it twice by patching `shell.openExternal` to capture rather than open; that
  pattern is reusable for anything else that calls out on click.

## What's still human-gated

**A1/A2** (signing secrets, mostly already present per A1), **A3** (recruit testers —
the long pole), **B1** (legal entity/contact/governing law), **B2** (revoke the leaked
GitHub secret, enable Device Flow — still fully open), **B5** (two GitHub admin actions,
decided, not yet done), **B6** (verify the prefill by hand — two minutes, now that the
composer is reachable this is genuinely quick), **C1** (outside reader for
`PRIVACY.md`/`TERMS.md`). **B4 is done** (2026-08-06, confirmed live via `gh label list`
this session) — stop carrying it as owed.

## Rules of engagement

- **`git commit -m "…" -- <explicit paths>`. Never `git add -A`, never stash, never
  `git checkout`/`git restore` a file you did not write.**
- **Commit incrementally, per slice.** An agent that has not committed has produced
  nothing.
- **Only one agent may own the Electron editor** — it is a queue, and a sibling
  `dev:stop` kills another session's `test:ci`. **Always `npm run dev:stop` when done.**
- ⚠️ **Before building anything a handover recommends: `git branch -a` and grep the log
  for the task ID.** This repo has shipped the "rebuild something that already existed"
  mistake twice.
- **Re-run the gates yourself on the settled tree at the end** — this session did, and
  it is the reason the B4 staleness was caught before it could outlive its own fix a
  third time.
- Task docs are researched but not infallible — re-measure, don't inherit. Verify a
  claim against the live system (`gh label list`, an actual click, an actual file read)
  before repeating it in a new handover, the way this session did for B4.
