/**
 * FLD-013 (#37) — an agent learns what will not translate *before* it designs.
 *
 * 🔴 **The field the issue asked for would not have prevented the problem the issue describes,
 * and this file's first test is that sentence.** #37 asked for `export: {status, badge, reason}`
 * on the catalog tools, after a dashboard built on `Circle` produced twenty-three refusals at
 * export time. `Circle`'s ledger status is **`translated`**. Ship the status alone and the field
 * reads green on the exact node that failed.
 *
 * The refusal is per **parameter source**, not per type: `visualDeferReason` leaves a node out
 * when any of `STRUCTURE_PORTS[role]` arrives over a wire, and `circle`'s list is thirteen ports
 * long — nearly every port it has. So `export` carries three things and not one: the ledger's
 * classification of the type, the badge when the type never exports at all, and the port lists
 * that say when a translated type still refuses.
 *
 * **The tables are read, never restated.** `@nodegx/export` exports them; `analyze/plan.ts`
 * imports the same module to decide the export. A second copy in this package would drift the day
 * a port was added, and this repo has already paid for that once.
 */

import { exportCoverage } from '@nodegx/export';

import { exportInfoOf, listNodeTypes, getNodeTypeDetail } from '../src/catalog';
import { callRawText, connect, copyFixture } from './helpers';
import type { TestSession } from './helpers';

/** The type #37 was filed about, and the port its dashboard wired. */
const CIRCLE = 'Circle';
const THE_PORT = 'startAngle';

describe('FLD-013 AC1/AC5 — the answer that would have prevented #37', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await connect(copyFixture(), false);
  });
  afterAll(async () => {
    await session.close();
  });

  /** `get_node_type` at its default detail — a summary call, which is what an agent actually makes. */
  const nodeType = async (name: string) =>
    JSON.parse(await callRawText(session, 'get_node_type', { type_names: [name] })).types[0];

  it('tells an agent that a wire into Circle.startAngle refuses the node — before it designs', async () => {
    const circle = await nodeType(CIRCLE);

    // 🔴 The trap, asserted rather than described: the field #37 asked for reads GREEN here.
    expect(circle.export.status).toBe('translated');
    expect(circle.export.badge).toBeUndefined();

    // And the answer that is actually true of this product.
    expect(circle.export.structurePorts).toContain(THE_PORT);
    expect(circle.export.structurePorts).toHaveLength(13);
  });

  it('reports an empty list, not an absent field, for a type that refuses on no port', async () => {
    // AC5. `Group` is translated and has no structure ports at all. An absent field would be
    // indistinguishable from a server too old to carry one, which is not an answer.
    const group = await nodeType('Group');
    expect(group.export).toBeDefined();
    expect(group.export.status).toBe('translated');
    expect(group.export.structurePorts).toEqual([]);
    expect(group.export.contentPorts).toEqual([]);
  });

  it('keeps the two lists apart, because they are not the same claim', async () => {
    // `Range.min` is not structure — the emitter orders it as a plain attribute — and the node is
    // still left out, because a bound that is not statically known renders a 0–100 slider where
    // the running app renders the row's. Calling it a structure port would be untrue of this
    // product; dropping it would hide a refusal. It is reported, under its own name.
    const range = await nodeType('net.noodl.controls.range');
    expect(range.export.contentPorts).toEqual(['min', 'max', 'step']);
    expect(range.export.structurePorts).toEqual([]);
  });

  it('carries the badge and its reason where the type never exports at all', async () => {
    const csv = await nodeType('net.noodl.ParseCSV');
    expect(csv.export.status).toBe('deferred');
    expect(csv.export.badge.kind).toMatch(/^(scheduled|out-of-scope)$/);
    expect(csv.export.badge.label).toMatch(/^Not exportable/);
    expect(typeof csv.export.badge.reason).toBe('string');
    expect(csv.export.badge.reason.length).toBeGreaterThan(0);
  });

  it('answers at the default detail, not only at detail:"full"', async () => {
    // AWP-005 §2 — `summary` is the default and is what the overwhelming majority of calls get.
    // An export reading that only survives `detail: "full"` is one almost nobody sees, which
    // would make AC1 true of a mode nobody uses. Same argument that carried `providedBy` here.
    const summary = await nodeType(CIRCLE);
    const full = JSON.parse(await callRawText(session, 'get_node_type', { type_names: [CIRCLE], detail: 'full' })).types[0];
    expect(summary.export).toEqual(full.export);
  });
});

