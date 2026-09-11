/**
 * CMP-009 — the cheap path answers with confidence it has not got.
 *
 * ## The defect, re-derived from the code on 2026-09-11
 *
 * `get_node_type({ports: [...]})` short-circuits at `catalogTools.ts:107`, above
 * the summary path. Measured over the 27 real type-requests on that path, the
 * response carried `typeName`, `displayName`, `inputs`, `outputs`,
 * `runtimeBehavior`, `notFound`, `notFoundNotes` — and dropped `antiPatterns`,
 * `category`, `examples`, `examplesOmitted`, `export`, `hasDynamicPorts`,
 * `isVisual`, `summary`.
 *
 * 🔴 It is the FIRST contact 26 times in 27. Replayed in call order across every
 * transcript on the authoring machine (25 files, all post-dating `detail`
 * shipping 2026-07-25), **26 of the 27 ports-path type-requests were COLD** — no
 * prior survey of that type in that transcript. The cheap path is used *instead
 * of* a survey, not to top one up, so everything it withholds is withheld from
 * someone who has seen nothing else.
 *
 * ## Why the fixtures below are the REAL argument lists
 *
 * Every `(type, ports)` pair asserted here was taken from a recorded call, not
 * invented. A gate on invented arguments grades the shape of the response; a
 * gate on the arguments people actually sent grades whether the answer they
 * actually got was sound. Where the traffic reads zero — no deprecated type was
 * ever asked about — the zero ships as a labelled MEASUREMENT below and the
 * gate is built on `Animation`, which genuinely ships. It is not invented, and
 * the traffic zero is not dressed up as a pass.
 * See [[a-rule-reading-zero-in-both-arms-grades-nothing]].
 */
import { getNodeTypeDetail, getNodeTypePorts, getNodeTypeSummary } from '../src/catalog';
import type { NodeTypePortsView } from '../src/tools/responses';

const catalog = require('@noodl/types/src/node-catalog.json');
const allTypeNames = (): string[] => (catalog.nodes ?? catalog).map((n: any) => n.typeName);

const view = (type: string, ports: string[]): NodeTypePortsView => {
  const v = getNodeTypePorts(type, ports);
  if ('error' in v) throw new Error(`fixture type ${type} is not in the catalog: ${v.error}`);
  return v;
};

/** (type, ports) pairs lifted verbatim from recorded `ports:[...]` calls. */
const REAL_CALLS: ReadonlyArray<readonly [string, string[]]> = [
  ['net.noodl.visual.columns', ['sizing', 'minWidth', 'layoutString', 'justifyContent', 'marginX', 'marginY', 'smallBreakpoint', 'smallLayout', 'direction']],
  ['net.noodl.visual.icon', ['iconIconSource', 'iconSourceType', 'iconImageSource', 'iconSize', 'iconColor']],
  ['Circle', ['size', 'text', 'currentCount', 'fillColor']],
  ['Component Inputs', ['onClick', 'pointerCursor', 'sizeMode', 'flexDirection']],
  ['Group', ['pointerCursor']],
  ['Text', ['paddingLeft', 'borderRadius']],
  ['net.noodl.controls.button', ['alignSelf', 'buttonVariant']],
  ['Page', ['backgroundColor', 'flexDirection', 'alignX', 'width', 'height']]
];

