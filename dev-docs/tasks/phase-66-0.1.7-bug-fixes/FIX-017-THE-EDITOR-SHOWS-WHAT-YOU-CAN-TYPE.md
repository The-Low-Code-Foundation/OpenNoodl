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
  ◐ **BUILT `9e8b3198`, DRIVEN session 22 — and the last clause of the promise above is false.**
  "A fresh editor then offers … the moment the cursor lands" does **not** happen: CodeMirror never
  asks the source on a cursor landing. §A delivers the list on the *first keystroke of whitespace*
  and on a *fresh line*, not on open. See criterion 1 for the measurements and the cause.
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
  🔴 **§D is NOT the small independent nicety this bullet implies — session 22 promoted it.** It is
  now the only non-ruling route to criterion 1's user outcome. §A made the source answer; nothing
  asks it on a cursor landing, and the manual triggers that do exist (Ctrl-Space / Alt-` / Alt-i,
  all driven working) are invisible in the product. §D's button is therefore the answer to a
  **discoverability** problem rather than a convenience, and `NOTATION_RULES` copy naming the
  shortcut may deliver most of the value on its own. **Ruling owed before building** — see
  criterion 1.

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

   ◐ **DRIVEN 2026-08-15 (session 22) — three of four halves MET, and the headline one is NOT.**
   Driven on a copy of `fix012-drive` (renamed `FIX017A-S22-DRIVE` so the opened project was
   provable), component `/Probe`, against **two genuinely fresh nodes added for the drive** —
   `FreshFn` (`JavaScriptFunction`) and `FreshExpr` (`Expression`), each with `parameters: {}` so
   the body was empty rather than cleared. `functionScript` has no `default`, so a fresh node's
   document really is `""` (measured: `docLength: 0`, `cursor: 0`).

   | probe | mode | menu rendered | options |
   |---|---|---|---|
   | fresh popout, cursor lands, **no typing** | Function | 🔴 **none** | — |
   | fresh popout, cursor lands, **no typing** | Expression | 🔴 **none** | — |
   | space at a statement start | Function | ✅ yes | `Inputs`, `Outputs`, `Noodl`, `Component`, `Script` |
   | blank line after `const total = 1;` | Function | ✅ yes | the same five |
   | `const x = ` | Function | ✅ **silent** | — |
   | `foo(1, ` | Function | ✅ **silent** | — |
   | space at a statement start | Expression | ✅ yes | `Noodl`, `Variables`, `Objects`, `Arrays`, `min`… |
   | `1 + ` | Expression | ✅ **silent** | — |

   So **both modes answer, and neither smothers ordinary code** — the two-sided half of the
   criterion is met, with the controls firing in the same run. `.cm-tooltip-autocomplete` was read
   from the DOM and a screenshot taken, so the menu **rendered** rather than merely resolving.

   🔴 **But "appears without typing" is not met, and cannot be by §A alone.**
   `@codemirror/autocomplete`'s `getUpdateType` (`dist/index.cjs:947`) starts a completion **only**
   on an `input.type` user event or an explicit `startCompletionEffect`. Opening a popout and
   placing the cursor is `tr.selection` → `UpdateType.Reset`, which *deactivates*. §A made the
   source **willing to answer**; nothing **asks** it. **No file in `packages/noodl-editor/src` or
   `packages/noodl-core-ui/src` calls `startCompletion`** — §D's browse button would have been that
   caller, and §D is not built. Needs a ruling (§ below), not a quiet extension of §A.

   🔴 **The trap worth carrying: the technique that closed criterion 2 gives a FALSE PASS here.**
   Criterion 2 was driven by calling `startCompletion(view)`. That sets `context.explicit = true`,
   which bypasses §A's gate outright — `const atEmptyPosition = word.from === word.to &&
   !context.explicit`. The old `completesTopLevel` also returned `true` whenever `context.explicit`,
   so **the globals came back at an empty position before §A too**. An explicit-request drive of
   criterion 1 passes whether or not §A works, and would have been recorded as met.
   Measured instead on the **automatic** path with real keys — `Emulation.setFocusEmulationEnabled`
   plus `rawKeyDown`/`char`/`keyUp` **on one CDP connection** (`cdp type` is `Input.insertText` and
   never triggers autocomplete).

   ⚠️ **What the positives rest on.** In the app, the automatic path returned **only** the five
   globals — no JS keywords — while the *explicit* path returned keywords too. So on that path the
   Noodl source is the sole contributor, and the menu's existence is attributable to §A alone. That
   plus the unit control (`9e8b3198`: 5 of 8 specs go red with the blanket refusal restored) covers
   the "would this have worked before?" question. A pre-§A build was **not** re-run in the app.
   (The path difference itself is explained under criterion 2: the menu is a union of sources and
   `libraryCompletionSource` gates on `explicit`. It is not the Noodl source behaving differently.)

   ⚠️ **A MANUAL trigger does exist today, and it changes what is actually owed here.**
   `completionKeymap` is spread into the live keymap (`codemirror-extensions.ts:248`, inside
   `customKeybindings`, which `createExtensions` includes), so the popout honours all three of
   CodeMirror's bindings. Driven session 22 with real chords, each with a **leak control** — the
   document stayed `""` and the cursor stayed at `0`, so the menu came from the *command*, not from
   a stray inserted character (a leaked space would have triggered the automatic path and passed for
   the wrong reason):

   | chord | leak control | menu | options |
   |---|---|---|---|
   | **Ctrl-Space** | clean | rendered | `Inputs, Outputs, Noodl, Component, Script` + JS keywords |
   | **Alt-`** | clean | rendered | same |
   | **Alt-i** | clean | rendered | same |

   🔴 **But all three take the EXPLICIT path, so none of them exercises what §A gates** — they set
   `explicit = true` exactly as `startCompletion` does, and they opened this menu before §A existed.
   They are not evidence for §A; they are the answer to "what can a user do *today*".

   🔴 **So the ruling is about discoverability, not a missing capability.** Nothing in the product
   says these keys exist: the placeholder reads only `// Enter your JavaScript code here`, and the
   only mentions of Ctrl-Space in either package are **code comments**
   (`library-completions.ts:64`, `completionPosition.ts:9`). A beginner — the person this whole task
   is written for — has a working trigger they would never guess.

   ⚠️ **Unmeasured, and Richard's to check:** macOS binds **Ctrl-Space** to "Select the previous
   input source" at OS level, which would intercept it before the app sees it; CodeMirror ships the
   two `mac:` alternates precisely for that reason. CDP's `Input.dispatchKeyEvent` goes straight to
   the renderer and **bypasses OS bindings**, so this drive cannot settle it. If the OS does eat it,
   the honest framing becomes "the only reachable manual triggers are two undiscoverable alt-chords".

   ⚠️ **Harness note — the control earned its keep.** The first run of this probe reported
   *"KEY_DELIVERY_CONTROL: FAIL"*. The cause was mine, not the app's: `window.__ac` was set in the
   previous window's page and did not exist in the fresh one, so the reset step threw **before**
   `v.focus()` and the editor was never focused. Without a plain-`a` control the silent Ctrl-Space
   that followed would have read as "the keymap does not reach the popout" — a false negative on the
   exact claim under test. **Dispatch one printable key and assert it lands before believing any
   chord result.**
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

   ✅ **RE-DRIVEN ON THE AUTOMATIC PATH, session 22 — the pass STANDS, now measured rather than
   inferred.** Session 22 found that `startCompletion(view)` produces a **false pass** for criterion
   1 (see there), which put this criterion's evidence in question since it used the same trigger.
   A source argument said it was fine — the **member branch** (`noodl-completions.ts:192-199`) runs
   *before* any explicitness test and never reads `context.explicit`. But session 22 had also
   *measured* the two paths returning **different menus** at a top-level position, so "explicit ≈
   automatic" was demonstrably false somewhere in this file, and an argument from source is a weaker
   claim than the observation it is trying to explain. Re-driven with **real typed keys**:

   | path | doc | tooltip | total | the 11 `Records` methods | extras |
   |---|---|---|---|---|---|
   | **automatic — real keys** | `Noodl.Records.` | rendered | **11** | **all 11** | none |
   | explicit — `startCompletion` | `Noodl.Records.` | rendered | **11** | **all 11** | none |

   **Identical.** So the member branch is confirmed independent of `explicit` by measurement, and
   the top-level difference is explained rather than explained away: the menu is a **union of
   sources** (`codemirror-extensions.ts:318-319` registers the Noodl source *and*
   `libraryCompletionSource` alongside JavaScript's own), and `library-completions.ts:70` gates on
   `completesTopLevel`, i.e. on `explicit`. At a *member* position `isMemberPosition` rules first, so
   neither the library source nor JS built-ins contribute — which is exactly why the two paths agree
   here and disagree at a bare cursor. Criterion 2 is genuinely met for a user who types.

   🔴 **The general rule this establishes: a drive technique's validity is per-CRITERION, not
   per-feature.** The same harness, in the same file, one criterion over, flipped from evidence to
   noise — because criterion 2 asks *what* comes back (branch not gated on explicitness) and
   criterion 1 asks *when the menu appears by itself* (branch gated on exactly that). Before reusing
   a trigger, read the predicate under test and ask which branch the trigger takes.
3. 🔴 **The premise does not hold — this criterion is not falsifiable as written.** Typed `Inp`
   returns **exactly one** option (`Inputs`, the global); `Inputs.` returns **exactly one** (`qty`,
   the node's real declared port). Ports and API members **never appear in the same list** at these
   prefixes, because bare port completions are gated and member completions are anchored at a dot.
   So there is no ranking to control for, and `boost: 99` is not observable here. Either restate it
   against a prefix where both surfaces genuinely compete (`Noodl.Variables.` is the only known
   candidate — a name in both the static list and the project's), or strike it. **Needs a ruling.**
4. ✅ **Done 2026-08-15** — phase-61 `TASKS.md` reconciled to the tree; the residue was prose, not
   status. See §1.

## ✅ RULED 2026-08-16 (session 42)

**AC1 → accept.** The trigger exists and fires; its invisibility is Ctrl-Space being **OS-bound**,
which is not ours to fix. Document that and close the criterion, rather than leaving it open against
a fix the product cannot make.

**AC3 → STRIKE.** Its premise is false. Remove the criterion and leave one line saying why, so the
next reader does not re-derive it a third time.
