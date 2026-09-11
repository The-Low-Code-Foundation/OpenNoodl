/**
 * SB-001 — the cloud component Claude can write.
 *
 * Three defects, one suite:
 *
 * 1. `pathToLegacyName` was a bare `'/' + path`, missing the importer's
 *    `__cloud__/` → `/#__cloud__/` reconstruction — so an MCP-authored cloud
 *    component got `path: '/__cloud__/X'`, failed `isCloudFunctionComponent`,
 *    and shipped in the BROWSER bundle. It now delegates to the editor's own
 *    `toLegacyName`.
 * 2. `create_component` accepted `type: 'cloud'` on any path (metadata and
 *    destiny disagreeing), and did not normalise its `path` argument — a
 *    `#__cloud__/X` spelling became a registry key the editor's
 *    `legacyNameToPath` would never mint, orphaned on the next editor save.
 * 3. No gate checked runtime context: `noodl.cloud.request` validated clean in
 *    a page, `Text` validated clean in a cloud graph. `checkRuntimeContext`
 *    (shared, in `authoredPreconditionDiagnostics`, so the editor gate and this
 *    server keep gate parity) now blocks both, and component instances across
 *    the `/#__cloud__/` boundary with them.
 *
 * ⚠️ Assertions on what landed go to the REGISTRY KEY and the component file's
 * `path` field, not through `store.resolve` — `resolve`'s lenient fallback
 * (`ProjectStore.ts:284-286`) finds mis-keyed components by other spellings,
 * which is exactly how a half-fix would pass an MCP-only round trip.
 */
import * as fs from 'fs';
import * as path from 'path';

import { pathToLegacyName, toPathForm } from '../src/paths';

import type { TestSession } from './helpers';
import { call, connect, copyFixture } from './helpers';

interface RegistryFile {
  components: Record<string, { type?: string; path?: string }>;
}

interface CreateResponse {
  created: string;
  legacyName: string;
  type: string;
  registeredPages?: string[];
  validation: { summary: { errors: number; warnings: number } };
}

interface ErrorResponse {
  error: { code: string; message: string; details?: { newErrors?: Array<{ code: string; message: string }> } };
}

