# BEN-002 — The inputs rail, and changing a value without a reload

**Status:** 📋 not started · ⭐ · depends on **BEN-001**

## The evidence

The schema for this form already exists and nobody has ever rendered it as a form.
`ComponentModel.getPorts()` returns, for every component port:

```ts
{ name, type, default, group, plug, index }
```
— [componentmodel.ts:167-198](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L167-L198)

> ⚠️ **CORRECTION, 2026-08-08.** The next sentence is wrong about which end it is
> describing. On a port **declared** on a `Component Inputs` node, `plug: 'output'`
> means a component input (LAS-001). But `getPorts()` — the function this section
> is about — **republishes** it as `plug: 'input'`. The rail must filter
> `getPorts()` on `plug === 'input'`; see BEN-001's correction and register **B5**.
> Use `benchInterface()` from `componentBench.ts`, which already does this and is
> the only place in the phase that should have to know.

`plug: 'output'` means an **input** of the component (the inversion; see BEN-001). `group` is already
populated and already used by the component ports panel, so the rail gets grouping for free.

**The honest limitation, read in source:** `type` is derived from connections
([`_deriveType`](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L136)), and
`default` only when there is exactly one connection. An input wired to nothing returns `type: '*'`
and no default. On the corpus that is common, so degradation is the normal path, not the edge case.
`validation/componentInterface.ts` is the better source where a declared interface exists — prefer
it, fall back to `getPorts`.

## The problem that decides the design

**Rebuilding the export on every keystroke is not an option.** A changed export makes the runtime
call `location.reload()` — that is precisely why `lastExports[clientId]` has to be cleared for
sandbox clients ([ViewerConnection.ts:577-581](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L577-L581)).
A reload throws away every bit of state the user clicked into: the open dropdown, the typed text, the
hovered state they were inspecting. Typing "Hello" into a title field would flash the preview five
times and lose the thing they were looking at.

The runtime already has the right message for this — `modelUpdate` / `parameterChanged`
([:827-843](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L827-L843)) — which is
how editing a node property updates the live preview without a reload.

⚠️ **But `modelUpdate` is broadcast.** Unlike `export`, the send carries no `target` and the runtime
does no clientId matching for it. A synthetic `parameterChanged` for the harness would also reach the
app preview, naming a component that does not exist in its export.

**Decide this first, and record the decision in the phase register (B2).** Two options:

1. **Add client targeting to `modelUpdate`** — mirror the self-filtering `getPortValues` and the
   trace commands already use (`content.clientId`, matched by the runtime against its own). Touches
   the runtime, benefits every future per-client update, and is the honest fix.
2. **Debounce and reload** — cheap, no runtime change, and visibly worse. Acceptable only as a first
   slice, and only if BEN-007 records the flicker as a known issue.

Recommendation: **option 1**, sliced as its own commit with a spec, before the form is written.
Verify the consequence: send a targeted update and confirm the *app* preview did not receive it.

## Build

### 1. The control mapping

| Port type | Control |
|---|---|
| `string` | text field. ⚠️ a text input commits on **blur/Enter only** — do not rely on `input` events when driving it in QA |
| `number` | number field / stepper |
| `boolean` | toggle |
| `color` | the existing token picker. Emit `var(--token)`, never raw hex — the design-token rule holds inside the bench |
| enum / `stringlist` | select. ⚠️ a property-panel select opened by `.click()` never closes (portalled options) — relevant to BEN-007's driver, not to the code |
| `object`, `array` | small JSON editor, with a "generate sample" button wired to the same inference BEN-006 exposes |
| `*` (underived) | raw text field, with the value parsed as JSON when it parses and passed as a string when it does not. Label it as untyped — the user should know the bench is guessing, and that a wire would fix it |
| signal | a **button** that fires the signal. This is the input half of "see how it works" |

Use the UIX-003 control kit; do not hand-roll inputs. `muted` is not a control variant
(`muted-button-was-never-a-control`).

### 2. The rail

- Grouped by the port `group` when present, flat otherwise; ordered by `index`, as `getPorts` already
  sorts.
- A **Reset** per input (back to the derived default) and for the whole set.
- An empty state that is useful rather than blank: *"This component declares no inputs. Add a
  `Component Inputs` node to make it configurable."* — with the count of instances in the project
  that pass parameters, if any, because that is the LAS-001 defect and this is where it becomes
  visible to a human.

### 3. State ownership

Input values are **preview state, never project state** (R5) until BEN-005 saves them. Nothing here
calls `setMetaData`, nothing dirties the project, and closing the bench discards. This is the rule
`signedIn` already follows and the comment at [SandboxPreview.tsx:95-101](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L95-L101)
is the precedent to copy.

## Acceptance

- [ ] Spec: the rail renders one control per declared input, of the mapped kind, grouped and ordered.
- [ ] Spec: an underived (`'*'`) input renders the raw field and is labelled untyped.
- [ ] Spec: nothing in the form path calls `setMetaData` or marks the project dirty.
- [ ] **Live:** typing a value changes the rendered DOM **without the preview reloading** — proven by
      leaving an unrelated element in a hovered/typed state across the change and finding it intact.
- [ ] **Live (option 1 only):** the app preview client does not receive the bench's parameter update.
- [ ] **Live:** a signal input's button visibly does something in the component.

## Risks

| Risk | Mitigation |
|---|---|
| Client targeting on `modelUpdate` changes behaviour for existing clients | Default to broadcast when no clientId is present; add a spec pinning that the app preview still receives ordinary edits |
| A value type the runtime coerces (the `NaNpx` class of defect) | Phase 55 already found a `var()` token on a coercing port becoming `"NaNpx"` and the property being **deleted**. Measure the DOM after setting a token-valued input, do not trust the parameter |
| The form makes the untyped case look authoritative | Label it. A guess presented as a type is how the bench starts lying |
