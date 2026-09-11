# NOTES — F38, F39, F40: the three open rows of the design rubric

**Written:** 2026-08-11, in a session that did **not** own the checkout (a live Electron dev stack
belonged to the user). No `test:ci`, no `test:main`, no editor. Everything below is source read on
disk, graph JSON read on disk, and `render:report`'s own headless Chrome — the one visual instrument
that is legal beside a live sibling ([NOTES-DSG-006.md §2](NOTES-DSG-006.md)).

Two of the three findings turn out to be about the **instrument** rather than about the models, and
one of them — F38 — is **refuted outright**. That is the DSG-004 shape again: the premise did not
survive being measured.

---

## §1 — The short answers

| # | The question the register asked | The answer |
|---|---|---|
| **F39** | doctrine `§9` lands 0/6 — *"either the doctrine never says how, or the vocabulary cannot express it"* | **The doctrine never says how.** The vocabulary expresses it fine, and a real project on disk proves it |
| **F38** | doctrine `§5` lands 2/6 — *"four replays contain zero `Image` nodes"* | **The premise is false.** Five of six author `Image` nodes and **9 of 9** set `sizeMode: "explicit"`. `§5` is the most completely absorbed rule in the doctrine |
| **F40** | `real-copy` passes 6/6 and discriminates nothing | **Widened, and proved red on four real projects** — two of them in the six-replay corpus. The row is now 4/6 |

---

## §2 — F39: doctrine `§9` names no node, no port and no wire

### 2.1 What `§9` actually says

`design.ts:207–210`, in full:

> ### 9. Design the empty and the loading state
>
> A list with no rows should say what it is and what to do, not render nothing. An empty state is a
> small designed object: icon, one line of explanation, one action.

That is the whole section. It is a description of an **object**, not of a **mechanism**: it names the
parts of the thing to draw and nothing at all about what makes it appear.

The doctrine is otherwise dense with mechanism, and it is worth having the count rather than the
impression. Backticked identifiers per section, measured off the source:

| § | subject | design tokens | node / port / parameter names |
|---|---|---|---|
| §1 | bands and shell | 0 | **8** — `maxWidth`, `paddingLeft`, `alignItems: "center"` … |
| §3 | typography | 13 | **4** — `fontWeight`, `fontFamily` … |
| §5 | imagery | 0 | **7** — `Image`, `Icon`, `sizeMode: "explicit"`, `objectFit: "cover"`, `clip: true` … |
| §7 | responsive | 3 | **19** — `net.noodl.visual.columns`, `sizing: "autoFit"`, `layoutString`, `mediumBreakpoint` … |
| §8 | mechanics | 0 | **31** — including `visible`, the port §9 needs |
| **§9** | **empty states** | **0** | **0** |
| §11 | look at it | 0 | 4 |

**`§9` is the only structural rule in the doctrine with no identifier in it.** (`§10` also has zero,
but `§10` is about words — it has nothing to name.) A model reading §5 is told which four parameters
to set. A model reading §9 is told what the thing should look like and left to guess how it switches.

### 2.2 The vocabulary can express it — proof, not argument

`phase58-backend-deferred/components/Pages/StockCupboard` builds a textbook empty state:

```
stock_query.isEmpty -> empty_state.visible
```

with `empty_state` a Group holding `empty_icon` (📦), `empty_text` ("The cupboard is empty") and
`empty_hint` ("Add your first item using the form above.") — icon, one line, one hint. It also carries
two `Inverter` nodes and a `Switch` driving the login/signup tabs. That project was authored by
**deepseek**, the same base model that scores 2/8 cold on Kiln & Co.

So the mechanism is authorable, reachable and has actually been reached. The 0/6 is not a ceiling.

### 2.3 Why the six replays could not have found it, even trying

The one place the mechanism is documented on a **port** is
`docs/node-catalog/enrichment/dbcollection2.json:9`:

> `"isEmpty": "Boolean level; drive empty-state visuals from here rather than comparing count yourself."`

`isEmpty` exists on exactly **one node type in the whole 175-node catalog** — `DbCollection2` (Query
Records), which requires a provisioned backend. All six Kiln & Co. replays are static-data
storefronts with no backend. Their equivalent source is `Static Data.count`, and:

