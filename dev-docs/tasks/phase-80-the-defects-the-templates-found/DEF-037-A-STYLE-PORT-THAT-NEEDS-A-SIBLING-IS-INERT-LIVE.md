# DEF-037 — a style port whose effect needs a sibling property does nothing until the preview reloads

**Found by** DEF-031's drive, [§6.3](DEF-031-A-TEXT-CANNOT-BE-ELLIPSIZED.md). **Status ✅ BUILT + DRIVEN s37.**
**Owner: phase 80.** AC1, AC2, AC3, AC4, AC5, AC6 all taken — see §8.

---

## 1. The person sentence

Someone sets **Text Overflow → Ellipsis** on a label that is wrapping onto a second line and
breaking their row alignment. **Nothing happens.** They set it back to **Wrap**. Nothing happens
either. The port is doing its job perfectly — but only after the preview is reloaded, and nothing
on screen says so.

## 2. The mechanism

`Text.tsx` decides three properties together (DEF-031 §2): a truncating `textOverflow` also forces
`white-space: nowrap` and supplies `overflow: hidden`; the wrapping arm instead sets
`white-space: pre-wrap` + `overflow-wrap: anywhere` and **deletes** `style.textOverflow`.

The live-preview path patches **the port's own declaration onto the element** and does not run the
render. So the derived siblings never change:

| set live | DOM afterwards | what the author sees |
| --- | --- | --- |
| `wrap → ellipsis` | `text-overflow: ellipsis` **+ `white-space: pre-wrap`** | still wraps — port looks broken |
| `ellipsis → wrap` | `text-overflow: ellipsis`, `nowrap`, `hidden` | still truncated — port looks stuck |

Both measured in a real editor's live preview, session 35.

## 3. ✅ The control — it is not "style ports don't update live"

`wordBreak`, the **pre-existing** sibling `inputCss` port on the same node, set the same way in the
same session, **applied immediately** (`word-break: break-all`). The live-patch path works.

🔴 **The difference is derivation, not liveness.** `wordBreak` *is* its own CSS declaration.
`textOverflow` only means something in company with properties the render computes. **It is the
first `Text` style port of that kind**, which is why nothing caught this before.

## 4. What is NOT known — say it before quoting this row

- ⚠️ **The population is one port, measured.** Whether any other `inputCss` port on any other node
  derives a sibling in render has **not been swept**. The obvious next measurement is to grep the
  visual components for style properties written outside the direct `inputCss` fold.
- ⚠️ **The reload does fix it**, and the parameter persists correctly (`"textOverflow": "ellipsis"`
  verified in `project.json`), so this is a feedback-loop defect, not a correctness one.
- ⚠️ **Not measured against the deployed/exported app at all** — only the editor's live preview.

## 5. Acceptance criteria

- **AC1** Setting a truncating `Text Overflow` in a running preview makes the label truncate
  without a reload.
- **AC2** Setting it back to `Wrap` restores wrapping in a running preview without a reload.
- **AC3** 🔁 **REWRITTEN 2026-08-31 (session 37), and the old text is kept below because
  quoting it would now point the wrong way.** A control port that needs no sibling (`wordBreak`)
  still applies live, **and no `inputCss` port anywhere is inert in a running preview** — the
  panel and the preview agree for every style port, not for an enumerated list of them.
  - 🚫 **The old AC3 read**: *"the fix must not be 're-render the whole preview on every
    style change'."* 🔴 **That was a previous session's constraint, not Richard's, and the
    ruling supersedes it** — *"the preview is supposed to be a true, live, auto updating view of
    what's in the node canvas at all times."* **Do not try to satisfy both**; a fix that keeps a
    port inert in order to avoid a re-render is the defect, not a trade-off.
  - ✅ **Performance is still a constraint, but a narrower one**: it protects a **wire or
    animation driving a style per frame**, not an author changing a parameter at human speed.
- **AC4** ✅ **CLOSED s36** — the sweep in §4 is taken; see §7.
- **AC5** Driven in a real editor, both directions, without a reload.
- **AC6** 🆕 **The three instances §7.3 found by reading source are driven, or their
  inertness is disproved.** ⚠️ They are candidates of the same class, **not measured
  defects** — Radio Button's `width`/`height` are the known-firing control.

