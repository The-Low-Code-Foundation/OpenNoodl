# DEF-031 — a `Text` cannot be ellipsized, because ellipsize was never authorable

**Found by phase 77, filed as [D22](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d22).**
✅ **Closed s28 (2026-08-31).**

D20 offered three ways out of a label that outgrows its box — shrink-and-ellipsize, wrap, or
accept it. **Wrap shipped, and not because it was chosen**: ellipsize was not expressible at all,
so the decision had already been made by the runtime before anyone reached it.

## 1. The person sentence

**Someone puts a name, a title, or an email address in a fixed-width row and it wraps onto a
second line, pushing the row's height out and breaking the alignment of everything beside it.**
The fix every designer reaches for is one line ending in `…`. There was no port for it, and no
message saying so — the property panel simply had nothing between "Normal" and "Break All".

## 2. The mechanism, which is two layers and not one

The register recorded the outer layer: `textOverflow`/`text-overflow` = **0** across
`noodl-viewer-react/src` and `noodl-runtime/src`, against controls of `wordBreak` = 2 (a `Text`
`inputCss` port that does exist) and 11 files carrying `inputCss` (the mechanism a new port would
use). That measurement holds — re-run with `grep -a` this session, since ugrep's `-I` skips
source files as binary silently and an absence measured without it is unmeasured.

🔴 **But a port on its own would have been dead on arrival, and that is the half the register did
not have.** `text-overflow` does something only on a single line that is *allowed to overflow*,
and `Text` decided both of those for the author. Measured on the real component before the fix:

```
FIXED-WIDTH : text-overflow:ellipsis;overflow:hidden;…;white-space:pre-wrap;overflow-wrap:anywhere
CONTENTSIZE : text-overflow:ellipsis;overflow:hidden;…;white-space:pre
```

The property **reached the DOM intact and did nothing**. `Text.tsx` appended `white-space:
pre-wrap` and `overflow-wrap: anywhere` after the author's style, so the text wrapped, so no line
was ever too long to fit, so the ellipsis had nothing to truncate. In content-sized mode the box
grows to its content instead, which is the same outcome by a different route.

⚠️ **This is why the fix is two files rather than one**, and why a spec asserting only
`text-overflow` would have passed against the broken build. The property was never what was
missing. The single line was.

## 3. What was built

**`packages/noodl-viewer-react/src/nodes/visual/text.ts`** — a `textOverflow` port in `inputCss`,
declared beside `wordBreak` in the `Text` group, with a tooltip that says what each value does and
that the truncating values need a width the text can exceed.

**`packages/noodl-viewer-react/src/components/visual/Text/Text.tsx`** — the render now branches on
it: a truncating value gets `white-space: nowrap` and, unless the author set one themselves,
`overflow: hidden`. Everything else takes the path it always took, byte for byte.

### The default is `wrap`, and that is a deliberate choice about DEF-033

The enum is `Wrap` · `Clip` · `Ellipsis`, defaulting to `wrap` with `applyDefault: false`.
`'wrap'` is **not a CSS value** and never reaches the DOM.

🔴 The obvious alternative — default `'clip'`, the CSS initial value — would have made this port a
**second [DEF-033](TASKS.md)**: a panel reading `Clip` on a node that wraps. That row is open on
this very board because `Substring`'s panel says `End = 0` while the node runs `-1`. Declaring a
default that the node does not do is the defect, not a shortcut around it, so the default here is
the behaviour every existing `Text` already has.

## 4. Acceptance

| # | Criterion | Where it is graded |
|---|---|---|
| AC1 | A fixed-width `Text` set to `Ellipsis` renders one line that may overflow, with the marker | `def031-text-overflow.test.tsx` — FINDING row |
| AC2 | `Clip` truncates on one line without the marker | same file |
| AC3 | The default wraps exactly as before, and `wrap` never reaches the DOM as CSS | control rows, asserted byte-for-byte |
| AC4 | An author's own `overflow` is not overwritten | control row |
| AC5 | The panel's declared default is the behaviour the node has | port-declaration rows, on the **compiled** node |

**All five green**; the whole package is 85 suites / 1107 tests green beside them.

### The mutation evidence

Three mutants, each reddening a different row — the point being that no single row carries the file:

| Mutant | What it models | Result |
|---|---|---|
| `truncates = false` | the port exists, the render ignores it — *the dead-on-arrival build* | ✅ both FINDING rows red, controls green |
| drop `delete style.textOverflow` | the default leaks into the DOM as invalid CSS | ✅ the `wrap` control red, alone |
| `truncates = true` | every `Text` in every project silently truncates | ✅ the `wrap` and byte-for-byte controls red |

⚠️ **AC5's rows grade `TextNode.node.inputs`, not the source `inputCss` object.**
`createNodeFromReactComponent` folds `inputCss` into `node.inputs`; asserting on the source
declaration would grade a shape no user ever meets, and would stay green if the fold broke.

## 5. What this row does not cover

⚠️ **Content-sized text is excluded by construction, not by choice.** The box grows to fit its
content, so nothing overflows and no `text-overflow` value can show. The port's own description
and tooltip say so. This is a property of the size mode and is not fixable here.

