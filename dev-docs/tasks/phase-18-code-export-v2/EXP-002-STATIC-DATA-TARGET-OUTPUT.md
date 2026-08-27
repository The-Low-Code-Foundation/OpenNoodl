# EXP-002 Static Data — the target output (session 18)

**Decided on paper before code, like every slice since step 5. Read this before touching Static
Data translation, module-constant hoisting, or the For Each `items` feeds.** This is the slice
[EXP-002-MODEL2-TARGET-OUTPUT.md](./EXP-002-MODEL2-TARGET-OUTPUT.md) §7 re-ranked to the front,
and unlike Model2 it survived the same scrutiny: the corpus was re-measured from scratch this
session, and the emitter was run over it, before any design was written.

Sources read first: `packages/noodl-runtime/src/nodes/std-library/data/staticdata.ts`,
`packages/noodl-runtime/src/collection.ts` (`set`, the plain→Model minting at 515–547),
`packages/noodl-runtime/src/csv.ts` (`parseCSVRows`/`rowsToRecords`, the shared tokeniser), and
on the emit side `src/analyze/plan.ts` (`resolveExpr`, `exprTsType`, `RepeaterPlan`) and
`src/emit/component.ts` (`renderRepeater`, the three existing `items` feeds).

---

## §1 What the runtime actually does (`staticdata.ts`, read first)

`Static Data` (displayed **Static Array**) parses an inline authored blob into a collection.

- **All three inputs — `type`, `csv`, `json` — are `allowEditOnly: true`.** No wire can feed
  them. This is the load-bearing property of the whole slice: the array is knowable at emit
  time *by construction*, not by a solver that happens to succeed.
- **`type` defaults to `csv`, and `type === undefined` also parses CSV** (`parseData`'s first
  branch is `undefined || 'csv'`). An emitter that reads "unset" as "no data" is wrong; unset
  means CSV.
- **`items` is a `Collection`, not a plain array.** `Collection.get()` mints a *fresh* one on
  every **successful** parse, then `set(parsed)` turns each plain row into a `Model`
  (`Model.create(plain)`, collection.ts:534). Rows are memoised per object identity in a
  WeakMap, and the `id` field is treated as the record's identity, not as ordinary data
  (collection.ts:542 skips it when writing fields back).
- **`count`** is `collection.size()`, or `0` when no parse has succeeded.
- **Failure is NDA-012's shape, and it is asymmetric.** A JSON parse failure leaves `items`
  *unchanged* — the collection is rebuilt only on success, deliberately, so `Count` and `Items`
  can never disagree. `error` holds the message, and `failure` fires once per *distinct*
  message (`lastReportedError` dedupes a repeat).
- **CSV and JSON do not agree on types.** CSV makes every cell a string; JSON keeps numbers and
  booleans. The node's own `json` port description says so.

**The load-bearing finding:** an authored blob behind edit-only ports is a *build-time
constant*. There is no frame, no arrival order and no invalidation to model — the three things
that make most of this corpus hard. That is why this slice is small.

## §2 The corpus (re-measured this session — `sd-survey.ts`, `sd-shape.ts`, `sd-props.ts`)

Session 17's numbers were re-derived from scratch rather than quoted, and they hold exactly.
14 Static Data nodes survive the audit's signature dedupe, across 13 host projects (24 raw).

| dimension | result |
|---|---|
| `type` | **14/14 `json`.** Zero CSV, zero unset. |
| parses | **14/14**, every one into an array of objects. |
| consumers of `items` | **14/14 exactly one — `items → For Each.items`.** No other sink, ever. |
| `failure` / `error` / `count` consumed | **none.** `items` is the only outgoing wire on all 14. |
| repeater template | **14/14 statically named**, `templateType` unset (never `dynamic`). |
| repeater mapping | **14/14 identity** (no `inputMappingScript`). |
| row shapes | **13/14 fully regular**; 0 ragged, 0 mixed-type, 0 null. **1 nested** (`links`). |
| usable row `id` | **3/14** (unique and present on every row). |

**And the artefact, not just the input.** Running the real emitter over the hosts (`sd-emit.ts`)
returns the exact gate this slice opens, on all 14:

```
For Each <id> deferred to EXP-003 (items are not fed by a query, a named array, or a statically-known list)
wire <sd>:items-><repeater>:items dropped: items are fed by no statically known source
```

**The contrast with Model2 is the whole reason this is next: the templates already emit.** Every
one of the 14 resolves to a real emitted file (`src/components/ProductCard.tsx`,
`CategoryCard.tsx`, `FooterColumn.tsx`). Model2's instances were blocked by their hosts; these
are blocked only by the feed, and the feed is a constant.

