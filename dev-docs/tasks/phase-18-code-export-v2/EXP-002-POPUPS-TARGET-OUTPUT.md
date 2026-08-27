# EXP-002 Popups — a parent-owned modal slot, written by hand first

> Session 11. The top non-JS coverage gap after Component Outputs: `NavigationShowPopup` and
> `NavigationClosePopup`. The headline decision: **a popup becomes parent-owned modal state —
> one `useState` slot per hosting component, a conditional `createPortal` render, and a
> reserved `onClose` callback prop on the popup component** — not an app-global popup manager.
> §1 argues why. The close side rides exactly the instance-callback rail session 10 built.

The runtime semantics were read from the source, not assumed (`showpopup.ts`, `closepopup.ts`
in `noodl-viewer-react/src/nodes/navigation/`, `NodeContext.showPopup` in
`noodl-runtime/src/nodecontext.ts`, and the popup layer in `viewer.jsx`):

- **Show Popup** holds a `target` component, `popupParam-<input>` values, and a stack policy
  (`replace` by default — NDA-010 §3's "one modal slot"; `stack` is a per-node opt-in). `Show`
  opens the target via `context.showPopup`, which under `replace` first dismisses every open
  popup, creates the component, applies the params **once** (a snapshot, not a binding), wraps
  it in a runtime Group (`position: absolute`, and Group's catalog defaults make that
  100%×100% — a full-viewport overlay), and mounts it as a **sibling after the root
  component** in the viewer. Content inside styles itself; the wrapper is an unstyled
  full-screen box that paints above the app by DOM order alone.
- The popup's close handler is published on the popup's component instance
  (`_popupCloseHandler`); **Close Popup** resolves it by walking up its component ancestors
  (nearest enclosing popup, NDA-015 §2), so a Close Popup nested in a child component of the
  popup still works at runtime. Closing hands `(action, results)` back to the Show Popup node,
  which fires `Closed` (no action) or the matching `closeAction-<name>` signal and updates
  `closeResult-<name>` value outputs. `Dismissed` fires when another popup replaced this one.
- Both nodes carry `done`/`failure`/`error` outcome ports: Show's `done` fires once the popup
  opened; Close's `done` fires once the popup it resolved was closed, and `failure` when the
  node is not inside an open popup.

## Corpus (2026-08-27 survey, the 40 audit projects — `popup-survey.ts`, session 11 scratchpad)

135 Show Popup nodes and 9 Close Popup nodes — and they are **nine clones of one shape** (the
NoticeDialog pattern: a shop page whose header/footer/hero nav clicks all open one dialog):

- **Every Show Popup has a literal `target`; every one uses the default `replace` policy.**
  Zero literal `popupParam-*` values, zero wires into any `popupParam-*`.
- **Zero Show Popup outputs are consumed.** No wire leaves `Closed`, `Dismissed`, `done`,
  `failure`, `error`, any `closeAction-*`, or any `closeResult-*` — anywhere in the corpus.
- `show` is fed by rendered-instance signal outputs (Header/Footer/Hero `…Clicked` — session
  10's rail) ~15× per project, plus one `Set Variable.done → show` per project (a done-chain
  — the separate logic-trigger slice), and **8 nodes also wire `target` from a
  `JavaScriptFunction`** (dynamic target — untranslatable).
- Every target has its Close Popup **in its own scope** (the ancestor walk is never needed).
  Popup targets are **never** also placed as ordinary instances.
- Close Popup: all nine declare `closeActions: "ok"` and nothing else — no `results`, no
  `targetComponent`. Fed by `button.onClick → closeAction-ok`; the one consumed output chain
  is **`done → Component Outputs.closed`** (the popup announces its closing as a component
  output — which nothing outside consumes, since targets are never placed as instances).

---

## 1. A parent-owned slot, not a popup manager

The runtime's popup layer is app-global: one stack, `replace` dismissing across the whole app,
mounted beside the root. The faithful-looking translation is therefore a global popup service —
a context or store holding the open popup, a `<PopupLayer>` in `App.tsx`, and an imperative
`showPopup()` API. It loses to parent-local state on every axis that matters here:

- **The corpus never crosses components.** All 135 Show Popups sit beside their popup's only
  opener; with one page rendered at a time, the global stack and a per-component slot are
  observably identical for every graph we have. The one divergence — two *different* live
  components each holding an open popup, where the runtime would replace across them and the
  export renders both — is recorded in §8 and reported when a project can express it.
- **Idiom.** Parent `useState` + conditional render + `createPortal` is *the* React modal
  pattern; a reader owns two lines of state, not a bespoke service. The export's promise is a
  codebase a developer would have written.
- **The close callback threads as a prop** — precisely the rail Component Outputs built. A
  global manager would need context plumbing or an event bus: new vocabulary nothing else in
  EXP-002 needs.
- **NDA-010 §3's policy is already "one modal slot".** A single nullable slot per hosting
  component is that policy, expressed in `useState`.

So: each component hosting translatable Show Popup nodes gets **one popup slot** —

```tsx
const [openPopup, setOpenPopup] = useState<'AboutDialog' | null>(null);
```

— whose value names which popup is open (`null` = none). Setting it *is* the replace policy:
within the component, opening one popup closes whatever else was open, exactly the runtime's
single-slot default.

## 2. Slot keys and sharing

The slot value is a string literal derived from the **target component's exported symbol**
(`/Components/AboutDialog` → `'AboutDialog'`) — readable in the generated code and stable
across sessions. Two Show Popup nodes **share a slot key** when they open the same target with
an identical literal-param set (the corpus's 13-openers-one-dialog page becomes *one*
conditional render with 13 `setOpenPopup('NoticeDialog')` handlers — not 13 overlapping
copies). Distinct param sets on the same target take `-2`, `-3` suffixes in node source order.
Sharing is safe *because of this slice's defer rules*: a node with any consumed output (§3)
defers, so shared keys can never conflate two nodes' observable outcomes.

## 3. Show side — what translates, what defers

A new trigger sink: `NavigationShowPopup.show` compiles to the action
`{ kind: 'popup-show', slotKey }` — `setOpenPopup('AboutDialog')` — attached to any handler
owner the machinery already serves (a rendered element's event, a rendered instance's signal
output, a receiver, a Condition arm). Wires from the node's `done` compile as actions appended
after the set in the same handler (the sync-in-handler divergence class every action accepts;
a statically-known target always opens, so `done` unconditionally follows `show`).

| Shape | Ruling |
| --- | --- |
| Literal `target`, translatable trigger owner | `setOpenPopup('Key')` (+ appended `done`-chain actions) |
| `target` wired (8 in corpus) | Defers, named: which component opens is not statically knowable |
| No `target` | Defers (the runtime's own `show-popup/no-target` failure path) |
| `stackPolicy: 'stack'` | Defers, named — the slot is single by design; corpus zero |
| Literal `popupParam-X`, target declares input `X` | Prop on the rendered popup element (`title="Hi"`) |
| Literal `popupParam-X`, target declares no `X` | Param dropped with a note (the runtime silently absorbs it) |
| Wired `popupParam-*` | Defers, named: the runtime snapshots params at open; a live binding would lie |
| Target is a page, missing, or exports no file | Defers, named |
| Any consumed output other than `done` (`Closed`, `Dismissed`, `failure`, `error`, `closeAction-*`, `closeResult-*`) | Defers, named — close-outcome dispatch is future work (§7); corpus zero |
| `show` fed only by untranslatable triggers (`Set Variable.done`, …) | The existing owner rules defer it — that is the logic-trigger slice, not this one |

## 4. Close side — the reserved `onClose` prop

A component hosting at least one translatable Close Popup gains one reserved prop, declared
after the output props:

```tsx
onClose?: (action?: string) => void;
```

`onClose` is to the popup boundary what `onWaved` is to the component interface: the child
announces, the parent (the popup slot render, §5) decides. Trigger ports are dynamic —
`close` compiles to `onClose()` (the runtime's action-less close, which fires `Closed`), and
each author-declared `closeAction-X` to `onClose('X')`. Wires from the node's `done` compile
as actions appended after the call, gated together on the prop's presence — the runtime's
popup-in-scope check:

```tsx
onClick={() => { if (onClose) { onClose('ok'); onClosed?.(); } }}
```

With no `done`-chain the gate collapses to the optional call: `onClose?.('ok')`. Rendered
outside a popup slot, the prop is absent and the close is a no-op — which is the runtime's
`failure` path minus a failure signal nothing in the corpus consumes.

| Shape | Ruling |
| --- | --- |
| `close` / `closeAction-X` from a translatable handler owner, owner component is some Show Popup's literal target | `onClose(…)` in that handler (+ gated `done`-chain) |
| Owner component is **not** any Show Popup's literal target | Defers, named: the runtime resolves an enclosing popup by ancestor walk — a prop this slice cannot thread. Deferring under-claims (a never-popup component's close is a no-op both sides) rather than lying in the nested case |
| `results` declared or `result-*` wired | Defers, named — close results are value outputs; lifted state belongs with the component-state slice |
| `targetComponent` (the `Popup` input) set | Defers, named — nested-popup selection |
| `failure` / `error` consumed | Defers, named |
| A declared input/output prop already claims `onClose` | Defers, named — the author renames; never silently pick another name (§2 of COMPONENT-OUTPUTS) |

The prop-name space rule: `onClose` joins the collision set that input props and output props
already check against, from both sides.

## 5. The parent render — conditional portal

Each slot entry renders after the root element's children:

```tsx
{openPopup === 'AboutDialog' &&
  createPortal(
    <div className={styles.popupLayer}>
      <AboutDialog onClose={() => setOpenPopup(null)} />
    </div>,
    document.body
  )}
```

- **`createPortal(…, document.body)`** is the runtime's mounting, spelled in React: the popup
  layer is a sibling *after* the app's root, painting above it by DOM order with no z-index —
  and a portal keeps that true even when the hosting component sits inside a transformed or
  overflow-clipped ancestor.
- **`.popupLayer`** is the runtime's wrapper group, spelled in CSS — one rule in the hosting
  component's module.css: `position: fixed; inset: 0;`. (The runtime uses `absolute` inside a
  `position: fixed` root — `fixed` is the same box without depending on the ancestor chain,
  which a portal has left anyway.) It carries no background and no layout; the popup component
  styles itself, exactly as NoticeDialog's authored full-width card does at runtime.
- Literal popup params emit as props before `onClose`, named through the target's own props
  plan — the same naming an ordinary instance uses.
- The `onClose` arrow resets the slot, and nothing else, this slice: any Show Popup node that
  consumes a close outcome deferred in §3, so no dispatch arm can be needed here yet. §7
  records the future arrow.
- A target with no translated Close Popup declares no `onClose`, and the slot render passes
  none — passing one would fail the emitted app's own typecheck, and a popup without a close
  node never closes at runtime either (only replacement removes it). The open-forever slot is
  the faithful export of that graph.

## 6. The target, hand-written — the fixture's new `AboutDialog`

The Cheer fixture grows `Components/AboutDialog` (the corpus's NoticeDialog shape: a card
with a title, body text and an OK button; `okButton.onClick → closeAction-ok`;
`ClosePopup.done → outputs.closed`) and `Pages/Home` gains an "About" button wired to
`ShowPopup(target: /Components/AboutDialog).show`.

```tsx
// src/components/AboutDialog.tsx
import styles from './AboutDialog.module.css';

export interface AboutDialogProps {
  onClosed?: () => void;
  onClose?: (action?: string) => void;
}

export function AboutDialog({ onClosed, onClose }: AboutDialogProps) {
  return (
    <div className={styles.aboutDialog}>
      <p className={styles.aboutTitle}>About Cheer</p>
      <p className={styles.aboutBody}>Cheer is a tiny place to collect good moments.</p>
      <button
        className={styles.aboutOkButton}
        onClick={() => {
          if (onClose) { onClose('ok'); onClosed?.(); };
        }}
      >
        OK
      </button>
    </div>
  );
}
```

(`onClosed` sits first because it is the ordinary Component Outputs prop — the declared
interface — and `onClose` is appended after it, per §4; the gated close prints in the
emitter's established compact-if shape, the same one branches use.)

```tsx
// in src/pages/Home.tsx
const [openPopup, setOpenPopup] = useState<'AboutDialog' | null>(null);
…
<button className={styles.aboutButton} onClick={() => setOpenPopup('AboutDialog')}>About</button>
…
{openPopup === 'AboutDialog' &&
  createPortal(
    <div className={styles.popupLayer}>
      <AboutDialog onClose={() => setOpenPopup(null)} />
    </div>,
    document.body
  )}
```

Decisions visible in the target:

- `onClosed` is *not* part of the popup machinery — it is the ordinary Component Outputs prop
  for the popup's declared `closed` signal output, fired by the `done`-chain. The popup slot
  render passes only `onClose`; `onClosed?.()` is optional-called into the void, exactly as
  the runtime's unconsumed instance output is.
- The child fires synchronously inside its own handler where the runtime defers teardown to
  the next frame — the accepted divergence class. Emit order is `onClose(action)` first, then
  the `done`-chain: the runtime reports `done` before the parent's signals fire, and since the
  parent arrow only sets state (applied at re-render), the observable order agrees.

## 7. Recorded future shapes, not this slice

- **Close-outcome dispatch.** When a Show Popup's `Closed` / `closeAction-*` outputs are
  consumed, the slot's arrow grows the dispatch:
  `onClose={(action) => { setOpenPopup(null); if (action === 'ok') { … } else if (action === undefined) { … } }}`
  — with per-node (unshared) slot keys so outcomes stay attributable. Zero corpus demand
  today; the deferral in §3 names this section.
- **Close results** are value outputs: `closeResult-X` is lifted state
  (`onCloseResult?: (results: {...}) => void` or per-key setters) — one design with the
  component-state slice's `onXChanged` shape (COMPONENT-OUTPUTS §6).
- **The ancestor walk** (Close Popup in a nested component, `targetComponent`, popup-in-popup
  stacks) — threading `onClose` down through intermediate instances is expressible but earns
  its complexity only when a graph uses it.
- **`stack` policy** — an array-shaped slot.

## 8. Recorded divergences (cosmetic or unexpressed, per the standing register)

- Cross-component replace: two *different* live components each opening popups — the runtime
  replaces app-wide; the export's slots are per-component and would render both. Unreachable
  in the corpus (openers share one page); reported as a note when a project plans popup slots
  in more than one component.
- `Dismissed` never fires in the export (a replaced popup's slot key is simply overwritten).
  Consuming it defers the node, so the export never *claims* it.
- The viewer's `bodyScroll` body-lock (fixing the body while a popup is open) is not emitted.
- The viewer wraps app and popup layer in `isolation: isolate`; the export relies on DOM order
  alone. An app z-index taller than the page could overpaint a popup — none of the corpus
  styles z-index at all.
- Params are literal-only, so the snapshot-vs-binding question (§3) never arises in emitted
  code.

## 9. Verification for this slice

- Goldens: `AboutDialog.tsx` (reserved prop + gated close + fired output) and the grown
  `Home.tsx` (slot state, handler, portal render) hold the emitter to §6 byte-for-byte.
- Shape tests by IR mutation: wired target defers named; stack policy defers; consumed
  `Closed` defers; literal param → prop and unknown param → note; shared slot key across two
  openers of one target; distinct targets → union type + two renders; `close` (no action) →
  `onClose()`; `closeAction` + done-chain → gated block; no done-chain → `onClose?.('ok')`;
  `results` declared defers; owner-not-a-target defers; `onClose` collision defers; Set
  Variable.done trigger stays deferred by the owner rules.
- jsdom drive on the emitted app: click About on Home → dialog appears under `document.body`
  (portal), click OK → dialog gone, slot reset.
- Coverage audit re-run over the 40 projects; ledger flips `NavigationShowPopup` and
  `NavigationClosePopup` → `translated` in the same commit.
