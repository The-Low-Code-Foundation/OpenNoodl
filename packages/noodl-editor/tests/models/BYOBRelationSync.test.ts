/**
 * BCN-005 schema sync — the editor's half of relations, against **live payloads**.
 *
 * ## Why every fixture in this file is verbatim
 *
 * `parsePocketbaseSchema` read `collection.schema` for two releases after PocketBase
 * renamed it to `fields`, so every collection introspected with zero fields, silently.
 * The reason it survived is in `BYOBSchemaParsers.test.ts`: the fixture there only ever
 * carried the old shape, so **the parser and its test agreed with each other and with
 * nothing else**.
 *
 * So none of the payloads below were written by hand. Each is a trimmed-but-unedited
 * slice of what the uba-e2e rig's servers answered on 2026-08-01 — Directus 11 (`GET
 * /fields`, `GET /relations`), PostgREST 12.2.3 (`GET /`), PocketBase 0.30.0 (`GET
 * /api/collections`) and Parse Server 7.3.0 (`GET /parse/schemas`). Rows for other
 * workers' fixtures are dropped; no key inside a kept row is edited, added or reordered.
 * Capture script and raw output: `BCN-005-NOTES-SCHEMASYNC.md`.
 *
 * The four things this found that the hand-written fixtures could not are asserted here
 * by name, each in a spec whose title says what a live server said.
 */

import {
  applyRelationsToSchema,
  parseDirectusSchema,
  parsePocketbaseSchema,
  parseRelationsResponse,
  parseSchemaResponse,
  parseSupabaseSchema,
  relationEndpointFor,
  schemaRequestPath
} from '../../src/editor/src/models/BackendServices/schemaParsers';
import type { CachedSchema, SchemaCollection } from '../../src/editor/src/models/BackendServices/types';

