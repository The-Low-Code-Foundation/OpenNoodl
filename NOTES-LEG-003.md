# NOTES — LEG-003, the reduced-scope run

**Branch:** `leg-003`, off `80868946`. **Date:** 2026-08-11.
**Scope as briefed:** build §2 (the Explain half); replace §1's live drive with headless coverage;
write the drive for someone else to run. **§1's acceptance is NOT met** — see "Could not verify".

---

## 1. What was already built, checked before writing anything

`adopt > build` paid out again. Three of the five things §2 asks for already existed:

| Piece | Where | State found |
|---|---|---|
| `DiffFormatter.formatChange`, ~20 change kinds, catalog naming | `versioning/DiffFormatter.ts` | built, correct, wired |
| Wiring into the review UI | `GraphDiffPanel/graphChangePresentation.ts:131` → `ComponentDiffView` → `VersionControlPanel/components/DiffList.tsx:184` | built. The panel calls it under a **"What changed in \<component\>"** section after you click a changed component |
| A node comment in the model's context | `explain/graph.ts` reads `getComment()` and `metadata.comment`; `assemble.ts` puts it on `ContextNode.comment`; `render.ts:29` prints `note from the author:` | **already built** — the model has been seeing comments since AIX-004 |
| A component description anywhere in Explain | — | **missing.** Not in `GraphComponent`, not in `ContextComponentShape`, not rendered |
| Anything on **screen** distinguishing authored text from generated text | — | **missing.** The panel rendered only model output |

So §2 reduced to: carry the description through the four layers, add the panel surface that shows
both fields verbatim, and tell the model not to speak over them.

⚠️ One thing that reads as missing and is not: `ComponentModel` has no `description` field, and
`fromJSON` drops the key. That is **LEG-006's subject, not a bug I should fix here**, and two sibling
sessions are live in the primary checkout, so absence of a field is not evidence it was never
written. Nothing was deleted on that inference.

---

## 2. What I changed

### The model layer (`src/editor/src/models/AiAssistant/explain/`)

- **`types.ts`** — `GraphComponent.description` and `ContextComponentShape.description`, both optional.
- **`graph.ts`** — both adapters now read a description. `authoredDescription()` takes the first
  non-blank of `component.description` and `component.metadata.description`, so the panel is correct
  **whichever shape LEG-006 restores**, and correct today for the `metadata` shape (which already
  round-trips: `ProjectExporter.ts:310` writes component `metadata`, `ProjectImporter.ts:229` reads
  it back). Blank and whitespace-only are treated as absent — an empty quotation card is worse than
  no card.
- **`assemble.ts`** — `componentShape()` carries it through, unabridged. Assembly truncates parameter
  values because they can be a script body; two sentences by the author are the last thing worth
  cutting.
- **`render.ts`** — one line in the `## Component` block: `description, written by the author: …`.
- **`prompts.ts`** — a new **THE AUTHOR'S OWN WORDS** section in the system prompt: treat both fields
  as evidence, never contradict silently, **never paraphrase or restate**, quote and attribute if you
  must refer to one. This is the spec's ⚠️ turned into an instruction the provider actually receives.
- **`authoredNotes.ts`** (new) — `collectAuthoredNotes()`, pure. Decides *which* notes lead *which*
  scope and *what each is attached to*; it never touches the words. Component scope leads with the
  description then the notes inside it, capped at `MAX_COMPONENT_SCOPE_NOTES = 8` with the remainder
  **counted, not dropped**; node/subgraph scope shows the selected nodes' comments and no others, and
  is never capped, because the selection is the question.
- **`index.ts`** — exports the new module.

### The panel (`views/panels/ExplainPanel/`)

