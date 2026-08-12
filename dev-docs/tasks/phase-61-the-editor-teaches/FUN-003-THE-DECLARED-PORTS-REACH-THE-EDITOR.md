# FUN-003 — The declared ports reach the editor

**Status:** ✅ built 2026-08-12, branch `fun-003-lane` · **one acceptance criterion is unclosed and
needs a live drive** (see *What was verified, and what was not*) · **Track: the seam** ·
⭐ **structural — FUN-004, 005, 006, 007 and 008 all stand on it** · no user-visible change of its own

## The gap, stated precisely

The code editor knows the ports **you wrote**. It does not know the ports you **declared**.

`minePorts()` re-implements the runtime's six mining regexes client-side
([`scriptPorts.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/scriptPorts.ts)),
and its header states the design honestly: *"a Function node's ports come from its script text… The
document in the editor **is** the port list."*

**That is true for one of the two routes.** The node's own source says so at
[`simplejavascript.ts:701-705`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts):
inputs *"arrive by two routes — the proplist above and `parseAndAddPortsFromScript` reading `Inputs.x`
out of the script"*.

So the editor is blind to precisely the route the originating user took: they added ports in the
**property panel** (`scriptInputs` / `scriptOutputs`,
[`simplejavascript.ts:139-160`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts))
and never typed `Inputs.` at all. Every affordance that could have helped them — a completion, a
fix-it, a rail, a hint — needed a list the editor did not have.

## §1 — The shape of the fix

`CodeAuthoringContext` carries `libraries`, `variables`, `objects`, `arrays`
([`authoringContext.ts`](../../../packages/noodl-core-ui/src/components/code-editor/authoringContext.ts))
— all *project* facts. It needs one *node* fact:

```ts
/** The node whose code is open, as far as its own ports are concerned. */
readonly openNode?: {
  readonly nodeId: string;
  readonly typeName: string;
  /** Declared in the property panel. Display names, prefixes already stripped. */
  readonly declaredInputs: readonly PortFact[];
  readonly declaredOutputs: readonly PortFact[];
};
```

where a `PortFact` is at minimum `{ name, type }` — `type` because FUN-001's `writeExpression` needs
to know a signal from a value, and FUN-005's rail labels them differently.

**Declared only.** The mined set stays where it is; consumers union the two. Keeping them separate is
what lets FUN-004 say *"you declared this port and have not used it"* — a sentence that needs both
lists and is impossible from either alone.

## §2 — ⚠️ Why it is a registry field and not a prop, again

The instinct is to thread it through `JavaScriptEditor` as a prop. `authoringContext.ts` already
argues that case and lost it deliberately; the reasoning applies unchanged and is worth not
re-litigating:

1. **The popout mounts once.** The CodeMirror effect is `[]`-deps by design, so a prop cannot reach a
   live editor without a `Compartment` reconfigure.
2. **Completion sources are already functions called per keystroke.** Reading at call time cannot go
   stale.
3. **There are four call sites** — `CodeEditorType`, `ExpressionEditorModal`, `AiChat`,
   `GeneratedCodeModal` — one of which builds the editor through `React.createElement` with a literal
   props object. A registry makes them consistent by construction.

**One deliberate difference from the existing field.** Project context is pushed once at boot;
`openNode` is **per-open-editor** and must be cleared when the popout closes, or the next editor
opened over a different node completes against the previous node's ports. That is a live wrong
answer, not an empty one, and it is the defect this task is most likely to ship.

Set it in `CodeEditorType.onLaunchClicked` — which **already has `nodeId` in hand** at
[`:146`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts)
and currently passes it to `CodeHistoryStore` and nothing else — and clear it in the popout's
`onClose`, which is right there at `:239`.

## §3 — Where the declared list comes from

The node model's `parameters['scriptInputs']` / `['scriptOutputs']` are the proplists, typed as
`ScriptPortSpec[]` in [`simplejavascript.ts:139-160`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts).

> 🔴 **Corrected on build — see F12.** The paragraph below is wrong about *this* boundary: the
> prefix is on the assembled port list, not on the proplist row, and stripping a `label` renames a
> port that does not exist. The trap it describes is real and belongs to consumers that read a node's
> assembled ports.

⚠️ **Strip the `in-` / `out-` prefixes exactly once**, here, at the boundary. Downstream code sees
display names only. The port assembly at
[`:711-714`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) shows the
convention; a consumer that inserts `Inputs.in-Value` produces valid JavaScript that mints a port
called `in`. This is FUN-001 §1's trap and this task is where it is prevented.

## §4 — Modes that must see nothing

`openNode` is meaningful for `validationType` `'function'` and `'script'` only.

For `'expression'` it is **actively wrong**: an Expression's inputs are every identifier in the text
([`expression.ts:399`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts)), so
there is no declared/undeclared distinction to draw. For `'json'`, `'text'`, `'css'` and `'html'` the
editor is not holding code at all — those modes exist because the property panel reaches this editor
for a CSS Definition's `style` and Static Data's `csv`
([`types.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/types.ts)).