const readJson = <T>(dir: string, rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf-8')) as T;

const CLOUD_FUNCTION_NODES = [
  { id: 'req', type: 'noodl.cloud.request', parameters: { allowNoAuth: true } },
  { id: 'res', type: 'noodl.cloud.response' }
];
const CLOUD_FUNCTION_WIRES = [{ fromId: 'req', fromProperty: 'receive', toId: 'res', toProperty: 'send' }];

describe('SB-001: cloud component authoring', () => {
  describe('the identity pair (unit)', () => {
    it('pathToLegacyName reconstructs the cloud prefix, exactly like the importer', () => {
      expect(pathToLegacyName('__cloud__/Send Welcome')).toBe('/#__cloud__/Send Welcome');
      expect(pathToLegacyName('__cloud__/Stripe/Settings')).toBe('/#__cloud__/Stripe/Settings');
      expect(pathToLegacyName('Pages/Home')).toBe('/Pages/Home');
    });

    it('the pair round-trips both spellings of a cloud identifier', () => {
      for (const input of ['#__cloud__/Send Welcome', '/#__cloud__/Send Welcome', '__cloud__/Send Welcome']) {
        expect(pathToLegacyName(toPathForm(input))).toBe('/#__cloud__/Send Welcome');
      }
    });
  });

  describe('create_component', () => {
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

    it('mints a cloud function under the editor-canonical key, typed cloud, unrouted', async () => {
      const res = await call<CreateResponse>(session, 'create_component', {
        path: '#__cloud__/Send Welcome',
        nodes: CLOUD_FUNCTION_NODES,
        connections: CLOUD_FUNCTION_WIRES
      });
      expect(res.isError).toBe(false);
      expect(res.data.created).toBe('__cloud__/Send Welcome');
      expect(res.data.legacyName).toBe('/#__cloud__/Send Welcome');
      expect(res.data.type).toBe('cloud');
      expect(res.data.registeredPages).toBeUndefined();

      // The registry key and directory are the editor's spelling (no '#').
      const registry = readJson<RegistryFile>(dir, 'components/_registry.json');
      expect(registry.components['__cloud__/Send Welcome']?.type).toBe('cloud');
      expect(registry.components['#__cloud__/Send Welcome']).toBeUndefined();
      // The stored legacy name carries the '#' — this is the field the
      // deployers split the bundles on.
      const component = readJson<{ path: string; type: string }>(
        dir,
        'components/__cloud__/Send Welcome/component.json'
      );
      expect(component.path).toBe('/#__cloud__/Send Welcome');
      expect(component.type).toBe('cloud');
    });

    it('mints a cloud helper (Component Inputs interface, no Request node)', async () => {
      const res = await call<CreateResponse>(session, 'create_component', {
        path: '__cloud__/helpers/formatDate',
        nodes: [
          { id: 'ci', type: 'Component Inputs' },
          { id: 'js', type: 'JavaScriptFunction' },
          { id: 'co', type: 'Component Outputs' }
        ]
      });
      expect(res.isError).toBe(false);
      expect(res.data.legacyName).toBe('/#__cloud__/helpers/formatDate');
      expect(res.data.type).toBe('cloud');
    });

    it('rejects type "cloud" on a browser path, naming the repair', async () => {
      const res = await call<ErrorResponse>(session, 'create_component', {
        path: 'Components/NotCloud',
        type: 'cloud',
        nodes: CLOUD_FUNCTION_NODES,
        connections: CLOUD_FUNCTION_WIRES
      });
      expect(res.isError).toBe(true);
      expect(res.data.error.code).toBe('invalid-argument');
      expect(res.data.error.message).toContain('#__cloud__/');
      expect(fs.existsSync(path.join(dir, 'components/Components/NotCloud'))).toBe(false);
    });

    it('rejects a non-cloud type on a cloud path', async () => {
      const res = await call<ErrorResponse>(session, 'create_component', {
        path: '#__cloud__/Mislabelled',
        type: 'visual',
        nodes: CLOUD_FUNCTION_NODES,
        connections: CLOUD_FUNCTION_WIRES
      });
      expect(res.isError).toBe(true);
      expect(res.data.error.code).toBe('invalid-argument');
    });

    it('blocks a browser node in a cloud graph (wrong-runtime-node), writing nothing', async () => {
      const res = await call<ErrorResponse>(session, 'create_component', {
        path: '__cloud__/BadVisual',
        nodes: [...CLOUD_FUNCTION_NODES, { id: 'txt', type: 'Text', parameters: { text: 'hi' } }],
        connections: CLOUD_FUNCTION_WIRES
      });
      expect(res.isError).toBe(true);
      const codes = (res.data.error.details?.newErrors ?? []).map((d) => d.code);
      expect(codes).toContain('wrong-runtime-node');
      expect(fs.existsSync(path.join(dir, 'components/__cloud__/BadVisual'))).toBe(false);
    });

    it('blocks a cloud node in a browser graph (wrong-runtime-node)', async () => {
      const res = await call<ErrorResponse>(session, 'create_component', {
        path: 'Components/BadCloud',
        nodes: [{ id: 'req', type: 'noodl.cloud.request' }]
      });
      expect(res.isError).toBe(true);
      const codes = (res.data.error.details?.newErrors ?? []).map((d) => d.code);
      expect(codes).toContain('wrong-runtime-node');
    });

    it('blocks a browser component instantiated inside a cloud graph', async () => {
      const res = await call<ErrorResponse>(session, 'create_component', {
        path: '__cloud__/BadInstance',
        nodes: [...CLOUD_FUNCTION_NODES, { id: 'card', type: '/Card' }],
        connections: CLOUD_FUNCTION_WIRES
      });
      expect(res.isError).toBe(true);
      const codes = (res.data.error.details?.newErrors ?? []).map((d) => d.code);
      expect(codes).toContain('wrong-runtime-node');
    });

    it('still accepts the browser component the suite has always minted (control)', async () => {
      const res = await call<CreateResponse>(session, 'create_component', {
        path: 'Components/StillFine',
        nodes: [{ id: 'g', type: 'Group' }, { id: 't', type: 'Text', parent: 'g' }]
      });
      expect(res.isError).toBe(false);
      expect(res.data.type).toBe('visual');
    });
  });
});
