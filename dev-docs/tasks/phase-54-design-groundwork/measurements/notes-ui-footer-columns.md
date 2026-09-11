# `ui-footer-columns` — the measurement

DSG-003 §3, the recipe the spec calls *the sharpest of the five* because the honest version of it
is the correction of a defect the reference build shipped. **Lift the fix, not the artefact.**

Everything below is measured. Screenshots and scratch projects were produced with
`example-to-project.js` + `npm run render:report`; nothing here is inferred from taste.

---

## 1 — The original, measured

`NodeGX test projects/ecommerce-example/components/Components/SiteFooter/nodes.json`, converted
verbatim into example format and put through the corpus gate in isolation.

**Structure: 27 nodes, 0 connections, 1 component.**

```
npx ts-node -P ./scripts/tsconfig.json ./scripts/validate-examples.ts --dir <scratch>/orig-dir

# example: orig-site-footer
WARN [repeated-sibling-subtree] /Components/SiteFooter › node group_24 "Footer top" (Group):
  3 sibling subtrees here are structurally identical (6 nodes each, rooted at Group).
  Make one component and instantiate it 3 times — or drive a Repeater from a data source
  if the copies differ only in their values.

0 error(s), 1 warning(s), 0 info — 27 nodes, 0 endpoints checked
0/1 examples validate clean
```

That is the diagnostic firing on exactly the shape DSG-003 named. Threshold detail worth keeping:
`rules/repeatedSiblingSubtree.ts` fires at `REPEAT_THRESHOLD = 3`, not 2, and ignores subtrees
smaller than `MIN_SUBTREE_NODES = 3`. So `Shop` / `Company` / `Help` (three copies of
`Group(Text,Text,Text,Text,Text)`, 6 nodes each) fire; the **four sibling link `Text`s inside a
column do not**, because a single-node repeat is a list, not a duplicated component. The rule
matches on structure, never on parameter values — the brand block beside them is a different shape
and is correctly not counted.

**Render (`--tokens ecommerce-example`):**

| viewport | layout | page | texts | sizes | weights |
|---|---|---|---|---|---|
| desktop 1280×900 | 1280px | 900px | 19 | 3 | 400+600+700 |
| phone 390×844 | 390px | 844px | 19 | 3 | 400+600+700 |

`render:report` said **"Rendered clean"** at both. It is not clean at 390px. The screenshot
(`shot-orig-phone.png`) shows the second, unreported defect: the `Footer top` is a plain `Group`
with `flexDirection: row`, and **no Group anywhere in the runtime has a breakpoint**, so four
tracks stay side by side in 390px. Measured consequences, read off the render:

- the brand column is ~62px wide; its blurb breaks mid-word — `ceramic·s`, `admire·d`
- the section heads break — `COMP·ANY`
- links break — `Ceramic·s`, `Stockis·ts`, `Contac·t`, `Return·s`, `Deliver·y`
- page height stays 844px, i.e. **the summary word and the page height both look identical to the
  working version.** Only the picture shows it.

**A third defect, desktop:** the legal row sets `justifyContent: "space-between"` on two `Text`
children that are both at the default `width: 100%`. There is no free space to distribute, so
"Privacy · Terms" lands mid-row (~x 640) instead of flush to the shell's right edge (x 1216).
Compare `shot-orig-desktop.png` with `shot-new-desktop.png`.

---

## 2 — The refactor

**3 components, 17 nodes, 4 connections.**

| component | nodes | what it is |
|---|---|---|
| `/Components/SiteFooter` | 11 | band → shell → `Columns` (brand + `For Each`) + legal row, and one `Static Data` holding the whole nav |
| `/Components/FooterColumn` | 4 | section heading + a second `For Each` over its `links`; inputs `title`, `links` |
| `/Components/FooterLink` | 2 | one `Text`; input `label` |

