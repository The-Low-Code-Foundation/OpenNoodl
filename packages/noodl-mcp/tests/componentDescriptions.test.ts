/**
 * LEG-006 §4 — `list_components` and the description column.
 *
 * Two properties, and a measurement that is part of the acceptance rather than
 * a footnote to it.
 *
 * **The properties.** The row carries the component's own sentence, cut at a
 * stated ceiling, and the tool's own description says the column is there — a
 * field a model is not told about is a field a model does not read. The full
 * text stays available on `get_component`, so the ceiling costs nothing but a
 * second call in the rare case the first 160 characters were not enough.
 *
 * **The measurement.** AWP-005 spent a session cutting the MCP surface from
 * 25,886 tokens/turn to 7,828 and `get_node_type` on `Group` still costs 11k, so
 * a per-row string on every listing is real spend and the spec says to measure
 * it on the wire, pretty-printed, on a project with at least 20 components. The
 * `wire cost` spec below does exactly that and prints the number. It is printed
 * rather than asserted against a threshold: a budget assertion here would be a
 * number invented in this file, and the register wants a measurement.
 *
 * ⚠️ The corpus is real. `fixtures/real-descriptions.corpus.json` is every
 * component `description` found in the 35 v2 projects under "NodeGX test
 * projects/" on 2026-08-11, extracted verbatim — 72 of them, mean 99
 * characters, max 274. Measuring against invented descriptions would answer a
 * question nobody asked; these are what models actually write.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { call, callRawText, connect, type TestSession } from './helpers';
import { LIST_COMPONENTS_DESCRIPTION_CHARS } from '../src/tools/read';
import type { ComponentListRow } from '../src/project/ProjectStore';
import type { GetComponentResponse, ListComponentsResponse } from '../src/tools/responses';

/* eslint-disable @typescript-eslint/no-var-requires */
const corpus = require('./fixtures/real-descriptions.corpus.json') as {
  descriptions: Array<{ project: string; path: string; description: string }>;
};
/* eslint-enable @typescript-eslint/no-var-requires */

/** ≥20 is the spec's floor; 24 keeps a margin and stays quick to build. */
const COMPONENT_COUNT = 24;

/**
 * Builds a v2 project of `count` components on disk. Every component gets the
 * same two-node graph — the graph is not what is being measured — and the
 * descriptions come from the real corpus in order, so the length distribution
 * of the measurement is the distribution of real agent output.
 *
 * Two components are deliberately left description-less: the row for a
 * component without one must not gain the key.
 */
