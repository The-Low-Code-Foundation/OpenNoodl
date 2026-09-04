# Notes — node work Richard asked for, owner `NONE`

🔴 **This is NOT a board row and nothing here is scheduled.** It is the research behind four things
Richard asked for on 2026-09-04 that are **features, not release blockers**, written down so that
whoever picks them up starts from the findings rather than from the question. Owner for all of them
is `NONE` until someone claims them — see [the testing-pass register](TESTING-PASS-2026-09-04.md) §2.3.

---

## §1 Circle → a Shape / SVG node

> *"Oh fuck if you turn the circle node into an SVG node, with some premade SVGs like circle, square
> etc but you can add your own SVG code, you'd be a hero."* — Richard

### ✅ First: the answer to *"why do we just have a circle?"*

`Circle.tsx` renders a **real `<svg>` with hand-computed arc paths**, and its ports include
`startAngle` / `endAngle` / `strokeLineCap`. It is an **arc and progress-ring primitive**, not a
rounded div — which is why it exists and why it looks unfinished next to nothing else. It is also the
library's **only** vector primitive: `nodes/visual/` holds circle, columns, css-definition, drag,
group, icon, image, media-source, text, video, and no rect, polygon, line or path.

### 🔴 Recommendation: extend it in place. Do NOT ship a deprecated twin.

Keep the registered `name: 'Circle'` and add `displayName: 'Shape'` plus a `shape` enum. **The on-disk
`"type"` never changes, so there is no migration at all.**

The deprecated-twin pattern (Button, Checkbox, Options, RadioButton) works because nothing external
keys off those type strings. Circle has five things that do:

| artefact | why it breaks under a rename |
|---|---|
| `project-examples/lessons/your-creature-on-screen/lesson.json` | its check predicate is `"hasType": "Circle"`, evaluated against the **registered name** — a learner placing the new node would fail the step |
| `library/prefabs/progress-circle`, `library/prefabs/states-kit` | 4 nodes pinned to a deprecated type |
| 3 catalog examples | `vis-columns-media-cards`, `vis-drag-snap-back`, `logic-quantity-stepper` |
| `NodePicker.icons.ts` **and its duplicate** in `EditorNode.tsx` | must change together |
| the export path | `analyze/plan.ts`, `emit/style.ts`, `emit/component.ts` |

A twin would also duplicate the arc maths, which already exists twice (component and exporter).

### 🔴 Two traps that would ship silently

1. **The port gate must read `'shape = circle OR shape NOT SET'`.** Every saved Circle has no `shape`
   parameter, and the rule compares `'' + getParameter(param) === value` — so without that clause the
   two prefabs' angle ports **vanish from the panel**. Exact precedent exists in
   `node-shared-port-definitions.ts`.
2. **Use the clause form, not `#js`.** `portGateReason.ts` returns `undefined` for `#js`, so the
   author gets no *"why is this hidden"* sentence, and `validation/portConditions.ts` abstains — so
   setting `startAngle` on a triangle would raise no diagnostic.

### Custom SVG safety

`sanitizeInlineIconSvg` (in `IconGlyph.tsx`) is reusable but should be **moved to a shared module
first**, not imported across the Icon boundary. It strips `<script>`, `<foreignObject>`, every `on*`
attribute, and every `href` except same-document fragments.

⚠️ **It does not cover `<style>` blocks, CSS `url()`, or SMIL `<animate>`/`<set>`** — which can
rewrite an attribute *after* sanitising — and the output goes through `dangerouslySetInnerHTML`. Its
own comment makes the argument that applies here: **the set is the trust boundary, not the author**,
because authored SVG *travels* in kits and templates.

### Sequencing

1. ✅ **BUILT, session 34.** `shape` enum + three paths + the two gates; regenerate the catalog
   (**do not hand-edit** — `node-catalog.json` is generated and `catalog:check` is the CI gate);
   export defers non-circle shapes with a named comment rather than emitting a gap.
2. Remaining shapes, `cornerRadius`, `points`.
3. `svgSource` + the shared sanitiser + the custom export branch.

#### ✅ Stage 1, what actually shipped and one deviation from the letter of the plan above

- `packages/noodl-viewer-react/src/nodes/visual/circle.ts` — `displayName: 'Shape'`, a new
  `shape` enum port (`circle`/`square`/`triangle`, default `circle`), and a `dynamicports` group
  gating `startAngle`/`endAngle`/`strokeLineCap` on `'shape = circle OR shape NOT SET'` — the
  first trap this section named, taken verbatim.