- `Static Data.count` **is** declared, with the description *"How many rows the last successful parse
  produced"* — framed as parse diagnostics, with no hint that it is a rendering source;
- `docs/node-catalog/enrichment/static-data.json:6–9` documents a `ports` block of **two** entries
  (`type`, `items`). **`count` is not in it**, though the free-text `description` mentions it;
- `docs/node-catalog/enrichment/for-each.json` — the node an agent is holding while it builds the
  list — documents nine ports and **never mentions the empty case**. Its `examples` are
  `repeater-query-records` and `ui-card-grid-repeater`; **`ui-empty-state` is not among them**.

`ui-empty-state` is listed as an example on exactly three enrichments — `group.json`, `button.json`,
`net.noodl.visual.icon.json`. ⚠️ `Group` is the node whose `get_node_type` response is
**~11k tokens** (`mcp-node-docs-are-the-token-budget`). The one pointer to the empty-state example
sits behind the most expensive document in the catalog, and none of the three nodes is one you fetch
*because you are building a list*.

### 2.4 🔴 Three defects in the mechanism where it *is* written down

The mechanism appears in prose in exactly two places, and they are the same sentence copy-pasted:

- `docs/node-catalog/examples/ui-empty-state.json:4` — *"Wire the collection's count into this
  Group's `visible` port and the inverse into the list — falsiness does the switching with no logic
  node."*
- `dev-docs/best-practices/03-INTERACTION-AND-STATE.md:73–74` — *"Wire the collection's count into
  the empty state's `visible` and the inverse into the list — falsiness does the switching, no logic
  node needed."*

All three of the following are wrong, in both copies:

1. 🔴 **The direction is inverted.** `count` → the *empty state*'s `visible` shows the empty state
   when the list has rows, and hides it when it does not. It is exactly backwards. The correct
   wiring is `count`/`isEmpty` → the **list**'s gate, and the inverse → the empty state — which is
   what `StockCupboard` does (`isEmpty` → the empty state, because `isEmpty` is already the negation).
2. 🔴 **"with no logic node" is false.** Falsiness is free in **one** direction only. The other side
   needs an `Inverter` (`Logic`; `value` → `result`) or a `Condition`'s `isfalse`. `inverter.json:5`
   describes this exact pattern — *"a Switch's `state` drives a panel's `visible` and, inverted, a
   placeholder's `visible`"* — so the repo knows; the empty-state prose just contradicts it.
3. 🔴 **`visible` is the wrong port.** `node-shared-port-definitions.ts:215–228`: `visible: false`
   sets `visibility: hidden`, and the catalog says so — *"Hides the element while keeping the space
   it occupies in the layout"*. A list gated on `visible` reserves its full height while empty, so
   the designed empty state appears **below a page-height blank gap**. The port that removes it is
   `mounted`, declared with a description that names the trap outright: *"Removes the element from
   the page entirely when false, unlike Visible which leaves its space behind"*.
   `docs/node-catalog/acceptance/acceptance-b.json:4` already chose `mounted` for exactly this
   reason — *"removing conditional UI from layout rather than merely hiding it"*.

⚠️ And `ui-empty-state.json:135` is `"connections": []`. **The one example that carries the mechanism
carries it only as prose.** An agent that copies the example verbatim gets a beautifully styled
dashed card that is always on screen, under a list that is also always on screen. The example has no
Component Input for the count either, so there is nothing to wire it to.

### 2.5 The models already know the technique — they just never apply it to a list

`§8`'s falsiness rule (`design.ts:199–201`) is absorbed. Every replay that built anything used it:

| replay | falsiness → `visible` connections |
|---|---|
| phase55-s6-haiku | 1 — `badge → visible` |
| phase55-s6-qwen35-27b | 4 — `compareAtPrice`×2, `isBestSeller`, `reviewCount` |
| phase55-s6-sonnet | 2 — `compareAtText`, `badge` |
| phase55-s8-deepseek-v4-pro | 2 — `compareAtPrice`, `isBestSeller` |
| phase58-awp006-deepseek | 3 — `compareAtPrice`, `badge`, `reviews` |
| phase55-s8-kimi-k3 | 0 (built 3 nodes total) |

