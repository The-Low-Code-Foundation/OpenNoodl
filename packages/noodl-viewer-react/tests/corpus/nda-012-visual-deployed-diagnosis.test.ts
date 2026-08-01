/**
 * NDA-012 (Visual), check `B2` — does the diagnosis reach a **deployed** app?
 *
 * `B2` is the second leg of defect class B and it is not about whether a node has a `Failure`
 * *port* — that is `B1`, and `ERG-001` owns the whole Visual family's outcome ports as one
 * collision sweep. `B2` asks only whether the report exists in a runtime that is not the editor.
 * `context.editorConnection.sendWarning` fails that by construction: it is the editor bridge, so
 * every diagnosis an author leaned on while building vanished the moment the app shipped.
 *
 * The channel already exists — `FAILURE-CONTRACT.md`, built 2026-07-29, with `sendWarning`
 * demoted to one *subscriber* of it. So these fixes are re-pointing, not designing.
 *
 * Four `B2` cells were open. Two are closed here (`Group`, `Repeater`) and two are not:
 *
 * - ⚠️ **`Drag`'s cell is stale.** It reads "nothing is reported anywhere", which was true when
 *   filed and stopped being true in remediation stream B: the `G1` fix gave both snap-value
 *   ports `raiseRuntimeError('drag/snap-position-not-a-number', …)`, and the bus *is* the
 *   deployed channel. Re-derived by reading the node, not by trusting the cell. The `Do`-cannot-
 *   act condition it also mentions is `B1`'s port and stays with `ERG-001`.
 * - ⚠️ **`Page`'s cell records no mechanism at all** (its note is a dash). Read for one, the only
 *   thing `Page` silently fails at is `DV-vii` — its `Title` and `Url Path` ports are dead — and
 *   that is a prose defect the handover explicitly parks pending Richard, because making `Title`
 *   work means deciding whether the Page or the Router owns the document title. Not closed here,
 *   and deliberately not closed *quietly*.
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import NoodlRuntime from '@noodl/runtime';
import Model = require('@noodl/runtime/src/model');

(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

// The Group's React component pulls in three ES-module scroll plugins ts-jest will not
// transform. Same three mocks as `nda-012-visual-premount-actions.test.ts`.
jest.mock('../../src/components/visual/Group/scroll-plugins/nested-scroll-plugin', () => ({ default: class {} }));
jest.mock('../../src/components/visual/Group/scroll-plugins/patched-momentum-scroll', () => ({
  default: class {}
}));
jest.mock('../../src/components/visual/Group/scroll-plugins/slide-scroll-plugin', () => ({ default: class {} }));

/* eslint-disable @typescript-eslint/no-var-requires */
const GroupModule = require('../../src/nodes/visual/group').default;
const ForEachModule = require('../../src/nodes/std-library/data/foreach').default;
/* eslint-enable @typescript-eslint/no-var-requires */

const savedNoodlRuntimeInstance = (NoodlRuntime as unknown as { instance?: unknown }).instance;
beforeAll(() => {
  (NoodlRuntime as unknown as { instance?: unknown }).instance = { getProjectSettings: () => ({}) };
});
afterAll(() => {
  (NoodlRuntime as unknown as { instance?: unknown }).instance = savedNoodlRuntimeInstance;
});

interface DrivableNode extends NodeInstance {
  setInputValue(name: string, value: unknown): void;
  innerReactComponentRef: unknown;
  _flushPendingInnerActions(): void;
  _internal: Record<string, unknown>;
  /** Repeater methods these rows drive directly. */
  getTemplateForModel(model: unknown): string | undefined;
  reportTemplateProblem(code: string, message: string): void;
  registerInputIfNeeded(name: string): void;
}

async function build(module: { node: { name: string } }, parameters: Record<string, unknown> = {}) {
  const graph: CorpusGraph = await createCorpusGraph({
    modules: [module as never],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'under-test', type: module.node.name, parameters }] }]
    } as never
  });

  (graph.context as unknown as { styles: unknown }).styles = {
    getTextStyle: () => ({}),
    resolveColor: (c: unknown) => c
  };
  graph.update();

  return { graph, node: graph.node('under-test') as unknown as DrivableNode };
}

const codes = (graph: CorpusGraph) => graph.errors.map((e) => e.code);

