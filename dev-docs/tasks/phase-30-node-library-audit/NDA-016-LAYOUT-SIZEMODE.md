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

## §0 — RESOLVED 2026-07-29. The premise above is wrong; the real cause is below

**`sizeMode` is never unset.** Read live from a freshly created, never-touched Text node in the
running preview (via its `noodlNode` handle off the React fiber): `props.sizeMode` is
`'contentHeight'` and `props.width` is `'100%'`, exactly as declared. Confirmed across the whole
visual set — 15 node types placed with **no parameters at all**, every one carrying its own
declared `defaultSizeMode` (`explicit`, `contentHeight` or `contentSize`). None of the four
hypotheses above holds: the defaults are copied in `initialize` (`react-component-node.ts:823-841`)
and nothing between drops them. A project loaded from disk with two Text nodes in a row Group
renders 160 + 160 in a 320px row on first paint, with no interaction.

**The reported symptom is a different defect, in a different file.** Children do not read the
parent's layout as a live value — they bake it in. `render`'s `noodlNodeAsProp` block
([`react-component-node.ts:639-642`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L639-L642))
copies `parent.props.layout` into the child's `parentLayout` prop *when the child renders*, and
[`renderChildren`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L1203-L1221)
memoises the elements built from it in `cachedChildren`. `Group`'s Layout setter wrote
`props.layout` and called `forceUpdate()`, which re-renders the Group **and hands React back the
same child elements** — so the children keep laying themselves out for the layout the parent has
just left. The memo is invalidated on `addChild`/`removeChild`/`_resetReactVirtualDOM` and nowhere
else; an editor parameter edit reaches the node through `queueInput` → `setInputValue` →
`input.set` ([`editormodeleventshandler.ts:124-134`](../../../packages/noodl-runtime/src/editormodeleventshandler.ts#L124-L134))
and touches none of them.

Reproduced live, in that order, and the numbers are the report: a Group switched column → row left
both Texts at `flex-shrink: 0` with no `flex-grow` and both 320px wide inside a 320px row — the
first takes the row, the second is squeezed out. Setting `cachedChildren = undefined` and
re-rendering restored 160 + 160 with `flex-grow: 100; flex-shrink: 1`. That is also why the
folklore workaround works: touching any port on a child re-renders *that child* with the parent's
current layout.

**Fix:** `setLayout(layout)` on the node (`react-component-node.ts`) is now the only writer of
`props.layout` after initialisation — it drops the memo and re-renders, and no-ops when the value
is unchanged so the memoisation is still worth having. Adopted by `Group`, `Radio Button Group`
and the deprecated `Form`/`Fieldset`. The four `initialize`-time assignments are left as direct
writes: there are no children, and no rendered elements, at that point.

Consequences for the rest of this task:

- Criterion 5 (file an editor persistence defect if hypothesis 3 holds) — **no such defect
  exists.** The editor writes no `sizeMode` parameter at any point; it does not reference
  `sizeMode` at all. Nothing to file.
- §1 below is still correct and still worth doing, but on its own terms rather than as the fix for
  the report — see the note there.

## §0 — Resolve the contradiction (blocking) — original analysis, superseded

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

## §1 — Add the `else` (correct regardless of §0) — DONE 2026-07-29

§0 showed an unset `sizeMode` is unreachable on the *creation* path. It is still reachable on the
**connection** path, which is what §1 now closes: the generic prop setter deletes the prop when a
value arrives as `undefined`
([`react-component-node.ts:534-547`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L534-L547)),
so anything wired into Size Mode that abstains used to leave the node with no size mode at all and
`Layout.size` assigning no width — the fallthrough the task was written around, reached from a
direction the task did not consider.

As built:

- The Size Mode port restores the node's **declared** default when a connection abstains, per the
  Empty-Value Contract's "undefined abstains" rule. The default is resolved at the port, where it
  is in scope — `Layout.size` still does not have to know any node's default.
- A value that is not a Size Mode at all is reported through the NDA-004 channel as
  `dimensions/unknown-size-mode`, **once, when it arrives, attributed to the node** — not from
  `Layout.size`, which would repeat it on every render of every visual node.
- `Layout.size` gains the `else`, documented rather than silent: it is `contentSize`'s legitimate
  home (both axes come from content), and content-sizing is the honest treatment of a value the
  enum does not define.
- Found in passing and fixed: `width`/`height`'s `onChange` read `value.isFixed` unguarded, so an
  abstaining connection raised a `TypeError` from inside an input setter. This is candidate 4 of
  §0's list, and it was a live crash rather than the inert value the task suspected.

### Original §1 brief

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

1. ✅ §0 has an answer, cited, before §1 lands. — above, with file:line and live readings.
2. ✅ Two Text nodes in a row Group share the width on first render, with no interaction. — they
   already did; what did *not* work, and now does, is a later layout change reaching them.
   Live: 186 + 186 in a 372px row after a column → row switch.
3. ✅ Same for the other visual nodes that rely on a non-`explicit` default. — 15 node types in one
   Group, switched column → row: exactly the two whose flex depends on the axis recomputed
   (`Text` and `Range`, both `contentHeight` at 100% width, `g0/s0` → `g100/s1`); every
   `contentSize` node correctly did not move. No node rendered without a size mode.
4. ⚠️ **Instrument mismatch, deliberately not run.** The phase-23 screenshot corpus photographs
   *editor chrome* — launcher, panels, property editor, the Canvas2D node graph. This change is
   entirely inside `noodl-viewer-react`, which renders the user's app in the preview and which no
   corpus surface exercises. A clean corpus run here would be a green that tested nothing. The
   check that does cover the 29-node blast radius is criterion 3 above, and it was run. (The
   corpus run owed to NDA-002 criterion 3 is a separate, still-open residual.)
5. ✅ If §0 finds an editor persistence defect, it is filed as its own task. — none exists; the
   editor never writes a `sizeMode` parameter. Nothing to file.

Regression tests: `packages/noodl-viewer-react/tests/nda-016-layout-sizemode.test.ts`, 10 tests,
verified to fail without the fix (3 red on revert). Viewer suite 97 passed; `tsc --noEmit` clean.
