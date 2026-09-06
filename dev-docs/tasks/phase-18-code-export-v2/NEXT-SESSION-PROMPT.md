# Next session — session 97 (2026-09-06) built EXP-014, EXP-015 and EXP-016 together: the three divergences the TPL-003 landing-pages export drive found, all three now built, gated and driven on one reverted-worktree pair. The hero went from **1.03:1 to 17.24:1**, the exported page from **0 headings and 0 landmarks to 1 h1 / 5 h2 / 5 section / 1 main** (the viewer's own column), and body/heading/button from `system-ui`/`system-ui`/**`Arial`** to Inter throughout. Picker 117/127 (92.1%) unchanged — all three are parameter fixes inside already-translated nodes. Next = §14.5's `<img src>` residual OR back to EXP-011's queue (§74.5's TS2322 sink, then §69.4 #1's cascade sentence, then §71.5's ruling)

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 97 ran single-spec jest for the rows and the
21 arms, then **one** whole-package run, the editor tsc, the ledger + picker checks and `test:ci`
strictly one after another; the drive's two `vite preview` servers and the headless Chrome were
torn down the moment the last reading was taken (`lsof -ti tcp:PORT -sTCP:LISTEN`), and the
reverted worktree was `git worktree remove`d. Load was 3.8–4.8 throughout.
🔴 **The ledger was edited AFTER the first whole-package run, so the run was repeated** — many
specs read `coverage-ledger.json`. Restart the gate chain whenever the tree moves under it.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (4 `0.1.1` rows carried) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged. ⚠️ EXP-002-TARGET-OUTPUT's "Semantic HTML" row was rewritten by s97 |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's); §69.4 #1 (the cascade sentence on the node in front) |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 124 translated. 🔴 **New open question from EXP-014 AC5**: a node can be `translated` while dropping the parameter that decides what it looks like. No per-parameter coverage exists, and nothing gated three visible gaps for seventeen sessions |
| EXP-009 / EXP-010 / EXP-012 / EXP-013 | 🟢 |
| EXP-011 picker coverage | 🟡 **117/127 (92.1%)** — every scheduled tier built and driven; the 10 left are §50 out-of-scope RULINGS. §74.5 #1 still open |
| **EXP-014 the ground** | 🟢 **BUILT, GATED, DRIVEN s97.** One residual, §14.5, owner NONE |
| **EXP-015 the tag** | 🟢 **BUILT, GATED, DRIVEN s97** |
| **EXP-016 the typeface** | 🟢 **BUILT, GATED, DRIVEN s97** |

## What session 97 did

1. **EXP-014** — `computeNodeStyle` grew the background fold, transcribed from the runtime's
   `_updateBackgroundLayers`: two ports into ONE `background-image` with the **gradient first** (the
   scrim idiom), `background-size`/`background-position` from the catalog defaults, an unported
   `background-repeat: no-repeat`, and nothing at all when neither layer is set. `backdropBlur` is a
   separate rule — both spellings or neither, a zero emitting nothing. `blurLength` is the runtime's
   `cssLength` plus its zero gate; `cssUrl` is the **one** non-transcription, and it had to be: a
   relative `url()` in a CSS module resolves against the **stylesheet**, so a project-relative
   picture is made root-absolute, which is where the `copies` channel already puts it.
2. **EXP-015** — `authoredTag(node, fallback, catalog)`, exported and pure so the spec grades it
   directly, plus a `tagOf` closure that also reads the **collapsed Group** for a page div. Validated
   against `CatalogIndex.enumValues` (new): no element list is written anywhere in the package.
   Three refusals, in order — void element (first, so the guard is not dead code behind the enum
   test), no Tag port on the type, off-enum — each a named note **and** an in-code marker.
3. **EXP-016** — `baseCss()` is the runtime's two `body` declarations plus
   `button, input, select, textarea { font: inherit }`.
4. Two fixtures (`ground-desk`, `tag-desk`), three specs (32 + 32 + 14 rows), **21 arms, 21/21**.
   Ledger `Group`/`Text` notes, `EXP-002-TARGET-OUTPUT`'s Semantic HTML row, README + PROGRESS.

## The gate chain — READ on this tree

**whole pkg jest 83 files (83 on disk) 3126/3126 exit 0** (run TWICE — once before and once after
the ledger edit) · **package `tsc` exit 0** · **editor `tsc -p tsconfig.json --noEmit` exit 0, empty
log** · **`export-ledger:check` OK — 176 types, 124 translated** · **picker 117/127 exit 0** ·
**editor `test:ci` 2943 specs, 4 failures = the floor BY NAME** (AIX-006 ×4; seed 61662;
`tests/test-results.json` fresh 12:13, 3112 bytes; `.webpack-cache` cleared first; exit 1 as always
on the floor; HEAD `f0675a6f`). **Drive**: both arms `npm install && tsc -b && vite build` exit 0,
no hand edits, 82 modules; served and measured in one headless Chrome; pictures in the s97
scratchpad `26fc68ac-…` (`before-*.png` / `after-*.png`).

