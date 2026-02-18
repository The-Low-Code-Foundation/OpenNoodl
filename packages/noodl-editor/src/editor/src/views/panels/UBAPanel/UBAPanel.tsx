/**
 * UBA-006 + UBA-007: UBAPanel
 *
 * Editor-side panel for the Universal Backend Adapter system.
 * Provides two tabs:
 *   - Configure: Schema-driven config form backed by project metadata + UBAClient
 *   - Debug: Live SSE event stream from the backend's debug_stream endpoint
 *
 * Schema discovery flow:
 *   1. Read `ubaSchemaUrl` from project metadata
 *   2. If absent → show SchemaLoader UI (URL input field)
 *   3. Fetch + parse the schema with SchemaParser
 *   4. On parse success → render ConfigPanel
 *
 * Config persistence flow:
 *   1. Load `ubaConfig` from project metadata as initialValues
 *   2. ConfigPanel.onSave → store in metadata + POST via UBAClient.configure()
 *
 * Project metadata keys:
 *   - 'ubaSchemaUrl'  — URL or local path to the UBA schema JSON
 *   - 'ubaConfig'     — saved config values (nested object)
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useCallback, useEffect, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';
import { SchemaParser } from '@noodl-models/UBA/SchemaParser';
import type { UBASchema } from '@noodl-models/UBA/types';

import { Tabs, TabsVariant } from '@noodl-core-ui/components/layout/Tabs';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { UBAClient } from '../../../services/UBA/UBAClient';
import { ConfigPanel } from '../../UBA/ConfigPanel';
import { DebugStreamView } from './DebugStreamView';
import css from './UBAPanel.module.scss';

const METADATA_SCHEMA_URL = 'ubaSchemaUrl';
const METADATA_CONFIG = 'ubaConfig';
const HEALTH_POLL_INTERVAL_MS = 30_000;

// ─── Health Indicator (UBA-009) ───────────────────────────────────────────────

type HealthStatus = 'unknown' | 'checking' | 'healthy' | 'unhealthy';

/**
 * Polls the backend health endpoint every 30s.
 * Uses UBAClient.health() which never throws.
 */
function useUBAHealth(
  healthUrl: string | undefined,
  auth: UBASchema['backend']['auth'] | undefined
): { status: HealthStatus; message: string | undefined } {
  const [status, setStatus] = useState<HealthStatus>('unknown');
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!healthUrl) {
      setStatus('unknown');
      setMessage(undefined);
      return;
    }

    let cancelled = false;

    const check = async () => {
      if (!cancelled) setStatus('checking');
      const result = await UBAClient.health(healthUrl, auth);
      if (!cancelled) {
        setStatus(result.healthy ? 'healthy' : 'unhealthy');
        setMessage(result.healthy ? undefined : result.message);
      }
    };

    void check();
    const timer = setInterval(() => void check(), HEALTH_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [healthUrl, auth]);

  return { status, message };
}

const HEALTH_STATUS_CLASS: Record<HealthStatus, string> = {
  unknown: css.healthUnknown,
  checking: css.healthChecking,
  healthy: css.healthHealthy,
  unhealthy: css.healthUnhealthy
};

const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  unknown: 'Not configured',
  checking: 'Checking…',
  healthy: 'Healthy',
  unhealthy: 'Unhealthy'
};

interface HealthBadgeProps {
  status: HealthStatus;
  message: string | undefined;
}

function HealthBadge({ status, message }: HealthBadgeProps) {
  return (
    <div className={`${css.healthBadge} ${HEALTH_STATUS_CLASS[status]}`} title={message ?? HEALTH_STATUS_LABEL[status]}>
      <span className={css.healthDot} aria-hidden="true" />
      <span className={css.healthLabel}>{HEALTH_STATUS_LABEL[status]}</span>
    </div>
  );
}

// ─── Schema Loader ────────────────────────────────────────────────────────────

interface SchemaLoaderProps {
  onLoad: (url: string) => void;
  loading: boolean;
  error: string | null;
}

