# NOTES — LEG-003, the reduced-scope run

**Branch:** `leg-003`, off `80868946`. **Date:** 2026-08-11.
**Scope as briefed:** build §2 (the Explain half); replace §1's live drive with headless coverage;
write the drive for someone else to run. ~~**§1's acceptance is NOT met**~~ — ✅ **§1's acceptance was
met on 2026-08-12**, when the drive was executed end to end (including the packaged-build half of L29
and the paid B.6 step). See §6 and [`leg-003-drive-results.md`](leg-003-drive-results.md).

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

## 6. Could not verify — ✅ **both cleared 2026-08-12**

Full write-up: [`leg-003-drive-results.md`](leg-003-drive-results.md).

- ✅ ~~🔴 **§1's acceptance — the four change kinds driven in the running editor.**~~ **Driven, and it
  passes.** All four sentences render through the real panel path (`DiffList` → `ComponentDiffView`)
  against a git-backed copy of `phase55-s8-kimi-k3-rerun`, and all four of A.6's pass conditions hold.
  The sentences are pasted verbatim into the results file and into **L32** below.
- ✅ ~~🔴 **The catalog name provider in a packaged build (register L29).**~~ **Checked, in a package,
  and it passes.** A signed `NodeGX.app` was built and launched from `app.asar`; its four sentences are
  **byte-identical** to the dev run's, with no raw type name anywhere. The `try/catch` was also proved
  to discriminate — `nodeName` with the healthy provider gives `Button 'Ceramics link'`, with the
  `catch` branch's `() => undefined` it gives `net.noodl.controls.button 'Ceramics link'`.

⚠️ Deviation 6 above turns out to matter more than it looked: it describes the pre-session subject
rendering, and **`NOTES-LEG-003-DRIVE.md`'s B.2 pass condition contradicts it** — B.2 forbids creating
a session, then demands the string only a session produces. See **L35**.
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
| L29 | `catalogDisplayNames()` swallows a failed `require` and degrades to raw type names silently. **Confirmed resolving under ts-jest** (`net.noodl.controls.button → Button`) and the degraded rendering is now pinned as its own case — **still unverified in a packaged build** | ✅ **CLOSED 2026-08-12 — both halves.** Dev passes; a signed `NodeGX.app` running from `app.asar` produced **byte-identical** sentences with no dotted type name. The `catch` branch was also proved to discriminate live |
| L30 | A node labelled exactly its type name renders as if unlabelled. Pinned by a test rather than left to be discovered mid-review | ✅ noted, covered |
| L31 | The Explain panel must quote a comment, never paraphrase it | ✅ built: the panel renders both authored fields itself, verbatim, and the system prompt forbids restating them |
| L32 | The four change kinds, **driven in the running editor 2026-08-12** and pasted verbatim: `Renamed Button 'Ceramics link' to 'Ceramics'` · `Rewired Component Outputs 'Footer signals out'.returnsClicked to come from Button 'FAQ link'.onClick (was Button 'Returns link'.onClick)` · `Moved Text 'Blurb' from Group 'Brand column' into Columns 'Footer columns'` · `Changed Columns 'Footer columns' (alignX: (unset) → 'center', marginX: {"unit":"px","value":48} → {"unit":"px","value":64}, mediumLayout: '1 1' → '1 1 1', +1 more)`. All four of A.6's pass conditions hold | ✅ **§1's acceptance MET** |
| L33 | The three parameters a multi-parameter sentence spells out are the first three **alphabetically**, not the first three changed. ✅ **Confirmed by drive**: changed in the order `marginX, mediumLayout, smallLayout, alignX`, rendered `alignX, marginX, mediumLayout, +1 more` — `alignX` was changed **last** and printed **first**, and **`smallLayout` is the one hidden**. A reviewer cannot assume `+N more` conceals the least recent change | ✅ confirmed live |
| L34 | A component `description` reaches Explain **today** if it is written to `metadata.description`: component `metadata` already round-trips (`ProjectExporter.ts:310` / `ProjectImporter.ts:229`). The adapter reads both shapes, so LEG-006 can restore the top-level key either way without touching Explain | ✅ resolved |
| L35 | ⚠️ The authored card's fill vs the panel behind it. Computed as 1.07:1 dark / 1.06:1 light; **measured on the live elements it is 1.00:1 in BOTH themes** — the card's backdrop is `BasePanel-module__Root`, which is the card's own colour (`#181d24` / `#f7f9fb`), not the `#12161b` / `#ffffff` the table assumed. The fill is not nearly invisible, it is **exactly** invisible, so the **2px left rule is load-bearing** and must not be softened. The rule's own ratio is correspondingly **5.57 dark / 5.06 light**, not 5.98/5.34 — both still clear AA | 🔴 **corrected by measurement** |
| L36 | `--theme-color-primary` measures **4.33:1** on `bg-2` in the light theme — under AA for 12px text. The node link in the authored card is `fg-default-contrast` with a dashed underline instead | ⚠️ standing |
| **L37** | 🔴 **A unit-value parameter delta prints as raw JSON.** `marginX: {"unit":"px","value":48} → {"unit":"px","value":64}`, while every other delta on the same line is human-readable (`'1 1' → '1 1 1'`, `(unset) → 'center'`). So the change a designer is most likely to make — a spacing tweak — is the one that reads like a machine. A formatter fix, not a model one. Found by the drive; not predicted | 📋 open |
| **L38** | 🔴 **`NOTES-LEG-003-DRIVE.md` B.2 contradicts itself**, and the panel is right. B.2 says *"Do not press Explain this node"* then requires `attribution[0]` to read `Note on Button '<label>'` — but `ExplainPanel.tsx:165-185` has **two sources**, and the pre-session one (`fromComponentModel`) carries no catalog `displayName`, so `subjectForNode` correctly renders the label alone: **`Note on FAQ link`**. This is deviation 6 of §5, which the lane documented on purpose. Confirmed both ways: calling `collectAuthoredNotes` with a `displayName` gives `Button 'FAQ link'`, and **B.6's paid run flipped the live card to exactly that** once a session existed. **Fix the drive, not the panel** | 📋 open |
| **L39** | ✅ **B.6 passed on a deliberately mismatched note.** The model **quoted the comment exactly and attributed it** — *"The author's note on this node — 'Retry twice, not three times. PSP-4412…' — describes a payment-retry policy that has nothing to do with an FAQ link's click signal… I won't try to reconcile it"* — rather than paraphrasing or silently contradicting it. It also caught the A.2 rewire unprompted. The §2 rule holds under the hardest case for it | ✅ verified, paid |
