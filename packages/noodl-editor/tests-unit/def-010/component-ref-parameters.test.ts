/**
 * DEF-010 (SB-009) — a component named in a `component`-typed parameter is
 * checked by the authored gate.
 *
 * Every firing arm has a non-firing pair one variable away — a rule that fires
 * on both arms has measured nothing. The population is the catalog's thirteen
 * component-typed ports minus `For Each.template`, whose owner is
 * `checkRepeaterTemplate`; the cardinality arm at the bottom runs the FULL
 * composed precondition set and asserts the `For Each` case yields exactly one
 * diagnostic — a check in a second pipeline is a duplicate first, and this arm
 * is the one that reddens the day somebody removes the skip.
 *
 * SB-009 AC4's generic-proof arm is `Show Popup`: the check must not quietly be
 * a `RunTasks` special case.
 *
 * @module noodl-editor/tests-unit/def-010/component-ref-parameters
 */
import { authoredPreconditionDiagnostics, isBlockingForAuthoredOutput } from '@noodl-models/../validation/authoredCandidate';
import { CatalogIndex } from '@noodl-models/../validation/CatalogIndex';
import { defaultCatalog } from '@noodl-models/../validation/catalog';
import { checkComponentRefParameters } from '@noodl-models/../validation/componentRefParameters';
import { DiagnosticCode } from '@noodl-models/../validation/diagnostics';

const CATALOG = new CatalogIndex(defaultCatalog());

const CLOUD_HOST = '/#__cloud__/publishPage';
const BROWSER_HOST = '/Pages/Home';
const CLOUD_HELPER = '/#__cloud__/site/SetSectionAccess';
const BROWSER_CARD = '/Components/Card';
const COMPONENTS = [CLOUD_HOST, BROWSER_HOST, CLOUD_HELPER, BROWSER_CARD];

function runTasks(taskTemplate: string) {
  return { id: 'rt', type: 'RunTasks', parameters: { taskTemplate } };
}

describe('DEF-010 — component-typed parameters resolve, or the author is told', () => {
  it('fires on a cloud Run Tasks naming a helper the project does not have', () => {
    const found = checkComponentRefParameters([runTasks('/#__cloud__/NoSuchHelper')], {
      component: CLOUD_HOST,
      components: COMPONENTS,
      catalog: CATALOG
    });
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.ComponentParameterUnresolved);
    expect(found[0].location).toMatchObject({ nodeId: 'rt', port: 'taskTemplate', plug: 'input' });
    // The rejection names alternatives, the way the repeater's owner does.
    expect(found[0].alternatives).toContain(CLOUD_HELPER);
  });

  it('…and is silent when the same value resolves (the pair)', () => {
    const found = checkComponentRefParameters([runTasks(CLOUD_HELPER)], {
      component: CLOUD_HOST,
      components: COMPONENTS,
      catalog: CATALOG
    });
    expect(found).toEqual([]);
  });

  it('reuses wrong-runtime-node for a browser component in a cloud graph — SB-009 arm D', () => {
    const found = checkComponentRefParameters([runTasks(BROWSER_CARD)], {
      component: CLOUD_HOST,
      components: COMPONENTS,
      catalog: CATALOG
    });
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.WrongRuntimeNode);
    // Already in AUTHORED_BLOCKING_WARNINGS since SB-001 — the cross-runtime
    // half needs no corpus decision, and this pins that it really blocks.
    expect(isBlockingForAuthoredOutput(found[0])).toBe(true);
  });

  it('…and the mirror: a browser Show Popup naming a cloud function', () => {
    const found = checkComponentRefParameters(
      [{ id: 'pop', type: 'NavigationShowPopup', parameters: { target: CLOUD_HELPER } }],
      { component: BROWSER_HOST, components: COMPONENTS, catalog: CATALOG }
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.WrongRuntimeNode);
  });

  it('AC4 — Show Popup naming a missing component fires: the check is generic, not a RunTasks case', () => {
    const found = checkComponentRefParameters(
      [{ id: 'pop', type: 'NavigationShowPopup', parameters: { target: '/Components/Gone' } }],
      { component: BROWSER_HOST, components: COMPONENTS, catalog: CATALOG }
    );
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.ComponentParameterUnresolved]);
  });

  it('a wired port is skipped — the convention every value check here follows', () => {
    const found = checkComponentRefParameters([runTasks('/#__cloud__/NoSuchHelper')], {
      component: CLOUD_HOST,
      components: COMPONENTS,
      catalog: CATALOG,
      connectedInputs: new Set(['rt::taskTemplate'])
    });
    expect(found).toEqual([]);
  });

  it('a node the catalog does not know is skipped — unknownTypeSkip owns that notice', () => {
    const found = checkComponentRefParameters(
      [{ id: 'x', type: 'com.example.Mystery', parameters: { taskTemplate: '/#__cloud__/NoSuchHelper' } }],
      { component: CLOUD_HOST, components: COMPONENTS, catalog: CATALOG }
    );
    expect(found).toEqual([]);
  });

  it('components omitted: resolution is not checked, the runtime comparison still is', () => {
    const found = checkComponentRefParameters([runTasks(BROWSER_CARD)], {
      component: CLOUD_HOST,
      catalog: CATALOG
    });
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.WrongRuntimeNode]);
    expect(
      checkComponentRefParameters([runTasks('/#__cloud__/NoSuchHelper')], { component: CLOUD_HOST, catalog: CATALOG })
    ).toEqual([]);
  });

  it('unresolved is a warning that BLOCKS authored output — promoted on the corpus number', () => {
    const [d] = checkComponentRefParameters([runTasks('/#__cloud__/NoSuchHelper')], {
      component: CLOUD_HOST,
      components: COMPONENTS,
      catalog: CATALOG
    });
    expect(d.severity).toBe('warning');
    // 🔴 Promoted 2026-08-29 with the sweep its task demanded (SB-009 AC5):
    // `calibrate:door` over 178 projects — 614 component-typed parameters,
    // 15 hits in 6 projects, every sampled one a true positive in a legacy
    // hand-authored project. Pinned HERE and in AUTHORED_BLOCKING_WARNINGS
    // together so a demotion is a deliberate pair of edits with a number.
    expect(isBlockingForAuthoredOutput(d)).toBe(true);
  });

  it('CARDINALITY — the For Each case yields exactly one diagnostic through the FULL composed set', () => {
    const nodes = [
      { id: 'g', type: 'Group' },
      {
        id: 'rep',
        type: 'For Each',
        parameters: { templateType: 'explicit', template: '/Components/NoSuchComponent' }
      }
    ];
    const all = authoredPreconditionDiagnostics({
      component: BROWSER_HOST,
      nodes,
      components: COMPONENTS,
      catalog: CATALOG
    });
    const aboutTemplate = all.filter((d) => d.location?.nodeId === 'rep');
    expect(aboutTemplate.map((d) => d.code)).toEqual([DiagnosticCode.RepeaterTemplateUnresolved]);
    // The generic check stayed out of the owned pair entirely.
    expect(all.some((d) => d.code === DiagnosticCode.ComponentParameterUnresolved)).toBe(false);
  });
});