Consumers gate on mode. Do not gate by checking whether the list is empty — an empty list is also
what a Function node with no ports yet looks like, and FUN-006 needs to tell those two apart.

## Acceptance

- Opening a Function node's Script editor makes its **panel-declared** ports readable from
  `getCodeAuthoringContext()`, with prefixes stripped and types intact.
- Closing the popout clears it. **Open node A, close, open node B: B's editor never sees A's ports.**
  Drive this, do not reason about it.
- The four call sites are unmodified except `CodeEditorType`; `AiChat`, `ExpressionEditorModal` and
  `GeneratedCodeModal` inherit correct behaviour without being told.
- A port declared in the panel **and** used in the code appears in the declared list once, not twice,
  when unioned with `minePorts`.
- Unit tests stay DOM-free — core-ui's runner is `testEnvironment: 'node'` and
  `jest-environment-jsdom` is not in the tree (CED-001).
- No behaviour change is visible to a user. **This task ships dark**, and that is correct.

## Register

| # | Finding | State |
|---|---|---|
| F9 | `minePorts` sees only code-derived ports; the panel-declared ones are invisible to the editor — **the exact blind spot the originating user fell into** | ✅ verified, `scriptPorts.ts` header vs `simplejavascript.ts:701-705` |
| F10 | `CodeEditorType.onLaunchClicked` already holds `nodeId` and spends it only on code history | ✅ verified, `:146` |
| F11 | The registry field is per-editor, unlike the project field, and **must be cleared on close** or it answers with the previous node's ports | ✅ built; cleared in `dispose()`, which every close path runs through. Registry contract pinned by `tests/code-editor/authoringContext.test.ts`; **the live A→close→B drive is NOT run** — see below |
| F12 | 🔴 **§3's prefix instruction is wrong about this boundary, and following it would be a defect.** The `in-`/`out-` prefix lives on the *assembled port list* (`'in-' + p.label`), never on the proplist row. `label` is already the display name, so there is nothing here to strip — and stripping anyway would rename a row an author labelled `in-Value` (whose real port is `in-in-Value`, notation `Inputs["in-Value"]`) to a port that does not exist | ✅ verified in source; the trap is real but belongs to **any consumer that reads a node's assembled ports**, which is FUN-005's rail, not this seam |
| F13 | The **Script node applies no prefix at all** — `javascript.ts:800-822` names the port `p.label` directly, where the Function node names it `'in-' + p.label`. Both read the same `scriptInputs`/`scriptOutputs`/`intype-`/`outtype-` parameters | ✅ verified; one collector serves both modes, and a generic "strip `in-`" helper would corrupt an ordinary Script-node port |
| F14 | A **declared output can be typed `signal`** (`_outputTypeEnums = inputTypeEnums.concat([{value:'signal'}])`, `simplejavascript.ts:616-621`), which is why `PortFact.type` is not optional: `Outputs.Done()` and `Outputs.x = ` are different insertions | ✅ verified; carried and tested |
| F15 | 🔴 **One field on one object would have been a live defect.** `install.ts` republishes the project surface on a **400 ms debounce off `Model.parametersChanged`**, i.e. every few keystrokes in any property field — a single-slot registry would erase `openNode` while the editor was still open | ✅ found and designed around; two slots composed on write. Proved by mutation: reverting to one slot fails 3 specs |
| F16 | ⚠️ `ExpressionEditorModal`, `GeneratedCodeModal` and `AiChat` never write the slot, and are correct only because nothing can be open when they mount (`PopupLayer.hidePopout` fires `onClose` **synchronously**, and `onLaunchClicked` calls `hidePopout()` before publishing). Not asserted anywhere | ⚠️ residual; re-check when the first consumer lands, and gate every consumer on `validationType` rather than on `openNode` being present |

