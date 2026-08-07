# Phase 33 — handover prompt

Written **2026-08-07**, at the end of a session that closed three Tier B decisions
(B3/B4/B7), re-verified ALPHA-006 §1, drafted ALPHA-004's authored content, and resumed
ALPHA-001 Part A. Measured at `e0894ad8`. Replaces the 2026-08-06 handover, superseded in
full — that session's "tree is dirty" and "erg-005 is red" warnings are both **stale**:
the tree is clean and `test:main` was 878/3 (erg-005) as of last measurement, re-check
before trusting either number.

**The next session's job is ALPHA-001 §4 and §6, one more attempt at §5, then ALPHA-006
§2 onward now that ALPHA-004's content exists to fill it.**

Paste the block below into a fresh session.

---

Continue **ALPHA-001 Part A** — the cold-install first hour — against
`dev-docs/tasks/phase-33-alpha-launch`. Work on `cline-dev`, commit straight to it, no
branches, no PRs.

Read these first, in this order:

1. `dev-docs/tasks/phase-33-alpha-launch/PROGRESS.md` — task status and the full findings
   register. Its head carries a standing warning, still true: **re-measure a row before
   acting on it.** The 2026-08-07 log entry at the bottom is the most recent state.
2. `dev-docs/tasks/phase-33-alpha-launch/ALPHA-001-FIRST-HOUR.md` — the run itself, six
   sections, §1–§3 done (see below), §4/§5/§6 owed.
3. `dev-docs/tasks/phase-33-alpha-launch/HUMAN-GATED-ITEMS.md` — what only Richard can do.
   B3/B4/B7 are now done; A1/A2, B1, B2 (two GitHub admin actions), B5, B6, C1, A3 are not.
4. `docs-site-content/README.md` — ALPHA-004's staged authored content (concepts,
   getting-started, troubleshooting), written 2026-08-07, not yet wired into a site.

## What's actually done — don't redo it

- **ALPHA-001 §1** (launcher/first run): PASS, 2026-08-06.
- **ALPHA-001 §2** (import flow) **and §3** (library install): effectively discharged.
  Not by ALPHA-001 itself — by `dev-docs/tasks/phase-21-library-and-import/LIB-005-NOTES.md`
  §7–§10's live QA (2026-07-26, 2026-08-02), which ran the **identical checklist** §2
  cites verbatim, and recorded LIB-001 Criterion 5 as MET. Small residuals only: the
  LIB-002 visual-restyle eyeball check, and two checklist items (QA-6.1/6.3) that are
  unreachable from the shipped UI by design (filed as a finding, not a defect). Read
  LIB-005-NOTES.md §8–§10 before spending time re-running what it already ran.
- **ALPHA-006 §1** (node help off the network): done since `3dbd2914` (2026-08-03),
  re-verified green 2026-08-07 (18/18 tests, clean `typecheck:editor`). **ALPHA-006 §6**
  (Help Center) also done. §2–§5 are not.
- **ALPHA-004 §1/§2/§4** (concept set, getting-started, troubleshooting): drafted
  2026-08-07, `fb0cc18f`, staged in `docs-site-content/` since ALPHA-006 §2 (the actual
  Docusaurus site) doesn't exist yet. Grounded in `REACTIVITY-CONTRACT.md` and direct
  source reads, not invented. **One claim in `getting-started.md` step 1 was not
  independently re-verified against the live app**: that the launcher's "Quick Start"
  option starts from an App+Router+Home+"Hello World!" template rather than a literal
  blank graph, despite its own UI copy saying "Blank project with Modern preset." Two
  minutes to check before trusting that doc further.
- **B3/B4/B7** (repo rename, issue labels, Discord): all done 2026-08-07, see
  `HUMAN-GATED-ITEMS.md` for the detail. The repo is now `The-Low-Code-Foundation/NodeGX`
  — old links redirect but don't add new hardcoded `OpenNoodl` references.

## ALPHA-001 — what's left

**§4. The app-name round trip, with a real keystroke, then quit and reopen.** Not
reached 2026-08-07 — time went to hunting for the project-settings entry point live
rather than testing it. Find where the app name actually lives (F44's fix touched
`project.json` — grep for what wrote it) before assuming it's behind the gear icon in
the top toolbar; that icon was clicked once this session with no observable effect,
which is itself unconfirmed (might have opened something off-screen, might do nothing).

