/**
 * What a relation *is*, across five backends that disagree about it.
 *
 * ## The shape is Parse's, and that is deliberate
 *
 * BCN-005's first trap says it: *"Parse's `Relation` has no addressable
 * junction. A design that models every M2M as 'write a row to the junction
 * collection' cannot express it. The contract must be add/remove-shaped, with
 * junction writes as an **implementation** on the backends that work that
 * way."*
 *
 * So {@link RelationWrite} is a discriminated union whose **first member is
 * `op`** — the junction-less Parse mutation — and the three junction-shaped
 * members are the ones that had to fit around it, not the other way round. The
 * contract method stays `addRelation(source, field, target)`; how that becomes
 * a request is per backend and is described here as data.
 *
 * ## Everything below was measured, not read
 *
 * `BCN-005-NOTES.md` carries the table with a `measured` column. The four
 * facts that shaped this file:
 *
 * 1. **Directus's M2M `include` is two hops.** `fields=*,tags.*` returns the
 *    *junction rows* (`{id, article_id, tag_id}`), not the tags. Only
 *    `fields=*,tags.tag_id.*` returns tags. A one-hop include on an M2M
 *    therefore returns a plausible wrong value with a 200 — which is the
 *    failure class this phase keeps finding. Hence {@link RelationDescriptor.readPath}.
 * 2. **PostgREST cannot see a junction whose primary key is a surrogate `id`.**
 *    The same two tables, the same two foreign keys: with `id SERIAL PRIMARY
 *    KEY` the M2M embed answers `PGRST200 … no matches were found`; with
 *    `PRIMARY KEY (article_id, tag_id)` it answers 200 and the rows. So M2M on
 *    PostgREST is a fact about the junction's key, not about PostgREST.
 * 3. **PocketBase has server-side `+` and `-` field operators**, they are
 *    set-shaped (appending a value already present is a no-op), and they work
 *    on single-valued relations too. The spec's "read-modify-write with a
 *    lost-update window" premise is stale.
 * 4. **Relation metadata needs an admin token on all three.** Directus
 *    `GET /relations` and `GET /fields` are 403 unauthenticated; PocketBase
 *    `GET /api/collections` is 401. A runtime holding a user token cannot
 *    discover a relation, which is why every function here is a **parser** the
 *    editor runs at schema-sync time and nothing here performs I/O.
 *
 * @module backend-contract/relations
 */

/** One end of a relation holds one record, or a set of them. */
export type RelationCardinality = 'one' | 'many';

/**
 * How a backend performs a relation write.
 *
 * The union is ordered by the argument above: `op` first, because it is the
 * shape that cannot be expressed as anything else.
 */
export type RelationWrite =
  /**
   * A dedicated add/remove operation on the record itself, with no addressable
   * junction. Parse's `__op: 'AddRelation'` / `'RemoveRelation'`, and ours.
   *
   * Set-shaped and atomic: adding a member twice leaves one member.
   */
  | { kind: 'op' }
  /**
   * The relation is a foreign-key column, so a write is an ordinary `save`.
   *
   * `on` says **which record carries the column**, which is the whole
   * difference between a many-to-one and its one-to-many reverse: writing
   * `article.author = 7` and writing `article.author = 7` *expressed as*
   * "add article 7 to author 3's articles" are the same request with the two
   * ids the other way round. Getting this backwards writes the id into the
   * wrong row and answers 200.
   */
  | { kind: 'foreignKey'; field: string; on: 'source' | 'target' }
  /**
   * The related ids live in an array on the record, and the backend has
   * server-side append/remove operators for it. PocketBase's `field+` /
   * `field-`.
   *
   * `setSemantics` records the measured fact that appending a value already
   * present is a no-op rather than a duplicate — which is what makes this
   * equivalent to `op` from a caller's point of view.
   */
  | { kind: 'arrayField'; field: string; setSemantics: boolean }
  /**
   * A junction collection with one row per pair.
   *
   * `idempotent` is **not** a property of the backend — it is a property of
   * this junction's schema. PostgREST with the pair as the primary key rejects
   * a duplicate (`23505`) and accepts an upsert; a junction with a surrogate
   * key silently stores the pair twice. See {@link RelationDescriptor} for what
   * an adapter must do when it is false.
   */
  | { kind: 'junction'; collection: string; sourceField: string; targetField: string; idempotent: boolean };

