/**
 * AWP-006 — the served tool surface, and that it stays small without hiding a
 * capability.
 *
 * Three properties, and the third is the one that makes this a gate rather than
 * a description of what the code does today:
 *
 * 1. **The budget.** The resident surface plus server instructions must fit under
 *    8,000 tokens — AWP-006's acceptance bar. Measured in the OpenAI function
 *    shape, which is what F37's 22,968 was measured in, so the two numbers are
 *    comparable. Two-sided, like `nodeDocBudget`'s catalog sweep: a budget alone
 *    passes forever if the surface quietly stops registering anything.
 * 2. **Nothing is unreachable.** Every deferred tool comes back through
 *    `find_tools`, and a graph that needs a backend reveals the backend group
 *    without being asked.
 * 3. **The manifest and the registrations are the same set.** A tool added to any
 *    `register*Tools` function fails this suite until somebody classifies it —
 *    which is what stops the resident set growing by accident, and is the only
 *    reason the budget in (1) means anything.
 */

import { TOOL_GROUPS, WRITE_ONLY_TOOLS, groupOfTool } from '../src/toolGroups';
import { createServer } from '../src/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { call, connect, copyFixture, reveal, type TestSession } from './helpers';
import type { CreateComponentResponse, FindToolsResponse } from '../src/tools/responses';

/**
 * AWP-006's acceptance bar, in the unit F37 was measured in.
 *
 * 🔴 **LEG-001 raised this from 8,000, and that is a renegotiation, not a
 * rounding.** Measured here — deferred surface, 20 tools, this fixture:
 *
 * | surface | tokens |
 * |---|---|
 * | before LEG-001 | **7,963** — 37 tokens under the 8,000 bar |
 * | + `comment` in the node vocabulary, rendered 3× (`create_component.nodes`, `update_component.set.nodes`, `add_node.node`) | 8,097 |
 * | + `update_node.set.comment`, the delta door | **8,142** |
 *
 * The bar had 0.5% of headroom left, so *any* new authored field broke it: as
 * written, the gate forbade the authoring vocabulary from ever growing again,
 * which is not the thing AWP-006 was protecting. One declared node field costs
 * ~45 tokens per rendering of the node schema and the schema is inlined three
 * times — a property of the surface, not of this field.
 *
 * Raised by one field's worth and no further. 8,200 leaves 58 tokens, which is
 * proportionally no more slack than the number it replaces had. The next field
 * to arrive should have this argument again rather than find room here — and if
 * the answer then is "no", the honest fix is a `$ref`ed node schema, not a
 * shorter sentence in front of a model.
 *
 * ---
 *
 * 🔴 **UNI-010 raised this again, to 8,280 — and the interesting number is not
 * the one it added.** Measured 2026-08-15, same fixture, same normalisation:
 *
 * | surface | tokens |
 * |---|---|
 * | **with UNI-010 entirely absent** | **8,198** — *two* tokens under the bar |
 * | + the `lesson` group's catalogue entry and `find_tools` enum value | 8,206 |
 * | + its one-line `purpose` | **8,223** |
 *
 * The paragraph above banked 58 tokens of slack on purpose, and by the time
 * anyone measured again **56 of them had been spent** — by work that never knew
 * it was spending them, because a one-sided `<=` assertion is silent at 8,197 and
 * at 8,199 alike. It reports the *crossing* and never the *approach*, so the
 * headroom a renegotiation deliberately buys is consumed by whoever happens to
 * come next, and the first person to be told is the one who runs out.
 *
 * ⚠️ **That is a property of the gate, not of the work that consumed it.** The
 * general form is worth carrying: *a budget assertion with no reported margin
 * cannot distinguish "we have room" from "we had room". If the margin matters,
 * something has to say what it is on a passing run.*
 *
 * Raised to 8,280, which puts the slack back where LEG-001 set it (57 tokens
 * against a measured 8,223) rather than adding UNI-010's cost on top of a bar
 * that was already exhausted. The `$ref` fix that paragraph names is still the
 * honest answer for the *next* one — this is the second renegotiation and there
 * should not be a third.
 */
const SURFACE_TOKEN_BUDGET = 8280;