**§5. PLAT-005 Parts A, B and D** (variant-suggestion banner, token suggestions,
regression check on the Variants editor). Blocked twice now on the same root cause:
**no reliable way to click a specific node on the graph canvas**, because it's
Canvas2D-rendered, not per-node DOM. What's newly known, so the next attempt doesn't
re-derive it:

- `window.__nodeGraphEditor` is a real debug hook (`nodegrapheditor.ts:300`), live
  whenever a project is open. Confirm which component it's scoped to via
  `window.__nodeGraphEditor.model.owner.name`.
- The exact graph→screen transform, from `CanvasViewport.ts`'s `canvasToGraph` inverted:
  `screenCSS = (graphNode.global + viewport.panAndScale) * viewport.panAndScale.scale`,
  then add the `<canvas>` element's own `getBoundingClientRect()` `{left, top}`.
  `viewport.canvasWidth`/`canvasHeight` are **device pixels** (÷ `ratio` for CSS size);
  `panAndScale` is already in canvas-local CSS pixels.
- **The gap that actually blocked this session**: `window.__nodeGraphEditor.forEachNode()`
  only ever yielded **one** top-level node — a `Group` with 5 `Text`/`Button` children —
  while the canvas was visibly rendering unrelated `Array Filter`/`Counter`/`Object`
  nodes that never appeared in that enumeration, from any traversal tried. Either
  `forEachNode` doesn't do what its name suggests, or those nodes belong to a different
  scope than `.model.owner.name` reported. **Resolve this before trying more coordinate
  math** — it's a wrong-model problem, not a wrong-arithmetic problem, and guessing
  pixels against a wrong model is how the two accidental clicks below happened.
- A reusable click helper (exact-text match, or raw x/y, via `cdp.js`'s own exported
  `connect`/`evaluate`/`dispatchClick` so target-resolution stays correct) was written
  to `/private/tmp/.../scratchpad/click-helper.js` this session but **not committed** —
  it only exists for the session that wrote it. If it's useful again, it belongs at
  `scripts/devtools/` as a real command (`cdp.js clickxy <x> <y>` and
  `cdp.js clicktext "<text>" [--nth=N]`) rather than being reinvented each time — the
  library functions it needs (`elementCentre`, `dispatchClick`) are already exported
  from `cdp.js`.
- Two accidental clicks happened while guessing coordinates, both harmless: one hit the
  observability HUD's "Record" button (stopped cleanly via its own Stop button, "Recorded
  nothing"); one hit the QA fixture's "PRESS" control, firing it once and surfacing two
  *expected* runtime warnings on the fixture's deliberately-unwired `Object`/`Array
  Filter` nodes (not a defect — don't re-file it).
- Use the **`NodeGX QA Fixture`** project for this (`Recent projects` in the launcher of
  the live profile) — it's a real, purpose-built fixture (see the
  `nodegx-qa-fixture` note in project memory), not a throwaway. `erg-rig` is the
  component memory flags as good for signal QA; you likely want a **different**
  component in the same fixture with an actual `Button` node for PLAT-005's variant test
  — check the `Test`/`Uncategorized` folders and the fixture's own component tree first.

**§6. AI panels with no provider configured.** Not reached. Should be the most tractable
of what's left — mostly navigation and reading rendered state, no canvas interaction.

**Part B** (packaged-build pass) still needs ALPHA-002's signed build — human-gated,
not yours to unblock.

## userData — the fresh-profile requirement

ALPHA-001 wants a **fresh `userData`** for §1's genuinely-first-run test. The automated
move-aside of `~/Library/Application Support/NodeGX` was **blocked by the permission
classifier** this session (reasonable — it's outside the repo). A parallel profile
already exists at `~/Library/Application Support/NodeGX.alpha001-freshrun` from
2026-08-06 (post-§1, pre-contamination) if you want to reuse it rather than create
another. Options, in order of friction: ask Richard to do the `mv` swap by hand and
restore it after; ask for permission to do the swap yourself; or do what this session
did and run against the live profile, noting §1 isn't being re-verified fresh.

## The verdict you owe, once §4/§5/§6 are attempted

Report a **go / no-go on cutting the alpha**, and be precise about which question you
are answering — there are two and only one is yours:

- ✅ **"Is the product ready to put in front of strangers?"** — you can answer this.
  Findings, severity, and for each: blocks the release / fix before strangers / file and
  ship.
- ❌ **"Is phase 33's exit criterion met?"** — you cannot answer this. The criterion is
  *"each of those three demonstrated by someone who is not Richard and did not build
  it."* An agent driving the editor satisfies none of it. Say so plainly.

State explicitly what's still human-gated: **A1/A2** (signing secrets — the Apple cert
already exists, ~15 min of export once Richard does it), **A3** (recruit one macOS, one
Windows, one Linux tester who've never built this — the long pole, nothing shortens it),
**B1** (legal entity/contact/governing law — a `TODO` inside the shipped binary), **B2**
(revoke the leaked GitHub secret `c45276fa…` and tick "Enable Device Flow" on OAuth app
`Ov23li2n9u3dwAhwoifb` — both admin actions on github.com, neither optional), **B5**
(docs-CDN disposition decision), **B6** (verify the ALPHA-007 issue prefill by hand,
`node scripts/alpha-007/prefill-probe.js` prints the URL — needs a signed-in browser),
**C1** (an outside reader for `PRIVACY.md`/`TERMS.md`).

## Gate baselines — NOT re-run this session, re-run before trusting them

The 2026-08-07 session only ran targeted suites for files it touched
(`tests-unit/alpha-007`, `tests-main` legal-window/issueForm/github-*, ALPHA-006's
`nodeDocs.test.ts`, `typecheck:editor`) — all green, but that is not the full sweep. The
last **full** sweep on record is 2026-08-06's, now a day stale:

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests    # clean
npm run catalog:check && npm run cloud-library:check && npm run catalog:merge:check
                                            # 172 nodes / 81 cloud / 172-172 enriched
npm run library:check                       # 58/58
npx lerna run test --scope @noodl/runtime           # 2298
npx lerna run test --scope @noodl/cloud-runtime     # 172
npx lerna run test --scope @noodl/nodegx-backend    # 97 suites / 1056
npx lerna run test --scope @noodl/observe           # 23
npx lerna run test --scope @noodl/mcp               # 196
npm run test:main                           # 878 passing, 3 failing (erg-005, unowned)
npm run test:ci                             # Jasmine: 2391 specs, 0 failures
```

