# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
`VIB-004-THE-MARKETING-KIT.md` §1 and §5, which are the two places this phase's register was
found to be **materially wrong about its own premises** for the third and fourth time.
Re-derive the board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from the task files (2026-08-31, session 4)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 **CLOSED**, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 **PASSABLE — RICHARD RULED IT**: *"very passable, nearly worthy, definitely night and day with the original"* |
| VIB-003 The Pictures | 🟡 **PASSABLE — RICHARD RULED IT**: *"nice, deffo passable and looking like a modern base template, good job"* |
| VIB-004 The Marketing Kit | 🟡 **PASSABLE this session — NOT YET SEEN BY RICHARD.** 7 compositions, 2 new recipes, a six-band page shot at all four widths |
| VIB-011 The Stock Library | 🟡 **Pipeline proven, library unbuilt.** 🔴 Now the named blocker on VIB-004's WORTHY |
| VIB-005/007 | ⬜ startable now, in parallel |
| VIB-006 | ⬜ consumes 002/003/004 — **the kit it was waiting for now exists** |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 | ⬜ the exit exam |

## 🔴 Two things to show Richard, in this order

1. **The VIB-004 page.** `verdicts/vib-004/2026-08-31/marketing-door/marketing-desktop-full.png`
   (and `marketing-wide-viewport.png`). This session judged it **PASSABLE**; his look supersedes.
2. **The question that decides the next task.** VIB-004's own critique names one blocker and it is
   the one he already asked for: *every picture on the page is the same dark generated abstract,
   and three of them are the identical portrait.* The imagery tell does not fire — there IS
   imagery — but nothing on the page communicates anything about the product. **That is VIB-011.**
   If he agrees, VIB-011 is the next job and VIB-006 follows it.

## What this session settled

- **Seven compositions**: `ctaBand`, `footerBand`, `statTile`, `testimonialCard`, `badge`,
  `featureItem`, `actionRow` — every property lifted from a gated recipe, every one checked against
  a real port.
- **Two recipes**: `ui-cta-band`, `ui-testimonial-row`. The catalog is now **66 examples**.
- **A six-band landing page**, `demo/build-vib004-marketing.js`, `DEMO_OVERRIDES` empty, plus
  `packages/nodegx-backend/tests/vib004-marketing.look.ts` (4/4).
- **`ui-split-hero` repaired twice** — see "the hero" below.

## 🔴 Where the handoff you were given was wrong, and where this one might be

Three register rows have now been found to overstate or misstate their own finding. **Re-derive a
row from its predicate before building on it.**

- **V6** said *"zero marketing compositions of 26."* True of the compositions file, and read as
  "the kit cannot express a marketing page." **Five of the seven arrangements already shipped as
  gated recipes.** The gap was that none of them was a NAMED SET.
- **V12** said three *different* feature cards trip `repeated-sibling-subtree`. **The rule cannot
  see a component instance at all** — one node, no children, `size: 1`, skipped below the 3-node
  floor. The factored form the warning's own message recommends is invisible to it. Six specs
  existed and none covered that case.
- **V22** named `vis-columns-media-cards` and was read as the population. **It is 14 examples.**
  ⚠️ And the correction is itself unfinished: whether a `For Each` feeds item properties into ports
  that were never declared is a **runtime** question nobody has measured, and the answer decides
  whether those 14 are broken or work by another route. **VIB-007's first job on V22, and it must
  be a render, not a reading.**

## 🔴 The hero, and the reading that could not have found it

`ui-split-hero` pointed its media column at **`ground-ridge.svg`** — a *ground*, designed to be dark
and empty so text stays readable on it, used as a *subject* picture in a 560px box. It rendered as a
black rectangle at the top of the most-copied recipe in the corpus. Repointed at `tile-1.svg`.

Then the right half was still dead below the image; fixed with `justifyContent: center` + explicit
100% height on the media group.

