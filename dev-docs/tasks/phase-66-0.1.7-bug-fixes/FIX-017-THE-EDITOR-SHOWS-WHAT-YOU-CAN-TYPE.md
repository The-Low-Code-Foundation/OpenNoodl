# FIX-017 — The editor shows what you can type

**Report 12** · Tier 3 · Effort **S + M + S**

> *"There needs to be an autocomplete system that can actually show the root values you can
> select … at least all the Noodl stuff like Noodl.Arrays, without having to type Noodl. to get
> one part of the library to appear."*

## Mechanism — substantially more exists than the report assumes

✅ **AC4 discharged 2026-08-15 — and this paragraph was itself stale by then.** It said phase-61's
`TASKS.md` was "four tasks stale"; that file had already been corrected on **2026-08-14**, before
this session started. What was left was smaller and less obvious: the 08-14 sweep fixed the **status
column** and left the **prose inside FUN-007's row**, which went on saying its §2 was "not done"
while `97e465a2` had built it on 08-12 (`utils/runtimeDiagnostic.ts` + 176 lines of spec, both in
the tree, specs passing). Corrected, with the two-pass lesson recorded in that file's header.

🔴 **The reusable bit: a stale warning about staleness is worse than none.** Read the register
before repeating what a task doc says about it — this one would have sent its reader to fix
something already fixed, and past the one thing that was not.

⚠️ Three of §B's citations below were also wrong, all found by opening them; see §B.

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
- ✅ **§B (M) — BUILT 2026-08-15.** `ApiMember` gained `members?: readonly ApiMember[]`, and
  `apiMembersAtPath` walks a dotted path anchored at `Noodl`. Ten namespaces answer at their own
  dot: Records, Users, CloudFunctions, Navigation, Files, SEO, Config, Object/Model,
  Array/Collection, Events/eventEmitter. **11 new specs, 51/51 in the file, 395/395 in the
  package**, and the walk was run against a **known-broken control** (one-level behaviour restored)
  where 5 of them go red — so the gate discriminates rather than merely passing.
  ✅ **DRIVEN 2026-08-15** (session 20) — criterion 2, with a negative control. See the criteria.

  ⚠️ **One namespace answered empty and it is not a defect:** `Noodl.Variables.` returned **0** on
  the fixture, which has no variables defined. That is the documented shape where an empty list
  cannot distinguish a firing branch from a dead one — it is **indeterminate**, not a failure, and
  it is the one prefix where the project surface and the static list genuinely compete. Re-probe it
  on a project that *has* variables before drawing any conclusion about the ordering fix.

  **Three of the citations above were wrong, and each was found by opening the file:**
  1. `dist-types/…/records.d.ts` is real and accurate but **gitignored** (`.gitignore:225`) — a
     citation no reader can check on a fresh clone. Used `noodl-runtime/src/api/records.js`, which
     ships. **11 methods, not the 12 claimed.**
  2. `model.js` / `collection.js` are **`model.ts` / `collection.ts`** — the citation does not
     resolve.
  3. **`Config` cannot be a static list.** It is a Proxy over App Setup *plus the project's own
     config variables* (`api/config.ts:73-90`), so its members are partly unknowable here. Shipped
     as an explicitly-partial floor with that stated in the module, rather than as a contents page
     that would tell a user their own variable does not exist.

  Also corrected while in there: the `MEMBER_PATH_LOOKBEHIND` note said `Noodl.Variables.` was the
  longest path answered for, which §B made false.
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
2. ✅ **MET AND DRIVEN 2026-08-15** (session 20), in a real Function popout on a copy of
   `fix012-drive`, `/Probe`'s `JavaScriptFunction` node. Three readings, positive and negative:

   | probe | completions | tooltip |
   |---|---|---|
   | `Noodl.` | **19** namespaces incl. `Records` | rendered |
   | **`Noodl.Records.`** | **11** — `addRelation`, `aggregate`, `count`, `create`, `delete`, `distinct`, `fetch`, `increment`, `query`, `removeRelation`, `save`, each with its signature in `info` | rendered |
   | `Noodl.Nonsense.` | **0** | **none** |

   The negative control is what makes it a drive: an 11-item list alone is equally consistent with
   a resolver that says yes to anything. `.cm-tooltip-autocomplete` was read from the DOM, so the
   menu **rendered** rather than merely resolving. Criterion 2 is closed.

   ⚠️ **The completion menu cannot be opened by typing over CDP** — `cdp type` uses
   `Input.insertText`, which does not trigger CodeMirror's autocomplete. Driven by dispatching the
   document into the live `EditorView` (`.cm-content` → `cmTile.view`) and calling
   `startCompletion(view)`, then reading both `currentCompletions(view.state)` and the tooltip DOM.
   Everything below that call was the real registered source.
3. 🔴 **The premise does not hold — this criterion is not falsifiable as written.** Typed `Inp`
   returns **exactly one** option (`Inputs`, the global); `Inputs.` returns **exactly one** (`qty`,
   the node's real declared port). Ports and API members **never appear in the same list** at these
   prefixes, because bare port completions are gated and member completions are anchored at a dot.
   So there is no ranking to control for, and `boost: 99` is not observable here. Either restate it
   against a prefix where both surfaces genuinely compete (`Noodl.Variables.` is the only known
   candidate — a name in both the static list and the project's), or strike it. **Needs a ruling.**
4. ✅ **Done 2026-08-15** — phase-61 `TASKS.md` reconciled to the tree; the residue was prose, not
   status. See §1.
