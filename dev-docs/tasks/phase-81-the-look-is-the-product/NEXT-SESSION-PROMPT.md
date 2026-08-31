# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
`VIB-001-BASELINE-VERDICTS.md` §7 (Richard's calibration) and `VIB-002-THE-CEILING.md` §1 (which
**corrects README §1(c)** — see below). Re-derive the board from `TASKS.md` + the task files; do not
trust this file's copy of it.

## Board, re-derived from the task files (2026-08-31, session 2)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 **CLOSED**, all 5 ACs. Baseline 9 SHITTY / 0 / 0 after Richard's ruling |
| VIB-002 The Ceiling | 🟡 **PASSABLE recorded, capability closed** (V5 + V13), 5 ACs met. Sheet sent to Richard; his look supersedes |
| VIB-003/004/005/007 | ⬜ all four startable now, in parallel |
| VIB-006 | ⬜ consumes 002/003/004 |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 | ⬜ the exit exam |

## 🔴 Read this before planning anything: README §1(c) is half wrong

Measured through the door (`get_node_type('Group', ports:[…])`), **not** from source:
`opacity`, `mixBlendMode`, `zIndex`, `position` (incl. absolute/sticky) and the whole `boxShadow*`
family were **already ports on Group**. Layering, depth and translucency-by-blend were expressible
the whole time and were **never taught** — no composition used them, no doctrine line named them,
`get_style_vocabulary` mentioned none. Only `backgroundImage` answered `notFound`.

**Do not assume the runtime is the wall.** Before opening any "the kit cannot express X" task, ask
the door whether it already can. Two thirds of VIB-002 turned out to be instruction.

## What exists now that did not

- **Five ports on `Group`** — `backgroundImage`, `backgroundGradient`, `backgroundSize`,
  `backgroundPosition`, `backdropBlur`. The two background ports compose into one
  `background-image`, gradient **first**, so gradient-over-photograph (a scrim) is one node.
- **Ten tokens** — 5 gradients (`--gradient-brand/deep/spotlight/surface/scrim`), 2 glass
  (`--surface-glass`, `--border-glass`), 3 **fluid** display sizes (`--display-sm/md/lg`,
  `clamp()`, 44px→96px). Every gradient is written in terms of other tokens, so presets re-theme
  them for free.
- **Two recipes** — `ui-gradient-hero`, `ui-image-scrim-band` (gated, 64/64 clean).
- **Three compositions** — `heroGround`, `imageGround`, `glassPanel`. `displayHeadline` now uses
  `--display-lg`.
- **Doctrine** — `prompts/design.ts` §3/§4/§7 rewritten around grounds and fluid type.
- **A second Judge run** — `packages/nodegx-backend/tests/vib002-ground.look.ts` + the demo project
  at `demo/vib-002-ground/` (built from the recipes by `demo/build-vib002-ground.js`).

## First job

**VIB-003 (The Pictures) or VIB-004 (The Marketing Kit)** — they are what VIB-002's own verdict
names as the WORTHY gap, in that order of leverage. VIB-003 is the sharper one: the page rendered
above has **zero icons** and one decorative photograph, and *"no imagery and no iconography"* is a
disqualifying tell that VIB-002 could not touch. Every one of the 62 shipped examples still carries
`src: ""`.

VIB-005 also gained its best evidence this session (V17 below) and is still fully startable.

## 🔴 Traps this session paid for

- **V17 — the ambush default defeated a session that had just read the diagnosis of it.** A shell
  with no `sizeMode` became `flexGrow:100` in a column, filled its 520px band, and the band's
  `justifyContent: flex-end` had nothing to justify: the copy sat at the TOP with 250px of empty
  photograph under it. **Every gate passed. `unreachablePx` was 0.** Confirmed by a control pair
  (one property changed, copy moved). Before/after PNGs kept in `verdicts/vib-002/2026-08-31/`.
- **V18 — the render harness lies if you comment a token wrongly.** `render-from-disk.js` rebuilds
  `:root` by regex (`name:\s*'…',\s*value:\s*'…'`) and `\s*` does not cross a `//`. **A comment
  between a token's `name:` and its `value:` makes that token silently absent from every page the
  Judge photographs**, while being perfectly present in the product. Caught before it produced a
  verdict. Warning comment now sits in `DefaultTokens.ts`.
- **A gradient token can read FLAT.** `--primary` → `--primary-hover` are one step apart; across a
  1900px band the eye cannot see it. Judge a decorative token at the width it will be used at.
- **`getGroupForToken` in `DesignTokensTab.tsx` is a SECOND COPY of the category→group map**, and
  it fails closed: an unmapped category returns `null` and the token vanishes from the editor panel
  while `get_style_vocabulary` lists it happily. A new `TokenCategory` must be added in both places.
- **The MCP server's `dist/` is stale.** `get_style_vocabulary` returned 18 of the 26 compositions;
  the missing 8 are the ones added by later tasks. Not a product defect — the bound server predates
  them. `styleVocabularyPorts.test.ts` proves all 26 render.
- **Rebuild the viewer before any Judge run that depends on a runtime change**
  (`npm run build:editor:_viewer`). A stale bundle renders new ports as simply absent — a flat band
  indistinguishable from the defect. `vib002-ground.look.ts` asserts the bundle contains them.

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31). App chrome is exempt
  from the marketing tells, never from *does anything here show a decision?*
- 🔴 **Never raise a viewport to make content fit.** The API has no parameter for it.
- 🔴 **Ask which states in a picture your HARNESS chose**, not the artefact.
- 🔴 **Neither look file is type-checked by anything** — the jest run is the typecheck.
- ⚠️ Shared checkout, and it was **busy** this session: a peer landed DEF-031 (`textOverflow` on
  Text) in `packages/noodl-viewer-react` while VIB-002 was in the same package.
  **`node-catalog.json` regenerates from the whole tree** — whoever commits it must commit their
  node source in the same commit, or `catalog:check` fails on a clean checkout. Commit by pathspec,
  `git add` untracked first, never stash, never `git checkout --` as an undo.
- ⚠️ P77 is active in site-builder files; P78 T6 owns D22/D23/D24; P80 owns door-correctness rows.
