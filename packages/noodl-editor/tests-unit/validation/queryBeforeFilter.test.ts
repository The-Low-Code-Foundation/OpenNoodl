/**
 * DEF-012 §2 — `query-fetches-before-its-filter`. The RUNTIME reading this rule stands on was
 * measured on a real backend (SB-004 §7, `sb004-publication-invariant.test.ts`): a cloud
 * function's Query Records node fetched at graph build, its connected filter dropped as
 * unsupplied, and publishing one page flipped the access rules on every Section in the site.
 * The repair the rule teaches is SB-004's own pinned workaround (`sb004Authoring.test.ts`):
 * both run-on-change boxes `false`, the parameter's arrival as the only trigger.
 *
 * The mutant ledger (each arm exists to redden exactly one sabotage):
 *  - drop the cloud-prefix guard → the browser-component arm reddens.
 *  - drop the connected-wire requirement → the unwired-rule arm reddens (a rule with an
 *    `input` but no wire never narrows in ANY pass — a different absence).
 *  - read the boxes as `=== true` instead of `!== false` → the absent-means-ticked arm
 *    reddens (no `runOnChange-` key authored at all is the defect's common form).
 *  - drop the both-boxes-false abstention → the workaround arm reddens.
 *  - drop the wired-collection-name abstention → the wired-collection arm reddens.
 *  - read only the old visual shape → the saved-shape arm reddens.
 *  - promote to `AUTHORED_BLOCKING_WARNINGS` → the severity arm reddens.
 *
 * The traversal-parity arm runs this module's duplicated filter walk and the runtime's
 * `collectFilterParameters` over the same filters and fails the day they disagree — the
 * `fix-007/function-ports.test.ts` idiom for a copy this layer is not allowed to import.
 */

import {
  authoredPreconditionDiagnostics,
  isBlockingForAuthoredOutput
} from '../../src/editor/src/validation/authoredCandidate';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode, type Diagnostic } from '../../src/editor/src/validation/diagnostics';
import type { FunctionWireLike } from '../../src/editor/src/validation/functionPorts';
import {
  checkQueryBeforeFilter,
  connectedFilterParameterNames,
  QUERY_NODE_TYPE
} from '../../src/editor/src/validation/queryBeforeFilter';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();
const CLOUD = '/#__cloud__/publishPage';

/** The old visual shape, as SB-004's own graph carries it. */
const VISUAL_FILTER = {
  combinator: 'and',
  rules: [{ property: 'pageId', operator: 'equal to', input: 'pageId' }]
};

/** The post-BCN-003b saved shape of the same filter. */
const SAVED_FILTER = {
  type: 'and',
  conditions: [{ property: 'pageId', operator: '=', valueSource: 'connected', valuePortName: 'qp-pageId' }]
};

function wire(fromId: string, fromProperty: string, toId: string, toProperty: string): FunctionWireLike {
  return { fromId, fromProperty, toId, toProperty };
}

/** SB-004's defect shape: a filtered cloud query with no runOnChange keys authored at all. */
function defectArm(overrides?: Record<string, unknown>): { nodes: ParameterizedNode[]; wires: FunctionWireLike[] } {
  return {
    nodes: [
      { id: 'request', type: 'noodl.cloud.request', parameters: {} },
      {
        id: 'query',
        type: QUERY_NODE_TYPE,
        label: 'Sections of this page',
        parameters: { collectionName: 'Section', visualFilter: VISUAL_FILTER, ...overrides }
      }
    ],
    wires: [wire('request', 'pm-pageId', 'query', 'qp-pageId')]
  };
}

function run(
  nodes: ParameterizedNode[],
  wires: FunctionWireLike[],
  component: string = CLOUD
): Diagnostic[] {
  return checkQueryBeforeFilter(nodes, { component, wires, catalog });
}

