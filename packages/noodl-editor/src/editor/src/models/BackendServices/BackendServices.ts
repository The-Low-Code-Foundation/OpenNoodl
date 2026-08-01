/**
 * Backend Services Model
 *
 * Manages backend configurations for the BYOB (Bring Your Own Backend) system.
 * Handles CRUD operations, connection testing, and schema introspection.
 *
 * @module BackendServices
 * @since 1.2.0
 */

import { ProjectModel } from '@noodl-models/projectmodel';
import { Model } from '@noodl-utils/model';

import {
  BACKEND_SELECTION_VERSION,
  BackendSelectionSources,
  ENDPOINT_BACKEND_ID,
  canConvergeSilently,
  namesABackend,
  resolveActiveBackendId,
  selectionAfterDelete,
  selectionAfterEndpointRemoved,
  selectionConflict,
  shouldActivateOnCreate
} from './activeBackend';
import { getPreset } from './presets';
import {
  applyRelationsToSchema,
  parseRelationsResponse,
  parseSchemaResponse,
  relationEndpointFor,
  schemaRequestPath
} from './schemaParsers';
import {
  BackendAuthConfig,
  BackendConfig,
  BackendConfigSerialized,
  BackendServicesEvent,
  BackendServicesEvents,
  BackendServicesMetadata,
  CachedSchema,
  ConnectionStatus,
  ConnectionTestResult,
  CreateBackendRequest,
  IBackendServices,
  UpdateBackendRequest
} from './types';

/**
 * Generate a unique ID for a new backend
 */
