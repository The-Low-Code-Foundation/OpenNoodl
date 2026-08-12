# FUN-002 — Never a blank page

**Status:** 📋 open · **Track: the first thirty seconds** · depends on FUN-001 §3 for the string ·
**cheapest task in the phase**

## What happens today

`functionScript` declares **no `default`**
([`simplejavascript.ts:161-206`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)
— the block runs from the `displayName` to the `set()` with no `default` key). `nodeDoubleClickAction`
is `{ focusPort: 'Script' }` at [`:91-93`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts),
so **double-clicking a fresh Function node opens an empty editor** — which is the single most common
way anyone meets this node.

A blank page asks a beginner to recall a notation. They cannot recall one they have never seen, so
they write the JavaScript they know. That is exactly what the originating observation shows.

## The change, in one sentence

A newly created Function node arrives with **a body that already works**, and therefore with two
ports already on it.

```js
// Read an input with Inputs.Name, write an output with Outputs.Name.
// Renaming them here renames the ports on the node.
Outputs.Result = Inputs.Value;
```

> 🔴 **The body above is wrong and must not be used. It mints FOUR ports, not two** — FUN-001 **F5**,
> measured against `parseAndAddPortsFromScript` on 2026-08-12.
>
> The runtime's comment-stripping line is commented out, so **comments are mined**. `Inputs.Name` and
> `Outputs.Name` in that first line mint an input `Name` and an output `Name` beside `Value` and
> `Result` — two extra ports that do nothing, on the very node whose job is to demonstrate that ports
> come from the code. The phase's exit test says *"with two ports on the node to prove it"*.
>
> **Import `SEED_FUNCTION_BODY` from
> [`code-editor/utils/notation.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/notation.ts)**
> — do not retype the string, and do not "restore" the specced comment. What ships states the same
> rule without spelling either prefix followed by a name, and is asserted to mine exactly
> `input:Value` / `output:Result`:
>
> ```js
> // The ports come from this code: rename Value or Result and the node follows.
> Outputs.Result = Inputs.Value;
> ```
>
> Everything else in this task — §1's *not a `default`*, §2's fires-exactly-once — is unaffected and
> still governs.

Three things happen at once, and the third is why this is the highest-leverage line in the phase:

1. There is something to imitate.
2. The node **works** before anything is typed — wire it up and a value comes out the other side.
3. `parseAndAddPortsFromScript` mines `Inputs.Value` and `Outputs.Result` and puts **two visible
   ports on the node** ([`javascriptnodeparser.js:294-387`](../../../packages/noodl-runtime/src/javascriptnodeparser.js)).
   The user sees, without being told, that *the code is where ports come from* — the inversion this
   whole phase exists to fix, demonstrated rather than explained.

## §1 — ⚠️ Not a runtime `default`

The obvious implementation is `default: SEED` on the `functionScript` port. **Do not.** Two reasons,
and the first is this repo's most-repeated node-library trap:

- **A declared `default` never runs its setter.** The value would display in the editor while
  `this._internal.func` stayed `undefined` until the first edit, so the seeded node would *look*
  complete and do nothing on `Run` — a worse first experience than the blank page.
- A `default` is not a parameter. `CodeEditorType.save()` writes `undefined` when the value equals
  the default ([`CodeEditorType.ts:164`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts)),
  so a user who deliberately empties the node and one who never touched it are indistinguishable,
  and the seed would keep coming back.

**Seed as a real parameter write at node-creation time in the editor**, so it is:

- a normal undoable edit — one ⌘Z removes it, which is the correct escape hatch for an expert;
- genuinely deleted when deleted;
- compiled through the ordinary `set()` path, so the node is live immediately.

## §2 — Fires exactly once, on creation

⚠️ The failure mode to design against is a seed that reappears. Conditions, all of them:

- the node was **just created** (not loaded from disk, not pasted, not imported, not duplicated);
- `functionScript` is unset;
- the node type is `JavaScriptFunction`.

A node loaded from a project file must never be touched, or opening an old project rewrites every
emptied Function node in it — and `.noodl`/`project.json` writes are the kind of damage that is
noticed a week later.

**Duplicate and paste are deliberately excluded**: they copy a body the user already has, and seeding
over it would destroy work.

## §3 — What the seed says, exactly

Owned by FUN-001 §3 and imported, not retyped. Constraints on the string:

- **Three lines maximum.** A twenty-line commented template is the old Script node's `defaultCode`,
  preserved in comments at the top of
  [`javascript.ts:15-60`](../../../packages/noodl-viewer-react/src/nodes/std-library/javascript.ts),
  and it is a wall of syntax a beginner scrolls past.
- **The working line is not a comment.** A commented-out example creates no ports and does nothing
  when run, which forfeits points 2 and 3 above entirely.
- Port names are generic and obviously renameable — `Value` / `Result`, not `Input_1` / `Output_1`,
  because a name that looks auto-generated invites being left alone.
- ⚠️ It must not mention `Noodl.Inputs`, per FUN-001 §2.

## §4 — The Script node and the Expression node

- **Script** (`Javascript2`, [`javascript.ts:159-162`](../../../packages/noodl-viewer-react/src/nodes/std-library/javascript.ts))
  has `const defaultCode = ''` at `:156` — the same blank page, with a more complicated body shape
  (`Node.Signals.X`). It gets the same treatment, with its own seed. **Not in scope here**; filed as
  a follow-on so this task stays one node and one string.
- **Expression** is deliberately excluded. Its rule is the opposite one and a seed would be wrong
  there — see FUN-009.

## Acceptance

- Dropping a Function node on the canvas and double-clicking it shows a three-line body, **not an
  empty editor**.
- That node, wired input to output with nothing else done, **passes a value through when run**.
- The node shows **two ports** on the canvas immediately, before the editor has been opened.
- One ⌘Z after creation removes the seed and leaves the node empty; it does not come back.
- ⚠️ Opening an existing project that contains a Function node with an empty script leaves it empty,
  and the project file is **byte-identical after open-and-close**. This is the check most likely to
  be skipped and the one with the worst failure.
- Duplicating and pasting a Function node preserves its body verbatim.
- The seed string is imported from FUN-001's module; grep finds no second copy.

## Register

| # | Finding | State |
|---|---|---|
| F5 | `functionScript` has **no `default`**, so the first encounter with the node is a blank page | ✅ verified, `simplejavascript.ts:161-206` |
| F6 | A declared `default` **never runs its setter** — the seed must be a real parameter write, not a port default | ✅ known trap, re-confirmed by the setter's structure |
| F7 | `CodeEditorType.save()` writes `undefined` when the value equals the default, so a defaulted seed is un-deletable | ✅ verified, `CodeEditorType.ts:164` |
| F8 | The old Script node's twenty-line commented template still sits in `javascript.ts:15-60` as dead comments — evidence of what to not do again | ✅ verified |

## The drive, as run — 2026-08-12, primary checkout

Driven over CDP against a copy of a real project. **6 of 7 criteria pass.**

| Criterion | Measured | |
|---|---|---|
| Three-line body on open, not an empty editor | popout rendered **3 `.cm-line`s**, the seed verbatim | ✅ |
| **Passes a value through when run** | String `FUN002-VALUE-OK` → `in-Value` → seeded body → `out-Result` → Text. **Rendered to the DOM**, read off a full disk render (`measure-from-disk.js`), not the editor | ✅ |
| Two ports before the editor is opened | `in-Value`, `out-Result` | ✅ ⚠️ see note |
| One ⌘Z removes the seed, node survives, stays gone | real ⌘Z keystroke: `functionScript` gone, node alive, mined ports gone with it, still gone 6 s later | ✅ |
| Duplicate/paste preserves the body verbatim | pasted copy byte-equal to `SEED_FUNCTION_BODY` | ✅ |
| …and an **emptied** node is not re-seeded on paste | both copies `hasScript: false` — §2's exclusion holds | ✅ |
| Seed imported from FUN-001, no second copy | one occurrence repo-wide | ✅ |
| ⚠️ **Byte-identical open-and-close** | **NOT CLOSED** — see below | ⏳ |

⚠️ **"Two ports immediately" is true but not synchronous.** Read in the same tick as
`createNewNode`, the node has **no** mined ports; they appear after a sub-second round-trip to the
runtime. Not user-perceptible, and not a defect — but a spec that asserts it in the creating tick
will fail.

### 🔴 The byte-identical criterion cannot be measured as written

Opening a project **rewrites every component on disk** — `component.json` and `nodes.json` for all of
them, plus `_registry.json` and `nodegx.project.json`. So "the project file is byte-identical after
open-and-close" is false for every project, seeded or not, and has nothing to do with this task.

**Restate it as the thing it is actually protecting**, which is still exactly worth testing:

1. open the fixture once and let the editor normalise it — **that** is the baseline;
2. close, open again, close;
3. the two normalised states must be byte-identical, **and** the Function node's `functionScript`
   must still be absent.

The risk the criterion exists for — a node loaded from disk getting seeded — is the second clause.
It was **not driven this session**: it needs a project switch, which needs an editor restart.
The related exclusion *was* measured: **paste does not re-seed an emptied node**, which exercises the
same "not just created" gate from the other side.

⚠️ Mechanical note for whoever runs it: `ed.createNewNode` leaves `ed.highlighted` set, so nodes
created in sequence get **parented under the previously selected node**. Three of mine landed as
children of a `Router` and rendered nothing at all (`node-not-child`), which looks exactly like a
product bug and is not one. Set `ed.highlighted = null` between creations.