## 6. Traps this row paid for

- 🔴 **An impossible DOM combination is a signal about the PATH, not the fix.** `ellipsis` beside
  `pre-wrap` cannot come out of `Text.tsx` — the wrapping arm deletes `textOverflow`. Reading that
  as "the fix does not work" would have reopened a correct row and hidden a real one.
- 🔴 **A control from the same family is what separates "this port" from "all ports".** Without
  `wordBreak` applying live, this row would have been filed as a platform-wide defect it is not.

---

## 7. ✅ **AC4 — the sweep, taken (session 36)**

### 7.1 🔴 The mechanism is not where §2 puts it, and the difference matters

§2 says *"the live-preview path patches the port's own declaration onto the element"*. The patching
is real; **"the live-preview path" is the wrong owner.** It is
`packages/noodl-viewer-react/src/react-component-node.ts` → `setStyle()`, the setter the compiler
generates for **every** `inputCss` port (`react-component-node.ts:1933-1985`). It writes the style
object, then:

- **force-updates React** only for a hard-coded allowlist — `opacity` crossing the zero boundary,
  a margin change *while the size is a percentage*, or `position` / `flexDirection` / `clip`;
- otherwise calls `setStylesOnDOMNode(...)`, patching **only the changed declaration** onto the
  node and never re-running render.

Its own comment says so, and carries a `TODO` proposing exactly the fix this row needs: *"move all
these checks to the inputs themselves"*.

🔴 **Consequence §4 should be corrected on:** the row currently reads as an editor feedback-loop
defect ("not measured against the deployed/exported app at all"). `setStyle` is the runtime's
generic path, so **a wire driving such a port at runtime hits this in a deployed app too.**
`textOverflow` is a connectable input. Still not *measured* there — but it is no longer reasonable
to assume the deployed app is unaffected.

🔴 **A `styleTag` port skips the allowlist entirely.** The whole force-update block is inside
`if (!styleTag)`. A port with a `styleTag` can therefore *only* re-render through its own
`onChange` — which makes every styleTag'd derived port a candidate by construction.

### 7.2 ✅ The fix already exists in the codebase, and is used on purpose

`inputCss` ports may carry `onChange`, and the generated setter calls it. **Six ports already use
it to force a re-render for precisely this reason** — a known-firing control for the whole class:

| port | node | why |
| --- | --- | --- |
| `flexWrap` | Group | `onChange` comment: *"scroll direction needs to be recomputed"* |
| `width`, `height` | **Radio Button** | render derives the wrapper's size from them |
| `fontSize` | Button, Options, Text Input *(deprecated)* | — |

### 7.3 The population — every `inputCss` port whose render derives a sibling

34 distinct `inputCss` port names across 18 files were enumerated, then every render-time read of a
style value was found (`props.style` / `props.styles.<tag>` in the components). The result:

| port(s) | node | what render derives from it | status |
| --- | --- | --- | --- |
| `textOverflow` | Text | `whiteSpace`, `overflow`, `overflowWrap`; deletes itself | 🔴 **this row — driven** |
| `width`, `height` | **Checkbox** | copied onto the inner `<input>`'s own style (`Checkbox.tsx:56-57`) | 🔴 **NEW — no `onChange`** |
| `borderColor` | **Checkbox** | the tick glyph's `color` (`Checkbox.tsx:135`) | 🔴 **NEW — no `onChange`** |
| `borderColor` | **Radio Button** | the dot's colour (`RadioButton.tsx:144`) | 🔴 **NEW — no `onChange`** |
| `width`, `height` | Radio Button | wrapper size (`RadioButton.tsx:91,106,189`) | ✅ has `onChange` |
| `flexWrap` | Group | inner iScroll child's style (`Group.tsx:257`) | ✅ has `onChange` |
| `position`, `marginTop/Bottom/Left/Right` | all visual | `layout.ts` derives `flexGrow`/size-with-margins | ✅ allowlist covers it |

