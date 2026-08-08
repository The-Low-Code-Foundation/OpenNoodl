/**
 * AWP-005 — the node-doc budget.
 *
 * Two things are gated here, and they are the same defect seen from both ends.
 *
 * **§1, the cause.** A port's `type` is an object (`{name, enums?, units?, …}`),
 * never a string. `getNodeTypeSummary` built each port line with `String(p.type)`,
 * so every line read `in alignContent: [object Object]` — measured at **100% of
 * every port in the catalog**. The cheap mode conveyed port names and no types,
 * which is why no model used it and every model paid for `detail: "full"`, and
 * the tool description recommends it regardless. The count assertion below is
 * deliberately two-sided: a spec that only asserts "zero `[object Object]`"
 * passes forever if it stops loading ports at all.
 *
 * **§the budget.** `Group` at full detail is ~11k tokens — half the entire
 * 89-tool surface for one node type, re-billed on every subsequent turn. These
 * ceilings are a ratchet, not a target: they exist so the next port added to
 * `Group` fails here rather than silently pushing a response past a client's
 * result cap. If a change legitimately grows a response, move the number and say
 * why in the commit.
 *
 * Token counts are chars/4, the same estimator used for the wire measurements
 * recorded in phase-58's README, so the numbers here are comparable to that table.
 */

import { getNodeTypeSummary, listNodeTypes, portTypeLabel } from '../src/catalog';
import { callRawText, connect, copyFixture } from './helpers';
import type { TestSession } from './helpers';

const tokens = (s: string) => Math.round(s.length / 4);

/** The 8 types a storefront needs — the basket phase-58's cost table is quoted against. */
const STOREFRONT_TYPES = [
  'Group',
  'Text',
  'Image',
  'Page',
  'Router',
  'For Each',
  'net.noodl.visual.columns',
  'Text Input'
];

const allTypeNames = () => listNodeTypes().map((r) => r.typeName);

describe('AWP-005 §1 — a port line carries a usable type', () => {
  it('renders no [object Object] anywhere in the catalog, over a port count that cannot silently collapse', () => {
    const names = allTypeNames();
    expect(names.length).toBeGreaterThanOrEqual(140);

    let portLines = 0;
    let objectObject = 0;
    const offenders: string[] = [];

    for (const name of names) {
      const s = getNodeTypeSummary(name);
      if ('error' in s) throw new Error(`listNodeTypes offered "${name}" and getNodeTypeSummary rejected it: ${s.error}`);
      for (const line of s.ports) {
        portLines++;
        if (line.includes('[object Object]')) {
          objectObject++;
          if (offenders.length < 5) offenders.push(`${name}: ${line}`);
        }
      }
    }

    // The two-sided assertion: 0 of N, with N pinned so "0" cannot mean "none loaded".
    expect(offenders).toEqual([]);
    expect(objectObject).toBe(0);
    expect(portLines).toBeGreaterThanOrEqual(2400);
  });

  it('spells out short enum values and collapses long ones to a count', () => {
    expect(portTypeLabel({ name: 'enum', enums: [{ value: 'row' }, { value: 'column' }] })).toBe('enum(row|column)');

    const many = Array.from({ length: 40 }, (_, i) => ({ value: `option-number-${i}` }));
    expect(portTypeLabel({ name: 'enum', enums: many })).toBe('enum(40 options)');
  });

  it('names a number port’s units, default first — a units port writes a string', () => {
    expect(portTypeLabel({ name: 'number', defaultUnit: 'px', units: ['px', '%'] })).toBe('number(px|%)');
    expect(portTypeLabel({ name: 'number', defaultUnit: '%', units: ['px', '%'] })).toBe('number(%|px)');
  });

  it('falls back to the bare type name, and never throws on a malformed type', () => {
    expect(portTypeLabel({ name: 'string' })).toBe('string');
    expect(portTypeLabel({ name: 'enum', enums: [] })).toBe('enum');
    expect(portTypeLabel(undefined)).toBe('unknown');
    expect(portTypeLabel(null)).toBe('unknown');
    expect(portTypeLabel({})).toBe('unknown');
    expect(portTypeLabel('string')).toBe('string');
  });

  it('gives Group’s layout ports a type a model could set them from', () => {
    const s = getNodeTypeSummary('Group');
    if ('error' in s) throw new Error(s.error);
    const flexDirection = s.ports.find((p) => p.includes('flexDirection'));
    expect(flexDirection).toBeDefined();
    expect(flexDirection).toContain('enum(');
    expect(flexDirection).not.toContain('[object Object]');
  });
});

/**
 * These drive the registered `get_node_type` handler over an in-memory transport
 * and measure the text it actually returns, so the figures are directly
 * comparable to phase-58's wire table (`Group` full ≈ 11,018 tokens). Measuring
 * `JSON.stringify(payload)` instead understates every one of them by about half,
 * because the wire is pretty-printed.
 */
describe('AWP-005 — the response budget (a ratchet: move the number, say why)', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await connect(copyFixture(), false);
  });
  afterAll(async () => {
    await session.close();
  });

  const cost = async (types: string[], detail: 'summary' | 'full') =>
    tokens(await callRawText(session, 'get_node_type', { type_names: types, detail }));

  it('keeps the 8-type storefront basket under 8,000 tokens at summary detail', async () => {
    // Was 30,815 at full detail — more than all 89 tool schemas combined.
    expect(await cost(STOREFRONT_TYPES, 'summary')).toBeLessThan(8_000);
  });

  it('keeps any single summary response under 3,000 tokens', async () => {
    const over: Array<{ name: string; cost: number }> = [];
    for (const name of allTypeNames()) {
      const c = await cost([name], 'summary');
      if (c >= 3_000) over.push({ name, cost: c });
    }
    expect(over).toEqual([]);
  });

  it('keeps any single full-detail response under 12,500 tokens', async () => {
    // `Group` is the ceiling case at ~11.2k. This is the assertion that fires
    // when a port is added to it — growth F44 caught only by measuring the wire.
    const over: Array<{ name: string; cost: number }> = [];
    for (const name of allTypeNames()) {
      const c = await cost([name], 'full');
      if (c >= 12_500) over.push({ name, cost: c });
    }
    expect(over).toEqual([]);
  });

  it('makes summary materially cheaper than full detail on the basket that matters', async () => {
    const summary = await cost(STOREFRONT_TYPES, 'summary');
    const full = await cost(STOREFRONT_TYPES, 'full');
    expect(full / summary).toBeGreaterThan(3);
  });

  it('still carries a usable type per port at summary detail — cheap is not the only bar', async () => {
    const text = await callRawText(session, 'get_node_type', { type_names: ['Group'], detail: 'summary' });
    expect(text).not.toContain('[object Object]');
    expect(text).toContain('in flexDirection: enum(');
    expect(text).toContain('in width: dimension(');
  });
});
