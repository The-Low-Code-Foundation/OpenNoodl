# BYOB (Bring Your Own Backend) System

**Phase ID:** PHASE-A  
**Priority:** 🔴 Critical  
**Estimated Duration:** 4-6 weeks  
**Status:** Planning  
**Last Updated:** 2025-12-28

## Executive Summary

BYOB transforms Noodl from a platform with prescribed backend services into a flexible system that works with any BaaS (Backend-as-a-Service) provider. Users can:

1. **Connect to any backend** - Directus, Supabase, Pocketbase, Parse, Firebase, or custom REST/GraphQL APIs
2. **Auto-discover schema** - Noodl introspects the backend and populates node property dropdowns automatically
3. **Switch backends easily** - Same visual graph can point to different backends (dev/staging/prod)
4. **Use multiple backends** - Single project can connect to multiple services simultaneously

## Problem Statement

### Current State

Noodl's original cloud services were tightly coupled to a specific backend implementation. With OpenNoodl, users need flexibility to:

- Use existing company infrastructure
- Choose self-hosted solutions for data sovereignty
- Select platforms based on specific feature needs
- Avoid vendor lock-in

### Pain Points

1. **No backend flexibility** - Original cloud services are defunct
2. **Manual configuration** - Users must wire up HTTP nodes for every operation
3. **No schema awareness** - Property panel can't know what fields exist
4. **No switching** - Changing backends requires rewiring entire project
5. **Security scattered** - Auth tokens hard-coded or awkwardly passed around

## Solution Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NOODL EDITOR                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  BACKEND CONFIGURATION HUB                   │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │   │
│  │  │  Directus   │ │  Supabase   │ │ Pocketbase  │  [+ Add]   │   │
│  │  │  ✓ Active   │ │  Staging    │ │  Local Dev  │            │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   SCHEMA INTROSPECTION                       │   │
│  │  Backend → Schema Endpoint → Parse → Store in Project        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      DATA NODES                              │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐      │   │
│  │  │ Query Records │ │ Create Record │ │ Update Record │      │   │
│  │  │               │ │               │ │               │      │   │
│  │  │ Backend: [▾]  │ │ Backend: [▾]  │ │ Backend: [▾]  │      │   │
│  │  │ Table:   [▾]  │ │ Table:   [▾]  │ │ Table:   [▾]  │      │   │
│  │  │ Fields:  [...] │ │ Fields: [...] │ │ Fields: [...] │      │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND ADAPTER LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED BACKEND API                       │   │
│  │  query(table, filters, options) → Promise<Record[]>          │   │
│  │  create(table, data) → Promise<Record>                       │   │
│  │  update(table, id, data) → Promise<Record>                   │   │
│  │  delete(table, id) → Promise<void>                           │   │
│  │  introspect() → Promise<Schema>                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐        │
│  │  Directus   │      │  Supabase   │      │ Pocketbase  │        │
│  │   Adapter   │      │   Adapter   │      │   Adapter   │        │
│  └─────────────┘      └─────────────┘      └─────────────┘        │
│         │                    │                    │                │
└─────────┼────────────────────┼────────────────────┼────────────────┘
          ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │  Directus   │      │  Supabase   │      │ Pocketbase  │
    │   Server    │      │   Project   │      │   Server    │
    └─────────────┘      └─────────────┘      └─────────────┘
```

## Detailed Specifications

### 1. Backend Configuration Data Model

```typescript
/**
 * Configuration for a single backend connection
 */
interface BackendConfig {
  /** Unique identifier for this backend config */
  id: string;

  /** User-friendly name (e.g., "Production Directus", "Local Dev") */
  name: string;

  /** Backend platform type */
  type: BackendType;

  /** Base URL of the backend */
  url: string;

  /** Authentication configuration */
  auth: AuthConfig;

  /** Cached schema from introspection */
  schema: SchemaCache | null;

  /** Last successful schema sync */
  lastSynced: Date | null;

  /** Connection status */
  status: ConnectionStatus;

  /** Platform-specific configuration */
  platformConfig?: PlatformSpecificConfig;
}

type BackendType = 'directus' | 'supabase' | 'pocketbase' | 'parse' | 'firebase' | 'custom-rest' | 'custom-graphql';

interface AuthConfig {
  /** Authentication method */
  method: AuthMethod;

  /** Static API token (stored encrypted) */
  staticToken?: string;

  /** OAuth/JWT configuration */
  oauth?: OAuthConfig;

  /** API key header name (for custom backends) */
  apiKeyHeader?: string;

  /** Whether to use runtime user auth (pass through user's token) */
  useRuntimeAuth?: boolean;
}

type AuthMethod = 'none' | 'static-token' | 'api-key' | 'oauth' | 'runtime'; // Use currently logged-in user's token

