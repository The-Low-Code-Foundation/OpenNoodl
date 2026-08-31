# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
`VIB-001-BASELINE-VERDICTS.md` §7 (Richard's calibration) and **`VIB-003-THE-PICTURES.md` §1(a)**,
which corrects register V7 and shows how this session's own first measurement was wrong.
Re-derive the board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from the task files (2026-08-31, session 3)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 **CLOSED**, all 5 ACs. Baseline 9 SHITTY / 0 / 0 after Richard's ruling |
| VIB-002 The Ceiling | 🟡 **PASSABLE — RICHARD RULED IT**: *"very passable, nearly worthy, definitely night and day with the original"* |
| VIB-003 The Pictures | 🟡 **PASSABLE**, 5 ACs met, **awaiting Richard's look** (sheet below). The first phase-81 page on which the imagery/iconography tell does **not** fire |
| VIB-004/005/007 | ⬜ all three startable now, in parallel |
| VIB-006 | ⬜ consumes 002/003/004 |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 | ⬜ the exit exam |

## 🔴 First job: VIB-004 (The Marketing Kit) — and VIB-003's verdict says exactly what it is for

**Sheet sent to Richard 2026-08-31**: https://claude.ai/code/artifact/bb77d21d-0770-484a-85da-ad5b1b30a273

Three questions on it. **Read his answers before planning**, because the first two change the work:

1. **Is PASSABLE right, or still SHITTY?** A SHITTY reopens the tier rather than pointing at VIB-004.
2. 🔴 **The empty right-hand half at ≥1280 — re-asked.** VIB-002's sheet got no ruling and the
   handoff correctly said not to read the silence as agreement. *A hero can defend negative space;
   a feature band cannot* — which of those it is decides whether VIB-004 builds sections that fill
   the measure or sections that sit inside it.
3. Should the product ship starter pictures at all (see below).

**What VIB-003's verdict named as the whole remaining gap**, and it is one sentence: *nothing on the
page is a designed object.* The card band is a two-column row inside a Group with 12px of padding —
no surface, no border, no radius, no shadow — so it reads as a media **list**. `card` and `raised`
exist in the vocabulary and the recipe uses neither. VIB-002 §1 also found `boxShadowEnabled`,
`position: absolute`, `zIndex`, `opacity` and `mixBlendMode` **already ported and never taught**.
So a large part of VIB-004 is again instruction, not engine — ask the door before assuming a wall.

## What exists now that did not

- **`noodl_modules/starter-imagery/`** — 6 generated SVGs (2 wide grounds, 3 tiles, 1 portrait),
  ~6 KB total, in `STARTER_ASSETS`, so **every project has pictures, offline**. Regenerate with
  `node scripts/library/make-starter-imagery.js`. Reference one as
  `"noodl_modules/starter-imagery/tile-1.svg"`.
- **`get_style_vocabulary` has an `icons` block** — installed sets, a **complete copyable
  `iconIconSource` value** built by the picker's own `iconValueForGlyph`, and 36 glyph names with
  the remainder counted (`iconSets.ts`, `GLYPH_SAMPLE`).
- **`judge()` installs the starter assets and serves a COPY** — `run.starterAssets` is in every
  manifest. Nothing a run does now lands in a checked-in directory.
- **`starterAssetList.ts`** — the asset list, import-free, so anything outside Electron can read it.
- **`vib003-pictures.look.ts`** + `demo/vib-003-pictures/` (built by `demo/build-vib003-pictures.js`
  from the shipped recipes, **`DEMO_OVERRIDES` empty**).

## 🔴 Traps this session paid for

- **My own first measurement of the corpus was wrong, and it pointed at a day of unnecessary work.**
  The sweep filtered node parameters against a key list that did not contain `iconIconSource`, so
  every icon read as unset. **Two of three already carried complete Lucide values.** `asked −
  answered` is not `absent` — name the field you are looking for and check the filter contains it.
- 🔴 **The instrument could not have shown the thing the task was about.** The Judge photographs a
  template directory; a template directory is a real project minus what `installStarterAssets`
  writes a second later. No photograph could ever have contained an icon, and every baseline PNG
  was rendered without Inter. **Before opening a task, ask what the instrument is physically able
  to see.**
- 🔴 **`get_style_vocabulary`'s wire-budget gate was ALREADY RED on `main`** — 3,161/3,000 and
  11,720/11,000 with this task's additions removed. VIB-002's ten tokens and three compositions grew
  it legitimately; its gate table never ran the noodl-mcp suite. **A change to `DEFAULT_TOKENS` or
  `STYLE_COMPOSITIONS` is a change to an MCP response billed every turn, in another package.**
  ⚠️ **Any task touching tokens or compositions owes
  `npx jest --config packages/noodl-mcp/jest.config.js`.** Filed as V24.
- ⚠️ The **tool-surface budget is 8,280, not 8,200**, and headroom was ~26 tokens. A 228-character
  addition to one tool description blew it. Measure before widening a description.
- **A `Component Inputs` node with no `ports` passes `catalog:examples` 64/64 strict.** Every
  instance parameter is discarded and the component renders its defaults. V22, open, VIB-007.
- **An `Icon` with no `iconColor` is `#FFFFFF`** — invisible on any light page. V14's shape. V21,
  open, VIB-005.
- **A hard-coded `visualRoots` deleted a whole band** under a heading that still had its words:
  `textChars` 606, `unreachablePx` 0, every look-file assertion green. Only the picture said so.
- **An asset must be judged in the box it will be used in.** `ground-ridge.svg`'s light source was
  at a corner, which `objectFit: cover` crops out of a 560px hero — it rendered as a black
  rectangle. Same sentence as VIB-002 §4(b) about a gradient at 1900px.

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change**
  (`npm run build:editor:_viewer`).
- 🔴 **`render-from-disk` reads tokens BY REGEX — a comment between `name:` and `value:` deletes a
  token from every Judge photograph** while it is perfectly present in the product.
- 🔴 **`getGroupForToken` in `DesignTokensTab.tsx` is a second copy of the category→group map** and
  fails closed. A new `TokenCategory` must be added in both places.
- ⚠️ Shared checkout, busy: P80 landed DEF-028 and DEF-029 during this session. `node-catalog.json`
  regenerates from the whole tree — whoever commits it must commit their node source in the same
  commit. Commit by pathspec, `git add` untracked first, never stash, never `git checkout --`.
- ⚠️ `test:ci` floor is **4, all AIX-006 by name**. Confirmed again this session.
- ⚠️ P77 is active in site-builder files; P78 T6 owns D22/D23/D24; P80 owns door-correctness rows.