**Twelve uses of the exact technique §9 requires, zero of them at the list level.** That is what
"doctrine gap" looks like from the inside: the models have the tool, they use it fluently for the
case that was spelled out with a mechanism (`§8`), and never once for the case that was not (`§9`).

---

## §3 — F38: refuted. `§5` is the doctrine's best-absorbed rule

### 3.1 The premise came from a mislabelled evidence string

F38 read: *"Four of six replays contain **zero `Image` nodes** — not broken URLs, none authored."*
That came from the rubric's own evidence line, `0 Image nodes, 0 broken`.

That string was wrong. `@nodegx/render-measure` builds its image list from the **DOM**:

- `src/index.js:124` — `visible = [...document.querySelectorAll('body *')].filter(el => el.offsetParent !== null || …)`
- `src/index.js:175` — `const images = visible.filter(el => el.tagName === 'IMG')`
- `src/index.js:359–364` — `images: { total: images.length, … }`

`images.total` is **rendered `<img>` elements**, not authored `Image` nodes. The evidence string
called them "Image nodes" and F38 was filed on that reading.

### 3.2 What the graphs actually contain

Every `Image` and `Icon` node in the six replays, with its box parameters:

| replay | `Image` | `Icon` | `sizeMode: "explicit"` on every Image | `objectFit: "cover"` | `width` + `height` |
|---|---|---|---|---|---|
| phase55-s6-haiku | 1 | 0 | ✅ 1/1 | ✅ | ✅ |
| phase55-s6-qwen35-27b | 1 | 0 | ✅ 1/1 | ✅ | ✅ |
| phase55-s6-sonnet | 3 | 2 | ✅ 3/3 | ✅ | ✅ |
| phase55-s8-deepseek-v4-pro | 3 | 0 | ✅ 3/3 | ✅ | ✅ |
| phase55-s8-kimi-k3 | 0 | 0 | — | — | — |
| phase58-awp006-deepseek | 3 | 5 | ✅ 3/3 | ✅ | ✅ |

**11 `Image` nodes across five replays, and 11 of 11 set `sizeMode: "explicit"`, `objectFit: "cover"`,
`width` and `height`.** `§5`'s mechanism is followed at 100%. The only replay with no imagery is
kimi-k3, which produced **three nodes in total** and no page.