interface OAuthConfig {
  clientId: string;
  clientSecret?: string; // Encrypted
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

/**
 * Platform-specific configuration options
 */
interface PlatformSpecificConfig {
  // Directus
  directus?: {
    /** Use static tokens or Directus auth flow */
    authMode: 'static' | 'directus-auth';
  };

  // Supabase
  supabase?: {
    /** Anon key for client-side access */
    anonKey: string;
    /** Enable realtime subscriptions */
    realtimeEnabled: boolean;
  };

  // Pocketbase
  pocketbase?: {
    /** Admin email for schema introspection */
    adminEmail?: string;
  };

  // Firebase
  firebase?: {
    projectId: string;
    apiKey: string;
    authDomain: string;
  };

  // Custom REST
  customRest?: {
    /** Endpoint patterns */
    endpoints: {
      list: string; // GET /api/{table}
      get: string; // GET /api/{table}/{id}
      create: string; // POST /api/{table}
      update: string; // PATCH /api/{table}/{id}
      delete: string; // DELETE /api/{table}/{id}
      schema?: string; // GET /api/schema (optional)
    };
    /** Response data path (e.g., "data.items" for nested responses) */
    dataPath?: string;
    /** Pagination style */
    pagination: 'offset' | 'cursor' | 'page';
  };
}
```

### 2. Schema Introspection System

```typescript
/**
 * Cached schema from backend introspection
 */
interface SchemaCache {
  /** Schema version/hash for cache invalidation */
  version: string;

  /** When this schema was fetched */
  fetchedAt: Date;

  /** Collections/tables in the backend */
  collections: CollectionSchema[];

  /** Global types/enums if the backend defines them */
  types?: TypeDefinition[];
}

/**
 * Schema for a single collection/table
 */
interface CollectionSchema {
  /** Internal collection name */
  name: string;

  /** Display name (if different from name) */
  displayName?: string;

  /** Collection description */
  description?: string;

  /** Fields in this collection */
  fields: FieldSchema[];

  /** Primary key field name */
  primaryKey: string;

  /** Timestamps configuration */
  timestamps?: {
    createdAt?: string;
    updatedAt?: string;
  };

  /** Whether this is a system collection (hidden by default) */
  isSystem?: boolean;

  /** Relations to other collections */
  relations?: RelationSchema[];
}

/**
 * Schema for a single field
 */
interface FieldSchema {
  /** Field name */
  name: string;

  /** Display name */
  displayName?: string;

  /** Field type (normalized across platforms) */
  type: FieldType;

  /** Original platform-specific type */
  nativeType: string;

  /** Whether field is required */
  required: boolean;

  /** Whether field is unique */
  unique: boolean;

  /** Default value */
  defaultValue?: any;

  /** Validation rules */
  validation?: ValidationRule[];

  /** For enum types, the allowed values */
  enumValues?: string[];

  /** For relation types, the target collection */
  relationTarget?: string;

  /** Whether field is read-only (system-generated) */
  readOnly?: boolean;

  /** Field description */
  description?: string;
}

/**
 * Normalized field types across all platforms
 */
type FieldType =
  // Primitives
  | 'string'
  | 'text' // Long text / rich text
  | 'number'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'

  // Complex
  | 'json'
  | 'array'
  | 'enum'
  | 'uuid'

  // Files
  | 'file'
  | 'image'

  // Relations
  | 'relation-one'
  | 'relation-many'

  // Special
  | 'password' // Hashed, never returned
  | 'email'
  | 'url'
  | 'unknown';

/**
 * Relation between collections
 */
interface RelationSchema {
  /** Field that holds this relation */
  field: string;

  /** Target collection */
  targetCollection: string;

  /** Target field (usually primary key) */
  targetField: string;

  /** Relation type */
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

  /** Junction table for many-to-many */
  junctionTable?: string;
}

/**
 * Validation rule
 */
interface ValidationRule {
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value: any;
  message?: string;
}
```

### 3. Backend Adapter Interface

```typescript
/**
 * Interface that all backend adapters must implement
 */
interface BackendAdapter {
  /** Backend type identifier */
  readonly type: BackendType;

  /** Display name for UI */
  readonly displayName: string;

  /** Icon for UI */
  readonly icon: string;

  /** Initialize adapter with configuration */
  initialize(config: BackendConfig): Promise<void>;

  /** Test connection to backend */
  testConnection(): Promise<ConnectionTestResult>;

  /** Introspect schema from backend */
  introspectSchema(): Promise<SchemaCache>;

  // CRUD Operations

  /** Query records from a collection */
  query(params: QueryParams): Promise<QueryResult>;

  /** Get single record by ID */
  getById(collection: string, id: string): Promise<Record | null>;

  /** Create a new record */
  create(collection: string, data: object): Promise<Record>;