- `Circle.tsx` — Square and Triangle get their own path builders (`squarePoints`/`trianglePoints`
  inscribed in the size × size box) and a general `insetPolygon` (edge-offset + line-intersection)
  that reproduces the arc functions' "render the stroke inside" trick for straight edges.
  `filledArc`/`arc` are byte-for-byte untouched, so every project saved before this ships renders
  identically. Tests: `noodl-viewer-react/tests/nat-shape-001-…tsx` (11 specs, including a
  hand-derived triangle inset — size 100 / strokeWidth 20 — checked against the render output
  rather than against the same formula) and `nat-shape-002-…ts` (the two gate traps, graded
  against `circle.ts`'s actual `dynamicports`).
- **Export**: `analyze/plan.ts`'s `STRUCTURE_PORTS.circle` gained `'shape'` (a wired shape defers
  the whole node, the existing mechanism); `visualDeferReason` gained a literal-`shape` check
  mirroring the `columns` masonry/direction precedent right beside it, so a literal Square/Triangle
  defers with `'the "…" shape is not translated in this slice'` rather than reaching `renderCircle`
  at all. 🔴 **A THIRD registry needed the same port and nothing above named it**:
  `emit/style.ts`'s `CONTENT_PARAMS.Circle` — every port `renderCircle` actually reads has to be
  tagged there too, or an author who left `shape` at its default `'circle'` (the ordinary case)
  gets a `TODO(export): … the authored "shape" parameter has no style or content mapping`
  marker over a circle that renders perfectly correctly. Found by a test that pushed a literal
  `shape: 'circle'` and asserted the output was byte-identical to leaving it unset — a test that
  only asserted the *defer* cases would have shipped this. Tests:
  `nodegx-export/tests/visual-controls.test.ts`, three new specs beside the pre-existing circle
  block.
- **Catalog**: 🔴 **hand-edited, which the sentence above says not to do — read why before
  copying this.** Running `node scripts/node-catalog/generate.js` in place (no `--out-dir`) swept
  four `#FFFFFF`→`#000000` icon-colour defaults and the Video Source sentence — §A1's and this
  session's own earlier uncommitted work — into the same file, exactly the "regenerating a shared
  artefact is an unperformed merge" trap. **Reverted, then patched by hand**: the three JSON hunks
  (`displayName`, the `shape` port object, the `dynamicports` group) copied verbatim from a
  `--out-dir` scratch generation. ✅ **Verified, not assumed**: a Python diff confirmed the
  `Circle` entry is byte-identical between the hand-patched file and a fresh `--out-dir` run, and
  that `Circle` is the *only* node in the file that differs from `git show HEAD:…`. `catalog:check`
  is still red — for the same pre-existing §A1 reason, unchanged by this. ⚠️ **The next session
  that regenerates in place will still sweep both changes together** — this only avoided making
  that worse today.
- 🔴 **A literal count gate moved, found by running the full suite**:
  `tests-unit/fb-021/portGateReason.test.ts` counts every conditionally-gated port in the shipped
  catalog (`359` → `362`, `explained: 348` → `351`, unexplained held at `11`) because the three new
  Circle ports are gated in the clause form and all explain themselves. Updated with the same
  derivation style the surrounding comments already use.