describe('CMP-009 AC1 — notFound does not claim more than it knows', () => {
  /**
   * 🔴 The worst real case is the node this phase exists to teach. `Component
   * Inputs` has ZERO static inputs — its mechanism is `component-ports`, every
   * port on it is declared by the author — and a recorded call asked it for four
   * ports and received `inputs: [], outputs: [], notFound: [all four]`.
   * A confidently empty answer about the node CMP-001 is entirely about.
   */
  it('says so on the empty answer Component Inputs gave a real caller', () => {
    const v = view('Component Inputs', ['onClick', 'pointerCursor', 'sizeMode', 'flexDirection']);
    expect(v.inputs).toHaveLength(0);
    expect(v.outputs).toHaveLength(0);
    expect(v.notFound).toEqual(['onClick', 'pointerCursor', 'sizeMode', 'flexDirection']);
    expect(v.notFoundCaveat).toBeDefined();
    // It must name THIS type's mechanism, not hedge generically: the caller
    // needs to know the ports are author-declared, which is actionable.
    expect(v.notFoundCaveat).toContain('`ports` parameter');
    expect(v.notFoundCaveat).toContain('Component Inputs');
  });

  it('says so on a declared-port-groups type from the same traffic', () => {
    const v = view('net.noodl.controls.button', ['alignSelf', 'buttonVariant']);
    expect(v.notFound).toContain('buttonVariant');
    expect(v.notFoundCaveat).toMatch(/appear and disappear with the values of other parameters/);
  });

  /**
   * The negative half, and it is the one that makes the positive half mean
   * something. A type whose port list is COMPLETE must not be hedged: qualifying
   * a sound absence claim teaches the caller to distrust every absence claim,
   * which is worse than the silence this task is closing.
   */
  it('does NOT hedge a type whose port list is complete', () => {
    const staticTypes = allTypeNames().filter((n) => {
      const d = getNodeTypeDetail(n);
      return !('error' in d) && !d.dynamicPorts;
    });
    expect(staticTypes.length).toBeGreaterThan(20); // the negative arm has a population
    let checked = 0;
    for (const t of staticTypes) {
      const v = view(t, ['definitely-not-a-real-port-name']);
      expect(v.notFound).toEqual(['definitely-not-a-real-port-name']);
      expect(v.notFoundCaveat).toBeUndefined();
      checked++;
    }
    expect(checked).toBe(staticTypes.length);
  });

  it('emits nothing when the request asserted no absence', () => {
    // Group.pointerCursor was a real miss; `alignItems` is a real hit. A call
    // whose ports all resolve claims nothing and pays nothing.
    const v = view('Group', ['alignItems']);
    expect(v.notFound).toBeUndefined();
    expect(v.notFoundCaveat).toBeUndefined();
  });

  /**
   * ⚠️ This assertion was written once with the literals from the FULL recorded
   * population (16 of 27, 13 on a partial list) and counted over the 8 fixtures
   * below, which is a different population — it read 6 and went red. The literal
   * was not bumped; the expectation is now DERIVED, so the rule is "every
   * absence claim on a partial list is qualified, and no other is", which is the
   * thing that must stay true rather than a count that must be maintained.
   * The recorded population's own numbers stay in the file header as history.
   */
  it('every absence claim on a partial list is qualified, and only those', () => {
    const claiming = REAL_CALLS.filter(([t, p]) => (view(t, p).notFound ?? []).length > 0);
    const onPartialList = claiming.filter(([t]) => {
      const d = getNodeTypeDetail(t);
      return !('error' in d) && (d.dynamicPorts?.mechanisms?.length ?? 0) > 0;
    });
    const hedged = claiming.filter(([t, p]) => view(t, p).notFoundCaveat !== undefined);
    expect(claiming.length).toBeGreaterThan(0); // the arm has a population at all
    expect(new Set(hedged.map(([t]) => t))).toEqual(new Set(onPartialList.map(([t]) => t)));
    console.log(
      `[cmp009] ${hedged.length} of ${claiming.length} absence-claiming fixture calls qualify the claim ` +
        `(${claiming.length - onPartialList.length} correctly do not)`
    );
  });
});

describe('CMP-009 AC2 — the port-scoped export warning travels with the ports', () => {
  /**
   * 🔴 Three live hits in the 27 recorded requests. `structurePorts` NAMES
   * ports: a value arriving on one over a WIRE leaves the node out of the
   * exported code. FLD-013 put `export` on the summary for exactly this reason,
   * and the path where you are setting a port did not get it.
   */
  const HITS: ReadonlyArray<readonly [string, string[], string[]]> = [
    ['net.noodl.visual.columns', REAL_CALLS[0][1], REAL_CALLS[0][1]], // all nine
    ['net.noodl.visual.icon', REAL_CALLS[1][1], ['iconSourceType', 'iconIconSource', 'iconImageSource']],
    ['Circle', REAL_CALLS[2][1], ['size', 'fillColor']]
  ];

  it.each(HITS)('%s warns about exactly the asked-for structure ports', (type, ports, expected) => {
    const v = view(type, ports as string[]);
    expect(v.export).toBeDefined();
    expect(new Set(v.export!.structurePorts)).toEqual(new Set(expected as string[]));
  });

  it('all nine ports one caller asked net.noodl.visual.columns about are structure ports', () => {
    const [type, ports] = REAL_CALLS[0];
    const v = view(type, ports);
    expect(v.export!.structurePorts).toHaveLength(ports.length);
    console.log(`[cmp009] ${type}: ${ports.length} of ${ports.length} asked ports drop the node from the export`);
  });

  /** Filtered, not whole — the ports the caller did not ask about are the summary's job. */
  it('does not leak structure ports the caller did not ask about', () => {
    const v = view('Circle', ['size']);
    expect(v.export!.structurePorts).toEqual(['size']);
    const full = getNodeTypeDetail('Circle');
    expect('error' in full ? [] : full.export!.structurePorts.length).toBeGreaterThan(1);
  });

  /** An empty filtered list is omitted, not emitted as `[]`. */
  it('omits the port lists when none of the asked ports are in them', () => {
    const v = view('Group', ['alignItems']);
    expect(v.export!.status).toBe('translated');
    expect(v.export!.structurePorts).toBeUndefined();
    expect(v.export!.contentPorts).toBeUndefined();
  });

  it('status travels even for a type that never exports', () => {
    const v = view('Animation', ['cubicBezierP1X']);
    expect(v.export!.status).toBe('deferred');
    expect(v.export!.badge).toBeDefined();
  });
});

