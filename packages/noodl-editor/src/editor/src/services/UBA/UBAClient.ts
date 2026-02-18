/**
 * UBA-005: UBAClient
 *
 * Thin HTTP client for communicating with a Universal Backend Adapter server.
 * Handles three concerns:
 *   1. configure  — POST JSON config to the backend's config endpoint
 *   2. health     — GET the health endpoint and parse the status
 *   3. debugStream — open an SSE connection to the debug_stream endpoint
 *
 * This is deliberately framework-agnostic — no React, no Electron APIs.
 * All network calls use the global `fetch` (available in Electron's renderer).
 *
 * Auth support:
 *   - 'none'    — no auth header added
 *   - 'bearer'  — Authorization: Bearer <token>
 *   - 'api_key' — uses `header` field from AuthConfig (e.g. X-Api-Key)
 *   - 'basic'   — Authorization: Basic base64(username:password)
 *
 * Error handling:
 *   - Non-2xx responses → rejected with UBAClientError
 *   - Network failures → rejected with UBAClientError wrapping the original error
 *   - SSE failures → onError callback invoked; caller responsible for cleanup
 */

import type { AuthConfig } from '@noodl-models/UBA/types';

// ─── Public API Types ─────────────────────────────────────────────────────────

/** Result of a successful configure call. */
export interface ConfigureResult {
  /** HTTP status code from the backend */
  status: number;
  /** Parsed response body (may be null for 204 No Content) */
  body: unknown;
  /** True if backend accepted the config (2xx status) */
  ok: boolean;
}

/** Result of a health check call. */
export interface HealthResult {
  /** HTTP status code */
  status: number;
  /** Whether the backend considers itself healthy */
  healthy: boolean;
  /** Optional message from the backend */
  message?: string;
  /** Raw parsed body, if any */
  body?: unknown;
}

/** A single debug event received from the SSE stream. */
export interface DebugEvent {
  /** SSE event type (e.g. 'log', 'error', 'metric') */
  type: string;
  /** Parsed event data */
  data: unknown;
  /** Raw data string as received */
  raw: string;
  /** Client-side timestamp */
  receivedAt: Date;
}

/** Options for opening a debug stream. */
export interface DebugStreamOptions {
  /** Invoked for each SSE event received. */
  onEvent: (event: DebugEvent) => void;
  /** Invoked on connection error or unexpected close. */
  onError?: (error: Error) => void;
  /** Invoked when the stream opens successfully. */
  onOpen?: () => void;
}

/** Error thrown by UBAClient on HTTP or network failures. */
export class UBAClientError extends Error {
  constructor(message: string, public readonly status?: number, public readonly body?: unknown) {
    super(message);
    this.name = 'UBAClientError';
  }
}

/** Handle returned by openDebugStream — call close() to disconnect. */
export interface DebugStreamHandle {
  close(): void;
  readonly endpoint: string;
}

// ─── Auth Header Builder ──────────────────────────────────────────────────────

/**
 * Build the Authorization/custom auth header for a request.
 * Returns an empty record if no auth is required.
 */
function buildAuthHeaders(
  auth: AuthConfig | undefined,
  credentials?: { token?: string; username?: string; password?: string }
): Record<string, string> {
  if (!auth || auth.type === 'none' || !credentials) return {};

  switch (auth.type) {
    case 'bearer': {
      if (!credentials.token) return {};
      return { Authorization: `Bearer ${credentials.token}` };
    }
    case 'api_key': {
      if (!credentials.token) return {};
      const headerName = auth.header ?? 'X-Api-Key';
      return { [headerName]: credentials.token };
    }
    case 'basic': {
      const { username = '', password = '' } = credentials;
      const encoded = btoa(`${username}:${password}`);
      return { Authorization: `Basic ${encoded}` };
    }
    default:
      return {};
  }
}

// ─── UBAClient ────────────────────────────────────────────────────────────────

/**
 * Static utility class for UBA HTTP communication.
 *
 * All methods are `static` — no need to instantiate; just call directly.
 * This keeps usage simple in hooks and models without dependency injection.
 *
 * ```ts
 * const result = await UBAClient.configure(
 *   'http://localhost:3210/configure',
 *   { database: { host: 'localhost', port: 5432 } },
 *   schema.backend.auth
 * );
 * ```
 */
export class UBAClient {
  /** Default fetch timeout in milliseconds. */
  static DEFAULT_TIMEOUT_MS = 10_000;

  // ─── configure ─────────────────────────────────────────────────────────────

