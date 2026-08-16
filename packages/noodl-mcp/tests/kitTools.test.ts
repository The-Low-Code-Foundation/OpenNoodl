/**
 * CN-006 — `create_node_kit` through the server, which is AC6: *"scaffold a kit
 * through the MCP tool, from a real session, and place the node. Generating
 * files is not the feature; the feature is that the node arrives."*
 *
 * The half this file can reach is everything up to and including **the node
 * arriving in the catalog the AI and the validator both read** — the headless
 * extractor from CN-003 executes the kit's `index.js` for real, so a kit that
 * throws, or registers nothing, or declares a port it does not have, is caught
 * here rather than by a user.
 *
 * 🔴 **The discovery door is asserted, not assumed.** `create_node_kit` is in
 * the `project` group, whose `purpose` line does not mention kits — the price of
 * costing zero resident tokens (see `toolGroups.ts`). What keeps AWP-006's own
 * warning satisfied ("a tool the model cannot see is a capability the product
 * does not have") is that `find_tools`' `query` matches tool names. If that ever
 * stops being true, this tool becomes unreachable for any model that has not
 * been told it exists, and the failure would be silent everywhere else.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { buildKitExtractor, call, connect, copyFixture, exists, reveal, type TestSession } from './helpers';
import { clearProjectOverlay } from '../src/kitOverlay';
import type { CreateNodeKitResponse } from '../src/tools/kitTools';
import type { FindToolsResponse, ToolErrorPayload } from '../src/tools/responses';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { typesCopyStatus } = require('@nodegx/kit-scaffold');

/**
 * CN-003's headless extractor, built from source per run.
 *
 * 🔴 Built rather than read from `dist/`: `dist/` is gitignored, so reading it
 * would skip this suite in a fresh checkout and grade a stale artifact in a
 * working one.
 */
let extractorDir: string;

beforeAll(async () => {
  extractorDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn006-extract-'));
  process.env.NODEGX_KIT_EXTRACT = await buildKitExtractor(extractorDir);
}, 120_000);

afterAll(() => {
  delete process.env.NODEGX_KIT_EXTRACT;
  fs.rmSync(extractorDir, { recursive: true, force: true });
});

afterEach(() => clearProjectOverlay());