const DIRECTUS_FIELDS = {
  "data": [
    {
      "collection": "bcn005_authors",
      "field": "id",
      "type": "integer",
      "schema": {
        "name": "id",
        "table": "bcn005_authors",
        "data_type": "integer",
        "default_value": null,
        "max_length": null,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": false,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": true,
        "has_auto_increment": true,
        "foreign_key_column": null,
        "foreign_key_table": null
      },
      "meta": null
    },
    {
      "collection": "bcn005_authors",
      "field": "name",
      "type": "string",
      "schema": {
        "name": "name",
        "table": "bcn005_authors",
        "data_type": "varchar",
        "default_value": null,
        "max_length": 255,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": true,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": false,
        "has_auto_increment": false,
        "foreign_key_column": null,
        "foreign_key_table": null
      },
      "meta": null
    },
    {
      "collection": "bcn005_authors",
      "field": "city",
      "type": "string",
      "schema": {
        "name": "city",
        "table": "bcn005_authors",
        "data_type": "varchar",
        "default_value": null,
        "max_length": 255,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": true,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": false,
        "has_auto_increment": false,
        "foreign_key_column": null,
        "foreign_key_table": null
      },
      "meta": null
    },
    {
      "collection": "bcn005_tags",
      "field": "id",
      "type": "integer",
      "schema": {
        "name": "id",
        "table": "bcn005_tags",
        "data_type": "integer",
        "default_value": null,
        "max_length": null,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": false,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": true,
        "has_auto_increment": true,
        "foreign_key_column": null,
        "foreign_key_table": null
      },
      "meta": null
    },
    {
      "collection": "bcn005_tags",
      "field": "label",
      "type": "string",
      "schema": {
        "name": "label",
        "table": "bcn005_tags",
        "data_type": "varchar",
        "default_value": null,
        "max_length": 255,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": true,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": false,
        "has_auto_increment": false,
        "foreign_key_column": null,
        "foreign_key_table": null
      },
      "meta": null
    },
    {
      "collection": "bcn005_articles",
      "field": "id",
      "type": "integer",
      "schema": {
        "name": "id",
        "table": "bcn005_articles",
        "data_type": "integer",
        "default_value": null,
        "max_length": null,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": false,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": true,
        "has_auto_increment": true,
        "foreign_key_column": null,
        "foreign_key_table": null
      },
      "meta": null
    },
    {
      "collection": "bcn005_articles",
      "field": "title",
      "type": "string",
      "schema": {
        "name": "title",
        "table": "bcn005_articles",
        "data_type": "varchar",
        "default_value": null,
        "max_length": 255,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": true,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": false,
        "has_auto_increment": false,
        "foreign_key_column": null,
        "foreign_key_table": null
      },
      "meta": null
    },
    {
      "collection": "bcn005_articles",
      "field": "author",
      "type": "integer",
      "schema": {
        "name": "author",
        "table": "bcn005_articles",
        "data_type": "integer",
        "default_value": null,
        "max_length": null,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": true,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": false,
        "has_auto_increment": false,
        "foreign_key_column": "id",
        "foreign_key_table": "bcn005_authors"
      },
      "meta": null
    },
    {
      "collection": "bcn005_articles_tags",
      "field": "id",
      "type": "integer",
      "schema": {
        "name": "id",
        "table": "bcn005_articles_tags",
        "data_type": "integer",
        "default_value": null,
        "max_length": null,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": false,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": true,
        "has_auto_increment": true,
        "foreign_key_column": null,
        "foreign_key_table": null
      },
      "meta": null
    },
    {
      "collection": "bcn005_articles_tags",
      "field": "article_id",
      "type": "integer",
      "schema": {
        "name": "article_id",
        "table": "bcn005_articles_tags",
        "data_type": "integer",
        "default_value": null,
        "max_length": null,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": true,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": false,
        "has_auto_increment": false,
        "foreign_key_column": "id",
        "foreign_key_table": "bcn005_articles"
      },
      "meta": null
    },
    {
      "collection": "bcn005_articles_tags",
      "field": "tag_id",
      "type": "integer",
      "schema": {
        "name": "tag_id",
        "table": "bcn005_articles_tags",
        "data_type": "integer",
        "default_value": null,
        "max_length": null,
        "numeric_precision": null,
        "numeric_scale": null,
        "is_generated": false,
        "generation_expression": null,
        "is_nullable": true,
        "is_unique": false,
        "is_indexed": false,
        "is_primary_key": false,
        "has_auto_increment": false,
        "foreign_key_column": "id",
        "foreign_key_table": "bcn005_tags"
      },
      "meta": null
    },
    {
      "collection": "bcn005_articles",
      "field": "tags",
      "type": "alias",
      "schema": null,
      "meta": {
        "id": 21,
        "collection": "bcn005_articles",
        "field": "tags",
        "special": [
          "m2m"
        ],
        "interface": "list-m2m",
        "options": null,
        "display": null,
        "display_options": null,
        "readonly": false,
        "hidden": false,
        "sort": 1,
        "width": "full",
        "translations": null,
        "note": null,
        "conditions": null,
        "required": false,
        "group": null,
        "validation": null,
        "validation_message": null,
        "searchable": true
      }
    }
  ]
};

const DIRECTUS_RELATIONS = {
  "data": [
    {
      "collection": "bcn005_articles",
      "field": "author",
      "related_collection": "bcn005_authors",
      "meta": {
        "one_field": "articles",
        "junction_field": null
      }
    },
    {
      "collection": "bcn005_articles_tags",
      "field": "tag_id",
      "related_collection": "bcn005_tags",
      "meta": {
        "one_field": null,
        "junction_field": "article_id"
      }
    },
    {
      "collection": "bcn005_articles_tags",
      "field": "article_id",
      "related_collection": "bcn005_articles",
      "meta": {
        "one_field": "tags",
        "junction_field": "tag_id"
      }
    }
  ]
};