function buildProject(
  count: number,
  pick: (index: number) => string = (i) => corpus.descriptions[i % corpus.descriptions.length].description
): { dir: string; rows: Array<{ key: string; description?: string }> } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leg006-'));
  fs.mkdirSync(path.join(dir, 'components'), { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'nodegx.project.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/project-v2.json',
        name: 'LEG-006 measurement project',
        id: 'leg006-0001',
        version: '4',
        nodegxVersion: '1.1.0',
        structure: { componentsDir: 'components', assetsDir: 'assets' }
      },
      null,
      2
    )
  );

  const registry: Record<string, unknown> = {};
  const rows: Array<{ key: string; description?: string }> = [];

  for (let i = 0; i < count; i++) {
    const key = `Components/Comp${String(i).padStart(2, '0')}`;
    const id = `c_${i}`;
    // The last two are the "no description" control.
    const description = i < count - 2 ? pick(i) : undefined;
    const compDir = path.join(dir, 'components', 'Components', `Comp${String(i).padStart(2, '0')}`);
    fs.mkdirSync(compDir, { recursive: true });

    fs.writeFileSync(
      path.join(compDir, 'component.json'),
      JSON.stringify(
        {
          $schema: 'https://opennoodl.dev/schemas/component-v2.json',
          id,
          name: `Comp${String(i).padStart(2, '0')}`,
          path: `/${key}`,
          type: 'visual',
          created: '2026-08-01T00:00:00.000Z',
          modified: '2026-08-01T00:00:00.000Z',
          modifiedBy: 'noodl-mcp',
          ...(description ? { description } : {})
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(compDir, 'nodes.json'),
      JSON.stringify(
        {
          $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
          componentId: id,
          version: 1,
          nodes: [
            { id: `${id}_root`, type: 'Group', label: 'Root', children: [`${id}_text`] },
            { id: `${id}_text`, type: 'Text', label: 'Body', parent: `${id}_root`, parameters: { text: 'hi' } }
          ],
          visualRoots: [`${id}_root`]
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(compDir, 'connections.json'),
      JSON.stringify(
        { $schema: 'https://opennoodl.dev/schemas/connections-v2.json', componentId: id, version: 1, connections: [] },
        null,
        2
      )
    );

    registry[key] = { path: key, type: 'visual', nodeCount: 2, connectionCount: 0 };
    rows.push({ key, description });
  }

  fs.writeFileSync(
    path.join(dir, 'components', '_registry.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
        version: 1,
        components: registry,
        stats: { totalComponents: count, totalNodes: count * 2, totalConnections: 0 }
      },
      null,
      2
    )
  );

  return { dir, rows };
}

describe('LEG-006 — list_components carries the description', () => {
  let session: TestSession;
  let built: ReturnType<typeof buildProject>;

  beforeAll(async () => {
    built = buildProject(COMPONENT_COUNT);
    session = await connect(built.dir, false);
  });

  afterAll(async () => {
    await session.close();
    fs.rmSync(built.dir, { recursive: true, force: true });
  });

  it('returns a description on the rows that have one, and no key on the rows that do not', async () => {
    const res = await call<ListComponentsResponse>(session, 'list_components');
    expect(res.isError).toBe(false);
    expect(res.data.components.length).toBe(COMPONENT_COUNT);

    const byPath = new Map(res.data.components.map((r) => [r.path, r]));
    for (const source of built.rows) {
      const row = byPath.get(source.key) as ComponentListRow;
      expect(row).toBeDefined();
      if (source.description) {
        expect(typeof row.description).toBe('string');
      } else {
        // Not "empty string" — absent. An agent must be able to tell "nobody
        // said" from "somebody said nothing".
        expect('description' in row).toBe(false);
      }
    }
  });

  it('cuts every description at the stated ceiling, marking the cut', async () => {
    const res = await call<ListComponentsResponse>(session, 'list_components');
    const byPath = new Map(res.data.components.map((r) => [r.path, r]));

    let sawTruncated = false;
    let sawWhole = false;

    for (const source of built.rows) {
      if (!source.description) continue;
      const row = byPath.get(source.key) as ComponentListRow;
      expect(row.description!.length).toBeLessThanOrEqual(LIST_COMPONENTS_DESCRIPTION_CHARS);

      if (source.description.length > LIST_COMPONENTS_DESCRIPTION_CHARS) {
        sawTruncated = true;
        // The ellipsis is inside the ceiling, so the ceiling is a real bound.
        expect(row.description!.endsWith('…')).toBe(true);
        expect(row.description!.length).toBeLessThanOrEqual(LIST_COMPONENTS_DESCRIPTION_CHARS);
        expect(source.description.startsWith(row.description!.slice(0, -1).trimEnd())).toBe(true);
      } else {
        sawWhole = true;
        expect(row.description).toBe(source.description);
      }
    }

    // The corpus must actually exercise both branches, or this spec is asserting
    // a ceiling it never reached.
    expect(sawTruncated).toBe(true);
    expect(sawWhole).toBe(true);
  });

  it('names the column, and the ceiling, in the tool description a model reads', async () => {
    const tools = await session.client.listTools();
    const tool = tools.tools.find((t) => t.name === 'list_components');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain('description');
    expect(tool!.description).toContain(String(LIST_COMPONENTS_DESCRIPTION_CHARS));
  });

  it('get_component still returns the description in full', async () => {
    const truncatedSource = built.rows.find(
      (r) => r.description && r.description.length > LIST_COMPONENTS_DESCRIPTION_CHARS
    );
    expect(truncatedSource).toBeDefined();

    const res = await call<GetComponentResponse>(session, 'get_component', { path: truncatedSource!.key });
    expect(res.isError).toBe(false);
    expect(res.data.description).toBe(truncatedSource!.description);
  });

  it('wire cost: measured pretty-printed, on a 24-component project', async () => {
    const typical = await measureWireCost(session, built, 'the first 22 of the real corpus, in order (mean 84 chars, 2 over the ceiling)');

    // A second project of the same size built from the 22 LONGEST real
    // descriptions. The first arm says what the column costs today; this one
    // says what the ceiling is for, and without it the ceiling looks like a
    // rule that saves 127 characters.
    const longest = [...corpus.descriptions].sort((a, b) => b.description.length - a.description.length);
    const worst = buildProject(COMPONENT_COUNT, (i) => longest[i % longest.length].description);
    const worstSession = await connect(worst.dir, false);
    try {
      await measureWireCost(worstSession, worst, 'the 22 longest real descriptions (mean 164 chars, 11 over the ceiling)');
    } finally {
      await worstSession.close();
      fs.rmSync(worst.dir, { recursive: true, force: true });
    }

    expect(typical.after).toBeGreaterThan(typical.withoutColumn);
    expect(typical.after).toBeLessThanOrEqual(typical.untruncated);
  });
});

/**
 * Measures one project three ways and prints the row. Everything is
 * pretty-printed with two-space indent because that is literally what
 * `jsonResult` puts on the wire (`tools/util.ts`) — measuring the object
 * under-reports by roughly the whitespace, which is not a rounding error.
 */
async function measureWireCost(
  session: TestSession,
  built: { rows: Array<{ key: string; description?: string }> },
  label: string
): Promise<{ withoutColumn: number; untruncated: number; after: number }> {
  // The real response, off the real transport, exactly as a client is billed.
  const afterText = await callRawText(session, 'list_components');

  // The two counterfactuals, built from the same rows so the ONLY difference is
  // the description text: the column absent entirely (the state LEG-006's spec
  // assumed) and the column present but uncut (the state at HEAD, since
  // `ProjectStore.listComponents` has returned `description` since SUB-008).
  const parsed = JSON.parse(afterText) as ListComponentsResponse;
  const withoutColumnText = JSON.stringify(
    {
      components: parsed.components.map((row) => {
        const { description: _d, ...rest } = row;
        return rest;
      })
    },
    null,
    2
  );
  const untruncatedText = JSON.stringify(
    {
      components: parsed.components.map((row) => {
        const source = built.rows.find((r) => r.key === row.path);
        return source?.description ? { ...row, description: source.description } : row;
      })
    },
    null,
    2
  );

  const base = withoutColumnText.length;
  const pct = (n: number) => `${((n / base - 1) * 100).toFixed(1)}%`;
  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      `LEG-006 wire cost — list_components, ${built.rows.length} components ` +
        `(${built.rows.filter((r) => r.description).length} described) — ${label}:`,
      `  no description column : ${base} chars`,
      `  uncut description     : ${untruncatedText.length} chars  (+${untruncatedText.length - base}, ${pct(untruncatedText.length)})`,
      `  cut at ${LIST_COMPONENTS_DESCRIPTION_CHARS} chars      : ${afterText.length} chars  (+${afterText.length - base}, ${pct(afterText.length)})`,
      `  ceiling saves         : ${untruncatedText.length - afterText.length} chars vs uncut`,
      ''
    ].join('\n')
  );

  return { withoutColumn: base, untruncated: untruncatedText.length, after: afterText.length };
}
