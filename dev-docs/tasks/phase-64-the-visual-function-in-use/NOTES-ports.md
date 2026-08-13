# NOTES — VFN-008 criterion 4: the ports a placed saved block publishes

**Session:** 2026-08-13 · branch `vfn-c-ports` (worktree, forked from `cline-dev` at `f61932a8`)
**Gates:** `cd packages/noodl-editor && npx jest` → **165 suites / 2462 passing** (baseline 165 /
2453; +9 is exactly the tests added to `tests-unit/vfn-008`). `cd packages/noodl-runtime && npx
jest` → **135 of 136 suites, 2487 passing** with one pre-existing failure named below.
`npx tsc` clean on `noodl-editor`; `noodl-runtime` has two pre-existing errors in files this branch
does not touch. `cloud-library:check` → **green**, `Committed cloud node library is up to date`.

⚠️ **Written pre-drive. Session C has since driven the migrate path and it works** — see *What is
proved, and what is owed* at the foot; only the wire-taking gesture is still owed.

🔴 **Nothing here had been driven when this was written.** No editor was launched. The measurement below is taken against
the **real artefacts on disk** — Richard's live backpack shelf and the `vfn64-qa` project — which is
stronger than a fixture and is still not a drive.

---

## The defect, restated

A saved block's body is inlined into the host program at generate time, so a definition containing
`set output "total"` makes the host node's program write `Outputs["total"]`. The node had no
`total` port. **The program was right and the node was deaf.**

The cause is that the two things happen to different copies of the workspace: `updatePorts` calls
`detectIO` on the **raw** serialised workspace — the string persisted as the node's `workspace`
parameter — while `expandWorkspace` runs inside `generateWithMyBlocks` and its expanded copy is
discarded the moment the JavaScript is generated. `detectIO` had never heard of
`myblocks_call_value` / `myblocks_call_statement`, so a call block contributed no port mentions at
all.

⚠️ **The blast radius is larger than VFN-008 recorded.** `interfaceRails.ts` and `benchModel.ts`
both read `detectInterface`, which is a projection of the same traversal — so the Inputs/Outputs
rails inside the Visual Function editor, and VFN-011's bench, were **also** blind to a saved
block's ports. Three surfaces, one traversal, one fix.

---

## The decision: the call site states its signature

`extraState.ports` on the call block carries whatever `detectInterface` reported for the
definition's body, and `detectIO` reads it. The workspace stays the single source of truth for the
port set, and nothing outside it is consulted.

**A call block is a call site, and a call site states the signature it was bound against** — the
relationship a header file has to a definition. This is not a new mechanism in this feature:

- `extraState` already carries the definition's `label` and its argument names, and
  `MyBlocksBlocks.ts` says why in as many words: *"it makes a saved body self-describing, so a
  definition that calls another definition can be analysed with no store present."*
- `MyBlockDefinition` already caches `shape`, `params` and `requires`, all derived from `body`,
  under `format.ts`'s stated rule — *recomputed on every write, never trusted by a guard*.

`ports` is one more field under both rules. It is computed by `detectInterface` and by nothing else,
so **it is a cache of the one detector's answer, never a second detector** (register L11). A
definition that calls another definition carries the nested ports transitively for free, because
the traversal now knows what a call block is — with no expansion, no definition edge followed at
read time, and therefore no way to recurse.

### 🔴 The route that was rejected, and why — plumb the shelves into port detection

This is the obvious route and the one both the task file and `NOTES-saveblock.md` name first. It is
wrong for three reasons, the first of which is fatal and evidenced.

**1. The backpack shelf does not exist in the viewer, and must not.** A definition lives on one of
two shelves. The project shelf is a key in `project.json`'s settings bag, and that bag *does* reach
the viewer (`ProjectModel.toJSON` → `GraphModel.setSettings`), so resolving project-scoped
definitions in the runtime is technically possible. The backpack is a key in `EditorSettings` —
machine-local by design, because "follows the builder between projects" is what it is *for*.

