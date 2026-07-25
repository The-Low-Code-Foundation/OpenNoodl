/**
 * RUN-003: Unit tests for the BYOB schema parsers.
 *
 * The parsers turn each backend's native schema-introspection response into
 * the normalized CachedSchema stored in backendServices project metadata —
 * the only field shape the byob-* runtime nodes ever see. Fixtures mirror the
 * real response shapes (the Directus one is trimmed from a live Directus 11
 * /fields response; see dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e/).
 */

import {
  parseDirectusSchema,
  parseGenericSchema,
  parsePocketbaseSchema,
  parseSchemaResponse,
  parseSupabaseSchema
} from '../../src/editor/src/models/BackendServices/schemaParsers';

// ─── Directus fixture (trimmed from a live /fields response) ──────────────────

const directusFields = {
  data: [
    {
      collection: 'articles',
      field: 'id',
      type: 'integer',
      schema: { is_nullable: false, is_primary_key: true, has_auto_increment: true },
      meta: { hidden: true, interface: null }
    },
    {
      collection: 'articles',
      field: 'title',
      type: 'string',
      schema: { is_nullable: true },
      meta: { interface: 'input', options: { placeholder: 'Headline' } }
    },
    {
      collection: 'articles',
      field: 'status',
      type: 'string',
      schema: { is_nullable: true, default_value: 'draft' },
      meta: {
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: 'Draft', value: 'draft' },
            { text: 'Published', value: 'published' }
          ]
        }
      }
    },
    {
      collection: 'articles',
      field: 'author',
      type: 'integer',
      schema: { is_nullable: true, foreign_key_table: 'authors', foreign_key_column: 'id' },
      meta: { interface: 'select-dropdown-m2o' }
    },
    {
      collection: 'articles',
      field: 'hero_image',
      type: 'uuid',
      schema: { is_nullable: true, foreign_key_table: 'directus_files', foreign_key_column: 'id' },
      meta: { interface: 'file-image', special: ['file'] }
    },
    {
      collection: 'articles',
      field: 'divider',
      type: 'alias',
      schema: null,
      meta: { interface: 'presentation-divider' }
    },
    {
      collection: 'authors',
      field: 'id',
      type: 'integer',
      schema: { is_nullable: false, is_primary_key: true },
      meta: { hidden: true }
    },
    {
      collection: 'authors',
      field: 'name',
      type: 'string',
      schema: { is_nullable: true },
      meta: { interface: 'input', required: true }
    },
    {
      collection: 'directus_users',
      field: 'email',
      type: 'string',
      schema: { is_nullable: true, is_unique: true },
      meta: { interface: 'input' }
    }
  ]
};

describe('parseDirectusSchema', () => {
  it('groups fields into collections and keeps system tables', () => {
    const schema = parseDirectusSchema(directusFields);
    const names = schema.collections.map((c) => c.name);
    expect(names).toEqual(['articles', 'authors', 'directus_users']);
  });

  it('resolves the primary key per collection', () => {
    const schema = parseDirectusSchema(directusFields);
    const articles = schema.collections.find((c) => c.name === 'articles');
    expect(articles?.primaryKey).toBe('id');
    expect(articles?.fields.find((f) => f.name === 'id')?.primaryKey).toBe(true);
  });

  it('parses enum choices into enumValues', () => {
    const schema = parseDirectusSchema(directusFields);
    const status = schema.collections
      .find((c) => c.name === 'articles')
      ?.fields.find((f) => f.name === 'status');
    expect(status?.enumValues).toEqual(['draft', 'published']);
    expect(status?.defaultValue).toBe('draft');
  });

  it('parses M2O relations from foreign_key_table (the RUN-003 gap)', () => {
    const schema = parseDirectusSchema(directusFields);
    const author = schema.collections
      .find((c) => c.name === 'articles')
      ?.fields.find((f) => f.name === 'author');
    expect(author?.relationTarget).toBe('authors');
    expect(author?.relationType).toBe('many-to-one');
  });

  it('parses file fields as relations to directus_files', () => {
    const schema = parseDirectusSchema(directusFields);
    const hero = schema.collections
      .find((c) => c.name === 'articles')
      ?.fields.find((f) => f.name === 'hero_image');
    expect(hero?.relationTarget).toBe('directus_files');
    expect(hero?.relationType).toBe('many-to-one');
  });

  it('leaves relationTarget unset for plain fields', () => {
    const schema = parseDirectusSchema(directusFields);
    const title = schema.collections
      .find((c) => c.name === 'articles')
      ?.fields.find((f) => f.name === 'title');
    expect(title?.relationTarget).toBeUndefined();
    expect(title?.relationType).toBeUndefined();
  });

  it('marks meta.hidden and presentation-* fields as hidden (nodes skip them when building ports)', () => {
    const schema = parseDirectusSchema(directusFields);
    const articles = schema.collections.find((c) => c.name === 'articles');
    expect(articles?.fields.find((f) => f.name === 'id')?.hidden).toBe(true);
    expect(articles?.fields.find((f) => f.name === 'divider')?.hidden).toBe(true);
    expect(articles?.fields.find((f) => f.name === 'title')?.hidden).toBeUndefined();
  });

  it('marks required and unique from the column schema', () => {
    const schema = parseDirectusSchema(directusFields);
    const id = schema.collections.find((c) => c.name === 'articles')?.fields.find((f) => f.name === 'id');
    expect(id?.required).toBe(true);
    const email = schema.collections.find((c) => c.name === 'directus_users')?.fields.find((f) => f.name === 'email');
    expect(email?.unique).toBe(true);
  });

  it('tolerates a null column schema (presentation fields)', () => {
    // The divider entry has schema: null — must not throw
    expect(() => parseDirectusSchema(directusFields)).not.toThrow();
  });

  it('returns an empty schema for garbage input', () => {
    expect(parseDirectusSchema(null).collections).toEqual([]);
    expect(parseDirectusSchema({}).collections).toEqual([]);
    expect(parseDirectusSchema({ data: 'nope' }).collections).toEqual([]);
  });
});