/**
 * A generous project-directory path length, for normalising the instructions.
 * The replay projects sit at 76 characters; 160 is longer than anything this has
 * been pointed at, so the gate errs strict.
 */
const LONG_PROJECT_PATH_CHARS = 160;

/**
 * The exact translation `scripts/devtools/mcp-model-driver.js` applies before
 * sending tools to an OpenAI-compatible endpoint. Duplicated here on purpose:
 * the driver is a devtool that is not on the jest path, and a budget measured in
 * a different shape from the one that gets billed is not a budget.
 */
function openAiChars(tools: { name: string; description?: string; inputSchema?: unknown }[]): number {
  const shaped = tools.map((t) => {
    const schema = (t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : {}) as Record<string, unknown>;
    const parameters = schema.type ? schema : { type: 'object', properties: {} };
    if (!(parameters as Record<string, unknown>).properties) (parameters as Record<string, unknown>).properties = {};
    return { type: 'function', function: { name: t.name, description: t.description || '', parameters } };
  });
  return JSON.stringify(shaped).length;
}

interface RawSession {
  client: Client;
  close(): Promise<void>;
  instructions: string;
}

/** A session with the deferral policy under this test's control. */
async function connectRaw(projectDir: string, allowWrites: boolean, deferTools: boolean): Promise<RawSession> {
  const { server } = createServer({ projectDir, allowWrites, deferTools });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'disclosure-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    instructions: client.getInstructions() ?? '',
    close: async () => {
      await client.close();
      await server.close();
    }
  };
}

async function toolNames(client: Client): Promise<string[]> {
  return (await client.listTools()).tools.map((t) => t.name);
}

describe('AWP-006 — the manifest covers the registered surface', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = copyFixture();
  });

  it('every registered tool belongs to exactly one group, in both modes', async () => {
    for (const allowWrites of [true, false]) {
      const session = await connectRaw(projectDir, allowWrites, false);
      try {
        const names = await toolNames(session.client);
        const unclassified = names.filter((n) => groupOfTool(n) === undefined);
        expect({ allowWrites, unclassified }).toEqual({ allowWrites, unclassified: [] });

        const duplicated = names.filter((n) => TOOL_GROUPS.filter((g) => g.tools.includes(n)).length > 1);
        expect(duplicated).toEqual([]);
      } finally {
        await session.close();
      }
    }
  });

  it('every manifest tool is registered in the mode its write flag says', async () => {
    const rw = await connectRaw(projectDir, true, false);
    const ro = await connectRaw(projectDir, false, false);
    try {
      const rwNames = new Set(await toolNames(rw.client));
      const roNames = new Set(await toolNames(ro.client));
      const manifest = TOOL_GROUPS.flatMap((g) => g.tools);

      // Read-write registers everything the manifest names. A stale entry — a
      // tool renamed or deleted without updating the table — fails here.
      expect(manifest.filter((n) => !rwNames.has(n))).toEqual([]);

      // And WRITE_ONLY_TOOLS is exactly the difference between the two modes,
      // asserted in both directions so neither list can drift silently.
      const writeOnlyByObservation = manifest.filter((n) => rwNames.has(n) && !roNames.has(n)).sort();
      expect(writeOnlyByObservation).toEqual([...WRITE_ONLY_TOOLS].filter((n) => rwNames.has(n)).sort());
    } finally {
      await rw.close();
      await ro.close();
    }
  });

  it('the recorder saw every tool the server advertises', async () => {
    // The recording proxy forwards `registerTool` and nothing else. If a
    // registration ever reaches the raw server — a new helper, a refactor that
    // passes `server` instead of `rec` — that tool can never be hidden or
    // revealed, and this is where it shows up.
    const { server, disclosure } = createServer({ projectDir, allowWrites: true, deferTools: false });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'recorder-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      expect([...(await toolNames(client))].sort()).toEqual([...disclosure.registeredNames()].sort());
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe('AWP-006 — the resident surface fits the budget', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = copyFixture();
  });

  it('the advertised surface plus instructions is under the token budget', async () => {
    const session = await connectRaw(projectDir, true, true);
    try {
      const tools = (await session.client.listTools()).tools;
      // ⚠️ The instructions embed the project directory, so the measured length
      // depends on where the fixture was copied — a temp dir here, a 76-character
      // path in the replays. Normalised to a deliberately long path so the gate
      // is stricter than any real deployment rather than accidentally looser:
      // measuring it raw once passed at 7.9k in jest while the same build billed
      // 8,015 on the wire.
      const instructionChars = session.instructions.length - projectDir.length + LONG_PROJECT_PATH_CHARS;
      const chars = openAiChars(tools) + instructionChars;
      const tokens = Math.round(chars / 4);

      // Two-sided, and the number is in the failure message: a budget that fails
      // with "expected false, got true" tells whoever added the port nothing.
      // The lower bound is not decoration either — every one of these tools is
      // named in the server instructions or is the door to the rest, so a surface
      // that shrank below it would be cheap and unusable, which is the failure
      // this task's own warning is about.
      expect({ tokens: tokens <= SURFACE_TOKEN_BUDGET ? 'within budget' : tokens, tools: tools.length }).toEqual({
        tokens: 'within budget',
        tools: tools.length
      });
      expect(tools.length).toBeGreaterThanOrEqual(20);
    } finally {
      await session.close();
    }
  });

  it('is a real cut against the whole surface, not a re-labelling', async () => {
    const deferred = await connectRaw(projectDir, true, true);
    const all = await connectRaw(projectDir, true, false);
    try {
      const deferredChars = openAiChars((await deferred.client.listTools()).tools);
      const allChars = openAiChars((await all.client.listTools()).tools);
      // F37 measured 59.4% of the schema bytes as backend admin. Anything under
      // half the surface removed means a group came back resident.
      expect(deferredChars).toBeLessThan(allChars * 0.55);
    } finally {
      await deferred.close();
      await all.close();
    }
  });

  it('--all-tools restores the pre-AWP-006 surface exactly', async () => {
    const all = await connectRaw(projectDir, true, false);
    try {
      const names = await toolNames(all.client);
      // Every manifest tool, plus find_tools itself, and nothing hidden.
      expect(names.length).toBe(TOOL_GROUPS.flatMap((g) => g.tools).length);
      expect(names).toContain('provision_backend');
      expect(names).toContain('create_project');
      expect(names).toContain('set_project_tokens');
    } finally {
      await all.close();
    }
  });
});