Both levels of repetition are data. The three columns are a `For Each` over a `Static Data` array of
`{ id, title, links }`, and the links inside a column are a second `For Each` over that record's
`links`. Both `Component Inputs` nodes declare `plug: "output"` on every port (DSG-003 §2 / F13).

### The node-count delta

| | original | refactor | delta |
|---|---|---|---|
| nodes | **27** | **17** | **−10 (−37%)** |
| cost of a fourth column | **+6 nodes** | **+0 nodes** (one line of JSON) | — |
| cost of a fifth link in one column | +1 node | +0 nodes | — |

The second row is the number that actually matters: the original's marginal cost is linear in
nodes, the refactor's is zero.

### Render

`--tokens ecommerce-example` (182 shipped defaults + 24 project overrides):

| viewport | layout | page | texts | on screen | sizes | weights | placeholders |
|---|---|---|---|---|---|---|---|
| desktop 1280×900 | 1280px | 900px | 19 | 19 | 3 | 400+600+700 | 0 |
| phone 390×844 | 390px | 844px | 19 | 19 | 3 | 400+600+700 | 0 |

19 texts is the authored count: 2 brand + 3 headings + 12 links + 2 legal. Identical numbers with
the **shipped default tokens** and no donor palette (182 tokens, 0 overrides), so the recipe does
not depend on the ecommerce project's tokens.

**The breakpoint, measured rather than asserted** (`--viewports 800x400,759x400,700x400`, a short
viewport so `pageHeight` is informative):

| width | page height | reading |
|---|---|---|
| 800px | 400px | still 4-up, fits the viewport |
| 759px | **807px** | collapsed to `smallLayout: "1"` — one column, stacked |
| 700px | 807px | stacked |

`smallBreakpoint: 760px` fires at 759, as authored. At 390px (`shot-new-phone.png`) the footer is a
clean vertical stack — brand, Shop, Company, Help, then the legal row — with **no broken words**,
and the legal row's two `contentSize` Texts sit correctly at the two ends.

---

## 3 — What did NOT work

### 3a — 🔴 The first authored version rendered every link twice, and every gate was green

The recipe as first written — identical to what shipped, minus the `id` fields in the inline JSON —
measured:

```
ui-footer-columns — Rendered clean: desktop 1280×900px, 31 texts, 31 on screen, 0 images
```

**31 texts where 19 were authored.** Each column drew its 4 links, then drew them again in reverse:
`Ceramics, Coffee, Table, Gift cards, Gift cards, Table, Coffee, Ceramics`. `catalog:examples` was
green. `render:report`'s summary word was `clean`. The only two instruments that saw it were the
**element count** and the **screenshot** — which is DSG-003 F14 restated in a fresh case, and the
reason §2's second rule exists.

Three isolation probes, each a full render:

| probe | change | texts | verdict |
|---|---|---|---|
| B | inner `For Each` fed by its **own `Static Data`** inside `FooterColumn` | **19** ✅ | nesting is not the cause |
| A | outer repeater removed; three static `FooterColumn` instances, `links` as an inline array **parameter** | **31** ❌ | not the outer repeater either |
| C | probe A + an `"id"` on every link object | **19** ✅ | **the ids are the whole difference** |

**Root cause, from source.** `foreach.tsx:137` documents that `items` "may be a plain array", and
`Collection.set` (`collection.ts:497-503`) wraps each element it is given:

```js
if (Model.instanceOf(item)) bItems.push(item);
else bItems.push(Model.create(item));
```

and `Model.create` (`model.ts:238`) resolves identity from `data.id`:

```js
var m = Model.get(modelData.id);   // undefined id ⇒ a brand-new anonymous model
```

`set` then diffs old against new **by `getId()`**. A plain object with no `id` gets a fresh id on
every wrap, so the second call to `set` — the Repeater reaches it at least twice, once from
`bindCollection → scheduleCopyItems` and once from `refresh`'s NDA-013 resync — produces four ids
that match nothing already present, the existing rows are never recognised as the same rows, and
both sets end up on screen. The reversed order of the second batch is the insertion arithmetic in
the queued `add` handler (`baseIndex + args.index`, recomputed per operation) landing every item of
the second pass at the same index.