  /** Update an existing record */
  update(collection: string, id: string, data: object): Promise<Record>;

  /** Delete a record */
  delete(collection: string, id: string): Promise<void>;

  // Batch Operations

  /** Create multiple records */
  createMany?(collection: string, data: object[]): Promise<Record[]>;

  /** Update multiple records */
  updateMany?(collection: string, ids: string[], data: object): Promise<Record[]>;

  /** Delete multiple records */
  deleteMany?(collection: string, ids: string[]): Promise<void>;

  // Advanced Operations (optional)

  /** Execute raw query (platform-specific) */
  rawQuery?(query: string, params?: object): Promise<any>;

  /** Subscribe to realtime changes */
  subscribe?(collection: string, callback: ChangeCallback): Unsubscribe;

  /** Upload file */
  uploadFile?(file: File, options?: UploadOptions): Promise<FileRecord>;

  /** Call server function/action */
  callFunction?(name: string, params?: object): Promise<any>;
}

/**
 * Query parameters
 */
interface QueryParams {
  /** Collection to query */
  collection: string;

  /** Filter conditions */
  filter?: FilterGroup;

  /** Fields to return (null = all) */
  fields?: string[] | null;

  /** Sort order */
  sort?: SortSpec[];

  /** Pagination */
  limit?: number;
  offset?: number;
  cursor?: string;

  /** Relations to expand/populate */
  expand?: string[];

  /** Search query (full-text search) */
  search?: string;
}

/**
 * Filter condition or group
 */
interface FilterGroup {
  operator: 'and' | 'or';
  conditions: (FilterCondition | FilterGroup)[];
}

interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
}

type FilterOperator =
  | 'eq' // equals
  | 'neq' // not equals
  | 'gt' // greater than
  | 'gte' // greater than or equal
  | 'lt' // less than
  | 'lte' // less than or equal
  | 'in' // in array
  | 'nin' // not in array
  | 'contains' // string contains
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull';

/**
 * Query result
 */
interface QueryResult {
  /** Returned records */
  data: Record[];

  /** Total count (if available) */
  totalCount?: number;

  /** Pagination cursor for next page */
  nextCursor?: string;

  /** Whether more records exist */
  hasMore: boolean;
}

/**
 * Generic record type
 */
interface Record {
  /** Primary key (always present) */
  id: string;

  /** All other fields */
  [field: string]: any;
}
```

### 4. Platform-Specific Adapters

#### 4.1 Directus Adapter

```typescript
/**
 * Directus backend adapter
 * Directus REST API: https://docs.directus.io/reference/introduction.html
 */
class DirectusAdapter implements BackendAdapter {
  readonly type = 'directus';
  readonly displayName = 'Directus';
  readonly icon = 'directus-logo';

  private sdk: DirectusSDK;
  private config: BackendConfig;

  async initialize(config: BackendConfig): Promise<void> {
    this.config = config;
    this.sdk = createDirectus(config.url).with(rest()).with(staticToken(config.auth.staticToken!));
  }

  async introspectSchema(): Promise<SchemaCache> {
    // Fetch collections
    const collections = await this.sdk.request(readCollections());

    // Fetch fields for each collection
    const fields = await this.sdk.request(readFields());

    // Fetch relations
    const relations = await this.sdk.request(readRelations());

    return this.mapToSchemaCache(collections, fields, relations);
  }

  async query(params: QueryParams): Promise<QueryResult> {
    const items = await this.sdk.request(
      readItems(params.collection, {
        filter: this.mapFilter(params.filter),
        fields: params.fields || ['*'],
        sort: params.sort?.map((s) => `${s.desc ? '-' : ''}${s.field}`),
        limit: params.limit,
        offset: params.offset,
        deep: params.expand ? this.buildDeep(params.expand) : undefined
      })
    );

    // Get total count if needed
    let totalCount: number | undefined;
    if (params.limit) {
      const countResult = await this.sdk.request(
        aggregate(params.collection, {
          aggregate: { count: '*' },
          query: { filter: this.mapFilter(params.filter) }
        })
      );
      totalCount = countResult[0]?.count;
    }

    return {
      data: items,
      totalCount,
      hasMore: params.limit ? items.length === params.limit : false
    };
  }

  private mapFilter(filter?: FilterGroup): object | undefined {
    if (!filter) return undefined;

    // Map our normalized filter to Directus filter format
    // Directus: { _and: [{ field: { _eq: value } }] }
    const conditions = filter.conditions.map((c) => {
      if ('operator' in c && 'conditions' in c) {
        // Nested group
        return this.mapFilter(c as FilterGroup);
      }
      const cond = c as FilterCondition;
      return {
        [cond.field]: {
          [`_${this.mapOperator(cond.operator)}`]: cond.value
        }
      };
    });

    return { [`_${filter.operator}`]: conditions };
  }

