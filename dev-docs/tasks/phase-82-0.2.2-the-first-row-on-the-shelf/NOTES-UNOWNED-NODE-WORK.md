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

  ✅ **RESOLVED, session 38 (2026-09-04).** Everything the paragraph above was working around is
  gone: `catalog:check` and `catalog:merge:check --require-coverage` are both **EXIT=0**, and no
  hand-patching is needed any more. The §A1 work that made in-place regeneration unsafe is all
  committed (`8c5e5b10`, `edccfe53`, `06839b9a`), so a plain `npm run catalog:generate` now
  produces exactly your own delta. ⚠️ **Still do the `--out-dir` + diff first** — the reason is
  permanent (other tasks feed this file), not specific to §A1. 🔴 **And note `catalog:merge` has
  NO `--out-dir` flag**: for the enriched catalog the equivalent is `cp -a` the current file aside,
  `md5`, regenerate in place, diff against the backup, `md5` again.
- 🔴 **A literal count gate moved, found by running the full suite**:
  `tests-unit/fb-021/portGateReason.test.ts` counts every conditionally-gated port in the shipped
  catalog (`359` → `362`, `explained: 348` → `351`, unexplained held at `11`) because the three new
  Circle ports are gated in the clause form and all explain themselves. Updated with the same
  derivation style the surrounding comments already use.