🔴 **The sharpest finding is an asymmetry between two sibling nodes.** `Checkbox`'s `Width`/`Height`
and `Radio Button`'s `Width`/`Height` are declared **the same way** — same index, same group, same
`default: 32`, same `styleTag` mechanism, and both are read at render into a *different* element's
style. Radio Button's carry `onChange(){ this.forceUpdate(); }`. Checkbox's do not. One of the two
was fixed and the other was not, and nothing in either file says why.

### 7.4 ⚠️ What this sweep is and is not

- ✅ **The absence has a known-firing control beside it**, as AC4 requires: Radio Button's
  `width`/`height` are the same shape *with* the fix, so "no `onChange` here" is a real difference
  and not an artefact of how the search was written.
- ⚠️ **The three NEW rows are read from source, not driven.** They are candidates of the same
  class, not measured defects. Only `textOverflow` has been seen inert in a running preview.
- ⚠️ **What the metric cannot see**: a derivation that reads a style value through a helper rather
  than naming the property; anything reached only via `updateAdvancedStyle`; CSS-class toggles
  keyed on a port; and the deprecated `nodes-deprecated/` components beyond the `fontSize` three.
- ⚠️ The extractor that produced the 34-port list was **wrong on its first run** (it dropped the
  first key of every object literal) and was caught only because two ports whose presence was known
  by hand — `opacity` and the `textOverflow`/`wordBreak` pair — came back missing. The corrected run
  reproduces both.

### 7.5 What this suggests for the fix

The `TODO` in `setStyle` and the six existing `onChange`s point the same way: **the per-port
escape hatch is the shipped mechanism**, and AC3 (a control port that needs no sibling must still
apply live) is satisfied for free by using it rather than by re-rendering on every style change.
The open question is whether to hand-annotate the four remaining ports or to derive the answer —
🧭 **a decision, and it should be taken with §7.3's table in front of whoever takes it.**


---

## 8. ✅ BUILT AND DRIVEN — session 37

🧭 **Richard ruled the shape on 2026-08-31** (the ruling itself said *derive it*; the **shape** was
offered and not ruled, and was put to him this session): **always re-render on an editor-driven
change, and always re-render for a `styleTag`'d port.** Both halves shipped in `e1ea7f09`.

### 8.1 The two halves, and why each is a class rather than a list

| half | where | what it covers |
| --- | --- | --- |
| **editor-driven** | `node.ts` `_onNodeModelParameterUpdated` → `_scheduleEditorDrivenRerender` | every parameter an author changes, on every node type |
| **`styleTag`'d** | `react-component-node.ts` `setStyle` | every tagged port, **including one driven by a wire in a deployed app** |

✅ **The editor half had a known-firing control already in the file.** The *reset* branch of
`_onNodeModelParameterUpdated` has called `_resetReactVirtualDOM` since long before this row, and
its comment describes this exact bug. **Only the set branch was missing it.**
⚠️ Deliberately weaker than `_resetReactVirtualDOM`, which mints a new React key and **remounts** —
that would discard focus, scroll and video state on every keystroke in the property panel.

🔴 **`styleTag` is the right derivation, not a proxy for one.** Every force-update check in
`setStyle` lives inside `if (!styleTag)`, so a tagged port had **no safety net at all** — which is
*how* the defect was distributed: Checkbox's `Width` and Radio Button's `Width` are declared
identically and only Radio Button carried the `onChange`. A tagged style is by construction one the
component re-reads at render onto a different inner element. **The hot path the DOM patch exists for
— a wire animating `opacity`/`transform` per frame — is untagged and keeps it.**
⚠️ The population is small and contained: `styleTag` appears in **5 files**
(`node-shared-port-definitions`, `checkbox`, `radiobutton`, `text-input`, `options`).

### 8.2 ✅ The drive — AC1, AC2, AC3, AC5

Real `dev:debug` Electron editor, live preview (`--target=viewer`), fixture
`NodeGX test projects/def037-drive` (`/App`: a 300px `contentHeight` Group holding a `Text` whose
label overflows). **Every reading below was taken without a reload**, by `setParameter` on the node
model — the same path the property panel uses.

