# LGC-007 — save a group of blocks, use it anywhere

**Status:** 📋 open · ⭐ **the second flagship** · 🔴 **Track: BUILD** — "adopt over build" was tested
here and failed; see the verdict below · depends on **LGC-006**

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

## §4 — Updating a definition

Editing a definition regenerates every Visual Function that references it. That needs a dependency
index (definition id → node ids) and a regeneration sweep.

⚠️ **Regeneration writes `generatedCode` on nodes the user is not looking at.** That is a project
mutation from a background sweep, and this repo has a register entry about a 1-second quit window
losing data. The sweep must be part of the normal save path, not a fire-and-forget.

⚠️ **Deleting a definition that is still referenced** must be refused or must offer to inline-and-detach.
Silently breaking three other nodes is the worst available outcome, and "deleting a parameter reverts
nothing" is already in the registers as a related surprise.

## Acceptance

- Blocks selected in one Visual Function can be saved, named, and dropped into a **different**
  Visual Function in the same project, where they generate working code.
- A pure single-output group becomes a value block and can be dropped inside `a + …`. A group with
  signals becomes a statement block and cannot.
- Editing a definition changes the behaviour of every node referencing it, **without reopening
  them** — verified by running one, not by regenerating and reading the code.
- A → B → A is refused at save with a message naming the cycle, and refused at generate.
- Deleting a referenced definition is refused or detaches, and never leaves a dangling reference.
- A definition exports to JSON and imports into a different project.
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
