/**
 * BCN-005 — the relation model, against the shapes three real servers returned.
 *
 * Every fixture below is **copied out of the probe output**
 * (`uba-e2e/BCN-005-RELATION-PROBE-OUTPUT.txt`), not written from documentation.
 * That is the whole reason this suite is worth having: the parsers' job is to
 * turn three products' idea of a relation into one, and a fixture invented
 * alongside the parser tests only that the author was consistent with himself.
 *
 * The four claims each case is here to pin, all of which would otherwise fail
 * *silently*:
 *
 * 1. A Directus M2M yields a **junction** write and a **two-hop** read path.
 *    One hop returns junction rows with a 200.
 * 2. A PostgREST junction is only a junction when the pair is the primary key.
 *    Otherwise PostgREST cannot see the relation at all, so emitting a
 *    descriptor would create a port whose every use is a 400.
 * 3. A PocketBase relation names its target by **collection id**, so a parser
 *    that reads the field alone gets `undefined`.
 * 4. A Parse `Relation` is an `op` write and a `Pointer` is not — the ops are
 *    only defined on `Relation`.
 */

import {
  findRelation,
  pocketBaseFields,
  relationsFromDirectus,
  relationsFromParseClasses,
  relationsFromPocketBase,
  relationsFromPostgrestSpec,
  type DirectusRelationRow,
  type PocketBaseCollection,
  type PostgrestSpec
} from '../src/relations';
import { relationTarget } from '../src/data';
import { bindPocketBaseFilter, toPocketBaseFilter } from '../src/translators/pocketbase';
import { toDirectusFilter } from '../src/translators/directus';
import { toPostgrest } from '../src/translators/postgrest';

// ── Directus ───────────────────────────────────────────────────────────────

/** Verbatim from `GET /relations` on the rig's Directus 11. */
const DIRECTUS_ROWS: DirectusRelationRow[] = [
  {
    collection: 'bcn005_articles',
    field: 'author',
    related_collection: 'bcn005_authors',
    meta: { one_field: 'articles', junction_field: null }
  },
  {
    collection: 'bcn005_articles_tags',
    field: 'tag_id',
    related_collection: 'bcn005_tags',
    meta: { one_field: null, junction_field: 'article_id' }
  },
  {
    collection: 'bcn005_articles_tags',
    field: 'article_id',
    related_collection: 'bcn005_articles',
    meta: { one_field: 'tags', junction_field: 'tag_id' }
  }
];

describe('relationsFromDirectus', () => {
  const relations = relationsFromDirectus(DIRECTUS_ROWS);

  it('reads the many-to-one as a foreign key on the source', () => {
    const author = findRelation(relations, 'bcn005_articles', 'author');
    expect(author).toMatchObject({
      target: 'bcn005_authors',
      cardinality: 'one',
      write: { kind: 'foreignKey', field: 'author', on: 'source' }
    });
  });

  it('reads the one-to-many reverse, and puts the column on the TARGET', () => {
    // The whole difference between the two directions. `on: 'source'` here would
    // write an author id into the authors table and answer 200.
    const articles = findRelation(relations, 'bcn005_authors', 'articles');
    expect(articles).toMatchObject({
      target: 'bcn005_articles',
      cardinality: 'many',
      write: { kind: 'foreignKey', field: 'author', on: 'target' }
    });
  });

  it('⚠️ reads the many-to-many with a TWO-hop read path', () => {
    // `fields=*,tags.*` returns [{id, article_id, tag_id}] with a 200 — the
    // junction rows, not the tags. Measured.
    const tags = findRelation(relations, 'bcn005_articles', 'tags');
    expect(tags).toMatchObject({
      target: 'bcn005_tags',
      cardinality: 'many',
      readPath: 'tags.tag_id',
      readUnwrapKey: 'tag_id',
      write: {
        kind: 'junction',
        collection: 'bcn005_articles_tags',
        sourceField: 'article_id',
        targetField: 'tag_id',
        idempotent: false
      }
    });
  });

  it('does not invent a relation on the far side of a junction Directus gave no alias', () => {
    // The `tag_id` row carries no `one_field`, so there is no field on `tags` to
    // name. Emitting one would produce a port that cannot be included.
    expect(relations.filter((relation) => relation.collection === 'bcn005_tags')).toEqual([]);
  });

  it('says a Directus junction is not idempotent, because it is not', () => {
    // Directus's junction has a surrogate `id` and no unique constraint on the
    // pair; posting the same pair twice stored it twice. Measured.
    const tags = findRelation(relations, 'bcn005_articles', 'tags');
    expect(tags?.write).toMatchObject({ idempotent: false });
  });

  it('ignores rows with no related collection rather than emitting a half relation', () => {
    expect(relationsFromDirectus([{ collection: 'a', field: 'b', related_collection: null }])).toEqual([]);
    expect(relationsFromDirectus(undefined)).toEqual([]);
  });
});