describe('B2-a — Group reports an invalid Layout on a channel a deployed app has', () => {
  it('raises on the runtime error bus rather than only in the editor', async () => {
    const { graph, node } = await build(GroupModule);

    node.setInputValue('flexDirection', 'sideways');
    graph.update();

    expect(codes(graph)).toEqual(['group/layout-not-a-flex-direction']);
    expect(graph.errors[0].message).toContain('"sideways"');
    // The message has to say what *would* have worked; "invalid" on its own is the complaint
    // class B is about, one level up.
    expect(graph.errors[0].message).toContain('"row"');
  });

  it('carries the provenance the bus fills in, so the editor can still point at the node', async () => {
    const { graph, node } = await build(GroupModule);

    node.setInputValue('flexDirection', 'sideways');
    graph.update();

    expect(graph.errors[0].nodeId).toBe('under-test');
    expect(graph.errors[0].nodeType).toBe('Group');
  });

  // The controls. Both valid directions and the documented `'none'` escape must stay silent —
  // without these the setter could raise unconditionally and every row above would pass.
  it.each([['row'], ['column'], ['none']])('says nothing about %s', async (value) => {
    const { graph, node } = await build(GroupModule);

    node.setInputValue('flexDirection', value);
    graph.update();

    expect(codes(graph)).toEqual([]);
  });
});

describe('B2-b — Group says why a scroll did nothing', () => {
  /**
   * The component, constructed directly.
   *
   * `scrollToIndex`/`scrollToElement` are plain methods that touch only `scrollRef` and
   * `iScroll`, so a real mount buys nothing here and would need a DOM that this package's jest
   * environment (`node`) does not have. What is being measured is the *reason string*, which is
   * the whole of the new contract between the component and the node.
   */
  function groupComponent(children: unknown[]) {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { Group } = require('../../src/components/visual/Group/Group');
    /* eslint-enable @typescript-eslint/no-var-requires */

    const element = {
      children,
      contains: (el: unknown) => children.indexOf(el) !== -1,
      scrollIntoView: () => undefined
    };

    const instance = Object.create(Group.prototype);
    instance.scrollRef = { current: element };
    instance.iScroll = undefined;
    return { instance, element };
  }

  const child = (name: string) => ({ name, scrollIntoView: () => undefined });

  it('names the index and the length when the index is past the end', () => {
    const { instance } = groupComponent([child('a'), child('b')]);

    expect(instance.scrollToIndex(5, 0)).toContain('no child at index 5');
    expect(instance.scrollToIndex(5, 0)).toContain('the Group has 2');
  });

  it('says nothing when the child exists', () => {
    const { instance } = groupComponent([child('a'), child('b')]);

    expect(instance.scrollToIndex(1, 0)).toBeUndefined();
  });

  it('reports an element that is not inside this Group', () => {
    const { instance } = groupComponent([child('a')]);
    const stranger = child('elsewhere');

    const reason = instance.scrollToElement({ getRef: () => ({ current: stranger }) }, 0);

    // ⚠️ This is the sharp one. `scrollIntoView` scrolls the nearest scrollable *ancestor*, so
    // an element outside the Group does not error — it silently scrolls a different container,
    // which looks like the Group ignoring the action.
    expect(reason).toContain('not inside this Group');
  });

  it('reports a node that has not rendered a DOM element', () => {
    const { instance } = groupComponent([]);

    expect(instance.scrollToElement({ getRef: () => null }, 0)).toContain('no rendered DOM element');
  });

  it('scrolls, and says nothing, for an element it does contain', () => {
    const { instance, element } = groupComponent([]);
    const inside = child('inside');
    element.children.push(inside);

    expect(instance.scrollToElement({ getRef: () => ({ current: inside }) }, 0)).toBeUndefined();
  });

  // The control that keeps the Empty-Value Contract honest: an unwired `Element` is a port with
  // no opinion, not a failure, and must not raise.
  it('treats an unwired Element as no opinion rather than a failure', () => {
    const { instance } = groupComponent([]);

    expect(instance.scrollToElement(undefined, 0)).toBeUndefined();
  });
});

