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

⚠️ **Undriven in a real editor.** The port is graded at the compiled node and at the rendered DOM,
but nobody has watched `Text Overflow` appear in a running editor's property panel and ellipsize a
label on canvas. 🔴 A drive serves a **built bundle** — `render-report.js` serves the gitignored
`packages/noodl-editor/src/external/viewer/noodl.viewer.js`, so this needs
`cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js`
(~40s) first, or the change is invisible.

⚠️ **`packages/noodl-types/src/node-catalog.json` carries this port but is *not* committed here.**
It is a generated artefact shared with phase 81's VIB-002 lane, which was adding five `Group`
background ports in the same window; a regeneration at 10:23 folded both port sets into one file.
Committing it while either lane's source was still uncommitted would leave `catalog:check` failing
on a clean checkout — a catalog entry with no source behind it. **This commit lands the source
only**, so that whichever lane commits the catalog does so with every port in it already backed.