describe('CN-006 — create_node_kit', () => {
  let session: TestSession;

  beforeEach(async () => {
    session = await connect(copyFixture());
    // 🔴 Not setup noise — this is the door, and writing these tests without it
    // is what caught the sharper problem below. `connect()` reproduces the
    // shipped default, so `create_node_kit` starts deferred and every call
    // returns "Tool create_node_kit disabled". A model reaches it exactly this
    // way, through `find_tools`.
    await reveal(session, 'project');
  });

  afterEach(async () => {
    await session.close();
  });

  it('writes a kit into the served project and says what arrived', async () => {
    const result = await call<CreateNodeKitResponse>(session, 'create_node_kit', { name: 'Weather Kit' });

    expect(result.isError).toBe(false);
    expect(result.data.kit).toBe('weather-kit');
    expect(result.data.nodeType).toBe('weather-kit.StatTile');
    expect(result.data.written).toEqual([
      'noodl_modules/weather-kit/manifest.json',
      'noodl_modules/weather-kit/index.js',
      'noodl_modules/weather-kit/README.md',
      'noodl_modules/weather-kit/types/node-kit.d.ts'
    ]);

    // Every path it claims to have written exists, in the project it serves.
    for (const rel of result.data.written) {
      expect({ rel, exists: fs.existsSync(path.join(session.projectDir, ...rel.split('/'))) }).toEqual({
        rel,
        exists: true
      });
    }

    // The one thing a caller cannot work out: files are not yet a node.
    expect(result.data.next).toContain('Reload the preview');
  });

  it('🔴 the node actually arrives in the catalog, extracted from the real kit', async () => {
    // AC6's real assertion. `list_node_types` goes through CN-003's headless
    // extractor, which *executes* the scaffolded index.js in a DOM shim and
    // reads the live register — so this is the generated kit running, not its
    // source being parsed.
    await call<CreateNodeKitResponse>(session, 'create_node_kit', { name: 'Weather Kit' });

    const fetched = await call<unknown>(session, 'get_node_type', { type_names: ['weather-kit.StatTile'] });
    expect(fetched.isError).toBe(false);
    const doc = JSON.stringify(fetched.data);
    expect(doc).toContain('Stat Tile');
    // The ports the README documents are the ports the catalog now knows about.
    for (const port of ['label', 'value', 'highlighted', 'backgroundColor', 'borderRadius', 'onClick']) {
      expect({ port, known: doc.includes(port) }).toEqual({ port, known: true });
    }
  });

  it('AC4 — the generated kit passes the project validator clean', async () => {
    // "A scaffold that emits a kit our own validator complains about is not
    // shippable." ✅ D4 means a kit-declared type is now fully checked rather
    // than skipped, so this is a real pass rather than a silent one.
    const before = await call<{ summary?: Record<string, number> }>(session, 'validate_project', {});
    const created = await call<CreateNodeKitResponse>(session, 'create_node_kit', { name: 'Weather Kit' });
    const after = await call<{ summary?: Record<string, number> }>(session, 'validate_project', {});

    // 🔴 This line is here because its absence produced a **green AC4 with no
    // kit in the project**. The tool was deferred, every call returned "Tool
    // create_node_kit disabled", and "the validator reports the same summary
    // before and after" was trivially true — a failure indistinguishable from a
    // missing mechanism. Assert the mechanism ran before grading its effect.
    expect(created.isError).toBe(false);
    expect(exists(session.projectDir, 'noodl_modules/weather-kit/index.js')).toBe(true);

    // Two-sided against the *same project before the kit*: asserting "zero
    // errors" alone would pass on a fixture that already had none and a kit
    // that added ten, if the validator could not see the kit at all — which is
    // exactly the state CN-002 found and CN-003 fixed.
    expect(after.isError).toBe(false);
    expect(JSON.stringify(after.data)).not.toContain('weather-kit');
    expect(after.data.summary).toEqual(before.data.summary);
  });

  it('AC5 — a second scaffold of the same name refuses', async () => {
    expect((await call(session, 'create_node_kit', { name: 'Weather Kit' })).isError).toBe(false);

    const second = await call<ToolErrorPayload>(session, 'create_node_kit', { name: 'Weather Kit' });
    expect(second.isError).toBe(true);
    expect(second.data.error.code).toBe('invalid-argument');
    expect(second.data.error.message).toContain('will not overwrite');
  });

  it('a name that is really a path is refused before anything is written', async () => {
    const result = await call<ToolErrorPayload>(session, 'create_node_kit', { name: '../../escape' });
    expect(result.isError).toBe(true);
    expect(fs.existsSync(path.join(session.projectDir, 'noodl_modules', 'escape'))).toBe(false);
  });

  it('the types copy it writes is the published one', async () => {
    await call<CreateNodeKitResponse>(session, 'create_node_kit', { name: 'Weather Kit' });
    const copy = fs.readFileSync(
      path.join(session.projectDir, 'noodl_modules', 'weather-kit', 'types', 'node-kit.d.ts'),
      'utf8'
    );
    expect(typesCopyStatus(copy).current).toBe(true);
  });
});

describe('CN-006 — the discovery door the placement depends on', () => {
  let session: TestSession;

  beforeEach(async () => {
    session = await connect(copyFixture());
  });

  afterEach(async () => {
    await session.close();
  });

  it('find_tools reveals it by name, from a query a model would actually type', async () => {
    // The tool is deferred and its group's purpose says nothing about kits, so
    // this query is the whole path to it. Three spellings, because the point is
    // that a model does not have to guess the tool's exact name.
    for (const query of ['kit', 'node_kit', 'create_node_kit']) {
      const s = await connect(copyFixture());
      try {
        const found = await call<FindToolsResponse>(s, 'find_tools', { query });
        expect({ query, revealed: found.data.revealed.includes('create_node_kit') }).toEqual({ query, revealed: true });
      } finally {
        await s.close();
      }
    }
  });

  it('and revealing its group reveals it too', async () => {
    const found = await call<FindToolsResponse>(session, 'find_tools', { group: 'project' });
    expect(found.data.revealed).toContain('create_node_kit');
  });

  it('⚠️ CONTROL — a query about what it DOES does not find it', async () => {
    // The cost of the placement, asserted rather than described. `find_tools`
    // matches names only, and `project`'s purpose line does not say "kit" — so
    // a model searching by subject comes away empty. This test exists to fail
    // the day somebody widens the purpose line, so the trade-off is re-decided
    // deliberately (and priced against CN-009's share of the 57 tokens) rather
    // than drifting.
    const found = await call<FindToolsResponse>(session, 'find_tools', { query: 'custom node' });
    expect(found.data.revealed).toEqual([]);
  });
});
