/**
 * DEF-009 — the public-write-door warning, driven through the real door.
 *
 * The editor-side unit specs (`tests-unit/def-009/`) grade the predicate; this
 * file grades the THREADING — that `validate.ts` really reads the project's
 * `nodegx.security.json` and hands it to the check, because a check whose
 * option nobody passes is a check that never runs (DEF-002 AC6's whole story).
 *
 * Two arms, one variable apart — the same public writing function against the
 * same fixture, with and without a `rateLimit` in the project policy file.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { TestSession } from './helpers';
import { call, connect, copyFixture } from './helpers';

interface Diag {
  code: string;
}
interface Res {
  validation?: { diagnostics?: Diag[]; summary?: { warnings: number } };
  error?: { details?: { newErrors?: Diag[]; diagnostics?: Diag[] } };
}

function codesOf(res: { data: Res }): string[] {
  const buckets = [
    res.data?.validation?.diagnostics,
    res.data?.error?.details?.newErrors,
    res.data?.error?.details?.diagnostics
  ];
  return [...new Set(buckets.flatMap((b) => (Array.isArray(b) ? b.map((d) => d.code) : [])))];
}

const DOOR_GRAPH = {
  nodes: [
    { id: 'req', type: 'noodl.cloud.request', parameters: { allowNoAuth: true } },
    { id: 'save', type: 'NewDbModelProperties', parameters: { collectionName: 'ContactMessage' } },
    { id: 'res', type: 'noodl.cloud.response' }
  ],
  connections: [
    { fromId: 'req', fromProperty: 'receive', toId: 'save', toProperty: 'store' },
    { fromId: 'save', fromProperty: 'done', toId: 'res', toProperty: 'send' },
    { fromId: 'save', fromProperty: 'failure', toId: 'res', toProperty: 'send' }
  ]
};

describe('DEF-009 drive: the policy file reaches the check through the door', () => {
  let dir: string;
  let session: TestSession;

  afterEach(async () => {
    await session?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('no policy file: the public write door is NAMED, and the write still lands', async () => {
    dir = copyFixture();
    session = await connect(dir);
    const res = await call<Res>(session, 'create_component', {
      path: '#__cloud__/submitContactForm',
      ...DOOR_GRAPH
    });
    expect(res.isError).toBe(false);
    expect(codesOf(res)).toContain('public-write-door-unlimited');
  });

  it('the same door with a rateLimit in nodegx.security.json is silence — AC3', async () => {
    dir = copyFixture();
    fs.writeFileSync(
      path.join(dir, 'nodegx.security.json'),
      JSON.stringify(
        {
          version: 1,
          functions: { submitContactForm: { call: 'public', rateLimit: { ratePerMinute: 10, burst: 10 } } }
        },
        null,
        2
      )
    );
    session = await connect(dir);
    const res = await call<Res>(session, 'create_component', {
      path: '#__cloud__/submitContactForm',
      ...DOOR_GRAPH
    });
    expect(res.isError).toBe(false);
    expect(codesOf(res)).not.toContain('public-write-door-unlimited');
  });
});