`§5` is also the section that names its mechanism most tersely and most completely (`design.ts:142`:
*"Give the image a real box: `sizeMode: "explicit"`, a `width`, a `height`, `objectFit: "cover"`"`*).
It is the control that makes §2's argument: **the doctrine gets acted on precisely where it carries
identifiers.**

### 3.3 So what does `imagery-present` actually fail on?

The `src`, and the failure is upstream of design entirely:

- **8 of 11 Images take `src` from a Component Input** — the correct card pattern — so whether a photo
  appears is a question about the *data path*, not about §5;
- **haiku (0 rendered):** all three `For Each` nodes have `items` set as an inline array **parameter**
  and **no `template` at all**, with `repeater.item` wired directly onto a sibling card instance.
  That is the LAS-012 repeater-contract error. No instance is ever created, so ProductCard's Image is
  never in the DOM.
- **deepseek-v4-pro (0 rendered):** `components/Pages/Home/nodes.json` contains **one node** — an
  empty `Page`. `HeroSection` carries a working Unsplash URL and is never instantiated. Thirteen
  authored components, none of them reachable.
- **qwen-35-27b (0 rendered):** 19 nodes, the Home page still carrying the `create_project` skeleton
  sentence.

⚠️ **Three of the six "replays" rendered no page at all**, and the rubric scores them on six render
criteria anyway. deepseek-v4-pro's `narrow-survives: PASS` is a blank page fitting in 390px. The
design corpus that can actually be reasoned about is **three** projects (haiku, sonnet, awp006), and
haiku's lists never run. This is worth knowing before any conclusion is drawn from a 6-row table.

---

## §4 — F40: widened, and proved red on four real projects

### 4.1 Why it passed 6/6

`DEAD_COPY` (old `score-design.js:40–52`) was written from the three examples `§10` names —
*"Lorem ipsum", "Welcome to our store", "Card title"* — plus close variants. **These models never
write any of them.** What they write instead is the structural noun for the slot:

```
phase55-s6-haiku   CategoryCard  "Category" · "0"        ProductCard  "Product Name" · "Description" · "£0.00"
                   FeatureItem   "Feature" · "Description"
phase55-s6-sonnet  CategoryCard  "Category" · "0 pieces"  FooterColumn "Shop" · "Link" · "Link" · "Link"
                   InfoBand      "Category" · "Heading" · "Sub-line"
                   ProductCard   "Title" · "Description" · "£0"   TrustItem "Title" · "Body"
awp006-deepseek    CategoryCard  "Category" · "0 pieces"
```

The old list caught **none** of these — 0 hits across all six.

### 4.2 🔴 The half that makes the widening honest: a connection exemption

Naively adding those strings fails **sonnet on thirteen of them** — and sonnet is the one run
Richard's verdict clears. Every one of those literals is a **default on a port that a Component Input
overwrites**:

```
phase55-s6-sonnet/components/Components/CategoryCard/connections.json
  inputs-3.name       -> name.text     ("Category"  never renders)
  inputs-3.countLabel -> count.text    ("0 pieces"  never renders)
```

A literal a connection overwrites is not copy — it never reaches a screen. So the rule is: **a
`(node, param)` pair that is the target of a connection is exempt.** That single condition is the
difference between a detector that agrees with the verdict and one that contradicts it on its best
run.

⚠️ A second carve-out was needed: the structural-noun list must **not** apply to `placeholder`. A
text input whose placeholder reads "Name" or "Description" is a correctly labelled field. Without the
carve-out, `Puppy test` and `Puppy test 3` — two real, hand-built projects — are false-positived on
their admin forms.

### 4.3 Proved red. Twenty projects on disk, scored on the graph half only

| project | old | new | what fires |
|---|---|---|---|
| `phase55-s6-qwen35-27b` | PASS | 🔴 **FAIL** | `Pages/Home text="Kiln & Co. — nothing built yet…"` |
| `phase55-s8-kimi-k3` | PASS | 🔴 **FAIL** | same skeleton sentence |
| `phase58-backend-alltools` | PASS | 🔴 **FAIL** | `Pages/Home text="Stock Cupboard — nothing built yet…"` |
| `phase58-backend-deferred` | PASS | 🔴 **FAIL** | the skeleton sentence **+** `Pages/StockCupboard text="Item"` |
| `ecommerce-example` (the reference build) | PASS | ✅ PASS | — |
| `phase55-s6-sonnet` | PASS | ✅ PASS | — (13 candidates, all connection-driven) |
| `phase55-s6-haiku`, `phase58-awp006-deepseek` | PASS | ✅ PASS | — (6 candidates each, all connection-driven) |
| `Puppy test`, `Puppy test 3`, `Tutorial project`, `puppy-test-2`, `test1`, +6 more | PASS | ✅ PASS | — |

**4 of 20 real projects red, 2 of them in the scored corpus, and the reference build stays green.**
That is the discrimination F40 asked for, with the control it needed.

The skeleton sentence is `SKELETON_PLACEHOLDER_MARKER`,
`packages/noodl-mcp/src/tools/createProject.ts:90` — a project still carrying it never wrote a word of
its own. ⚠️ The detector holds its own copy of the string; if that constant is ever reworded, the
regex in `score-design.js` goes stale silently. It is commented at the site.

---

## §5 — What changed in `score-design.js`, and the before/after table

Four edits. All of them are in the two **graph** rows plus one evidence string; **no render-side
criterion was touched**, which is why five of the eight rows are byte-identical.

1. **`loadComponents` now reads `connections.json`.** It previously read nodes only, so no authoring
   criterion could see a wire. 🔴 It also recursed into `node.children` — which in the v2 format is a
   list of node **ids**, not nested objects — and pushed bare strings into the node list, where they
   read as `{type: undefined}`. Both fixed; v1's inline `connections` still works.
2. **`realCopy`** — connection exemption, `STRUCTURAL_NOUN`, `ZERO_VALUE`, the skeleton sentence, and
   the `placeholder` carve-out (§4).
3. **`emptyState`** — the old `GATE_TYPE` was `/condition|states$|net\.noodl\.logic|Switch/i` and two
   of its four alternatives were wrong: 🔴 **`net.noodl.logic` matches none of the 175 catalog
   types** (the real prefixes are `net.noodl.ArrayChanged`, `net.noodl.ObjectChanged`,
   `net.noodl.DateCompare`), and `states$` matches `States`, which is the **animation** node. It
   missed `Inverter` entirely — the node the doctrine's own mechanism needs. It now also accepts the
   node-free form the doctrine actually teaches: `isEmpty`/`count` → `visible`/`mounted`. Hosts now
   include `DbCollection2` as well as `For Each`.
4. **`imagery`'s evidence string** — `"N Image nodes"` → `"N <img> rendered … (DOM, not authored
   Image nodes)"`. That mislabel is what produced F38 (§3.1). Mechanical; the score is unchanged.

