# NDA-016: `Layout.size` has no branch for an unset `sizeMode`

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-016 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — affects every visual node, and the workaround ("toggle it and toggle it back") is folklore |
| **Difficulty** | 🟢 Low to fix, 🟠 Medium to finish diagnosing |
| **Estimated Time** | 1 week, plus §0 |
| **Prerequisites** | **§0 is blocking.** Needs the running editor |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** for §0, 🟢 **Sonnet 5** for §1 |

## Objective

Make an unset `sizeMode` behave like its declared default, so a Text node laid out beside another
behaves the same before and after someone touches Size Mode.

## The report

Richard: "the text node starts off as being responsive width, but if you add two text nodes side by
side the first one will take up 100% of the width, unless you change to fixed width and back to
responsive, then it works."

## The mechanism (confirmed)

[`layout.ts:60-67`](../../../packages/noodl-viewer-react/src/layout.ts#L60-L67) is the whole of size
resolution:

```ts
if (props.sizeMode === 'explicit')           { style.width = props.width; style.height = props.height; }
else if (props.sizeMode === 'contentHeight') { style.width = props.width; }
else if (props.sizeMode === 'contentWidth')  { style.height = props.height; }
// no else
```

**There is no `else`.** With `sizeMode` unset, `style.width` is never assigned from `props.width`, so
it keeps whatever `defaultCss` gave it — for Text, `width: 'auto'`
([`text.ts:30-33`](../../../packages/noodl-viewer-react/src/nodes/visual/text.ts#L30-L33), which
carries a `// FIX:` comment of its own).

Then [`layout.ts:69`](../../../packages/noodl-viewer-react/src/layout.ts#L69) sets `flexShrink = 0`
unconditionally, and the percentage → `flexGrow` conversion at
[`layout.ts:71-75`](../../../packages/noodl-viewer-react/src/layout.ts#L71-L75) is gated on
`isPercentage(style.width)` — which `'auto'` is not. So the node becomes non-growing **and**
non-shrinking: the first one takes the row.

Setting Size Mode explicitly and back writes a real value to the port, the branch runs, `width` becomes
`'100%'`, `flexGrow` applies, and the two share. That is the folklore workaround, explained.

This is defect class A2 — undefined behaving differently from an explicit value — in the layout engine.

## §0 — Resolve the contradiction (blocking)

`sizeMode` is declared with `default: 'contentHeight'`
([`node-shared-port-definitions.ts:638-653`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L638-L653))
and inputProp defaults **are** copied into props at
[`react-component-node.ts:823-841`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L823-L841).

On that reading `props.sizeMode` should already be `'contentHeight'` and the symptom should not occur.
Something between the two drops it. Candidates:

1. `width`/`height` are registered via `addDynamicInputPorts`
   ([`node-shared-port-definitions.ts:634-635`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L634-L635))
   — dynamic ports may not receive defaults on the same path as static ones.
2. Port registration order: if `sizeMode`'s default is applied before `width`'s, the first render may
   read a `props.width` that is not there yet.
3. The editor may write the parameter into `project.json` only on first edit, so a freshly-created
   node differs from a saved-and-reloaded one. **This would exactly match "add two, the first is
   wrong; touch it, it's right"** and is the leading hypothesis.
4. `onChange` for `width` sets `props.fixedWidth`
   ([`:666-668`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L666-L668))
   and only fires on change, so `fixedWidth` is `undefined` initially — check it is not being read as
   meaningful anywhere.

Reproduce in the running editor with two Text nodes in a row Group, and read the actual props at first
render. ⚠️ `--target=editor` attaches to the preview window; use `--target=dashboard`.

**Do not skip §0.** The `else` fix below is correct regardless, but if hypothesis 3 is right there is a
second defect in the editor's parameter persistence that the `else` would merely mask — and masking it
would make every future "it works after you touch it" bug harder to find.

## §1 — Add the `else` (correct regardless of §0)

An unset `sizeMode` must behave as the node's declared default rather than falling through to
whatever `defaultCss` left behind. Prefer resolving the default at the call site — `Layout.size`
should not have to know each node's default — but the fallthrough must not remain silent.

While in the file: `flexShrink = 0` unconditionally at
[`layout.ts:69`](../../../packages/noodl-viewer-react/src/layout.ts#L69), overwritten to `1` only on
the percentage path, is worth a comment explaining why "never shrink unless told" is the right default.
It is load-bearing for the whole layout model and reads like an accident.

## Scope

`Layout.size` is shared by **every visual node** (29 in the Visual category alone). That makes this a
one-file fix with a 29-node blast radius — the screenshot corpus is the safety net, and this task
cannot land without a clean run of it in both themes.

## Success criteria

1. §0 has an answer, cited, before §1 lands.
2. Two Text nodes in a row Group share the width on first render, with no interaction.
3. Same for the other visual nodes that rely on a non-`explicit` default.
4. Screenshot corpus clean in both themes — this is the acceptance test, not jest.
5. If §0 finds an editor persistence defect, it is filed as its own task rather than absorbed here.
