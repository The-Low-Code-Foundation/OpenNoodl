# LGC-007 — save a group of blocks, use it anywhere

**Status:** 🚧 **engine built 2026-08-12, no UI** · ⭐ **the second flagship** · 🔴 **Track: BUILD** —
"adopt over build" was tested here and failed; see the verdict below · depends on **LGC-006**

> **Read [What is built](#what-is-built-2026-08-12) before scheduling anything against this file.**
> The format, the store, the two shelves, the cycle guard, the shape inference, the inliner and
> export/import are built and graded by **66 specs in a plain-Node runner**. **Not one of them has a
> user-reachable surface.** There is no *Save as a block* menu item, no save dialog, no backpack, no
> regeneration sweep, and nothing has been run in an editor. The remaining work is the half a spec
> cannot grade.

## Richard's framing, which is the right one

> *"a blockly group of nodes can be saved, recalled in other logic nodes, and even embedded in new
> blockly builds as a function"* — and, on reading the first draft: *"the function is a collapsed
> Blockly node"*.

That second sentence is the design. A saved group is **one block that stands for many** — the same
fold the node graph performs when a component becomes a node, one level down.

## Why this is promoted above the debugging polish

It reads like a delight feature. The research says it is the **only known mitigation for the thing
that kills block programs**: App Inventor projects run to a median of **54 blocks** with a coin-flip
chance of exceeding 30, and the literature names the failure as viscosity — these environments lower
the barrier for learning and developing but not for reading, tracing and maintaining.

A program you cannot fold is a program you cannot maintain. Ship this before the badges.

## The two mechanisms, and why only one works

| | Custom block that **inlines** the saved code at generation time | Block that **calls** a Function component |
|---|---|---|
| cost at runtime | none — it is just code | a signal round trip |
| single definition | naively no, it is a copy | yes |
| **fatal problem** | — | **the node graph is asynchronous.** A signal round trip cannot be a synchronous expression, so `a + myFunc(b)` is impossible |

**Take inlining, with a live definition link.** Store the definition once; the toolbox block is a
*reference* by id; generation inlines it. Because code generation already runs in the editor on every
settled edit
([`BlocklyWorkspace.tsx:26`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx),
`SAVE_DEBOUNCE_MS = 300`), editing a definition can regenerate every Visual Function that references
it. Single-definition semantics at zero runtime cost.

## 🔴 Most of that is **not** already written — the verdict came back 2026-08-12

The hour was spent. Both plugins were read in their published Blockly-12 source; the full findings are
in [LGC-006](LGC-006-PLUGIN-SWEEP.md). **This task is the largest job in the phase, not wiring.**

**`@blockly/block-shareable-procedures`** does not do what its README implies here.

- Its unit is a **procedure** — a name, typed parameters, a body inside `procedures_defreturn`. It is
  gated throughout on `Blockly.procedures.isProcedureBlock`, so **it cannot represent an arbitrary
  group of blocks**, which is exactly what §1 asks for.
- The "definition store" is Blockly **core's** `workspace.getProcedureMap()` — per workspace, created
  and disposed with it. The plugin adds observable models, not a store.
- **"Shared between workspaces" is an event bus you wire yourself, between two workspaces that are
  live at the same time.** Ours never are: `BlocklyWorkspace` injects on mount and disposes on
  unmount, keyed by node id. There is no second workspace to forward events to.
- It ships **no code generators**; it works only because it reuses the built-in type names. A call
  block in workspace B would emit a call to a function defined only in A — the very failure the table
  above exists to avoid.

✅ **What it is worth taking for**: reference-by-id is real, and swapping the name-based built-ins for
model-backed procedures gives rename-safe local functions inside one Visual Function, for 6.8 KB.
That is a good trade and a different feature from this task.

**`@blockly/workspace-backpack`** holds up as the **retrieval UI** and nothing more. It is Scratch's
backpack, drag-from-it copies rather than removes, and its API (`getContents`/`setContents`/`addBlock`)
is open enough to drive from our own store. 🔴 **But its default store is the workspace**: it registers
a serializer that would write every backpacked stack into every Logic Builder node's project JSON, and
give each node its own separate backpack — the opposite of §2. Adopt it with
`skipSerializerRegistration: true` and put our own store behind it.

**So the definition store, reference-by-id over arbitrary block groups, the two shelves, the cycle
guard and the regeneration sweep are all still ours to build.** What the sweep saves is the *pattern*
— Blockly's `IProcedureModel` plus fired-event shape is the right thing to copy — and the backpack as
the drawer. Spec the rest.

## What is built, 2026-08-12

Everything below is committed on `lgc-007-lane` and graded by **66 specs** in `tests-unit/lgc-007/`,
which run in plain Node with no Electron. `npx tsc -p tsconfig.json` is clean; `npx jest` in
`packages/noodl-editor` is **1965 passed / 136 suites**.

**The rules are in [`views/BlocklyEditor/myblocks/`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks)
and import nothing — not even Blockly.** A saved group is plain JSON, so the format, the cycle
guard, the shape inference and the inliner are all JSON transforms. The directory is in
`tsconfig.tests-main.json`'s include list, so that boundary is enforced by where a file sits rather
than by remembering it. Anything touching Blockly or an editor singleton is one level up.

| | File | State |
|---|---|---|
| the format | `myblocks/format.ts` | ✅ built · written down below |
| the two shelves and every rule over them | `myblocks/store.ts` | ✅ built |
| where the shelves live (project settings, `EditorSettings`) | `MyBlocksShelves.ts` | ✅ built · **never run** |
| §3 the cycle guard, at save and at generate | `myblocks/cycles.ts` + `myblocks/expand.ts` | ✅ built · 21 specs |
| §1 shape and signature inference | `myblocks/shape.ts` | ✅ built · 17 specs |
| the inliner, with the live definition link | `myblocks/expand.ts` | ✅ built · 13 specs asserting the **generated JavaScript** |
| export / import, with id remapping | `myblocks/store.ts` | ✅ built · 15 specs |
| §4 delete refusal, and inline-and-detach | `myblocks/store.ts` + `expand.ts` | ✅ built |
| the two call blocks, the My Blocks toolbox category | `MyBlocksBlocks.ts`, `BlocklyToolbox.ts` | ✅ built · **never rendered** |
| generate-with-inlining, wired into the 300 ms debounce | `BlocklyWorkspace.tsx` | ✅ built · **never run** |
| **§1 the *Save as a block* menu item and dialog** | — | ❌ **not built** |
| **§2 the backpack UI** (`@blockly/workspace-backpack`) | — | ❌ **not built** — cannot install in this lane |
| **§2 the project shelf beside components in the sidebar** | — | ❌ **not built** |
| **§4 the regeneration sweep** over Logic Builder nodes | — | ❌ **not built** — see below |
| export/import **file pickers**, the delete dialog's detach offer | — | ❌ **not built** |

🔴 **§4's sweep is not built and its blocker is not code.** Everything below the definition graph is
done: editing a definition changes what every referencing program generates, and that is asserted by
a spec. What is missing is the index from a definition id to the **Logic Builder nodes** that
reference it, and the write of `generatedCode` onto nodes the user is not looking at. The spec's own
warning is the reason it was not rushed: *"that is a project mutation from a background sweep, and
this repo has a register entry about a 1-second quit window losing data. The sweep must be part of
the normal save path, not a fire-and-forget."* Choosing which save path, in a repo where
`EditorSettings` already debounces its own write by exactly that 1000 ms, is a decision that should
be made deliberately rather than as the tail of an implementation. ⚠️ Until it lands, a node
referencing an edited definition picks the change up the next time **that node** is opened and
settles — which is correct, but is not the acceptance criterion.

## The definition format

A saved group is JSON and nothing else. §2: *"do not design a format that forecloses"* a shared
library. Three properties buy that, and each has a spec pointed at it.

```jsonc
// One definition.
{
  "formatVersion": 1,
  "id": "mb_k3f9x2q1a8d0",   // identity. A call block stores THIS, never the name.
  "name": "Half",             // display only; renameable without breaking a caller
  "description": "…",         // optional
  "shape": "value",           // 'value' | 'statement' — derived from body, cached
  "params": [                 // derived from body, cached
    { "id": "p_…", "name": "a", "type": "*", "hole": ["0", "i:A"] }
  ],
  "requires": ["mb_…"],       // ids this body calls. Derived, cached, and NEVER trusted
  "body": { "blocks": { "languageVersion": 0, "blocks": [ /* Blockly */ ] } },
  "colour": "55",
  "createdAt": "2026-08-12T…", "updatedAt": "2026-08-12T…"
}

// A shelf, an export file, or one day a fetched package — the same envelope in all three.
{
  "formatVersion": 1,
  "source": { "name": "…", "url": "…", "version": "…" },  // free text; nothing reads it today
  "definitions": [ /* … */ ]
}
```

1. **Identity is a uid, not a name.** A rename is a display change, so two independently-authored
   libraries can be merged: a name collision is cosmetic and an id collision is remappable.
2. **A definition names its dependencies.** A partial export carries its transitive closure by
   default, so an import cannot dangle — and the import side remaps a colliding id and rewrites
   every reference to it, inside the bodies and inside `requires`. That is the mechanism a shared
   library would use, and the spec for it is the one that decides whether this claim is true.
3. **The envelope is scope-free.** Nothing in the JSON says which shelf it came from. The shelf is
   the container, not a field.

**`shape`, `params` and `requires` are caches**, so the toolbox can draw a flyout without parsing
every body. They are recomputed by the store on every write, and **no guard reads them** — the cycle
check re-walks the body, because §3 needs the check to hold at generate time and a stale cache is
exactly the case it exists for. There is a spec that writes `requires: []` onto a genuinely cyclic
pair to prove the guard ignores it.

**A hole path** addresses a socket from the body root as a plain string array: `["0","i:VALUE","n","i:A"]`
is *root block 0 → its `VALUE` input → one `next` down → that block's `A` input*. Recomputed on every
write, so it cannot drift; skipped rather than thrown on if it no longer resolves, because losing one
argument is a visible wrong answer and refusing to generate the whole program is a worse one.

**Where the shelves are.** Project: `ProjectModel.setSetting('myBlocks.library', …)`, so it is inside
`project.json` and reaches a collaborator through git. User: `EditorSettings` key
`myBlocks.backpack`, the editor's own JSON on disk. Project wins on an id collision, because a
program that generates differently for its author than for everyone else is the worse failure.

## §1 — Saving

Select blocks → **Save as a block**. Name it. It appears in a **My Blocks** toolbox category and in
the backpack.

**Naming:** *My Blocks* is Scratch's own term for custom blocks, tested on millions of non-technical
users, and it is plain English. Preferred over "Snippets", "Macros" or "Procedures", all of which
are words a builder has to already know.

**Shape follows purity, for free.** Blockly already encodes this and users already read it:

- pure, one output → a **value block** with an output plug, droppable mid-expression;
- has signals or several outputs → a **statement block** you stack.

The inferred signature picks the shape. **Nothing to teach** — this is Blockly's own grammar doing
the explaining, and it is the reason not to invent a shape of our own.

## §2 — Scope: project, and user

Scratch's backpack is **account-scoped** — it travels between projects, and it is only available
online, which is a limitation we do not have to copy.

Two shelves:

- **This project** — definitions saved into the project, so they travel with it and a collaborator
  gets them. These live beside components in the sidebar, because a Function component and a saved
  block are the same idea at two scales.
- **My backpack** — the builder's own shelf, across projects, on disk.

A definition is JSON, so export and import are free, which makes a shared library a natural surface
later. **Not in this task**, but do not design a format that forecloses it.

## §3 — The guard

**A referencing B referencing A must be rejected at save time**, or the inliner recurses forever and
takes the editor with it. Cycle detection over the definition graph, checked on save *and* on
generate — on generate too, because a definition can be edited after the reference was created.

⚠️ The failure mode if this is missed is not an error message; it is a hung renderer during a debounce
tick, which will look like the workspace freezing at random.

### ✅ §6 DRIVEN 2026-08-12 — 2 of 3 conditions pass, and the third is a real defect

> **Superseded by the re-drive at the end of this section: 3 of 3 now pass.** Kept because it is
> the record of how the defect was found, and of what the fix had to undo.

First time this guard met a real renderer. Fixture `lgc59-cycle`, opened in a live editor with a
running preview; `defAAA ⇄ defBBB` hand-written into `settings['myBlocks.library']`.

| Condition | Result |
|---|---|
| The workspace stays live | ✅ **pass.** No freeze, no hung renderer. Both blocks survived in the saved `workspace` (`myblocks_call_statement`, `noodl_get_input`) |
| The console carries the warning | ✅ **pass, and better than specified.** It names the loop: *"[Blockly] The saved blocks in this program could not be expanded: Saved block "Alpha" uses itself. The loop is Alpha → Beta → Alpha. No code was generated."* |
| `generatedCode` **unchanged** (`Outputs.completed = true;`) | 🔴 **FAIL.** It was emptied to `""` **and written to disk.** `project.json` SHA `0e77f6e3…` → `53f281a6…` |

🔴 **The guard refuses correctly and then destroys the evidence that it used to work.** The message
says "No code was generated", and that *absence* is persisted over the last-known-good code. A user
whose two definitions happen to reference each other loses the compiled output of a program that ran
yesterday, and reopening cannot restore it — the cycle is still there, so it re-empties. The blocks
survive, so the program is recoverable *in principle*; the compiled artefact the running node
actually executes is not.

**This is the second mechanism found in one day with the same shape**, the other being
`disableOrphans` (`FINDING-2026-08-12-…`). Both are a *refusal to generate* that overwrites the
persisted output with `""` instead of leaving the previous value alone. They are independent —
`disableOrphans` was reverted before this drive, and the workspace here carries **no
`disabledReasons`**, which is also a live confirmation that the revert works. **The pattern is worth
a rule: a generation step that declines to produce code must not be allowed to publish its silence.**

⚠️ **The fixture was restored** to `Outputs.completed = true;` so §6 can be re-run from a clean
baseline. **It was rewritten with `JSON.stringify(…, null, 2)`, so its byte formatting no longer
matches what the editor writes** — re-baseline it with an editor save before using it for any
byte-identical comparison.

**Not yet answered:** whether the empty write happens on *open* or on the first debounce tick, and
whether a node whose definitions are later fixed regenerates. Both need another drive.
✅ **Both answered by the re-drive below.**

### ✅ FIXED 2026-08-12 — the refusal no longer writes anything

**The mechanism, which was one line and not where the drive pointed.**
`BlocklyWorkspace.flushSave` held a `lastGoodCodeRef = useRef('')` and, on a generation error,
passed that ref on to the writer. The ref was **seeded from nothing and never from the node's
saved `generatedCode`** — so a refusal on the first flush after mount passed the initial `''`
straight through to `setParameter('generatedCode', '')`. That is why reopening could not recover
it: the ref was empty again on every mount, and the cycle was still there to trigger the flush.

**The fix is not to seed the ref. It is to not have one.** The node's own `generatedCode`
parameter *is* the last code that generated cleanly; a second copy of that fact in the editor is
the one-fact-two-stores shape (L11) this directory keeps finding. So:

| | |
|---|---|
| `generateWithMyBlocks` | already returned `code: undefined` on a refusal — its contract was right all along. `GenerateResult.code` was however **declared `string`**, a lie that compiled |
| `BlocklyWorkspace` | ref deleted; passes `generated.code` — `undefined` on a refusal — straight through |
| `CanvasTabs` | threads `string \| undefined` rather than defaulting it |
| `OverlayViews.handleBlocklyWorkspaceChange` | **saves the workspace unconditionally**, then returns early without touching `generatedCode` when `code === undefined`, and warns |

`undefined` and `''` now mean different things on this seam, deliberately: **`''` is a real
program** — the one with no blocks in it — and writing it is legitimate. That is exactly why a
refusal may not use the same value.

🔴 **The compiler does not hold any of this.** `strictNullChecks` is **off** across the editor
package (root `tsconfig.json` sets no `strict` flags), so the `string | undefined` annotations
are documentation, not enforcement — nothing stops a future edit returning `''`, and nothing
forces the caller's check. The contract is held by
`tests-unit/lgc-007/generateWithMyBlocks.spec.ts` instead, **proved red** by inverting the fix to
return `''`: exactly the two intended specs fail and the refusal-still-reports spec stays green.

### ✅ §6 RE-DRIVEN 2026-08-12 — 3 of 3 pass, and the pass is not vacuous

Same fixture, same cycle, live editor. The fix is confirmed at the only place it could be:
`project.json` on disk.

| Condition | Result |
|---|---|
| The workspace stays live | ✅ **pass.** Injected, both top-level blocks rendered, rails drawn |
| The console carries the warning | ✅ **pass.** *"Saved block "Alpha" uses itself. The loop is Alpha → Beta → Alpha. No code was generated."* |
| `generatedCode` **unchanged** | ✅ **PASS** — `"Outputs.completed = true;"` before and after, byte-identical. Previously the FAIL |

🔴 **The thing that makes this a real pass rather than a quiet one: the same flush wrote to disk.**
A refusal that skips the write is indistinguishable from a flush that never ran, and the first
reading of this drive *was* that vacuous case — opening the tab produced no flush at all, so
`generatedCode` was trivially unchanged. The discriminator is the **`workspace` parameter**: the
block was moved to `x:77, y:63` and those exact coordinates are on disk, in the same save that
left `generatedCode` alone. **Grade this condition by what the refusal *did* write, never by what
it didn't.**

The full ordered console signature, all four lines, is what a pass looks like:

```
[Blockly] The saved blocks in this program could not be expanded: … Alpha → Beta → Alpha …
[NodeGraphEditor] Workspace changed for node c6
[NodeGraphEditor] Blocks saved for node c6, but generation declined — keeping the previous …
Project saved …
```

**Both open questions answered.**

- **Neither open nor the first debounce tick — the first debounce tick *after an edit*.** Opening
  the tab on a cyclic node fires no flush whatsoever: no `Workspace changed`, no refusal, no save.
  So the old defect needed one edit after mount, not merely a mount. Merely *looking* at a broken
  node never destroyed its code; touching it once did.
- **Yes, a fixed node regenerates — on its own next settled edit, not when the definition changes.**
  Breaking the cycle in `myBlocks.library` and then moving a block regenerated cleanly and wrote
  `__s(…)/__p(…)` instrumented code, logging `Saved workspace and generated code for node c6`.
  🔴 The definition edit alone changed nothing on the node. That gap **is** §4's sweep, which is
  ruled unauthorised — so the current behaviour is "fixed, and it recovers the moment you touch it".

⚠️ **The instrumentation in `generatedCode` is correct, not a leak.** `__s`/`__p` are persisted
deliberately — `flushSave` documents that there is one generated string and never a debug/release
pair, and the runtime compiles them as its ninth and tenth parameters. Checked before filing it.

✅ **The fixture was restored byte-for-byte** (`shasum f9470b9f…` before and after), so §6 re-runs
from the same baseline. The 2-space-formatting caveat above still stands — this drive compared the
`generatedCode` *field*, which is immune to it.

**How it was driven, since the canvas gate does not apply here.** The block editor is opened by an
`EventDispatcher` event, so no canvas gesture is needed:
`EventDispatcher.instance.emit('LogicBuilder.OpenTab', {nodeId, nodeName, workspace})` — the exact
payload `LogicBuilderWorkspaceType.onEditBlocksClicked` emits. The edit is
`Blockly.getMainWorkspace().getBlockById(id).moveBy(dx, dy)`, which is the event a real drag fires
at drag *end*.

## §4 — Updating a definition

### 🔴 RULED 2026-08-12: do not build the sweep yet

**Richard's ruling: fix the destructive-write class first; the regeneration sweep waits.**

The reasoning, and it is the ruling's own: a background sweep is a *second* writer of
`generatedCode`, and it would have been built on top of a write path where the *first* writer
emptied the field on every refusal. Two writers of a field that one of them destroys is not a
sweep, it is a race with a data-loss outcome.

The first half is now done (see §6's fix block above). **The sweep is still not authorised** —
when it is picked up, the save-path question below is the one to answer, and it should be
re-put to Richard with the fix in hand rather than assumed from this ruling.

Editing a definition regenerates every Visual Function that references it. That needs a dependency
index (definition id → node ids) and a regeneration sweep.

⚠️ **Regeneration writes `generatedCode` on nodes the user is not looking at.** That is a project
mutation from a background sweep, and this repo has a register entry about a 1-second quit window
losing data. The sweep must be part of the normal save path, not a fire-and-forget.

⚠️ **Deleting a definition that is still referenced** must be refused or must offer to inline-and-detach.
Silently breaking three other nodes is the worst available outcome, and "deleting a parameter reverts
nothing" is already in the registers as a related surprise.

## Acceptance

- ⚠️ Blocks selected in one Visual Function can be saved, named, and dropped into a **different**
  Visual Function in the same project, where they generate working code. — **half met.** The
  *generate working code* half is asserted on the exact JavaScript output (`inliner.test.ts`); the
  *selected, saved, named and dropped* half has no UI and is deferred.
- ⚠️ A pure single-output group becomes a value block and can be dropped inside `a + …`. A group with
  signals becomes a statement block and cannot. — **half met.** The inference is graded 17 ways and
  the value block is asserted to generate `Outputs["r"] = Inputs["n"] / 2 + 1;` from a saved
  expression dropped inside `a + …`. **"and cannot"** is Blockly's connection checker refusing a
  drag; it needs a drive.
- ⚠️ Editing a definition changes the behaviour of every node referencing it, **without reopening
  them** — verified by running one, not by regenerating and reading the code. — **the link is
  built and specced; the sweep is not.** A spec edits a definition and asserts the *same* program
  object now generates `* 20` where it generated `* 10`, with the reference untouched. **Without
  reopening them** needs §4's sweep, which is not built, and the criterion's own last clause —
  *verified by running one* — needs a drive regardless.
- ✅ A → B → A is refused at save with a message naming the cycle, and refused at generate. — **met,
  both halves, 21 specs.** The generate half is graded against a shelf whose `requires` deliberately
  lies, which is the state a save-time-only guard cannot see.
- ⚠️ Deleting a referenced definition is refused or detaches, and never leaves a dangling reference.
  — **both mechanisms built and specced** (`MyBlocksInUseError` names every definition and node that
  would break; `detachDefinition` inlines and the detached program is asserted to generate what it
  generated before). **There is no dialog that offers the choice.**
- ✅ A definition exports to JSON and imports into a different project. — **met**, including the case
  the format was designed for: an id that collides on import is remapped and every reference to it is
  rewritten.
- ❌ Nothing in this task has been run in an editor. See Deferred verification.

## Deferred verification

Everything here needs a running editor, and none of it was done. ⚠️ Per the register: an occluded
Electron renderer fires no `ResizeObserver` and clamps timers ~1000×, so take a screenshot to force
a frame and do not trust a headless assertion about layout.

1. **The category renders and the empty state reads.** Open a Logic Builder node, open **My Blocks**
   in the toolbox. *Pass:* the category exists, is last, and shows *"Select some blocks, right-click
   and choose Save as a block"*. ⚠️ It will say that **forever** until the save UI is built —
   confirm the label renders, not that the instruction is followable.
2. **A call block renders at both shapes.** With a definition on the project shelf (seed it by
   writing `myBlocks.library` into `project.json` by hand), reopen the node. *Pass:* a value
   definition gives a block with an output plug and one socket per parameter; a statement definition
   gives one that stacks. *Fail that matters:* `rebuildInputs_` throws on `removeInput` for the
   unnamed dummy input — it is named `HEADER` for that reason, but this is the first time that code
   runs anywhere.
3. **The "and cannot" half of §1.** Drag a statement-shaped saved block toward the `A` socket of a
   `math_arithmetic`. *Pass:* it does not snap.
4. **A saved block dropped into a second Visual Function.** Two Logic Builder nodes, same project.
   *Pass:* the block appears in the second node's My Blocks category and its `generatedCode` port
   contains the inlined body. This is the flagship criterion and it is the one a spec cannot reach,
   because `BlocklyWorkspace` injects on mount and disposes on unmount keyed by node id — the two
   workspaces are never alive together.
5. **The 300 ms debounce still settles.** Type in a Logic Builder node with a saved block in it.
   *Pass:* one save per settle, no visible stall. The inlining path serialises, expands, loads a
   headless workspace and generates — measure it once with a real body rather than assuming.
6. **A cycle does not freeze the workspace.** Hand-write two definitions into `project.json` that
   reference each other, put a call to one in a node, open it. *Pass:* the workspace stays live, the
   console carries *"The saved blocks in this program could not be expanded"*, and the node's
   `generatedCode` is unchanged rather than emptied. ⚠️ **This is the whole point of §3 and it is the
   only place the guard meets a real renderer.**
7. **The project shelf survives a save/reopen** and reaches a collaborator through git — i.e. it is
   in `project.json` and not in some editor-local cache. ⚠️ Check `ProjectSettingsModel.ts:92`, which
   deep-copies the whole settings bag into the settings panel on open; confirm a library survives
   opening and closing that panel.
8. **The backpack shelf survives a quit.** Save to the user shelf, quit within a second.
   ⚠️ `EditorSettings.set` debounces its disk write by **1000 ms** — this is expected to be the same
   quit window already in the registers, and the test is to confirm how bad it is, not to be
   surprised by it.

## Not built, in the order it should be picked up

1. **The save UI.** `bodyFromBlocks` and `previewSignature` exist and nothing calls them. A
   context-menu item on a selection, a dialog with a name, the inferred shape and its plain-English
   reason (*"it sends or declares a signal"*), and a shelf picker.
2. **§4's regeneration sweep** — the definition-id → node-id index, and a write of `generatedCode`
   onto nodes the user is not looking at, on the normal save path. **Decide the save path first.**
3. **The delete dialog** — refuse, or offer inline-and-detach. Both mechanisms exist.
4. **`@blockly/workspace-backpack@7.0.11`** as the retrieval UI. **It must be installed with
   `skipSerializerRegistration: true`** (LGC-006 L30) or it writes every backpacked stack into every
   Logic Builder node's project JSON. Install line, to be run in the primary checkout, alone:
   `npm i -w packages/noodl-editor @blockly/workspace-backpack@7.0.11`. Drive
   `getContents`/`setContents` from `myBlocksStore()`; it is the drawer and `myblocks/store.ts` is
   the cupboard. ⚠️ Its five `Blockly.Msg` keys need adding to `BlocklyLocale.ts`.
5. **The project shelf in the sidebar**, beside components (§2).
6. **Export/import file pickers.** The store functions are built and specced.
7. **α-renaming of variables per expansion.** Today a definition's variables merge into the host
   **by name**, so two expansions share one variable — the same thing that happens when you paste a
   stack twice. A saved block using a local variable as scratch space will interfere with itself if
   one expansion nests inside another. Documented in `expand.ts`, not fixed.
8. **A toast instead of a console line** when generation is refused.
- ✅ **The first deliverable was the plugin verdict**, and it is delivered: both plugins read in
  source against Blockly 12 and our blocks, written up in [LGC-006](LGC-006-PLUGIN-SWEEP.md)
  2026-08-12. ⚠️ It is a verdict from reading, not from running — neither plugin was installed. The
  size of this task is now known; the *wiring* still has to be proved on a drive.

## Register

| # | Finding | State |
|---|---|---|
| L19 | The definition store, reference-by-id and cross-workspace sharing we designed **is an official plugin**. Adopt-over-build applies at its strongest here | 🔴 **WRONG — disproved 2026-08-12 in source.** `block-shareable-procedures` shares *procedures*, not block groups, between *live* workspaces, via events you forward yourself, with no store and no persistence. Adopt-over-build applies here at its **weakest** |
| L38 | The backpack holds up as the **drawer** and fails as the **cupboard**: its default serializer writes the contents into the workspace JSON, so each Logic Builder node would get its own backpack inside the project file | 🔴 found 2026-08-12 — `skipSerializerRegistration: true` |
| L20 | A call-into-the-node-graph mechanism is **structurally impossible** for value blocks — signals are asynchronous, expressions are not. Inlining is not a compromise, it is the only option | ✅ settled |
| L21 | Blockly's block shape already encodes pure-vs-effectful, and users already read it. Do not invent a visual language for something the toolkit says for free | ✅ settled |
| L22 | The scale literature makes this a maintenance necessity, not a delight. Median App Inventor project: 54 blocks | ✅ why it is promoted |
| L39 | 🔴 **A cycle is not the only way to hang the inliner.** An *acyclic* definition graph can expand exponentially: twelve layers each calling the one below twice is 4096 copies and not one cycle. §3's failure mode reached by a route §3 does not mention | 🔴 found 2026-08-12 — two backstops, both **errors** rather than truncations, because half a generated program is worse than none |
| L40 | 🔴 **A definition can change shape under an existing reference.** Add a `send signal` to a value definition and every value plug pointing at it is asking for something that cannot be an expression. Blockly block types are fixed at `init`, so the old call block is now literally the wrong *type* | 🔴 found 2026-08-12 — refused by name (`MyBlocksShapeError`); §4's sweep should eventually repair it rather than only refusing |
| L41 | **Inlining at the JSON level, not inside a Blockly generator, is what makes §3 testable at all.** The obvious implementation — a generator that deserialises the definition and generates it — puts the cycle guard somewhere only a drive can reach | ✅ settled 2026-08-12 — it also leaves `NoodlGenerators.ts` untouched and makes §4's detach the same transform rather than a second one that can drift |
| L42 | ⚠️ **`ProjectModel.setSetting` bails on `this.settings[name] === value` — *reference* equality.** Mutating a library in place and handing back the same object is a silent no-op | ⚠️ found 2026-08-12 — the shelf always writes a fresh clone |
| L43 | ⚠️ **`EditorSettings.set` debounces its disk write by 1000 ms**, which is the same quit window already in the registers. A backpack save immediately before a quit can be lost, and it is not fixable from the shelf's side | ⚠️ found 2026-08-12 — written down, not fixed; item 8 of Deferred verification measures it |
| L44 | ⚠️ **This repo compiles with `strictNullChecks` off, so TypeScript will not narrow `{ok: true} \| {ok: false}` on the literal.** A result type that reads correctly only under a compiler flag we do not set is a shape that lies | ⚠️ found 2026-08-12 — cost one compile cycle; worth knowing before writing any other result type |
| L45 | ⚠️ **A definition's variables merge into the host by name**, so two expansions share one variable. A saved block using a local as scratch space interferes with itself when nested inside another expansion | ⚠️ known limitation 2026-08-12 — α-renaming per expansion is the fix and is not in this version |
| L46 | ✅ **Blockly runs headless in Node**, so the inliner can be graded on the JavaScript it actually produces rather than on the shape of the JSON it emits — `render:report clean means nothing drawn` was the available trap and this closes it | ✅ verified 2026-08-12 — `initialize.ts`, `NoodlBlocks.ts` and `NoodlGenerators.ts` import nothing but `blockly`, so all fifteen Noodl generators are now gradeable without an editor |