### 5.1 The table

Regenerated over all six replays, `design-scores.json` current.

| criterion | doctrine | src | haiku | qwen | sonnet | deepseek | kimi | ds-awp006 |
|---|---|---|---|---|---|---|---|---|
| type-hierarchy | `§3` | render | PASS | FAIL | PASS | FAIL | FAIL | PASS |
| one-accent | `§4` | render | FAIL | FAIL | PASS | FAIL | FAIL | FAIL |
| rhythm | `§1`,`§8` | render | PASS | FAIL | PASS | FAIL | FAIL | PASS |
| imagery-present | `§5` | render | FAIL | FAIL | PASS | FAIL | FAIL | PASS |
| narrow-survives | `§7`,`§11` | render | FAIL | PASS | PASS | PASS | PASS | PASS |
| grid-is-a-grid | `§8`,`§11` | render | PASS | FAIL | PASS | FAIL | FAIL | PASS |
| empty-state | `§9` | graph | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL |
| **real-copy** | `§10` | graph | PASS | 🔴 **FAIL** | PASS | PASS | 🔴 **FAIL** | PASS |
| **scored** | | | **4/8** | **1/8** | **7/8** | **2/8** | **1/8** | **6/8** |

**Two rows moved, both on `real-copy`:** qwen **2/8 → 1/8** and kimi **2/8 → 1/8**. Nothing else
changed — haiku is 4/8 as F41 left it, sonnet is still the sole 7/8, ds-awp006 6/8, deepseek 2/8.

The direction is the one the verdict already pointed: the two runs that produced no page lose the row
that says they wrote real words, because they wrote the scaffold's words.

### 5.2 `empty-state` still reads 0/6 — but now for a defensible reason

The corrected detector goes **green on `phase58-backend-deferred`** (`1/1 lists gated`, evidence
`Pages/StockCupboard (isEmpty→visible,Inverter,Switch,Inverter)`) and red on the other nineteen
projects on disk. It can now recognise the mechanism; the six replays simply do not contain it. The
row is 0/6 as a **fact about the corpus**, not as an artefact of a regex that could not have matched.

---

## §6 — Register

