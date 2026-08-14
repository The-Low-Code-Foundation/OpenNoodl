# FIX-017 — The editor shows what you can type

**Report 12** · Tier 3 · Effort **S + M + S**

> *"There needs to be an autocomplete system that can actually show the root values you can
> select … at least all the Noodl stuff like Noodl.Arrays, without having to type Noodl. to get
> one part of the library to appear."*

## Mechanism — substantially more exists than the report assumes

🔴 **First: reconcile `phase-61-the-editor-teaches/TASKS.md` — it is four tasks stale.**
FUN-004 (`6dc6c019`), FUN-006 (`5f96f1f2`), FUN-007 §2 (`97e465a2`), FUN-008 (`ad47b239`) are all
built and wired on `cline-dev`; only **FUN-005 (the ports rail)** is unbuilt. Anyone planning from
that file will rebuild three finished tasks.

One editor component (CodeMirror 6, `JavaScriptEditor.tsx`), four call sites; the Expression node
uses the same popout. Completion already does: `Noodl.` → API list; `Noodl.Variables/Objects/
Arrays.` → **real project names**; `Inputs./Outputs.` → declared ∪ mined ports with
signal-vs-value; bare `Inp` → boosted port completions (FUN-008).

**The three real gaps** (all `noodl-completions.ts`):
1. **Nothing fires at an empty position** (`completesTopLevel`, `completionPosition.ts:38-41`
   requires a word or explicit Ctrl-Space — which works but nothing says so). This is the literal
   complaint.
2. **The API is one level deep** — `memberCompletions` answers only for
   `Noodl`/`Variables`/`Objects`/`Arrays`/`Inputs`/`Outputs`. `Noodl.Records.`,
   `Users.`, `CloudFunctions.`, `Navigation.`, `Files.`, `Config.` etc. return `null` — a beginner
   who *does* discover `Noodl.Records` is then handed nothing.
3. **No browse affordance** (Blockly's categories have no analogue here).

## Fix direction

- **§A (S) — answer at an empty position:** in `createNoodlCompletionSource` (`:191`), let the
  **globals** branch through at an empty position while keeping `barePortCompletions` gated (the
  module note at `:228-239` warns `word.from === word.to` means opposite things in the two
  branches — do not touch the shared predicate). A fresh editor then offers
  `Inputs / Outputs / Noodl / Component / Script` the moment the cursor lands.
  🔴 **Must be driven, both ways** — "a completion source that never fires is indistinguishable
  from one that is not installed", and the FH-017 guard exists precisely because menu-on-every-
  line was once the noise.
- **§B (M) — a second level on the static schema:** `ApiMember` gains
  `members?: readonly ApiMember[]`; `memberCompletions` walks a dotted path. Fill level 2 from
  the sources already in-tree: `noodl-runtime/dist-types/src/api/records.d.ts` (12 methods,
  generated — best), `viewer-react/src/api/*.ts` interfaces (Users, CloudFunctions, Navigation,
  Files, SEO, Config), `model.js`/`collection.js`. Hand-written-but-cited, exactly as
  `noodl-api-surface.ts:1-23` argues. (~150 lines of data + a path walk.)
- **§D (S) — the browse affordance:** a toolbar button in the FUN-006 bar that calls
  `startCompletion` explicitly, plus one line of `NOTATION_RULES` copy. The full FUN-005 rail
  stays a phase-61 task — do not absorb it here.

## Open questions

- Ranking: port completions carry `boost: 99` — verify API names never outrank ports once
  anything is typed.
- `noodl-api-surface.ts` vs `typings/global.d.ts` are two unlinked lists of the same 19 members —
  pick the source of truth and make the other import it.
- `ExpressionEditorModal` / `AiChat` / `GeneratedCodeModal` never call `setOpenNodeContext`
  though the contract says clearing is mandatory — sweep or document while in here.

## Acceptance criteria

1. Open a fresh Function popout, cursor on the empty seed body: a completion listing
   `Inputs`, `Outputs`, `Noodl` (and mode globals) appears without typing. Driven in Function
   **and** Expression modes; and driven the other way — typing ordinary code is not smothered.
2. `Noodl.Records.` offers `query`, `create`, `save`, `delete`… with signatures in `info`.
3. Typed `Inp` still ranks `Inputs.<port>` first (control for the boost).
4. Phase-61 `TASKS.md` reconciled to the tree in the same PR.
