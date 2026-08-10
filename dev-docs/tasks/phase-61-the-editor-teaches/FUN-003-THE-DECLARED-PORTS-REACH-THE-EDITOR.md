# FUN-003 — The declared ports reach the editor

**Status:** 📋 open · **Track: the seam** · ⭐ **structural — FUN-004, 005, 006, 007 and 008 all
stand on it** · no user-visible change of its own

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
| F11 | The registry field is per-editor, unlike the project field, and **must be cleared on close** or it answers with the previous node's ports | ⚠️ ours to design; the phase's most likely shipped defect |