describe('CMP-009 AC3 — a retired type says so', () => {
  it('Animation is flagged on the ports path', () => {
    const v = view('Animation', ['cubicBezierP1X']);
    expect(v.deprecated).toBe(true);
    expect(v.inputs.length).toBeGreaterThan(0); // it still answers the question asked
  });

  it('a live type is not flagged', () => {
    expect(view('Group', ['alignItems']).deprecated).toBeUndefined();
  });

  /**
   * 🔴 The labelled measurement, NOT a gate. 30 of 176 types are deprecated and
   * ZERO of the 27 recorded ports-path requests were on one — so a gate built on
   * the traffic would read zero in both arms and grade nothing. It ships as a
   * number that moves rather than as a pass.
   *
   * ⚠️ And `antiPatterns` does not cover this: 1 of the 30 carries one. The row
   * that proposed `summary` + `antiPatterns` as the whole fix would have warned
   * on 1 deprecated type in 30.
   */
  it('measurement: how many deprecated types exist, and how many carry an antiPattern', () => {
    const names = allTypeNames();
    const deprecated = names.filter((n) => {
      const d = getNodeTypeDetail(n);
      return !('error' in d) && d.deprecated;
    });
    const withAnti = deprecated.filter((n) => {
      const d = getNodeTypeDetail(n);
      return !('error' in d) && (d.antiPatterns?.length ?? 0) > 0;
    });
    const askedDeprecated = REAL_CALLS.filter(([t]) => {
      const d = getNodeTypeDetail(t);
      return !('error' in d) && d.deprecated;
    });
    console.log(
      `[cmp009] deprecated types: ${deprecated.length}/${names.length}; carrying an antiPattern: ${withAnti.length}; ` +
        `recorded ports-path requests on one: ${askedDeprecated.length}`
    );
    expect(deprecated.length).toBeGreaterThan(20);
    expect(withAnti.length).toBeLessThan(deprecated.length / 2);
    expect(askedDeprecated.length).toBe(0);
  });
});

describe('CMP-009 AC4 — the cold caller gets a sentence, and does not get the corpus', () => {
  it.each(REAL_CALLS)('%s carries summary', (type, ports) => {
    const v = view(type, ports);
    const d = getNodeTypeDetail(type);
    expect('error' in d).toBe(false);
    expect(v.summary).toBe(!('error' in d) ? d.summary : undefined);
    expect(typeof v.summary).toBe('string');
  });

  it('carries antiPatterns identical to the corpus where the type has them', () => {
    let withAnti = 0;
    for (const [type, ports] of REAL_CALLS) {
      const d = getNodeTypeDetail(type);
      if ('error' in d) continue;
      const v = view(type, ports);
      if (d.antiPatterns?.length) {
        expect(v.antiPatterns).toEqual(d.antiPatterns);
        withAnti++;
      } else {
        expect(v.antiPatterns).toBeUndefined();
      }
    }
    expect(withAnti).toBeGreaterThan(0); // the positive arm has a population
  });

  /**
   * 🔴 The exclusion is asserted, not merely omitted. `examples` is 8,739 B —
   * 27.1% of the base, the single most expensive dropped field and the least
   * port-scoped. Carrying everything the summary carries costs +58.3% and
   * undercuts the only reason this path exists. A later session may overturn
   * this, and should change this assertion ON PURPOSE and say what it measured
   * — the way CMP-006 AC3 overturned its own negative assertion.
   */
  it('does NOT carry examples, patterns, or the full port list', () => {
    for (const [type, ports] of REAL_CALLS) {
      const v = view(type, ports) as unknown as Record<string, unknown>;
      expect(v.examples).toBeUndefined();
      expect(v.examplesOmitted).toBeUndefined();
      expect(v.patterns).toBeUndefined();
      expect(v.ports).toBeUndefined();
    }
  });
});

describe('CMP-009 AC5 — the price, printed on a passing run', () => {
  /**
   * The CN-006 trick: a margin printed by a PASSING run is the only reason s11's
   * 290-byte headroom was legible before it fired. This asserts the shape of the
   * cost — that the ports path stays far cheaper than the summary it short-cuts
   * — rather than a round literal that would need bumping.
   */
  it('stays dramatically cheaper than the summary it short-circuits', () => {
    const B = (o: unknown) => Buffer.byteLength(JSON.stringify(o), 'utf8');
    let ports = 0;
    let summaries = 0;
    for (const [type, p] of REAL_CALLS) {
      ports += B(view(type, p));
      summaries += B(getNodeTypeSummary(type));
    }
    const ratio = ports / summaries;
    console.log(
      `[cmp009] ${REAL_CALLS.length} real calls: ports path ${ports} B vs summary ${summaries} B ` +
        `— ${(100 * ratio).toFixed(1)}% of a survey, ${Math.round((summaries - ports) / REAL_CALLS.length)} B/request saved`
    );
    // The path exists to be the cheap one. If it ever stops being that, this is
    // the assertion that should stop the session, not a byte literal.
    expect(ratio).toBeLessThan(0.75);
  });
});
