/**
 * Backend Services Types
 *
 * Type definitions for the backends a project can point at: the built-in one,
 * a Parse server, Directus, Supabase, PocketBase, or a custom REST API.
 *
 * @module BackendServices
 * @since 1.2.0
 */

import type { BackendType } from '@noodl/backend-contract';

import { IModel } from '@noodl-utils/model';

// ============================================================================
// Backend Configuration Types
// ============================================================================

/**
 * Supported backend types.
 *
 * BCN-009: this used to be a four-value union of its own —
 * `'directus' | 'supabase' | 'pocketbase' | 'custom'` — which only ever
 * described BYOB's REST backends and so had no name for the two Parse-wire
 * backends the record nodes have been talking to all along. It is now the
 * contract's union, re-exported, which is the reconciliation
 * `@noodl/backend-contract`'s own comment asks this task for.
 *
 * Re-exported rather than aliased so that every existing
 * `from '@noodl-models/BackendServices'` import keeps working, and so there is
 * still exactly one union in the product.
 */
export type { BackendType };

/**
 * Authentication methods supported by backends
 */
export type AuthMethod = 'none' | 'bearer' | 'api-key' | 'basic';

/**
 * Connection status of a backend
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'checking';

/**
 * Pagination styles supported by different backends
 */
export type PaginationType = 'offset' | 'cursor' | 'page';

/**
 * Authentication configuration for a backend
 */
export interface BackendAuthConfig {
  /** Authentication method */
  method: AuthMethod;
  /**
   * Admin token for schema introspection (editor-only).
   * This token is NOT published to the deployed app.
   * Should have permissions to read schema/fields.
   */
  adminToken?: string;
  /**
   * Public token for unauthenticated user access.
   * This token WILL be published and visible in the deployed app.
   * Should only have limited permissions for public data access.
   */
  publicToken?: string;
  /** Custom header name for API key authentication (e.g., "X-API-Key", "apikey") */
  apiKeyHeader?: string;
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
}

/**
 * Endpoint configuration for CRUD operations
 * Supports {table} and {id} placeholders
 */
export interface BackendEndpoints {
  /** List records: GET /items/{table} */
  list: string;
  /** Get single record: GET /items/{table}/{id} */
  get: string;
  /** Create record: POST /items/{table} */
  create: string;
  /** Update record: PATCH /items/{table}/{id} */
  update: string;
  /** Delete record: DELETE /items/{table}/{id} */
  delete: string;
  /** Schema introspection endpoint */
  schema: string;
}

/**
 * Response parsing configuration
 */
export interface ResponseConfig {
  /** Path to data in response (e.g., "data" for Directus, "items" for custom) */
  dataPath?: string;
  /** Path to total count in response */
  totalCountPath?: string;
  /** Pagination style */
  paginationType: PaginationType;
  /** Field name for pagination offset/skip */
  offsetParam?: string;
  /** Field name for pagination limit */
  limitParam?: string;
}

/**
 * Schema field definition
 */
export interface SchemaField {
  name: string;
  displayName?: string;
  type: string;
  nativeType: string;
  required: boolean;
  unique?: boolean;
  primaryKey?: boolean;
  defaultValue?: unknown;
  enumValues?: string[];
  relationTarget?: string;
  relationType?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  /**
   * Presentation-only or explicitly hidden in the backend's admin UI
   * (e.g. Directus meta.hidden / presentation-* interfaces). The byob-*
   * nodes skip hidden fields when building ports — the cached SchemaField
   * is all they see, so this must be preserved at parse time.
   */
  hidden?: boolean;
}

/**
 * Schema collection/table definition
 */
export interface SchemaCollection {
  name: string;
  displayName?: string;
  description?: string;
  fields: SchemaField[];
  primaryKey: string;
  isSystem?: boolean;
}

/**
 * Cached schema from backend introspection
 */
export interface CachedSchema {
  version: string;
  fetchedAt: Date;
  collections: SchemaCollection[];
}

/**
 * Full backend configuration
 */
export interface BackendConfig {
  /** Unique identifier */
  id: string;
  /** User-friendly name */
  name: string;
  /** Backend type (preset or custom) */
  type: BackendType;
  /** Base URL of the backend */
  url: string;
  /** Authentication configuration */
  auth: BackendAuthConfig;
  /** Endpoint patterns */
  endpoints: BackendEndpoints;
  /** Response parsing configuration */
  responseConfig: ResponseConfig;
  /** Cached schema from introspection */
  schema?: CachedSchema;
  /** Connection status */
  status: ConnectionStatus;
  /** Last successful schema sync */
  lastSynced?: Date;
  /** Last error message */
  lastError?: string;
  /** When this backend was created */
  createdAt: Date;
  /** When this backend was last updated */
  updatedAt: Date;
}

/**
 * Serialized backend config for storage in project metadata
 */
