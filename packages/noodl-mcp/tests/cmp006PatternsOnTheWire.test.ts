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
 * ## 🔴 AC3 — the negative assertion was OVERTURNED ON PURPOSE (session 11)
 *
 * This file used to assert that the default summary MUST NOT carry either
 * field, and said a later session overturning it "should change this assertion
 * on purpose and say what it measured". This is that change.
 *
 * What was measured, and it is traffic rather than a replay. Across every
 * transcript on the authoring machine — all project directories, 25 files
 * containing calls — `get_node_type` has been called **45 times**, all of them
 * after `detail` shipped (2026-07-25, DEBT-009): **26** default, **18**
 * `ports: [...]`, **1** `detail: "full"`. The `ports` path short-circuits above
 * the summary, so it carries neither field either — **44 of 45 calls returned
 * neither**. AC1 and AC2 put 203 authored warnings onto a route taken once.
 *
 * The cost that held the line was a budget on the wrong population: "median 36%
 * of a summary payload, up to 151%" is unweighted over all 176 types. Against
 * the 105 type-requests that actually happened, through `getNodeTypeSummary`
 * itself: median **17%** weighted by call frequency, max **59%**, **+5.8%**
 * across the whole traffic. The most-asked types are the cheap ones, because a
 * long port list is what makes a summary long.
 *
 * 🔴 **This measures the cost, not the benefit.** Whether a graph built against
 * this default avoids the anti-patterns it now names is still unmeasured, and
 * still wants AC3's replay. The numbers killed the objection, not the question.
 *
 * ⚠️ `patterns` stays off the default and the negative assertion for it is
 * still live below. AC3 asked about `antiPatterns`; `patterns` is the larger
 * half (259 entries over 130 types) and has not been priced.
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

  it('🔴 AC3 — the DEFAULT summary now carries antiPatterns, and still not patterns', async () => {
    const { isError, data } = await call<GetNodeTypeResult>(session, 'get_node_type', {
      type_names: ['States', 'noodl.cloud.request']
    });
    expect(isError).toBe(false);
    expect(data.types.length).toBe(2);

    for (const row of data.types) {
      // The control that proves the default path was actually exercised, kept
      // from the version of this spec that asserted the opposite: a summary
      // always carries its port lines, so an empty response would satisfy the
      // assertions below for the wrong reason. It also proves this is the
      // summary and not `full` — `full` has no `ports` string array.
      expect((row.ports ?? []).length).toBeGreaterThan(0);

      // Derived from the artefact, never a literal — same rule as the `full`
      // equality spec above, and for the same reason: a hard-coded sentence
      // passes on a stale corpus.
      const expected = corpus.get(row.typeName);
      expect(expected).toBeDefined();
      expect(row.antiPatterns).toEqual(expected!.antiPatterns);

      // Still off the default, and still asserted on purpose — see the header.
      expect(row.patterns).toBeUndefined();
    }

    // 🔴 Both sampled types must actually HAVE anti-patterns, or the equality
    // above is `undefined === undefined` and this spec grades nothing. The two
    // are chosen because they are the expensive end of the measurement:
    // `noodl.cloud.request` is the 151%-of-summary case the old assertion cited.
    for (const name of ['States', 'noodl.cloud.request']) {
      expect((corpus.get(name)?.antiPatterns ?? []).length).toBeGreaterThan(0);
    }
  });

  it('🔴 the tool description routes an agent to the level that carries each one', async () => {
    // A field nobody is told about is a field nobody reads — the whole shape of
    // this defect. AC3 moved `antiPatterns` onto the default, so the description
    // has to move it too: an agent told to pass detail:"full" for anti-patterns
    // it already received would be paying ~11k tokens for nothing.
    const { tools } = await session.client.listTools();
    const tool = tools.find((t) => t.name === 'get_node_type');
    expect(tool).toBeDefined();
    const description = String(tool!.description);

    expect(description).toContain('antiPatterns');
    expect(description).toContain('patterns');
    expect(description).toMatch(/detail: "full"/);

    // 🔴 The ORDER is the assertion: `antiPatterns` must be named in the
    // default sentence, which ends at "enough to author from", and `patterns`
    // after it in the full-detail list. A plain `toContain` on both names
    // passed before this change and would pass again with them swapped back.
    const boundary = description.indexOf('enough to author from');
    expect(boundary).toBeGreaterThan(0);
    expect(description.indexOf('antiPatterns')).toBeLessThan(boundary);
    expect(description.lastIndexOf('patterns')).toBeGreaterThan(boundary);
  });
});