- **Readings**: `noodl-viewer-react` 90/1172 green; `nodegx-export` 68/2236 green; editor full
  `test:main` back to the documented baseline — 2 failed suites (`sb-007`, `vfn-011`, both §A1's),
  7069/7077 passed. `typecheck:editor`, `typecheck:core-ui` (50 pre-existing, none touched),
  `tsc -p noodl-viewer-react`, `tsc -p nodegx-export` all clean.
- **Not built**: remaining shapes/`cornerRadius`/`points` (stage 2), `svgSource` + sanitiser
  (stage 3), and the icon glyph (`NodePicker.icons.ts`'s `Circle: IconName.CircleOpen` is
  unchanged — cosmetic, and not required since `name: 'Circle'` never changed). Not driven in a
  running editor.

---

## §2 Video — mp4 only, and the source field does not say so

> *"Most people probably won't publish an mp4 with their project… the builder will add a hosted mp4
> URL, or a Youtube or Vimeo video. Can we make these choices clear?"* — Richard

**Confirmed: zero YouTube or Vimeo support anywhere.** `Video.tsx` renders a raw `<video>`; there is
no `<iframe>` in the viewer at all. A pasted YouTube link renders a broken element and fires
`video/media-error`. The port description reads *"URL or project file to play"* — it does not say
*mp4/webm, not a YouTube link*, which is the cheapest fix in this file and is **safe**.

✅ **autoplay, controls, loop, muted and volume already exist** for mp4.

**Start/end time is half built for mp4.** `Video.tsx` already appends `#t=0.01` as an Android
first-frame hack and guards on `src.indexOf('#t=') === -1` — so media fragments are *already the
mechanism in this file*, and start/end would compose into that same string. The existing hack is the
collision to resolve.

**YouTube/Vimeo** need an iframe path that does not exist. URL params (`?start=&end=&autoplay=…`)
need no SDK; a reliable `end` plus dependable autoplay needs the IFrame Player API script, which
nothing loads — a CSP and network decision, not a port change.

---

## §3 Dropdown defaults and a beginner JSON mode

> *"We need to go back to the two default 'Option 1' 'Option 2' items… can we add this as a third
> JSON editor mode? A mode where you just click plus and add a text, and it autoformats it."*

✅ **RESEARCHED, session 34 — all five questions answered. Nothing built; this is still research.**

### The port, today

`packages/noodl-viewer-react/src/nodes/controls/options.ts` — `net.noodl.controls.options`,
displayed as "Dropdown". Its `items` port: `type: 'array'`, group `'General'`, **no `default` at
all**. A freshly dragged Dropdown therefore shows an empty select with nothing in the list — not a
regression from a two-item default *removed in this repo's history* (`git log --follow -p` on
`options.ts` finds no trace of `"Option 1"`/`"Option 2"` ever existing here, in code or as a
templated string). Richard's *"go back to"* most likely names the original commercial Noodl's
behaviour, from before this fork — not something to `git revert`.

### 🔴 The exact shape, quoted — a bare `["a","b"]` does NOT work