function generateId(): string {
  return `backend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * The headers an **editor-only, privileged** request carries.
 *
 * One function because `testConnection` and `fetchSchema` had two copies of it and they
 * had already drifted: ⚠️ the connection test honoured `method: 'basic'` and the schema
 * fetch did not, so a `custom` backend behind HTTP basic auth could pass its own test
 * and then sync a schema with no credential at all — a 401 reported as "Failed to fetch
 * schema: HTTP 401" with nothing pointing at the missing header. Found while giving the
 * relation fetch a third caller; a third copy is what turns a drift into a pattern.
 *
 * `adminToken` and never `publicToken`: everything built here is asking a question only
 * the editor is allowed to ask. See `security.ts` for which of the two a published app
 * carries.
 */
function adminHeaders(auth: BackendAuthConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = auth.adminToken;

  if (auth.method === 'bearer' && token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (auth.method === 'api-key' && token) {
    headers[auth.apiKeyHeader || 'X-API-Key'] = token;
  } else if (auth.method === 'basic' && auth.username && auth.password) {
    headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
  }

  return headers;
}

/**
 * Serialize a BackendConfig for storage
 */
function serializeBackend(backend: BackendConfig): BackendConfigSerialized {
  return {
    ...backend,
    schema: backend.schema
      ? {
          ...backend.schema,
          fetchedAt: backend.schema.fetchedAt.toISOString()
        }
      : undefined,
    lastSynced: backend.lastSynced?.toISOString(),
    createdAt: backend.createdAt.toISOString(),
    updatedAt: backend.updatedAt.toISOString()
  };
}

/**
 * Deserialize a BackendConfig from storage
 */
function deserializeBackend(data: BackendConfigSerialized): BackendConfig {
  return {
    ...data,
    schema: data.schema
      ? {
          ...data.schema,
          fetchedAt: new Date(data.schema.fetchedAt)
        }
      : undefined,
    lastSynced: data.lastSynced ? new Date(data.lastSynced) : undefined,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt)
  };
}

/**
 * Backend Services singleton
 * Manages all backend configurations for the current project
 */
export class BackendServices extends Model<BackendServicesEvent, BackendServicesEvents> implements IBackendServices {
  public static instance: BackendServices = new BackendServices();

  private _isLoading = false;
  private _backends: BackendConfig[] = [];
  /** `activeBackendId` exactly as stored. Read {@link activeBackendId} for the answer. */
  private _storedActiveBackendId: string | undefined;
  private _version: number | undefined;
  /** The group handle for the `cloudServicesChanged` subscription. */
  private _projectListenerGroup = {};

  // ============================================================================
  // Getters
  // ============================================================================

  get isLoading(): boolean {
    return this._isLoading;
  }

  get backends(): BackendConfig[] {
    return this._backends;
  }

  /**
   * Everything the selection rules read, gathered from both metadata keys.
   *
   * `hasEndpoint` is read from `ProjectModel` on every call rather than cached,
   * because the endpoint can be written from three places — this panel's endpoint
   * card, WF-004's auto-fill when a local backend starts, and a version-control
   * revert — and a cached copy would show an ACTIVE badge on a card whose
   * backend the project no longer points at.
   */
  private get selectionSources(): BackendSelectionSources {
    const project = ProjectModel.instance;
    const cloudservices = project ? project.getMetaData('cloudservices') : undefined;

    return {
      version: this._version,
      storedActiveBackendId: this._storedActiveBackendId,
      backendIds: this._backends.map((b) => b.id),
      hasEndpoint: Boolean(cloudservices && cloudservices.endpoint)
    };
  }

  /**
   * The project's one active backend — BCN-009 step 2.
   *
   * May be {@link ENDPOINT_BACKEND_ID}, which is not in {@link backends} and has
   * no `BackendConfig`; see {@link isEndpointActive}. Derived rather than stored
   * so that a project saved by any previous build answers this correctly without
   * being rewritten on open.
   */
  get activeBackendId(): string | undefined {
    return resolveActiveBackendId(this.selectionSources);
  }

  /** Is the project's `cloudservices` endpoint the active backend? */
  get isEndpointActive(): boolean {
    return this.activeBackendId === ENDPOINT_BACKEND_ID;
  }

  /**
   * The second backend a legacy project is still bound to, if it has one.
   *
   * `undefined` for every converged project. See
   * `activeBackend.ts::selectionConflict` for why this is surfaced rather than
   * resolved on the user's behalf.
   */
  get conflictingBackendId(): string | undefined {
    return selectionConflict(this.selectionSources);
  }

  get activeBackend(): BackendConfig | undefined {
    const id = this.activeBackendId;
    if (!id) return undefined;
    return this._backends.find((b) => b.id === id);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize and load backends from the current project
   */
  async initialize(): Promise<void> {
    this._isLoading = true;

    try {
      const project = ProjectModel.instance;
      if (!project) {
        console.warn('[BackendServices] No project loaded');
        return;
      }

      const metadata = project.getMetaData('backendServices') as BackendServicesMetadata | undefined;

      if (metadata) {
        this._backends = metadata.backends.map(deserializeBackend);
        this._storedActiveBackendId = metadata.activeBackendId;
        this._version = metadata.version;
      } else {
        this._backends = [];
        this._storedActiveBackendId = undefined;
        this._version = undefined;
      }

      // BCN-009 step 2: nothing is written here. The converged selection is
      // derived from what is already stored, so opening a project rewrites
      // nothing (F46 — the autosave allowlist exists because a load-time write
      // is indistinguishable from an edit). The migration lands on the next
      // deliberate save, in `saveToProject`.
      this.watchEndpoint(project);

      this.notifyListeners(BackendServicesEvent.BackendsChanged);
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Re-announce the active backend when the project's endpoint changes.
   *
   * The endpoint is half of the converged selection and is written from places
   * that know nothing about this model — WF-004's auto-fill when a local backend
   * starts, the endpoint card, a version-control revert. Without this, starting a
   * local backend in a project with no endpoint would move the ACTIVE badge and
   * nothing would repaint.
   */
  private watchEndpoint(project: ProjectModel): void {
    project.off(this._projectListenerGroup);
    project.on(
      'cloudServicesChanged',
      () => this.notifyListeners(BackendServicesEvent.ActiveBackendChanged, this.activeBackendId),
      this._projectListenerGroup
    );
  }

  /**
   * Reset the service (for project switching)
   */
  reset(): void {
    ProjectModel.instance?.off(this._projectListenerGroup);
    this._backends = [];
    this._storedActiveBackendId = undefined;
    this._version = undefined;
    this._isLoading = false;
    this.notifyListeners(BackendServicesEvent.BackendsChanged);
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Save backends to project metadata — and, on the way, converge the selection.
   *
   * ## The migration lives here, and it is three lines
   *
   * BCN-009 step 2 asks for one storage for "which backend is this project's",
   * migrated for existing projects. This is the write half of it. It runs on the
   * next save a user causes — never on load — and it records the value that is
   * *already true*: {@link activeBackendId} derives what both node families
   * resolve today, so writing it down moves nothing. Everything after that is a
   * deliberate choice with the switch dialog in front of it.
   *
   * ⚠️ **The one case it refuses.** A legacy project can have two active
   * backends that genuinely differ — the endpoint binding the record, auth and
   * file nodes while `activeBackendId` binds the BYOB ones. Either value written
   * as *the* selection silently repoints one family, so the metadata is left in
   * legacy form (no `version`, `activeBackendId` untouched) and the panel shows
   * the conflict with a one-click resolution. See
   * `activeBackend.ts::selectionConflict`.
   */
  private saveToProject(): void {
    const project = ProjectModel.instance;
    if (!project) {
      console.warn('[BackendServices] Cannot save - no project loaded');
      return;
    }

    const sources = this.selectionSources;
    const converging = canConvergeSilently(sources);

    if (converging) {
      // Persist the derived answer, so the next reader does not have to derive
      // it — and so the runtime, which cannot see two keys at once for a
      // deployed app, gets one.
      this._storedActiveBackendId = resolveActiveBackendId(sources);
      this._version = BACKEND_SELECTION_VERSION;
    }

    const metadata: BackendServicesMetadata = {
      backends: this._backends.map(serializeBackend),
      activeBackendId: this._storedActiveBackendId
    };
    if (this._version !== undefined) metadata.version = this._version;

    project.setMetaData('backendServices', metadata);
    project.notifyListeners('backendServicesChanged');
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Get a backend by ID
   */
  getBackend(id: string): BackendConfig | undefined {
    return this._backends.find((b) => b.id === id);
  }

  /**
   * Create a new backend configuration
   */
  async createBackend(request: CreateBackendRequest): Promise<BackendConfig> {
    const preset = getPreset(request.type);
    const now = new Date();

    const backend: BackendConfig = {
      id: generateId(),
      name: request.name,
      type: request.type,
      url: request.url.replace(/\/$/, ''), // Remove trailing slash
      auth: {
        ...preset.defaultAuth,
        ...request.auth
      },
      endpoints: {
        ...preset.endpoints,
        ...request.endpoints
      },
      responseConfig: {
        ...preset.responseConfig,
        ...request.responseConfig
      },
      status: 'disconnected',
      createdAt: now,
      updatedAt: now
    };

    // ⚠️ BCN-009 step 2 / live-QA finding 3.3. The old rule here was
    // `this._backends.length === 1` — the first *`backendServices`* backend,
    // counted without reference to the endpoint the project was already using.
    // In a project with a built-in backend running, that made a freshly added
    // Directus active on creation: the change that takes a project from
    // publishing nothing to publishing a token, made with no dialog and no
    // badge movement the user was looking at. It now activates only into an
    // empty project. See `activeBackend.ts::shouldActivateOnCreate`.
    const activate = shouldActivateOnCreate(this.selectionSources);

    this._backends.push(backend);

    if (activate) {
      this._storedActiveBackendId = backend.id;
      this.notifyListeners(BackendServicesEvent.ActiveBackendChanged, backend.id);
    }

    this.saveToProject();
    this.notifyListeners(BackendServicesEvent.BackendsChanged);

    return backend;
  }

  /**
   * Update an existing backend configuration
   */
  async updateBackend(request: UpdateBackendRequest): Promise<BackendConfig> {
    const index = this._backends.findIndex((b) => b.id === request.id);
    if (index === -1) {
      throw new Error(`Backend not found: ${request.id}`);
    }

    const existing = this._backends[index];
    const updated: BackendConfig = {
      ...existing,
      name: request.name ?? existing.name,
      url: request.url ? request.url.replace(/\/$/, '') : existing.url,
      auth: request.auth ? { ...existing.auth, ...request.auth } : existing.auth,
      endpoints: request.endpoints ? { ...existing.endpoints, ...request.endpoints } : existing.endpoints,
      responseConfig: request.responseConfig
        ? { ...existing.responseConfig, ...request.responseConfig }
        : existing.responseConfig,
      updatedAt: new Date()
    };

    this._backends[index] = updated;
    this.saveToProject();
    this.notifyListeners(BackendServicesEvent.BackendsChanged);

    return updated;
  }

  /**
   * Delete a backend configuration
   */
  async deleteBackend(id: string): Promise<boolean> {
    const index = this._backends.findIndex((b) => b.id === id);
    if (index === -1) {
      return false;
    }

    const wasActive = this.activeBackendId;
    this._backends.splice(index, 1);

    // If we deleted the active backend, fall back — to the endpoint when there
    // is one, because that is what the record, auth and file nodes are bound to.
    // Picking the first surviving REST backend instead would repoint all of them
    // to satisfy a list order.
    const next = selectionAfterDelete(id, wasActive, this.selectionSources);
    if (next !== wasActive) {
      this._storedActiveBackendId = next;
      this.notifyListeners(BackendServicesEvent.ActiveBackendChanged, next);
    }

    this.saveToProject();
    this.notifyListeners(BackendServicesEvent.BackendsChanged);

    return true;
  }

  /**
   * Set the project's one active backend.
   *
   * BCN-009 step 2: `id` may be {@link ENDPOINT_BACKEND_ID}, which is not in
   * {@link backends} — it names the project's `cloudservices` pointer, and is the
   * same synthetic id the runtime's per-node picker already saves. Accepting it
   * here is the whole of how `_endpoint_` survives the convergence: the id does
   * not change, it merely becomes storable.
   */
  setActiveBackend(id: string | undefined): void {
    if (id && !namesABackend(id, this.selectionSources)) {
      console.warn(`[BackendServices] Backend not found: ${id}`);
      return;
    }

    this._storedActiveBackendId = id;
    // Selecting is itself the deliberate act the migration waits for, so the
    // write below always converges — there is no ambiguity left to preserve.
    this._version = BACKEND_SELECTION_VERSION;
    this.saveToProject();
    this.notifyListeners(BackendServicesEvent.ActiveBackendChanged, id);
  }

  /**
   * Re-point the selection after the project's `cloudservices` endpoint is removed.
   *
   * Called by the endpoint card's Disconnect. A selection naming an endpoint that
   * no longer exists is a project whose nodes resolve nothing, so it falls back
   * to the only other thing there is.
   */
  endpointRemoved(): void {
    // `activeBackendId` is read *before* the caller clears `cloudservices` in
    // the ordinary case, but reading it here is safe either way: once the
    // endpoint is gone the derivation cannot answer `_endpoint_` anyway.
    const previous = this._storedActiveBackendId ?? this.activeBackendId;
    this._storedActiveBackendId = selectionAfterEndpointRemoved(
      previous,
      this._backends.map((b) => b.id)
    );
    this.saveToProject();
    this.notifyListeners(BackendServicesEvent.ActiveBackendChanged, this.activeBackendId);
  }

  // ============================================================================
  // Connection Testing
  // ============================================================================

  /**
   * Test connection to a backend
   */
  async testConnection(backendOrConfig: BackendConfig | CreateBackendRequest): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    // Determine URL and auth
    const url = backendOrConfig.url.replace(/\/$/, '');
    const auth = backendOrConfig.auth;
    const preset = getPreset(backendOrConfig.type);
    const endpoints = 'endpoints' in backendOrConfig ? backendOrConfig.endpoints : preset.endpoints;

    // Use adminToken: the connection test asks the schema endpoint, which is a
    // privileged question on every preset. See `adminHeaders`.
    const headers = adminHeaders(auth);

    try {
      // Try to fetch schema endpoint as a connectivity test (requires admin token)
      const schemaUrl = `${url}${schemaRequestPath(backendOrConfig.type, endpoints.schema)}`;
      const response = await fetch(schemaUrl, {
        method: 'GET',
        headers
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        // Update status if this is an existing backend
        if ('id' in backendOrConfig) {
          this.updateBackendStatus(backendOrConfig.id, 'connected');
        }

        return {
          success: true,
          message: `Connected successfully (${responseTime}ms)`,
          responseTime
        };
      } else {
        // Get error details for better error messages
        const errorBody = await response.text().catch(() => '');
        const message =
          response.status === 401 || response.status === 403
            ? `Authentication failed${errorBody ? `: ${errorBody.slice(0, 100)}` : ''}`
            : `HTTP ${response.status}: ${response.statusText}`;

        if ('id' in backendOrConfig) {
          this.updateBackendStatus(backendOrConfig.id, 'error', message);
        }

        return {
          success: false,
          message,
          responseTime
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';

      if ('id' in backendOrConfig) {
        this.updateBackendStatus(backendOrConfig.id, 'error', message);
      }

      return {
        success: false,
        message: `Connection error: ${message}`
      };
    }
  }

  /**
   * Update the connection status of a backend
   */
  private updateBackendStatus(id: string, status: ConnectionStatus, errorMessage?: string): void {
    const backend = this._backends.find((b) => b.id === id);
    if (!backend) return;

    backend.status = status;
    backend.lastError = errorMessage;
    backend.updatedAt = new Date();

    this.saveToProject();
    this.notifyListeners(BackendServicesEvent.StatusChanged, id, status);
  }

  // ============================================================================
  // Schema Introspection
  // ============================================================================

  /**
   * Fetch schema from a backend
   */
  async fetchSchema(backendId: string): Promise<CachedSchema> {
    const backend = this._backends.find((b) => b.id === backendId);
    if (!backend) {
      throw new Error(`Backend not found: ${backendId}`);
    }

    const headers = adminHeaders(backend.auth);

    try {
      const schemaUrl = `${backend.url}${schemaRequestPath(backend.type, backend.endpoints.schema)}`;
      const response = await fetch(schemaUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch schema: HTTP ${response.status}`);
      }

      const data = await response.json();

      // Parse schema based on backend type
      const schema = this.parseSchemaResponse(backend.type, data);

      // BCN-005's relation parsers, given a caller. The admin credential is still in
      // hand here and it never will be again: relation metadata is admin-only on every
      // REST backend (Directus 403, PocketBase 401, PostgREST has no endpoint), and a
      // published app holds a public token. Whatever is not written down at this moment
      // is not discoverable later.
      const relationData = await this.fetchRelationData(backend, headers);
      applyRelationsToSchema(schema, parseRelationsResponse(backend.type, data, relationData));

      // Update backend with schema
      backend.schema = schema;
      backend.lastSynced = new Date();
      backend.status = 'connected';
      backend.updatedAt = new Date();

      this.saveToProject();
      this.notifyListeners(BackendServicesEvent.SchemaUpdated, backendId);

      return schema;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Schema fetch failed';
      this.updateBackendStatus(backendId, 'error', message);
      throw error;
    }
  }

  /**
   * The backend's relation-metadata document, when it has one of its own.
   *
   * ⚠️ **Never fatal.** {@link relationEndpointFor} is Directus-only and Directus
   * answers `GET /relations` with a **403** to a token that can nonetheless read
   * `GET /fields` — a service token scoped to data, say. Rejecting the whole sync for
   * that would turn a partial answer into no answer: the collections are still correct
   * and the runtime still has `relationsFromCachedCollections` to fall back on. So a
   * failure returns `undefined`, `parseRelationsResponse` turns that into "not
   * described" rather than "none", and nothing overwrites relations a previous sync
   * managed to read.
   */
  private async fetchRelationData(backend: BackendConfig, headers: Record<string, string>): Promise<unknown> {
    const path = relationEndpointFor(backend.type);
    if (!path) return undefined;

    try {
      const response = await fetch(`${backend.url}${path}`, { method: 'GET', headers });
      if (!response.ok) {
        console.warn(
          `[BackendServices] ${backend.name}: relation metadata unavailable (HTTP ${response.status} from ${path}). ` +
            'Relations will be inferred from the cached schema, which cannot see a junction table with extra columns.'
        );
        return undefined;
      }
      return await response.json();
    } catch (error) {
      console.warn(`[BackendServices] ${backend.name}: relation metadata request failed`, error);
      return undefined;
    }
  }

  /**
   * Parse schema response based on backend type.
   * Delegates to the pure, unit-tested parsers in ./schemaParsers.
   */
  private parseSchemaResponse(type: string, data: unknown): CachedSchema {
    return parseSchemaResponse(type, data);
  }
}