✅ **Driven session 35 — see §6.** The port is live in a running editor and a real label
ellipsizes in the live preview. ⚠️ The drive also found that the port is **inert until the preview
reloads** (§6.3), which is registered as **DEF-037**. 🔴 A drive serves a **built bundle** — `render-report.js` serves the gitignored
`packages/noodl-editor/src/external/viewer/noodl.viewer.js`, so this needs
`cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js`
(~40s) first, or the change is invisible.

⚠️ **`packages/noodl-types/src/node-catalog.json` carries this port but is *not* committed here.**
It is a generated artefact shared with phase 81's VIB-002 lane, which was adding five `Group`
background ports in the same window; a regeneration at 10:23 folded both port sets into one file.
Committing it while either lane's source was still uncommitted would leave `catalog:check` failing
on a clean checkout — a catalog entry with no source behind it. **This commit lands the source
only**, so that whichever lane commits the catalog does so with every port in it already backed.


---

## 6. The drive (session 35)

Driven in a real `dev:debug` Electron editor on a **copy** of `LearnBook`, against the live
preview (`--target=viewer`, the embedded webview serving `localhost:8574`).

**Fixture**: `/#Dashboard/dashboard/Left dashboard/Welcome row` › the `Welcome` `Text` node,
`sizeMode: contentHeight` — so its width is fixed by its parent and only its height is content-driven,
which is the mode this port is for.

### 6.1 ✅ The port is live in a running editor

Read off `NodeLibrary.instance.getNodeTypeWithName('Text')` in the running renderer — the same
declaration the property panel builds its rows from:

```json
{ "name": "textOverflow", "plug": "input", "group": "Text", "default": "wrap",
  "type": { "name": "enum", "enums": [ {"label":"Wrap","value":"wrap"},
            {"label":"Clip","value":"clip"}, {"label":"Ellipsis","value":"ellipsis"} ] } }
```

⚠️ **This is the node library, not the panel's DOM.** Nobody has yet read the rendered
`Text Overflow` row out of the property panel itself — the graph is drawn on a single `<canvas>`,
so selecting a node to open the panel needs a canvas-coordinate click that this drive did not take.
**That half of the AC is still owed.**

### 6.2 ✅ The label ellipsizes, and the wrap arm is the control

Three readings on the same element, each after a genuine render:

| arm | `text-overflow` | `white-space` | `overflow` | height | lines |
| --- | --- | --- | --- | ---: | ---: |
| **default (`wrap`)**, long text | `clip` | `pre-wrap` | `visible` | **42px** | **2** |
| **`ellipsis`**, same text | `ellipsis` | `nowrap` | `hidden` | **21px** | **1** |

🔴 **The wrap arm is the defect, reproduced live**: a label outgrowing its box wrapped to a second
line and pushed the row's height from 21px to 42px — the person-sentence in §1, on a real screen.

✅ **`wrap` never reaches the DOM as CSS.** The wrap arm's computed `text-overflow` is `clip`, the
CSS *initial* value — not the string `wrap`. That is AC3, confirmed in a browser rather than jsdom.

✅ **Genuinely overflowing, not merely single-lined**: with the text lengthened,
**`scrollWidth` 1419 vs `clientWidth` 893** on a `nowrap`/`hidden` box — the text is 526px wider
than its container and is being clipped.

⚠️ **The `…` glyph itself was not resolved.** The screenshot shows the label on one line cut at the
box edge; at capture resolution the final glyph cannot be told from a clipped letter. What is
measured is the complete mechanism (`ellipsis` + `nowrap` + `hidden` + real overflow) and the
consequence that matters (the row no longer grows). A `clip`-vs-`ellipsis` pixel comparison would
settle the glyph and was not taken.

### 6.3 🔴 What the drive found: the port does nothing until the preview reloads

Setting `Text Overflow` **while the preview is running** put `text-overflow: ellipsis` on the
element and **left `white-space: pre-wrap`** — so the text kept wrapping and nothing visibly
happened. Setting it back to `Wrap` live changed **nothing either**: the DOM stayed
`ellipsis`/`nowrap`/`hidden`, still truncated. **Inert in both directions.**

⚠️ **This first read as "the fix does not work"** — the DOM showed the exact "property arrives and
does nothing" shape §2 says the fix prevents. It is not: `Text.tsx`'s branch cannot produce
`textOverflow: ellipsis` beside `white-space: pre-wrap`, because the wrapping arm *deletes*
`style.textOverflow`. That impossibility is what said the value had been patched onto the element
by a path that never ran the render.

✅ **The control that names it.** `wordBreak` — the **pre-existing** sibling `inputCss` port on the
same node, set the same way in the same session — **applied live and immediately** (`word-break:
break-all`). So the live-patch path works; it is not a platform-wide "style ports don't update".

🔴 **The distinction, which is the whole row**: `wordBreak` *is* its own CSS declaration.
`textOverflow` only means something in company with `white-space`, `overflow` and `overflow-wrap`
— and those are computed in the React render, which the live patch does not run. **It is the first
`Text` style port whose effect depends on siblings the render derives.**

**Registered as [DEF-037](TASKS.md).** It does not block any of this row's ACs — a reopened
project renders correctly from disk (`"textOverflow": "ellipsis"` persisted, verified in
`project.json`) — but it breaks the edit-and-see loop the port is used through.