describe('FLD-013 AC2 — every picker row joins the ledger, as a cardinality', () => {
  it('classifies all 143 of them, and the join is not vacuous', () => {
    const rows = listNodeTypes();
    // Pinned so "all classified" can never mean "none loaded".
    expect(rows.length).toBeGreaterThanOrEqual(140);

    const unclassified = rows.filter((r) => exportInfoOf(r.typeName) === undefined).map((r) => r.typeName);
    expect(unclassified).toEqual([]);

    // 🔴 The presence control. A join that classifies everything it is handed is worth nothing if
    // it also classifies things it has never heard of — `undefined` has to be reachable, or "143
    // of 143" is a fact about the function rather than about the ledger.
    expect(exportInfoOf('Nonesuch Node')).toBeUndefined();
    // A component instance's type is a project legacyName. Its export is decided by its component,
    // not by the ledger, and saying `structurePorts: []` for one would claim a measurement nobody
    // has made.
    expect(exportInfoOf('/Pages/Home')).toBeUndefined();
  });

  it('gives every classified type a status the ledger actually defines', () => {
    const seen = new Set<string>();
    for (const row of listNodeTypes({ includeHidden: true })) {
      const info = exportInfoOf(row.typeName);
      if (info) seen.add(info.status);
    }
    expect([...seen].sort()).toEqual(['backend-only', 'deferred', 'stubbed', 'translated']);
  });

  it('carries the same reading in full detail as `exportInfoOf` computes', () => {
    const detail = getNodeTypeDetail(CIRCLE);
    if ('error' in detail) throw new Error(detail.error);
    expect(detail.export).toEqual(exportInfoOf(CIRCLE));
  });
});

describe('FLD-013 AC3 — the listing, and what it costs', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await connect(copyFixture(), false);
  });
  afterAll(async () => {
    await session.close();
  });

  it('says something about export on exactly the rows that have something to say', () => {
    const rows = listNodeTypes();
    const carried = rows.filter((r) => r.export !== undefined);

    // 27 non-translated picker rows, plus nine translated types that still refuse on a wire.
    const translatedButRefusing = carried.filter((r) => r.export!.status === 'translated').map((r) => r.typeName);
    expect(translatedButRefusing).toEqual([
      'Circle',
      'Radio Button Group',
      'Video',
      'net.noodl.controls.checkbox',
      'net.noodl.controls.options',
      'net.noodl.controls.radiobutton',
      'net.noodl.controls.range',
      'net.noodl.visual.columns',
      'net.noodl.visual.icon'
    ]);

    // 🔴 **This list is the reason the rule is an `or` and not `status !== "translated"`.** The
    // task's scope line said "emit the field only on non-translated rows"; that rule drops all
    // nine of these, `Circle` first, and `Circle` is the node #37 was filed about. Nine extra
    // rows cost 654 bytes across the whole listing (measured below); the alternative is a listing
    // that is silent about the exact type that caused the issue.
    expect(translatedButRefusing).toContain(CIRCLE);

    // Two-sided: silence is the common case, and it has to stay the common case.
    expect(carried.length).toBe(36);
    expect(rows.length - carried.length).toBeGreaterThan(100);
  });

  it('makes the silence readable, at the payload level', async () => {
    const payload = JSON.parse(await callRawText(session, 'list_node_types', {}));
    // A row without an `export` field is the overwhelming majority. Without this block, that
    // absence is indistinguishable from a server that does not carry the field at all.
    expect(payload.exportCoverage.exportable).toBe(exportCoverage().exportable);
    expect(payload.exportCoverage.placeable).toBe(exportCoverage().placeable);
    expect(payload.exportCoverage.percent).toBe(exportCoverage().percent);
    expect(payload.exportCoverage.notice).toContain('Code export is in alpha');
    expect(payload.exportCoverage.note).toContain('no `export` field');
    expect(payload.exportCoverage.note).toContain('a translated type can still refuse');
  });

  /**
   * 🔴 **A ratchet, and it is the first one this tool has had.** `list_node_types` had no size
   * assertion at all before FLD-013, which is how a discovery tool grows without anybody pricing
   * it. Measured on the wire (pretty-printed, which is what a client is billed for), default
   * filter, 143 rows:
   *
   * | | wire bytes | ≈tokens | JSON bytes |
   * |---|---|---|---|
   * | before FLD-013 | 47,860 | 11,965 | 36,327 |
   * | after | **58,386** | **14,597** | **43,382** |
   *
   * **+10,526 wire bytes, +22.0%.** Attributed rather than assumed, on the JSON figures where the
   * fields are separable (+7,055 total):
   *
   * - **badge, 3,890 bytes (55%)** — ten deferred picker rows, each carrying the ledger's own
   *   exemption sentence. This is the half #37 asked for by name and the half that says *why* and
   *   whether it is scheduled; it is the expensive half and it is kept.
   * - **the two port lists, 654 bytes** — thirty-six rows, nine of which no other field would have
   *   flagged at all.
   * - **empty arrays, 1,154 bytes** — and they are deliberately NOT trimmed. Omitting an empty
   *   `structurePorts` would save 2.7% of the delta and reintroduce exactly the ambiguity AC5
   *   exists to remove: absent and empty must not be the same answer.
   * - the remainder is the `"export": {…}` wrapper and `"status"` on thirty-six rows.
   *
   * The ceiling below is a ratchet, not a target: it is set 3,614 bytes above the measured figure,
   * so the next field added to a listing row fails here rather than silently costing every agent
   * that opens a project a few thousand more tokens. If a change legitimately grows it, move the
   * number and say why in the commit.
   */
  it('keeps the default listing under 62,000 wire bytes', async () => {
    const wire = await callRawText(session, 'list_node_types', {});
    expect(wire.length).toBeLessThan(62_000);
    // Two-sided: a listing that collapsed to nothing would also be under the ceiling.
    expect(wire.length).toBeGreaterThan(40_000);
  });
});
