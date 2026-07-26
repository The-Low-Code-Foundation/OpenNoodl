/**
 * Metrics in Prometheus exposition format (BAK-009).
 *
 * The FORMAT is the product: no dashboards ship, no alerting rules, no
 * embedded time-series database. An operator points their existing Prometheus
 * (or anything that speaks the same text format — VictoriaMetrics, Grafana
 * Agent, `curl | grep`) at `/metrics` and owns the graphs.
 *
 * Instrumentation rules, both learned from metrics endpoints that became
 * useless:
 *
 *   * **Labels stay low-cardinality.** Requests are counted per route CLASS,
 *     not per path: a path label on `/api/:table` means one time series per
 *     collection per status per method, and a metrics endpoint that costs more
 *     than the service is one that gets turned off.
 *   * **Gauges are read at scrape time, not cached.** Backup age and database
 *     size are asked for when someone looks. A cached "backup age" would be the
 *     one number that goes stale exactly when backups stop, which is when it
 *     matters (spec criterion: the backup-age metric goes stale-visible).
 *
 * @module nodegx-backend/ops/metrics
 */

type Labels = Record<string, string>;

interface CounterSeries {
  labels: Labels;
  value: number;
}

interface HistogramSeries {
  labels: Labels;
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

/** Request-duration buckets, in seconds. Tuned for a local-DB backend. */
const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function labelKey(labels: Labels): string {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(',');
}

function renderLabels(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  return `{${keys.map((k) => `${k}="${escapeLabel(labels[k])}"`).join(',')}}`;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export class MetricsRegistry {
  private readonly counters = new Map<string, { help: string; series: Map<string, CounterSeries> }>();
  private readonly histograms = new Map<string, { help: string; series: Map<string, HistogramSeries> }>();
  private readonly gauges = new Map<string, { help: string; read: () => number | null }>();

  counter(name: string, help: string, labels: Labels = {}, by = 1): void {
    let metric = this.counters.get(name);
    if (!metric) {
      metric = { help, series: new Map() };
      this.counters.set(name, metric);
    }
    const key = labelKey(labels);
    const existing = metric.series.get(key);
    if (existing) existing.value += by;
    else metric.series.set(key, { labels, value: by });
  }

  observe(name: string, help: string, labels: Labels, value: number): void {
    let metric = this.histograms.get(name);
    if (!metric) {
      metric = { help, series: new Map() };
      this.histograms.set(name, metric);
    }
    const key = labelKey(labels);
    let series = metric.series.get(key);
    if (!series) {
      series = { labels, buckets: DURATION_BUCKETS, counts: DURATION_BUCKETS.map(() => 0), sum: 0, count: 0 };
      metric.series.set(key, series);
    }
    series.sum += value;
    series.count += 1;
    for (let i = 0; i < series.buckets.length; i++) {
      if (value <= series.buckets[i]) series.counts[i] += 1;
    }
  }

  /**
   * Register a gauge read at scrape time. Returning null omits the series
   * entirely — "there has never been a backup" is honestly absent rather than
   * a zero that reads like "the backup is fresh".
   */
  gauge(name: string, help: string, read: () => number | null): void {
    this.gauges.set(name, { help, read });
  }

  /** Test/ops helper: forget every counter and histogram (gauges are declarations). */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  /** The exposition text. */
  render(): string {
    const lines: string[] = [];

    for (const [name, metric] of [...this.counters].sort()) {
      lines.push(`# HELP ${name} ${metric.help}`, `# TYPE ${name} counter`);
      for (const series of metric.series.values()) {
        lines.push(`${name}${renderLabels(series.labels)} ${series.value}`);
      }
    }

    for (const [name, metric] of [...this.histograms].sort()) {
      lines.push(`# HELP ${name} ${metric.help}`, `# TYPE ${name} histogram`);
      for (const series of metric.series.values()) {
        for (let i = 0; i < series.buckets.length; i++) {
          lines.push(
            `${name}_bucket${renderLabels({ ...series.labels, le: String(series.buckets[i]) })} ${series.counts[i]}`
          );
        }
        lines.push(`${name}_bucket${renderLabels({ ...series.labels, le: '+Inf' })} ${series.count}`);
        lines.push(`${name}_sum${renderLabels(series.labels)} ${series.sum}`);
        lines.push(`${name}_count${renderLabels(series.labels)} ${series.count}`);
      }
    }

    for (const [name, gauge] of [...this.gauges].sort()) {
      let value: number | null;
      try {
        value = gauge.read();
      } catch {
        // A gauge whose source is broken (an unreadable database file) must not
        // take the whole scrape down with it — the other numbers are how an
        // operator finds out why.
        value = null;
      }
      if (value === null || !Number.isFinite(value)) continue;
      lines.push(`# HELP ${name} ${gauge.help}`, `# TYPE ${name} gauge`, `${name} ${value}`);
    }

    return lines.join('\n') + '\n';
  }
}

/**
 * The process-wide registry, a singleton for the same reason the logger is:
 * one service process serves one backend, and threading a registry through
 * every constructor guarantees the awkward call sites go uninstrumented.
 */
export const metrics = new MetricsRegistry();

// ============================================================================
// The instrumentation vocabulary — one place, so names cannot drift
// ============================================================================

export function recordRequest(routeClass: string, method: string, status: number, durationMs: number): void {
  metrics.counter('nodegx_requests_total', 'HTTP requests handled, by route class and status.', {
    class: routeClass,
    method,
    status: String(status)
  });
  metrics.observe(
    'nodegx_request_duration_seconds',
    'HTTP request duration in seconds, by route class.',
    { class: routeClass },
    durationMs / 1000
  );
}

export function recordRateLimited(routeClass: string): void {
  metrics.counter('nodegx_ratelimit_refusals_total', 'Requests refused by the rate limiter, by route class.', {
    class: routeClass
  });
}

export function recordTriggerFire(triggerType: string, ok: boolean): void {
  metrics.counter('nodegx_trigger_fires_total', 'Trigger fires, by type and outcome.', {
    type: triggerType,
    outcome: ok ? 'success' : 'failure'
  });
}

export function recordEmailSend(ok: boolean): void {
  metrics.counter('nodegx_emails_sent_total', 'Emails handed to SMTP, by outcome.', {
    outcome: ok ? 'success' : 'failure'
  });
}

/** Process-level series every Node service should expose. Registered once at startup. */
export function registerProcessGauges(startedAt: number): void {
  metrics.gauge('nodegx_uptime_seconds', 'Seconds since this service started.', () => (Date.now() - startedAt) / 1000);
  metrics.gauge('process_resident_memory_bytes', 'Resident set size of this process.', () => process.memoryUsage().rss);
  metrics.gauge('nodejs_heap_used_bytes', 'V8 heap in use.', () => process.memoryUsage().heapUsed);
  metrics.gauge('process_cpu_seconds_total', 'CPU seconds consumed by this process.', () => {
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1_000_000;
  });
}
