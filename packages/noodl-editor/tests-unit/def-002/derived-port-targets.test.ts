/**
 * DEF-002 §1(b)/§1(c) — a wire to an adapter-minted port that does not exist.
 *
 * The other two of phase 78 D1's three sabotages: `send.in-name` →
 * `send.in-nameXX` on a **CloudFunction2**, and
 * `goDetail.pm-announcementId` → `pm-noSuchParam` on a **RouterNavigate**. Each
 * produced a run identical to the clean one.
 *
 * Every case below is a **pair**: the same graph, one name apart. 🔴 A rule that
 * fires on both arms has measured nothing, and one that fires on neither is
 * worse, because it looks like coverage.
 *
 * ## What this grades that a corpus run cannot
 *
 * The check finds **zero** across the 94-project corpus, and that number is only
 * readable beside these arms: the corpus contains 14 real prefixed wires that
 * the check reads and accepts, and the two sabotages below are what say the
 * silence is a clean corpus rather than a dead checker.
 *
 * ## 🔴 The source of the names is graded, because the task file had it wrong
 *
 * DEF-002 §1(c) sourced the `pm-` ports from *"`PageInputs.pathParams` and the
 * `{braces}` in `Page.urlPath`"*. The adapter reads `pathParams` **and
 * `queryParams`**, and `urlPath` not at all. Both halves of that correction are
 * arms here: a wire to a **query** parameter must be accepted (the false
 * positive that description would have caused), and a name appearing only in a
 * `urlPath` brace must be refused (the false negative).
 *
 * @module noodl-editor/tests-unit/def-002/derived-port-targets
 */
import {
  checkDerivedPortTargets,
  derivedPortIndex,
  type DerivedPortNodeLike
} from '@noodl-models/../validation/derivedPortTargets';
import type { ConnectionLike } from '@noodl-models/../validation/connectionTargets';
import type { ComponentNodesView } from '@noodl-models/../validation/authoredCandidate';
import { DiagnosticCode } from '@noodl-models/../validation/diagnostics';

const COMPONENT = '/Pages/Join';
const FUNCTION_NAME = 'requestAccess';
const CLOUD_COMPONENT = `/#__cloud__/${FUNCTION_NAME}`;
const ANNOUNCEMENT_PAGE = '/Pages/Announcement';

/** A cloud function declaring 2 request params and 1 response param. */
function cloudFunctionComponent(): ComponentNodesView {
  return {
    name: CLOUD_COMPONENT,
    nodes: [
      { type: 'noodl.cloud.request', parameters: { params: 'name,email' } },
      { type: 'noodl.cloud.response', parameters: { params: 'received' } },
      { type: 'noodl.cloud.response', parameters: { status: 'failure', errorMessage: 'no' } }
    ]
  };
}

/** A page declaring one path parameter and one query parameter. */
function announcementPage(): ComponentNodesView {
  return {
    name: ANNOUNCEMENT_PAGE,
    nodes: [
      // 🔴 The brace in `urlPath` mints no port — the adapter never reads it.
      { type: 'Page', parameters: { urlPath: 'announcement/{fromTheUrlPathOnly}' } },
      { type: 'PageInputs', parameters: { pathParams: 'announcementId', queryParams: 'highlight' } }
    ]
  };
}

function index(...views: ComponentNodesView[]) {
  return derivedPortIndex(views);
}

function cloudCall(): DerivedPortNodeLike {
  return { id: 'send', type: 'CloudFunction2', label: 'requestAccess', parameters: { function: FUNCTION_NAME } };
}

function navigate(): DerivedPortNodeLike {
  return {
    id: 'goDetail',
    type: 'RouterNavigate',
    label: 'Open the announcement',
    parameters: { target: ANNOUNCEMENT_PAGE }
  };
}

function run(nodes: DerivedPortNodeLike[], wires: ConnectionLike[], views: ComponentNodesView[]) {
  return checkDerivedPortTargets(nodes, { component: COMPONENT, derived: index(...views), wires });
}

