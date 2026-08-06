/**
 * AAQ-011/F11 — the Data Browser must not report a missing *selection* as a
 * broken *backend*.
 *
 * The classifier under test exists because the main process cannot tell these
 * apart for us: `requireRunning` throws the identical
 * `Backend must be running to get schema` for a missing id, an unknown id and a
 * stopped backend. That was checked live against a running editor before this
 * was written, and it is the premise of every case below.
 *
 * Pure module, so it lives here rather than in the jasmine suite — no React, no
 * Electron, no editor singletons.
 */

import { describeSchemaFailure, stripIpcErrorPrefix } from '../../src/editor/src/views/panels/databrowser/schemaFailure';

/** What the IPC layer really hands the renderer, verbatim from a live editor. */
const REAL_REJECTION = "Error invoking remote method 'backend:getSchema': Error: Backend must be running to get schema";

const running = { running: true, persistence: { mode: 'persistent' } };
const stopped = { running: false, persistence: { mode: 'unknown', error: null } };

describe('stripIpcErrorPrefix', () => {
  it('removes the Electron invoke wrapper and the leading Error: ', () => {
    expect(stripIpcErrorPrefix(REAL_REJECTION)).toBe('Backend must be running to get schema');
  });

  it('removes a bracketed node error code too', () => {
    expect(
      stripIpcErrorPrefix(
        "Error invoking remote method 'backend:get': TypeError [ERR_INVALID_ARG_TYPE]: The \"path\" argument is invalid"
      )
    ).toBe('The "path" argument is invalid');
  });

  it('leaves a plain sentence alone', () => {
    expect(stripIpcErrorPrefix('disk is full')).toBe('disk is full');
  });
});

describe('describeSchemaFailure', () => {
  it('reports no selection as its own state, not as a failure', () => {
    const result = describeSchemaFailure({
      backendId: undefined,
      exists: false,
      status: null,
      rawMessage: REAL_REJECTION
    });

    expect(result).toEqual({ kind: 'no-selection' });
  });

  it('reports a deleted backend as gone rather than as merely stopped', () => {
    // The regression this guards: `status.running === false` is *also* true here,
    // so testing running-ness first would say "not running yet" about a backend
    // that no longer exists and can never start.
    const result = describeSchemaFailure({
      backendId: 'backend_gone',
      backendName: 'App backend',
      exists: false,
      status: stopped,
      rawMessage: REAL_REJECTION
    });

    expect(result.kind).toBe('missing');
    expect(result.kind !== 'no-selection' && result.message).toContain('App backend');
    expect(result.kind !== 'no-selection' && result.message).toContain('Backend Services');
  });

  it('reports a stopped backend as "not running yet", which is also true while it starts', () => {
    const result = describeSchemaFailure({
      backendId: 'backend_x',
      backendName: 'App backend',
      exists: true,
      status: stopped,
      rawMessage: REAL_REJECTION
    });

    expect(result.kind).toBe('not-running');
    // AAQ-011/F10 starts a project's backend on open; for the second or two
    // before it binds, `running` is false and this sentence still has to be true.
    expect(result.kind !== 'no-selection' && result.message).toContain('not running yet');
  });

  it('surfaces the reason a backend failed to start, when there is one', () => {
    const result = describeSchemaFailure({
      backendId: 'backend_x',
      backendName: 'App backend',
      exists: true,
      status: { running: false, persistence: { mode: 'failed', error: { message: 'port 8580 is in use' } } },
      rawMessage: REAL_REJECTION
    });

    expect(result.kind).toBe('not-running');
    expect(result.kind !== 'no-selection' && result.message).toContain('port 8580 is in use');
  });

  it('reports a running backend that still failed as a real failure, with the real message', () => {
    const result = describeSchemaFailure({
      backendId: 'backend_x',
      backendName: 'App backend',
      exists: true,
      status: running,
      rawMessage: "Error invoking remote method 'backend:getSchema': Error: ECONNREFUSED 127.0.0.1:8580"
    });

    expect(result.kind).toBe('failed');
    expect(result.kind !== 'no-selection' && result.message).toContain('ECONNREFUSED 127.0.0.1:8580');
  });

  it('does not invent a diagnosis when the status probe itself failed', () => {
    const result = describeSchemaFailure({
      backendId: 'backend_x',
      backendName: 'App backend',
      exists: true,
      status: null,
      rawMessage: REAL_REJECTION
    });

    expect(result.kind).toBe('failed');
    expect(result.kind !== 'no-selection' && result.message).toContain('Backend must be running to get schema');
  });

  it('never leaves the sentence with a blank where the name should be', () => {
    const noName = describeSchemaFailure({
      backendId: 'backend_x',
      exists: true,
      status: stopped,
      rawMessage: REAL_REJECTION
    });
    const blankName = describeSchemaFailure({
      backendId: 'backend_x',
      backendName: '   ',
      exists: true,
      status: running,
      rawMessage: 'boom'
    });

    expect(noName.kind !== 'no-selection' && noName.message).toMatch(/^This backend is not running yet/);
    expect(blankName.kind !== 'no-selection' && blankName.message).toContain('in this backend');
  });

  it('gives four different answers to the four situations one message used to cover', () => {
    const kinds = [
      describeSchemaFailure({ exists: false, status: null, rawMessage: REAL_REJECTION }).kind,
      describeSchemaFailure({ backendId: 'a', exists: false, status: stopped, rawMessage: REAL_REJECTION }).kind,
      describeSchemaFailure({ backendId: 'a', exists: true, status: stopped, rawMessage: REAL_REJECTION }).kind,
      describeSchemaFailure({ backendId: 'a', exists: true, status: running, rawMessage: 'boom' }).kind
    ];

    expect(new Set(kinds).size).toBe(4);
  });
});
