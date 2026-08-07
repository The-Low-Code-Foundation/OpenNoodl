# BCN-005: Relations Across Five Backends

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-005 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 2 — the adapters |
| **Priority** | 🟠 High |
| **Difficulty** | 🟠 Medium-Hard — five relational models with genuinely different write semantics |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | BCN-004 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Make `addRelation`, `removeRelation` and relation traversal work across all five backends to the extent
each one genuinely supports, with the differences declared rather than discovered.

## Background

Richard named relations as important for all backends, and he is right that they are the thing which
makes the data nodes actually equivalent rather than nominally equivalent. He is also describing the
hardest row in the matrix, because the five backends do not merely spell relations differently — they
disagree about what a relation *is*.

| Backend | Model | Read | Write |
|---|---|---|---|
| Parse / NodeGX | `Pointer` (single) and `Relation` (many, opaque) | `include=` | `AddRelation`/`RemoveRelation` ops |
| Directus | M2O / O2M / M2M via a `directus_relations` table | dotted `fields=*,author.*` | write the FK, or the junction row |
| Supabase | Postgres FKs | PostgREST embed `select=*,author(*)` | write the FK, or the junction row |
| PocketBase | `relation` field type, single or multiple | `expand=` | write the field, array-valued for many |
| Custom | unknown | — | — |

Parse's `Relation` is the odd one: a many-to-many with no addressable junction, mutated only through
dedicated add/remove operations. The other three expose the junction as a table you write to. A
contract that assumes either shape breaks the other.

RUN-003 slice 6 already shipped one-hop M2O traversal for Directus and Supabase — dotted pseudo-fields
(`author.name`, displayed `Author → Name`), type and enum values carried from the target field, `Include
<relation>` boolean ports appending `fields=*,author.*`, and stale include-params validated against the
cached collections so a toggled-on include for a since-changed collection cannot poison a request. That
is the read half, for two backends, and it is the template.

**RUN-003's recorded residual: O2M and M2M are unparsed**, because they need `GET /relations` which the
schema parser never calls. That residual is this task's first line item.

## Current State

| Piece | State |
|---|---|
| M2O read | works — Directus and Supabase, one hop, dotted paths, `Include` ports (RUN-003 slice 6) |
| O2M / M2M parse | **missing** — `foreign_key_table` handled, `GET /relations` never called |
| PocketBase relations | parser exists, never exercised against a real instance |
| Parse relations | `addRelation`/`removeRelation` on the contract; `AddDbModelRelation`/`RemoveDbModelRelation` nodes |
| Depth | one hop only, by design |
| Filter over relations | dotted paths work in the Directus dialect (and the runtime copy was the RUN-003 403) |

## Desired State

1. **`GET /relations` (and each backend's equivalent) is read at schema sync**, so O2M and M2M appear in
   the parsed schema with their junction described where one exists.
2. **Relation reads are uniform**: `include`/`expand`/embed all express the same contract option, and a
   record comes back with the related record nested, whatever the wire syntax was.
3. **Relation writes are contract methods with declared support.** `addRelation`/`removeRelation` map to
   the dedicated ops on Parse, and to junction-row writes on the other three. Where a backend requires
   the junction collection to be nameable and the schema does not describe it, the capability is
   `conditional` and the port says so.
4. **One hop stays the limit.** RUN-003 chose it deliberately; depth-2 multiplies the port surface and
   the query cost without a demonstrated need. Record it as a decision, not an omission.
5. **The `Add Record Relation` / `Remove Record Relation` nodes serve every backend** or are visibly
   gated off where they cannot.

## Implementation Steps

1. Extend the schema parsers to call each backend's relation-metadata endpoint; represent O2M and M2M in
   `SchemaField`/`SchemaCollection` alongside the existing `relationTarget`/`relationType`.
2. Generalise RUN-003's `getRelationFields`/`expandRelationFields` to consume the enlarged model and to
   emit the same dotted pseudo-fields for all backends.
3. Implement relation reads per adapter behind one contract option.
4. Implement relation writes per adapter; declare capability per backend, `conditional` where the
   junction is not describable from the schema.
5. Exercise PocketBase relations against a real instance for the first time.
6. **Live pass**: for each backend, create two records, relate them, read the parent with the relation
   included, filter on a dotted path across the relation, then unrelate — and assert the row sets.
7. Flip descriptor cells.

## Success Criteria

- [ ] O2M and M2M appear in the parsed schema for every backend that has them — RUN-003's residual is
      closed by name.
- [ ] Relation reads return a nested related record from all five backends through one contract option.
- [ ] Relation writes work where declared, and the port is disabled with a reason where not.
- [ ] Dotted-path filters across a relation return correct row sets on every backend — verified live,
      not shape-tested.
- [ ] PocketBase relations exercised against a real instance.
- [ ] Stale-include validation (RUN-003's cached-collections check) still holds for every backend.
- [ ] The one-hop limit is recorded as a decision in this file's Out of Scope, not left implicit.

## Out of Scope

- **Depth-2 traversal.** Deliberate. Revisit on demonstrated demand.
- **Schema *authoring*.** Creating a relation in the user's backend is that product's admin UI.
  `nodegx-backend`'s schema manager is Phase 22's.
- **Cascading deletes.** Backend behaviour; NodeGX does not simulate it.
- **Junction-table modelling for `custom`.** Config-driven backends declare relations or do not have them.

## Traps

- **Parse's `Relation` has no addressable junction.** A design that models every M2M as "write a row to
  the junction collection" cannot express it. The contract must be add/remove-shaped, with junction
  writes as an *implementation* on the backends that work that way — not the other way round.
- **The runtime and editor converters diverging is the known failure of this exact area.** RUN-003's 403
  came from a runtime copy that did not nest dotted paths. BCN-003 made translators shared; relation
  path handling must ride the same shared functions and not grow a second copy here.
- **Supabase embeds require the relation to be selected before it can be filtered on.** `author.name=eq.x`
  without the corresponding `select=…,author(*)` does not filter — it errors or, worse, ignores. This is
  a PostgREST-specific coupling between the read shape and the filter shape.
- **PocketBase's multi-valued relation fields are arrays on the record itself**, so "add a relation" is a
  read-modify-write with a lost-update window. Say so in the capability caveat rather than pretending it
  is atomic.
- **`Include` ports that outlive their collection.** RUN-003 hit this: toggle an include on, switch the
  collection, the port disappears but the saved parameter survives and poisons the request. The
  validation exists — make sure it generalises rather than staying Directus-shaped.