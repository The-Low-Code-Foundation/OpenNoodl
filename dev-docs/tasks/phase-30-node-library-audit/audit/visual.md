# Audit worksheet — Visual (29 nodes, **20 in scope**, 20 audited)

> ## Remediation stream B, 2026-08-01 (third session of the day)
>
> **Three fix items landed and a fourth was reverted. In-scope ⚠️ cells 34 → 27**, of which **7 are
> `B3` and belong to `ERG-001`** — so **20 per-node cells remain**. Nodes with a ⚠️ cell: 13 → **12**.
> ⚠️ That count is cell-based: `Slider` leaves it with all twelve cells clean while still carrying
> `DV-vi` in its verdict prose, so "no ⚠️ cell" is not the same as "nothing open".
>
> | Fix | Cells resolved |
> |---|---|
> | `Drag` and `Slider`'s `Value` ports — `DV-x` | Drag G1 · Slider G1 · Slider E1 |
> | `Text Input`'s `Clear` and `startValue` — `DV-xi` | A1 · G1 |
> | `Radio Button` and `Page` stop reporting from a render body — `DV-xii` | A3 · A3 |
> | ~~`Text Input`'s placeholder opacity~~ | **reverted — not a defect** |
>
> **`Slider`'s twelve cells are all clean** and its only remaining item is `DV-vi`, the drifted private
> `addBorderInputs`. **`Text Input`'s only remaining cell is `B3`**, which is `ERG-001`'s.
>
> ⚠️ **Live QA disproved one of the three claims in the middle commit, and that is the session's most
> useful result.** `Text Input`'s `placeHolderOpacity` was recorded here as a third `DV-ii` instance
> — declared `0.5`, setter never runs, so the browser default renders. A mirror was written into
> `initialize` on that reading and committed. Measured in a running preview with both injected
> per-instance rules deleted, the computed opacity is **still `0.5`**, because `assets/style.css`
> already carries the rule. **It is Button's case, not Icon's**, and the mirror moved no pixels. Now
> reverted, the cell is 🔵, and FINDINGS `DV-ii` carries the operational rule that would have caught
> it without a live run: **grep `assets/style.css` for a class rule carrying the same value before
> filing "the declared default does not render".**
>
> **Live QA, on a purpose-built fixture** (`scripts/nda-live-qa/make-controls-fixture.js`), zero
> renderer exceptions: Slider 60 → `null` → **60** and 60 → `'nearly there'` → **60** with the raise
> in the warnings panel naming the node; the `Value` input port reads `type: 'number'` off
> `window.NodeLibraryData`; Drag 240 → `null`/`'somewhere'` → **240**, likewise raising; Text Input
> Set → *"Ada Lovelace"* → Clear → empty → Set → **empty**; two radios reading `{dom, node}` in
> agreement, and clicking A's label flipping **both** nodes' `_internal.checked`.
>
> ⚠️ **`Page`'s A3 fix is test-verified and not live-verified.** `Page` is not in the picker and needs
> a Router to mount, and the claim that matters is about the *server* renderer, which no editor
> preview exercises. The three SSR-preserving rows carry it; a deployed SSG build would carry it
> better and is owed.

