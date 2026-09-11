/**
 * CMP-006 — the authored patterns and anti-patterns reach the agent.
 *
 * ## The defect, re-derived from the code on 2026-09-11
 *
 * `catalog.ts`'s `getNodeTypeDetail` copied `summary`, `description`,
 * `whenToUse`, `runtimeBehavior`, `relatedNodes` and `dynamicPorts` out of the
 * enrichment and stopped. `NodeEnrichment` did not even *declare*
 * `antiPatterns`, which is why nothing could have copied it. So both fields
 * reached exactly one reader — the EDITOR's node-docs panel
 * (`noodl-editor/src/editor/src/utils/nodeDocs.ts:161`, "Watch out for"), which
 * is a person — and every anti-pattern authored for an agent was invisible to
 * the agent doing the authoring. Measured on the shipped corpus: of 176 types,
 * **130 carry `patterns`** (259 entries) and **113 carry `antiPatterns`** (203
 * entries). Filed as phase 85 README §7, owner NONE.
 *
 * ## Why these assertions read the corpus to build their own expectations
 *
 * The sibling spec in `phase85Doctrine.test.ts` reads the enriched JSON *instead
 * of* the response, and says in its own comment that it must not be quietly
 * "fixed" by repointing it at a tool call. That instruction is kept: it is
 * untouched, and this file is the over-the-wire twin rather than a rewrite of
 * it.
 *
 * The expected values here are **derived from the artefact**, not written as
 * literals. A spec that hard-codes the prose it expects passes when the wire is
 * right and also when the wire is right *for a stale corpus*; comparing the
 * response to the corpus arrays grades the copy itself, which is the thing that
 * was broken. Exact per-field counts are deliberately NOT pinned — the phase's
 * AC2 gate had its literal move twice in two sessions — so coverage is asserted
 * as a floor and equality is asserted per type.
 *
 * ## 🔴 The negative assertion is asserting a DECISION, not an oversight
 *
 * `detail: "summary"` is the default and MUST NOT carry these fields. That is a
 * measured trade, not a gap: `getNodeTypeSummary`'s cheapness is AWP-005 §2's
 * contract, and `antiPatterns` alone is a median **36%** of a summary payload
 * and up to **151%** of one on a small logic node (`noodl.cloud.request`: 528
 * chars of anti-pattern against ~349 of summary). A later session may overturn
 * that with a replay measurement — if it does, it should change this assertion
 * on purpose and say what it measured, which is exactly why the assertion is
 * here rather than absent.
 */
import * as fs from 'fs';
import * as path from 'path';

import { call, connect, copyFixture, type TestSession } from './helpers';

interface NodeTypeRow {
  typeName: string;
  patterns?: string[];
  antiPatterns?: string[];
  ports?: string[];
}

interface GetNodeTypeResult {
  types: NodeTypeRow[];
}

interface CorpusNode {
  typeName: string;
  enrichment?: { patterns?: string[]; antiPatterns?: string[] };
}

