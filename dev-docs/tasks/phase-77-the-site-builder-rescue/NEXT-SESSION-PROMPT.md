# Phase 77 — next session

## 🔴 STANDING HOLD — read before doing ANYTHING heavy

**Richard, 2026-08-28 (mid-s3): "avoid doing any CPU / RAM intensive testing until I
explicitly say to start again … Save the tests, we'll run them later and sweep up all the
work done at once."**

This line stays in this file until Richard explicitly clears it. Until then: no `test:ci`,
no full jest/vitest suites, no webpack builds, no editor stack (`dev:debug`/`dev`), no
backend fleets. Doc edits, code edits, small greps and single-file reads are fine. When he
clears it, run the **owed sweep** below first.

## The owed sweep (run when — and only when — the hold is lifted)

All from s3 (SBR-002); the work is committed, only the verification is owed:

1. **`test:ci` floor** — expect 2863+ specs / 4 failures, all `AIX-006 style vocabulary` by
   name. P75's 11:47 run (tree `1da48500`) predates SBR-002 and does not discharge this.
2. **`test:main`** — one run showed `2 failed, 371 passed` with only
   `"'siteBuilder' was also declared here."` surviving a truncated log; it ran beside webpack
   builds (the two-suites-at-once flake pattern). Identify the two suites (suspects `require`
   `site-builder.content.json`: `sb-017/cloud-ports-agree-with-the-runtime.test.ts`,
   `sb-018/*`), re-run clean, and treat a repeat as real.
3. **SBR-002 AC4 drive** — the half that is genuinely NOT yet verified (see below).

## Where SBR-002 stands (s3)

**Editor half: CLOSED, driven.** Wizard-created Site Builder projects open on `Pages/Setup`.
Channel: `ProjectTemplate.initialOpenComponent` → install writes project metadata →
`getDefaultComponent` resolves it first through `resolveFirstOpenComponent`
(`models/template/firstOpenComponent.ts`, pure module — `projectmodel.utils`'s import chain
cannot load in plain-Node jest, so the rule lives where both can reach it). Driven live:
opens on Setup (AC1), hint-less template unchanged (AC2), saved `selectedComponentName` wins
on reopen (AC3). `tests-unit/sbr-002/` 8/8.

**Template half: BUILT + spec-graded + regenerated, NOT driven.** The fourth state ("nothing
answered") is a `Timer` deadline (4000ms, armed by `page.didMount`) into a watchdog arm in
`diagnoseNotFound` that speaks only when nothing has answered; `NO_BACKEND_TEXT` in
`sb006Components.ts`. 🔴 The measurement that forced this design: with no backend the
preview's SPA fallback answers `undefined/classes/…` **200 + HTML**, and
`ParseWireAdapter.query`'s success handler throws on `response.results` — the query publishes
**neither `fetched` nor `error`**, so no failure-output wiring can ever see this state.
`sb006PublicSite.test.ts` 33/33 (incl. the ignores-an-answer mutant). Artefact regenerated:
id count **195** now (`sb-007/site-template.test.ts`).

**AC4 drive (owed):** three states, three distinct on-screen answers, each with its negative
control, measured with `elementFromPoint`-reachability not DOM presence:
- **No backend** → `NO_BACKEND_TEXT` after ~4s. Make a FRESH wizard project (old projects
  carry the pre-deadline graph), close it, strip `metadata.cloudservices` from
  `nodegx.project.json` (back it up), reopen, preview.
- **Backend, unclaimed** → `NOT_SET_UP_TEXT`, and the no-backend panel does NOT show (restore
  the binding; the backend must be running — the lifecycle starts it at open).
- **Claimed, bogus slug** → `NOT_FOUND_TEXT`; home page renders with panel hidden as the
  answered control. Claim through the Setup screen in the preview (the real flow — signup +
  claim); s2's probes never claimed "SBR Drive Site", but verify rather than assume.
- ⚠️ Modal ghosts: stamp the non-`[class*=Measuring]` copy, click twice; wizard flow drives
  fine via `data-sbr` stamps (s3 transcript pattern).

## Traps s3 hit that the docs did not carry

- 🔴 **The sb017 backend-helper connection total (101) does NOT move for browser-side template
  edits** — its population is the seven `/#__cloud__/` components only. The standing gate
  note said node count moves it; that is true only for cloud-component edits (comment now in
  `sb017-helper-is-lossless.test.ts`).
- ✅ `typecheck:editor` is **0 errors** now — the WFA-002 5-error baseline is gone; do not
  excuse new errors against it.
- ⚠️ `dev:debug`'s launcher exited unexpectedly twice in s3 (stack reaped cleanly both
  times; cause unidentified). If it recurs, check `.logs/dev.log` BEFORE deleting anything —
  s3 deleted the log and lost the evidence.

## After the sweep

SBR-002 closes when AC4 is driven. Then per build order: **SBR-003 (the token contract)** —
independent, everything visual depends on it; contract settled in the task file (shipped
182-token vocabulary, Studio defaults as template `designTokens`, `Theme` overlays same
names). **SBR-008 (derive `prop-` ports in runtime)** also unblocked and independent.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written.
- Shared checkout: pathspec commits only; announce editor launches and teardowns to peers;
  `test:ci` alone; end the session by updating this file, TASKS.md s-log, and memory.
- Drive artefacts on this machine: "SBR Setup Drive" (backend `backend_mtcvrppkyv22t`:8590,
  hint verified), "SBR Drive Site" (s2, backend `backend_mtctpzoolycw4`:8589), "SBR Hello
  Control" (no hint, no backend), scratch "SBR No Backend" (pre-deadline graph — stale for
  AC4), all in `~/vscode_projects/NodeGX test projects/`. A peer's stopped backend on 8588
  ("sb015 site backend") is already claimed — not a clean fixture, deletable.