> ## Remediation stream A, 2026-08-01 (second session of the day)
>
> **Six fix items landed and 13 of the in-scope ⚠️ cells are resolved: 47 → 34.** Nodes carrying at
> least one defect: **15 → 13** (`Icon` and `Radio Button Group` are now clean; Icon's defect was
> recorded in its Verdict prose rather than a cell, so it does not show in the cell arithmetic).
>
> | Fix | Cells resolved |
> |---|---|
> | `Page Router`'s `resetAsync` — RT-1/RT-2/RT-3 | G1, B1, B2, H1 |
> | `Dropdown`'s `items` setter — one rewrite | A3, G1, H1, and B1/B2 dissolve with the crash |
> | `Repeater` clears on an empty `Items` | G1 |
> | `Icon`/`Button` padding — DV-ii | *(Verdict prose; Icon had no ⚠️ cell)* |
> | `Component Stack`'s `Clip Content` — DV-iii | H1 |
> | `Radio Button Group` G1 · `Slider` A3 | G1 · A3 |
>
> ⚠️ **The previously recorded totals of "31 defects / 41 ⚠️ cells" are not reproducible from this
> worksheet.** Counting ⚠️ cells in the in-scope section, excluding `C1`, gives **47** before this
> session. The 31 presumably collapsed the B1/B2/B3 groups into one defect each. **The 47 → 34 pair
> above is derived by one method over both revisions**, so those two numbers are comparable with each
> other and not with the earlier ones.
>
> ⚠️ **Live QA, and what it did and did not establish.** Confirmed in the running editor on a
> purpose-built project whose nodes carry only what an author would have typed: `Icon` computes
> `padding: 0px` and `Button` computes `padding: 5px 20px` (so DV-ii moved **no pixels**); an
> author-untouched `Component Stack` element now carries `overflow: hidden`; and an unconfigured
> `Page Router` **does not throw** and puts *"This Router has no Pages configured…"* in the editor's
> warnings panel with node provenance. ⚠️ **DV-iii's consequence was not observed** — the stack
> element had no mounted child, so the *mechanism* is measured and the clipping of a taller pushed
> component still follows by inference. That distinction is DV-ii's own rule.

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

**Verdict:** ✅ pass — **`DV-ii` fixed 2026-08-01 and the node is now clean.** `Icon` declared
5px padding on all four edges and rendered none of it: `addPaddingInputs` sets
`applyDefault: false`, which blocks the `startStyle` route, and DB-ii blocks the setter route.
**Measured live: `padding: 0px` on the node's own element, with no stylesheet rule supplying it** —
unlike `Button`, which was saved by a coincidence.

