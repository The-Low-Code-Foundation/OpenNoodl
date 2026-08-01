# Audit worksheet — Visual (29 nodes, **20 in scope**, 20 audited)

> **Audited 2026-08-01.** All 20 in-scope nodes now carry twelve verdicts. The nine deprecated
> legacy form controls (`Button`, `Checkbox`, `Field Set`, `Form`, `Label`, `Options`,
> `Radio Button`, `Range`, `Text Input`) are **out of scope** by Richard's standing decision and
> keep their entries at the bottom so the file matches the catalog.
>
> ⚠️ **The `C1` figures in the previous copy of this file were stale**, again — it was regenerated
> before `b7c7d599`'s shared-port pass landed, so it showed `Slider` at 27% when the node was at
> 40% and `Text Input` at 45% when it was at 87%. **Every number below is re-derived from the
> catalog at audit time.** Do not quote a C1 figure from any document without re-deriving it:
>
> ```bash
> node -e 'const c=require("./packages/noodl-types/src/node-catalog.json");
> const v=c.nodes.filter(n=>n.category==="Visual"&&!n.isDeprecated);let t=0,d=0;
> for(const n of v)for(const p of [...(n.inputs||[]),...(n.outputs||[])]){t++;if(p.description)d++;}
> console.log(t,d,(d/t*100).toFixed(1)+"%");'
> ```
>
> ⚠️ **`Component Children` has ZERO static ports** and is recorded **`n/a`, not 100%**.
>
> ✅ **C1 closed to 100% (1227/1227) later in the same session**, so every `C1` row below reads ✅
> and the per-node counts record what was written rather than what was missing. The `docs` figure in
> each node's header line is the number **at audit time**, kept deliberately: it is what the audit
> was looking at.

Checks are defined in [NDA-012](../NDA-012-PER-NODE-AUDIT.md) and derive from the defect classes
in [FINDINGS.md](../FINDINGS.md). Verdicts: ✅ pass · ⚠️ defect · 🔵 by design, document it ·
`n/a` not applicable.

## Two things this pass changes about how the checks were read

1. ⚠️ **`B3` was pre-filled from "does the node have *any* signal output"**, which is not the
   check. B3 asks whether **every signal input has a terminating signal output** so the graph can
   sequence off it. Read that way, a node whose only signal outputs are `Did Mount` and pointer
   events fails B3 while the pre-fill said ✅. **Seven nodes flip from ✅ to ⚠️ on this reading
   alone**, and they are the seven with action inputs: `Drag`, `Group`, `Video`, `Checkbox`,
   `Text Input`, `Component Stack`, `Page Router`.
2. ⚠️ **`H1` is not answered by the `ssr` field.** The pre-fill quoted the node's declared SSR
   compatibility, which is one clause of the check; the other two — survives unmount/remount, and
   survives delete — need the source. Three nodes leak on delete and all three declare `safe`.

---

## In scope

### Text  `Text`

43 inputs / 14 outputs · docs **93%** (53/57) · SSR `safe` · browser