// ─── Supabase (OpenAPI at /rest/v1/) ─────────────────────────────────────────

describe('parseSupabaseSchema', () => {
  // Mirrors the OpenAPI document a live PostgREST serves (Supabase /rest/v1/
  // root) — annotations verified against a real instance, see
  // dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e/SUPABASE-CONTACT-OUTPUT.txt
  const openApi = {
    definitions: {
      products: {
        required: ['sku', 'name'],
        properties: {
          sku: { type: 'integer', format: 'bigint', description: 'Note:\nThis is a Primary Key.<pk/>' },
          name: { type: 'string', format: 'text' },
          in_stock: { type: 'boolean', format: 'boolean' },
          status: {
            type: 'string',
            format: 'public.product_status',
            enum: ['draft', 'live'],
            default: 'draft'
          },
          vendor_id: {
            type: 'integer',
            format: 'integer',
            description: "Note:\nThis is a Foreign Key to `vendors.id`.<fk table='vendors' column='id'/>"
          }
        }
      },
      orders: { properties: { id: { type: 'integer' } } }
    }
  };

  it('creates a collection per OpenAPI definition with typed fields', () => {
    const schema = parseSupabaseSchema(openApi);
    expect(schema.collections.map((c) => c.name)).toEqual(['products', 'orders']);
    const products = schema.collections.find((c) => c.name === 'products');
    expect(products?.fields.find((f) => f.name === 'in_stock')?.type).toBe('boolean');
    expect(products?.fields.find((f) => f.name === 'sku')?.nativeType).toBe('bigint');
  });

  it('detects the primary key from the <pk/> annotation', () => {
    const schema = parseSupabaseSchema(openApi);
    const products = schema.collections.find((c) => c.name === 'products');
    expect(products?.primaryKey).toBe('sku');
    expect(products?.fields.find((f) => f.name === 'sku')?.primaryKey).toBe(true);
    // No annotation → default fallback
    expect(schema.collections.find((c) => c.name === 'orders')?.primaryKey).toBe('id');
  });

  it('parses postgres ENUM columns into enumValues with their default', () => {
    const schema = parseSupabaseSchema(openApi);
    const status = schema.collections.find((c) => c.name === 'products')?.fields.find((f) => f.name === 'status');
    expect(status?.enumValues).toEqual(['draft', 'live']);
    expect(status?.defaultValue).toBe('draft');
  });

  it('parses M2O relations from the <fk .../> annotation', () => {
    const schema = parseSupabaseSchema(openApi);
    const vendor = schema.collections.find((c) => c.name === 'products')?.fields.find((f) => f.name === 'vendor_id');
    expect(vendor?.relationTarget).toBe('vendors');
    expect(vendor?.relationType).toBe('many-to-one');
  });

  it('marks required columns from the definition-level required array', () => {
    const schema = parseSupabaseSchema(openApi);
    const products = schema.collections.find((c) => c.name === 'products');
    expect(products?.fields.find((f) => f.name === 'name')?.required).toBe(true);
    expect(products?.fields.find((f) => f.name === 'in_stock')?.required).toBe(false);
  });

  it('returns an empty schema when definitions are missing', () => {
    expect(parseSupabaseSchema({}).collections).toEqual([]);
    expect(parseSupabaseSchema(null).collections).toEqual([]);
  });
});

// ─── Pocketbase (/api/collections) ───────────────────────────────────────────

describe('parsePocketbaseSchema', () => {
  const pocketbase = {
    items: [
      {
        name: 'posts',
        schema: [
          { name: 'title', type: 'text', required: true },
          { name: 'category', type: 'select', options: { values: ['news', 'blog'] } }
        ]
      },
      { name: '_system_thing', system: true, schema: [] }
    ]
  };

  it('parses collections, required flags and select values; skips system collections', () => {
    const schema = parsePocketbaseSchema(pocketbase);
    expect(schema.collections.map((c) => c.name)).toEqual(['posts']);
    const posts = schema.collections[0];
    expect(posts.fields.find((f) => f.name === 'title')?.required).toBe(true);
    expect(posts.fields.find((f) => f.name === 'category')?.enumValues).toEqual(['news', 'blog']);
  });

  it('accepts a bare array as well as {items}', () => {
    const schema = parsePocketbaseSchema([{ name: 'a', schema: [] }]);
    expect(schema.collections.map((c) => c.name)).toEqual(['a']);
  });
});

// ─── Generic / dispatch ──────────────────────────────────────────────────────

describe('parseGenericSchema + parseSchemaResponse', () => {
  it('parses {collections:[...]} and {tables:[...]} and bare arrays', () => {
    const viaCollections = parseGenericSchema({ collections: [{ name: 'x', fields: [{ name: 'f' }] }] });
    expect(viaCollections.collections[0].fields[0].name).toBe('f');
    const viaTables = parseGenericSchema({ tables: [{ name: 'y' }] });
    expect(viaTables.collections[0].name).toBe('y');
    const viaArray = parseGenericSchema([{ name: 'z' }]);
    expect(viaArray.collections[0].name).toBe('z');
  });

  it('dispatches by backend type and falls back to generic', () => {
    expect(parseSchemaResponse('directus', directusFields).collections.length).toBe(3);
    expect(parseSchemaResponse('custom', [{ name: 'c' }]).collections[0].name).toBe('c');
    expect(parseSchemaResponse('anything-else', { tables: [{ name: 't' }] }).collections[0].name).toBe('t');
  });
});