  private mapOperator(op: FilterOperator): string {
    const mapping: Record<FilterOperator, string> = {
      eq: 'eq',
      neq: 'neq',
      gt: 'gt',
      gte: 'gte',
      lt: 'lt',
      lte: 'lte',
      in: 'in',
      nin: 'nin',
      contains: 'contains',
      startsWith: 'starts_with',
      endsWith: 'ends_with',
      isNull: 'null',
      isNotNull: 'nnull'
    };
    return mapping[op];
  }

  // ... other methods
}
```

#### 4.2 Supabase Adapter

```typescript
/**
 * Supabase backend adapter
 * Supabase JS: https://supabase.com/docs/reference/javascript/introduction
 */
class SupabaseAdapter implements BackendAdapter {
  readonly type = 'supabase';
  readonly displayName = 'Supabase';
  readonly icon = 'supabase-logo';

  private client: SupabaseClient;
  private config: BackendConfig;

  async initialize(config: BackendConfig): Promise<void> {
    this.config = config;
    const supabaseConfig = config.platformConfig?.supabase;

    this.client = createClient(config.url, supabaseConfig?.anonKey || config.auth.staticToken!, {
      auth: {
        persistSession: false
      },
      realtime: {
        enabled: supabaseConfig?.realtimeEnabled ?? false
      }
    });
  }

  async introspectSchema(): Promise<SchemaCache> {
    // Supabase provides schema via PostgREST
    // Use the /rest/v1/ endpoint with OpenAPI spec
    const response = await fetch(`${this.config.url}/rest/v1/`, {
      headers: {
        apikey: this.config.auth.staticToken!,
        Authorization: `Bearer ${this.config.auth.staticToken}`
      }
    });

    // Parse OpenAPI spec to extract tables and columns
    const openApiSpec = await response.json();
    return this.mapOpenApiToSchema(openApiSpec);
  }