function codes(diagnostics: readonly { code: string }[]): string[] {
  return diagnostics.map((d) => d.code);
}

describe('DEF-002 §1(b) — CloudFunction2 in-…/out-… ports', () => {
  const views = () => [cloudFunctionComponent()];

  it('refuses a request parameter the function does not declare', () => {
    const found = run(
      [cloudCall()],
      [{ fromId: 'form', fromProperty: 'text', toId: 'send', toProperty: 'in-nameXX' }],
      views()
    );
    expect(codes(found)).toEqual([DiagnosticCode.ConnectionUnknownDerivedPort]);
    expect(found[0].alternatives).toEqual(['in-name', 'in-email']);
    expect(found[0].suggestion).toBe('in-name');
  });

  it('accepts the parameter the function does declare', () => {
    expect(
      run([cloudCall()], [{ fromId: 'form', fromProperty: 'text', toId: 'send', toProperty: 'in-name' }], views())
    ).toEqual([]);
  });

  it('refuses a result the response nodes do not declare, and accepts one they do', () => {
    expect(
      codes(run([cloudCall()], [{ fromId: 'send', fromProperty: 'out-nope', toId: 't', toProperty: 'text' }], views()))
    ).toEqual([DiagnosticCode.ConnectionUnknownDerivedPort]);
    expect(
      run([cloudCall()], [{ fromId: 'send', fromProperty: 'out-received', toId: 't', toProperty: 'text' }], views())
    ).toEqual([]);
  });

  /**
   * The static ports are the catalog's, not this check's. A rule that claimed
   * them would refuse `success`/`failure`/`error` on every correct graph — and
   * `failure` in particular is the port DEF-002 rule 2 is about.
   */
  it('says nothing about the unprefixed static ports', () => {
    expect(
      run(
        [cloudCall()],
        [
          { fromId: 'send', fromProperty: 'success', toId: 'ok', toProperty: 'show' },
          { fromId: 'send', fromProperty: 'failure', toId: 'bad', toProperty: 'show' },
          { fromId: 'btn', fromProperty: 'onClick', toId: 'send', toProperty: 'call' }
        ],
        views()
      )
    ).toEqual([]);
  });

  it('says nothing when the target component holds no request node to be wrong about', () => {
    const notAFunction: ComponentNodesView = { name: CLOUD_COMPONENT, nodes: [{ type: 'Group' }] };
    expect(
      run([cloudCall()], [{ fromId: 'f', fromProperty: 't', toId: 'send', toProperty: 'in-anything' }], [notAFunction])
    ).toEqual([]);
  });

  it('resolves the function by its bare name and by its full legacy name alike', () => {
    const byFullName: DerivedPortNodeLike = { ...cloudCall(), parameters: { function: CLOUD_COMPONENT } };
    expect(
      codes(run([byFullName], [{ fromId: 'f', fromProperty: 't', toId: 'send', toProperty: 'in-nameXX' }], views()))
    ).toEqual([DiagnosticCode.ConnectionUnknownDerivedPort]);
  });
});