- **Readings**: `noodl-viewer-react` 90/1172 green; `nodegx-export` 68/2236 green; editor full
  `test:main` back to the documented baseline — 2 failed suites (`sb-007`, `vfn-011`, both §A1's),
  7069/7077 passed. `typecheck:editor`, `typecheck:core-ui` (50 pre-existing, none touched),
  `tsc -p noodl-viewer-react`, `tsc -p nodegx-export` all clean.
- **Not built**: the icon glyph (`NodePicker.icons.ts`'s `Circle: IconName.CircleOpen` is
  unchanged — cosmetic, and not required since `name: 'Circle'` never changed). Not driven in a
  running editor.

#### ✅ Stage 2, session 39 — `points` and `cornerRadius`

- **Two shapes, one port.** `polygon` and `star` both read `points`, built the same way Square and
  Triangle were (inscribed, clockwise), so they reach `insetPolygon`/`polygonPath` unchanged and
  `filledArc`/`arc` stay untouched for the third stage running.
- A star's inner radius is `cos(2π/n)/cos(π/n)` — the collinear-edge ratio, 0.382 at five and 0.577
  at six. ⚠️ It is zero at four points and negative at three; clamped to 0.2 there.
- `cornerRadius` trims each edge by `radius / tan(θ/2)`, 🔴 **clamped to half the shorter adjacent
  edge with the radius recomputed from the clamp** — unclamped, a large radius eats past the next
  corner and the outline self-intersects. ⚠️ **Sweep flag is per corner**: a Star has reflex
  corners and one flag for the whole outline bulges them backwards.
- 🔴 **`cornerRadius` NAMES all four straight-edged shapes rather than `shape != circle`.** `!=`
  stringifies an unset parameter to `'undefined'`, so `!= circle` is TRUE on every pre-stage-1
  Circle and the row would have appeared on all of them. This is the same trap as stage 1's
  `NOT SET`, reached from the opposite direction.
- All four registries moved together again, the fourth (`CONTENT_PARAMS.Circle`) included by
  following stage 1's own warning rather than rediscovering it.

#### ✅ Stage 3, session 39 — `svgSource` and the shared sanitiser

- `sanitizeInlineIconSvg` moved out of `IconGlyph.tsx` into **`src/sanitize-inline-svg.ts`**, and
  the three constructs §1 named as uncovered are now closed: **`<style>` blocks**, **CSS `url()`**
  (with `url(#…)` surviving, as `href="#…"` does), and **SMIL `<animate>`/`<set>`/`<animateTransform>`/
  `<animateMotion>`/`<discard>`** — the last being the subtle one, since `<set attributeName="href">`
  rewrites an attribute *after* the href rule has passed over it.
- `stripRootSvgDimensions` is a separate export because both callers need it and neither use is
  about trust: an icon must size with `iconSize`, a Shape's source must fill its `size` box.
- 🔴 **The `url()` rule was written wrong first, by the trap the `href` rule beside it already
  documents.** `url\(\s*(['"]?)(?!#)…` lets the optional quote group backtrack to empty, so the
  lookahead reads the QUOTE instead of the `#` behind it and `url('#g')` is destroyed as remote.
  Caught by the quoted-fragment case, which is why that case exists separately from the bare one.
  ✅ **The rules are exported as `SANITIZER_CASES` and driven from there**, each paired with a
  control asserting the RAW input really contains the payload — a sanitiser suite that writes its
  own examples writes the ones the code already handles.
- The export path gets its **own** defer sentence for a custom source rather than the generic
  shape one: the wall is arbitrary author markup, not un-ported arithmetic, and naming them alike
  would tell an author to wait for a translation that is not what stands in the way.

##### 🔴 Registered, owner `NONE` — Fill and Stroke are inert for a custom SVG

A custom source carries its own paint, so `fillEnabled`/`fillColor`/`strokeEnabled`/`strokeWidth`/
`strokeColor` do nothing when `shape = svg`. They are **deliberately left ungated**: switching them
off needs a group whose condition covers every other shape *including `shape NOT SET`*, which
changes the property panel of every Circle ever saved in order to tidy one new case — and
`nat-shape-002` asserts they are ungated on purpose. Worth a decision, not worth taking silently
inside stage 3.

- **Readings, session 39**: `noodl-viewer-react` 93 suites / 1231 tests, `nodegx-export` 68 / 2241,
  `noodl-mcp` 93 / 1257, editor `test:main` 422 / 7080 — all EXIT=0, and `test:main` is now clean
  rather than carrying the two §A1 reds, because §A1 was committed and both gates repaired
  (`14ceaa99`). `catalog:check`, `catalog:merge:check --require-coverage`, `catalog:examples` 67/67
  and `tsc` on both packages all clean. fb-021's count moved `362`→`364`→`365`, explained
  `351`→`353`→`354`, unexplained held at `11` throughout.
- ✅ **Six mutants run, all killed by exactly one row each**: a single sweep flag, an unclamped
  trim, equally-round stroke corners, an unclamped star ratio, the `CONTENT_PARAMS` entries
  removed, and the sanitiser bypassed in the component. Plus a `#js` mutant on the `points` gate
  confirming fb-021's *remainder* — not its total — is what distinguishes an explained gate from an
  unexplainable one.

---

## §2 Video — mp4 only, and the source field does not say so

> *"Most people probably won't publish an mp4 with their project… the builder will add a hosted mp4
> URL, or a Youtube or Vimeo video. Can we make these choices clear?"* — Richard

**Confirmed: zero YouTube or Vimeo support anywhere.** `Video.tsx` renders a raw `<video>`; there is
no `<iframe>` in the viewer at all. A pasted YouTube link renders a broken element and fires
`video/media-error`. The port description reads *"URL or project file to play"* — it does not say
*mp4/webm, not a YouTube link*, which is the cheapest fix in this file and is **safe**.

✅ **autoplay, controls, loop, muted and volume already exist** for mp4.

### ✅ BUILT, session 39 — Start Time and End Time for mp4

The collision was the whole of it, and it resolves rather than stacking. The hack's purpose is to
make the browser seek *somewhere* so a frame paints — and **a start time does that too**: `#t=30`
renders the frame at 30s exactly as `#t=0.01` renders the one at 0.01s. So the workaround is not
overridden, it is the **default value of the start**. That is why:

- both ports unset ⇒ `#t=0.01`, byte-for-byte what shipped before;
- Start Time set ⇒ `#t=30`, the author replacing the default rather than fighting it;
- End Time only ⇒ `#t=0.01,10`, the Android behaviour surviving an end-only setting.

🔴 **A hand-written `#t=` in the Source field still wins while both ports are unset** — it was the
only way to do this before, and it keeps working untouched. Once a port is set, the control the
author can see beats the one buried in a string, and the old fragment is *replaced* rather than
doubled.

⚠️ **An end at or before the start is dropped, not honoured.** It is a range that plays nothing,
which reads as a broken node rather than as a bad value — the same reasoning as the star's inner
-radius clamp in §1.

Built as **`src/media-fragment.ts`**, a pure module, so the rule is graded without a DOM;
`Video.tsx` destructures the two ports **out of the `{...this.props}` spread**, because that spread
lands on the `<video>` element and a port named `startTime` would become an invalid DOM attribute.
Export defers a video with a literal or wired value, by a named reason — reimplementing
`withMediaFragment` in the emitter would be the arc-maths mistake §1 warns about.

### 🔴 STILL NOT BUILT — YouTube/Vimeo

Richard ruled 2026-09-04: **URL parameters only, no third-party player SDK.** So the buildable
shape is an `<iframe>` path driven by `?start=&end=&autoplay=…`, needing no SDK and no new network
origin logic. ⚠️ Under that ruling a *reliable* `end` and dependable autoplay are **not available**
— they need the IFrame Player API script, which the ruling declines — so the ports must say what
they can and cannot promise rather than implying an accuracy the mechanism does not have. Owner
`NONE`. Nothing about the mp4 work above blocks it.

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

Restoring **default items** (the *"go back to Option 1/Option 2"* half of the ask) — 🟢 **BUILT,
session 35.**

🔴 **The one-line version this section originally proposed does NOT work, and was never shipped
as written.** A `default` declared on `items` alone never reaches the render: `items` has a
custom `set` (this file's own §3 quote above already names it), and the runtime only seeds a
port's `default` into `_inputValues` for an unauthored input — `nodedefinition.ts`'s
`initializeDefaultValues` (called from the `nodeDefinition` factory, twice) writes straight into
`node._inputValues`, and **never calls the port's own `set`**. `props.items`, the only thing
`Select.tsx` reads, would have stayed `undefined`. Traced through the source
(`node.ts:registerInput`, `nodedefinition.ts:173-193,507-553`) and then confirmed empirically: a
scratch corpus-harness node with only `default:` set showed `props.items === undefined`,
`_internal.items === undefined`. The property panel *would* have shown "2 items" (`getParameter`
does fall back to `port.default`, `ListValueType.ts:868`) while the live preview stayed empty —
the exact "panel lies about what renders" shape this project's memory files warn about
repeatedly.

**What actually shipped**: `options.ts` — a `DEFAULT_ITEMS` constant, seeded directly into
`this.props.items` (a fresh per-instance clone, `DEFAULT_ITEMS.map(item => ({...item}))`) at the
top of `initialize()`, **plus** `default: DEFAULT_ITEMS` still on the port declaration so the
property panel's summary agrees with what renders. `set()` is untouched — an authored or wired
value still overwrites the seeded default exactly as before, and `undefined` still abstains.
Verified empirically (corpus harness, not assumed): a never-authored Dropdown's `props.items`
equals the two-item array; two sibling instances do not share one array reference (each gets its
own clone, so nothing can mutate a sibling's dropdown); the default array carries no `.on` (a
plain literal never passed through `set`, so it was never bound as a Collection — no listener
leak onto a shared object). New suite:
`noodl-viewer-react/tests/corpus/p82-dropdown-default-items.test.ts` (3 specs). Readings: that
suite plus the existing `nda-012-dropdown-items.test.ts` and `fh-015-pointer-blocking.test.ts` all
green; full `noodl-viewer-react` suite 91/91 files, 1175/1175 tests; `tsc -p noodl-viewer-react`
clean; `nodegx-export`'s `controlled-state.test.ts` + `visual-controls.test.ts` (both author
`items` explicitly, so a default can't touch them) 64/64 green.

**Catalog**: `node-catalog.json` hand-patched the same way session 34 patched Circle's entry —
`--out-dir` scratch generation, diffed, only `net.noodl.controls.options`'s `items` port gained
the `default` block, copied verbatim and verified byte-identical to the fresh generation.
`catalog:check` is still red — the same seven pre-existing §A1 deltas (four icon-colour
`#FFFFFF`→`#000000` defaults, one dropped default, the Video Source sentence, the textinput
placeholder default), untouched by this. ⚠️ The next session that regenerates the catalog in
place, without `--out-dir` first, will still sweep §A1's changes in with everyone else's.

✅ **Both catalogs are green as of session 38** — see §1's resolution note. No more hand-patching.

### ✅ AND THE ITEMS ALONE WERE NOT ENOUGH — session 38, `4672d924`

> *"The value input port of the dropdown should be by default set to the first item in the default
> list when the node is placed, 'Option-1' in this case I think, so the user immediately sees a
> dropdown in the preview with a real option, not just a horizontally collapsed input."* — Richard,
> 2026-09-04, **after** the two default items above had shipped

🔴 **He was right, and the reason is that `Select.tsx` does not show you the `<select>`.** The
native element is `opacity: 0`, `position: absolute`, `inset: 0` — overlaid for interaction only.
What you actually see is a `<span>` drawing `items[selectedIndex].Label`, and `selectedIndex` is
**-1 whenever `value` is `undefined`**. So session 35's default items populated an invisible
element, the span drew nothing, and at the node's `contentSize` default it measured no content and
collapsed to a sliver. **The options were there the whole time and nothing displayed them.**

The fix is the same shape as the items one and for the same reason (`value` also has a custom
`set`): `initialize()` seeds it, `default:` stays on the port so the panel agrees.

⚠️ **`props.value` AND `_internal.value` are both seeded, and the pairing is load-bearing.**
`Select`'s mount effect calls `valueChanged(props.value)`, and `valueChanged` fires **Changed**
whenever the value differs from `_internal.value` — so seeding `props` alone would make every
placed Dropdown emit a signal the port's own description promises it does not emit, and the node
would look perfectly correct while doing it. `_internal.value` is also what the `value` *output*'s
getter returns, so it is what keeps the graph agreeing with the screen. One spec grades exactly
that, because nothing else would notice.

✅ **Checked, not assumed**: `Select.tsx:126` reads `props.items.items.length`, which a plain
`DEFAULT_ITEMS` array only survives because `collection.ts:436` defines `items` on
`Array.prototype` (returning a proxy of the same array). Until now `selectedIndex === -1`
short-circuited that expression; selecting an item makes it evaluate for the first time. Verified
it resolves rather than throwing before shipping the seed.

**Readings**: `p82-dropdown-default-items` **8/8 EXIT=0**, and **EXIT=1 on the reverted arm** with
4 of the 5 new rows red (the fifth is a regression guard that should pass in both). 🔴 **One row
was rewritten because the reverted arm showed it passing in both directions** — asserting
`_internal.value === props.value` is a tautology when both are `undefined`, so it asserts the
literal now. Full `noodl-viewer-react` **91/91 files, 1180/1180**; `noodl-mcp` **93/93, 1257/1257**;
`tsc -p noodl-viewer-react` clean; both catalog gates EXIT=0.

🔴 **REGISTERED WHILE BUILDING, owner `NONE`, deliberately NOT built** — an author who replaces
`items` with their own list and never sets `value` still gets the collapsed input, because the
seeded `option-1` matches none of their options and `selectedIndex` goes back to -1. **Unchanged
by this commit rather than caused by it** (it was collapsed before too), and out of the scope
asked. The cheap remedy is a `placeholder` — the port exists and its label renders in exactly that
case. The fuller one is for the `items` setter to adopt the new list's first value when the current
value is still the untouched seed, which is more behaviour than anyone has asked for and would
surprise an author who wants nothing selected until the reader picks.

**Not built**: the beginner "click plus and type" JSON-editor mode (the harder half of the
original ask) — still three unchosen directions, unchanged from the research above.

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