export interface BackendConfigSerialized {
  id: string;
  name: string;
  type: BackendType;
  url: string;
  auth: BackendAuthConfig;
  endpoints: BackendEndpoints;
  responseConfig: ResponseConfig;
  schema?: {
    version: string;
    fetchedAt: string;
    collections: SchemaCollection[];
  };
  status: ConnectionStatus;
  lastSynced?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project metadata for backend services
 */
export interface BackendServicesMetadata {
  /**
   * Which reading of `activeBackendId` this metadata was written under.
   *
   * BCN-009 step 2. Absent (i.e. 1) means the legacy split, where
   * `activeBackendId` bound only the BYOB nodes and `cloudservices` separately
   * bound the record, auth and file ones. `2` means the selection has converged
   * and `activeBackendId` is the project's one backend.
   *
   * ⚠️ **The two are byte-identical in the case that matters**, which is why
   * there is a number here at all — see
   * `activeBackend.ts::BACKEND_SELECTION_VERSION`.
   */
  version?: number;
  /** List of configured backends */
  backends: BackendConfigSerialized[];
  /**
   * The project's active backend.
   *
   * From BCN-009 step 2 this may also be `'_endpoint_'`
   * (`activeBackend.ts::ENDPOINT_BACKEND_ID`), meaning the project's
   * `cloudservices` pointer — the same synthetic id the runtime's picker already
   * saves on a node. It is not in `backends` and never will be: the endpoint's
   * *configuration* stays in `cloudservices`; only the *selection* converged.
   */
  activeBackendId?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request to create a new backend
 */
export interface CreateBackendRequest {
  name: string;
  type: BackendType;
  url: string;
  auth: BackendAuthConfig;
  endpoints?: Partial<BackendEndpoints>;
  responseConfig?: Partial<ResponseConfig>;
}

/**
 * Request to update an existing backend
 */
export interface UpdateBackendRequest {
  id: string;
  name?: string;
  url?: string;
  auth?: Partial<BackendAuthConfig>;
  endpoints?: Partial<BackendEndpoints>;
  responseConfig?: Partial<ResponseConfig>;
}

/**
 * Result of a connection test
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTime?: number;
  serverVersion?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by BackendServices
 */
export enum BackendServicesEvent {
  /** A backend was added, updated, or deleted */
  BackendsChanged = 'BackendsChanged',
  /** The active backend changed */
  ActiveBackendChanged = 'ActiveBackendChanged',
  /** Schema was fetched for a backend */
  SchemaUpdated = 'SchemaUpdated',
  /** Connection status changed for a backend */
  StatusChanged = 'StatusChanged'
}

/**
 * Event handler signatures
 */
export type BackendServicesEvents = {
  [BackendServicesEvent.BackendsChanged]: () => void;
  [BackendServicesEvent.ActiveBackendChanged]: (backendId: string | undefined) => void;
  [BackendServicesEvent.SchemaUpdated]: (backendId: string) => void;
  [BackendServicesEvent.StatusChanged]: (backendId: string, status: ConnectionStatus) => void;
};

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Backend Services interface
 */
export interface IBackendServices extends IModel<BackendServicesEvent, BackendServicesEvents> {
  /** Whether the service is currently loading */
  readonly isLoading: boolean;

  /** All configured backends */
  readonly backends: BackendConfig[];

  /**
   * The currently active backend (if any).
   *
   * `undefined` when the project's active backend is its `cloudservices`
   * endpoint, which has no `BackendConfig` — check `isEndpointActive` before
   * reading absence as "nothing is active".
   */
  readonly activeBackend: BackendConfig | undefined;

  /**
   * The project's one active backend id.
   *
   * May be `'_endpoint_'`. See `BackendServicesMetadata.activeBackendId`.
   */
  readonly activeBackendId: string | undefined;

  /** Is the project's `cloudservices` endpoint the active backend? */
  readonly isEndpointActive: boolean;

  /**
   * A second backend a legacy project is still bound to, if it has one.
   * `undefined` for every project whose selection has converged.
   */
  readonly conflictingBackendId: string | undefined;

  /** Initialize and load backends from project */
  initialize(): Promise<void>;

  /** Get a backend by ID */
  getBackend(id: string): BackendConfig | undefined;

  /** Create a new backend */
  createBackend(request: CreateBackendRequest): Promise<BackendConfig>;

  /** Update an existing backend */
  updateBackend(request: UpdateBackendRequest): Promise<BackendConfig>;

  /** Delete a backend */
  deleteBackend(id: string): Promise<boolean>;

  /** Set the active backend. `id` may be `'_endpoint_'`. */
  setActiveBackend(id: string | undefined): void;

  /** Re-point the selection after the project's `cloudservices` endpoint is removed. */
  endpointRemoved(): void;

  /** Test connection to a backend */
  testConnection(backendOrConfig: BackendConfig | CreateBackendRequest): Promise<ConnectionTestResult>;

  /** Fetch schema from a backend */
  fetchSchema(backendId: string): Promise<CachedSchema>;

  /** Reset the service (for project switching) */
  reset(): void;
}