⚠️ **`test:main` reports `Tests: 0` for a suite that won't compile** — compare the
passing count, not the exit code. `npm run typecheck:core-ui` is **not a gate**, red on
files nobody owns. **Re-run the full sweep yourself on the settled tree at the end of
the session** — every session that's done this has found something.

## Driving traps — each has cost real time

- **Verify WHICH project actually opened, by name**, before believing anything.
- `--target=editor` **can attach to the launcher** — same file, first match wins.
- **An occluded preview repaints late; reading its DOM is not measuring the graph.**
- **An occluded Electron window clamps timers ~1000×.** Pace drivers with `MessagePort`.
- A sibling's edit **full-reloads the editor** and kills every one-shot state.
- Each `npm run cdp` costs ~1.5s — collapse click-then-measure into one call where you can.
- `screenshot`/`reload` on the viewer target are unsafe; the in-editor preview is a
  `<webview>` guest and killing it white-screens the editor.
- **Restart the editor; do not trust HMR** — it will not reach a mounted panel.
- **`cdp.js click "<selector>"` only takes a CSS selector** (`document.querySelector`,
  first match wins) — for canvas-drawn nodes this does nothing useful; see §5 above.
- **Getting a `DOMRect` back through `evaluate()` needs explicit field extraction**
  (`{x:r.x, y:r.y, ...}`) — `JSON.stringify`-ing a live `DOMRect` gives `{}`, its fields
  are prototype getters, not own properties. Cost one dead end this session.
- Check both themes. Use the `run-editor` skill — it has all of the above baked in
  already; read it before re-deriving any of it by hand.

## Rules of engagement

- **`git commit -m "…" -- <explicit paths>`. Never `git add -A`, never stash, never
  `git checkout`/`git restore` a file you did not write.**
- **Commit incrementally, per slice.** An agent that has not committed has produced
  nothing.
- **Only one agent may own the Electron editor** — it is a queue, and a sibling
  `dev:stop` kills another session's `test:ci`.
- ⚠️ **Before building anything a handover recommends: `git branch -a` and grep the log
  for the task ID.** This repo has shipped the "rebuild something that already existed"
  mistake twice now (ALPHA-006/007 in worktrees, then again).
- **Re-run the gates yourself on the settled tree at the end.** Not done 2026-08-07 —
  see above. Every session that's done it has found something.
- Task docs are researched but not infallible — roughly two premises per doc are wrong.
  Re-measure, don't inherit.