const ENRICHED = path.resolve(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog-enriched.json');

let session: TestSession;
let corpus: Map<string, CorpusNode['enrichment']>;

beforeAll(async () => {
  session = await connect(copyFixture(), true);
  const parsed = JSON.parse(fs.readFileSync(ENRICHED, 'utf8')) as { nodes: CorpusNode[] };
  corpus = new Map(parsed.nodes.map((n) => [n.typeName, n.enrichment]));
});

afterAll(async () => {
  await session.close();
});

/** The types sampled over the wire: spread across categories, and each one authored with both fields. */
const SAMPLE = ['States', 'Group', 'DbCollection2', 'net.noodl.WebSocket', 'For Each'] as const;

describe('CMP-006 — full detail carries the authored patterns and anti-patterns', () => {
  it('🔴 the corpus that is supposed to be relayed is not empty — the arming check', () => {
    // absence is only evidence beside a known-firing signal: if the corpus lost
    // these fields, every assertion below would pass on nothing.
    const withPatterns = [...corpus.values()].filter((e) => (e?.patterns ?? []).length > 0).length;
    const withAnti = [...corpus.values()].filter((e) => (e?.antiPatterns ?? []).length > 0).length;
    expect(withPatterns).toBeGreaterThanOrEqual(100);
    expect(withAnti).toBeGreaterThanOrEqual(90);

    for (const type of SAMPLE) {
      const e = corpus.get(type);
      expect((e?.patterns ?? []).length).toBeGreaterThan(0);
      expect((e?.antiPatterns ?? []).length).toBeGreaterThan(0);
    }
  });

  it('🔴 detail:"full" relays both arrays VERBATIM, for every sampled type', async () => {
    // ONE TYPE PER CALL, deliberately. The five sampled types are ~100 KB of
    // full detail against `catalogTools.ts`'s 60 KB byte budget (DEBT-009),
    // which degrades the tail to SUMMARIES in-band — and a summary carries
    // neither field by design, so a single batched call would have failed on
    // its own construction and looked like a broken relay. Measured: `Group`
    // alone is ~47.8 KB.
    for (const type of SAMPLE) {
      const { isError, data } = await call<GetNodeTypeResult>(session, 'get_node_type', {
        type_names: [type],
        detail: 'full'
      });
      expect(isError).toBe(false);
      expect(data.types).toHaveLength(1);
      // No in-band degradation happened, so this row really is full detail.
      expect((data as { summarized?: string[] }).summarized).toBeUndefined();

      const row = data.types[0];
      expect(row.typeName).toBe(type);
      const expected = corpus.get(type)!;
      // Derived, not written: the wire must equal the artefact.
      expect(row.patterns).toEqual(expected.patterns);
      expect(row.antiPatterns).toEqual(expected.antiPatterns);
    }
  });

  it('🔴 the variant selector and its anti-pattern are on the WIRE, not only in the file', async () => {
    // The one content assertion, and the reason the field was worth emitting:
    // CMP-001 AC1's pattern is the one-wire variant selector, and the shape a
    // model produced BECAUSE the input was undocumented is named beside it. If
    // the relay is ever narrowed to "patterns only", this reds and the equality
    // test above does not say which half went missing.
    const { data } = await call<GetNodeTypeResult>(session, 'get_node_type', {
      type_names: ['States'],
      detail: 'full'
    });
    const states = data.types.find((t) => t.typeName === 'States')!;

    const patterns = (states.patterns ?? []).join('\n');
    const antiPatterns = (states.antiPatterns ?? []).join('\n');

    expect(patterns).toMatch(/`Component Inputs\.<enum>` → `States\.currentState`/);
    // Citations, so an agent can check the pattern against a real graph.
    expect(patterns).toContain('toast');
    expect(patterns).toContain('xano');
    expect(antiPatterns).toMatch(/One signal input per state plus a Condition or Switch chain/);
  });

  it('the default summary still does NOT carry them — AWP-005 §2, asserted on purpose', async () => {
    const { isError, data } = await call<GetNodeTypeResult>(session, 'get_node_type', {
      type_names: ['States', 'noodl.cloud.request']
    });
    expect(isError).toBe(false);

    for (const row of data.types) {
      // The control that proves the default path was actually exercised: a
      // summary always carries its port lines, so an empty response here would
      // satisfy the two negatives below for the wrong reason.
      expect((row.ports ?? []).length).toBeGreaterThan(0);
      expect(row.patterns).toBeUndefined();
      expect(row.antiPatterns).toBeUndefined();
    }
  });

  it('🔴 the tool description routes an agent to the level that carries them', async () => {
    // A field nobody is told about is a field nobody reads — the whole shape of
    // this defect. `summary` is the default, so emitting the arrays on `full`
    // changes nothing unless `full`'s own description says what it now buys.
    const { tools } = await session.client.listTools();
    const tool = tools.find((t) => t.name === 'get_node_type');
    expect(tool).toBeDefined();
    const description = String(tool!.description);

    expect(description).toContain('antiPatterns');
    expect(description).toContain('patterns');
    expect(description).toMatch(/detail: "full"/);
  });
});
