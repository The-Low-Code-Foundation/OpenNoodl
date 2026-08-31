# VIB-001 — The Judge

**The instrument every other task in this phase closes through. Built first, before any fix, so no
fix can mark its own homework** (Richard's s5 ordering rule from P78, kept).

## §1 What it is

A harness that renders REAL pages of REAL artefacts and produces screenshots for judgment, plus
the protocol that turns a screenshot into a recorded verdict. It is NOT a spec suite. It has no
pass/fail of its own — its output is PNGs and a verdict written by a session that looked at them.

## §2 What it must render (the honest states)

For a given project/template directory:

1. **The user's door** — the artefact as shipped: NO backend bound (do not write
   `metadata.cloudservices`), nothing seeded, nobody signed in. This is the state every
   screenshot-taker, reviewer, and new user meets first, and the state neither P76 nor P78 ever
   rendered.
2. **The living state** — provisioned, seeded with honest sample content, signed in per role
   (visitor / member / moderator where relevant). The existing drive helpers
   (`packages/nodegx-backend/tests/helpers/members-drive.ts`, `site-drive.ts`,
   `tpl001-rows.look.ts`) already do this half — reuse, don't rebuild.

## §3 Viewports (fixed, not negotiable)

- **988×313** — the editor preview's default size until a device is picked. Yes it is absurd;
  that is the point. What a user sees first must at minimum degrade to something deliberate.
- **1280×900** — the historical grading width, kept for continuity with existing PNGs.
- **≥1900×1080** — the width Richard actually drove at, where the auto-fit and growers misbehave.
- **390×844** — phone.

🔴 **Never raise a viewport to make content fit.** P78's drive set `height: 1600` "tall on
purpose" to get a form above the fold — that move is banned here. If content is cut off and the
page cannot scroll, THAT is the screenshot.

## §4 Mechanics

- Base on `withRenderedPage` / `render-report.js` (`scripts/devtools/`) and the `.look.ts`
  pattern (`tpl001-rows.look.ts` — outside `testMatch`, run explicitly). Full-page capture via
  `captureBeyondViewport` AND a viewport-only capture — the pair shows both "what exists" and
  "what a person actually sees first."
- Output: PNGs + a small manifest (page, state, viewport, artefact md5, HEAD sha) into a
  `dev-docs/tasks/phase-81-the-look-is-the-product/verdicts/<task>/<date>/` directory so verdicts
  stay attached to what was judged. ⚠️ Check `.gitignore` before assuming the PNGs are committed
  (`git check-ignore -v`) — a verdict about an uncommitted pixel is a verdict about nothing.
- ⚠️ Known traps that apply (from memory, verified this week): the render harness needs the built
  viewer bundle (`noodl-editor/src/external/viewer/` — gitignored, a peer's dev stack rewrites
  it; stamp it); a refused generator leaves the previous artefact on disk (read the exit status);
  Postgres may be native on 5432 with Docker down; two package suites at once flake each other.

## §5 The verdict protocol (this file is the canonical copy; README §3 summarises)

1. The session Reads the PNG **as an image** in-context and writes in the task file: the verdict
   (SHITTY / PASSABLE / WORTHY), which rubric tells fired (README §2), in sentences a person can
   check against the picture.
2. A verdict written without the image in context is void. A verdict from the artefact JSON, the
   generator source, or geometry numbers alone is void.
3. Richard's look supersedes any session verdict, in both directions.
4. Not-WORTHY ⇒ the why-seam is named (VOCABULARY / CORPUS / INSTRUCTION / GATE / RUNTIME) and
   filed as a register row with an owner. This is work, not commentary.

## §6 Acceptance criteria

1. ✅ The harness renders BOTH shipped templates (`templates/members-area/`, the site-builder
   artefact) in BOTH states at all four viewports, from one command each.