So this route would publish ports for a project-scoped saved block and **not** for a
backpack-scoped one. A node's public interface would depend on which shelf a colleague happened to
pick in a radio group, and on which machine had the editor open. That is a worse defect than the
one being fixed, and it is unfixable inside the route without making the backpack travel, which
contradicts its purpose.

🔴 **This is not hypothetical. The live artefact that produced the finding is backpack-scoped:**

```
backpack ids:       [ 'mb_r945r1pzjmnx2ya8/test1' ]
project-shelf ids:  []
```

**The rejected route would have fixed zero of the reported defect on Richard's own machine.**

**2. It imports the inliner's failure surface into a port-registration path.** Resolving definitions
means cycles, missing definitions, shape mismatches and expansion budgets — every one of which
`expandWorkspace` signals by **throwing**. `detectIO`'s contract is that it never throws, because
its caller is where the node gets created; a half-written parameter must not stop a node existing.
The alternative — a second, weaker traversal that resolves definitions without the guards — is
L11 with a different noun, and it would be free to disagree with the inliner about what a program
means.

**3. Port publication would stop being a function of one parameter.** `updatePorts` fires on
`nodeAdded` and on `parameterUpdated` for `workspace`. It does not fire when project *settings*
change, so this route also needs a `projectSettingsChanged` listener that re-publishes every Logic
Builder node in the graph. Two moving parts where there was one.

### The other filed route — expand before the workspace parameter is written

Rejected for the reason `NOTES-saveblock.md` already gives, and it is right: the persisted
workspace would no longer be the blocks the builder sees, so it could not be reopened for editing.
Persisting both copies is one fact in two stores, which is the same objection arrived at from the
opposite direction.

### ⚠️ The cost, stated plainly

The rows are a cache, so they can go stale: a definition that grows an output after a call block was
placed leaves that call block understating its ports until it is reloaded with the shelf present and
the workspace is flushed again. **That is the same staleness `label` and `args` have always had**,
and before this change the understatement was total and permanent. `loadExtraState` re-derives from
the live definition on every load, which upgrades every call block on disk today.

⚠️ **In memory immediately; on the node at the next settled edit.** Only `flushSave` rewrites the
`workspace` parameter, and loading runs with `Blockly.Events.disable()`. This is exactly the
contract `ensureHatsInJson` already has — *"opening a program and closing it again changes no
bytes"* — and it is why the rails and the bench, which read the live workspace, are correct before
the node's own ports are.

---

## Measured on the real artefacts, not on a fixture

Read-only, from `~/Library/Application Support/NodeGX/editorSettings.json` (the **live** userData
directory — the two decoys under `OpenNoodl Editor/` and `Noodl Editor/` are not) and from
`vfn64-qa/project.json`:

```
definitions on disk: test1 (mb_r945r1pzjmnx2ya8)   ← backpack only

=== /ErgCodes / Logic Builder c6
call blocks: test1 → mb_r945r1pzjmnx2ya8
has extraState.ports already? false
BEFORE  outputs: [{"name":"total","type":"*"}]
AFTER   outputs: [{"name":"total","type":"*"},{"name":"result","type":"number"}]
CONTROL outputs: [{"name":"total","type":"*"}]        ← the stamp removed again
```

`result` is **precisely** the port VFN-014 traced `Outputs["result"]` to and could not find on the
canvas. It now appears, typed `number`, because the definition body declares
`define output result (number)`. The CONTROL line is the defect restored by deleting one key.

---

## 🔴 The negative controls, which are the reason to believe any of this

Every criterion here is an absence — *no phantom port*, *no port from a variable*, *no port from a
block that is not a call* — and a suite of absences is indistinguishable from an instrument that
measured nothing.

**Watched red, not asserted red.** Each half of the fix was reverted in the working tree and the
suites re-run:

| Reverted | Suite | Result |
|---|---|---|
| the runtime reader (`callPortMentions` call site) | `noodl-runtime/test/logic-builder-call-ports.test.ts` | **11 failed / 4 passed** of 15 |
| the runtime reader | `noodl-editor/tests-unit/vfn-008` | **9 failed / 30 passed** of 39 |
| the editor writer (`callBlockJson` stamp + `loadExtraState` re-derivation) | `noodl-editor/tests-unit/vfn-008` | **9 failed / 30 passed** of 39 |

Restored: 15/15 and 39/39.

⚠️ **The four runtime tests that stayed green under the revert are the point of separating them.**
They are the ones whose claim the pre-fix code also satisfied — *a block that is not a call block is
not read for ports*, *rubbish in the bag never throws*, *a call block that states no ports publishes
none*, *a name the host also mentions is one port*. A control that goes red for the wrong reason is
not a control.

The controls themselves, beyond the reverts:

1. **Deleting one key reproduces the finding on demand**, generated code and all: the program still
   emits `Outputs["total"]` and the port list goes back to `[]`. That is the measurement the task
   was filed on, pinned as a test that must never go green.
2. **Two definitions with different bodies give their call blocks different ports.** If the ports
   were inferred from the block type, the params, or anything but the body, these would be equal.
3. **A saved block with no ports in its body gives its host none** — the writer can say "none",
   so the positive tests are not measuring a constant.
4. **With no definition source injected, an old call block stays silent rather than guessing** —
   the repair is a lookup, not a fabrication.
5. **A row that survives partial rubbish still lands** — the validator is filtering, not refusing
   everything, which the rubbish control alone would not distinguish.
6. **A self-referential `defId` cannot make port detection recurse**, because the reader follows no
   definition edge at all.

---

## What is proved, and what is owed

| Claim | Status |
|---|---|
| Placing a call block gives the host the definition's output port | ✅ spec + real artefact |
| Every `Outputs["…"]` the generated program writes has a port | ✅ spec compares the two sides |
| Declared types travel (`number` stays `number`, undeclared stays `*`) | ✅ spec + real artefact |
| Inputs and signals travel, on the correct side and as the correct kind | ✅ runtime spec |
| Nested definitions carry their ports transitively | ✅ spec |
| Reserved names are still filtered before reaching the canvas | ✅ runtime spec, `updatePorts`' own filter |
| No port for a definition's internal Blockly variables | ✅ spec (this half always held) |
| An old call block on disk is repaired from the live shelf on load | ✅ spec + real artefact |
| The rails and the bench show the same ports | ✅ **DRIVEN (session C)** — the OUTPUTS rail read `result number 3` beside `total any 21`, a bench-run value through a published port |
| The port appears on the canvas | ✅ **DRIVEN (session C)** — after a flush the node's outputs gained `result`, typed `number` (before: `total` only, `hasResult: false`) |
| The port **accepts a wire** | 🔴 **owed — needs a real drag on the canvas** |

### Owed — **updated after DRIVE-2026-08-13-C**

⚠️ Item 1 is closed and item 3 with it. **Items 2 and 4 remain.**

1. ✅ **CLOSED — driven.** Opened the fixture, nudged a block in `/ErgCodes`'s Visual Function to
   force a flush, and the `result` output appeared on the node. **The migrate path works**: before
   the flush the node's outputs were `total` only with `hasResult: false` — a correct reading, and
   worth having taken, because it is what makes the after-state mean something.
   🔴 **Only the migrate path.** That the port **accepts a connection** was not tested; the chain
   past `sendDynamicPorts` — the canvas and the connection popup — is where a dynamic port has
   surprised this repo before.
2. 🔴 **OWED — drag a saved block out of the flyout into a *second* Visual Function** and confirm
   the port appears immediately, with no reopen, **and takes a wire**. That is the reported gesture,
   verbatim, and it is the half a migrate can never stand in for.