// ── PostgREST ──────────────────────────────────────────────────────────────

/** The description strings are verbatim PostgREST 12.2.3 annotations. */
function pgSpec(junctionPrimaryKey: boolean): PostgrestSpec {
  const pk = 'Note:\nThis is a Primary Key.<pk/>';
  const fk = (table: string) => `This is a Foreign Key to \`${table}.id\`.<fk table='${table}' column='id'/>`;
  return {
    definitions: {
      bcn005_authors: { properties: { id: { description: pk } } },
      bcn005_tags: { properties: { id: { description: pk } } },
      bcn005_articles: {
        properties: {
          id: { description: pk },
          author_id: { description: `Note:\n${fk('bcn005_authors')}` }
        }
      },
      bcn005_articles_tags: junctionPrimaryKey
        ? {
            properties: {
              article_id: { description: `${pk}\n${fk('bcn005_articles')}` },
              tag_id: { description: `${pk}\n${fk('bcn005_tags')}` }
            }
          }
        : {
            properties: {
              id: { description: pk },
              article_id: { description: `Note:\n${fk('bcn005_articles')}` },
              tag_id: { description: `Note:\n${fk('bcn005_tags')}` }
            }
          }
    }
  };
}

describe('relationsFromPostgrestSpec', () => {
  it('reads a foreign key both ways round', () => {
    const relations = relationsFromPostgrestSpec(pgSpec(true));
    expect(findRelation(relations, 'bcn005_articles', 'author_id')).toMatchObject({
      target: 'bcn005_authors',
      cardinality: 'one',
      write: { kind: 'foreignKey', field: 'author_id', on: 'source' }
    });
    expect(findRelation(relations, 'bcn005_authors', 'bcn005_articles')).toMatchObject({
      cardinality: 'many',
      write: { kind: 'foreignKey', field: 'author_id', on: 'target' }
    });
  });

  it('⚠️ sees a junction only when the PAIR is the primary key', () => {
    // The measurement: with `PRIMARY KEY (article_id, tag_id)` the M2M embed
    // answers 200; with a surrogate `id` primary key the identical two tables
    // answer PGRST200 "no matches were found" and no request recovers it.
    const withPk = relationsFromPostgrestSpec(pgSpec(true));
    expect(findRelation(withPk, 'bcn005_articles', 'bcn005_tags')).toMatchObject({
      cardinality: 'many',
      write: { kind: 'junction', collection: 'bcn005_articles_tags', sourceField: 'article_id', targetField: 'tag_id' }
    });
    expect(findRelation(withPk, 'bcn005_tags', 'bcn005_articles')).toBeDefined();

    const withoutPk = relationsFromPostgrestSpec(pgSpec(false));
    expect(findRelation(withoutPk, 'bcn005_articles', 'bcn005_tags')).toBeUndefined();
  });

  it('reports the junction as idempotent, because the pair being the key is what makes it so', () => {
    const relations = relationsFromPostgrestSpec(pgSpec(true));
    expect(findRelation(relations, 'bcn005_articles', 'bcn005_tags')?.write).toMatchObject({ idempotent: true });
  });

  it('falls back to two foreign keys when the junction is not one PostgREST can see', () => {
    // The surrogate-key table is still two ordinary many-to-ones, and those work.
    const relations = relationsFromPostgrestSpec(pgSpec(false));
    expect(findRelation(relations, 'bcn005_articles_tags', 'tag_id')).toMatchObject({
      target: 'bcn005_tags',
      cardinality: 'one'
    });
  });

  it('survives a spec with no definitions', () => {
    expect(relationsFromPostgrestSpec(undefined)).toEqual([]);
    expect(relationsFromPostgrestSpec({})).toEqual([]);
  });
});