const POSTGREST_SPEC = {
  "definitions": {
    "bcn005_articles": {
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "description": "Note:\nThis is a Primary Key.<pk/>",
          "format": "integer",
          "type": "integer"
        },
        "title": {
          "format": "text",
          "type": "string"
        },
        "author_id": {
          "description": "Note:\nThis is a Foreign Key to `bcn005_authors.id`.<fk table='bcn005_authors' column='id'/>",
          "format": "integer",
          "type": "integer"
        }
      },
      "type": "object"
    },
    "bcn005_articles_tags": {
      "required": [
        "article_id",
        "tag_id"
      ],
      "properties": {
        "article_id": {
          "description": "Note:\nThis is a Primary Key.<pk/>\nThis is a Foreign Key to `bcn005_articles.id`.<fk table='bcn005_articles' column='id'/>",
          "format": "integer",
          "type": "integer"
        },
        "tag_id": {
          "description": "Note:\nThis is a Primary Key.<pk/>\nThis is a Foreign Key to `bcn005_tags.id`.<fk table='bcn005_tags' column='id'/>",
          "format": "integer",
          "type": "integer"
        }
      },
      "type": "object"
    },
    "bcn005_authors": {
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "description": "Note:\nThis is a Primary Key.<pk/>",
          "format": "integer",
          "type": "integer"
        },
        "name": {
          "format": "text",
          "type": "string"
        },
        "city": {
          "format": "text",
          "type": "string"
        }
      },
      "type": "object"
    },
    "bcn005_tags": {
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "description": "Note:\nThis is a Primary Key.<pk/>",
          "format": "integer",
          "type": "integer"
        },
        "label": {
          "format": "text",
          "type": "string"
        }
      },
      "type": "object"
    }
  }
};

const POCKETBASE_COLLECTIONS = {
  "items": [
    {
      "id": "_pb_users_auth_",
      "name": "users",
      "type": "auth",
      "system": false,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "cost": 0,
          "hidden": true,
          "id": "password901924565",
          "max": 0,
          "min": 8,
          "name": "password",
          "pattern": "",
          "presentable": false,
          "required": true,
          "system": true,
          "type": "password"
        },
        {
          "autogeneratePattern": "[a-zA-Z0-9]{50}",
          "hidden": true,
          "id": "text2504183744",
          "max": 60,
          "min": 30,
          "name": "tokenKey",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "exceptDomains": null,
          "hidden": false,
          "id": "email3885137012",
          "name": "email",
          "onlyDomains": null,
          "presentable": false,
          "required": true,
          "system": true,
          "type": "email"
        },
        {
          "hidden": false,
          "id": "bool1547992806",
          "name": "emailVisibility",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool256245529",
          "name": "verified",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 255,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "file376926767",
          "maxSelect": 1,
          "maxSize": 0,
          "mimeTypes": [
            "image/jpeg",
            "image/png",
            "image/svg+xml",
            "image/gif",
            "image/webp"
          ],
          "name": "avatar",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": null,
          "type": "file"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_1390417582",
      "name": "bcn005_authors",
      "type": "base",
      "system": false,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text760939060",
          "max": 0,
          "min": 0,
          "name": "city",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        }
      ]
    },
    {
      "id": "pbc_2954701621",
      "name": "bcn005_tags",
      "type": "base",
      "system": false,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text245846248",
          "max": 0,
          "min": 0,
          "name": "label",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        }
      ]
    },
    {
      "id": "pbc_2449683161",
      "name": "bcn005_articles",
      "type": "base",
      "system": false,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text724990059",
          "max": 0,
          "min": 0,
          "name": "title",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_1390417582",
          "hidden": false,
          "id": "relation3182418120",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "author",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_2954701621",
          "hidden": false,
          "id": "relation1874629670",
          "maxSelect": 99,
          "minSelect": 0,
          "name": "tags",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        }
      ]
    }
  ]
};