The declaration is **deleted** rather than made live, on both nodes, which removes the duplicate
instead of making two copies live. ⚠️ **No pixels move**: 0 is what Icon has always rendered, and
adding a 5px stylesheet rule now would shift every existing Icon on every canvas to satisfy a
declaration nothing had ever honoured. What changed is that the property panel stops showing a
number that reaches nothing. Pinned in `nda-012-visual-declared-defaults.test.ts`, which now also
ratchets that no padding port declares a non-zero default.

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
| G1 | ✅ | **fixed 2026-08-01** — both snap coordinates stored whatever arrived. ⚠️ **This cell's recorded consequence was wrong: `null` became 0, not `NaN`** — `easeOutCubic` computes `(end - start) * … + start`, so `null` coerced to zero and the element animated to the **origin**, which is worse than a visible `NaN` because it is a plausible position. `NaN` was the non-numeric-*string* case, and nothing coerces a declared `number` port on arrival. Now `undefined`/`null`/`''` abstain and leave the current position, and anything else non-numeric raises `drag/snap-position-not-a-number`. Live-verified: 240 → `null` → **240**, 240 → `'somewhere'` → **240** with the message in the warnings panel. Pinned in `nda-012-visual-value-ports.test.ts` |
| B1 | ⚠️ **none** | a `Do` before the component mounts is dropped by `this.innerReactComponentRef && …` ([`:42`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts#L42), `:74`) with no report |
| B2 | ⚠️ | nothing is reported anywhere, so the deployed case is no worse than the editor one — which is the point |
| B3 | ⚠️ | two signal inputs (`Snap To Position X/Y — Do`), **no terminating signal**. `Drag Started`/`Ended`/`Moved` are gesture events; nothing says the snap animation finished, which is precisely what a snap-then-do graph needs |
| C1 | ✅ **100%** (32/32) | closed this session — 18 ports written |
| D1 | ✅ | — |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | `addDeleteListener` stops the snap timers on delete ([`:28-30`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts#L28-L30)) — deleting a node does not unmount its component, so the component's own `componentWillUnmount` was not enough |

**Verdict:** ⚠️ defect — **G1 fixed 2026-08-01; B1/B2/B3 remain**, and B3 is `ERG-001`'s. ✅ The four mirrored defaults at
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
| A3 | ✅ | **fixed 2026-08-01** — re-sending the same collection added a second listener: the `off` was guarded by `this._internal.items !== newValue` and the `on` was not, so an identical re-set left two `change` handlers and every subsequent change re-rendered twice. The whole bind/unbind pair is now identity-guarded, the shape `ForEach` uses. Pinned in `nda-012-dropdown-items.test.ts` |
| G1 | ✅ | **fixed 2026-08-01** — `Items = null` threw, because `.on('change', …)` ran unguarded on the new value, and `null` is an ordinary arrival from a query that matched nothing. Per `EMPTY-VALUE-CONTRACT.md` `null` now clears and `undefined` abstains; a cleared Dropdown offers no options, which `Select` already rendered correctly. Pinned in `nda-012-dropdown-items.test.ts` |
| B1 | `n/a` | **dissolved 2026-08-01** — the crash *was* the failure surface, and there is no longer a failure: an empty `Items` is a legitimate value that clears the options. Nothing here can fail, so nothing needs a `Failure` port (NDA-004's rule) |
| B2 | `n/a` | **dissolved 2026-08-01** — was an uncaught `TypeError` in a setter with no code and no message. There is nothing left to report |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (111/111) | closed this session — 8 ports written |
| D1 | ✅ | the commented-out validation at [`:79-83`](../../../../packages/noodl-viewer-react/src/nodes/controls/options.ts#L79-L83) is deliberate — a value not in `items` deselects rather than being rejected |
| E1 | ⚠️ | `items` is `type: 'array'`, one of the category's two object/array ports |
| F1 | `n/a` | — |
| H1 | ✅ | **fixed 2026-08-01** — nothing removed the `change` listener, so a deleted Dropdown kept a live handler on the collection and called `forceUpdate` on a dead node. Closed with `addDeleteListener`, the shape `Drag` uses at [`drag.ts:28`](../../../../packages/noodl-viewer-react/src/nodes/visual/drag.ts#L28). Pinned in `nda-012-dropdown-items.test.ts` |

**Verdict:** ⚠️ defect — **the densest node in the category, and one rewrite closed all three
2026-08-01.** G1 (crash), A3 (duplicate listener) and H1 (leak) were three defects in one
eleven-line setter, and B1/B2 existed only to describe the crash, so five of the six cells are
resolved. **E1 remains** — `items` is `type: 'array'`, one of the category's two object/array ports,
which is a library-wide type question rather than this node's bug.

⚠️ The prediction that "all three would be closed by the same rewrite" held exactly. Subscribe and
unsubscribe now share one helper, so the guard cannot be applied on one side and forgotten on the
other — which is how the leak survived in the first place.

---

### Radio Button  `net.noodl.controls.radiobutton`

76 inputs / 19 outputs · docs **93%** (88/95) · SSR `safe` · browser

Source: [`nodes/controls/radiobutton.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/radiobutton.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/radio-button)

| Check | Verdict | Note |
|---|---|---|
| A1 | ⚠️ | **`Radio Button` has no `Changed` output at all**, unlike `Checkbox` and `Radio Button Group`. Selection can only be observed by polling `Checked` or by listening on the group |
| A2 | `n/a` | — |
| A3 | ✅ | **fixed 2026-08-01** — `props.checkedChanged(…)` was called **from the render body** and reached `flagOutputDirty('checked')` and `_updateVisualState()` ([`radiobutton.ts:39-46`](../../../../packages/noodl-viewer-react/src/nodes/controls/radiobutton.ts#L39-L46)), so a render React discarded or double-invoked moved graph state and repainted visual states for a checked-ness the committed tree never had. Now a `useEffect`. The `checked` **expression** stays in render and feeds the `<input>` — the DOM is a render output, not a side effect — and the duplicated inline copy is hoisted to one `const`. Live-verified: two radios in a group read `{dom:false,node:false}` / `{dom:true,node:true}`, and clicking A's label flips **both** nodes' `_internal.checked` with the DOM. Pinned in `nda-012-render-body-effects.test.tsx` |
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
**A3 fixed 2026-08-01; A1 and F1 remain**, and A1 is the same asymmetry with `Checkbox` seen from the
other end.

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
| G1 | ✅ | **fixed 2026-08-01** — was `value.toString !== undefined`, which threw on the `null` it was meant to defend against: the check read a property *of* the value it was guarding. Now `value?.toString`, so `null` falls through to the string guard and abstains, leaving the current selection alone. Pinned in `nda-012-control-one-liners.test.ts` |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (44/44) | closed this session — 4 ports written |
| D1 | ✅ | `flexDirection` validates against `flexDirectionValues` |
| E1 | ✅ | — |
| F1 | 🔵 | it is the *provider* of the context `Radio Button` consumes; providing implicitly is the reasonable half of that pair |
| H1 | ✅ | declares `safe` |

**Verdict:** ✅ pass — **G1 fixed 2026-08-01 and the node is now clean.** The guard was one
character away from correct (`value?.toString`), and `null` on a `Value` port is what a cleared
selection looks like.

---

### Slider  `net.noodl.controls.range`

92 inputs / 21 outputs · docs **40%** (45/113) · SSR `safe` · browser

Source: [`nodes/controls/slider.ts`](../../../../packages/noodl-viewer-react/src/nodes/controls/slider.ts)
· Docs: [link](https://docs.noodl.net/nodes/ui-controls/slider)

| Check | Verdict | Note |
|---|---|---|
| A1 | 🔵 | the `value` input setter does not send `Changed`; the user path does. Same rule as the other controls |
| A2 | `n/a` | — |
| A3 | ✅ | **fixed 2026-08-01** — compared against `this._internal.valuePercentChanged`, a field nothing ever writes, so it was always `undefined`, the comparison was always true, and `valuePercent` was flagged dirty on **every** value change whether the percentage moved or not. Now compares against `_internal.valuePercent`. ⚠️ PLAT-003 slice 10 found this exact bug, wrote it up, and kept it verbatim in the *deprecated* `range.tsx` without ever looking at the live node. Pinned in `nda-012-control-one-liners.test.ts` |
| G1 | ✅ | **fixed 2026-08-01** — `_setInputValue` used `newValue \|\| 0`, so `null` and a legitimate `0` were one arrival (both clamped to `Min`; a slider with `Min = 10` fed `null` silently read 10), and anything non-numeric survived `\|\|` to become `NaN` at `Math.min` with nothing said anywhere. Empty arrivals now abstain, non-numbers raise `slider/value-not-a-number`. Live-verified: 60 → `null` → **60**, 60 → `'nearly there'` → **60** with *"Value cannot be read as a number… At node Slider in component App"* in the warnings panel. ⚠️ `initialize` seeds `props.value = props.min`, so a row that never moves the handle cannot tell "abstained" from "clamped to `Min`" — see the rows in `nda-012-visual-value-ports.test.ts` |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | `n/a` | no signal inputs |
| C1 | ✅ **100%** (113/113) | closed this session — **68 ports**, the category's largest block; ~60 of them in the private generators at [`slider.ts:225`](../../../../packages/noodl-viewer-react/src/nodes/controls/slider.ts#L225), `:325`, `:369` |
| D1 | ✅ | — |
| E1 | ✅ | **fixed 2026-08-01** — the `Value` input was declared `type: 'string'` while the `Value` output is `type: 'number'`, so one Slider could not feed another and the panel offered a text field for a number. That is also *why* G1's `NaN` path was reachable from ordinary authoring. Now `number`; `string → number` is in the typecast table (`nodelibraryexport.ts`), so existing textual connections still land. Live-verified against `window.NodeLibraryData` |
| F1 | `n/a` | — |
| H1 | ✅ | declares `safe` |

**Verdict:** ⚠️ defect — **every one of Slider's twelve cells is now clean** (A3, G1 and E1 all fixed
in this phase, C1 closed, A1 🔵), **and `DV-vi` below is still open**, which is why the node is not
listed as a pass. The remaining defect is prose rather than a cell, and it is the private
`addBorderInputs` copy.

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
| A1 | ✅ | **fixed 2026-08-01** — `clear()` blanked the props and the DOM and left `_internal.text` holding the old string, and `Set` reads `_internal.text`, so **a later `Set` pulse restored text the author had explicitly cleared**; it also did not flag `onTextChanged` while unmounted, which `setText` beside it is careful to do. Live-verified: Set → *"Ada Lovelace"*, Clear → empty, Set → **empty**. ⚠️ `Clear` still writes through a **focused** field where `setText` deliberately does not; both directions are pinned, because "make the two paths consistent" is what a tidying pass would do and it would break Clear for the person using it. Pinned in `nda-012-text-input-clear.test.ts` |
| A2 | ✅ | `Set` re-reads `_internal.text` rather than a render-time copy |
| A3 | ✅ | `setText` skips while the field has focus, which is what stops a round-trip from fighting the typist |
| G1 | ✅ | **fixed 2026-08-01** — `startValue` passed `null` straight through to `props.startValue` and into the `<input>`'s `value` ([`TextInput.tsx:66`](../../../../packages/noodl-viewer-react/src/components/controls/TextInput/TextInput.tsx#L66)), which makes a controlled input uncontrolled, and `null` is an ordinary arrival from a query that matched nothing. `null` now **clears** and `undefined` abstains. ⚠️ Deliberately *not* the treatment `Drag` and `Slider` got in the same batch: a string port has a representable empty value (`EMPTY-VALUE-CONTRACT.md`'s `E1`/`E2` rule) and a position does not. Pinned in `nda-012-text-input-clear.test.ts` |
| B1 | `n/a` | — |
| B2 | `n/a` | — |
| B3 | ⚠️ | four signal inputs. `Set`→`Text Changed` ✅, `Focus`→`Focused` ✅, `Blur`→`Blurred` ✅ — **`Clear` has no terminator**, and per A1 it does not even flag the value output when unmounted |
| C1 | ✅ **100%** (118/118) | closed this session — 15 ports written |
| D1 | ✅ | `type` is an enum |
| E1 | ✅ | — |
| F1 | ✅ | `startValue` defers to `Set` when `Set` is connected ([`:114`](../../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L114)) — the explicit-binding pattern, done right, and the category's only instance |
| H1 | ✅ | declares `safe`; the injected stylesheet is keyed by control id and browser-only |

**Verdict:** ⚠️ defect — **A1 and G1 fixed 2026-08-01; only `B3` remains and it is `ERG-001`'s**, so
this node's own work is done.

🔵 **The third `DV-ii` instance is not a defect, and finding that out cost a commit and a revert.**
`placeHolderOpacity` declares `0.5`, its setter is the only writer of the injected `::placeholder`
rule ([`:84-93`](../../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L84-L93)),
and DB-ii blocks that setter — so this worksheet recorded "an untouched Text Input gets the browser's
placeholder opacity". A mirror went into `initialize` on that reading and was committed. ⚠️ **Measured
live, with both injected per-instance rules deleted from a running preview, the computed opacity is
still `0.5`**: `assets/style.css` carries `.ndl-controls-textinput::placeholder { opacity: 0.5 }`,
exactly as it carries Button's padding. **This is Button's case, not Icon's**, the mirror moved no
pixels, and it is reverted.

⚠️ That makes it the *third* time in this category that a `DV-ii` mechanism was read as a rendering
defect — and the second time it was disproved by running it. The operational form of the rule is now
in FINDINGS `DV-ii`: **before filing "the declared default does not render", grep `assets/style.css`
for a class rule carrying the same value.** One query, available both times, run neither time.

The real duplication survives and is pinned from both sides: the value lives in the stylesheet and in
the port default, they agree, and editing either alone fails a row. ⚠️ **`Dropdown` spells the same
setting `placeholderOpacity` as an `inputProp`** ([`options.ts:142`](../../../../packages/noodl-viewer-react/src/nodes/controls/options.ts#L142)),
where the default→props copy applies it and `Select.tsx:129` renders it — two nodes, one setting, two
spellings, two mechanisms, and (as it turns out) the same rendered result.

---

### Page  `Page`

23 inputs / 9 outputs · docs **47%** (15/32) · SSR `safe` · browser · not in picker

Source: [`nodes/navigation/page.ts`](../../../../packages/noodl-viewer-react/src/nodes/navigation/page.ts)
· Docs: [link](https://docs.noodl.net/nodes/navigation/page)

| Check | Verdict | Note |
|---|---|---|
| A1 | `n/a` | — |
| A2 | `n/a` | — |
| A3 | ✅ | **fixed 2026-08-01** — `Noodl.SEO.setMeta` was called for all fourteen meta tags **from the render body**, and in a browser that mutates `document.head`, so a discarded or double-invoked render changed document-level state for a tree never committed. ⚠️ **The obvious fix would have been worse than the defect**: SSR renders with `ReactDOMServer.renderToString` and **effects never run**, while `injectSeo` builds the served `<head>` out of the buffer `setMeta` fills — an unconditional move into `useEffect` empties the meta tags of every SSR and SSG page, and `ssr-inject-seo.test.js` stays green because it tests the string transform and not the producer. So the render body stays the path **on the server** and the browser writes after commit. Three of the six rows in `nda-012-render-body-effects.test.tsx` are the SSR-preserving controls, green at baseline on purpose |
| G1 | ✅ | `setMeta(key, undefined)` removes the tag, which is the correct clearing behaviour |
| B1 | ⚠️ **none** | — |
| B2 | ⚠️ | — |
| B3 | ✅ | `Page Ready` is the SSR handshake and terminates on the server side, not in the graph — the one signal input whose terminator is deliberately outside it |
| C1 | ✅ **100%** (32/32) | closed this session — 17 ports written |
| D1 | ⚠️ | **`urlPath`'s derived default is not sanitised for a URL.** [`page.ts:200`](../../../../packages/noodl-viewer-react/src/nodes/navigation/page.ts#L200) does `title.replace(/\s+/g, '-').toLowerCase()` and nothing else, so a component named `Order #1 & Co` proposes the path `order-#1-&-co` |
| E1 | ✅ | — |
| F1 | `n/a` | — |
| H1 | ✅ | `singleton: true`; `nodeScopeDidInitialize` was moved out of `initialize` precisely because connections are not wired during it |

**Verdict:** ⚠️ defect — **A3 fixed 2026-08-01; B1/B2 and D1 remain** — and the headline is not in the
table. ⚠️ **`Page`'s `Title` and `Url Path`
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
| H1 | ✅ | **`DV-iii` fixed 2026-08-01** — `Clip Content` defaults to `true` and never clipped: its setter was the only writer of `overflow: hidden` and a declared default never runs its setter (DB-ii), while `defaultCss` had none. `overflow: 'hidden'` is now in `defaultCss`, the one route applied at initialize, so the panel and the rendering agree. Unticking still reaches `removeStyle`, which deletes from the same style object. Both directions pinned in `nda-012-visual-declared-defaults.test.ts`. The `partial` SSR declaration was always honest and is unchanged |

**Verdict:** ⚠️ defect — **`DV-iii` (H1) fixed 2026-08-01; B3 remains** and belongs to
`ERG-001`, which owns completion signals for the whole Visual family as one collision sweep.
Everything NDA-004 §2 and NDA-008 touched is sound.

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
| G1 | ✅ | **RT-2 fixed 2026-08-01** — `getPageInfoForComponent` returns `ComponentPageInfo | undefined`, and `resetAsync` compared it against the current page by identity, so on a fresh router `undefined === undefined` read as "already on the right page": the router built nothing, rendered nothing and said nothing, on every reset. A start page missing from the index gave a permanently blank router with no diagnostic. The target is now resolved before comparing and an unresolvable one raises `router/page-not-found`. Pinned in `nda-012-page-router-reset.test.ts` |
| B1 | ✅ | **RT-1 fixed 2026-08-01** — a routed component with no `Page` node (or two) was created, assigned to `currentPageComponent`, then dropped by a bare `return`. It is now deleted and reported as `router/component-is-not-a-page` with the count, and the stale `currentPage` is cleared — the children are torn down before the component is built, so leaving it set let the identity check absorb the next reset back to that page, which is RT-2's symptom through a second door |
| B2 | ✅ | **RT-3 and the reporting gap fixed 2026-08-01** — nothing reached any surface from the reset path: no `hasFailed` (reset carries no args), no `sendWarning`, no `raiseRuntimeError`, while `navigateAsync` had been given all of it in NDA-004 §2 and reset runs *first*. All four drops now raise on the runtime error bus (`FAILURE-CONTRACT.md`): `router/no-pages`, `router/no-start-page`, `router/page-not-found`, `router/component-is-not-a-page`. ⚠️ RT-3 was the worst of them — a Page Router dropped on a canvas and not yet configured **threw a `TypeError`**, because the start-page read existed twice, guarded on `:280` and bare on `:292`, in the else branch of the same `if`. It is one read now |
| B3 | ⚠️ | `Reset` is a signal input with no terminating signal — same as `Component Stack` |
| C1 | ✅ **100%** (20/20) | closed this session — 8 ports written |
| D1 | ⚠️ | `_getLocationPath` decodes the whole path with `decodeURI` ([`:418`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L418)) and `_matchPathParts` then decodes each captured parameter again with `decodeURIComponent` ([`:484`](../../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L484)). A parameter containing an encoded `/` or `%` is decoded twice and by two different rules |
| E1 | ✅ | — |
| F1 | ✅ | named, with the same queue-rather-than-drop reasoning as `Component Stack` |
| H1 | ✅ | **RT-1's node leak fixed 2026-08-01** — the component created before the `Page`-node check is now deleted on the bail rather than left unattached and undeleted. `popstate`/`hashchange` listeners were already removed on unmount, so the listener half was always clean |

**Verdict:** ⚠️ defect — **it was the category's worst node with four defects in one 60-line
method, and all four are fixed 2026-08-01.** RT-1, RT-2 and RT-3 were pinned in
`nda-012-page-router-reset.test.ts` with a control beside each; every row is now flipped to assert
the fix and the controls are kept. **Three cells remain and none of them is in `resetAsync`:**

- **A2** — the change test is still identity on the page-info object, so editing a page's path or
  title *in place* leaves the identity intact and an explicit `Reset` re-reads nothing. Deliberately
  untouched: the fix is about *when the object is missing*, not about comparing objects by value.
- **B3** — `Reset` is a signal input with no terminating signal. `ERG-001` owns it, with the other
  seven Visual nodes, as one collision sweep.
- **D1** — the double decode: `_getLocationPath` decodes the whole path with `decodeURI` and
  `_matchPathParts` decodes each captured parameter again with `decodeURIComponent`.

⚠️ **The line numbers in this block's original citations had drifted by eight** (`:272`/`:284` were
`:280`/`:292` by the time the fix was written). Same two reads, same `if`/`else`. **Re-verify a
citation against the code before working from it**, even one written in the same phase.

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
| G1 | ✅ | **fixed 2026-08-01** — was `if (!value) return;`, the truthiness test `DC-iii` warns against explicitly, so `null` abstained instead of clearing and a Repeater bound to a query that came back empty kept showing the previous list indefinitely. ✅ **Richard decided it clears** — empty array, `null`, anything falsy. ⚠️ The guard had a **second half** in `scheduleCopyItems`, which bailed on `items === undefined`; both are gone. ⚠️ Deliberate recorded divergence from `EMPTY-VALUE-CONTRACT.md`, whose table has `undefined` abstaining; stated on the port's `description`. Pinned in `nda-012-repeater-clears.test.ts` |
| B1 | ⚠️ **none** | — |
| B2 | ⚠️ | a `templateScript` syntax error goes to `editorConnection.sendWarning` and nowhere else ([`:255-262`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L255-L262)); a *runtime* throw inside the compiled function is caught at [`:351`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L351) and reported the same editor-only way. **This is the phase's most common shape and the handover predicted it here** |
| B3 | ✅ | `Refresh`→`Items Rendered`, added in NDA-004 §3, and it is the reason list-then-scroll no longer needs a guessed Delay |
| C1 | ✅ **100%** (7/7) | closed this session |
| D1 | ⚠️ | `templateScript` is compiled with `new Function` from a bare string with no validation beyond the try/catch. `template` is a `component` type and is not checked to exist |
| E1 | ⚠️ | `items` is `type: 'array'` |
| F1 | ✅ | the target is the graph parent, resolved through `setNodeModel`/`parentUpdated` ([`:295-311`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L295-L311)) and visible on the canvas as the wire itself |
| H1 | ✅ | `addDeleteListener` deletes every item node ([`:201-203`](../../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L201-L203)) |

**Verdict:** ⚠️ defect — **G1, the sharp one and a `DC-iii` regression in a node that pass did
not reach, is fixed 2026-08-01. B1/B2, D1 and E1 remain** and are the Dynamic-template surface plus
the `array` port type. 🔵 `templateScript`'s declared default
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
| ✅ pass overall | 6 — `Text`, `Circle`, `Image`, `Component Children`, and `Icon` + `Radio Button Group` from stream A |
| ⚠️ at least one defect | **16** at audit time; **12** after streams A and B |
| ⚠️ cells, excluding C1 | **41** as first counted — ⚠️ **not reproducible; see the note at the top of this file.** One method over the same section gives **47** at audit time, **34** after stream A and **27** after stream B |
| C1 at audit time | 80.0% (981/1227) |
| C1 now | **100% (1227/1227)** |
| Find rate, counting nodes | **0.80 defective nodes / node** |
| Find rate, counting ⚠️ cells | **2.05 / node** |

⚠️ **Do not compare this find rate with earlier categories.** Two of the counts moved for reasons
that have nothing to do with Visual being worse: `B1` was pre-filled incorrectly until last session
(§4.1), and `B3` was being read as "has any signal output" rather than as the check (see the top of
this file). `Navigation`'s 1.88/node was measured under the old B3 reading.

**Where they are, by check** — ⚠️ cells, so a node appears once per failing check:

**At audit time**, with what streams A and B have since closed struck through:

| Check | ⚠️ | Nodes |
|---|---|---|
| ~~C1~~ | ~~17~~ → **0** | was everything except `Icon`; closed to 100% at audit time |
| B3 | **7** | Drag, Group, Video, Checkbox, Text Input, Component Stack, Page Router — **all `ERG-001`'s** |
| G1 | 7 → **0** | ~~Drag~~, ~~Dropdown~~, ~~Radio Button Group~~, ~~Slider~~, ~~Text Input~~, ~~Repeater~~, ~~Page Router~~ — **the check is closed for the category** |
| B1 + B2 | 6 → **4** (×2 cells) | Drag, Group, ~~Dropdown~~, Page, ~~Page Router~~, Repeater |
| A3 | 6 → **2** | Group, Video, ~~Dropdown~~, ~~Radio Button~~, ~~Slider~~, ~~Page~~ |
| D1 | 4 | Columns, Page, Page Router, Repeater |
| E1 | 4 → 3 | Video, ~~Slider~~, Dropdown, Repeater |
| H1 | 3 → 0 | ~~Dropdown~~, ~~Component Stack~~, ~~Page Router~~ |
| A1 | 2 → 1 | Radio Button, ~~Text Input~~ (four more are 🔵 — the controls' shared no-feedback-loop rule) |
| F1 | 1 | Radio Button |
| A2 | 1 | Page Router |

⚠️ **Both revised counts above were wrong when first written, in the same direction** (A3 as 3 and
B1/B2 as 5), and the arithmetic that caught them is one shell command over this file's own tables —
worth running rather than re-deriving:

```bash
awk '/^## In scope/{f=1} /^## Out of scope/{f=0} f' audit/visual.md \
  | grep -E "^\| (A1|A2|A3|G1|B1|B2|B3|D1|E1|F1|H1) \| ⚠️" \
  | sed -E 's/^\| ([A-Z0-9]+) \|.*/\1/' | sort | uniq -c | sort -rn
```

**A summary of a worksheet should be derived from the worksheet, not maintained beside it** — which is
the same failure the "31 defects / 41 cells" figure at the top of this file records, one revision on.

⚠️ **`G1` and `H1` are the two checks the category has closed outright, and they closed for opposite
reasons.** `H1` was three separate leaks. `G1` was **one question asked seven times** — what does this
port do when handed nothing — and the seven answers were seven different wrong ones: a crash, a throw
from the guard itself, a truthiness test, `|| 0`, a raw store, an identity compare and a pass-through
into the DOM. **A check that closes to zero across a category is worth reading as a class before it is
filed as a list**, which is `DV-viii`'s lesson for `B3` arriving at the same place from the other end.

**Concentration**: `Page Router` (7 failing checks), `Dropdown` (6), `Repeater` (6) and `Slider` (5)
hold half of everything. `Page Router`'s are all in one 60-line method.

⚠️ **B3 is the category's real story**, and it was invisible until the check was read properly:
**seven of the eight nodes with action inputs cannot tell a graph the action finished.** That is a
single design gap, not seven bugs, and it is the same gap NDA-004 §3 closed for the Repeater —
which is now the only node in the category that gets it right.