| # | Finding | State |
|---|---|---|
| F38 | *"Four of six replays contain zero `Image` nodes — none authored"* | ❌ **REFUTED.** Five of six author `Image` nodes; **11 of 11 set `sizeMode: "explicit"` + `objectFit` + `width` + `height`**. `§5` is the doctrine's best-absorbed rule. The row fails on `src`, which is a repeater-contract and orphaned-component failure, not a design one |
| F39 | doctrine `§9` lands 0/6 — doctrine gap or vocabulary gap? | ✅ **ANSWERED: doctrine gap.** `§9` is the only structural section with **zero** node/port names (§5 has 7, §7 19, §8 31). The vocabulary expresses it — proved by `phase58-backend-deferred/Pages/StockCupboard` — and the models use falsiness→`visible` **twelve times** for per-row chrome and zero times for a list |
| F40 | `real-copy` passes 6/6, carries no signal | ✅ **CLOSED.** Widened + connection-exempted; **red on 4 of 20 real projects**, 2 of them in the corpus, reference build green. Row is 4/6 |
| **F46** | 🔴 **The empty-state mechanism is written down wrong in both places it appears.** `ui-empty-state.json:4` and `03-INTERACTION-AND-STATE.md:73` say to wire `count` into the *empty state*'s `visible` — **inverted**; claim *"no logic node"* when the other side needs an `Inverter`; and name `visible`, which sets `visibility:hidden` and leaves a page-height gap where `mounted` is the port that removes it | 🔴 **open — needs Richard's words**, §2.4 |
| **F47** | 🔴 **`ui-empty-state.json` carries its mechanism only as prose: `"connections": []`.** Copied verbatim it yields a dashed card that is always visible, under a list that is also always visible. It also has no Component Input for a count, so there is nothing to wire | 🔴 open, §2.4 |
| **F48** | ⚠️ **The empty-state mechanism is documented only on the cloud-data path.** `isEmpty` exists on **one** of 175 node types (`DbCollection2`). The static-data equivalent, `Static Data.count`, is described as parse diagnostics and is **absent from `static-data.json`'s `ports` block**; `for-each.json` never mentions the empty case and does not list `ui-empty-state` among its examples | 🔴 open, §2.3 |
| **F49** | ❌ **`GATE_TYPE` contained a dead alternative.** `net.noodl.logic` matches **0 of 175** catalog types; `states$` matched `States`, the animation node; `Inverter` — the node the doctrine's own mechanism needs — was missed | ✅ **closed** — §5, and the corrected row is provably green on a real project |
| **F50** | ❌ **`loadComponents` never read `connections.json`, and recursed into v2 `children` (a list of ids) pushing bare strings into the node list.** No authoring criterion could see a wire; the node count was inflated by ~40% with `{type: undefined}` entries | ✅ **closed** — §5 |
| **F51** | ❌ **`imagery`'s evidence said `"N Image nodes"` for a count of rendered `<img>` elements.** `render-measure/src/index.js:175` reads the DOM. F38 was filed on that sentence and was wrong | ✅ **closed** — string corrected, score unchanged |
| **F52** | ⚠️ **Three of the six "replays" rendered no page at all** — qwen (19 nodes), kimi-k3 (3 nodes), deepseek-v4-pro (`Pages/Home` = one empty `Page`, thirteen orphaned components). They are scored on six render criteria anyway, and a blank page passes `narrow-survives`. The corpus that can carry a design conclusion is **three** | 🔴 open — affects how every row of the table should be read |

---

## §7 — What this changes about what the phase does next

1. **Do not write §9 prose from taste.** The gap is a *mechanism* gap, and the three sentences that
   already attempt it are wrong in three different ways (F46). Fixing those two existing sentences
   and adding the identifiers to `design.ts:207–210` is a smaller and more testable job than writing
   a new section — and it is Richard's wording, not a session's.
2. **`ui-empty-state.json` should carry connections** (F47). Its sibling `ui-*` examples are
   structural; this one is the only example whose whole point is a wire, and it has none. That is
   also the cheapest way to make the mechanism reachable, because examples are validated by
   `catalog:examples`.
3. **F38 should be closed as refuted, not worked.** Spending §5 effort on a rule that lands 11/11
   would be spending it in the one place the doctrine is already winning. The real failure behind
   that row is the repeater contract (LAS-012) and orphaned components — both already-known,
   already-filed, and *structural*.
4. **The 6-replay corpus is really a 3-replay corpus** (F52). Any future claim of the form "the
   rubric shows X across six runs" is at best three runs and three blank pages. It may be worth
   scoring `phase55-s8-kimi-k3-rerun`, `phase55-replay-sonnet` and `ecommerce-example` in as well —
   all are on disk, all render, and `ecommerce-example` is the reference build the doctrine was
   written from, which makes it the control this table has never had.

## §8 — Gates run

| Gate | Result |
|---|---|
| `score-design.js` × 6 replays, twice (before/after) | ✅ completed, own headless Chrome, beside the user's live Electron stack |
| graph-only sweep of both authoring rows × 20 projects on disk | ✅ `real-copy` red on 4, `empty-state` green on 1 |
| `test:ci` / `test:main` / editor | ❌ **not run and not runnable** — the user's dev stack was live for the whole session |

⚠️ `render:report` was confirmed safe again by the F44 rule: each of the twelve scoring runs printed a
complete report. One run failed with *"Chrome never opened a debugging port"* immediately after the
previous run's Chrome exited; it was re-run after a pause and completed. **A scoring run that prints
no criteria table did not happen** — the absence is the tell, exactly as with the `Jasmine:` line.