// ── PocketBase ─────────────────────────────────────────────────────────────

/** Verbatim from `GET /api/collections` on the rig's PocketBase 0.30.0. */
const PB: PocketBaseCollection[] = [
  { id: 'pbc_1390417582', name: 'bcn005_authors', fields: [{ name: 'city', type: 'text' }] },
  { id: 'pbc_2954701621', name: 'bcn005_tags', fields: [{ name: 'label', type: 'text' }] },
  {
    id: 'pbc_2449683161',
    name: 'bcn005_articles',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'author', type: 'relation', collectionId: 'pbc_1390417582', maxSelect: 1 },
      { name: 'tags', type: 'relation', collectionId: 'pbc_2954701621', maxSelect: 99 }
    ]
  }
];

describe('relationsFromPocketBase', () => {
  const relations = relationsFromPocketBase(PB);

  it('⚠️ resolves the target from the collection ID, which is all the field carries', () => {
    expect(findRelation(relations, 'bcn005_articles', 'author')).toMatchObject({
      target: 'bcn005_authors',
      cardinality: 'one'
    });
    expect(findRelation(relations, 'bcn005_articles', 'tags')).toMatchObject({
      target: 'bcn005_tags',
      cardinality: 'many'
    });
  });

  it('uses the array-field operators for both cardinalities', () => {
    // Measured: `+` and `-` work on a maxSelect: 1 relation too — `+` replaces
    // and `-` clears.
    for (const field of ['author', 'tags']) {
      expect(findRelation(relations, 'bcn005_articles', field)?.write).toEqual({
        kind: 'arrayField',
        field,
        setSemantics: true
      });
    }
  });

  it('⚠️ reads `fields` and `schema`, because 0.23 renamed one to the other', () => {
    // The editor's parser reads `schema` only, so it recovers nothing at all
    // from the 0.30.0 in the rig. Recorded in BCN-005-NOTES.md.
    expect(pocketBaseFields({ fields: [{ name: 'a' }] })).toEqual([{ name: 'a' }]);
    expect(pocketBaseFields({ schema: [{ name: 'b' }] })).toEqual([{ name: 'b' }]);
    expect(pocketBaseFields(undefined)).toEqual([]);

    const legacy = relationsFromPocketBase([
      { id: 'x', name: 'authors' },
      { id: 'y', name: 'articles', schema: [{ name: 'author', type: 'relation', options: { collectionId: 'x', maxSelect: 1 } }] }
    ]);
    expect(findRelation(legacy, 'articles', 'author')).toMatchObject({ target: 'authors', cardinality: 'one' });
  });

  it('drops a relation whose target is not in the list, rather than naming a collection that is not there', () => {
    const orphan = relationsFromPocketBase([
      { id: 'y', name: 'articles', fields: [{ name: 'author', type: 'relation', collectionId: 'gone', maxSelect: 1 }] }
    ]);
    expect(orphan).toEqual([]);
  });
});

// ── Parse family ───────────────────────────────────────────────────────────

describe('relationsFromParseClasses', () => {
  it('makes a Relation an op write and a Pointer a foreign key', () => {
    // ⚠️ Not cosmetic: `__op AddRelation` is only defined on a `Relation`, so
    // treating a Pointer as one produces an error from Parse.
    const relations = relationsFromParseClasses([
      {
        className: 'Article',
        fields: {
          title: { type: 'String' },
          author: { type: 'Pointer', targetClass: 'Author' },
          tags: { type: 'Relation', targetClass: 'Tag' }
        }
      }
    ]);
    expect(findRelation(relations, 'Article', 'author')).toMatchObject({
      cardinality: 'one',
      write: { kind: 'foreignKey', field: 'author', on: 'source' }
    });
    expect(findRelation(relations, 'Article', 'tags')).toMatchObject({
      cardinality: 'many',
      write: { kind: 'op' }
    });
  });

  it('reads our own backend\'s `{tables:[{name, columns}]}` envelope too', () => {
    const relations = relationsFromParseClasses([
      { name: 'Article', columns: [{ name: 'tags', type: 'Relation', targetClass: 'Tag' }] }
    ]);
    expect(findRelation(relations, 'Article', 'tags')).toMatchObject({ target: 'Tag', write: { kind: 'op' } });
  });
});