**Props line up too** — 98 template props across the 14 pairs, **90 matched by a row field**.
All 8 unmatched are `onAddToBasket` (4) and `onBrowse` (4): *callbacks*, not data, and exactly
the row-output relay that stays deferred on its own existing reason (§5). The 3 row fields with
no matching prop are the 3 `id`s — which is what §3 keys on rather than passes down.

> ⚠️ **Instrument correction, recorded because it nearly became a finding.** `sd-shape.ts` first
> read template inputs off `NodeIR.ports` and reported **"0 template inputs" for all 14**. That
> field carries only `dynamicports` declarations; the emitter resolves the identity mapping
> through `templatePlan.props`. A uniform zero with no known-firing signal beside it is a broken
> accessor, not a measurement — `sd-props.ts` re-read it off the *emitted* props interface, where
> 14/14 resolve. Had the zero been believed, this document would have claimed the mapping was
> empty and the slice worthless.

## §3 The design: a frozen module constant and a fourth `items` feed

Emitted into the **hosting component's own module scope** — the data is authored inside that one
component and has exactly one consumer, so it needs no shared module:

```tsx
type FeaturedProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number;
  badge: string;
  reviewCount: number;
  image: string;
  imageAlt: string;
};

const FEATURED_PRODUCTS: readonly FeaturedProduct[] = Object.freeze([
  { id: 'p1', name: 'Stoneware mug', /* … */ },
  // …
]);

export function FeaturedProducts() {
  return (
    <section className={styles.root}>
      {FEATURED_PRODUCTS.map((item) => (
        <ProductCard
          key={item.id}
          name={item.name}
          description={item.description}
          price={item.price}
          /* … */
        />
      ))}
    </section>
  );
}
```

**This is deliberately *not* the §4e `itemsExpr` path.** That path's contract is stated in its
own comment: *"a plain-list feed has no statically-known item shape — fields read as `any` off
the untyped list, so every mapped input is kept."* Static Data's shape **is** known, so routing
it through `itemsExpr` would throw away the one thing that makes it the best slice available.
It takes the `collection`-path treatment instead: a derived type, the `allowedFields`
restriction with a reported drop, and a real key.

So `RepeaterPlan` gains a fourth, mutually exclusive feed beside `itemsQueryId`,
`itemsCollectionName` and `itemsExpr`:

```ts
/** A Static Data node whose parsed rows are hoisted to a module constant (STATIC-DATA §3). */
itemsStaticId?: string;
```

with the parsed rows, the derived type and the chosen constant name carried on a
`StaticDataPlan` keyed by node id — the `queries`/`collections` precedent, not a new mechanism.

### 3.1 Type derivation (the rules, stated for shapes the corpus does not yet contain)

Derived from the parsed rows, and specified beyond what 13/14 exercise so the 14th and the next
corpus do not surprise it:

- **Keys** are the union across all rows, in first-seen order.
- A key **absent on any row** is optional (`name?: string`). *0/14 today.*
- **Per-key type** is the union of its JS types: `string`, `number`, `boolean`. A key mixing
  types emits the union (`string | number`). *0/14 today.*
- **`null`** widens to `| null`. *0/14 today.*
- **Nested objects and arrays recurse** into a named sibling alias — the `links` case, which is
  regular and types cleanly:

  ```ts
  type FooterColumnLink = { id: string; label: string };
  type FooterColumnRow = { id: string; title: string; links: readonly FooterColumnLink[] };
  ```

  An **empty array** with no element to inspect widens to `readonly unknown[]`; a nested array of
  mixed element types does the same rather than emitting a union of structural literals.

### 3.2 The key, and why `id` is principled here

`key={item.id}` when **every** row carries a unique, primitive, non-null `id`; otherwise
`key={index}`. **3/14 get `id`, 11/14 index.**

This is not a convenience: `Collection.set` mints each plain row into a `Model` and treats `id`
as the record's identity rather than ordinary data (collection.ts:542). Keying React on `id`
when it exists mirrors the runtime's own notion of which row is which. Where there is no `id`
the runtime has no stable identity either, so index is not a downgrade — it is the same
information.

### 3.3 Naming

The constant is `SCREAMING_SNAKE` from the node's authored label (`products_data` →
`PRODUCTS_DATA`), the item type is `PascalCase` singular of the same. Both go through the
existing reserved-name set (`plan.props`, `outputProps`, `queries`, state vars) so a constant can
never shadow a prop; a collision suffixes `_1`, the established rule.

## §4 The gates (any hit ⇒ the node defers, reason named)

1. **`type` is `csv` or unset** — *"CSV is not translated in this slice"*. `0/14`. Deferred by
   choice, not difficulty: `parseCSVRows`/`rowsToRecords` are already shared and importable, but
   CSV's every-cell-is-a-string typing is a different derivation from §3.1 and nothing in the
   corpus exercises it. A cheap follow-up slice, not a hidden hole.