## What was verified, and what was not

Built in the worktree `../OpenNoodl-worktrees/fun-003-lane`, branch `fun-003-lane`.

| Acceptance criterion | State |
|---|---|
| Panel-declared ports readable from `getCodeAuthoringContext()`, types intact | ✅ unit-tested (`declaredPorts.test.ts`, `authoringContext.test.ts`) |
| "prefixes stripped" | ✅ **restated** — see F12. There is no prefix at this boundary; a test pins that nothing is stripped |
| Closing clears it — **open A, close, open B** | ⚠️ **NOT DRIVEN.** The registry half is pinned headlessly; the editor half (`dispose()` runs on every close path) is **reasoned, not measured**. `lerna exec` resolves to the primary checkout from a worktree, so no editor could be launched here. **Drive recipe below; this is the phase lead's to run after merge** |
| Only `CodeEditorType` modified of the four call sites | ✅ verified by diff |
| Declared + used appears once when unioned with `minePorts` | ✅ unit-tested against the real `minePorts` |
| Unit tests DOM-free | ✅ 203 specs pass under `testEnvironment: 'node'` |
| Ships dark | ✅ nothing renders; no UI added |

### The drive recipe for the criterion a worktree cannot close

In the **primary** checkout, after merge:

1. `npm run dev:stop -- --list` first, then start the editor and open a real project (a copy, not the example).
2. Add two Function nodes. On **node A**, add `scriptInputs` rows `Alpha` and `Beta` in the property panel; set `intype-Alpha` to `number`. Add a `scriptOutputs` row `Gamma`, typed `signal`. Add **no** rows on **node B**; give it a `scriptOutputs` row `Delta` instead.
3. Double-click node A (which focuses its `Script` port) to open the code popout. Over CDP, evaluate:
   `require('@noodl-core-ui/components/code-editor').getCodeAuthoringContext().openNode`
   — or, if the module is not reachable from the renderer console, add a temporary `window.__openNode = …` probe. Expect
   `{ nodeId: <A>, typeName: 'JavaScriptFunction', declaredInputs: [{name:'Alpha',type:'number'},{name:'Beta',type:'string'}], declaredOutputs: [{name:'Gamma',type:'signal'}] }`.
   ⚠️ Assert on the **types**, not just the names — a default of `'string'`/`'*'` leaking over a chosen type is the silent half.
4. Click the canvas to close the popout. Re-read: `openNode` must be `undefined`. **This is the assertion that matters**; a stale object here is the shipped defect.
5. Double-click node B. Re-read: `declaredOutputs` must be `[{name:'Delta',type:'*'}]` and `declaredInputs` `[]`. **`Alpha`/`Beta`/`Gamma` must not appear.**
6. Now the mode gate: with node B's popout closed, open a **CSS Definition**'s `style` port, and separately an **Expression** node's expression. `openNode` must be `undefined` in both — not node B's, and not an empty object.
7. Finally, leave node A's popout open and type into an unrelated property field on another node (this triggers the 400 ms project republish). `openNode` must still be node A's. That is F15, measured rather than argued.
