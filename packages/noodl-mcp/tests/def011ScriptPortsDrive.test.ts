/**
 * DEF-011 (SB-010) re-drive at HEAD — the script ports the authored door does not write.
 *
 * SB-010's claim, measured 2026-08-26, BEFORE DEF-002 rebuilt this door's
 * connection checking: the door accepts a wire from a JavaScriptFunction's
 * script-derived signal output (`Outputs.ok()` → `out-ok`) and then does not
 * persist the port, so a deployed backend — where `setup()` returns before
 * deriving anything (`simplejavascript.ts`: no `editorConnection`) — throws
 * `Outputs.ok is not a function` and the function 504s.
 *
 * ## Re-driven at HEAD 2026-08-29 (pre-fix), then inverted by the fix
 *
 * Pre-fix reading, this session: the door accepted the undeclared arm `0/0/0`,
 * kept the wire from `out-ok`, and wrote NO ports — `jsNode: {}` on disk. So
 * SB-010's claim survived DEF-002's rebuild of this door, as a measurement.
 * With `withAuthoredScriptPorts` in the assembly path (DEF-011's fix), the P
 * arm now asserts what the W control always got: the port on disk.
 *
 *  W. CONTROL — the SB-004 workaround: the same graph WITH the port declared
 *     explicitly (`ports: [{ name: 'out-ok', plug: 'output', type: 'signal' }]`).
 *     Accepted, `out-ok` on disk, and — cardinality where the author and the
 *     derivation meet — exactly ONE `out-ok`, the author's spelling.
 *  P. PROBE→AC — the same graph with NO declared ports; the script alone names
 *     `Outputs.ok`. Accepted, and the derived `signal` port is on disk, so a
 *     runtime with no editor (deployed backend, headless render) can resolve
 *     `Outputs.ok`.
 *
 * The arms print their diagnostics and the on-disk port list, so the recorded
 * evidence is the readings themselves rather than a boolean.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { TestSession } from './helpers';
import { call, connect, copyFixture } from './helpers';

interface Diag {
  code: string;
  severity: string;
  message: string;
}

interface CreateResponse {
  created: string;
  validation: { summary: { errors: number; warnings: number }; diagnostics?: Diag[] };
}

interface ErrorResponse {
  error: { code: string; message: string; details?: { newErrors?: Diag[]; diagnostics?: Diag[] } };
}

type Either = CreateResponse & ErrorResponse;

function codesOf(res: { isError: boolean; data: Either }): string[] {
  const buckets = [
    res.data?.validation?.diagnostics,
    res.data?.error?.details?.newErrors,
    res.data?.error?.details?.diagnostics
  ];
  return [...new Set(buckets.flatMap((b) => (Array.isArray(b) ? b.map((d) => d.code) : [])))];
}

function report(arm: string, res: { isError: boolean; data: Either }): void {
  // eslint-disable-next-line no-console
  console.log(
    `\n[${arm}] isError=${res.isError} codes=${JSON.stringify(codesOf(res))}\n` +
      `        ${JSON.stringify(res.data).slice(0, 700)}`
  );
}

/** The persisted ports of the JavaScriptFunction node inside a written component file. */
function diskPorts(projectDir: string, componentBasename: string): unknown {
  const hits: string[] = [];
  const walkDir = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name === componentBasename && fs.existsSync(path.join(p, 'nodes.json'))) hits.push(p);
      else walkDir(p);
    }
  };
  walkDir(path.join(projectDir, 'components'));
  if (hits.length !== 1) return `expected 1 dir for ${componentBasename}, found ${hits.length}`;
  const raw = fs.readFileSync(path.join(hits[0], 'nodes.json'), 'utf8');
  const found: unknown[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === 'object') {
      const node = n as { type?: string; ports?: unknown; dynamicports?: unknown };
      if (node.type === 'JavaScriptFunction')
        found.push({ ports: node.ports, dynamicports: node.dynamicports });
      Object.values(n).forEach(walk);
    }
  };
  walk(JSON.parse(raw));
  return { file: path.relative(projectDir, hits[0]), jsNode: found[0] ?? 'no JavaScriptFunction node found' };
}

const SCRIPT = 'Outputs.ok();';

function graph(withDeclaredPort: boolean) {
  return {
    nodes: [
      { id: 'req', type: 'noodl.cloud.request', parameters: { allowNoAuth: true } },
      {
        id: 'js',
        type: 'JavaScriptFunction',
        parameters: { functionScript: SCRIPT },
        ...(withDeclaredPort ? { ports: [{ name: 'out-ok', plug: 'output', type: 'signal' }] } : {})
      },
      { id: 'res', type: 'noodl.cloud.response' }
    ],
    connections: [
      { fromId: 'req', fromProperty: 'receive', toId: 'js', toProperty: 'run' },
      { fromId: 'js', fromProperty: 'out-ok', toId: 'res', toProperty: 'send' },
      // DEF-002 — the failure route must reach the caller or the door refuses
      // for `failure-reaches-nothing`, an unrelated rejection that would stand
      // in for the one this probe exists to read.
      { fromId: 'js', fromProperty: 'failure', toId: 'res', toProperty: 'send' }
    ]
  };
}

describe('DEF-011 probe: script-derived ports at the authored door', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('W. CONTROL — the declared-port workaround is accepted and the port is on disk EXACTLY ONCE', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/probe/ScriptPortDeclared',
      ...graph(true)
    });
    report('W control: out-ok DECLARED in ports[]', res);
    const disk = diskPorts(dir, 'ScriptPortDeclared') as { jsNode: { ports?: Array<{ name: string }> } };
    // eslint-disable-next-line no-console
    console.log('        disk:', JSON.stringify(disk));
    expect(res.isError).toBe(false);
    // Cardinality where the author's port and the door's derivation meet: the
    // merge dedupes by (plug, name), so the author's declaration survives alone.
    expect((disk.jsNode.ports ?? []).filter((p) => p.name === 'out-ok')).toHaveLength(1);
  });

  it('P. AC — the same graph with the port only in the script carries it on disk', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/probe/ScriptPortUndeclared',
      ...graph(false)
    });
    report('P: out-ok named only by Outputs.ok() in the script', res);
    const disk = diskPorts(dir, 'ScriptPortUndeclared') as {
      jsNode: { ports?: Array<{ name: string; plug?: string; type?: unknown }> };
    };
    // eslint-disable-next-line no-console
    console.log('        disk:', JSON.stringify(disk));
    expect(res.isError).toBe(false);
    const outOk = (disk.jsNode.ports ?? []).filter((p) => p.name === 'out-ok');
    expect(outOk).toHaveLength(1);
    // `signal` specifically — `_isSignalType` reads `outputPorts[name].type`,
    // and a `*` here would leave `Outputs.ok` uncallable on a deployed backend.
    expect(outOk[0]).toMatchObject({ plug: 'output', type: 'signal' });
  });
});