🔴 **`contentBottom` was 2840px before that fix and 2840px after it.** `textChars`, `unreachablePx`,
`canScroll` and the content height were all identical across a change that visibly rebalances the
top of the page — the band's height is set by the copy column either way. **Only the picture said
so.** Third time this phase (V17; VIB-003's lost band; this).

## What is open, with owners

- 🔴 **V31 (new)**: the seven `--shadow-*` tokens are **unreachable**. Every one is a complete CSS
  `box-shadow` string; `Group` exposes only the six separate `boxShadow*` ports, and **no port in
  any of the 176 catalog node types takes a whole box-shadow string**. Depth has to be composed from
  parts and coloured with a non-shadow token. **V5's exact shape a third time.** Owner VIB-007.
- ⚠️ **V32 (recorded)**: `catalog:examples` does **not** run `raw-color-literal`. A raw
  `rgb(15 23 42 / 0.08)` written into a new recipe passed 66/66 strict; it was caught by reading the
  gate's header, not by the gate. *"The gate is green"* and *"the corpus has no raw colours"* are
  different claims. Cross-link V28 (the same sentence about spacing).
- ⚠️ **V27's 58 no-gap containers are still not fixed**, deliberately — each needs a render.
- ⚠️ **V29 is half closed.** The mechanism is named and built into `ctaBand` (**the defect is a
  `maxWidth` on the TEXT**; a measure belongs to the shell, which a band centres). But
  `ui-image-scrim-band` is **not** repaired — it is VIB-002's recipe and repairing it re-opens
  VIB-002's verdict. That half is VIB-008's.

## Gate readings taken this session (2026-08-31, on `e5b68d30` + this work)

| gate | reading |
|---|---|
| `npm run catalog:examples` | **66/66 clean**, strict, warnings-as-errors |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **79 suites / 1043 tests pass**, 93s |
| `styleVocabularyPorts.test.ts` | **13/13** |
| `repeatedSiblingSubtree.test.ts` | **9/9** (6 + 3 new, one a control) |
| `npm run typecheck:editor` | clean |
| `vib004-marketing.look.ts` | **4/4**, four viewports, `starterAssets.failed: []` |
| `npm run typecheck:backend-tests` | ⚠️ **see below — not a clean reading** |

🔴 **`typecheck:backend-tests` did not complete, and the cause is contention, not this code.**
First attempt died after ~10 min with a V8 fatal (a bare hex stack, **no `error TS` lines**); the
second was still running at 15 min. Both overlapped P80 session 34's `npm run dev:debug` on this
shared checkout — **three concurrent webpack processes, load average 19.35**. It is a CI gate
(`.github/workflows/pr.yml:39`) and passes there, so the slowness is the machine, not the config.

⚠️ **It still has to be re-run, because it is the ONLY gate that typechecks a `.look.ts` file** —
the backend's ts-jest runs with `isolatedModules: true`, so **a green jest run does not typecheck
it**. `tsconfig.tests.json` includes `tests/**/*.ts`, which covers look files.
**First job for the next session, once the checkout is quiet**:

    npm run typecheck:backend-tests

If it reports errors, they are most likely in `packages/nodegx-backend/tests/vib004-marketing.look.ts`
(this session's only backend file). Nothing else this session touched is in that gate's scope.

⚠️ **Do not repeat this session's substitute.** Re-running the look file through an ad-hoc jest
config with `isolatedModules: false` looks like a cheap typecheck and is **not a valid instrument
here**: it reports
`noodl-editor/.../authoring/candidate.ts:46 error TS2304: Cannot find name 'Crypto'` — a DOM lib
type, in a file neither look file owns. **The control settles it**: the identical command on
`vib003-pictures.look.ts`, which shipped last session, fails identically. The instrument resolves
`lib` differently from `tsc -p` and cannot distinguish a good file from a bad one. Use the real
gate.

## Standing cautions (unchanged, all still true)

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN.** Four for four this phase.
- 🔴 **A change to `DEFAULT_TOKENS` or `STYLE_COMPOSITIONS` owes
  `npx jest --config packages/noodl-mcp/jest.config.js`** (V24). This session measured the wire
  budget **before and after**: prompt 3,201 → 3,762, full 11,749 → 13,323; ceilings raised to
  4,000 / 14,000 with the numbers written into the spec. ⚠️ The cost is **structural** (pretty-
  printed `{value, unit}` objects), not prose — shortening descriptions would pay almost nothing.
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes
  a token from every Judge photograph.
- ⚠️ Shared checkout, busy: P80 landed DEF-035 (`e5b68d30`) mid-session and was driving
  `dev:debug` at close. Commit by pathspec, `git add` untracked first, never stash, never
  `git checkout --`.
- ⚠️ `test:ci` floor is **4, all AIX-006 by name**. Not re-run this session — nothing this session
  touched is in it.
