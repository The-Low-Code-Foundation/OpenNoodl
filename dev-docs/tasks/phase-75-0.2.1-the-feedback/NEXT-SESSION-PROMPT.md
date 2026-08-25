# Phase 75 — next session

**State as of 2026-08-25 (session 31).** Session 30 built, specced and drove FB-021 and then rolled
its context while `test:ci` was still running. **Session 31 read that suite out, reviewed the diff,
fixed what the review found, and COMMITTED it** — `2edc6946` (feat) and `7e0f4564` (docs). FB-021
scopes 1, 3 and 4 are CLOSED, AC1–AC4. Read *"What session 31 found"*, then pick from *"First
moves"*.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout, idle and cooperative (it held the checkout
still for session 30's `test:ci`). `39469` is `trybeup-prod-c0`, `vh-orchestrator-b3` and
`comcoi-v2-f3` are other projects. 🔴 **`SendMessage` to a cross-session peer needs the `[ref]`** —
the bare name is rejected with the ref in the error, so just re-send.

## What session 31 found

### ✅ `test:ci` IS AT THE FLOOR — 2849 specs, 4 failures, all four AIX-006, matched BY NAME

Session 30 started it at ~14:58 and never saw it finish. It completed 15:13:30.
`Jasmine: 2849 specs, 4 failures (failed).` The four are the `AIX-006 style vocabulary` set exactly
as the baseline records them, **compared by name and not by count**, and none is in FB-021. The 50
new `fb-021` specs live in `tests-unit/`, which is **`test:main`'s** suite, so 2849 being unchanged
from baseline is the expected reading rather than evidence the new specs did not run.

🔴 **A notification saying *"Wait for suite completion — completed, exit code 0"* arrived while the
suite was still running.** Its output file was **empty** and the pid was still alive. Fourth session
running that a wrapper's exit code has read as a result. ✅ **The only completion signal is the
summary line**; an `until grep -qE "Jasmine: [0-9]+ specs"` loop that *also* breaks on the process
dying is the form that cannot go quiet either way.

### 🔴 REVIEWING THE DIFF FOUND TWO THINGS, BOTH SOURCE-READABLE IN MINUTES, NEITHER SPEC-REACHABLE

1. **The two amber rules are the same amber.** `colors.css:483` says it in its own words —
   *"`notice` is the legacy name for warning and aliases onto it"* — and the light block overrides
   `--theme-color-warning` **without restating `notice`**, so the alias holds in both themes.
   FB-021's comment claimed the choice was doing work (*"warning rather than notice"*). It is not,
   and `portGate.ts` appends **both blocks to the same wrapper**, so a gated port that is also wired
   shows two 2px amber rules stacked, one meant to read as more serious. ⚠️ Two more claims in that
   block were also wrong: *"outside the control on purpose"* is true of **both** blocks (the real
   separation is opacity `.85` vs full), and *"only the accent differs"* is **inverted** — the accent
   is the one thing identical to `.property-capability-reason`; they differ by a 6px/8px margin.
   ✅ **Fixed as comments only, no rule changed** — FB-017's `.property-structural-hint` already
   documents this aliasing and keeps the distinct token deliberately so the two can diverge later.
   That convention is right; FB-021 now follows it honestly instead of claiming a difference it does
   not have.
2. ✅ **The missing `'target'` argument is NOT a defect** — session 30 left it as an unowned worry.
   `ModelProxy.isPortConnected(name)` **takes one parameter and forwards none**, so all ~25
   `DataTypes/` call sites passing `'target'` are passing it into a function that discards it.
   FB-021's call is behaviourally identical to every other row; adding `'target'` would have matched
   them in appearance while changing nothing. 🔴 **The real issue is one level up and was left
   alone**: the panel's evident intent that only *inbound* wires count is honoured **nowhere**, so an
   `input/output` port wired only outbound reads as connected to every row — under FB-021 that would
   put *"a value is arriving and being discarded"* where nothing is arriving. Fixing the proxy
   signature moves FB-018's chip on 25 row types and must be driven, not slipped in.

⚠️ **Both have the same shape, and it is worth carrying forward.** A comment asserting a *visual*
difference is a claim about **rendering**; reading the source back proves only that the token is
spelled the way the comment spells it. **Resolve the token before believing the sentence.** And a
difference in **argument lists** is not a difference in **behaviour** until the callee's signature is
read — the source said *"FB-021 is inconsistent with 25 neighbours"*, the truth was *"FB-021 matches
all 25, and all 26 are inconsistent with their own stated intent."*

## First moves, in order

1. **FB-021 scope 2 — the connection panel.** 🔴 **Needs Richard first**: should a `basic`-gated port
   stay wireable at all, or should the popup refuse it the way refused connections already explain
   themselves? The popup already *offers* these ports, so the work is to mark them inert, not to
   start showing them. Everything else in FB-021 is closed and committed.
2. **FB-023** — was being worked by `3878`; check with it before starting.
3. ⚠️ **The 9 `#js` ports keep the original defect** — on an Icon with a wire into `iconImageSource`
   the value is still delivered and discarded silently. Reaching them means parsing the JS
   expression, which `dynamicPortRules.ts`' header argues against by name.
4. ⚠️ **Deliberate remainders, unchanged**: FB-011 AC1 superseded; FB-007's composer undriven in a
   browser; `apisurfaces.ts`' `personProfile` flat disc.