2. **JSON does not parse** — *"the authored JSON does not parse"*. The runtime's answer is to
   leave `items` at its previous value; at export there is no previous value, so there is
   nothing honest to emit.
3. **Parsed value is not an array** — *"the authored JSON is not an array of records"*.
4. **Any row is not a plain object** (scalar, array, or `null`) — *"a row is not a record"*.
   `Model.create` on a scalar has no field to map.
5. **`failure` or `error` is consumed by any wire** — *"the parse-failure channel is wired, and a
   node that reaches emit has already parsed"*. Measured `0/14`, so this gate costs nothing
   today. It exists because the alternative is silent: a node that parses can never fire
   `failure`, so emitting nothing would delete a wired behaviour rather than defer it.
6. **`count` is consumed** — translated as `CONSTANT.length`, which is correct by construction.
   `0/14` exercise it, so it ships **with a fixture and no corpus evidence**, and that is stated
   rather than implied.
7. A **second consumer of `items`** does not gate this node. The constant is module-scoped and
   any reader can read it; the *other* consumer defers or translates under its own rules. `0/14`
   today.

The repeater's own existing gates are unchanged and still apply on top: an unresolvable template,
`templateType: dynamic`, or a non-identity mapping script still defers the For Each, and then the
constant is emitted but unused — which is a note, not an error.

## §5 What stays deferred (unchanged, and measured)

**The row-output relay.** `ProductCard.onAddToBasket` (4) and `CategoryCard.onBrowse` (4) — 8 of
the 98 template props — keep their existing reason verbatim:

```
a repeater relays its rows' outputs into "addToBasket" — which row fired is not statically
expressible in this slice
```

and the two `Component Outputs` nodes they feed stay deferred with them. **The gain of this slice
is the render, not the chain**, exactly as §7 of the Model2 document projected. Nothing here
changes that, and no number in this document should be read as if it did.

## §6 Recorded divergences (the standing register)

1. **`Collection` → frozen plain array.** The runtime hands downstream a `Collection` of `Model`s
   with `.size()`, `.items` and change notification; the export emits `readonly T[]`. In-slice the
   only consumer is `.map()` in render, so no observable behaviour differs — but a later slice
   that wires `items` into something expecting a Collection must re-open this.
2. **Parse timing.** The runtime re-parses whenever the authored text changes and mints a new
   collection id each time (the node's own comment: *"the id is not stable across edits"*). The
   export freezes at build time. Unobservable, because the inputs are `allowEditOnly` — there is
   no runtime edit.
3. **CSV's string-typing is not reproduced**, because CSV defers (§4.1). Recorded so that adding
   CSV later is understood as a *typing* change, not just a parser call.
4. **A runtime parse failure preserves the previous `items`; the export defers the node.** Two
   different answers to the same input, both deliberate (§4.2).

## §7 Corpus impact — a projection, not a result

**14 repeaters should flip from deferred to rendering**, across 8 distinct template components,
in the most repeated shape in the corpus (ProductCard/CategoryCard/FooterColumn). The 8 callback
props and 2 Component Outputs nodes stay deferred.

**No coverage percentage is quoted here.** The corpus stands at **86.7%** (2,361/2,724) from
session 16 and is unmoved until code lands; it must be re-measured with the **s16 audit
instrument over the same 40-project list**, because the aggregate depends on the signature dedupe
and a different script over a different list is not comparable. The ledger's `Static Data` entry
flips `deferred` → `translated` in the same commit as the code, never before.

## §8 Fixture & test plan (the EXP-002 discipline)

Fixtures, each a minimal project, each asserting emitted source **and** a rendered outcome where
the shape allows:

- **`static-data-basic`** — 3 rows, no `id`, identity mapping → module constant, `key={index}`,
  props threaded. The ProductCard shape, the 11/14 case.
- **`static-data-id-key`** — unique `id` on every row → `key={item.id}`, and `id` **not** passed
  as a prop. The 3/14 case.
- **`static-data-nested`** — the `links` shape → sibling type alias, `readonly` nested array.
- **`static-data-shapes`** — ragged keys, a mixed-type key, a `null`, an empty nested array. All
  `0/14` in the corpus; this fixture is the only thing standing behind §3.1, so it carries the
  whole rule.
- **`static-data-defers`** — one project per gate in §4 (CSV, unset type, malformed JSON,
  non-array, scalar row, wired `failure`), each asserting the **named reason**, not merely that
  something deferred. A gate that defers for the wrong reason passes a weaker test.
- **`static-data-count`** — `count → Text.text` → `CONSTANT.length`. The fixture that stands in
  for absent corpus evidence (§4.6).
- **Goldens** for two real corpus components (FeaturedProducts, SiteFooter), which protect the
  later AST refactor the way the existing goldens do.

A `static-data-defers` case must fail if the reason string changes, so the reasons in §4 are the
contract, not commentary.