/**
 * One relation, as every part of NodeGX should see it.
 *
 * `target` is the neutral name for what `RelationOptions` still spells
 * `targetClass` — see that type for the rename decision.
 */
export interface RelationDescriptor {
  /** The collection the relation is reachable from. */
  collection: string;
  /** The field name a user picks, and the name an `include` uses. */
  field: string;
  /** The collection on the other end. */
  target: string;
  cardinality: RelationCardinality;
  write: RelationWrite;
  /**
   * The path an `include` must actually ask for, when it is not `field`.
   *
   * Directus alone: an M2M's one-hop path returns junction rows. Set to
   * `tags.tag_id`, and the adapter flattens the response back to the tags so
   * that a node sees the same shape it would on any other backend.
   */
  readPath?: string;
  /**
   * The key inside each junction row that holds the related record after a
   * two-hop include. Present exactly when {@link readPath} is.
   */
  readUnwrapKey?: string;
}

/** Index a descriptor list the way an adapter looks one up. */
export function findRelation(
  relations: readonly RelationDescriptor[] | undefined,
  collection: string,
  field: string
): RelationDescriptor | undefined {
  return (relations ?? []).find((relation) => relation.collection === collection && relation.field === field);
}

// ── Directus ───────────────────────────────────────────────────────────────

/** One row of Directus's `GET /relations`, as far as this module cares. */
export interface DirectusRelationRow {
  collection?: string;
  field?: string;
  related_collection?: string | null;
  meta?: {
    /** The name of the reverse alias field on `related_collection`, when there is one. */
    one_field?: string | null;
    /** On a junction row: the *other* junction column. Its presence is what makes it a junction. */
    junction_field?: string | null;
  } | null;
}

/**
 * Directus `GET /relations` → descriptors.
 *
 * Measured against Directus 11. Three rows describe two relations:
 *
 * ```
 * articles.author        → authors   meta{one_field:"articles", junction_field:null}
 * articles_tags.tag_id   → tags      meta{one_field:null,       junction_field:"article_id"}
 * articles_tags.article_id → articles meta{one_field:"tags",     junction_field:"tag_id"}
 * ```
 *
 * ⚠️ **`one_field` being set does not mean the field exists.** The seed above
 * created the M2O with `meta.one_field: 'articles'` and Directus recorded it —
 * but no `articles` field was added to `authors`, and reading
 * `?fields=*,articles.*` answers **403 "You don't have permission to access
 * field ... or it does not exist"**, the same status a permission failure gives.
 * The reverse O2M is emitted here because `/relations` describes it; whether an
 * include on it succeeds is a fact about the instance, and the 403 is
 * indistinguishable from a permission problem. Recorded rather than papered
 * over.
 */
export function relationsFromDirectus(rows: readonly DirectusRelationRow[] | undefined): RelationDescriptor[] {
  const all = (rows ?? []).filter((row) => row.collection && row.field && row.related_collection);
  const result: RelationDescriptor[] = [];

  for (const row of all) {
    const collection = row.collection as string;
    const field = row.field as string;
    const related = row.related_collection as string;
    const junctionField = row.meta?.junction_field || undefined;
    const oneField = row.meta?.one_field || undefined;

    if (junctionField) {
      // A junction row. It describes the M2M *from the far side of the other
      // junction column*, and only the row carrying `one_field` names the
      // parent's alias field — the other row is the same relation seen from the
      // tags' side, which Directus does not give an alias.
      if (!oneField) continue;

      const partner = all.find((other) => other.collection === collection && other.field === junctionField);
      if (!partner?.related_collection) continue;

      result.push({
        collection: related,
        field: oneField,
        target: partner.related_collection,
        cardinality: 'many',
        write: {
          kind: 'junction',
          collection,
          sourceField: field,
          targetField: junctionField,
          // Directus's own junction template gives the table a surrogate `id`
          // and no unique constraint on the pair, so the same pair can be
          // written twice. The adapter reads before it writes; see
          // `RestDataAdapter.addRelation`.
          idempotent: false
        },
        // ⚠️ The two-hop include. `fields=*,tags.*` returns junction rows.
        readPath: `${oneField}.${junctionField}`,
        readUnwrapKey: junctionField
      });
      continue;
    }

    // A plain foreign key: many-to-one from `collection`, …
    result.push({
      collection,
      field,
      target: related,
      cardinality: 'one',
      write: { kind: 'foreignKey', field, on: 'source' }
    });

    // … and its one-to-many reverse, when Directus named one.
    if (oneField) {
      result.push({
        collection: related,
        field: oneField,
        target: collection,
        cardinality: 'many',
        // The column is on the *child*: relating an article to an author means
        // writing the article's `author`, not the author's anything.
        write: { kind: 'foreignKey', field, on: 'target' }
      });
    }
  }

  return result;
}

