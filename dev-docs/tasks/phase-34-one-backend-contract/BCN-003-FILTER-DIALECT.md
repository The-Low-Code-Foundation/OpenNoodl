# BCN-003: The Filter Dialect — One Translator Per Backend

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-003 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 1 — the contract |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟠 Medium-Hard — five dialects, three of them net-new, and the failure mode is a wrong result rather than an error |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | BCN-001 (the operator enumeration) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — bounded and well-precedented, but a filter that returns the wrong rows without erroring needs adversarial thinking about equivalence |

## Objective

One pure, unit-tested translator per backend, from the neutral filter model both existing filter
builders already emit, to that backend's query dialect — with a stated operator-support declaration and
**no silent dropping of an operator a backend cannot express.**

## Background

This is the largest genuinely per-backend surface in the phase, and it is also the best-precedented.
The neutral model exists twice already and nobody wrote it down:

| | Builder | Property-editor type | Translator |
|---|---|---|---|
| Parse-wire | `components/QueryEditor/` (7 components) | `QueryFilterType.ts`, 60 lines | [`queryutils.ts::convertFilterOp`](../../../packages/noodl-runtime/src/api/queryutils.ts#L255) |
| BYOB | `components/ByobFilterBuilder/` (~1.9k lines) | `ByobFilterType.ts` | `byob-utils.ts::toDirectusFilter` |

Both consume `{and:[…], or:[…], <field>:{op:value}}`. Both translate it with one pure function. **Two
independent implementations converged on the same model**, which is the strongest argument available
that the model is right and the work is additive.

RUN-003 also left the precedent for how this goes wrong. Its slice 6 shipped a runtime `_toDirectusFilter`
that duplicated the editor's converter and **never nested dotted relation paths** — it emitted a flat
`{"author.name": {...}}` key that live Directus rejects with 403. Unit tests could not catch it because
only a real fetch exercised the runtime copy. The fix was to extract one exported pure function used by
both sides. **That is the architecture this task generalises**: one translator per backend, shared by
editor and runtime, never two copies.

## Current State

| Backend | Dialect | Translator today |
|---|---|---|
| Parse / NodeGX | Mongo-ish `{$eq, $gt, $in, $and, $or}` JSON body | `convertFilterOp`, in `noodl-runtime/src/api/` |
| Directus | `{field: {_eq: v}}`, `_and`/`_or`, dotted relation paths | `toDirectusFilter` in `byob-utils.ts` |
| Supabase | PostgREST **query string** — `?name=eq.x&or=(a.gt.1,b.eq.2)` | **none** |
| PocketBase | **string DSL** — `name = "x" && age > 3` | **none** |
| Custom | config-driven | none |

Supabase and PocketBase are the awkward ones and for opposite reasons: PostgREST is a query string
rather than a JSON body, so nesting and escaping are positional; PocketBase's filter is a *string
expression* that must be serialised and parameterised, not assembled by concatenation.

## Desired State

### 1. One exported pure function per backend

`toParseWhere`, `toDirectusFilter`, `toPostgrest`, `toPocketBaseFilter`, `toCustomFilter` — each a pure
function of `(neutralFilter, schemaContext) → dialect`, importable by **both** the editor and the
runtime. No backend gets two copies. This is a hard rule, not a preference, and it is why the RUN-003
403 happened.

### 2. Operator support is declared, and unsupported operators fail loudly

Each translator declares which of BCN-001's enumerated operators it can express. An operator the
backend cannot express **must not be silently dropped** — a filter that quietly loses a condition
returns more rows than the builder asked for, which is a data-exposure bug wearing the costume of a
minor gap. The translator raises; BCN-010 gates the operator out of the builder's dropdown so the user
never reaches the raise.

### 3. Parameterisation, not concatenation

PocketBase's string DSL is the one place where building the query by string-joining user values is both
the obvious implementation and an injection vector. Use its parameter binding. Assert it in a test with
a value containing a quote and an `&&`.

### 4. Equivalence tests, not just shape tests

Each translator has unit tests asserting output *shape*, and a **live equivalence test** asserting that
the same neutral filter returns the same row set from every backend that supports its operators.
Shape-only tests are what let RUN-003's flat dotted path through.

### 5. The two filter builders converge

`ByobFilterBuilder` (~1.9k lines) is measurably ahead of `QueryEditor` — RUN-003 slice 5 found it ahead
on operators, nesting, drag-drop and JSON editing, and then added connected-value ports and enum/boolean
value editors. **It becomes the single builder**, with `QueryEditor`'s Parse-specific affordances
(`QueryPointerRule`) folded in as a relation-aware rule type. The Parse family loses nothing and gains
the better UI.

## Implementation Steps

1. Lift the neutral model and operator set from BCN-001 into a shared type, and make both existing
   translators consume it explicitly rather than by convention.
2. Relocate `convertFilterOp` and `toDirectusFilter` into the adapter module home, exported pure, with
   their four `records.js` call sites and the runtime/editor consumers repointed.
3. Write `toPostgrest` — query-string construction, `or=(…)` grouping, and the embed syntax for relation
   paths (`author.name=eq.x` requires the embed to be selected).
4. Write `toPocketBaseFilter` — expression serialisation with parameter binding.
5. Declare per-translator operator support; raise on unexpressible operators.
6. Converge the two builders on `ByobFilterBuilder`, folding in pointer/relation rules.
7. **Live equivalence pass**: one seeded dataset with the same logical shape in all five backends, one
   neutral filter set covering every operator, asserting identical row sets. The
   [uba-e2e rig](../phase-16-runtime-deploy-health/uba-e2e/) already containerises Directus and a
   PostgREST stack and is the vehicle — extend rather than rebuild.

## Success Criteria

- [ ] Five translators, each one exported pure function used by both editor and runtime — **no backend
      has two copies**, asserted by a grep in review.
- [ ] Every operator in BCN-001's enumeration is either translated or raises; none is dropped.
- [ ] PocketBase values are parameter-bound; a test passes a value containing `"` and `&&`.
- [ ] Live equivalence pass: identical row sets across all backends supporting a given filter, from one
      seeded corpus.
- [ ] Dotted relation paths nest correctly in every dialect that supports them — the RUN-003 403 case is
      in the test corpus by name.
- [ ] One filter builder remains; the Parse family's pointer rules survive inside it.

## Out of Scope

- **Sorting and pagination.** Same neutral-model treatment, different task — they ride BCN-004's adapter
  work where the response envelope is already being normalised.
- **Full-text search.** BAK-008's `search` parameter is a `nodegx-backend` capability; it is a
  descriptor cell, not a filter operator, and no other backend has an equivalent worth mapping.
- **Aggregate grouping.** `aggregate`'s `group` option is its own shape and is capability-gated.
- **Query optimisation.** A translator's job is equivalence, not efficiency.

## Traps

- **A shape test cannot catch a wrong-rows bug.** RUN-003's flat dotted path passed every unit test and
  failed on the first live fetch. The live equivalence pass is the deliverable; the unit tests are
  scaffolding.
- **Silently dropping an unexpressible operator returns *more* rows, not fewer.** It looks like it
  works, and it leaks data. This is the single worst outcome available in this task.
- **PostgREST puts filters in the query string**, so a design that assumes a JSON body — which the other
  four share — will need the response and request shaping to diverge. Do not force a body-shaped
  abstraction onto it.
- **PocketBase's DSL is a string and the naive implementation is `+`.** Injection.
- **`byob-utils.ts` maps `_null`/`_empty` operators to literal `true`** in the Directus dialect — an
  existing quirk that must survive the relocation. Read the editor converter and the runtime converter
  together before touching either; they were made identical deliberately.
- **Directus system-collection endpoint mappings** (17 `directus_*` constants in `byob-utils.ts`) travel
  with the Directus adapter, not with the shared translator infrastructure.