## Uncommitted at hand-off

Nothing of session 97's after `e2ea5190` (feature) and `d7ede3c3` (docs).
`EXP-001-NODEGX-CORE.md` still carries a PEER's edit, untouched. `packages/noodl-types/src/runtime/
node-definition.d.ts`, `scripts/devtools/render-from-disk.js` and `render-report.js` are peers',
untouched, as are `library/**`, `packages/noodl-core-ui/**`, `packages/noodl-editor/**`,
`packages/noodl-mcp/**`, `packages/noodl-runtime/src/**` and every other phase's dev-docs.

## 🔴 Do this next (BUILD)

1. **§14.5 — the `<img src>` channel is still project-relative.** `contentAttrs` prints
   `src="noodl_modules/starter-imagery/food-grocer.webp"` verbatim and the emitted `index.html`
   carries no `<base>` (measured). A relative URL resolves against the **document**: on `/business`
   that lands on `/noodl_modules/…` and works, on a two-segment route it lands on
   `/blog/noodl_modules/…` and 404s (`new URL('noodl_modules/x','http://h/blog/post')` in the
   running app). Every route this template emits is depth 1, which is why the drive read **0 broken
   images** — so this is a residual, not a finding, and it needs a fixture with a nested `urlPath`
   to grade. The fix is `cssUrl`'s rule applied to the `attr:src` channel: `Image.src`,
   `Image.srcSet`, `Video.src`, `Video.poster`. Half a session. Owner NONE.
2. **§74.5 #1 — the `unknown`-into-a-typed-store-key sink.** `mood.set({ theme: ghost.get() })`
   where `theme: string` is TS2322 in the built app (`probe74c.ts` in the s96 scratchpad
   `47ba0b96-…` reproduces it). §72's treatment one sink over: where the key's `tsType` is `string`
   and the expr is an `unknown` read, print `String(x ?? '')` — the shape §72 picked for the record
   Id. Check the `object-set` and `store-set` twins (MEASURE, do not reason). One session.
3. **§69.4 #1 — the cascade sentence lands on the node IN FRONT of the refused sink** (seen §69.0,
   §70.0, §73's F4). Registration pass; every `dropped:` note pin moves, so the whole-package run
   is the sweep.
4. **§71.5 — the editor cannot author a `Model2` `prop-*` value.** A product-surface ruling for
   Richard. And EXP-008's new question above, if EXP-014 AC5's per-parameter coverage is wanted.

## What this session learned, and would want said again

🔴 **A task file's "what is true today" is a MEASUREMENT WITH A TIMESTAMP, not a premise — re-take
the ones your change depends on.** Three of the nine claims across these three files were wrong,
and each was cheap to check: the `as` drop *was* reported (61 notes, 61 report lines, 61 in-code
markers — the file said "not refused, not noted"); `document.fonts` read **`unloaded`**, not
"4 faces loaded", because a browser does not fetch a face nothing uses; and a `var()` fallback was
written on the reasoning that 39 of 40 fixtures are token-less, which `effectiveTokens` disproves in
one line. All three were caught, but only because the reverted arm was built and the spec was
written before the belief was trusted.
🔴 **A node can be `translated` in the ledger while dropping the parameter that decides what it
looks like.** All three of these gaps sat green through 17 sessions of picker work behind a
`status: translated` row and a corpus that never used the ports. **Rank by the product surface.**
🔴 **`&& false` is not an arm** (fourth recurrence): M11 read `NO SUMMARY / 0 total`, which is a
mutant that did not compile, not a kill. Arm at the VALUE level.
🔴 **Restart the gate chain when the tree moves under it** — the ledger edit landed after the first
whole-package run and many specs read that file.
🔴 **A control that varies exactly your change beats a memory**: the reverted worktree reproduced
1.03:1, `h1: 0`, `Arial` and `Inter … unloaded` to the digit, which is what makes the after-readings
mean something.
⚠️ `drive-page.js eval` takes a function BODY — an expression without `return` answers `{}`.
⚠️ `TAGS[role]` keeps `text: 'p'` while the port's own default is `div`, so an untagged Text renders
`<p>` here and `<div>` in the viewer. Pre-existing, deliberately unchanged (AC1's byte-identical
clause), and the one element name the two renderers still disagree about.