// ── The rename ─────────────────────────────────────────────────────────────

describe('relationTarget', () => {
  it('prefers the neutral name and still accepts the Parse-family one', () => {
    expect(relationTarget({ targetCollection: 'Tags' })).toBe('Tags');
    expect(relationTarget({ targetClass: 'Tags' })).toBe('Tags');
    expect(relationTarget({ targetCollection: 'New', targetClass: 'Old' })).toBe('New');
    expect(relationTarget({})).toBeUndefined();
    // An empty string is not a collection name, and passing it on would build a
    // request against `/items/`.
    expect(relationTarget({ targetCollection: '', targetClass: 'Old' })).toBe('Old');
  });
});

// ── Filtering across a relation, per dialect ───────────────────────────────

describe('a dotted path across a relation', () => {
  /** `tags` holds several records; `author` holds one. */
  const schema = {
    collection: 'articles',
    properties: {
      tags: { type: 'relation', targetClass: 'tags', cardinality: 'many' as const },
      author: { type: 'relation', targetClass: 'authors', cardinality: 'one' as const }
    }
  };

  it('⚠️ PocketBase needs the "any of" form, or a live server returns NO rows', () => {
    // Measured on 0.30.0, on a record with two tags one of which was `algebra`:
    //   tags.label='algebra'   -> []
    //   tags.label?='algebra'  -> the row
    const many = toPocketBaseFilter({ 'tags.label': { equalTo: 'algebra' } }, { backend: 'pocketbase', schema });
    expect(bindPocketBaseFilter(many)).toBe('tags.label ?= "algebra"');

    const one = toPocketBaseFilter({ 'author.city': { equalTo: 'London' } }, { backend: 'pocketbase', schema });
    expect(bindPocketBaseFilter(one)).toBe('author.city = "London"');
  });

  it('quantifies every operator, not just equality', () => {
    const bound = (filter: Parameters<typeof toPocketBaseFilter>[0]) =>
      bindPocketBaseFilter(toPocketBaseFilter(filter, { backend: 'pocketbase', schema }));

    expect(bound({ 'tags.label': { contains: 'alge' } })).toBe('tags.label ?~ "%alge%"');
    expect(bound({ 'tags.label': { exists: true } })).toBe('tags.label ?!= null');
    expect(bound({ 'tags.rank': { between: [1, 3] } })).toBe('(tags.rank ?>= 1 && tags.rank ?<= 3)');
    expect(bound({ 'tags.label': { containedIn: ['a', 'b'] } })).toBe('(tags.label ?= "a" || tags.label ?= "b")');
  });

  it('leaves a plain field alone, and a relation with no recorded cardinality alone', () => {
    const bound = (filter: Parameters<typeof toPocketBaseFilter>[0], s?: typeof schema) =>
      bindPocketBaseFilter(toPocketBaseFilter(filter, { backend: 'pocketbase', schema: s }));
    expect(bound({ title: { equalTo: 'x' } }, schema)).toBe('title = "x"');
    // No schema at all: exactly what it did before `cardinality` existed.
    expect(bound({ 'tags.label': { equalTo: 'x' } })).toBe('tags.label = "x"');
  });

  it('⚠️ Directus needs the path NESTED — a flat dotted key is a live 403', () => {
    // RUN-003's defect, still reproducible: `filter={"author.city":{"_eq":…}}`
    // answers 403 "You don't have permission to access field "author.city"",
    // which is indistinguishable from a real permission failure.
    expect(toDirectusFilter({ 'author.city': { equalTo: 'London' } }, { backend: 'directus', schema })).toEqual({
      author: { city: { _eq: 'London' } }
    });
  });

  it('PostgREST reports the embed a dotted filter needs, because without !inner the parent is not narrowed', () => {
    // Measured: with a plain embed both parents come back and the embedded
    // object is `null` on the one that does not match — a filter that does not
    // filter. With `!inner` only the matching parent comes back.
    const filter = toPostgrest({ 'authors.city': { equalTo: 'London' } }, { backend: 'supabase', schema });
    expect(filter.params).toEqual([['authors.city', 'eq.London']]);
    expect(filter.embeds).toEqual(['authors']);
  });
});