// ── PostgREST / Supabase ───────────────────────────────────────────────────

/** The slice of PostgREST's OpenAPI document this module reads. */
export interface PostgrestSpec {
  definitions?: Record<string, { properties?: Record<string, { description?: string }> }>;
}

const PG_FK = /<fk table='([^']+)' column='([^']*)'\/>/;
const PG_PK = '<pk/>';

/**
 * PostgREST's OpenAPI document → descriptors.
 *
 * PostgREST publishes no relation table; the annotations inside each column's
 * `description` are the whole of its relation metadata, and they describe
 * foreign keys only. Everything else is inferred, and each inference is a
 * measurement:
 *
 * - **The reverse one-to-many** is emitted for every FK, because
 *   `select=*,articles(*)` on the parent works (measured, 200 with the child
 *   rows nested).
 * - **A junction is a table whose primary key is exactly two foreign keys.**
 *   ⚠️ This is not a modelling preference — it is the condition under which
 *   PostgREST will answer the M2M embed at all. The identical two tables with a
 *   surrogate `id` primary key answer `PGRST200 … no matches were found`, and
 *   there is no request that recovers the relation. A junction that fails the
 *   test is therefore **not emitted**, because emitting it would produce a port
 *   whose every use is a 400.
 */
export function relationsFromPostgrestSpec(spec: PostgrestSpec | undefined): RelationDescriptor[] {
  const definitions = spec?.definitions ?? {};
  const result: RelationDescriptor[] = [];

  /** `[column, target]` for every FK on a table, and which of them are PK. */
  const analyse = (table: string) => {
    const properties = definitions[table]?.properties ?? {};
    const foreignKeys: Array<{ column: string; target: string; primaryKey: boolean }> = [];
    let primaryKeyCount = 0;
    for (const [column, definition] of Object.entries(properties)) {
      const description = definition?.description ?? '';
      const primaryKey = description.includes(PG_PK);
      if (primaryKey) primaryKeyCount++;
      const fk = PG_FK.exec(description);
      if (fk) foreignKeys.push({ column, target: fk[1], primaryKey });
    }
    return { foreignKeys, primaryKeyCount };
  };

  for (const table of Object.keys(definitions)) {
    const { foreignKeys, primaryKeyCount } = analyse(table);

    const isJunction =
      foreignKeys.length === 2 && primaryKeyCount === 2 && foreignKeys.every((fk) => fk.primaryKey);

    if (isJunction) {
      const [left, right] = foreignKeys;
      for (const [near, far] of [
        [left, right],
        [right, left]
      ] as const) {
        result.push({
          collection: near.target,
          // PostgREST names an embed by the target table, and that is the name a
          // user sees in the query string, so it is the field name here too.
          field: far.target,
          target: far.target,
          cardinality: 'many',
          write: {
            kind: 'junction',
            collection: table,
            sourceField: near.column,
            targetField: far.column,
            // The pair *is* the primary key, so a duplicate is a `23505` and
            // `Prefer: resolution=merge-duplicates` turns the add into an
            // upsert. Both measured.
            idempotent: true
          }
        });
      }
      continue;
    }

    for (const fk of foreignKeys) {
      result.push({
        collection: table,
        field: fk.column,
        target: fk.target,
        cardinality: 'one',
        write: { kind: 'foreignKey', field: fk.column, on: 'source' }
      });
      result.push({
        collection: fk.target,
        field: table,
        target: table,
        cardinality: 'many',
        write: { kind: 'foreignKey', field: fk.column, on: 'target' }
      });
    }
  }

  return result;
}

// ── PocketBase ─────────────────────────────────────────────────────────────

/** One collection of PocketBase's `GET /api/collections`. */
export interface PocketBaseCollection {
  id?: string;
  name?: string;
  /**
   * ⚠️ **`fields` on PocketBase 0.23+, `schema` before it.** Both are read
   * here because the editor's parser reads only `schema` and therefore recovers
   * **no fields at all** from the 0.30.0 in the rig — see `BCN-005-NOTES.md`.
   */
  fields?: readonly PocketBaseField[];
  schema?: readonly PocketBaseField[];
}

export interface PocketBaseField {
  name?: string;
  type?: string;
  /** The **id** of the target collection (`pbc_1390417582`), never its name. */
  collectionId?: string;
  maxSelect?: number;
  options?: { collectionId?: string; maxSelect?: number };
}

/** `fields` or `schema`, whichever this PocketBase version used. */
export function pocketBaseFields(collection: PocketBaseCollection | undefined): readonly PocketBaseField[] {
  return collection?.fields ?? collection?.schema ?? [];
}

/**
 * PocketBase `GET /api/collections` → descriptors.
 *
 * Two measured facts drive this:
 *
 * - **The target is named by collection id.** A relation field carries
 *   `collectionId: 'pbc_1390417582'`; nothing in the field says `bcn005_authors`.
 *   Resolving it needs the whole collection list, which is why this takes the
 *   list rather than one collection.
 * - **`maxSelect` is the cardinality**, and `+`/`-` work either way: on a
 *   `maxSelect: 1` field, `+` *replaces* the current value (200) and `-`
 *   clears it to `""`. So a single-valued relation gets `arrayField` too — the
 *   operators are the wire, whatever the field holds.
 */
export function relationsFromPocketBase(collections: readonly PocketBaseCollection[] | undefined): RelationDescriptor[] {
  const list = collections ?? [];
  const nameById = new Map<string, string>();
  for (const collection of list) {
    if (collection.id && collection.name) nameById.set(collection.id, collection.name);
  }

  const result: RelationDescriptor[] = [];
  for (const collection of list) {
    if (!collection.name) continue;
    for (const field of pocketBaseFields(collection)) {
      if (field.type !== 'relation' || !field.name) continue;
      const targetId = field.collectionId ?? field.options?.collectionId;
      const target = targetId ? nameById.get(targetId) : undefined;
      if (!target) continue;
      const maxSelect = field.maxSelect ?? field.options?.maxSelect;
      result.push({
        collection: collection.name,
        field: field.name,
        target,
        cardinality: maxSelect === 1 ? 'one' : 'many',
        // Measured: appending a value already present leaves the array
        // unchanged, so this is set-shaped in the way `op` is.
        write: { kind: 'arrayField', field: field.name, setSemantics: true }
      });
    }
  }
  return result;
}

// ── Parse family ───────────────────────────────────────────────────────────

/** One class of a Parse-shaped schema response, in either envelope. */
export interface ParseClass {
  className?: string;
  name?: string;
  fields?: Record<string, { type?: string; targetClass?: string }>;
  columns?: ReadonlyArray<{ name?: string; type?: string; targetClass?: string }>;
}

/**
 * Parse / NodeGX `GET /schemas` (or `GET /api/_schema`) → descriptors.
 *
 * The one backend family where the model needed no inference: a `Relation`
 * declares itself, carries its `targetClass`, and is mutated by the two
 * operations the contract method is named after. `Pointer` is an ordinary
 * column and so is a `foreignKey` write — ⚠️ which means
 * `addRelation` on a Pointer field is **not** `__op AddRelation`; Parse
 * answers that with an error, because the op is only defined on `Relation`.
 */
export function relationsFromParseClasses(classes: readonly ParseClass[] | undefined): RelationDescriptor[] {
  const result: RelationDescriptor[] = [];
  for (const cls of classes ?? []) {
    const collection = cls.className || cls.name;
    if (!collection) continue;

    const fields: Record<string, { type?: string; targetClass?: string }> = cls.fields
      ? cls.fields
      : Object.fromEntries((cls.columns ?? []).filter((c) => c.name).map((c) => [c.name as string, c]));

    for (const [field, definition] of Object.entries(fields)) {
      if (!definition?.targetClass) continue;
      if (definition.type === 'Pointer') {
        result.push({
          collection,
          field,
          target: definition.targetClass,
          cardinality: 'one',
          write: { kind: 'foreignKey', field, on: 'source' }
        });
      } else if (definition.type === 'Relation') {
        result.push({
          collection,
          field,
          target: definition.targetClass,
          cardinality: 'many',
          write: { kind: 'op' }
        });
      }
    }
  }
  return result;
}
