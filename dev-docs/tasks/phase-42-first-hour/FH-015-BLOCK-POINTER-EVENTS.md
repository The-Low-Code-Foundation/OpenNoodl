# FH-015 — "Block Pointer Events" and the click that hits the card anyway

Covers reported item **16**.

## What was reported

> …if you have a group div like a card you can click and it takes you to card details, but inside
> that div you have a button 'favourite' … when you click favourite it often would click through to
> card and carry out both logic actions … The Block pointer events option in the left props panel
> is shit and doesn't work, need to be fully reviewed please.

## The mechanism — three findings, one of them a one-line bug

**1. Click-through is the default and only behaviour.** Every visual node (Group, Text, Image,
Circle, Video) gets a live DOM `onClick` installed **unconditionally at node init** — whether or
not its Click port has any connection (`react-component-node.ts:910-921` loops all declared output
props). Nothing anywhere calls `stopPropagation` unless `blockTouch` is set (grep confirms:
`pointerlisteners.ts:62,69,74` are the only sites). So a child's click always bubbles into the
parent Group's always-present handler and fires the card's Click too.

**2. "Block Pointer Events" is real — and broken on exactly the node that matters.** `blockTouch`
(displayed "Block Pointer Events") wraps all 16 pointer handlers in `stopPropagation`
(`pointerlisteners.ts:53-104`). It works on Group/Text/Image/Circle/Video and on
Checkbox/Select/RadioButton/TextInput. **On Button it is silently ineffective for clicks**:
[`Button.tsx:94-97`](../../../packages/noodl-viewer-react/src/components/controls/Button/Button.tsx#L89-L98)
spreads `controlEvents(props)` (which contains the blocking wrapper) and then **re-assigns
`onClick={props.onClick}`** — the raw unwrapped sender. JSX later-wins; the wrapper is discarded
for the one event the user cares about. Same defect in `Slider.tsx:112/:177` and the deprecated
button. So the documented workaround blocks mousedown/mouseup/touchstart and lets the click
through — "doesn't work" is exactly right.

**3. Even where it works, it's a blunt instrument.** `blockTouch` stops all 16 events, so blocking
a child's click also kills the parent's Hover Start/Pointer Down — authors turn it back off. And
the description says "elements underneath/behind" (z-order) while the implementation stops
bubbling to **ancestors** — label and mechanism disagree. (The separate `pointerEventsMode`/
`pointerEventsEnabled` ports are pure CSS `pointer-events` and can't help here: `none` kills the
child's own click too.)

No test anywhere references `pointerlisteners`, `blockTouch`, or `pointerProps`.

## What to build

**Slice 1 — the one-liner.** Delete the trailing `onClick={props.onClick}` in `Button.tsx:97`
(controlEvents already supplies it); same in `Slider.tsx` and the deprecated button. This alone
makes the existing option honest.

**Slice 2 — the right default.** A node whose Click output **has connections** should stop click
propagation by default — the runtime exposes the exact predicate
(`node.getOutput('onClick').hasConnections()`, `outputproperty.ts:221-225`), and
`pointerlisteners.ts:88-101` already wraps handlers when `noodlNode` is present. This changes
existing-project behaviour, so it ships as a port with a default ("Clicks bubble to parent:
off-when-connected") rather than a silent switch — but fresh-start compatibility is our stated
policy, so the default should be the correct behaviour, not the legacy one.

**Slice 3 — scope the blunt instrument.** Split `blockTouch` into per-family blocking (block
click/press without killing hover), and fix the description to say ancestors, not "underneath".

**Slice 4 — tests.** viewer-react tests for: child click with connected parent (no double fire
after slice 2), blockTouch on Button (after slice 1), hover still reaching parent under slice 3.

## Criteria

1. Card-with-favourite: clicking favourite fires only favourite, out of the box, no options set.
2. "Block Pointer Events" on a Button actually blocks the click from reaching the parent.
3. Parent Hover Start still fires while the child blocks clicks.
4. An unconnected Click port on the parent = no behaviour change at all (silent no-op today,
   stays so).
5. Verified live in the preview — pointer semantics are exactly the class jest fixtures fake
   badly.

## Traps

- Slice 2's semantics interact with the AI-authored apps (wizard apps wire Clicks liberally);
  run one AI-built project and confirm nothing that relied on bubbling breaks.
- `opacity === 0` already forces `pointerEvents: 'none'` implicitly (`Group.tsx:329` etc.) —
  undocumented; don't "fix" it while in there, note it in the port description instead.
