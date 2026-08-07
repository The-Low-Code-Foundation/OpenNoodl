/**
 * AIX-002 step 7 — opt-in, local-first authoring telemetry.
 *
 * The privacy contract is what is under test: nothing is written (and no
 * install id minted) unless the user opted in; a record is enums and numbers
 * in an anonymous envelope, never free text; and a telemetry failure never
 * throws into the authoring flow.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  AI_TELEMETRY_INSTALL_ID_KEY,
  AI_TELEMETRY_OPT_IN_KEY,
  AuthoringTelemetry,
  type TelemetryEnv
} from '../../src/editor/src/models/AiAssistant/telemetry';

function makeEnv(overrides: Partial<TelemetryEnv> = {}): { env: TelemetryEnv; settings: Map<string, unknown> } {
  const settings = new Map<string, unknown>();
  const env: TelemetryEnv = {
    getSetting: (key) => settings.get(key),
    setSetting: (key, value) => settings.set(key, value),
    logDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aix-telemetry-')),
    appVersion: '0.1.0-test',
    now: () => '2026-07-25T12:00:00.000Z',
    ...overrides
  };
  return { env, settings };
}

const ROUND = {
  event: 'authoring-round',
  mode: 'create',
  kind: 'initial',
  status: 'authored',
  turnsTotal: 3,
  submitsTotal: 1,
  costUsdTotal: 0.12,
  durationMs: 4200
} as const;

describe('AIX-002 authoring telemetry', () => {
  it('is off by default: nothing is written and no install id is minted', () => {
    const { env, settings } = makeEnv();
    const telemetry = new AuthoringTelemetry(env);

    expect(telemetry.isEnabled()).toBe(false);
    telemetry.record(ROUND);

    expect(fs.existsSync(telemetry.logPath())).toBe(false);
    expect(settings.has(AI_TELEMETRY_INSTALL_ID_KEY)).toBe(false);
  });

  it('opted in, appends one anonymous JSONL record per event, with a stable install id', () => {
    const { env, settings } = makeEnv();
    const telemetry = new AuthoringTelemetry(env);
    telemetry.setEnabled(true);
    expect(settings.get(AI_TELEMETRY_OPT_IN_KEY)).toBe(true);

    telemetry.record(ROUND);
    telemetry.record({ event: 'authoring-accept', mode: 'update', partial: true, nodeCount: 5, connectionCount: 3 });
    telemetry.record({ event: 'authoring-reject', mode: 'create' });

    const lines = fs.readFileSync(telemetry.logPath(), 'utf8').trim().split('\n');
    expect(lines.length).toBe(3);
    const records = lines.map((line) => JSON.parse(line));

    // The envelope: version, timestamp, anonymous id, app version.
    for (const record of records) {
      expect(record.v).toBe(1);
      expect(record.ts).toBe('2026-07-25T12:00:00.000Z');
      expect(record.appVersion).toBe('0.1.0-test');
      expect(record.installId).toBe(records[0].installId);
    }
    expect(records[0].installId).toBe(settings.get(AI_TELEMETRY_INSTALL_ID_KEY));

    expect(records[0]).toEqual(jasmine.objectContaining({ event: 'authoring-round', status: 'authored', turnsTotal: 3 }));
    expect(records[1]).toEqual(jasmine.objectContaining({ event: 'authoring-accept', partial: true, nodeCount: 5 }));
    expect(records[2]).toEqual(jasmine.objectContaining({ event: 'authoring-reject', mode: 'create' }));

    // The privacy contract, mechanically: every value is an enum-ish string,
    // a number, a boolean, or null — no field carries free text.
    const ENVELOPE_STRINGS = ['ts', 'installId', 'appVersion'];
    const ALLOWED_STRINGS = new Set([
      'authoring-round',
      'authoring-accept',
      'authoring-reject',
      'create',
      'update',
      'initial',
      'refine',
      'authored',
      'exhausted',
      'cancelled',
      'error'
    ]);
    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        if (ENVELOPE_STRINGS.includes(key)) continue;
        if (typeof value === 'string') {
          expect(ALLOWED_STRINGS.has(value))
            .withContext(`free text in "${key}": ${value}`)
            .toBe(true);
        }
      }
    }
  });

  it('re-enabling keeps the same install id; a write failure is swallowed, never thrown', () => {
    const { env, settings } = makeEnv();
    const telemetry = new AuthoringTelemetry(env);
    telemetry.setEnabled(true);
    telemetry.record(ROUND);
    const minted = settings.get(AI_TELEMETRY_INSTALL_ID_KEY);

    telemetry.setEnabled(false);
    telemetry.record(ROUND);
    telemetry.setEnabled(true);
    telemetry.record(ROUND);
    expect(settings.get(AI_TELEMETRY_INSTALL_ID_KEY)).toBe(minted);
    expect(fs.readFileSync(telemetry.logPath(), 'utf8').trim().split('\n').length).toBe(2);

    // A log dir that cannot exist (a file sits where the dir should be).
    const blocked = path.join(os.tmpdir(), `aix-telemetry-blocked-${Date.now()}`);
    fs.writeFileSync(blocked, 'not a directory');
    const broken = new AuthoringTelemetry(makeEnv({ logDir: blocked }).env);
    broken.setEnabled(true);
    expect(() => broken.record(ROUND)).not.toThrow();
  });
});