Source: [`nodes/visual/text.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/text.ts)
· Docs: [link](https://docs.noodl.net/nodes/basic-elements/text)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | holds no state; `text` is a pure prop forward |
| A2 | `n/a` | nothing cached to re-read |
| A3 | ✅ | `forceUpdate` coalesces to one render per frame and drops nothing |
| G1 | ✅ | closed by `DC-iii` — `renderableText` tests `null`/`undefined` explicitly, so `0` and `false` still render. Pinned in `nda-012-visual-empty-values.test.tsx` |
| B1 | `n/a` | no action input and nothing that can fail |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (57/57) | closed this session — 4 ports written |
| D1 | ✅ | `as` is an enum, not a bare string |
| E1 | ✅ | no dead-end types |
| F1 | `n/a` | targets nothing |
| H1 | ✅ | declares `safe`; no listeners, no timers, nothing to leak |

**Verdict:** ✅ pass — the one defect it had (`DC-iii`) is fixed and pinned. ⚠️ `textAlignX`/
`textAlignY` fire the DB-ii predicate ([`text.ts:98`](../../../../packages/noodl-viewer-react/src/nodes/visual/text.ts#L98), `:126`)
but land on CSS initial values, so they are in `DV-iv`'s inert majority.

---

### Group  `Group`

85 inputs / 20 outputs · docs **75%** (79/105) · SSR `safe` · browser

Source: [`nodes/visual/group.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts)
· Docs: [link](https://docs.noodl.net/nodes/basic-elements/group)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ⚠️ | the two scroll actions guard `innerReactComponentRef` at **different times**: `scrollToIndex.do` checks inside `scheduleAfterInputsHaveUpdated` ([`group.ts:79`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts#L79)), `scrollToElement.do` checks **before** scheduling ([`:92`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts#L92)). A `Do` that arrives in the frame the Group mounts is honoured by one and dropped by the other |
| G1 | ✅ | `scrollToElement.element` accepts a reference; an empty one lands as `undefined` and the scroll is a no-op |
| B1 | ⚠️ **none** | `Scroll To Element` with an element that is not a descendant, and `Scroll To Index` past the end, both do nothing and report nothing |
| B2 | ⚠️ | there is no report at all, so there is nothing for a deployed app to lose |
| B3 | ⚠️ | **three signal inputs, no terminating signal**: `scrollToIndex.do`, `scrollToElement.do`, `focus`. The 12 signal outputs are pointer, hover, mount and scroll-gesture events — none of them means "the action you asked for finished". `Scroll End` fires for a *user* scroll |
| C1 | ✅ **100%** (105/105) | closed this session — 26 ports written |
| D1 | ✅ | `flexDirection` validates against `flexDirectionValues` and warns ([`:60-66`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts#L60-L66)) — ⚠️ but see B2: the warning is editor-only |
| E1 | ✅ | no dead-end types |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe`; scroll plugins are owned by the React component's own unmount |

**Verdict:** ⚠️ defect — B3 on all three actions, B1/B2 on both scroll actions, A3 on the guard
asymmetry. 🔵 [`group.ts:14`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts#L14)
assigns `this._internal = {…}` **wholesale** rather than merging; nothing seeds `_internal` before
the node's own `initialize` today, so this costs nothing now and silently erases anything that ever
does.

---

### Circle  `Circle`

33 inputs / 14 outputs · docs **81%** (38/47) · SSR `safe` · browser

Source: [`nodes/visual/circle.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/circle.ts)
· Docs: [link](https://docs.noodl.net/nodes/basic-elements/circle)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ✅ | every port is a plain `inputProps` forward |
| G1 | ✅ | every port has a default and takes the framework's default→props route |
| B1 | `n/a` | nothing can fail |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (47/47) | closed this session — 9 ports written |
| D1 | ✅ | — |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe`; pure render |

**Verdict:** ✅ pass. The simplest node in the category and the only one with nothing to say.

---

### Columns  `net.noodl.visual.columns`

16 inputs / 9 outputs · docs **52%** (13/25) · SSR `safe` · browser

Source: [`nodes/visual/columns.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/columns.ts)
· Docs: [link](https://docs.noodl.net/nodes/basic-elements/columns)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ✅ | NDA-006 closed the autofold |
| G1 | ✅ | `toPixels` ([`Columns.tsx:41`](../../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L41)) takes number or string |
| B1 | `n/a` | no action input |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (25/25) | closed this session — 12 ports written |
| D1 | ⚠️ | `layoutString` is a bare string parsed with `parseInt` per token. The setter validates only that it *is* a string ([`columns.ts:49-64`](../../../../packages/noodl-viewer-react/src/nodes/visual/columns.ts#L49-L64)); `'1 a 1'` yields a `NaN` column and is neither reported nor rejected |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe` |

**Verdict:** ⚠️ defect — D1 on `layoutString`. 🔵 **worth reading twice**:
[`columns.ts:27-34`](../../../../packages/noodl-viewer-react/src/nodes/visual/columns.ts#L27-L34)'s
hand-written `initialize` mirror runs **after** the framework's default→props copy and overwrites
the correct `'16px'` with a bare `16` — `DV-iv`. `toPixels` absorbs it, but a mirror written to
work around DB-ii reintroduced exactly the type confusion the framework had already got right.

---

### Icon  `net.noodl.visual.icon`

30 inputs / 8 outputs · docs **100%** (38/38) · SSR `safe` · browser

Source: [`nodes/visual/icon.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/icon.ts)
· Docs: [link](https://docs.noodl.net/nodes/basic-elements/icon)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ✅ | — |
| G1 | ✅ | closed by NDA-007 |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (38/38) | was the category's only fully documented node; the rest caught up this session |
| D1 | ✅ | icon source is an enum pair, not a bare string |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe` |

**Verdict:** ⚠️ defect — **`DV-ii`, and Icon is the node it actually costs.** `Icon` declares 5px
padding on all four edges
([`icon.ts:30-37`](../../../../packages/noodl-viewer-react/src/nodes/visual/icon.ts#L30-L37)) and
renders none of it: `addPaddingInputs` sets `applyDefault: false`, which blocks the `startStyle`
route, and DB-ii blocks the setter route. **Measured live: `padding: 0px` on the node's own element,
with no stylesheet rule supplying it** — unlike `Button`, which is saved by a coincidence. Pinned in
`nda-012-visual-declared-defaults.test.ts`.

---

### Image  `Image`

62 inputs / 17 outputs · docs **97%** (77/79) · SSR `safe` · browser

Source: [`nodes/visual/image.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/image.ts)
· Docs: [link](https://docs.noodl.net/nodes/basic-elements/image)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ✅ | — |
| G1 | ✅ | `resolveMediaSource` returns `undefined` for `null`/`undefined`/`''`, so React omits the attribute and no request is made ([`media-source.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/media-source.ts)) |
| B1 | ✅ | `On Error` **and** `Error` — the bare signal got its string in this phase |
| B2 | ✅ | `raiseRuntimeError('image/load-failed', …)` ([`Image.tsx:41`](../../../../packages/noodl-viewer-react/src/components/visual/Image/Image.tsx#L41)), so the diagnosis exists in a deployed app |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (79/79) | closed this session — 2 ports written |
| D1 | ✅ | `src` is typed `image` and resolved, not string-matched |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe`; no listeners outside React |

**Verdict:** ✅ pass, **live QA owed**. The `On Error` reporting was salvaged from a terminated
worker and is verified by inspection and typecheck only — `renderToStaticMarkup` cannot fire a
DOM `error` event. Named in `nda-012-visual-empty-values.test.tsx`.

---

### Video  `Video`

66 inputs / 23 outputs · docs **75%** (67/89) · SSR `safe` · browser

Source: [`nodes/visual/video.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/video.ts)
· Docs: [link](https://docs.noodl.net/nodes/basic-elements/video)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ⚠️ | all four actions no-op silently when `innerReactComponentRef` is null ([`video.ts:51`](../../../../packages/noodl-viewer-react/src/nodes/visual/video.ts#L51), `:62`, `:70`, `:78`) — a `Play` in the frame the node mounts is swallowed, unlike `Group`'s scroll actions which at least defer |
| G1 | ✅ | closed this phase — a cleared `Source` no longer resolves to `/null` and no longer fires `Playback Failure` |
| B1 | ✅ | `Playback Failure` + `Error` |
| B2 | ✅ | distinct codes on the runtime channel (`video/play-rejected`, `video/media-error`) |
| B3 | ⚠️ | four action inputs, two terminators. `Play`→`On Play` ✅ and `Pause`→`On Pause` ✅, but **`Restart` and `Reset` have no completion signal at all** |
| C1 | ✅ **100%** (89/89) | closed this session — 22 ports written |
| D1 | ✅ | — |
| E1 | ⚠️ | **`pause` and `reset` are declared `type: 'boolean'` and implemented with `valueChangedToTrue`** ([`video.ts:65-80`](../../../../packages/noodl-viewer-react/src/nodes/visual/video.ts#L65-L80)) while `play` and `restart` are `type: 'signal'`. So the panel offers a toggle for something that is a pulse, and setting `Pause` back to `false` does nothing — you must use `Play`. Four ports, one contract, two spellings |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe`; the element is React's |

**Verdict:** ⚠️ defect — E1 on the boolean/signal split, B3 on `Restart`/`Reset`, A3 on the
pre-mount drop. B1/B2 are the category's best failure surface, and they were built in NDA-004 §2.

---

### Drag  `Drag`

16 inputs / 16 outputs · docs **44%** (14/32) · SSR `safe` · browser

Source: [`nodes/visual/drag.ts`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts)
· Docs: [link](https://docs.noodl.net/nodes/utilities/drag)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ✅ | the snap actions defer through `scheduleAfterInputsHaveUpdated`, so value and duration are read after the same frame's inputs land |
| G1 | ⚠️ | `snapToPositionX.value` accepts `null` straight into `_internal.snapPositionX` ([`drag.ts:52`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts#L52)) and the animation then interpolates toward `null`. `null` should abstain or clamp, not become `NaN` |
| B1 | ⚠️ **none** | a `Do` before the component mounts is dropped by `this.innerReactComponentRef && …` ([`:42`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts#L42), `:74`) with no report |
| B2 | ⚠️ | nothing is reported anywhere, so the deployed case is no worse than the editor one — which is the point |
| B3 | ⚠️ | two signal inputs (`Snap To Position X/Y — Do`), **no terminating signal**. `Drag Started`/`Ended`/`Moved` are gesture events; nothing says the snap animation finished, which is precisely what a snap-then-do graph needs |
| C1 | ✅ **100%** (32/32) | closed this session — 18 ports written |
| D1 | ✅ | — |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | `addDeleteListener` stops the snap timers on delete ([`:28-30`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts#L28-L30)) — deleting a node does not unmount its component, so the component's own `componentWillUnmount` was not enough |

**Verdict:** ⚠️ defect — B1/B2/B3 and G1. ✅ The four mirrored defaults at
[`drag.ts:20-23`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts#L20-L23) are
the category's one deliberate DB-ii workaround and they are correct. **Live QA owed** on the
salvaged `scale || 1` fallback and the snap-timer cleanup — both need a DOM and a frame clock.

---

### Button  `net.noodl.controls.button`

79 inputs / 20 outputs · docs **97%** (96/99) · SSR `safe` · browser

Source: [`nodes/controls/button.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/button.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/button)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ✅ | — |
| G1 | ✅ | `label` is a prop forward; `Enabled` is coerced with `!!` |
| B1 | `n/a` | nothing can fail |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (99/99) | closed this session — 3 ports written |
| D1 | ✅ | — |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe`; `addControlEventsAndStates` seeds and owns its state |

**Verdict:** ⚠️ defect — **`DV-ii`, but not the one it looks like.** `Button` declares 20px
horizontal and 5px vertical padding
([`button.ts:64-71`](../../../../packages/noodl-viewer-react/src/nodes/controls/button.ts#L64-L71))
and puts none of it on the node's style — yet **a rendered Button computes `padding: 5px 20px`
anyway**, because
[`assets/style.css:24`](../../../../packages/noodl-viewer-react/src/assets/style.css#L24) carries the
same two numbers. ⚠️ **This session's first reading of the finding claimed the padding was missing
on screen; the live run disproved it.** The real defect is that Button's padding is specified twice,
in two files, by two mechanisms, and only the stylesheet is load-bearing: changing the port default
moves nothing, and changing the stylesheet makes the panel lie.

---

### Checkbox  `net.noodl.controls.checkbox`

76 inputs / 20 outputs · docs **92%** (88/96) · SSR `safe` · browser

Source: [`nodes/controls/checkbox.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/checkbox.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/checkbox)

| Check | Verdict | Note |
|---|---|---|
| A1 | 🔵 | **three of the four mutation paths do not notify.** `Changed` fires only from `checkedChanged`, the user-click path ([`checkbox.ts:43`](../../../../packages/noodl-viewer-react/src/nodes/controls/checkbox.ts#L43)); the `Checked` input setter, `Check` and `Uncheck` all flag the *value* output and stay silent on the signal. Consistent with `Dropdown` and `Radio Button Group`, so it reads as a deliberate no-feedback-loop rule — **but it is nowhere documented, and "Changed" is not what it means** |
| A2 | `n/a` | — |
| A3 | ✅ | every path compares before flagging |
| G1 | ✅ | `!!value` — `null` becomes `false`, which is the honest reading for a checkbox |
| B1 | `n/a` | nothing can fail |
| B2 | `n/a` | — |
| B3 | ⚠️ | `Check` and `Uncheck` are signal inputs and neither has a terminator — see A1: they deliberately do not fire `Changed`, which leaves them with nothing at all to sequence off |
| C1 | ✅ **100%** (96/96) | closed this session — 8 ports written |
| D1 | ✅ | — |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe` |

**Verdict:** ⚠️ defect — B3, and A1 needs the rule written down. The A1/B3 pair is one decision
seen from two sides: whatever `Changed` is documented to mean, `Check`/`Uncheck` need *some*
terminator.

---

### Dropdown  `net.noodl.controls.options`

91 inputs / 20 outputs · docs **93%** (103/111) · SSR `safe` · browser

Source: [`nodes/controls/options.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/options.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/dropdown)

| Check | Verdict | Note |
|---|---|---|
| A1 | 🔵 | as `Checkbox` — the `value` input setter flags the output and sends no `Changed` |
| A2 | `n/a` | — |
| A3 | ⚠️ | **re-sending the same collection adds a second listener.** The `off` is guarded by `this._internal.items !== newValue`, the `on` is not ([`options.ts:57-62`](../../../../packages/noodl-viewer-react/src/nodes/controls/options.ts#L57-L62)), so an identical re-set leaves two `change` handlers and every subsequent change re-renders twice |
| G1 | ⚠️ | **`Items = null` throws.** `this._internal.items.on('change', …)` runs unguarded on the new value ([`:62`](../../../../packages/noodl-viewer-react/src/nodes/controls/options.ts#L62)). `null` and `''` are the reachable empty values (§4.2) and both are ordinary arrivals from a query that matched nothing |
| B1 | ⚠️ **none** | the crash above is the failure surface |
| B2 | ⚠️ | an uncaught `TypeError` in a setter, with no code and no message an author can act on |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (111/111) | closed this session — 8 ports written |
| D1 | ✅ | the commented-out validation at [`:79-83`](../../../../packages/noodl-viewer-react/src/nodes/controls/options.ts#L79-L83) is deliberate — a value not in `items` deselects rather than being rejected |
| E1 | ⚠️ | `items` is `type: 'array'`, one of the category's two object/array ports |
| F1 | `n/a` | — |
| H1 | ⚠️ | **the `change` listener is never removed on delete.** There is no `addDeleteListener`; a deleted Dropdown keeps a live handler on the collection and calls `forceUpdate` on a dead node. Same shape `Drag` fixed at [`drag.ts:28`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts#L28) |

**Verdict:** ⚠️ defect — **the densest node in the category: three defects in one eleven-line
setter** (G1 crash, A3 duplicate listener, H1 leak), plus E1. The setter is
[`options.ts:57-67`](../../../../packages/noodl-viewer-react/src/nodes/controls/options.ts#L57-L67)
and all three would be closed by the same rewrite.

---

### Radio Button  `net.noodl.controls.radiobutton`

76 inputs / 19 outputs · docs **93%** (88/95) · SSR `safe` · browser

Source: [`nodes/controls/radiobutton.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/radiobutton.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/radio-button)

| Check | Verdict | Note |
|---|---|---|
| A1 | ⚠️ | **`Radio Button` has no `Changed` output at all**, unlike `Checkbox` and `Radio Button Group`. Selection can only be observed by polling `Checked` or by listening on the group |
| A2 | `n/a` | — |
| A3 | ⚠️ | `props.checkedChanged(…)` is called **from the render body** ([`RadioButton.tsx:48`](../../../../packages/noodl-viewer-react/src/components/controls/RadioButton/RadioButton.tsx#L48)) and that call reaches `flagOutputDirty` and `_updateVisualState`. A render that React discards or double-invokes therefore moves graph state |
| G1 | ✅ | `value` is a plain prop forward |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (95/95) | closed this session — 7 ports written, from 0% |
| D1 | ✅ | — |
| E1 | ✅ | — |
| F1 | ⚠️ | **the group is resolved through a React context and cannot be named.** `RadioButtonContext` ([`RadioButton.tsx:38`](../../../../packages/noodl-viewer-react/src/components/controls/RadioButton/RadioButton.tsx#L38)) is the only binding, there is no `Group` port, and a Radio Button rendered outside a Radio Button Group gets `name: undefined`, `checked: false` forever and a click that short-circuits to nothing — visibly a control, functionally inert, with no resolution shown anywhere. Defect class F exactly |
| H1 | ✅ | declares `safe`; the context subscription is React's |

**Verdict:** ⚠️ defect — F1 is the headline and is the category's only instance of defect class F.
A1/A3 are the same asymmetry with `Checkbox` seen from the other end.

---

### Radio Button Group  `Radio Button Group`

33 inputs / 11 outputs · docs **91%** (40/44) · SSR `safe` · browser

Source: [`nodes/controls/radiobuttongroup.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/radiobuttongroup.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/radio-button-group)

| Check | Verdict | Note |
|---|---|---|
| A1 | 🔵 | as `Checkbox` — the `value` input setter flags the output and sends no `Changed`; the user path does |
| A2 | `n/a` | — |
| A3 | ✅ | both paths compare before flagging |
| G1 | ⚠️ | `value.toString !== undefined` on a `null` throws before the guard can help ([`radiobuttongroup.ts:82`](../../../../packages/noodl-viewer-react/src/nodes/controls/radiobuttongroup.ts#L82)) — the check reads the property *of* the value it is trying to defend against |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (44/44) | closed this session — 4 ports written |
| D1 | ✅ | `flexDirection` validates against `flexDirectionValues` |
| E1 | ✅ | — |
| F1 | 🔵 | it is the *provider* of the context `Radio Button` consumes; providing implicitly is the reasonable half of that pair |
| H1 | ✅ | declares `safe` |

**Verdict:** ⚠️ defect — G1. The guard at `:82` is one character away from correct
(`value?.toString`), and `null` on a `Value` port is what a cleared selection looks like.

---

### Slider  `net.noodl.controls.range`

92 inputs / 21 outputs · docs **40%** (45/113) · SSR `safe` · browser

Source: [`nodes/controls/slider.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/slider.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/slider)

| Check | Verdict | Note |
|---|---|---|
| A1 | 🔵 | the `value` input setter does not send `Changed`; the user path does. Same rule as the other controls |
| A2 | `n/a` | — |
| A3 | ⚠️ | `_updateOutputValuePercent` compares against `this._internal.valuePercentChanged` ([`slider.ts:205`](../../../../packages/noodl-viewer-react/src/nodes/controls/slider.ts#L205)) — a field nothing ever writes. It is always `undefined`, so the comparison is always true and `valuePercent` is flagged dirty on **every** value change whether the percentage moved or not. ⚠️ **PLAT-003 slice 10 found this exact bug and wrote it up — in the *deprecated* `range.tsx` ([`:401-404`](../../../../packages/noodl-viewer-react/src/nodes-deprecated/controls/range.tsx#L401-L404)), where it deliberately kept it verbatim — and never looked at the live node, which carries the identical code with no comment** |
| G1 | ⚠️ | `_setInputValue` uses `newValue \|\| 0` ([`:212`](../../../../packages/noodl-viewer-react/src/nodes/controls/slider.ts#L212)), so `null` **and a legitimate `0`** both become `0` — then clamped to `min`. A slider with `Min = 10` fed `null` silently reads 10 |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (113/113) | closed this session — **68 ports**, the category's largest block; ~60 of them in the private generators at [`slider.ts:225`](../../../../packages/noodl-viewer-react/src/nodes/controls/slider.ts#L225), `:325`, `:369` |
| D1 | ✅ | — |
| E1 | ⚠️ | **the `Value` input is declared `type: 'string'` and the `Value` output `type: 'number'`** ([`:63`](../../../../packages/noodl-viewer-react/src/nodes/controls/slider.ts#L63) vs [`:74`](../../../../packages/noodl-viewer-react/src/nodes/controls/slider.ts#L74)). One Slider cannot feed another without a type mismatch, and the panel offers a text field for a number |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe` |

**Verdict:** ⚠️ defect — A3, G1, E1, and the worst C1 in the category.

**The open question is answered: yes, the private copy has drifted, in four ways.** See
`DV-vi` in FINDINGS. One is reachable today (`borderWidth` defaults to **0** here and **2** in the
shared generator) and three are latent because nobody passes `defaults` to it. The per-edge
cascade the shared `_updateBorders` provides is **re-implemented** in
[`Slider.tsx:36-56`](../../../../packages/noodl-viewer-react/src/components/controls/Slider/Slider.tsx#L36-L56)
rather than missing — but that re-implementation has its own bug at `:45`, a stray assignment
inside a parenthesised expression that writes four invalid CSS keys (`trackBorderTopColor`, …)
into the style object alongside the correct ones.

---

### Text Input  `net.noodl.controls.textinput`

97 inputs / 21 outputs · docs **87%** (103/118) · SSR `safe` · browser

Source: [`nodes/controls/text-input.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/text-input)

| Check | Verdict | Note |
|---|---|---|
| A1 | ⚠️ | **`Clear` does not update `_internal.text`** ([`text-input.ts:219-224`](../../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L219-L224)). It blanks the props and the DOM and leaves the node's own copy holding the old string, so a later `Set` pulse restores text the user cleared. It also does not flag `onTextChanged` when the component is unmounted, which `setText` is careful to do |
| A2 | ✅ | `Set` re-reads `_internal.text` rather than a render-time copy |
| A3 | ✅ | `setText` skips while the field has focus, which is what stops a round-trip from fighting the typist |
| G1 | ⚠️ | `startValue` passes `null` straight through to `props.startValue` and into the `<input>`, which makes a controlled input uncontrolled |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | ⚠️ | four signal inputs. `Set`→`Text Changed` ✅, `Focus`→`Focused` ✅, `Blur`→`Blurred` ✅ — **`Clear` has no terminator**, and per A1 it does not even flag the value output when unmounted |
| C1 | ✅ **100%** (118/118) | closed this session — 15 ports written |
| D1 | ✅ | `type` is an enum |
| E1 | ✅ | — |
| F1 | ✅ | `startValue` defers to `Set` when `Set` is connected ([`:114`](../../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L114)) — the explicit-binding pattern, done right, and the category's only instance |
| H1 | ✅ | declares `safe`; the injected stylesheet is keyed by control id and browser-only |

**Verdict:** ⚠️ defect — A1/B3 on `Clear`, G1 on `startValue`. ⚠️ **A third `DV-ii` instance**:
`placeHolderOpacity` declares `0.5` and its setter is the only writer of the `::placeholder` rule
([`:84-93`](../../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L84-L93)), so
an untouched Text Input gets the browser's placeholder opacity instead. ⚠️ **`Dropdown` spells the
same port as an `inputProp` and it works** ([`options.ts:101`](../../../../packages/noodl-viewer-react/src/nodes/controls/options.ts#L101)) —
two nodes, one setting, two spellings (`placeHolderOpacity` vs `placeholderOpacity`), one broken.

---

### Page  `Page`

23 inputs / 9 outputs · docs **47%** (15/32) · SSR `safe` · browser · not in picker

Source: [`nodes/navigation/page.ts`](../../../../packages/noodl-viewer-react/src/nodes/navigation/page.ts)
· Docs: [link](https://docs.noodl.net/nodes/navigation/page)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ⚠️ | `Noodl.SEO.setMeta` is called for every meta tag **from the render body** ([`Page.tsx:150-153`](../../../../packages/noodl-viewer-react/src/components/navigation/Page/Page.tsx#L150-L153)), including for tags whose value is `undefined`. A discarded or double-invoked render therefore mutates document-level state |
| G1 | ✅ | `setMeta(key, undefined)` removes the tag, which is the correct clearing behaviour |
| B1 | ⚠️ **none** | — |
| B2 | ⚠️ | — |
| B3 | ✅ | `Page Ready` is the SSR handshake and terminates on the server side, not in the graph — the one signal input whose terminator is deliberately outside it |
| C1 | ✅ **100%** (32/32) | closed this session — 17 ports written |
| D1 | ⚠️ | **`urlPath`'s derived default is not sanitised for a URL.** [`page.ts:200`](../../../../packages/noodl-viewer-react/src/nodes/navigation/page.ts#L200) does `title.replace(/\s+/g, '-').toLowerCase()` and nothing else, so a component named `Order #1 & Co` proposes the path `order-#1-&-co` |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | `singleton: true`; `nodeScopeDidInitialize` was moved out of `initialize` precisely because connections are not wired during it |

**Verdict:** ⚠️ defect — and the headline is not in the table. ⚠️ **`Page`'s `Title` and `Url Path`
ports are dead.** `setup` derives a default for both and sends them as dynamic ports
([`page.ts:190-208`](../../../../packages/noodl-viewer-react/src/nodes/navigation/page.ts#L190-L208));
`registerInputIfNeeded` registers setters that write `_internal.title` / `_internal.urlPath`
([`:154-162`](../../../../packages/noodl-viewer-react/src/nodes/navigation/page.ts#L154-L162)); and
the only readers, `getTitle()` and `getUrlPath()` ([`:130-135`](../../../../packages/noodl-viewer-react/src/nodes/navigation/page.ts#L130-L135)),
**are called by nothing in the repository.** The Page Router routes from `routerIndex.pages` and
sets the document title from *its* copy ([`router.tsx:328`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L328)),
and `META_TAGS` has no `title` entry — so a Page node cannot set the browser tab title, though it
offers a `Title` port pre-filled with the component's name. `Noodl.SEO.setTitle` exists and this
node never calls it.

---

### Component Stack  `Page Stack`

9 inputs / 11 outputs · docs **60%** (12/20) · SSR **`partial`** · browser

Source: [`nodes/navigation/navigation-stack.tsx`](../../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx)
· Docs: [link](https://docs.noodl.net/nodes/component-stack/component-stack-node)

| Check | Verdict | Note |
|---|---|---|
| A1 | ✅ | `topPageName` and `stackDepth` are flagged from every push, pop and reset |
| A2 | ✅ | `Reset` re-reads `_internal.pages` |
| A3 | ✅ | navigations are serialised through `asyncQueue`, which is what stops two pushes in a frame from racing |
| G1 | ✅ | `useRoutes` is `!!`-coerced; `pages` empty is reported rather than dereferenced |
| B1 | ✅ | NDA-004 §2's `hasFailed` — the *caller* carries the port, which is the right owner |
| B2 | ✅ | codes and messages travel; NDA-008 §3 settled the ownership |
| B3 | ⚠️ | `Reset` is a signal input with **no terminating signal**. A reset-then-navigate graph has nothing to wait on, and reset builds a start page asynchronously |
| C1 | ✅ **100%** (20/20) | closed this session — 8 ports written |
| D1 | ✅ | `pages` is a `proplist`, not a bare string |
| E1 | ✅ | — |
| F1 | ✅ | the stack is named, and an unmatched name **queues** rather than dropping ([`navigation-handler.ts:56`](../../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-handler.ts#L56)) — a typo and a not-yet-mounted stack are genuinely indistinguishable at call time |
| H1 | ⚠️ | **`DV-iii`** — declares `partial`, which is honest, but `Clip Content` defaults to `true` and never clips: the setter at [`:258-266`](../../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx#L258-L266) is the only writer of `overflow: hidden` and the `defaultCss` has none |

**Verdict:** ⚠️ defect — `DV-iii` (H1) and B3. Everything NDA-004 §2 and NDA-008 touched is
sound; both remaining defects are in the parts those passes had no reason to look at.

---

### Page Router  `Router`

9 inputs / 11 outputs · docs **60%** (12/20) · SSR `safe` · browser

Source: [`nodes/navigation/router.tsx`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx)
· Docs: [link](https://docs.noodl.net/nodes/navigation/page-router)

| Check | Verdict | Note |
|---|---|---|
| A1 | ✅ | both outputs are flagged on every page change |
| A2 | ⚠️ | `resetAsync` decides whether anything changed by **identity** on the page-info object ([`router.tsx:292`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L292)). Editing a page's path or title in place leaves the identity intact, so an explicit `Reset` re-reads nothing |
| A3 | ✅ | serialised through `asyncQueue` |
| G1 | ⚠️ | see **RT-2**: `undefined === undefined` is read as "already on the right page" |
| B1 | ⚠️ **none** | **RT-1** — a routed component with no `Page` node is dropped by a bare `return` at [`:318-321`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L318-L321) |
| B2 | ⚠️ | nothing reaches any surface from the reset path — no `hasFailed` (reset carries no args), no `sendWarning`, no `raiseRuntimeError`. `navigateAsync` was given all of this in NDA-004 §2; `resetAsync` was not, and reset runs first |
| B3 | ⚠️ | `Reset` is a signal input with no terminating signal — same as `Component Stack` |
| C1 | ✅ **100%** (20/20) | closed this session — 8 ports written |
| D1 | ⚠️ | `_getLocationPath` decodes the whole path with `decodeURI` ([`:418`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L418)) and `_matchPathParts` then decodes each captured parameter again with `decodeURIComponent` ([`:484`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L484)). A parameter containing an encoded `/` or `%` is decoded twice and by two different rules |
| E1 | ✅ | — |
| F1 | ✅ | named, with the same queue-rather-than-drop reasoning as `Component Stack` |
| H1 | ⚠️ | **RT-1's node leak** — the component created at [`:314`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L314) is neither attached nor deleted on the bail. `popstate`/`hashchange` listeners **are** removed on unmount ([`:100-109`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L100-L109)), so the listener half is clean |

**Verdict:** ⚠️ defect — **the category's worst node, with four defects in one 60-line method**.
RT-1, RT-2 and RT-3 are measured and pinned in `nda-012-page-router-reset.test.ts`; RT-3 in
particular means a Page Router dropped on a canvas and not yet configured **throws a `TypeError`**
because `_internal.pages` is guarded on `:272` and dereferenced bare on `:284`, in the else branch
of the same `if`.

---

### Repeater  `For Each`

5 inputs / 2 outputs · docs **0%** (0/7) · SSR `safe` · browser

Source: [`nodes/std-library/data/foreach.tsx`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/repeater)

| Check | Verdict | Note |
|---|---|---|
| A1 | ✅ | `bindCollection` subscribes to the collection and every mutation path re-copies |
| A2 | ✅ | `Refresh` schedules a real re-read, not a re-render |
| A3 | ✅ | `scheduleRefresh` coalesces to one refresh per frame; item creation is deliberately spread across frames and now **announces** when it is done |
| G1 | ⚠️ | **`if (!value) return;`** ([`foreach.tsx:212`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L212)) — a truthiness test, which `DC-iii` warns against explicitly. `null` **abstains instead of clearing**, so a Repeater bound to a query that came back empty keeps showing the previous list indefinitely |
| B1 | ⚠️ **none** | — |
| B2 | ⚠️ | a `templateScript` syntax error goes to `editorConnection.sendWarning` and nowhere else ([`:255-262`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L255-L262)); a *runtime* throw inside the compiled function is caught at [`:351`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L351) and reported the same editor-only way. **This is the phase's most common shape and the handover predicted it here** |
| B3 | ✅ | `Refresh`→`Items Rendered`, added in NDA-004 §3, and it is the reason list-then-scroll no longer needs a guessed Delay |
| C1 | ✅ **100%** (7/7) | closed this session |
| D1 | ⚠️ | `templateScript` is compiled with `new Function` from a bare string with no validation beyond the try/catch. `template` is a `component` type and is not checked to exist |
| E1 | ⚠️ | `items` is `type: 'array'` |
| F1 | ✅ | the target is the graph parent, resolved through `setNodeModel`/`parentUpdated` ([`:295-311`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L295-L311)) and visible on the canvas as the wire itself |
| H1 | ✅ | `addDeleteListener` deletes every item node ([`:201-203`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L201-L203)) |

**Verdict:** ⚠️ defect — G1 is the sharp one and is a `DC-iii` regression in a node that pass did
not reach. B1/B2 and D1 are the Dynamic-template surface. 🔵 `templateScript`'s declared default
never runs its setter (DB-ii), so choosing Template Type = Dynamic without opening the Script
editor leaves `templateFunction` undefined and the Repeater renders nothing and says nothing
([`:347`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L347)) —
recorded as 🔵 rather than ⚠️ only because the default script is a `/MyComponent` placeholder that
would not have worked either. `templateType`'s own DB-ii instance **is** absorbed, at
[`:345`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L345),
where `undefined` is read as `explicit`.

---

### Component Children  `Component Children`

0 inputs / 0 outputs · docs **`n/a`** · SSR `safe` · browser · **no docs URL**

Source: [`noodl-runtime/src/nodelibraryexport.ts:354`](../../../../packages/noodl-runtime/src/nodelibraryexport.ts#L354)
· Docs: **none**

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | `n/a` | — |
| G1 | `n/a` | no ports to carry a value |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | `n/a` | — |
| C1 | **`n/a`** | **zero static ports — not 100%.** A ratio with no denominator is not full marks, and recording it as 100% would inflate the category |
| D1 | `n/a` | — |
| E1 | `n/a` | — |
| F1 | `n/a` | — |
| H1 | ✅ | `NodeScope.createNodeFromModel` intercepts it by name before any instance exists ([`nodescope.ts:161-168`](../../../../packages/noodl-runtime/src/nodescope.ts#L161-L168)) and sets the parent as the child root, so there is no lifecycle of its own to survive |

**Verdict:** ✅ pass, `n/a` throughout. It is a **marker**, not a node: it never becomes an
instance. ⚠️ It has **no docs URL**, which is the one real gap — it is in the picker and there is
nowhere to send an author who wonders what it does.

---

## Out of scope — the nine deprecated legacy form controls

Richard's standing decision keeps these deprecated and out of the picker. They are listed so the
file matches the catalog; **none of the twelve checks was run on any of them**, and that is
deliberate rather than unfinished.

| Node | Type | Ports | C1 | Verdict |
|---|---|---|---|---|
| Button | `Button` | 48/21 | 48% | ⬜ out of scope — deprecated |
| Checkbox | `Checkbox` | 39/21 | 48% | ⬜ out of scope — deprecated |
| Field Set | `Field Set` | 33/9 | 98% | ⬜ out of scope — deprecated |
| Form | `Form` | 33/10 | 95% | ⬜ out of scope — deprecated |
| Label | `Label` | 57/9 | 97% | ⬜ out of scope — deprecated |
| Options | `Options` | 52/21 | 55% | ⬜ out of scope — deprecated |
| Radio Button | `Radio Button` | 39/20 | 49% | ⬜ out of scope — deprecated |
| Range | `Range` | 40/22 | 47% | ⬜ out of scope — deprecated |
| Text Input | `Text Input` | 55/21 | 53% | ⬜ out of scope — deprecated |

---

## Category summary

| | Count |
|---|---|
| Nodes in scope | **20** |
| Audited | **20** |
| ✅ pass overall | 4 — `Text`, `Circle`, `Image`, `Component Children` |
| ⚠️ at least one defect | **16** |
| ⚠️ cells, excluding C1 | **41** |
| C1 at audit time | 80.0% (981/1227) |
| C1 now | **100% (1227/1227)** |
| Find rate, counting nodes | **0.80 defective nodes / node** |
| Find rate, counting ⚠️ cells | **2.05 / node** |

⚠️ **Do not compare this find rate with earlier categories.** Two of the counts moved for reasons
that have nothing to do with Visual being worse: `B1` was pre-filled incorrectly until last session
(§4.1), and `B3` was being read as "has any signal output" rather than as the check (see the top of
this file). `Navigation`'s 1.88/node was measured under the old B3 reading.

**Where they are, by check** — ⚠️ cells, so a node appears once per failing check:

| Check | ⚠️ | Nodes |
|---|---|---|
| ~~C1~~ | ~~17~~ → **0** | was everything except `Icon`; closed to 100% this session |
| B3 | **7** | Drag, Group, Video, Checkbox, Text Input, Component Stack, Page Router |
| G1 | **7** | Drag, Dropdown, Radio Button Group, Slider, Text Input, Repeater, Page Router |
| B1 + B2 | 6 (×2 cells) | Drag, Group, Dropdown, Page, Page Router, Repeater |
| A3 | 6 | Group, Video, Dropdown, Radio Button, Slider, Page |
| D1 | 4 | Columns, Page, Page Router, Repeater |
| E1 | 4 | Video, Slider, Dropdown, Repeater |
| H1 | 3 | Dropdown, Component Stack, Page Router |
| A1 | 2 | Radio Button, Text Input (four more are 🔵 — the controls' shared no-feedback-loop rule) |
| F1 | 1 | Radio Button |
| A2 | 1 | Page Router |

**Concentration**: `Page Router` (7 failing checks), `Dropdown` (6), `Repeater` (6) and `Slider` (5)
hold half of everything. `Page Router`'s are all in one 60-line method.

⚠️ **B3 is the category's real story**, and it was invisible until the check was read properly:
**seven of the eight nodes with action inputs cannot tell a graph the action finished.** That is a
single design gap, not seven bugs, and it is the same gap NDA-004 §3 closed for the Repeater —
which is now the only node in the category that gets it right.
