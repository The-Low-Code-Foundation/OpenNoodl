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

import { getPreset } from './presets';
import { parseSchemaResponse } from './schemaParsers';
import {
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
  private _activeBackendId: string | undefined;

  // ============================================================================
  // Getters
  // ============================================================================

  get isLoading(): boolean {
    return this._isLoading;
  }

  get backends(): BackendConfig[] {
    return this._backends;
  }

  get activeBackendId(): string | undefined {
    return this._activeBackendId;
  }

  get activeBackend(): BackendConfig | undefined {
    if (!this._activeBackendId) return undefined;
    return this._backends.find((b) => b.id === this._activeBackendId);
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
        this._activeBackendId = metadata.activeBackendId;
      } else {
        this._backends = [];
        this._activeBackendId = undefined;
      }

      this.notifyListeners(BackendServicesEvent.BackendsChanged);
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Reset the service (for project switching)
   */
  reset(): void {
    this._backends = [];
    this._activeBackendId = undefined;
    this._isLoading = false;
    this.notifyListeners(BackendServicesEvent.BackendsChanged);
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Save backends to project metadata
   */
  private saveToProject(): void {
    const project = ProjectModel.instance;
    if (!project) {
      console.warn('[BackendServices] Cannot save - no project loaded');
      return;
    }

    const metadata: BackendServicesMetadata = {
      backends: this._backends.map(serializeBackend),
      activeBackendId: this._activeBackendId
    };

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

    this._backends.push(backend);

    // If this is the first backend, make it active
    if (this._backends.length === 1) {
      this._activeBackendId = backend.id;
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

    this._backends.splice(index, 1);

    // If we deleted the active backend, clear it or pick another
    if (this._activeBackendId === id) {
      this._activeBackendId = this._backends.length > 0 ? this._backends[0].id : undefined;
      this.notifyListeners(BackendServicesEvent.ActiveBackendChanged, this._activeBackendId);
    }

    this.saveToProject();
    this.notifyListeners(BackendServicesEvent.BackendsChanged);

    return true;
  }

  /**
   * Set the active backend
   */
  setActiveBackend(id: string | undefined): void {
    if (id && !this._backends.find((b) => b.id === id)) {
      console.warn(`[BackendServices] Backend not found: ${id}`);
      return;
    }

    this._activeBackendId = id;
    this.saveToProject();
    this.notifyListeners(BackendServicesEvent.ActiveBackendChanged, id);
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

    // Build headers - use adminToken for schema introspection (editor-only)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Use adminToken for testing connection (schema access requires admin permissions)
    const token = auth.adminToken;

    if (auth.method === 'bearer' && token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (auth.method === 'api-key' && token) {
      const headerName = auth.apiKeyHeader || 'X-API-Key';
      headers[headerName] = token;
    } else if (auth.method === 'basic' && auth.username && auth.password) {
      const encoded = btoa(`${auth.username}:${auth.password}`);
      headers['Authorization'] = `Basic ${encoded}`;
    }

    try {
      // Try to fetch schema endpoint as a connectivity test (requires admin token)
      const schemaUrl = `${url}${endpoints.schema}`;
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

    // Build headers - use adminToken for schema introspection (editor-only)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Use adminToken for schema fetching (requires admin/service permissions)
    const token = backend.auth.adminToken;

    if (backend.auth.method === 'bearer' && token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (backend.auth.method === 'api-key' && token) {
      const headerName = backend.auth.apiKeyHeader || 'X-API-Key';
      headers[headerName] = token;
    }

    try {
      const schemaUrl = `${backend.url}${backend.endpoints.schema}`;
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
   * Parse schema response based on backend type.
   * Delegates to the pure, unit-tested parsers in ./schemaParsers.
   */
  private parseSchemaResponse(type: string, data: unknown): CachedSchema {
    return parseSchemaResponse(type, data);
  }
}