A `Static Data` node never shows this, because it emits a real `Collection` of `Model`s whose ids
are stable across deliveries. **The plain-array route is the one that is documented and the one
that is broken.**

The fix in the recipe is one word per record: every object in an inline array carries an `id`. The
recipe's `description` says so, in the position an authoring model will actually read it.

### 3b — Rejected: passing a per-column JSON string into a `Static Data` node

The obvious way to give each column its own real `Collection` would be a `Static Data` inside
`FooterColumn` whose `json` input is wired from a component input. It cannot be done: that port is
declared `allowEditOnly: true` (`staticdata.ts`, the `json` and `csv` inputs), and
`portConnectivity.ts:105` is `return !type.allowEditOnly` — the port takes an authored value only
and never a connection.

### 3c — Rejected: re-shipping `ui-icon-feature-strip` with different words

One component instantiated three times inside a `Columns` is already in the corpus, verbatim, as
`ui-icon-feature-strip`. The footer's repetition is **two levels deep** and its columns differ only
in their values, which is the branch the diagnostic's own message prefers ("*or drive a Repeater
from a data source if the copies differ only in their values*"). That is why this recipe is
data-driven and the icon strip is not, and it is what keeps the two from being the same lesson
twice.

---

## 4 — Defects found, for the phase to file

| # | What | Where | Severity |
|---|---|---|---|
| 1 | 🔴 **A plain array on a Repeater's `Items` is not idempotent.** Elements without an `id` are re-wrapped into new `Model`s on every `Collection.set`, so a second delivery of the same array renders the list twice (measured: 8 rows for a 4-element array, forward then reversed). Nothing reports it — not `catalog:examples`, not `validate:project`, not `render:report`'s summary. The `items` port's own description advertises the plain-array route. | `collection.ts:497-503` + `model.ts:238-246`; port doc `foreach.tsx:137` | High — silent wrong output on a documented route |
| 2 | ⚠️ **A repeated sibling *list* is invisible to the rule that exists for it.** `MIN_SUBTREE_NODES = 3` means the original's four hand-written link `Text`s per column were never reported; only the columns wrapping them were. Correct by the rule's own calibration, and worth knowing when reading a clean report. | `rules/repeatedSiblingSubtree.ts` | Info — by design |
| 3 | ⚠️ **`justifyContent` is inert on default-width children, and nothing says so.** `space-between` on two `Text`s that are both `width: 100%` distributes nothing. The reference build shipped this. A `justify*` value with no free space to act on is a candidate for the same class of check as `inactive-conditional-parameter`. | `ecommerce-example` `SiteFooter` `group_40`; fixed here with `sizeMode: "contentSize"` | Medium — silent no-op |
| 4 | ⚠️ **`render:report` says "Rendered clean" over a doubled list.** The word tracks errors and placeholders, not whether the element count matches what was authored. The counts are in the same line and they are the thing to read. | `scripts/devtools/measure-from-disk.js` | Info — the F14 shape again |

---

## 5 — Reproduce

```sh
# the original, as a corpus example
npx ts-node -P ./scripts/tsconfig.json ./scripts/validate-examples.ts --dir <dir-with-orig-only>

# the recipe
npx ts-node -P ./scripts/tsconfig.json ./scripts/validate-examples.ts --dir <dir-with-recipe-only>
node dev-docs/tasks/phase-54-design-groundwork/measurements/example-to-project.js ui-footer-columns --out /tmp/f
npm run render:report -- /tmp/f --viewports desktop,phone --out /tmp/f-shot --scale 1
npm run render:report -- /tmp/f --viewports 800x400,759x400,700x400 --screenshot none
```

Gates at the time of writing: `catalog:examples` **62/62 clean**, `catalog:tokens` **485 references
across 68 files all resolve**.