5. **Still needing Richard**: FB-021's dead-wire colour (below); FB-017 scope 2's `Source Set`
   demotion; FIX-026 (a)/(b); FIX-027 14/15/16 + 22; tsfixme baseline; prod `ANTHROPIC_API_KEY`
   (⚠️ **intro pricing ends 2026-08-31 — six days**); the 15 lessons' prose; Discord's row in the
   `?` menu; `/rfps` search.

## Found while working, owned by nobody

- 🧭 **NEW, a design call not a defect**: FB-021's dead-wire line and its reason line are the same
  amber and **co-occur on one row**. Should the dead wire become louder — `--theme-color-danger`
  exists and is red in both themes? The capability-gating precedent argues *against* red (*"this is
  information, not an error"*), but that was said about a port that **cannot** work, not one that is
  working and being thrown away.
- 🔴 **NEW**: `ModelProxy.isPortConnected` drops its `type` argument for the whole property panel
  (above). Latent, unreached on any fixture, and it touches 25 row types when fixed.
- ⚠️ **FB-021's highlight is still verified as a class and a focus, never as pixels.** Nobody has
  looked at `.property-port-gate-target`'s outline in either theme. *(The colour half of this is now
  partly answered — the tokens resolve — but the outline itself is still unmeasured.)*
- ⚠️ **Only `Group` was driven.** The other 174 node types are covered by the catalog sweep, which
  grades *sentences* and not *rendering*.
- ⚠️ **FB-022's crosshair** is settled by mechanism, not pixels (s29) — driving it needs the app
  RUNNING, a different mode from the one the property panel lives in.
- ⚠️ **`user-select: none` during a drag** confirmed *set*, never confirmed to prevent a painted
  selection (s29).
- ⚠️ **One commit in three dropped focus, still NOT characterised** (s28).
- ⚠️ **FB-016's auto-margin branch** is still written, specced and never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` is STILL uncommitted — twelfth session running.** Belongs to
  no session; Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug is untouched: a **selected** node whose element has gone is never
  removed from `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchanged and unchased: `SidebarModel.switch('PortEditor')` crashes the panel; the Settings panel
  clips two rows; a `Number` node draws a group literally called `ADVANCED` beside the synthetic
  `Advanced CSS`; `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in
  `nodegx-community` has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not mine**: the projects page logs `Encountered two children with the same key`
  repeatedly for one project id, and `feed.json` 404s.

## ⚠️ Harness — corrections and confirmations

- 🔴 **A wrapper's "exit code 0" is not a suite result** — a notification claimed completion with an
  **empty** output file while the pid was still alive. ✅ **Poll for the summary line, and break on
  the process dying too**, so a crash cannot read as "still running".
- ✅ **`postcss` is resolvable from the repo root** and parses `propertyeditor.css` in one node
  `-e` — a real parse (87 rules, selectors asserted present) costs seconds and beats a brace count
  for validating a CSS edit.
- 🔴 **`grep` for `--theme-color-*` hits the built bundles** (`src/frames/viewer-frame/index.bundle.js`)
  and returns megabytes of sourcemap. ✅ Scope to `--include='*.css' --include='*.scss'` and the
  `src/styles` trees; the truth for tokens is
  `packages/noodl-core-ui/src/styles/custom-properties/colors.css`.
- 🔴 **A drive probe that selects several nodes inside ONE `eval` reads one stale DOM** (s30).
  ✅ Select and read in separate calls.
- 🔴 **`window.__pv`-style handles do not survive `cdp reload`** (s30). Re-acquire, then re-read.
- ⚠️ **The pencil `ModeSegmentedButton` selector is stateful** (s30) — `[aria-pressed=false]` selects
  *the other* mode. Read the pair and assert which one you want.
- ✅ **`projectFromDirectory` (`models/projectmodel.editor`) opens a project WITHOUT touching the
  recents list** (s30) — better than the launcher path for a drive.
- ✅ **Prove the gate sees new files by planting errors** — 4 planted → exactly 4 reported.
- ✅ **`dev:stop` reported 25 processes and spared all 8 MCP helpers** — verified by `ps` after.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:ci`: ✅ **2849 specs / 4 failures — THE FLOOR**, all four `AIX-006 style vocabulary`,
  matched by name. Completed 2026-08-25 15:13:30, run alone with the checkout held idle.
- `npm run test:main`: **333 files / 5380 specs / 0 failures** (s30). ⚠️ Its first run showed 1
  failure in `tests-unit/bld-004/reasoningChannel.test.ts` (a stall-timer race) — **3/3 green in
  isolation and green on the full re-run; a flake, not FB-021.**
- `npm run typecheck:editor`: **0 errors** (s30), proved to see all four changed files by planting.
- `npm run catalog:check`: **clean** — "Committed catalog is up to date", 175 node types.
- ⚠️ **Not re-run after session 31's edits** — they are CSS **comments** and markdown only, plus a
  `postcss` parse of the changed stylesheet. `test:ci` above ran against the code as committed.
- 🔴 **`npm run typecheck:core-ui` is a PRE-EXISTING DIRTY GATE: 44 errors, none of them ours.**
  **Do not quote it as passing.**
- Not run, nothing touched them: `typecheck:viewer`, `noodl-runtime`, all of `nodegx-community`.

## Gates, `nodegx-community`

Unchanged since session 18 and **not re-run**: 58 files / 1398 specs / 0 failures, `tsc` clean,
`build` clean, `check:css` 1 pre-existing violation. nexus-1 serves `acd4a9a`. **FB-021 is
editor-side and does not deploy.**