  async query(params: QueryParams): Promise<QueryResult> {
    let query = this.client.from(params.collection).select(params.fields?.join(',') || '*', { count: 'exact' });

    // Apply filters
    if (params.filter) {
      query = this.applyFilters(query, params.filter);
    }

    // Apply sort
    if (params.sort) {
      for (const sort of params.sort) {
        query = query.order(sort.field, { ascending: !sort.desc });
      }
    }

    // Apply pagination
    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1);
    }

    const { data, count, error } = await query;

    if (error) throw new BackendError(error.message, error);

    return {
      data: data || [],
      totalCount: count ?? undefined,
      hasMore: params.limit ? (data?.length || 0) === params.limit : false
    };
  }

  // Realtime subscription (Supabase-specific feature)
  subscribe(collection: string, callback: ChangeCallback): Unsubscribe {
    const channel = this.client
      .channel(`${collection}_changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: collection }, (payload) => {
        callback({
          type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          record: payload.new as Record,
          oldRecord: payload.old as Record
        });
      })
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  }

  // ... other methods
}
```

#### 4.3 Pocketbase Adapter

```typescript
/**
 * Pocketbase backend adapter
 * Pocketbase JS: https://pocketbase.io/docs/client-side-sdks/
 */
class PocketbaseAdapter implements BackendAdapter {
  readonly type = 'pocketbase';
  readonly displayName = 'Pocketbase';
  readonly icon = 'pocketbase-logo';

  private client: PocketBase;
  private config: BackendConfig;

  async initialize(config: BackendConfig): Promise<void> {
    this.config = config;
    this.client = new PocketBase(config.url);

    // Authenticate if admin credentials provided
    const pbConfig = config.platformConfig?.pocketbase;
    if (pbConfig?.adminEmail && config.auth.staticToken) {
      await this.client.admins.authWithPassword(pbConfig.adminEmail, config.auth.staticToken);
    }
  }

  async introspectSchema(): Promise<SchemaCache> {
    // Pocketbase provides collection schema via admin API
    const collections = await this.client.collections.getFullList();

    return {
      version: Date.now().toString(),
      fetchedAt: new Date(),
      collections: collections.map((c) => this.mapCollection(c))
    };
  }

  private mapCollection(pb: any): CollectionSchema {
    return {
      name: pb.name,
      displayName: pb.name,
      primaryKey: 'id',
      fields: pb.schema.map((f: any) => this.mapField(f)),
      timestamps: {
        createdAt: 'created',
        updatedAt: 'updated'
      },
      isSystem: pb.system
    };
  }

  private mapField(field: any): FieldSchema {
    const typeMap: Record<string, FieldType> = {
      text: 'string',
      editor: 'text',
      number: 'number',
      bool: 'boolean',
      email: 'email',
      url: 'url',
      date: 'datetime',
      select: 'enum',
      json: 'json',
      file: 'file',
      relation: field.options?.maxSelect === 1 ? 'relation-one' : 'relation-many'
    };

    return {
      name: field.name,
      type: typeMap[field.type] || 'unknown',
      nativeType: field.type,
      required: field.required,
      unique: field.unique,
      enumValues: field.type === 'select' ? field.options?.values : undefined,
      relationTarget: field.options?.collectionId
    };
  }

  async query(params: QueryParams): Promise<QueryResult> {
    const result = await this.client
      .collection(params.collection)
      .getList(params.offset ? Math.floor(params.offset / (params.limit || 20)) + 1 : 1, params.limit || 20, {
        filter: params.filter ? this.buildFilter(params.filter) : undefined,
        sort: params.sort?.map((s) => `${s.desc ? '-' : ''}${s.field}`).join(','),
        expand: params.expand?.join(',')
      });

    return {
      data: result.items,
      totalCount: result.totalItems,
      hasMore: result.page < result.totalPages
    };
  }

  private buildFilter(filter: FilterGroup): string {
    // Pocketbase uses a custom filter syntax
    // e.g., "name = 'John' && age > 18"
    const parts = filter.conditions.map((c) => {
      if ('operator' in c && 'conditions' in c) {
        return `(${this.buildFilter(c as FilterGroup)})`;
      }
      const cond = c as FilterCondition;
      const op = this.mapOperator(cond.operator);
      const value = typeof cond.value === 'string' ? `'${cond.value}'` : cond.value;
      return `${cond.field} ${op} ${value}`;
    });

    const joiner = filter.operator === 'and' ? ' && ' : ' || ';
    return parts.join(joiner);
  }

  // ... other methods
}
```

## UI Specifications

### Backend Configuration Hub

This replaces the current Cloud Services UI with a flexible multi-backend configuration panel.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Backend Configuration                                                      [×]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ACTIVE BACKEND                                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ [Directus Logo] Production Directus                              [Change ▾] │ │
│ │ https://api.myapp.com  •  ✓ Connected  •  Last sync: 2 min ago              │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                 │
│ ALL BACKENDS                                                     [+ Add Backend]│
│                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ [✓] [Directus] Production Directus                                          │ │
│ │     https://api.myapp.com                                                   │ │
│ │     ✓ Connected  •  12 collections  •  Last sync: 2 min ago                 │ │
│ │                                              [Sync Schema] [Edit] [Delete]  │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ [ ] [Directus] Staging                                                      │ │
│ │     https://staging.myapp.com                                               │ │
│ │     ✓ Connected  •  12 collections  •  Last sync: 1 hour ago               │ │
│ │                                              [Sync Schema] [Edit] [Delete]  │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ [ ] [Supabase] Analytics DB                                                 │ │
│ │     https://xyz.supabase.co                                                 │ │
│ │     ✓ Connected  •  5 collections  •  Realtime enabled                     │ │
│ │                                              [Sync Schema] [Edit] [Delete]  │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ [ ] [Pocketbase] Local Dev                                                  │ │
│ │     http://localhost:8090                                                   │ │
│ │     ⚠ Disconnected  •  Click to reconnect                                  │ │
│ │                                              [Reconnect]   [Edit] [Delete]  │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                 │
│ SCHEMA BROWSER                                              [Expand All] [↻]   │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ ▼ users                                                          12 fields │ │
│ │   ├─ id (uuid) PRIMARY KEY                                                 │ │
│ │   ├─ email (email) REQUIRED UNIQUE                                         │ │
│ │   ├─ name (string)                                                         │ │
│ │   ├─ avatar (image)                                                        │ │
│ │   ├─ role → roles (relation-one)                                           │ │
│ │   └─ ...                                                                   │ │
│ │ ▶ posts                                                           8 fields │ │
│ │ ▶ comments                                                        6 fields │ │
│ │ ▶ categories                                                      4 fields │ │
│ │ ▶ media                                                           7 fields │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Add Backend Dialog

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Add Backend                                                                [×]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ SELECT BACKEND TYPE                                                             │
│                                                                                 │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│ │  [Directus] │ │ [Supabase]  │ │[Pocketbase] │ │   [Parse]   │               │
│ │             │ │             │ │             │ │             │               │
│ │  Directus   │ │  Supabase   │ │ Pocketbase  │ │   Parse     │               │
│ │   ● Selected │ │             │ │             │ │             │               │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                                 │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                               │
│ │ [Firebase]  │ │ [REST API]  │ │ [GraphQL]   │                               │
│ │             │ │             │ │             │                               │
│ │  Firebase   │ │ Custom REST │ │   GraphQL   │                               │
│ │             │ │             │ │             │                               │
│ └─────────────┘ └─────────────┘ └─────────────┘                               │
│                                                                                 │
│ ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                 │
│ DIRECTUS CONFIGURATION                                                          │
│                                                                                 │
│ Name:                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Production Directus                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ URL:                                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ https://api.myapp.com                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ Authentication:                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ ● Static Token                                                              │ │
│ │   ┌───────────────────────────────────────────────────────────────────────┐ │ │
│ │   │ ••••••••••••••••••••••••••••••••                          [👁] [📋]  │ │ │
│ │   └───────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                             │ │
│ │ ○ Directus Auth Flow                                                        │ │
│ │   Users will authenticate with their Directus credentials                  │ │
│ │                                                                             │ │
│ │ ○ Pass-through (Runtime Auth)                                               │ │
│ │   Use the logged-in user's token from your app's auth                      │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│                                                                                 │
│                            [Cancel]  [Test Connection]  [Add Backend]           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Node with Backend Selection

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Query Records                                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ BACKEND                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ [Directus] Production Directus                                           ▾ │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│   ○ Use Active Backend (currently: Production Directus)                        │
│   ● Use Specific Backend                                                        │
│                                                                                 │
│ COLLECTION                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ posts                                                                     ▾ │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│   ├─ users                                                                     │
│   ├─ posts ←                                                                   │
│   ├─ comments                                                                  │
│   ├─ categories                                                                │
│   └─ media                                                                     │
│                                                                                 │
│ ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                 │
│ ▼ FILTER                                                                        │
│                                                                                 │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────────────────┐  │
│   │ status    ▾ │ │ equals    ▾ │ │ published                               │  │
│   └─────────────┘ └─────────────┘ └─────────────────────────────────────────┘  │
│   [+ Add Condition]  [+ Add Group]                                             │
│                                                                                 │
│ ▼ SORT                                                                          │
│   ┌─────────────────┐ ┌─────────────┐                                          │
│   │ created_at    ▾ │ │ Descending▾ │  [+ Add Sort]                            │
│   └─────────────────┘ └─────────────┘                                          │
│                                                                                 │
│ ▼ PAGINATION                                                                    │
│   Limit: [20    ]  Offset: [0     ]                                            │
│                                                                                 │
│ ▶ ADVANCED                                                                      │
│                                                                                 │
│ ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                 │
│ OUTPUTS                                                                         │
│   ○ Records (Array)                                                            │
│   ○ First Record (Object)                                                      │
│   ○ Count (Number)                                                             │
│   ○ Loading (Boolean)                                                          │
│   ○ Error (Object)                                                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase A.1: HTTP Node Foundation (5-7 days)

_Prerequisite: TASK-002 HTTP Node_

The HTTP Node provides the underlying request capability that all backend adapters will use.

**Tasks:**

- [ ] Implement robust HTTP node with all methods (GET, POST, PUT, PATCH, DELETE)
- [ ] Add authentication header configuration
- [ ] Add request/response transformation options
- [ ] Add error handling with retry logic
- [ ] Add request timeout configuration

### Phase A.2: Backend Configuration System (1 week)

**Tasks:**

- [ ] Design `BackendConfig` data model
- [ ] Implement encrypted credential storage
- [ ] Create Backend Configuration Hub UI
- [ ] Create Add/Edit Backend dialogs
- [ ] Implement connection testing
- [ ] Store backend configs in project metadata

**Files to Create:**

```
packages/noodl-editor/src/editor/src/
├── models/
│   └── BackendConfigModel.ts         # Data model for backend configs
├── stores/
│   └── BackendStore.ts               # State management for backends
├── views/panels/
│   └── BackendConfiguration/
│       ├── BackendConfigPanel.tsx    # Main panel
│       ├── BackendList.tsx           # List of configured backends
│       ├── BackendCard.tsx           # Single backend display
│       ├── AddBackendDialog.tsx      # Add new backend
│       ├── EditBackendDialog.tsx     # Edit existing
│       ├── SchemaViewer.tsx          # Schema browser
│       └── ConnectionTest.tsx        # Connection test UI
└── utils/
    └── credentials.ts                # Encryption utilities
```

### Phase A.3: Schema Introspection Engine (1 week)

**Tasks:**

- [ ] Define unified `SchemaCache` interface
- [ ] Implement schema introspection for Directus
- [ ] Implement schema introspection for Supabase
- [ ] Implement schema introspection for Pocketbase
- [ ] Create schema caching mechanism
- [ ] Implement schema diff detection (for sync)
- [ ] Add manual schema refresh

**Files to Create:**

```
packages/noodl-runtime/src/backends/
├── types.ts                          # Shared type definitions
├── BackendAdapter.ts                 # Base adapter interface
├── SchemaIntrospector.ts             # Schema introspection logic
├── adapters/
│   ├── DirectusAdapter.ts
│   ├── SupabaseAdapter.ts
│   ├── PocketbaseAdapter.ts
│   └── CustomRestAdapter.ts
└── index.ts
```

### Phase A.4: Directus Adapter (1 week)

**Tasks:**

- [ ] Implement full CRUD operations via Directus SDK
- [ ] Map Directus filter syntax to unified format
- [ ] Handle Directus-specific field types
- [ ] Implement file upload to Directus
- [ ] Handle Directus relations and expansions
- [ ] Test with real Directus instance

### Phase A.5: Data Node Updates (1 week)

**Tasks:**

- [ ] Add backend selector to all data nodes
- [ ] Populate collection dropdown from schema
- [ ] Generate field inputs from collection schema
- [ ] Update Query Records node
- [ ] Update Create Record node
- [ ] Update Update Record node
- [ ] Update Delete Record node
- [ ] Add loading and error outputs

**Nodes to Modify:**

- `Query Records` - Add backend selector, dynamic fields
- `Create Record` - Schema-aware field inputs
- `Update Record` - Schema-aware field inputs
- `Delete Record` - Collection selector
- `Insert Record` (alias) - Map to Create Record
- `Set Record Properties` (alias) - Map to Update Record

## Testing Strategy

### Unit Tests

```typescript
describe('DirectusAdapter', () => {
  describe('introspectSchema', () => {
    it('should fetch and map collections correctly', async () => {
      const adapter = new DirectusAdapter();
      await adapter.initialize(mockConfig);

      const schema = await adapter.introspectSchema();

      expect(schema.collections).toHaveLength(3);
      expect(schema.collections[0].name).toBe('users');
      expect(schema.collections[0].fields).toContainEqual(expect.objectContaining({ name: 'email', type: 'email' }));
    });
  });

  describe('query', () => {
    it('should translate filters correctly', async () => {
      const spy = jest.spyOn(directusSdk, 'request');

      await adapter.query({
        collection: 'posts',
        filter: {
          operator: 'and',
          conditions: [
            { field: 'status', operator: 'eq', value: 'published' },
            { field: 'views', operator: 'gt', value: 100 }
          ]
        }
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            _and: [{ status: { _eq: 'published' } }, { views: { _gt: 100 } }]
          }
        })
      );
    });
  });
});
```

### Integration Tests

```typescript
describe('Backend Integration', () => {
  // These require actual backend instances
  // Run with: npm test:integration

  describe('Directus', () => {
    const adapter = new DirectusAdapter();

    beforeAll(async () => {
      await adapter.initialize({
        url: process.env.DIRECTUS_URL!,
        auth: { method: 'static-token', staticToken: process.env.DIRECTUS_TOKEN }
      });
    });

    it('should create, read, update, delete a record', async () => {
      // Create
      const created = await adapter.create('test_items', { name: 'Test' });
      expect(created.id).toBeDefined();

      // Read
      const fetched = await adapter.getById('test_items', created.id);
      expect(fetched?.name).toBe('Test');

      // Update
      const updated = await adapter.update('test_items', created.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');

      // Delete
      await adapter.delete('test_items', created.id);
      const deleted = await adapter.getById('test_items', created.id);
      expect(deleted).toBeNull();
    });
  });
});
```

## Security Considerations

### Credential Storage

All sensitive credentials (API tokens, passwords) must be encrypted at rest:

```typescript
class CredentialManager {
  private encryptionKey: Buffer;

  constructor() {
    // Derive key from machine-specific identifier
    this.encryptionKey = this.deriveKey();
  }

  async encrypt(value: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  async decrypt(encrypted: string): Promise<string> {
    const buffer = Buffer.from(encrypted, 'base64');

    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const data = buffer.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(data) + decipher.final('utf8');
  }
}
```

### Runtime Token Handling

When using runtime authentication (passing through user's token):

```typescript
interface RuntimeAuthContext {
  /** Get current user's auth token */
  getToken(): Promise<string | null>;

  /** Refresh token if expired */
  refreshToken(): Promise<string>;

  /** Clear auth state (logout) */
  clearAuth(): void;
}

// In backend adapter
async query(params: QueryParams, authContext?: RuntimeAuthContext): Promise<QueryResult> {
  const headers: Record<string, string> = {};

  if (this.config.auth.useRuntimeAuth && authContext) {
    const token = await authContext.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (this.config.auth.staticToken) {
    headers['Authorization'] = `Bearer ${this.config.auth.staticToken}`;
  }

  // ... make request with headers
}
```

## Future Enhancements (Post-MVP)

### Realtime Subscriptions

For backends that support it (Supabase, Pocketbase):

```typescript
interface RealtimeSubscription {
  /** Subscribe to collection changes */
  subscribe(collection: string, options?: SubscribeOptions): Observable<ChangeEvent>;

  /** Subscribe to specific record changes */
  subscribeToRecord(collection: string, id: string): Observable<ChangeEvent>;
}

// New node: "Subscribe to Changes"
// Outputs: onInsert, onUpdate, onDelete, record, oldRecord
```

### GraphQL Support

For backends with GraphQL APIs:

```typescript
class GraphQLAdapter implements BackendAdapter {
  async introspectSchema(): Promise<SchemaCache> {
    // Use GraphQL introspection query
    const introspectionResult = await this.client.query({
      query: getIntrospectionQuery()
    });

    return this.mapGraphQLSchemaToCache(introspectionResult);
  }

  async query(params: QueryParams): Promise<QueryResult> {
    // Generate GraphQL query from params
    const query = this.buildQuery(params);
    return this.client.query({ query, variables: params.filter });
  }
}
```

### Schema Migrations

Detect and suggest schema changes:

```typescript
interface SchemaDiff {
  added: { collections: CollectionSchema[]; fields: FieldChange[] };
  removed: { collections: string[]; fields: FieldChange[] };
  modified: FieldChange[];
}

interface FieldChange {
  collection: string;
  field: string;
  before?: FieldSchema;
  after?: FieldSchema;
}

// UI notification when schema changes detected
// "Your backend schema has changed. 2 new fields detected in 'users' collection."
```

## Success Metrics

| Metric                     | Target  | Measurement                                   |
| -------------------------- | ------- | --------------------------------------------- |
| Backend connection time    | < 2s    | Time from "Add Backend" to "Connected"        |
| Schema introspection time  | < 5s    | Time to fetch and parse full schema           |
| Query execution overhead   | < 50ms  | Time added by adapter vs raw HTTP             |
| Node property panel render | < 100ms | Time to render schema-aware dropdowns         |
| User satisfaction          | > 4/5   | Survey of users migrating from cloud services |

## Appendix: Backend Comparison Matrix

| Feature                  | Directus     | Supabase    | Pocketbase       | Parse        | Firebase    |
| ------------------------ | ------------ | ----------- | ---------------- | ------------ | ----------- |
| **Schema Introspection** | ✅ REST API  | ✅ OpenAPI  | ✅ Admin API     | ✅ REST      | ⚠️ Manual   |
| **CRUD Operations**      | ✅ Full      | ✅ Full     | ✅ Full          | ✅ Full      | ✅ Full     |
| **Filtering**            | ✅ Rich      | ✅ Rich     | ✅ Good          | ✅ Rich      | ⚠️ Limited  |
| **Relations**            | ✅ Full      | ✅ Full     | ✅ Full          | ✅ Full      | ⚠️ Manual   |
| **File Upload**          | ✅ Built-in  | ✅ Storage  | ✅ Built-in      | ✅ Files     | ✅ Storage  |
| **Realtime**             | ⚠️ Extension | ✅ Built-in | ✅ SSE           | ✅ LiveQuery | ✅ Built-in |
| **Auth Integration**     | ✅ Full      | ✅ Full     | ✅ Full          | ✅ Full      | ✅ Full     |
| **Self-Hostable**        | ✅ Docker    | ⚠️ Complex  | ✅ Single binary | ✅ Docker    | ❌ No       |
| **Open Source**          | ✅ Yes       | ✅ Yes      | ✅ Yes           | ✅ Yes       | ❌ No       |

## Task Index

| Task                                           | Name                   | Status      | Priority    | Description                                                    |
| ---------------------------------------------- | ---------------------- | ----------- | ----------- | -------------------------------------------------------------- |
| [TASK-001](./TASK-001-backend-services-panel/) | Backend Services Panel | ✅ Complete | 🔴 Critical | Sidebar panel for configuring backends                         |
| [TASK-002](./TASK-002-data-nodes/)             | Data Nodes Integration | Not Started | 🔴 Critical | Query, Create, Update, Delete nodes with Visual Filter Builder |
| [TASK-003](./TASK-003-schema-viewer/)          | Schema Viewer          | Not Started | 🟡 Medium   | Interactive tree view of backend schema                        |
| [TASK-004](./TASK-004-edit-backend-dialog/)    | Edit Backend Dialog    | Not Started | 🟡 Medium   | Edit existing backend configurations                           |
| [TASK-005](./TASK-005-local-docker-wizard/)    | Local Docker Wizard    | Not Started | 🟢 Low      | Spin up local backends via Docker                              |

## Recommended Implementation Order

```
TASK-001 ✅ → TASK-002 (Critical) → TASK-003 → TASK-004 → TASK-005
                  ↑
            Hero Feature: Visual Filter Builder
```

## Document Index

- [README.md](./README.md) - This overview document
- [SCHEMA-SPEC.md](./SCHEMA-SPEC.md) - Detailed schema specification (planned)
- [ADAPTER-GUIDE.md](./ADAPTER-GUIDE.md) - Guide for implementing new adapters (planned)