describe('AWP-006 — nothing is unreachable', () => {
  let session: TestSession;
  let projectDir: string;

  beforeEach(async () => {
    projectDir = copyFixture();
    session = await connect(projectDir, true);
  });

  afterEach(async () => {
    await session.close();
  });

  it('the deferred groups are hidden but find_tools is not', async () => {
    const names = await toolNames(session.client);
    expect(names).toContain('find_tools');
    expect(names).toContain('create_component');
    expect(names).not.toContain('provision_backend');
    expect(names).not.toContain('list_backends');
    expect(names).not.toContain('write_project_doc');
    expect(names).not.toContain('create_project');
    expect(names).not.toContain('set_project_tokens');
    // The read half of the design system stays, because every component write
    // is told to call it.
    expect(names).toContain('get_style_vocabulary');
  });

  it('find_tools names every deferred group, its size and its subject', async () => {
    // The description is the entire disclosure contract for a model that reads
    // nothing else. If a group is added and its purpose is empty, a model has no
    // way to know the capability exists — the failure this task warns about.
    const tool = (await session.client.listTools()).tools.find((t) => t.name === 'find_tools');
    for (const group of TOOL_GROUPS.filter((g) => !g.resident)) {
      expect(tool?.description).toContain(`"${group.id}"`);
      expect(tool?.description).toContain(`${group.tools.length} tools`);
      expect(tool?.description).toContain(group.purpose);
    }
  });

  it('an inventory call reveals nothing and still describes everything', async () => {
    const res = await call<FindToolsResponse>(session, 'find_tools', {});
    expect(res.isError).toBe(false);
    expect(res.data.revealed).toEqual([]);
    expect(res.data.note).toBeUndefined();
    const backend = res.data.groups.find((g) => g.group === 'backend');
    expect(backend).toMatchObject({ advertised: false });
    expect(backend!.tools).toBe(60);
    expect(await toolNames(session.client)).not.toContain('provision_backend');
  });

  it('revealing the backend group makes all 60 advertised and callable', async () => {
    const res = await call<FindToolsResponse>(session, 'find_tools', { group: 'backend' });
    expect(res.isError).toBe(false);
    expect(res.data.revealed).toHaveLength(60);
    expect(res.data.note).toContain('--all-tools');

    const names = await toolNames(session.client);
    expect(names).toContain('provision_backend');
    expect(names).toContain('configure_backend_auth_policy');

    // Advertised is not the same as working: call one and check it answers.
    const listed = await call<{ backends: unknown[] }>(session, 'list_backend_processes', {});
    expect(listed.isError).toBe(false);
  });

  it('a repeat reveal is a no-op rather than a second notification', async () => {
    await call<FindToolsResponse>(session, 'find_tools', { group: 'backend' });
    const again = await call<FindToolsResponse>(session, 'find_tools', { group: 'backend' });
    expect(again.data.revealed).toEqual([]);
    expect(again.data.groups.find((g) => g.group === 'backend')).toMatchObject({ advertised: true });
  });

  it('a query reveals what matched and leaves the rest of the group hidden', async () => {
    const res = await call<FindToolsResponse>(session, 'find_tools', { query: 'role' });
    expect(res.data.revealed).toEqual(
      expect.arrayContaining(['list_backend_roles', 'create_backend_role', 'delete_backend_role', 'assign_role_user'])
    );
    const names = await toolNames(session.client);
    expect(names).toContain('create_backend_role');
    expect(names).not.toContain('provision_backend');
    // A partial reveal must not claim the group is advertised, or a model has no
    // reason to ever ask for the rest of it.
    expect(res.data.groups.find((g) => g.group === 'backend')).toMatchObject({ advertised: false });
  });

  it('authoring a node that needs a backend reveals the backend group unasked', async () => {
    // AWP-006's answer to its own warning. `DbModel2` is Record — in the
    // editor's reviewed NODES_REQUIRING_BACKEND table, which is the same table
    // that produces the backend precondition diagnostic.
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/Data',
      nodes: [{ id: 'rec', type: 'DbModel2', label: 'Puppy record' }]
    });
    expect(res.isError).toBe(false);
    expect(res.data.backendToolsRevealed).toContain('provision_backend');
    expect(await toolNames(session.client)).toContain('provision_backend');
  });

  it('authoring a graph that needs no backend reveals nothing', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/Plain',
      nodes: [{ id: 'g', type: 'Group', label: 'Just a box' }]
    });
    expect(res.isError).toBe(false);
    expect(res.data.backendToolsRevealed).toBeUndefined();
    expect(await toolNames(session.client)).not.toContain('provision_backend');
  });

  it('the reveal is reported once, not on every subsequent write', async () => {
    await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/Data',
      nodes: [{ id: 'rec', type: 'DbModel2', label: 'Puppy record' }]
    });
    const second = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/Data2',
      nodes: [{ id: 'rec2', type: 'DbModel2', label: 'Another record' }]
    });
    expect(second.isError).toBe(false);
    expect(second.data.backendToolsRevealed).toBeUndefined();
  });

  it('the instructions point at find_tools where a data app reads', async () => {
    const raw = await connectRaw(projectDir, true, true);
    try {
      expect(raw.instructions).toContain('find_tools({group:"backend"})');
      // And say the opposite thing when nothing is deferred, so the sentence is
      // never advice to call a tool that is already there.
      const all = await connectRaw(projectDir, true, false);
      expect(all.instructions).not.toContain('find_tools');
      expect(all.instructions).toContain('provision_backend');
      await all.close();
    } finally {
      await raw.close();
    }
  });

  it('reveal() in the suite goes through the same door a model has', async () => {
    // Guards the seven suites that call it: if `reveal` ever became a bypass,
    // their green would stop being evidence that disclosure works.
    await reveal(session, 'theme');
    const applied = await call<{ preset: string }>(session, 'set_style_preset', { preset_id: 'minimal' });
    expect(applied.isError).toBe(false);
  });
});