const PARSE_SCHEMAS = {
  "results": [
    {
      "className": "Bcn005Tag",
      "fields": {
        "objectId": {
          "type": "String"
        },
        "createdAt": {
          "type": "Date"
        },
        "updatedAt": {
          "type": "Date"
        },
        "ACL": {
          "type": "ACL"
        },
        "label": {
          "type": "String"
        }
      },
      "classLevelPermissions": {
        "find": {
          "*": true
        },
        "count": {
          "*": true
        },
        "get": {
          "*": true
        },
        "create": {
          "*": true
        },
        "update": {
          "*": true
        },
        "delete": {
          "*": true
        },
        "addField": {
          "*": true
        },
        "protectedFields": {
          "*": []
        }
      }
    },
    {
      "className": "Bcn005Article",
      "fields": {
        "objectId": {
          "type": "String"
        },
        "createdAt": {
          "type": "Date"
        },
        "updatedAt": {
          "type": "Date"
        },
        "ACL": {
          "type": "ACL"
        },
        "title": {
          "type": "String"
        },
        "tags": {
          "type": "Relation",
          "targetClass": "Bcn005Tag"
        }
      },
      "classLevelPermissions": {
        "find": {
          "*": true
        },
        "count": {
          "*": true
        },
        "get": {
          "*": true
        },
        "create": {
          "*": true
        },
        "update": {
          "*": true
        },
        "delete": {
          "*": true
        },
        "addField": {
          "*": true
        },
        "protectedFields": {
          "*": []
        }
      }
    }
  ]
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const collection = (schema: CachedSchema, name: string): SchemaCollection | undefined =>
  schema.collections.find((c) => c.name === name);

const field = (schema: CachedSchema, col: string, name: string) =>
  collection(schema, col)?.fields.find((f) => f.name === name);

/** Parse a schema payload and apply the relations the same sync would. */
function sync(type: string, schemaData: unknown, relationData?: unknown): CachedSchema {
  const schema = parseSchemaResponse(type, schemaData);
  return applyRelationsToSchema(schema, parseRelationsResponse(type, schemaData, relationData));
}

// ─── which backends need a second request ────────────────────────────────────

describe('relationEndpointFor', () => {
  /**
   * ⚠️ The BCN-005 §5 call site written for this task asks for `get('/')` on Supabase
   * and `get('/api/collections')` on PocketBase. Those are the *same URLs* the schema
   * fetch already used (`presets.ts`), so following it literally doubles the requests
   * and opens a window in which the two halves of one sync describe two different
   * states of the backend.
   */
  it('asks for a second document on Directus alone', () => {
    expect(relationEndpointFor('directus')).toBe('/relations');
    expect(relationEndpointFor('supabase')).toBeUndefined();
    expect(relationEndpointFor('pocketbase')).toBeUndefined();
    expect(relationEndpointFor('parse')).toBeUndefined();
    expect(relationEndpointFor('nodegx')).toBeUndefined();
  });

  it('has no relation model at all for custom backends', () => {
    expect(relationEndpointFor('custom')).toBeUndefined();
    expect(parseRelationsResponse('custom', [{ name: 'x' }])).toBeUndefined();
  });
});

// ─── the request, before any parsing ─────────────────────────────────────────

/**
 * ⚠️ `GET /api/collections` is **paginated at 30 by default** and the preset asked for
 * no page size. Measured on 0.30.0: `?perPage=5` answers `perPage 5, totalItems 12,
 * items 5` — so a project with more than thirty collections syncs the first thirty and
 * drops the rest with a 200, and every relation naming a target beyond the page becomes
 * unresolvable and is dropped too. Never seen because the rig has twelve.
 */
describe('schemaRequestPath', () => {
  it('asks PocketBase for a page big enough to be the whole list', () => {
    expect(schemaRequestPath('pocketbase', '/api/collections')).toBe('/api/collections?perPage=500');
  });

  it('respects a page size the user set themselves', () => {
    expect(schemaRequestPath('pocketbase', '/api/collections?perPage=50')).toBe('/api/collections?perPage=50');
  });

  it('appends correctly to a path that already has a query string', () => {
    expect(schemaRequestPath('pocketbase', '/api/collections?filter=x')).toBe('/api/collections?filter=x&perPage=500');
  });

  it('leaves every other backend’s schema path exactly as configured', () => {
    expect(schemaRequestPath('directus', '/fields')).toBe('/fields');
    expect(schemaRequestPath('supabase', '/rest/v1/')).toBe('/rest/v1/');
    expect(schemaRequestPath('parse', '/schemas')).toBe('/schemas');
    expect(schemaRequestPath('custom', '/schema')).toBe('/schema');
  });
});

// ─── Directus ────────────────────────────────────────────────────────────────

describe('Directus schema sync, against Directus 11', () => {
  it('recovers the many-to-one, its reverse one-to-many and the many-to-many', () => {
    const schema = sync('directus', DIRECTUS_FIELDS, DIRECTUS_RELATIONS);

    expect(schema.relations).toBeDefined();
    expect(schema.relations!.map((r) => `${r.collection}.${r.field}`).sort()).toEqual([
      'bcn005_articles.author',
      'bcn005_articles.tags',
      'bcn005_authors.articles'
    ]);
  });

  it('carries the junction and the two-hop read path an M2M needs', () => {
    const tags = sync('directus', DIRECTUS_FIELDS, DIRECTUS_RELATIONS).relations!.find((r) => r.field === 'tags')!;

    expect(tags.target).toBe('bcn005_tags');
    expect(tags.cardinality).toBe('many');
    expect(tags.write).toEqual({
      kind: 'junction',
      collection: 'bcn005_articles_tags',
      sourceField: 'article_id',
      targetField: 'tag_id',
      idempotent: false
    });
    // ⚠️ `fields=*,tags.*` returns junction rows with a 200. This is the path that does not.
    expect(tags.readPath).toBe('tags.tag_id');
    expect(tags.readUnwrapKey).toBe('tag_id');
  });

  /**
   * ⚠️ The live `GET /fields` payload — unlike the hand-written fixture — carries the
   * M2M alias as an ordinary-looking entry: `{field: 'tags', type: 'alias', schema:
   * null, meta: {special: ['m2m'], hidden: false}}`. Before the sync it parsed to a
   * plain field of type `alias` with no relation information, which the runtime's port
   * builders treat as an editable column. Only `/relations` says what it is.
   */
  it("names the M2M alias field, which GET /fields describes only as type 'alias'", () => {
    const before = parseDirectusSchema(DIRECTUS_FIELDS);
    expect(field(before, 'bcn005_articles', 'tags')!.type).toBe('alias');
    expect(field(before, 'bcn005_articles', 'tags')!.relationTarget).toBeUndefined();

    const after = sync('directus', DIRECTUS_FIELDS, DIRECTUS_RELATIONS);
    expect(field(after, 'bcn005_articles', 'tags')!.relationTarget).toBe('bcn005_tags');
    expect(field(after, 'bcn005_articles', 'tags')!.relationType).toBe('many-to-many');
  });

  it('leaves a foreign key the column schema already described alone', () => {
    const after = sync('directus', DIRECTUS_FIELDS, DIRECTUS_RELATIONS);
    expect(field(after, 'bcn005_articles', 'author')!.relationTarget).toBe('bcn005_authors');
    expect(field(after, 'bcn005_articles', 'author')!.relationType).toBe('many-to-one');
  });

  /**
   * The reverse one-to-many exists in `/relations` and has no column, so it is stored
   * as a descriptor and **not** synthesised as a field. A field that is not a column is
   * writable from every node and works nowhere.
   */
  it('stores the reverse one-to-many without inventing a column for it', () => {
    const after = sync('directus', DIRECTUS_FIELDS, DIRECTUS_RELATIONS);
    expect(after.relations!.some((r) => r.collection === 'bcn005_authors' && r.field === 'articles')).toBe(true);
    expect(field(after, 'bcn005_authors', 'articles')).toBeUndefined();
  });

  /**
   * ⚠️ 403 is what `GET /relations` answers to a token that can still read `/fields`.
   * "Could not ask" must not be stored as "there are none": an empty array would tell
   * the runtime to stop falling back to `relationsFromCachedCollections`, which is a
   * strict subset but not nothing.
   */
  it('answers undefined, not [], when the relation document could not be read', () => {
    expect(parseRelationsResponse('directus', DIRECTUS_FIELDS, undefined)).toBeUndefined();
    expect(parseRelationsResponse('directus', DIRECTUS_FIELDS, { errors: [{ message: 'forbidden' }] })).toBeUndefined();

    const schema = sync('directus', DIRECTUS_FIELDS, undefined);
    expect(schema.relations).toBeUndefined();
    expect(schema.collections.length).toBeGreaterThan(0);
  });
});

// ─── PostgREST ───────────────────────────────────────────────────────────────

describe('PostgREST schema sync, against PostgREST 12.2.3', () => {
  it('reads relations out of the same OpenAPI document the schema came from', () => {
    const schema = sync('supabase', POSTGREST_SPEC);

    expect(schema.relations!.map((r) => `${r.collection}.${r.field}`).sort()).toEqual([
      'bcn005_articles.author_id',
      'bcn005_articles.bcn005_tags',
      'bcn005_authors.bcn005_articles',
      'bcn005_tags.bcn005_articles'
    ]);
  });

  it('emits the junction M2M as idempotent, because the pair is the primary key', () => {
    const m2m = sync('supabase', POSTGREST_SPEC).relations!.find(
      (r) => r.collection === 'bcn005_articles' && r.field === 'bcn005_tags'
    )!;
    expect(m2m.write).toEqual({
      kind: 'junction',
      collection: 'bcn005_articles_tags',
      sourceField: 'article_id',
      targetField: 'tag_id',
      idempotent: true
    });
  });

  /**
   * PostgREST names an embed after the target table, so the M2M's field name is
   * `bcn005_tags` and there is no such column. It is stored and not synthesised — see
   * `applyRelationsToSchema`.
   */
  it('does not invent the embed-named column PostgREST uses for an M2M', () => {
    const schema = sync('supabase', POSTGREST_SPEC);
    expect(field(schema, 'bcn005_articles', 'bcn005_tags')).toBeUndefined();
    expect(collection(schema, 'bcn005_articles')!.fields.map((f) => f.name)).toEqual(['id', 'title', 'author_id']);
  });

  it('labels a reverse one-to-many as one-to-many, not many-to-many', () => {
    // Cardinality alone cannot tell them apart; `write.kind` can.
    const reverse = sync('supabase', POSTGREST_SPEC).relations!.find(
      (r) => r.collection === 'bcn005_authors' && r.field === 'bcn005_articles'
    )!;
    expect(reverse.cardinality).toBe('many');
    expect(reverse.write.kind).toBe('foreignKey');
  });
});

// ─── PocketBase ──────────────────────────────────────────────────────────────

describe('PocketBase schema sync, against PocketBase 0.30.0', () => {
  /**
   * ⚠️ The defect this file exists to stop repeating, one level down. The `fields`
   * rename was fixed; the relation *target* was still dropped, so PocketBase alone of
   * the four backends had no relation visible to anything downstream. The target is
   * named by collection **id** (`pbc_1390417582`), never by name.
   */
  it('resolves a relation field target through the collection id', () => {
    const schema = parsePocketbaseSchema(POCKETBASE_COLLECTIONS);

    expect(field(schema, 'bcn005_articles', 'author')!.relationTarget).toBe('bcn005_authors');
    expect(field(schema, 'bcn005_articles', 'tags')!.relationTarget).toBe('bcn005_tags');
  });

  it('reads cardinality from maxSelect, since PocketBase calls both kinds "relation"', () => {
    const schema = parsePocketbaseSchema(POCKETBASE_COLLECTIONS);

    expect(field(schema, 'bcn005_articles', 'author')!.relationType).toBe('many-to-one');
    expect(field(schema, 'bcn005_articles', 'tags')!.relationType).toBe('many-to-many');
  });

  /**
   * ⚠️ `users` is `system: false` with `type: 'auth'`, so it is kept — and its
   * `password` and `tokenKey` fields carry `hidden: true`. Not propagating that put a
   * password port on the record nodes.
   */
  it('propagates hidden, so an auth collection does not offer a password port', () => {
    const schema = parsePocketbaseSchema(POCKETBASE_COLLECTIONS);

    expect(collection(schema, 'users')).toBeDefined();
    expect(field(schema, 'users', 'password')!.hidden).toBe(true);
    expect(field(schema, 'users', 'tokenKey')!.hidden).toBe(true);
    expect(field(schema, 'users', 'email')!.hidden).toBeUndefined();
    expect(field(schema, 'users', 'name')!.hidden).toBeUndefined();
  });

  it('reads the primary key off the field, which 0.23+ marks itself', () => {
    const schema = parsePocketbaseSchema(POCKETBASE_COLLECTIONS);
    expect(field(schema, 'bcn005_articles', 'id')!.primaryKey).toBe(true);
    expect(field(schema, 'bcn005_articles', 'title')!.primaryKey).toBeUndefined();
  });

  it('describes both relations as server-side array-field writes', () => {
    const relations = sync('pocketbase', POCKETBASE_COLLECTIONS).relations!;

    expect(relations.map((r) => `${r.collection}.${r.field}`).sort()).toEqual([
      'bcn005_articles.author',
      'bcn005_articles.tags'
    ]);
    // Measured in BCN-005: `+`/`-` are set-shaped and work on maxSelect: 1 too.
    expect(relations.every((r) => r.write.kind === 'arrayField')).toBe(true);
  });
});

// ─── Parse ───────────────────────────────────────────────────────────────────

describe('Parse schema sync, against Parse Server 7.3.0', () => {
  it('reads the Relation out of the schema response it already has', () => {
    const schema = sync('parse', PARSE_SCHEMAS);

    const tags = schema.relations!.find((r) => r.collection === 'Bcn005Article' && r.field === 'tags')!;
    expect(tags.target).toBe('Bcn005Tag');
    expect(tags.cardinality).toBe('many');
    // The one backend family whose write needs no junction: `__op AddRelation`.
    expect(tags.write).toEqual({ kind: 'op' });
  });

  it('agrees with what parseParseSchema already put on the field', () => {
    const schema = sync('parse', PARSE_SCHEMAS);
    expect(field(schema, 'Bcn005Article', 'tags')!.relationTarget).toBe('Bcn005Tag');
    expect(field(schema, 'Bcn005Article', 'tags')!.relationType).toBe('many-to-many');
  });

  it('reads our own backend’s /api/_schema envelope through the same path', () => {
    const schema = sync('nodegx', {
      tables: [
        {
          name: 'Article',
          columns: [
            { name: 'objectId', type: 'String' },
            { name: 'author', type: 'Pointer', targetClass: 'Author' }
          ]
        }
      ]
    });

    expect(schema.relations).toEqual([
      { collection: 'Article', field: 'author', target: 'Author', cardinality: 'one', write: { kind: 'foreignKey', field: 'author', on: 'source' } }
    ]);
  });
});

/**
 * The credential half of this task's brief — *"keep the admin key out of anything
 * published"* — is **not tested here**, deliberately.
 *
 * ⚠️ `adminToken`'s docstring has promised since RUN-003 that it is "NOT published to the
 * deployed app", and until phase 34 nothing kept that promise: `exporter/json.ts`
 * deep-copies the whole metadata block into the export. This task found it from the
 * schema-sync side and the BCN orchestrator found it from the deploy side, independently
 * and in the same week. **The orchestrator's fix landed on `cline-dev` first** —
 * `exportMetadata` in `exporter/json.ts`, covered by `tests/nodegraph/export.js`
 * (`"strips adminToken — types.ts declares it editor-only and the runtime never reads
 * it"`) — and it is measured against a real deploy bundle in a real browser, which is
 * stronger evidence than this task's in-process export was.
 *
 * So the duplicate sanitiser written here was **deleted rather than merged**. Two
 * implementations of one rule is precisely the drift this phase exists to remove, and a
 * second one covered by a second spec is how they stay silently different.
 *
 * One measured disagreement is carried forward instead of encoded here — see
 * `BCN-005-NOTES-SCHEMASYNC.md` §4: `exportMetadata` keeps `username`/`password` on the
 * stated grounds that *"a backend configured for basic auth needs them at runtime"*, and
 * **nothing in `noodl-runtime` or `noodl-viewer-react` reads either field**.
 * `resolveBackend.ts::handleFor` builds a `BackendHandle` from `publicToken` and
 * `sessionToken` only; the sole `'basic'` handling in the runtime is the HTTP Request
 * node, which takes its credentials from its own ports. That is the orchestrator's call
 * to make on their own file, not something to encode in a spec from over here.
 */
