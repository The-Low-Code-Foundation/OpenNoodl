/**
 * AIX-002 — step 7: opt-in, local-first authoring telemetry.
 *
 * Gate G2 asks one question: do people who used AI authoring come back
 * unprompted? Answering it needs nothing more than dated, anonymous usage
 * records — so that is all this collects. Each record is one JSONL line of
 * enums and numbers: an event name, an outcome, counts, a cost. Never a
 * prompt, never a description, never a component name, never project content.
 *
 * There is no server. The editor's legacy tracker is a permanent no-op and no
 * analytics endpoint exists — deliberately, nothing here changes that. Records
 * append to a file under the user's data directory, readable and deletable by
 * them; a G2 analysis collects those files from consenting pilot users. The
 * whole thing is off until the user opts in (Editor Settings → AI), and while
 * off, nothing is written and no install id is minted.
 *
 * Retention is answerable from the log alone: distinct days on which an
 * `authoring-round` record exists, keyed by the anonymous install id.
 *
 * This module is Electron/fs-tainted by design and therefore lives OUTSIDE
 * `authoring/` — the session stays headless-bundleable; the panel wires
 * telemetry around it.
 *
 * @module AiAssistant/telemetry
 */

import fs from 'fs';
import { filesystem, platform } from '@noodl/platform';

import { EditorSettings } from '../../utils/editorsettings';
import type { AuthoringMode, AuthoringStatus } from './authoring/types';

export const AI_TELEMETRY_OPT_IN_KEY = 'aiAssistant.telemetry.optIn';
export const AI_TELEMETRY_INSTALL_ID_KEY = 'aiAssistant.telemetry.installId';

/** The complete event vocabulary. Enums and numbers only — no free text. */
export type AuthoringTelemetryEvent =
  /** One loop round reaching an outcome. Totals are cumulative for the session. */
  | {
      event: 'authoring-round';
      mode: AuthoringMode;
      kind: 'initial' | 'refine';
      status: AuthoringStatus;
      turnsTotal: number;
      submitsTotal: number;
      costUsdTotal: number | null;
      durationMs: number;
    }
  | {
      event: 'authoring-accept';
      mode: AuthoringMode;
      partial: boolean;
      nodeCount: number;
      connectionCount: number;
    }
  | { event: 'authoring-reject'; mode: AuthoringMode };

/** One line in the log: the event plus anonymous envelope fields. */
export type AuthoringTelemetryRecord = AuthoringTelemetryEvent & {
  v: 1;
  ts: string;
  installId: string;
  appVersion: string;
};

/** The seams the log writes through; specs bind fakes, the editor the real thing. */
export interface TelemetryEnv {
  getSetting(key: string): unknown;
  setSetting(key: string, value: unknown): void;
  /** Directory the log file lives in; created on first write. */
  logDir: string;
  appVersion: string;
  now(): string;
}

function newInstallId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'i-' + Math.random().toString(36).slice(2, 10) + '-' + Math.random().toString(36).slice(2, 10);
}

export class AuthoringTelemetry {
  constructor(private readonly env: TelemetryEnv) {}

  isEnabled(): boolean {
    return this.env.getSetting(AI_TELEMETRY_OPT_IN_KEY) === true;
  }

  setEnabled(enabled: boolean): void {
    this.env.setSetting(AI_TELEMETRY_OPT_IN_KEY, enabled);
  }

  logPath(): string {
    return this.env.logDir + '/authoring-telemetry.jsonl';
  }

  /**
   * The anonymous install id, minted and persisted on first use. Only called
   * on the write path, so opted-out installs never carry one.
   */
  private installId(): string {
    const existing = this.env.getSetting(AI_TELEMETRY_INSTALL_ID_KEY);
    if (typeof existing === 'string' && existing) return existing;
    const minted = newInstallId();
    this.env.setSetting(AI_TELEMETRY_INSTALL_ID_KEY, minted);
    return minted;
  }

  /**
   * Append one record. A no-op unless opted in, and never throws — telemetry
   * failing must not take authoring down with it.
   */
  record(event: AuthoringTelemetryEvent): void {
    if (!this.isEnabled()) return;
    try {
      const record: AuthoringTelemetryRecord = {
        v: 1,
        ts: this.env.now(),
        installId: this.installId(),
        appVersion: this.env.appVersion,
        ...event
      };
      fs.mkdirSync(this.env.logDir, { recursive: true });
      fs.appendFileSync(this.logPath(), JSON.stringify(record) + '\n');
    } catch (error) {
      console.warn('[authoring] Telemetry write failed (ignored).', error);
    }
  }
}

let defaultInstance: AuthoringTelemetry | undefined;

/** The editor's singleton, bound to EditorSettings and the userData directory. */
export function authoringTelemetry(): AuthoringTelemetry {
  if (!defaultInstance) {
    defaultInstance = new AuthoringTelemetry({
      getSetting: (key) => EditorSettings.instance.get(key),
      setSetting: (key, value) => EditorSettings.instance.set(key, value),
      logDir: filesystem.join(platform.getUserDataPath(), 'telemetry'),
      appVersion: platform.getVersion(),
      now: () => new Date().toISOString()
    });
  }
  return defaultInstance;
}