function SchemaLoader({ onLoad, loading, error }: SchemaLoaderProps) {
  const [url, setUrl] = useState('');

  return (
    <div className={css.schemaLoader}>
      <p className={css.schemaLoaderHint}>
        Paste the URL or local path to your backend&apos;s UBA schema JSON to get started.
      </p>
      <div className={css.schemaLoaderRow}>
        <input
          className={css.schemaLoaderInput}
          type="url"
          placeholder="http://localhost:3210/uba-schema.json"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && url.trim()) onLoad(url.trim());
          }}
          disabled={loading}
        />
        <button
          type="button"
          className={css.schemaLoaderBtn}
          onClick={() => url.trim() && onLoad(url.trim())}
          disabled={loading || !url.trim()}
        >
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>
      {error && (
        <p className={css.schemaLoaderError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── useUBASchema ─────────────────────────────────────────────────────────────

/**
 * Manages schema URL storage + fetching + parsing from project metadata.
 */
function useUBASchema() {
  const [schemaUrl, setSchemaUrl] = useState<string | null>(null);
  const [schema, setSchema] = useState<UBASchema | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reload when project changes
  const reload = useCallback(() => {
    const project = ProjectModel.instance;
    if (!project) {
      setSchemaUrl(null);
      setSchema(null);
      return;
    }
    const savedUrl = project.getMetaData(METADATA_SCHEMA_URL) as string | null;
    setSchemaUrl(savedUrl ?? null);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEventListener(ProjectModel.instance, 'importComplete', reload);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useEventListener(ProjectModel.instance as any, 'instanceHasChanged', reload);

  // Fetch + parse schema when URL changes
  useEffect(() => {
    if (!schemaUrl) {
      setSchema(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const res = await fetch(schemaUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const raw = await res.json();
        const parseResult = new SchemaParser().parse(raw);
        if (parseResult.success) {
          if (!cancelled) {
            setSchema(parseResult.data);
            setLoadError(null);
          }
        } else {
          // Explicit cast: TS doesn't narrow discriminated unions inside async IIFEs
          type FailResult = { success: false; errors: Array<{ path: string; message: string }> };
          const fail = parseResult as FailResult;
          throw new Error(fail.errors.map((e) => `${e.path}: ${e.message}`).join('; ') || 'Schema parse failed');
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
          setSchema(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schemaUrl]);

  const loadSchema = useCallback((url: string) => {
    const project = ProjectModel.instance;
    if (project) {
      project.setMetaData(METADATA_SCHEMA_URL, url);
    }
    setSchemaUrl(url);
  }, []);

  const clearSchema = useCallback(() => {
    const project = ProjectModel.instance;
    if (project) {
      project.setMetaData(METADATA_SCHEMA_URL, null);
    }
    setSchemaUrl(null);
    setSchema(null);
    setLoadError(null);
  }, []);

  return { schemaUrl, schema, loadError, loading, loadSchema, clearSchema };
}

// ─── UBAPanel ────────────────────────────────────────────────────────────────

export function UBAPanel() {
  const { schemaUrl, schema, loadError, loading, loadSchema, clearSchema } = useUBASchema();

  // Load saved config from project metadata
  const getSavedConfig = useCallback((): Record<string, unknown> => {
    const project = ProjectModel.instance;
    if (!project) return {};
    return (project.getMetaData(METADATA_CONFIG) as Record<string, unknown>) ?? {};
  }, []);

  // Save config to project metadata AND push to backend
  const handleSave = useCallback(
    async (values: Record<string, unknown>) => {
      const project = ProjectModel.instance;
      if (project) {
        project.setMetaData(METADATA_CONFIG, values);
      }

      // POST to backend if schema is loaded
      if (schema) {
        await UBAClient.configure(schema.backend.endpoints.config, values, schema.backend.auth);
      }
    },
    [schema]
  );

  const health = useUBAHealth(schema?.backend.endpoints.health, schema?.backend.auth);

  const renderConfigureTab = () => {
    if (!schemaUrl && !loading) {
      return <SchemaLoader onLoad={loadSchema} loading={loading} error={loadError} />;
    }

    if (loading) {
      return <div className={css.statusMsg}>Loading schema…</div>;
    }

    if (loadError) {
      return (
        <div className={css.errorState}>
          <p className={css.errorMsg}>Failed to load schema: {loadError}</p>
          <button type="button" className={css.clearBtn} onClick={clearSchema}>
            Try a different URL
          </button>
        </div>
      );
    }

    if (!schema) {
      return <div className={css.statusMsg}>No schema loaded.</div>;
    }

    return (
      <div className={css.configureTabContent}>
        {schema.backend.endpoints.health && <HealthBadge status={health.status} message={health.message} />}
        <ConfigPanel
          schema={schema}
          initialValues={getSavedConfig()}
          onSave={handleSave}
          onReset={() => {
            /* noop — reset is handled inside ConfigPanel */
          }}
        />
      </div>
    );
  };

  const renderDebugTab = () => {
    if (!schema?.backend.endpoints.debug_stream) {
      return (
        <div className={css.statusMsg}>
          {schema
            ? 'This backend does not expose a debug stream endpoint.'
            : 'Load a schema first to use debug stream.'}
        </div>
      );
    }

    return <DebugStreamView endpoint={schema.backend.endpoints.debug_stream} auth={schema.backend.auth} />;
  };

  return (
    <BasePanel title="Backend Adapter">
      <Tabs
        variant={TabsVariant.Sidebar}
        tabs={[
          {
            label: 'Configure',
            content: renderConfigureTab()
          },
          {
            label: 'Debug',
            content: renderDebugTab()
          }
        ]}
      />
    </BasePanel>
  );
}
