# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s35 closed SBR-012 — all four ACs, and SBR-004's AC3 with it.**

**Three tasks in three sessions.** s33 closed SBR-006, s34 closed SBR-015, s35 closed SBR-012.
One defect row was filed in that span — [D35](DEFECTS-THE-SITE-BUILDER-FOUND.md#d35) — and it is
already **fixed**, because the gate that found it left no other disposition open.

**`packages/noodl-mcp/tests/sbr012RawColourGate.test.ts` — 25 specs, ~0.7 s**, plus
**`siteBuilderStyleScan.ts`**, the instrument, extracted so this gate and `sb006PublicSite.test.ts`
scan from **one** definition of "colour".

| arm | artefact (289 KB) | component sets (4 files) |
|---|---|---|
| raw colour — `#hex` / `rgb()` / `hsl()` | **0** | **0**, comments stripped |
| unresolved `var(--x)` | **0** of 33 distinct, 284 uses | **0** of 33 distinct |
| non-token dimensions | **12** → **9**, each named with a reason | — |

Read in this order:

1. **[SBR-012 §5](SBR-012-THE-RAW-COLOUR-GATE.md)** — the two populations, the second hole in the
   product's own regex, and the four AC verdicts.
2. **[TASKS.md → s35](TASKS.md)** — the session log.
3. **[D35](DEFECTS-THE-SITE-BUILDER-FOUND.md#d35)** — found and fixed in the same session.

---

## 🔴 THE BOARD — this is the agenda. Build a task.

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

**Where the ratchet stands:** s19 → s32 filed 19 rows in 14 sessions and closed one task.
**s33–s35 closed three tasks and filed one row, already fixed.** Keep that shape.
🔴 **Five tasks have still never been started**, and the phase cannot close until they are.

### 🟢 BUILD THIS: **SBR-005 — sections worth having**

It is the top of the remaining order, it is **the largest unbuilt piece**, and it **owns SBR-004's
AC3 gallery model**. Every other unbuilt task is smaller and none of them unblocks anything.

**What it is:** five section kinds that render as five visibly different things — `hero` (image with
overlaid heading), `gallery` (**>1 image in a grid**), `cta` (heading + body + a link that
navigates), `richText` (current behaviour, restyled under tokens), `contact` (labelled fields in a
card with a success state). Today `Site/SectionView` is **1 Image + 1 Text** and a script whose
outputs are `showImage` / `showBody` / `weight` / `size`.

🔴 **The data model is the hard half, and it is called out in the task file.** A section stores a
**single** image ref; a gallery needs an ordered multi-image shape, the section editor (SBR-007)
needs to author it, and **the ACL treatment must match the existing image path** — AC5 asks for it
end to end: authored in the panel → stored → rendered → anonymous reads only *published* pages'
images.

**First concrete step:** open [SBR-005 §2](SBR-005-SECTIONS-WORTH-HAVING.md), then read
`Site/SectionView` in `sb006Components.ts` **as it stands** before designing the dispatch — the four
script outputs are the current contract and AC1 is measured against five renderings, not four.

⚠️ **AC4 is a mechanism, not a preference:** conditional section UI goes through **`mounted`**, not
`visible`, and hidden kinds must be **absent from the DOM**, not stacked invisibly.

### Then, in order

| | what |
|---|---|
| 2 | **SBR-009 / 010 / 011 / 013** — never built. SBR-011 was **ruled BUILD, not strike** |
| 3 | **SBR-003** — owes the `var(--token)` dimension-port probe, and nothing else |
| last | **SBR-014** — re-verifies every person-sentence AC, so it **cannot run until the rest are built** |

### 🔴 The phase's end condition

**SBR-014 is the gate on closing phase 77**, and it re-verifies every person-sentence AC. It cannot
start while five tasks are unbuilt. 🔴 **That is the distance to done — not the length of the
register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — **D15**, no drop-target capability in the runtime for a
file arriving from outside the page (`dataTransfer`, `dragover`, `dragenter`, `DragEvent` all **0**
against a **39**-hit `onClick` control over **369** files), re-measured at HEAD with a boundary
control at s29. **Phase 77 must not close pretending AC3 is met.**

---

## 🔴 What s35 paid for, and would pay again

- 🔴 **THE TASK FILE'S CITED MECHANISM HAD MOVED, AND CARRIED A SECOND HOLE IT DID NOT NAME.**
  `RawColorLiteral` is at `parameterValues.ts:1001`, not the `:976` the task file gave. Reading it
  rather than trusting the citation turned up a hole nobody had written down: `RAW_COLOR` is
  **anchored** `^\s*`, so `'1px solid #cdc5b6'` walks straight past the product's own check. ✅
  **s34's lesson generalises past ACs — a citation is a claim about the product, and claims expire.**
- 🔴 **ZERO EVERYWHERE IS ALSO WHAT A BROKEN CHECKER READS.** All three arms read zero on HEAD. So
  the instrument's **reach** is asserted as a floor in the same run — 24 components, ≥500 parameter
  rows, ≥30 script bodies including `applyTheme` **by name**, every source shrinking under
  comment-stripping — and **every arm is paired with a planted defect that must red.** Calibration
  came before the first assertion, exactly as the task's own trap demanded.
- 🔴 **THE FIRST FINDING WAS REAL, AND THE OBVIOUS DIAGNOSIS WAS WRONG.** `/Pages/Setup`'s `Form`
  set `padding{Top,Left,Right}: 24`. The tempting reading — *a bare number on these ports renders as
  a percentage* — is `sb005Components.ts`'s own documented sentence, and it is about **`width`**.
  `node-catalog.json` says `paddingTop` is **`px`-only**, so it rendered 24px and
  `UnitlessDimension` was **right** to stay silent. ✅ **Read the port's own shape — a sibling port
  one line away had the opposite rule.**
- 🔴 **AND IT WAS A SURVIVOR.** The identical trio was fixed in `/Pages/PageEditor` during SBR-007.
  This one lived because **nothing scanned it**: SB-006's gate reads SB-006's five components, and
  Setup is SB-005's. ✅ **A gate whose population is narrower than the artefact reports a template
  clean that it never looked at.**
- 🔴 **A LABEL-ONLY EXEMPTION KEY WOULD HAVE SILENTLY WIDENED.** SB-006's four exemptions live where
  `label` is unique; the template has **several** nodes labelled `Heading` and exactly one sets a raw
  width. `TEMPLATE_DIMENSION_EXEMPTIONS` is keyed `component | label | port`, and the ambiguity is a
  **spec**, not a comment. Equality is asserted **both directions** — an exemption matching nothing
  reads exactly like a raw value that was never introduced.
- ⚠️ **A REASON NAMED IN A COMMENT AND NEVER WRITTEN IS AN UNENFORCED REASON.**
  `sb005Components.ts` pointed at **`ADMIN_RAW_DIMENSIONS`** for the admin rail's justification. That
  constant **never existed**. It now names the list SBR-012 built.
- 🔴 **AC4 NAMED A GATE THIS FILE IS NOT IN, AND ASSERTING IT WOULD HAVE PASSED.** The AC said
  `test:ci` "(registered in the spec barrel)" — the **editor's** convention. This package has no
  barrel, and **`test:ci` does not execute it at all**. AC4 is checked where it lives:
  `jest.config.js`'s glob, `test:packages` scoping `@noodl/mcp`, `pr.yml` running `test:packages` —
  all read from disk, confirmed independently with `jest --listTests`. ✅ **A spec written against
  the wrong runner is green and measures nothing.**

---

## Richard's, still small and still unanswered — carried from s26, untouched by s27–s35

**D20's fix moved the actions.** The heading grows as well as shrinks — `layout.ts` assigns
`flexGrow` and `flexShrink` in the same branch, so there is no third option — which puts
`Preview`/`Save page` at the **right** of the header rather than clustered beside the title. Nothing
is clipped at any width; the question is only whether that look is wanted. **Two parameters revert
it** (`sizeMode: 'contentSize'`, drop `width`) at the cost of putting D20 back.

---

## ✅ The instruments — NINE, and they answer different questions

🔴 **Pick by what is being asked, not by which one you used last.**

| question | tool |
|---|---|
| does it *lay out* / render correctly | `render-from-disk.js` + `withRenderedPage` (§20, §30) |
| does the thing a person **deploys** work | `deploy-from-disk` + `drive-deployed.js` (§26) |
| does a **cloud function** actually do what it claims | `sb004-publication-invariant.test.ts` (§31) |
| does a **node's port** report what it declares | `d23GeometryDrive.test.ts` (§32) |
| does a **gesture** do what it looks like it does | `ac2DragGestureDrive.test.ts` (§33) |
| does **the shipped page editor** do it, against a real backend | `ac2-page-editor-drag-drive.test.ts` (§34–§35) |
| does **a row action on the shipped admin list** do it | `sbr006-unpublish-drive.test.ts` (SBR-006 §5.14) |
| **what did the backend WRITE DOWN** about a run that went wrong | `sbr015-execution-steps-drive.test.ts` (SBR-015 §4c) |
| 🆕 **is the template still tokenised** — source AND shipped artefact | `sbr012RawColourGate.test.ts` (SBR-012 §5) |

```
# the token gate — 25 specs, ~0.7 s, no backend, no browser, no fixture
cd packages/noodl-mcp && npx jest sbr012RawColourGate

# the whole package gate CI runs — 79 suites, 1040 tests, ~90 s
cd packages/noodl-mcp && npx jest          # and reconcile the file count against --listTests

# the execution-record drive — 10 specs, ~3 s, two backends
cd packages/nodegx-backend && npx jest sbr015-execution-steps-drive --runInBand

# the row-action drive — 14 specs, ~68 s
cd packages/nodegx-backend && npx jest sbr006-unpublish-drive --runInBand

# the shipped-screen drive
cd packages/nodegx-backend && npx jest ac2-page-editor-drag-drive     # 23 specs, ~6 min

# the template gate — byte-identity with a fresh generation
npm run template:site-builder && cd packages/noodl-mcp && npx jest sb007Template
```

- 🔴 **Read the stored rows, never the answer** — *and count them.*
- 🔴 **Key any execution-record read on the PREVIOUS run id.** A call refused before the graph runs
  writes no record, and an unkeyed reader hands you the last arm's row as this one's.
- 🔴 **Seed through the product's own door, or write the ACL the product's own door writes.**
- 🔴 **A page in the middle of a write storm refuses the reader too** — read stored rows BEFORE
  opening a writing screen, not only after.
- 🔴 **`buttons: 1` on every `mouseMoved`** or `react-draggable` ignores the move.
- 🔴 **Vary something the store cannot fill back in.** `data: null` is not `undefined`.
- ⚠️ **Count every mutant edit** — `removed:1`, `matched:1`, and the precondition on the keys.
- 🆕 🔴 **A new checker that reads zero has not been calibrated.** Assert its **reach** as a floor in
  the same run, and pair every arm with a plant that must red.
- 🆕 ⚠️ **Read the port's own shape in `node-catalog.json`.** `width` is `%`-default; `paddingTop` is
  `px`-only. A rule copied from a sibling port is a confident wrong reading.
- 🔴 **A new endpoint owes a rule in `site-builder.security.json`** or SB-016's gate refuses a
  public bind.
- ✅ **`--sabotage` wires a connection to a port that does not exist.** If the census does not report
  it dropped, the health filter did not run and **every other reading in that run is void**.
- 🔴 **A headless export's health filter fails OPEN, silently** — `registerModule(project)` first.

## Gates taken at s35

- ✅ **`sbr012RawColourGate` — 25/25.**
- ✅ **The full `@noodl/mcp` suite — 79 suites, 1040 tests, exit 0.** File count reconciled against
  `jest --listTests` (**79**), so no suite silently failed to run.
- ✅ **`sb007Template` — byte-identity holds** after the template fix; regeneration diffs by exactly
  D35's three lines.
- ✅ **`sb006PublicSite` / `sb005AdminPanel` / `sb004Authoring` — 106/106** after the two regexes
  moved into the shared module.
- ✅ **`tsc --noEmit` on `@noodl/mcp` — exit 0, zero output.** (jest runs with `diagnostics: false`,
  so a type error here would otherwise never surface.)
- ⬜ **Not run, deliberately:** `test:ci` (the editor runner — this session changed nothing it
  executes) and the backend drives (no backend or runtime source changed).

⚠️ **s35 is UNCOMMITTED at handoff.** Six files: two new
(`packages/noodl-mcp/tests/sbr012RawColourGate.test.ts`, `siteBuilderStyleScan.ts` — **untracked, so
`git add` them first or a pathspec commit skips them silently**), three modified
(`sb005Components.ts`, `sb006Components.ts`, `sb006PublicSite.test.ts`), plus the regenerated
`packages/noodl-editor/src/editor/src/models/template/templates/site-builder.content.json` and the
three phase-77 docs.

## The register — an APPENDIX, not the agenda

🔴 **Every row below is `BACKLOG` unless it says `BLOCKS <AC>`.** Do not open a session on one of
these while a task is unbuilt. **No open row `BLOCKS` an AC except D15.**

## Where the phase now stands

🔴 **Re-derived from the task FILES at s35.**

| | verdict |
|---|---|
| **SBR-001 / SBR-002** | ✅ closed s2 / s4 |
| **SBR-003** | 🟡 built, swept, driven — **owed: the `var(--token)` dimension-port probe** |
| **SBR-004** | 🟢 **CLOSED s35** — AC1/2/4 driven; **AC3 met by SBR-012** |
| **SBR-005** | ⬜ **OPEN, never built** — 47 lines — **the next build**; owns the gallery data model |
| **SBR-006** | 🟢 CLOSED s33 — all five ACs |
| **SBR-007** | 🟢 AC1 ✅, AC4 ✅, AC5 ✅ · **AC2 ✅ all three halves** · AC3 blocked by D15 alone |
| **SBR-008** | ✅ all five, s18 |
| **SBR-009** | ⬜ **OPEN, never built** — 40 lines — the theme editor demos itself |
| **SBR-010** | ⬜ **OPEN, never built** — 35 lines — messages |
| **SBR-011** | ⬜ **OPEN, never built** — 42 lines — live preview; **ruled BUILD, not strike** |
| **SBR-012** | 🟢 **CLOSED s35 — ALL FOUR ACs**, two populations, six plants |
| **SBR-013** | ⬜ **OPEN, never built** — 46 lines — the doctrine rule |
| **SBR-014** | ⬜ **OPEN, and LAST** — re-verifies every person-sentence AC |
| **SBR-015** | 🟢 CLOSED s34 — all four ACs |
| **SBR-016** | ✅ s15, all four ACs |
| **SBR-017** | ✅ s14 · AC1 🟡 half (SBR-016 owned the other half) |
| **D13 / D16** | 🔴 open, `NONE` |
| **D14** | 🟢 fixed s20, DRIVEN s22 — the **browser** deploy path is still exposed and `NONE` |
| **D15** | 🔴 **`BLOCKS` SBR-007 AC3** · `NONE` — no drop target for a FILE. Stands at HEAD |
| **D17 / D18 / D21** | 🟢 fixed and driven (s21/s24/s25) |
| **D19** | 🟢 reds fixed s23 — 🔴 **`test:main` watched is still `NONE`** |
| **D20** | 🟢 FIXED + DRIVEN s26; **the appearance half is Richard's** |
| **D22** | 🔴 `NONE` — no `textOverflow` port on `Text` |
| **D23** | 🟢 DISPROVED s29, kept |
| **D24** | 🟢 FIXED + GATED s28 |
| **D25 / D26 / D27** | 🔴 `NONE` — all three registered in phase 80 |
| **D28** | 🟢 FIXED by a peer as phase 80 `DEF-027` during s32 |
| **D29** | 🔴 `NONE` — one-way gate latches; a peer's row, from phase 80 s21 |
| **D30 / D31** | 🟢 FIXED + DRIVEN s32 |
| **D32** | 🟢 FIXED by a peer during s33 as phase 80 `DEF-032` (`ff6183cd`) |
| **D33** | 🔴 `NONE` — six same-collection writes on the theme editor, **a candidate list, not a confirmed defect** |
| **D34** | 🔴 `NONE` — publish of a missing page answers 200; **runtime, belongs in phase 80** |
| **D35** | 🆕 🟢 **FIXED s35** — the setup page's bare `24` where `--space-6` is `24px` |

## Standing context

- ✅ **The template is generated, not authored.** Edit
  `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts` (and `sb007Template.ts` for the `App` shell),
  then `npm run template:site-builder`. `sb007Template.test.ts` asserts the committed artefact is
  byte-identical to a fresh generation.
- 🆕 ✅ **The raw-colour / token rule is now enforced on BOTH populations.** A new component that
  names a colour, a mis-spelled token, or an unexplained dimension reds `sbr012RawColourGate` —
  which matters immediately for **SBR-005**, since five new section renderings is the largest batch
  of new style parameters this template will ever take. 🔴 **A new raw dimension takes a reason in
  `TEMPLATE_DIMENSION_EXEMPTIONS` (`siteBuilderStyleScan.ts`) or a token — and spacing, colour,
  radius, face and font size may take NO exemption at all.**
- 🔴 **`SECTION_SORT` lives in `sb005Components.ts`** and `sb006Components.ts` re-exports it. Do not
  reintroduce a second copy. The same applies now to `RAW_COLOR_LITERAL` / `STYLE_VALUE_PORT`, which
  live in `siteBuilderStyleScan.ts` and are imported by `sb006PublicSite.test.ts`.
- ✅ **Older fixture, still on disk if wanted: `SBR-007 Page Editor Drive`**, backend
  `backend_mterfnli74qwv`, port **8601**, `SITE_SETUP_TOKEN=drive-token-007`,
  `owner@sbr007.test` / `drive-pass-007`. 🔴 **Drive a COPY.** ⚠️ Its `Section` table is EMPTY.
- ✅ **The setup token is a file, not a UI step**: `~/.noodl/backends/<id>/secrets.json`, `functions`
  namespace. `SecretsStore` re-reads on every call, so no restart.
- 🔴 **A node's port description lives in FOUR generated copies.** Changing one owes
  `catalog:generate` → `catalog:merge` → `docs:nodes` **and** `cloud-library:generate`.
- 🔴 **A source change is not a drive until the bundle carries it** — the viewer
  (`external/viewer/noodl.viewer.js`), the deploy runtime (`external/deploy/noodl.deploy.js`, a
  *different file*), and `nodegx-backend/dist`. **A template change is different** — project data,
  read from disk every boot, so no rebuild. **s35 changed no product source**, so no bundle is stale.
- ⚠️ 🔴 **Peers were active in the shared checkout throughout s35, and one arrived LATE.** At the
  final `git status` the tree also carried **six modified files under `packages/nodegx-backend/src/`**
  (`security/model.ts`, `server/HttpServer.ts`, `server/admin-security.ts`, `service.ts`,
  `workflow/WorkflowRunner.ts`, `workflow/functionDeclarations.ts`) plus
  `tests/def009-public-write-default.test.ts`, and a border sweep in
  `noodl-core-ui`/`noodl-editor` — **none of them s35's**. s35 touched only its own files and
  checked `git status` per directory before each write. **Whoever commits must use pathspecs naming
  s35's ten files and nothing else.**
- Shared checkout: **pathspec commits only, never `git add` to stage** (except to make an untracked
  file committable); `git status --porcelain | grep '^??'` before committing. Announce editor
  launches **and** teardowns. `test:ci` alone.
- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
