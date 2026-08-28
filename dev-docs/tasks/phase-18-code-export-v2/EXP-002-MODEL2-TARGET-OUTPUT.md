# EXP-002 Model2 — the paper design, and the ruling not to build it yet (session 17)

> ## 🔴 SUPERSEDED IN PART, 2026-08-28 (session 32) — read this before acting on anything below
>
> **§2, §3 and §7 are void as a priority argument.** They rank this work by how often `Model2`
> appears in the ~40-project corpus. Every one of those 72 instances is inside a downloaded
> third-party Noodl prefab kit (`filters-0-1.zip`) that **no project ever places on a page** —
> session 31 measured it. Sessions 17–31 repeatedly promoted "row identity" to the top of the
> list on the strength of those counts. It was dead code the whole time.
>
> **§1, §4, §5 and §6 are still good and should be reused.** The runtime reading is correct, and
> §4's design — a foreach-mode Object compiles away into props, the repeater's row read sideways —
> is the right shape. Rebuild it against the **picker** (`Object` is one of the 27 Data-category
> nodes a user can place today and cannot export), verified against a project somebody would
> actually build. See [EXP-011](./EXP-011-PICKER-COVERAGE.md) §3 Tier 1.

> **Read this before writing any Model2, repeater-item or `_forEachModel` code, and before
> ranking another slice by node count.** The headline is a negative result, measured: the
> deterministic Model2 slice would translate **0 of the corpus's 27 Model2 nodes**, because
> not one of them is blocked by Model2. They are blocked by the repeaters that host them.
> §7 re-ranks what to build instead, on the same evidence.

The standing discipline held and paid: the runtime sources were read before guessing (§1) and
the corpus was measured before designing (§2). Both overturned what the handoff assumed.

---

## §1 What the runtime actually does (`modelnode2.ts`, `foreachitem.ts`, read first)

`Model2` (displayed **Object**) is a window onto a record in the client-side `Model` store.

- **`properties`** is a comma-separated stringlist that mints the dynamic ports: each name `p`
  gets a **`prop-p` plugged `input/output`** (one port, both directions) and a `changed-p`
  signal. Reads are `model.get(p, {resolve: true})`; writes accumulate in `inputValues`,
  mark `dirtyValues[p]`, and flush end-of-frame in `scheduleStore`.
- **`idSource` is the fork, and it is the whole design question.**
  - `explicit` — the record is `Model.get(modelId)`, **create-on-read**. The id is a runtime
    value arriving on a wire.
  - `foreach` — the record is the **ambient repeater item**: `bindToRepeaterItem` calls
    `resolveForEachItem`, which walks the component tree for `_forEachModel`. That property is
    hung on the template's component instance by whoever instantiates it (`For Each`, and also
    `runtasks.ts:193` — two producers, not one), *before* the template's inner nodes are built.
- **`modelId`'s setter is polymorphic**: a `Model` dereferences to its id, a plain JS object is
  minted into a new record, `null`/`''` clear the binding (NDA-012 — an empty id is *no*
  object, not a new one).
- `setModel` is the single place the binding changes, and it flags `id` and `object` together
  so the two can never disagree. `fetch` → `scheduleSetModel` mints outcomes before the
  coalescing guard, so two presses in one pass do one rebind but still report twice.
- Values arriving at `prop-p` **before** a record is bound are held in `dirtyValues` and
  written by `setModel` the moment one arrives — the cross-frame flush NDA-012 added.

**The load-bearing finding:** in `foreach` mode there is no id, no name and no store lookup.
The node is a *reader of whatever row the enclosing repeater is currently rendering*. That is
not per-record state at all — it is the repeater's item, reached sideways.

## §2 The corpus (`m2-survey.ts` / `m2-reach.ts`, session 17 scratchpad)

27 Model2 nodes survive the audit's signature dedupe (72 raw: **9 distinct components × 8
projects**, all clones of one Filters kit; the dedupe leaves 3 signatures). Measured, not
assumed:

| dimension | result |
|---|---|
| `idSource` | **27/27 `foreach`.** Zero `explicit`. |
| `modelId` | **27/27 absent** — no parameter, no wire. |
| `repeaterComponent` | 27/27 unset (nearest-wins). |
| `prop-*` traffic | **135 reads, 0 writes.** |
| signal ports consumed | **none** — no `fetch`, `changed`, `changed-*`, `fetched`, `done`, `failure`. |
| other outputs | `id` → `SetModelProperties.modelId`, 3× (the one write path, itself deferred). |

Reads land on `Text.text` (15), control `label`/`checked`/`value`/`min`/`max`/`step`/
`startValue`/`placeholder` (≈39), `ComponentObject.value-Date` (3) and — dominantly —
**`JavaScriptFunction.in-*` (63)**.

**§6 of NAMED-STORES was wrong about why this defers.** It said Model2's instances are
"id-addressed… which record a node reads is a runtime value on its `id` input". Not one corpus
instance is id-addressed. The real blocker is one level up, and `m2-reach.ts` found it:

- **7 of the 9 host components are never named as a template anywhere.** The `Filters` root's
  For Each is `templateType: "dynamic"` with
  `templateScript: if(item.Type !== undefined) component = './' + item.Type` — the filter
  component is chosen **per row, at runtime, from the row's own data**.
- **The other 2** (`Filters/Multi Choice/Item`, `Filters/Single Choice/Item`) *are* statically
  named — but their repeaters' `items` come from `ComponentObject.value-Checkboxes` /
  `value-Items`, and those keys are written **only by a JavaScriptFunction**
  (`Component.Object.Checkboxes = (Inputs.Options||[]).map(o => Noodl.Object.create({…}))`).
  Per COMPONENT-OBJECT §3 a key no wire writes reads the `undefined` boot value.

Confirmed against the artefact, not the reasoning — the current exporter over `fix016-msg6-drive`
already says both halves in its own words:

```
Filters: For Each c75b97b0 deferred to EXP-003 (no template component)
Filters/Multi Choice: For Each 761c74a5 deferred to EXP-003
        (items are not fed by a query, a named array, or a statically-known list)
Filters/Multi Choice: wire c10f6f4c:value-Checkboxes->761c74a5:items dropped:
        items are fed by a source not statically typed as a list (undefined)
```

## §3 The ruling: designed, not built

**Every route to a Model2 item record in this corpus is closed by its host**, and the host's
blocker is script-shaped (a dynamic template script, or a `Noodl.Object.create` items writer) —
EXP-003 Tier B, the tier the ranked list already names. Building the Model2 vocabulary now
would emit template components whose props nothing passes, because no call site renders them.
The ledger count would rise and the emitted app would not change: a lever moved without its
denominator, which this phase has a standing rule against.

So the design below is settled on paper — the session's real output, so it is not re-derived —
and the slice is built **after** Tier B translates the two writers, when it pays for itself.

## §4 The design, for when it unblocks

**Model2 in `foreach` mode compiles away into props — it is the repeater's row, read sideways.**
This is the CO slice's "the record compiles away" move, applied one level out, and it reuses the
repeater machinery already in `RepeaterPlan`/`renderRepeater` rather than inventing a runtime
concept.

For a template component `T` hosting a foreach-mode Model2 whose read set is `{p₁…pₙ}`:

- **Child side.** Each `prop-pᵢ` read resolves to a **prop read** on `T`. The prop's name is the
  property name itself (the author's own word), deduplicated against `takenNamesOf(plan)` and
  typed from the row's static shape where the items literal gives one, else `unknown`.
  Reads then flow through the existing `resolveExpr`/render vocabulary unchanged.
- **Parent side.** The hosting `For Each` binds `pᵢ={item.pᵢ}` at the call site — exactly
  `memberExpr(itemLocal, field)`, the identity-mapping path `renderRepeater` already emits.
  This is a **second planning phase over the child's plan**, the `liftedOutputProps` precedent
  from CONTROLLED-STATE §10: the parent cannot bind a prop the child's emitted interface does
  not yet declare, or the emitted app's own `tsc` fails.
- **Writes** (`prop-p` as input, and the `SetModelProperties` pair) are **not** props — a row
  written from inside the row is state owned by the list. That is the collection-state slice;
  it defers here, named.

`explicit` mode keeps NAMED-STORES §6's shape and stays deferred: `Model.get` is create-on-read
against a global store, so it is `store()`-family work, and the corpus has no instance to
design against. Designing it now would be inventing against zero evidence — the thing §2 just
caught the handoff doing.

## §5 The gates (any hit ⇒ the node defers, reason named)

1. `idSource` is `explicit` (or unset — the default is `explicit`), or `modelId` is wired.
2. The host component is **not** statically the `template` of exactly one For Each — including
   `templateType: "dynamic"`, an unset template, and a component instantiated from two call
   sites with different row shapes.
3. That For Each's `items` has no statically-known list (`itemsExpr` absent) — the row shape is
   unknown, so the props have no types and the bindings no source.
4. Any `prop-*` **input** wire, or a `SetModelProperties` targeting this node's `id`.
5. Any signal output consumed (`changed`, `changed-*`, `fetched`, `done`, `failure`), or
   `fetch` wired — signal-on-write is `effect()` work, as everywhere else.
6. A dotted property name (`{resolve: true}` path resolution), or `repeaterComponent` authored
   (BINDING-CONTRACT §a explicit targeting — nearest-wins is what the props model assumes).
7. `runtasks.ts` is the other `_forEachModel` producer: a host reachable from a `Run Tasks`
   template defers, because the row is a task input, not a rendered list item.

## §6 Recorded divergences (when built)

- The runtime's reads are live against a `Model` with `change` subscriptions; props re-render
  on the parent's array identity. Equivalent for rendering, different for signal chains — and
  signal chains defer (gate 5).
- `prop-p` for a `p` absent from the row reads `undefined` in both worlds; the CO slice's
  undefined-folding table applies unchanged at the sinks.
- The record's `id` has no counterpart in the emitted app (gate 4 removes the one consumer).

## §7 The re-ranking, measured (`m2-rank.ts`)

The s16 handoff ranked slices by raw node count. That counts the **population**, not the
**translatable population** — the distinction §2 just paid for. Deferred types by deduped corpus
frequency, with the blocked ones marked:

| n | signatures | type | translatable now? |
|---|---|---|---|
| 27 | 3 | `Model2` | **no** — every instance behind a deferred host (§2) |
| 14 | 4 | `Logic Builder` | yes — structured JSON program, self-contained |
| 14 | 8 | `Static Data` | **yes — and it unblocks 14 repeaters** |
| 11 | 4 | `Javascript2` | EXP-003 |
| 8 | 7 | `NewDbModelProperties` | backend-write family |

**`Static Data` is the slice to build next**, and unlike Model2 the claim is measured
(`sd-survey.ts`): of 14 nodes, **14/14** are `type: json`, **14/14 parse** into flat record
arrays, **14/14** have exactly one consumer — `items → For Each.items` — and **14/14** of those
repeaters have a **statically named template with identity mapping**. Its inputs are all
`allowEditOnly` (`staticdata.ts`), so the array is knowable by construction: a module constant
plus the `.map()` `renderRepeater` already emits. It reaches **8 signatures to Model2's 3**, and
it is the ProductCard/CategoryCard shape — the most repeated component in the whole corpus.

Stated as a projection, not a result: the rows should render; the **row-output relay**
(`ProductCard.addToBasket → Component Outputs`) stays deferred on its own existing reason
("which row fired is not statically expressible"), so the gain is the render, not the chain.
Measure it with the s16 audit instrument before quoting a number.

Then `Logic Builder` (deterministic, 14/4), then **EXP-003 Tier B — which is what actually
unblocks this document.**