describe('DEF-002 §1(c) — RouterNavigate pm-… ports', () => {
  const views = () => [announcementPage()];

  it('refuses a page parameter the target does not declare', () => {
    const found = run(
      [navigate()],
      [{ fromId: 'row', fromProperty: 'id', toId: 'goDetail', toProperty: 'pm-noSuchParam' }],
      views()
    );
    expect(codes(found)).toEqual([DiagnosticCode.ConnectionUnknownDerivedPort]);
    expect(found[0].alternatives).toEqual(['pm-announcementId', 'pm-highlight']);
  });

  it('accepts the path parameter the target declares', () => {
    expect(
      run(
        [navigate()],
        [{ fromId: 'row', fromProperty: 'id', toId: 'goDetail', toProperty: 'pm-announcementId' }],
        views()
      )
    ).toEqual([]);
  });

  /**
   * 🔴 The false positive the task file's description would have caused. A
   * checker reading only `pathParams` refuses this wire, and it is correct.
   */
  it('accepts a QUERY parameter — the half the task file omitted', () => {
    expect(
      run(
        [navigate()],
        [{ fromId: 'row', fromProperty: 'q', toId: 'goDetail', toProperty: 'pm-highlight' }],
        views()
      )
    ).toEqual([]);
  });

  /**
   * 🔴 The false negative the same description would have caused. A brace in
   * `Page.urlPath` mints no port; a checker that honoured it would accept a wire
   * that reaches nothing.
   */
  it('refuses a name that appears only in a Page.urlPath brace', () => {
    expect(
      codes(
        run(
          [navigate()],
          [{ fromId: 'row', fromProperty: 'x', toId: 'goDetail', toProperty: 'pm-fromTheUrlPathOnly' }],
          views()
        )
      )
    ).toEqual([DiagnosticCode.ConnectionUnknownDerivedPort]);
  });

  it('says nothing when the target page declares no PageInputs at all', () => {
    const bare: ComponentNodesView = { name: ANNOUNCEMENT_PAGE, nodes: [{ type: 'Page', parameters: {} }] };
    expect(
      run([navigate()], [{ fromId: 'r', fromProperty: 'i', toId: 'goDetail', toProperty: 'pm-anything' }], [bare])
    ).toEqual([]);
  });

  it('says nothing when the target does not resolve — unresolved-component-ref owns that', () => {
    expect(
      run([navigate()], [{ fromId: 'r', fromProperty: 'i', toId: 'goDetail', toProperty: 'pm-anything' }], [])
    ).toEqual([]);
  });
});

describe('DEF-002 §1(b)/§1(c) — the index reads the adapters, not a convenience', () => {
  /**
   * ⚠️ `parseNameList` splits on `,` **without trimming**, so `"a, b"` denotes
   * `a` and `" b"` and the port really is `pm- b`. A checker that helpfully
   * trimmed would refuse the port the editor actually made. This arm pins the
   * editor's behaviour rather than the tidy one.
   */
  it('does not trim, because the adapter does not', () => {
    const page: ComponentNodesView = {
      name: ANNOUNCEMENT_PAGE,
      nodes: [{ type: 'PageInputs', parameters: { pathParams: 'announcementId, highlight' } }]
    };
    expect(derivedPortIndex([page]).get(ANNOUNCEMENT_PAGE)?.pageParams).toEqual(['announcementId', ' highlight']);
  });

  it('unions the params of every response node, including the failure one', () => {
    const fn: ComponentNodesView = {
      name: CLOUD_COMPONENT,
      nodes: [
        { type: 'noodl.cloud.request', parameters: { params: 'a' } },
        { type: 'noodl.cloud.response', parameters: { params: 'ok' } },
        { type: 'noodl.cloud.response', parameters: { status: 'failure', params: 'reason' } }
      ]
    };
    expect(derivedPortIndex([fn]).get(FUNCTION_NAME)?.cloudOutputs).toEqual(['ok', 'reason']);
  });

  it('distinguishes "declares none" from "has no declaration"', () => {
    const empty: ComponentNodesView = {
      name: CLOUD_COMPONENT,
      nodes: [{ type: 'noodl.cloud.request', parameters: {} }]
    };
    const entry = derivedPortIndex([empty]).get(FUNCTION_NAME);
    expect(entry?.hasCloudRequest).toBe(true);
    expect(entry?.cloudInputs).toEqual([]);
    // A request node that declares nothing IS a declaration, so a wire to any
    // `in-…` port is refused — unlike a component with no request node at all.
    expect(
      codes(run([cloudCall()], [{ fromId: 'f', fromProperty: 't', toId: 'send', toProperty: 'in-x' }], [empty]))
    ).toEqual([DiagnosticCode.ConnectionUnknownDerivedPort]);
  });
});