`Select.tsx` (the node's React component), the only place `items` is read:

```
options = props.items.map((i) => (
  <option key={i.Value} value={i.Value} disabled={...}>{i.Label}</option>
));
```

Every entry needs `.Value` and `.Label`. A plain string has neither — `i.Value`/`i.Label` on
`"a"` are both `undefined`, so a bare-string array renders every option as `<option value="">
</option>` with nothing shown or selectable. **The beginner mode is therefore a genuine new
capability, not a convenience wrapper**: it has to produce `{Label, Value}` objects from whatever
the author types, not just relax a format that already works.

### Where the mode lives, and how it is stored — `packages/noodl-core-ui/src/components/json-editor/`

This is **not Dropdown-specific machinery** — `JSONEditor` is one shared component every `array`
and `object` port opens (`ListValueType.ts`, ERG-003), and it already has exactly the two-mode
shape Richard is describing:

- **Easy Mode** (`modes/EasyMode/EasyMode.tsx`) — a generic recursive tree builder: "+ Add Item"
  on an array asks for a *type* (string/number/boolean/null/array/object) via a `<select>`, then
  appends an empty value of that type; "+ Add Property" on an object asks for a key name and a
  type, the same way.
- **Advanced Mode** (`modes/AdvancedMode/AdvancedMode.tsx`) — a text editor over the raw JSON,
  with validation.
- **The switch is component `useState`** (`JSONEditor.tsx`), seeded from a `defaultMode` prop
  (`'easy'`) or a `forcedMode` prop that removes the toggle entirely. 🔴 **Whichever mode a person
  last chose is remembered in ONE `localStorage` key, `json-editor-preferred-mode`** — global to
  the whole editor, not per-port, not per-project, not a project-file setting. Opening this on a
  Dropdown and then on a REST node's headers shares the same remembered mode.

### 🔴 The friction Easy Mode has today, for THIS shape specifically

Building one Dropdown option in the current Easy Mode is four separate steps: **+ Add Item → pick
"Object" → Add → + Add Property → type `Label` → pick "String" → Add → + Add Property → type
`Value` → pick "String" → Add** — then edit both values. Nothing in `JSONTreeNode`/`JSONEditorProps`
(`utils/types.ts`) carries any notion of "the items in this array all share this shape" — there is
no schema/shape hint anywhere in the component today. So the round-trip question (§3's fourth) has
a clean answer for the *existing* Easy Mode: nothing is lost, because Easy Mode already edits the
exact same `{Label, Value}` objects Advanced Mode would — the two modes are two views of one JSON
value, not two different formats. The friction is entirely about how many clicks it takes to *get
there*, not about data loss.

### ✅ A close precedent already ships: `proplist`

`json-editor/utils/listValueCodec.ts` documents a **third existing list-port type**, `'proplist'`,
stored as `[{id, label}]` — used by the JavaScript/Function node's dynamic inputs, REST headers,
Navigation Stack's page list, and DB model CRUD fields. `encodePropList` already accepts a **bare
string or number** per entry (`typeof raw === 'string' || typeof raw === 'number'` → the row's
label) and **mints a stable id automatically** — exactly *"click plus, type a text, it
autoformats"*, already built, already live. Open a JavaScript node's Inputs list in the running
editor to see the UX Richard is asking for, on a different shape.

`proplist` is not a drop-in for Dropdown — its one author-facing field is `label`, paired with an
*opaque, non-authored* `id` used only to attach child ports, whereas Dropdown's `items` need TWO
author-visible fields (`Label` and `Value`, which are commonly but not always the same — "Large"
sells for `Value: "l"`) and no id concept at all. But it is the exact mechanism template: a list
port type whose editor asks for one string per row and derives the rest.

### Three ways to build the beginner mode, not chosen between here

1. **A new list-port type**, e.g. `optionslist`, alongside `array`/`object`/`stringlist`/`proplist`
   in `listValueCodec.ts` — stored as `[{Label, Value}]`, edited as one text field per row with
   `Value` auto-slugged from `Label` (and independently editable, for the "Large" → `l` case).
   Smallest, most consistent with the existing four-type system; Dropdown's `items` port changes
   `type: 'array'` → `type: 'optionslist'`.
2. **A schema hint on `JSONEditorProps`** (e.g. `itemShape: {Label: 'string', Value: 'string'}`)
   that `EasyMode` reads to draw a simplified one-row-per-item form for ANY array-of-object port
   that opts in — more general, reusable beyond Dropdown, more surface to design and test.
3. **A Dropdown-only property row**, bypassing `JSONEditor`/`ListValueType` entirely — fastest to
   ship, builds nothing reusable, and is the one other option in the corpus (`{Label,Value}`
   arrays) does not currently exist anywhere else in `packages/noodl-viewer-react/src/nodes`, so
   the reuse case for (2) is real but not urgent.

### A separate, smaller, independently-actionable fix

Restoring **default items** (the *"go back to Option 1/Option 2"* half of the ask) does not
depend on any of the above — it is one field on `options.ts`'s `items` port:
`default: [{Label: 'Option 1', Value: 'option-1'}, {Label: 'Option 2', Value: 'option-2'}]`,
mirroring the shape `Select.tsx` already reads. ⚠️ Worth confirming against a running editor
before shipping it alone: whether the property panel's `isDefault`/`getParameter` machinery
(`ListValueType.ts` line 45) treats a port `default` the way it treats an authored value for
every consumer of `items` (`Select.tsx`'s own `props.items` guard, the `unbindItems`/`on('change')`
subscription in `initialize`) — not verified this session.

---

## §4 The property panel's two small ones

**Filter properties bar.** ~59px tall (`propertyeditor.css` padding + a 45px field height). Its field
has **no border and no fill** — `border: none`, `background: transparent`, and the container's token
is the same as the panel behind it, so contrast is **1.00:1** in both themes. Not a token going
transparent; there is nothing there. Sibling controls in the same panel (`VariantSelector`,
`TokenPicker`) already use `--theme-color-border-control` on a raised ground, and
`nat-001/palette-contrast.spec.ts` already grades that pair. ⚠️ `SearchInput.module.scss` is shared by
**five** other call sites — scope any change under `.property-filter`.

**"Add style variant" vs "Style → Variant".** Two genuinely different systems, not duplicate labels:
one saves a reusable named style into the project shared by every node of that typename; the other
picks a built-in `ElementConfig` preset that stamps `baseStyles` as ordinary parameters plus a
`_variant` marker, and creates nothing. They are emitted adjacently with no separator, which is what
makes them read as one feature. ⚠️ `connection-popup/refusalPlan.test.ts` asserts the literal port
`displayName: 'Variant'` — renaming that port breaks it.
