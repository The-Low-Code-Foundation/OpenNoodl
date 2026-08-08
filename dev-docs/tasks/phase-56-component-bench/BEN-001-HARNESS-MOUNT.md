# BEN-001 — The harness: mount one component *with its inputs set*

**Status:** 🟡 **mechanism built** (2026-08-08) — [`componentBench.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/componentBench.ts),
specs in [`tests/ai/component-bench.test.ts`](../../../packages/noodl-editor/tests/ai/component-bench.test.ts).
The two **Live** criteria below are unmet and stay unmet until BEN-004 gives it a surface to render on;
§3's Group wrapper was deliberately not built — see register **B3**. · ⭐ prerequisite for the phase

## The evidence

`buildSandboxExport` already mounts a single component as the runtime's root:

```ts
json.rootComponent = legacyName;
json.rootNode = root.id;
```
— [sandboxExport.ts:198-199](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/sandboxExport.ts#L198-L199)

So "preview one component" is solved. What is not solved is that **a root component has no parent,
and a `Component Inputs` port is fed by its parent.** Every declared input sits at `undefined` for
the entire life of the preview. A card previews as its empty state; a list previews as zero rows.
There is no code path today by which a human or an agent can say "render it with `title = "Hello"`".

## The mechanism

**A synthetic harness component**, built in memory, spliced in exactly the way candidates already
are:

- harness component: one node, of type `<target legacyName>` (a project component is instantiated by
  its legacy name — the same convention `componentClosure` relies on at
  [sandboxExport.ts:118-120](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/sandboxExport.ts#L118-L120));
- that node's `parameters` = the static input values;
- `rootComponent` = the harness, `rootNode` = the instance node id.

The runtime then feeds the instance exactly as a page would. No runtime change, no new protocol
message, no `ProjectModel` write. The existing splice does the rest.

⚠️ **A component input port is declared `plug: 'output'`** ([componentmodel.ts:179](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L179))
— it is an output *of the Component Inputs node*, which is an input *of the instance*. Phase 55 F8
and F23 are both this inversion, and both shipped. Setting values as instance `parameters` is the
right side of it; do not "fix" the plug on the way past.

⚠️ **A component instance carries zero built-in ports** (LAS-001). Every parameter the harness sets
must name a real declared input, or it is the exact defect `unknown-instance-parameter` blocks. The
harness must therefore build its parameter set *from the interface*, never from a caller's free-form
object without checking.

## Build

### 1. `componentBench.ts` — a new module beside `sandboxExport.ts`

Shared substrate, per the standing constraint. Exports:

```ts
interface BenchMount {
  /** The component to mount, by legacy name, from the live project. */
  target: string;
  /** Input values, keyed by declared input port name. */
  inputs?: Record<string, unknown>;
  /** Frame the harness renders into. Omitted = the component's natural size. */
  frame?: { width?: number; height?: number };
  /** Whether the harness stretches its child. Default false. */
  stretch?: boolean;
}

function buildBenchExport(opts: { project: ProjectModel } & BenchMount): SandboxExport;
```

Return type is deliberately the existing `SandboxExport` — `{ json?, unrenderable?, summary?,
notice? }` — so the surfaces already written for it (empty state, toolbar summary, notice chip) work
unchanged.

Reuse, do not fork: `componentClosure`, `buildSandboxDataset`, `unknownShapeNotice` and the
`Exporter.getRouterIndex` re-derivation all apply identically. The only new code is the harness
component and the parameter set.

### 2. Interface-driven parameters

Read the target's inputs via `ComponentModel.getPorts()` filtered to `plug === 'output'`
([componentmodel.ts:91](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L91)),
cross-checked against `validation/componentInterface.ts` where a declared interface exists (it is the
better source — `getPorts` derives type from connections and returns `'*'` for an unconnected input).

Then:

- an input present in `inputs` → set as a parameter;
- an input absent from `inputs` but carrying a derived `default` → set to the default, so a component
  previews the way it would in a page that leaves the port unwired;
- a key in `inputs` naming no declared input → **dropped, and named in `summary`**. Silence here
  reproduces the phase-55 F2 defect inside the tool built to expose it.

### 3. The frame

The harness's root can be the instance directly (natural size) or the instance inside a Group sized
to `frame`. Prefer the Group only when `frame` is set — an unnecessary wrapper changes layout.

⚠️ `sizeMode` silently voids width/height. If the Group route is taken, set the size the way the
runtime actually reads it, and **measure the rendered DOM to prove the frame is the width you asked
for** — do not infer it from the parameters you set.

⚠️ An unsized absolute Group fills its parent (phase-55 F7). The harness must not be the thing that
makes a correctly-built component look broken.

### 4. Logic-only components are not `unrenderable` here

`buildSandboxExport` returns `unrenderable` when there is no visual root, which is right for a review
document. On the bench it is wrong: a logic-only component is exactly what the outputs read-out
(BEN-003) exists to show. Return a `json` that mounts it anyway, with `summary` saying there is
nothing visual and pointing at the outputs rail. Keep `unrenderable` as a field so the AI preview's
behaviour does not change.

## Acceptance

- [ ] Unit spec: `buildBenchExport` on a component with three declared inputs produces an export
      whose root node's `parameters` carry all three values, whose `rootComponent` is the harness,
      and whose component list contains the harness plus the target's closure.
- [ ] Unit spec: a key naming an undeclared input is dropped and reported in `summary`.
- [ ] Unit spec: an unset input with a derived default gets the default.
- [ ] Unit spec: `ProjectModel` is unchanged after a build — no component added, nothing dirty.
- [ ] **Live:** a real component mounted through the bench renders its input values in the DOM.
      Evidence is the read DOM or a screenshot, not the export JSON.
- [ ] **Live:** frame width set to 320 measures 320 in the rendered document.

## Risks

| Risk | Mitigation |
|---|---|
| The harness component's name collides with a project component | Prefix it out of the user namespace and assert the collision case in a spec |
| A target that instantiates itself, directly or transitively | `componentClosure` already caps at `MAX_CLOSURE_DEPTH = 4`; add a spec so a self-referencing component fails as a message, not a hang |
| Bench and AI preview drift apart | One module, both callers. If a change only helps one, it is in the wrong file |