describe('DEF-012 §2 — query-fetches-before-its-filter', () => {
  it('reports SB-004’s defect shape verbatim: connected filter, boxes absent, cloud component', () => {
    const { nodes, wires } = defectArm();
    const found = run(nodes, wires);
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.QueryFetchesBeforeItsFilter]);
    const d = found[0];
    expect(d.severity).toBe('warning');
    expect(d.location?.nodeId).toBe('query');
    expect(d.location?.port).toBe('runOnChange-collectionName');
    // The message must name the port the wire feeds and the class the first fetch dumps.
    expect(d.message).toContain('qp-pageId');
    expect(d.message).toContain('"Section"');
    expect(d.message).toContain('"runOnChange-querySettings": false');
  });

  it('absent means ticked: no runOnChange key at all is the firing shape, and one open box still fires', () => {
    // Half the workaround is not the workaround.
    const half = defectArm({ 'runOnChange-collectionName': false });
    const found = run(half.nodes, half.wires);
    expect(found).toHaveLength(1);
    expect(found[0].location?.port).toBe('runOnChange-querySettings');
    // An authored `true` is the same open box as an absent key.
    const explicit = defectArm({ 'runOnChange-collectionName': true, 'runOnChange-querySettings': true });
    expect(run(explicit.nodes, explicit.wires)).toHaveLength(1);
  });

  it('is silent on SB-004’s workaround — both boxes false — whatever else is wired', () => {
    const { nodes, wires } = defectArm({
      'runOnChange-collectionName': false,
      'runOnChange-querySettings': false
    });
    // A Do wire beside the workaround is an authored trigger whose ordering the author owns.
    wires.push(wire('request', 'started', 'query', 'storageFetch'));
    expect(run(nodes, wires)).toEqual([]);
  });

  it('is silent in a browser component: the same first fetch there is long-standing behaviour', () => {
    const { nodes, wires } = defectArm();
    expect(run(nodes, wires, '/Pages/Home')).toEqual([]);
  });

  it('is silent when the filter has no connected value, and when a connected rule has no wire', () => {
    // Static values narrow the load-time fetch correctly.
    const staticFilter = defectArm({
      visualFilter: { combinator: 'and', rules: [{ property: 'pageId', operator: 'equal to', value: 'home' }] }
    });
    expect(run(staticFilter.nodes, staticFilter.wires)).toEqual([]);
    // A rule with an `input` but no wire never narrows in any pass — not a timing inversion.
    // The component still has SOME wire, so the no-wires early return cannot answer for the
    // connected-wire requirement this arm exists to hold.
    const { nodes } = defectArm();
    expect(run(nodes, [wire('request', 'started', 'query', 'storageFetch')])).toEqual([]);
  });

  it('abstains when the collection name arrives by wire: the fetch ordering is not decidable', () => {
    const { nodes, wires } = defectArm({ collectionName: undefined });
    wires.push(wire('request', 'pm-collection', 'query', 'collectionName'));
    expect(run(nodes, wires)).toEqual([]);
  });

  it('reads the post-BCN-003b saved shape too', () => {
    const { nodes, wires } = defectArm({ visualFilter: SAVED_FILTER });
    const found = run(nodes, wires);
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('qp-pageId');
  });

  it('never blocks authored output — the non-promotion is a decision, pinned here', () => {
    const { nodes, wires } = defectArm();
    const [d] = run(nodes, wires);
    expect(isBlockingForAuthoredOutput(d)).toBe(false);
  });

  it('reaches the door: authoredPreconditionDiagnostics carries it, wires omitted means silent', () => {
    const { nodes, wires } = defectArm();
    const base = {
      component: CLOUD,
      nodes: nodes as never,
      components: [CLOUD],
      catalog
    };
    const withWires = authoredPreconditionDiagnostics({ ...base, wires });
    expect(withWires.some((d) => d.code === DiagnosticCode.QueryFetchesBeforeItsFilter)).toBe(true);
    const withoutWires = authoredPreconditionDiagnostics(base);
    expect(withoutWires.some((d) => d.code === DiagnosticCode.QueryFetchesBeforeItsFilter)).toBe(false);
  });

  it('the catalog still carries the type this rule keys on — a rename must redden here, not silence the rule', () => {
    expect(catalog.getNode(QUERY_NODE_TYPE)).toBeTruthy();
    expect(catalog.getNode(QUERY_NODE_TYPE)?.isVisual).toBeFalsy();
  });

  it('traversal parity: the duplicated walk and the runtime’s collectFilterParameters agree on both shapes', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const QueryUtils = require('../../../noodl-runtime/src/api/queryutils');
    const nested = {
      combinator: 'or',
      rules: [
        { combinator: 'and', rules: [{ property: 'a', operator: 'equal to', input: 'a' }] },
        { property: 'b', operator: 'equal to', input: 'b' },
        { property: 'c', operator: 'equal to', value: 'static' }
      ]
    };
    const savedNested = {
      type: 'or',
      conditions: [
        { type: 'and', conditions: [{ property: 'a', operator: '=', valueSource: 'connected', valuePortName: 'qp-a' }] },
        { property: 'b', operator: '=', valueSource: 'connected', valuePortName: 'qp-b' },
        { property: 'c', operator: '=', valueSource: 'static', value: 'static' }
      ]
    };
    for (const filter of [VISUAL_FILTER, SAVED_FILTER, nested, savedNested]) {
      expect(connectedFilterParameterNames(filter)).toEqual(QueryUtils.collectFilterParameters(filter, 'qp-'));
    }
  });
});