- **`components/AuthoredNotes.tsx` + `.module.scss`** (new) — the card. Renders every note verbatim in
  a `white-space: pre-wrap` block (an author's line breaks are part of what they wrote), each with an
  attribution line — *"What this component is for — /Pages/Checkout"*, *"Note on Button 'Submit
  Order'"* — and the node name is a button that reveals the node on canvas, reusing `canvasLink`.
- **`ExplainPanel.tsx`** — renders the card at the top of the scroll area, **above the answer and
  above the empty state**. Notes come from `state.context` once a session exists and from a direct
  read of the live component before one does, so an author's comment reaches a reader **with no
  provider, no token and no click**. The memo keys on `state.context` (stable per session) rather
  than `state` (changes on every streamed delta).

### Tests (`packages/noodl-editor/tests-unit/leg-003/`, jest, plain Node)

- **`diffSentences.test.ts`** — 10 cases. The four change kinds through the real `diffGraphs` +
  `formatChange` + `catalogDisplayNames()` over a checkout-page fixture with real catalog type names,
  plus the three failures §1 called out as reading like successes.
- **`authoredNotes.test.ts`** — 16 cases across adapter → assembly → rendered context → collected
  notes, including the verbatim rule as an assertion (`text.length === COMMENT.length`, newline
  preserved) and the do-not-paraphrase rule being present in the system prompt.

---

## 3. The four sentences, recorded verbatim

Not from the running editor — from `diffGraphs` + `formatChange` with the panel's own catalog
provider, over a fixture shaped like a real page. These are pinned by `diffSentences.test.ts`, so a
reword is now a deliberate act:

| Change kind | Rendered sentence |
|---|---|
| rename | `Renamed Button 'Submit Order' to 'Place order'` |
| rewire | `Rewired Navigate 'Checkout'.navigate to come from Text Input 'Coupon code'.onEnter (was Button 'Submit Order'.onClick)` |
| reparent | `Moved Text 'Order total' from Group 'Checkout page' into Columns 'Order summary'` |
| multi-parameter | `Changed Columns 'Order summary' (alignY: (unset) → 'center', gutter: 12 → 24, layoutString: '1,1' → '1,2', +1 more)` |

Three findings from writing them down:

1. **The rename names the old label**, as the spec predicted — `Renamed Button 'Submit Order' to
   'Place order'`. A reviewer scanning for the node they are looking at finds it under the name it
   had in the base, which is the right choice for a diff and worth stating rather than discovering.
2. **The three parameters shown are the first three *alphabetically*, not the first three changed.**
   `alignY` leads and `paddingLeft` is the one behind `+1 more`, regardless of edit order. Stable
   ordering is deliberate (`assemble`/diff sort keys), but "+1 more" therefore hides an
   *alphabetically last* change, not a *least important* one. Not a defect; a thing a reviewer should
   know before trusting the visible three.
3. **A degraded catalog is loud in the fixture and silent in the app.** With no provider the same
   rename renders `Renamed net.noodl.controls.button 'Submit Order' to 'Place order'` — covered as its
   own case, so the difference between "resolved" and "degraded" is now an assertion rather than a
   thing you notice if you happen to look.

---

## 4. Contrast, measured (register requirement)

Computed from `noodl-core-ui/src/styles/custom-properties/colors.css` — dark `:root`, light
`:root[data-theme='light']` — resolved through the base ramp. Every pair, both themes, hex printed.

| What | Dark | Light |
|---|---|---|
| Authored text — `fg-default-contrast` **#cbd3dc** / **#2e3945** on card `bg-2` **#181d24** / **#f7f9fb** | **11.20:1** | **11.13:1** |
| Attribution line — `fg-default-shy` **#8b95a1** / **#616c79** on card `bg-2` | **5.57:1** | **5.06:1** |
| *Reference:* generated prose — `fg-default` **#a6b0bb** / **#4a5663** on card `bg-2` | 7.70:1 | 7.10:1 |
| The 2px left rule — `fg-default-shy` on panel `bg-1` **#12161b** / **#ffffff** | **5.98:1** | **5.34:1** |
| The 2px left rule against the card it borders (`bg-2`) | 5.57:1 | 5.06:1 |
| ⚠️ The card fill alone — `bg-2` on `bg-1` | **1.07:1** | **1.06:1** |

The last row is the finding. **The wash cannot carry the distinction** — 1.07:1 is not a boundary,
it is a suggestion. So the distinction is carried by three cues and only one of them is colour:

1. the 2px left rule (shape, ≥5.34:1 against what it sits on in both themes);
2. a `NotePencil` icon plus the sentence *"Written by the author — shown exactly as typed, not
   generated"*, which a screen reader also gets via `aria-label="Written by the author"`;
3. authored text one step brighter than the model's prose beside it (11.2 vs 7.7 dark, 11.1 vs 7.1
   light).

One decision came out of measuring rather than out of taste: the clickable node name is **not**
tinted with the accent. `--theme-color-primary` **#1570ef** on the light card measures **4.33:1**,
under the 4.5:1 that 12px text needs. It is `fg-default-contrast` with a dashed underline instead —
an affordance that is legible in both themes and is not colour-only either.

---

## 5. Deviations from the spec, with reasons

1. **§1 was not driven.** Replaced with unit coverage per the brief. The editor cannot be launched
   from this worktree (`lerna exec` resolves to the primary checkout's source, and `start.ts` reaps
   sibling sessions by checkout). The drive is written out in `NOTES-LEG-003-DRIVE.md`.
2. **The Explain panel shows authored text itself rather than asking the model to relay it.** The
   spec says "shows the node's comment verbatim". A model instructed to quote is a model that can
   fail to, and silently. The panel renders the words deterministically; the prompt change is a
   second belt, not the mechanism.
3. **The description is read from `metadata.description` as well as `description`.** LEG-006 has not
   landed and may restore either shape. Reading both makes this correct either way — and makes the
   feature *drivable today*, because component `metadata` already round-trips through the v2
   exporter and importer.
4. **A cap on component-scope notes (8) that the spec did not ask for.** A 262-node component with
   forty comments is the grey wall coming back as a card. The remainder is counted on screen, not
   dropped.
5. **Node-scope notes are the selection's only.** A neighbour's comment is in the model's context but
   not on the card: it is not an answer about what was asked.