| arm | `text-overflow` | `white-space` | `overflow` | `overflow-wrap` | height | scroll/client |
| --- | --- | --- | --- | --- | ---: | --- |
| baseline `wrap` | `clip` | `pre-wrap` | `visible` | `anywhere` | **38px** | 300 / 300 |
| **live → `ellipsis`** | `ellipsis` | **`nowrap`** | **`hidden`** | **`normal`** | **19px** | **526 / 300** |
| **live → back to `wrap`** | `clip` | `pre-wrap` | `visible` | `anywhere` | **38px** | 300 / 300 |

🔴 **This is s35's measurement inverted.** s35 got `ellipsis` beside **`pre-wrap`** — the derived
siblings never moved. All four now move together, in both directions, and the row collapses 38px →
19px and back. **AC1 and AC2.**

✅ **AC3's control, run *after* the two known-firing signals above** (a zero read first would be
indistinguishable from a broken harness): `wordBreak` — a port needing no sibling — still applied
live (`word-break: break-all`) and moved nothing else. The fast path is intact.
✅ `wrap` still never reaches the DOM as CSS; its computed value is `clip`, the CSS initial.

### 8.3 ✅ AC6 — one of the three source-read instances, driven

A `Checkbox` was added to the running graph and its `Width` set live, 32px → 80px.

- **tagged `<div noodl-style-tag=checkbox>`**: `32px` → `80px` — this moved *before* the fix too;
  the DOM patch finds the tagged element.
- 🔴 **inner `<input>`, whose width render *derives* (`Checkbox.tsx:56-57`)**: style attribute now
  reads **`width: 80px; height: 32px;`**. **That is the half that was inert** — pre-fix it stayed
  `32px` while the wrapper grew. `height` correctly unchanged: only `width` was set.

### 8.4 ⚠️ What is still NOT measured — say it before quoting this row

- ⚠️ **The drive cannot say which half fixed the Checkbox.** A parameter change is *both*
  editor-driven and (for Checkbox) tagged. The isolation is done by tests, not by the drive:
  `def037-styletag-rerenders.test.ts` drives `setStyle` directly with and without a tag.
- ⚠️ **The deployed-app arm is untested end to end.** §7.1's finding — a *wire* driving a tagged
  port in a shipped app — is covered by unit test and by construction, **not by a running deployed
  app**. Nobody has published an app and animated a tagged port.
- ⚠️ **`borderColor` on Checkbox and Radio Button (2 of the 3 new instances) were not driven.**
  They are the same class as the driven `width` and are covered by the same code path; the tick
  glyph only renders when `useIcon` is on, which the drive fixture did not set.
- ⚠️ **The `…` glyph is still unresolved at capture resolution**, exactly as DEF-031 §6.2 recorded.
  What is measured is the mechanism and the consequence (the row stops growing), not the glyph.

### 8.5 The gates

`typecheck:runtime`, `typecheck:viewer`, `typecheck:editor` — **all exit 0**.
`noodl-runtime` **2610 passed / 147 suites**, `noodl-viewer-react` **1138 passed / 87 suites**, both
**exit 0**.

**Three mutants, each reddening a different set** — and the sets are the argument, not the count:

| mutant | rows killed | what survives, and why that is right |
| --- | --- | --- |
| remove the editor-driven scheduling (the pre-fix state) | **4 of 6** | the two rows asserting a wire drives *no* render |
| re-render on connection input too (**"always re-render"** — the change the ruling did *not* ask for) | **exactly the 2 controls** | the four editor-driven rows |
| `styleTag` branch forces no update (pre-fix) | **3 of 5** tagged rows | both untagged controls |

🔴 **A test proving only "setParameter re-renders" would have passed against all three.** The
editor/runtime split is only meaningful if the two are distinguishable, so the rows assert a
**difference on one node** rather than two absolutes read from two fixtures.

⚠️ **A trap this row paid for, in the test harness rather than the product**: the first run of the
`styleTag` spec read **0 renders on every row**, which looks exactly like a fix that does not work.
`getDOMElement` is itself a node method, so assigning the stub *before* the method-binding loop let
the loop overwrite it, and `setStyle` took its `if (!domElement) return` early exit. ✅ **Rule out
your instrument before believing a zero** — the fix was one line of ordering.