  /**
   * POST a configuration object to the backend's config endpoint.
   *
   * @param endpoint - Full URL of the config endpoint (from schema.backend.endpoints.config)
   * @param config - The flattened/structured config values to POST as JSON
   * @param auth - Optional auth configuration from the schema
   * @param credentials - Optional credential values to build the auth header
   * @returns ConfigureResult on success; throws UBAClientError on failure
   */
  static async configure(
    endpoint: string,
    config: Record<string, unknown>,
    auth?: AuthConfig,
    credentials?: { token?: string; username?: string; password?: string }
  ): Promise<ConfigureResult> {
    const authHeaders = buildAuthHeaders(auth, credentials);

    let response: Response;
    try {
      response = await UBAClient._fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(config)
      });
    } catch (err) {
      throw new UBAClientError(
        `Network error sending config to ${endpoint}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Parse body if available
    let body: unknown = null;
    if (response.status !== 204) {
      try {
        body = await response.json();
      } catch {
        // Non-JSON body — read as text
        try {
          body = await response.text();
        } catch {
          body = null;
        }
      }
    }

    if (!response.ok) {
      throw new UBAClientError(`Configure failed: ${response.status} ${response.statusText}`, response.status, body);
    }

    return { status: response.status, body, ok: true };
  }

  // ─── health ────────────────────────────────────────────────────────────────

  /**
   * GET the health endpoint and determine backend status.
   *
   * Backends should return 200 when healthy. Any non-2xx is treated as
   * unhealthy. Network errors are also treated as unhealthy (not thrown).
   *
   * @param endpoint - Full URL of the health endpoint
   * @param auth - Optional auth configuration
   * @param credentials - Optional credentials
   * @returns HealthResult (never throws — unhealthy on error)
   */
  static async health(
    endpoint: string,
    auth?: AuthConfig,
    credentials?: { token?: string; username?: string; password?: string }
  ): Promise<HealthResult> {
    const authHeaders = buildAuthHeaders(auth, credentials);

    let response: Response;
    try {
      response = await UBAClient._fetchWithTimeout(endpoint, {
        method: 'GET',
        headers: authHeaders
      });
    } catch (err) {
      // Network failure → unhealthy
      return {
        status: 0,
        healthy: false,
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`
      };
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      try {
        const text = await response.text();
        body = text || null;
      } catch {
        body = null;
      }
    }

    const healthy = response.ok;
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as Record<string, unknown>).message)
        : typeof body === 'string'
        ? body
        : undefined;

    return { status: response.status, healthy, message, body };
  }

  // ─── openDebugStream ───────────────────────────────────────────────────────

  /**
   * Open a Server-Sent Events connection to the debug_stream endpoint.
   *
   * Returns a handle with a `close()` method to disconnect cleanly.
   * Because EventSource doesn't support custom headers natively, auth
   * tokens are appended as a query parameter when needed.
   *
   * @param endpoint - Full URL of the debug_stream endpoint
   * @param options - Event callbacks (onEvent, onError, onOpen)
   * @param auth - Optional auth configuration
   * @param credentials - Optional credentials
   * @returns DebugStreamHandle — call handle.close() to disconnect
   */
  static openDebugStream(
    endpoint: string,
    options: DebugStreamOptions,
    auth?: AuthConfig,
    credentials?: { token?: string; username?: string; password?: string }
  ): DebugStreamHandle {
    // Append token as query param if needed (EventSource limitation)
    let url = endpoint;
    if (auth && auth.type !== 'none' && credentials?.token) {
      const separator = endpoint.includes('?') ? '&' : '?';
      if (auth.type === 'bearer' || auth.type === 'api_key') {
        url = `${endpoint}${separator}token=${encodeURIComponent(credentials.token)}`;
      }
    }

    const source = new EventSource(url);

    source.onopen = () => {
      options.onOpen?.();
    };

    source.onerror = () => {
      options.onError?.(new Error(`Debug stream connection to ${endpoint} failed or closed`));
    };

    // Listen for 'message' (default SSE event) and any named events
    const handleRawEvent = (e: MessageEvent, type: string) => {
      let data: unknown;
      try {
        data = JSON.parse(e.data);
      } catch {
        data = e.data;
      }

      const event: DebugEvent = {
        type,
        data,
        raw: e.data,
        receivedAt: new Date()
      };

      options.onEvent(event);
    };

    source.addEventListener('message', (e) => handleRawEvent(e as MessageEvent, 'message'));

    // Common named event types that UBA backends may emit
    for (const eventType of ['log', 'error', 'warn', 'info', 'metric', 'trace']) {
      source.addEventListener(eventType, (e) => handleRawEvent(e as MessageEvent, eventType));
    }

    return {
      endpoint,
      close: () => source.close()
    };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  /**
   * Fetch with an AbortController-based timeout.
   */
  private static async _fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UBAClient.DEFAULT_TIMEOUT_MS);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