3. ✅ **CLOSED — the rails and the bench agree with the node.** They read the same traversal, so they
   should; "should" is not a measurement, and the measurement was taken: `result number 3` in the
   OUTPUTS rail in the same frame the node carried the port.
4. 🔴 **The regeneration sweep — LGC-007 §4, and it belongs with VFN-009.** Editing a definition
   should re-stamp and re-flush every call site, not wait for the next incidental edit. This is the
   remaining staleness, it is bounded and it is the same one `label`/`args` have, but VFN-009 is
   about to make definition editing a first-class gesture and that is the moment it starts to bite.
   ⚠️ Editing `args` is destructive (it rebuilds the block's sockets and can drop a plugged
   argument); editing `ports` is not. A sweep should treat them differently.

---

## ⚠️ Coordination — what this branch touched, for the merge

Deliberately **did not touch** `myblocks/store.ts`, `MyBlocksShelves.ts` or `myblocks/format.ts`,
all of which VFN-009 is working in. No new field was added to `MyBlockDefinition`: the ports are
derived from `body` at the call site, so the definition format is unchanged and the two branches do
not meet in it.

Changed:

- `packages/noodl-runtime/src/nodes/std-library/logic-builder-io.ts` — the reader, the two call
  block type ids, `CALL_PORTS_STATE_KEY`, and the design argument in full.
- `packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/references.ts` — ⚠️ **the two
  call block type constants now come from the runtime and are re-exported**, for `HAT_BLOCK_TYPE`'s
  reason. Nothing else changed, and every existing importer is unaffected. **This is the one file a
  sibling branch might also be in.**
- `packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksBlocks.ts` — `CallBlockState.ports`,
  `portsOfDefinition`, the `callBlockJson` stamp, the `loadExtraState` re-derivation.
- `packages/noodl-editor/tests-unit/vfn-008/self-describing-block.test.ts` — criterion 4 turned
  around, plus its controls.
- `packages/noodl-runtime/test/logic-builder-call-ports.test.ts` — new.

---

## Where the filed writeup was wrong

1. **VFN-008's criterion 4 was right after all, for a reason nobody had.** The task file said
   *"Ports: yes, automatically, and not by 'porting' anything"* and the finding overturned it. The
   finding was correct about the code as it stood; the criterion was correct about what the feature
   owes a builder. It is now true, and it is true *without* a copy step or a second store, which is
   what the original paragraph was actually claiming.
2. **The finding understated the blast radius.** It named `updatePorts` only. The interface rails
   (LGC-004) and the bench (VFN-011) read `detectInterface`, the sibling projection of the same
   traversal, and were equally blind. Both are fixed by the same change, and neither was mentioned.
3. **"`detectIO` … has no access to the definition shelves"** is right about the backpack and
   *not* right about the project shelf, which does reach the viewer through
   `GraphModel.setSettings`. The route was still wrong, but for the asymmetry rather than for
   impossibility, and the difference matters because "impossible" would have closed the question
   without anyone checking which shelf the reported block was on. It was the backpack.
4. **"That is a design decision, not a patch"** was right, and the design turned out to be smaller
   than either filed route: the answer was a third option — the call site states its own signature —
   which neither `NOTES-saveblock.md` nor the task file considered.

## ⚠️ Two housekeeping observations, neither mine

- `packages/noodl-runtime/test/editorconnection.replyidentity.test.ts` **fails to run** on this
  branch and on `cline-dev` — `TS2451: Cannot redeclare block-scoped variable 'EditorConnection'`,
  shared with `editorconnection.sendqueue.test.ts`. Pre-existing, in files this branch does not
  touch, and it is a suite failing *to run*, which counts as a failure and does not look like one.
- `git stash list` on this checkout reports **`stash@{0}`, from `ff74bcc9`** — an old entry, not
  created here. The register says never to `git stash` on this checkout because a `pop` crashes the
  editor a human is using. Flagged, not touched.