6. **`subjectForNode` deviates from `DiffFormatter.nodeName` in one case.** With no catalog in hand
   (the panel's pre-session read) the label alone is used, because `NodeGraphNode.label` never returns
   empty — it falls back to `type.labelForNode(node)` — so the naive pairing renders
   `net.noodl.controls.button 'Button'`. Documented in the function.
7. **No editor spec (`tests/`) was added**, only jest (`tests-unit/`). The jasmine suite only runs
   under Electron via `test:ci`, which this session may not run; a spec I cannot execute is a claim.
   `tests-unit/` is the runner that actually gates here, and it is green.

---

## 6. Could not verify

- 🔴 **§1's acceptance — the four change kinds driven in the running editor.** Outstanding by
  construction. The sentences above are unit-level; the panel path (`DiffList` → `ComponentDiffView`)
  is unexercised in this run. `NOTES-LEG-003-DRIVE.md` is the script for it.
- 🔴 **The catalog name provider in a packaged build (register L29).** Only checked under ts-jest,
  where `require('../validation/catalog')` resolves and `net.noodl.controls.button → Button`. The
  packaged app bundles differently and the `try/catch` in `catalogDisplayNames()` still swallows a
  failure into a panel full of raw type names. **Unchanged: check first, in a package.**
- 🔴 **The Explain panel rendered.** No React test runner reaches these panels in `tests-unit`, and I
  did not launch the editor. `collectAuthoredNotes` is covered; `AuthoredNotes.tsx` is typechecked and
  linted only. Contrast is computed from the token files, not sampled from pixels.
- ⚠️ **Component-scope description end to end.** Covered from a serialised project through to the
  rendered context, and `metadata.description` should reach `ComponentModel.metadata` on load — but
  that last hop was not observed in a running editor. The top-level `description` key still does not
  reach `ComponentModel` at all; that is LEG-006.
- ⚠️ **Interaction with LEG-001/LEG-005/LEG-006.** All three are open and may be in flight in the
  primary checkout. Nothing here depends on their code, but LEG-001 is what will make node comments
  common, and until it lands this card will be empty on almost every project (1 comment in 2,045
  nodes).

**Gates run in this worktree:** `npx tsc -p packages/noodl-editor --noEmit` clean · `npx eslint` on
the changed files clean · `node scripts/css-token-check.js` clean · `node scripts/hex-color-ratchet.js`
holding (16/16) · **`npx jest` from `packages/noodl-editor`: 116 suites, 1626 tests, all passing**
(measured on this branch, not inherited). Not run, deliberately: `npm run test:ci`, any `dev:*`, any
install.

---

## 7. Register entry text for the spec file

The orchestrator folds this into `LEG-003-THE-DIFF-ALREADY-SPEAKS-ENGLISH.md`; I did not edit the spec.

| # | Finding | State |
|---|---|---|
| L28 | `DiffFormatter` renders named nodes and ports for ~20 change kinds and **is already wired** into GraphDiffPanel. The README's "renders ids" is wrong and the week is not needed | ⚠️ corrected |
| L29 | `catalogDisplayNames()` swallows a failed `require` and degrades to raw type names silently. **Confirmed resolving under ts-jest** (`net.noodl.controls.button → Button`) and the degraded rendering is now pinned as its own case — **still unverified in a packaged build** | ⚠️ check first |
| L30 | A node labelled exactly its type name renders as if unlabelled. Pinned by a test rather than left to be discovered mid-review | ✅ noted, covered |
| L31 | The Explain panel must quote a comment, never paraphrase it | ✅ built: the panel renders both authored fields itself, verbatim, and the system prompt forbids restating them |
| L32 | The four change kinds render as: `Renamed Button 'Submit Order' to 'Place order'` · `Rewired Navigate 'Checkout'.navigate to come from Text Input 'Coupon code'.onEnter (was Button 'Submit Order'.onClick)` · `Moved Text 'Order total' from Group 'Checkout page' into Columns 'Order summary'` · `Changed Columns 'Order summary' (alignY: (unset) → 'center', gutter: 12 → 24, layoutString: '1,1' → '1,2', +1 more)`. **Recorded at unit level, not driven** | ⚠️ §1 still open |
| L33 | The three parameters a multi-parameter sentence spells out are the first three **alphabetically**, not the first three changed — so `+N more` hides an alphabetically-last change, not a least-important one | 📋 noted |
| L34 | A component `description` reaches Explain **today** if it is written to `metadata.description`: component `metadata` already round-trips (`ProjectExporter.ts:310` / `ProjectImporter.ts:229`). The adapter reads both shapes, so LEG-006 can restore the top-level key either way without touching Explain | ✅ resolved |
| L35 | ⚠️ The authored card's fill measures **1.07:1 dark / 1.06:1 light** against the panel behind it. A background wash cannot distinguish authored text from generated text; the left rule (5.98/5.34), the icon and the header sentence do | ⚠️ standing |
| L36 | `--theme-color-primary` measures **4.33:1** on `bg-2` in the light theme — under AA for 12px text. The node link in the authored card is `fg-default-contrast` with a dashed underline instead | ⚠️ standing |