describe('B2-c — Repeater reports the three ways its template can fail', () => {
  it('raises when the Script does not compile', async () => {
    const { graph, node } = await build(ForEachModule, { templateType: 'dynamic' });

    node.setInputValue('templateScript', 'this is not javascript(');
    graph.update();

    expect(codes(graph)).toContain('repeater/template-script-syntax-error');
  });

  // ⚠️ Found by writing the row: a Script that stops compiling used to leave the *previous*
  // compiled function in place, so the Repeater kept rendering rows from code the author had
  // already replaced.
  it('drops the previous compiled function instead of silently still using it', async () => {
    const { graph, node } = await build(ForEachModule, { templateType: 'dynamic' });

    node.setInputValue('templateScript', 'component = "/A";');
    expect(node._internal.templateFunction).toBeDefined();

    node.setInputValue('templateScript', 'component = (');
    graph.update();

    expect(node._internal.templateFunction).toBeUndefined();
    expect(codes(graph)).toContain('repeater/template-script-syntax-error');
  });

  it('raises when the Script throws for an item rather than dropping the row silently', async () => {
    const { graph, node } = await build(ForEachModule, { templateType: 'dynamic' });

    node.setInputValue('templateScript', 'throw new Error("no component for this one");');
    graph.update();

    node.getTemplateForModel(Model.create({ id: 'a' }));

    expect(codes(graph)).toContain('repeater/template-script-threw');
    expect(graph.errors[graph.errors.length - 1].message).toContain('no component for this one');
  });

  // The control: a Script that compiles and returns a component must produce no diagnosis at
  // all. Without it every row above would pass against a node that raised unconditionally.
  it('says nothing when the Script compiles and returns a component', async () => {
    const { graph, node } = await build(ForEachModule, { templateType: 'dynamic' });

    node.setInputValue('templateScript', 'component = "/Item";');
    graph.update();

    expect(node.getTemplateForModel(Model.create({ id: 'a' }))).toBe('/Item');
    expect(codes(graph)).toEqual([]);
  });

  // ⚠️ `inputMappingScript` is a **dynamic** port — it exists only once
  // `registerInputIfNeeded` has been asked for it (`foreach.tsx:851`). Driving it without that
  // registers nothing, the setter never runs, and the row reads as "the fix does not work"
  // while measuring nothing at all.
  it('raises when the input mapping script does not compile', async () => {
    const { graph, node } = await build(ForEachModule);

    node.registerInputIfNeeded('inputMappingScript');
    node.setInputValue('inputMappingScript', 'map({ a: ');
    graph.update();

    expect(codes(graph)).toContain('repeater/input-mapping-syntax-error');
    expect(node._internal.inputMapFunc).toBeUndefined();
  });

  it('says nothing about an input mapping script that compiles', async () => {
    const { graph, node } = await build(ForEachModule);

    node.registerInputIfNeeded('inputMappingScript');
    node.setInputValue('inputMappingScript', 'map({ title: "name" });');
    graph.update();

    expect(codes(graph)).toEqual([]);
    expect(node._internal.inputMapFunc).toBeDefined();
  });
});

describe('B2-d — the report is raised once per rebuild, not once per item', () => {
  /**
   * A 5,000-row list whose Template names a missing component would otherwise raise 5,000
   * identical events. The editor's warning panel keys by code and would collapse them; the
   * `console.error` subscriber a deployed app uses would not, and the diagnosis this task exists
   * to deliver would arrive as a wall of noise.
   */
  it('collapses the same problem across items in one rebuild', async () => {
    const { graph, node } = await build(ForEachModule);

    node._internal.reportedTemplateProblems = new Set<string>();
    for (let i = 0; i < 50; i++) {
      node.reportTemplateProblem('repeater/template-component-not-found', 'the same problem');
    }

    expect(codes(graph)).toEqual(['repeater/template-component-not-found']);
  });

  it('still reports two different problems in the same rebuild', async () => {
    const { graph, node } = await build(ForEachModule);

    node._internal.reportedTemplateProblems = new Set<string>();
    node.reportTemplateProblem('repeater/template-component-not-found', 'one problem');
    node.reportTemplateProblem('repeater/no-template-for-item', 'a different problem');

    expect(codes(graph)).toEqual(['repeater/template-component-not-found', 'repeater/no-template-for-item']);
  });

  // Outside a rebuild there is no dedupe set — a one-off `add` on the bound collection is
  // exactly the case where one report is the right number, and swallowing it would be worse.
  it('reports when there is no rebuild in progress to dedupe against', async () => {
    const { graph, node } = await build(ForEachModule);

    node._internal.reportedTemplateProblems = undefined;
    node.reportTemplateProblem('repeater/no-template-for-item', 'a one-off add');
    node.reportTemplateProblem('repeater/no-template-for-item', 'a one-off add');

    expect(codes(graph)).toEqual(['repeater/no-template-for-item', 'repeater/no-template-for-item']);
  });
});