2. ✅ The no-backend state is genuinely no-backend — the artefact rendered byte-identical to what
   ships (no `cloudservices` injection; assert the project file's md5 before/after).
3. ✅ Baseline verdicts recorded for both templates' key pages, with the PNGs in the verdicts
   directory. **These will be SHITTY. Recording that honestly is this task succeeding, not
   failing.** The baseline is what VIB-008/009 are measured against.
4. ✅ The banned moves are structurally hard: the harness takes no viewport override per call
   site; the state (door/living) is in the manifest so a verdict can't silently swap states.
5. ✅ **MET 2026-08-31 — and the calibration found the rubric wrong, which is what it was for.**
   Richard ruled the two PASSABLE verdicts SHITTY (*"passable in terms of you can at least see the
   elements clearly and interact, but they still look like original Wordpress default templates"*).
   README §2 amended: legible-and-operable is the floor, not a grade; app chrome is exempt from the
   marketing tells but not from the default-template test. Baseline is now **9 SHITTY / 0 / 0**.
   Sheet:
   **https://claude.ai/code/artifact/05e4edb4-ae93-4a88-b517-6b292d1e3434**
   (nine pages, nine verdicts, the rubric, and the three calibration questions). He has seen it (one artifact/page collating the PNGs + verdicts) and
   agrees the rubric reads his bar correctly — this calibrates the Judge before anything is
   judged by it.

**Status 2026-08-31: 🟢 CLOSED, all five ACs met.** The baseline is in
`VIB-001-BASELINE-VERDICTS.md` — **nine SHITTY, zero PASSABLE, zero WORTHY** after Richard's
ruling (§7 there), which is the baseline this phase exists to move. ⚠️ The Judge closing does not
make its verdicts permanent: his look supersedes any of them, in both directions, at any point.

## §7 Explicitly out of scope

Fixing anything the screenshots show. The Judge only ever looks.

---

## §8 What was built (2026-08-31)

| file | what it is |
|---|---|
| `packages/nodegx-backend/tests/helpers/judge.ts` | the instrument: frozen viewports, the two states, the captures, the manifest |
| `packages/nodegx-backend/tests/vib001-members.look.ts` | TPL-001 at both doors — AC1's first "one command" |
| `packages/nodegx-backend/tests/vib001-site.look.ts` | the site builder at both doors — AC1's second |
| `dev-docs/tasks/phase-81-the-look-is-the-product/verdicts/` | PNGs + `manifest.json`, **not gitignored** (`git check-ignore` says so) |

Run either deliberately — the `.look.ts` suffix is outside `jest.config.js`'s `testMatch`, so
neither can slow a gate down or redden one:

```
npx jest --config packages/nodegx-backend/jest.config.js \
  --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
  packages/nodegx-backend/tests/vib001-members.look.ts
```

**How AC4's banned moves were made structurally hard**, rather than written down again:

- `shoot` takes **no viewport**. `VIEWPORTS` is frozen and every page walks all four. P78's
  `height: 1600` is not a thing a call site can express — the parameter does not exist.
- `state: 'door'` **refuses** a `backendPort` and **refuses** a `prepare` step, and throws if the
  project carries `metadata.cloudservices`. A door run that had quietly been bound cannot produce
  a picture at all.
- The project file is md5'd before the run against the shipped file, and again after. A verdict
  names the md5 and the HEAD sha it was taken at.
- `unreachablePx` is recorded on every shot, so content below a fold nothing can scroll to is a
  number beside the picture instead of something a taller viewport hides.

⚠️ **Neither file is type-checked by anything.** `packages/nodegx-backend/tsconfig.json` includes
only `src/**/*`, and its ts-jest runs `isolatedModules: true` (transpile, no check). The jest run is
the only thing that proves these compile, and it proves it by executing them. Same shape as the
`tsc -p noodl-editor` / `tests-unit` trap already recorded.

## §9 🔴 The harness defect this found in itself, before it judged anything

The first run photographed the members-area landing at 988×313 as **a pure white rectangle** — while
that same shot's full-page capture showed the hero at the top of the page.

The instrument was wrong, not the product. The scroll probe ran *before* the captures, on the
assumption that its reset put every container back; the page's scroll lives on an inner container
the reset did not restore, so the picture captioned *"what a person sees first"* was of a page
scrolled past its own content. Had it been believed, VIB-008 would have opened against a
blank-first-paint defect that does not exist.

**Fixed by ordering**: both captures now happen before anything touches the page, and the probe only
ever runs against a page already photographed. Its side effects cannot reach a picture. Every
verdict below was recorded from the re-run.

⚠️ The general shape is *verify the consequence, not just the mechanism*: the probe reported
`canScroll: true` correctly the whole time. Every number in the manifest was right. The picture was
wrong, and only looking at it said so — which is this phase's method making its own argument,
against its own first instrument.

## §10 Evidence retention

One baseline run is **152 PNGs / 7.8 MB**, and every task in this phase produces a before/after
pair. Policy, so this does not become a hundred megabytes of near-duplicates:

- **Keep**: each task's *baseline* run and its *closing* run — the two a verdict cites.
- **Delete**: intermediate runs, once the verdict they informed is written and the seam is filed.
  The manifest names the HEAD sha, so a deleted run is reproducible from one command.
- Never delete a run a recorded verdict still points at. A verdict whose PNG is gone is a verdict
  about nothing, which is the same failure as one whose PNG was never committed.
