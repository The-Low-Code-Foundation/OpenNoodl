/**
 * BEN-001 — the component bench's harness.
 *
 * The thing under test is one claim: **a component mounted as root has no
 * parent, so nothing ever sets its inputs**, and a synthetic parent fixes that
 * with no runtime change. Everything else here defends the two rules that stop
 * the bench becoming the defect it exists to expose — the parameter set is
 * built from the interface and never from a caller's free-form object, and
 * building one still touches nothing.
 */

import {
  BENCH_COMPONENT_NAME,
  BENCH_NODE_ID,
  benchHarness,
  benchInstanceUsage,
  benchInterface,
  benchParameters,
  buildBenchExport,
  type BenchInterface
} from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import { NodeGraphNode } from '../../src/editor/src/models/nodegraphmodel';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import type { SandboxDataset } from '@noodl/runtime/src/sandbox/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

/** A visual component with a real declared interface: two inputs, one output. */
const SHARE_ITEM = '/Pop-ups/Share/Share Item';

/**
 * A component with no visual root at all — the case `buildSandboxExport`
 * refuses and the bench must not. Its interface is `Do` (a signal) and `Slug`.
 */
const LOGIC_ONLY = '/Logic Components/Get Article From Slug';

function loadProject(): ProjectModel {
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

function rootNodeOf(json: { components: Array<{ name: string; nodes?: TSFixme[] }> }) {
  const harness = json.components.find((c) => c.name === BENCH_COMPONENT_NAME)!;
  return harness.nodes![0];
}

/**
 * The bench reads an interface through `node.type`, and that resolves against
 * the **global** `NodeLibrary`: a `Component Inputs` node whose type the library
 * has never heard of gets `getUnknownNodeType()`, which carries no
 * `haveComponentPorts`, so `ComponentModel.getPorts()` walks straight past it
 * and every interface below comes back empty — inputs `[]`, and therefore no
 * parameters on the mounted node either.
 *
 * Nothing loads that library at start-up. Thirteen other suites in this bundle
 * each install the fixture blob in their own setup, and this file used to rely
 * on one of them having been drawn first. Under randomised order (DEBT-005) that is a coin
 * toss, and CI tossed it: run 32475542268, seed 22715 — the harness-export specs
 * ran at ordinal 208, the earliest library-loading suite at 508, and three specs
 * failed with `inputs.length = 0`. The *same* assertion passed at ordinal 574 in
 * the same run, from the interface describe below, which had only ever passed
 * because it happened to be drawn late. Same tree at seed 69883: BEN-001 landed
 * at 1009, all green, 10 failures — the floor.
 *
 * Nothing to restore afterwards: this installs the same shared fixture blob
 * those thirteen do, and `loadLibrary()` touches no registered module.
 */
function loadNodeLibrary() {
  window.NodeLibraryData = require('../nodegraph/nodelibrary');
  NodeLibrary.instance.loadLibrary();

  // An empty interface is indistinguishable from a component that declares
  // nothing, so fail here — where the cause is — rather than in an assertion
  // about ports.
  expect(NodeLibrary.instance.getNodeTypeWithName('Component Inputs')).toBeDefined();
}

describe('BEN-001 the component interface, as the bench reads it', () => {
  beforeEach(loadNodeLibrary);

  it('reads declared inputs off the plug the runtime agrees with', () => {
    // ⚠️ TWO inversions, not one, and the first draft of this module got it
    // wrong because it stopped at the first — as does the BEN-001 task file.
    //
    //   1. the port DECLARED on the Component Inputs node carries plug
    //      "output" — it is an output of that node (LAS-001, phase-55 F8/F23);
    //   2. `getPorts()` REPUBLISHES it as plug "input", because to an instance
    //      of the component it is an input.
    //
    // The runtime settles which one anything downstream means:
    // `noodl-runtime/src/models/componentmodel.ts` reads the exported ports
    // array — `getPorts()` verbatim — and calls `addInputPort` for
    // plug === 'input'. Get this backwards and the inputs rail goes empty while
    // the outputs rail fills with the things you are meant to type into.
    const component = loadProject().getComponentWithName(SHARE_ITEM);

    // What the fixture declares, so the two ends are visible in one place.
    const declared: Record<string, string> = {};
    component.graph.forEachNode((node: TSFixme) => {
      for (const port of node.ports ?? []) declared[`${node.typename} ${port.name}`] = port.plug;
    });
    expect(declared['Component Inputs Label']).toBe('output');
    expect(declared['Component Outputs Click']).toBe('input');

    // …and what `getPorts()` makes of them: the other way round, both times.
    const iface = benchInterface(component);
    expect(iface.inputs.map((p) => p.name).sort()).toEqual(['Icon Src Set', 'Label']);
    expect(iface.outputs.map((p) => p.name)).toEqual(['Click']);
    expect(iface.backwards).toEqual([]);
  });

  it('gives a logic-only component an interface too', () => {
    const iface = benchInterface(loadProject().getComponentWithName(LOGIC_ONLY));
    expect(iface.inputs.map((p) => p.name).sort()).toEqual(['Do', 'Slug']);
  });

  it('degrades to untyped rather than guessing, for an input wired to nothing', () => {
    // `getPorts` derives type from *connections* and returns '*' with no default
    // when it cannot. On the corpus that is the normal path, not the edge case,
    // so the rail has to render it — labelled — instead of inventing a type.
    const iface = benchInterface(loadProject().getComponentWithName(SHARE_ITEM));
    const untyped = iface.inputs.filter((p) => p.type === '*' || p.type === undefined);

    expect(untyped.length > 0).toBe(true);
    for (const port of untyped) expect(port.default).toBeUndefined();
  });
});

describe('BEN-001 the parameter set is built from the interface', () => {
  const IFACE: BenchInterface = {
    inputs: [
      { name: 'title', type: 'string', index: 0 },
      { name: 'subtitle', type: 'string', default: 'A subtitle', index: 1 },
      { name: 'count', type: 'number', default: 3, index: 2 }
    ],
    outputs: [],
    backwards: []
  };

  it('sets every input the caller supplied', () => {
    const { parameters, unknown } = benchParameters(IFACE, { title: 'Hello', count: 9 });
    expect(parameters.title).toBe('Hello');
    expect(parameters.count).toBe(9);
    expect(unknown).toEqual([]);
  });

  it('falls back to a derived default, so an unset input previews like an unwired page', () => {
    const { parameters } = benchParameters(IFACE, { title: 'Hello' });
    expect(parameters.subtitle).toBe('A subtitle');
    expect(parameters.count).toBe(3);
  });

  it('leaves an input with no value and no default unset, rather than setting it to nothing', () => {
    const { parameters } = benchParameters(IFACE, {});
    expect(Object.prototype.hasOwnProperty.call(parameters, 'title')).toBe(false);
  });

  it('treats undefined as abstaining, not as blanking', () => {
    // The Empty-Value Contract: "I have not set this" is not "set this to
    // nothing", and letting undefined through would shadow the default.
    const { parameters } = benchParameters(IFACE, { subtitle: undefined });
    expect(parameters.subtitle).toBe('A subtitle');
  });

  it('drops a key that names no declared input, and says so', () => {
    // LAS-001 / phase-55 F2: a parameter aimed at a port that does not exist
    // renders nothing and used to be reported as nothing. Passing it through
    // here would reproduce that defect inside the tool built to expose it.
    const { parameters, unknown } = benchParameters(IFACE, { title: 'Hello', nmae: 'typo' });
    expect(Object.prototype.hasOwnProperty.call(parameters, 'nmae')).toBe(false);
    expect(unknown).toEqual(['nmae']);
  });

  it('keeps an explicitly falsy value, which is a value and not an absence', () => {
    const { parameters } = benchParameters(IFACE, { title: '', count: 0 });
    expect(parameters.title).toBe('');
    expect(parameters.count).toBe(0);
  });
});

describe('BEN-001 the harness export', () => {
  beforeEach(loadNodeLibrary);

  it('mounts the component as a child of a synthetic parent, with its inputs set', () => {
    // The whole task in one assertion: `rootComponent` is the harness, not the
    // target, and the target is an instance carrying parameters — which is the
    // only arrangement in which a `Component Inputs` port has a source.
    const result = buildBenchExport({
      project: loadProject(),
      target: SHARE_ITEM,
      inputs: { Label: 'Copy link' }
    });

    expect(result.json!.rootComponent).toBe(BENCH_COMPONENT_NAME);
    expect(result.json!.rootNode).toBe(BENCH_NODE_ID);

    const node = rootNodeOf(result.json!);
    expect(node.id).toBe(BENCH_NODE_ID);
    expect(node.type).toBe(SHARE_ITEM);
    expect(node.parameters.Label).toBe('Copy link');
  });

  it('ships the target and everything it instantiates alongside the harness', () => {
    const result = buildBenchExport({ project: loadProject(), target: SHARE_ITEM });
    const names = result.json!.components.map((c) => c.name);

    expect(names).toContain(BENCH_COMPONENT_NAME);
    // Without the target in the export the runtime boots a harness whose only
    // node is a component type it has never heard of.
    expect(names).toContain(SHARE_ITEM);
  });

  it('accepts either spelling of the component reference', () => {
    const withSlash = buildBenchExport({ project: loadProject(), target: SHARE_ITEM });
    const without = buildBenchExport({ project: loadProject(), target: SHARE_ITEM.slice(1) });

    expect(rootNodeOf(without.json!).type).toBe(rootNodeOf(withSlash.json!).type);
  });

  it('names a dropped key in the summary rather than swallowing it', () => {
    const result = buildBenchExport({
      project: loadProject(),
      target: SHARE_ITEM,
      inputs: { Lable: 'typo' }
    });

    expect(rootNodeOf(result.json!).parameters.Lable).toBeUndefined();
    expect(result.summary).toContain('"Lable"');
    expect(result.summary).toContain('not a declared input');
  });

  it('hands back the interface, so the rail does not re-derive it', () => {
    const result = buildBenchExport({ project: loadProject(), target: SHARE_ITEM });
    expect(result.interface!.inputs.map((p) => p.name).sort()).toEqual(['Icon Src Set', 'Label']);
  });

  it('mounts a logic-only component instead of refusing it', () => {
    // `buildSandboxExport` returns `unrenderable` here, which is right for a
    // review document and wrong for a bench: a logic-only component is exactly
    // what the outputs read-out exists to show, and this is the first time in
    // the product's history that one is previewable at all.
    const result = buildBenchExport({
      project: loadProject(),
      target: LOGIC_ONLY,
      inputs: { Slug: 'a-slug' }
    });

    expect(result.unrenderable).toBeUndefined();
    expect(result.json).toBeDefined();
    expect(rootNodeOf(result.json!).parameters.Slug).toBe('a-slug');
    expect(result.summary).toContain('no visual root');
  });

  it('says so rather than throwing when the component is not in the project', () => {
    const result = buildBenchExport({ project: loadProject(), target: '/Nope/Not Here' });
    expect(result.json).toBeUndefined();
    expect(result.unrenderable).toContain('/Nope/Not Here');
  });

  it('never produces two components under the harness name', () => {
    // Unreachable by design — `#` is not a legal folder character, so no user
    // can author into this namespace — but two components with one name in an
    // export is a runtime coin toss, so it is filtered and pinned rather than
    // argued about.
    const project = loadProject();
    const collider = project.getComponentWithName(SHARE_ITEM);
    collider.name = BENCH_COMPONENT_NAME;

    const names = buildBenchExport({ project, target: BENCH_COMPONENT_NAME }).json!.components.map((c) => c.name);
    expect(names.filter((n) => n === BENCH_COMPONENT_NAME).length).toBe(1);
  });

  it('builds a preview without touching the project', () => {
    // The invariant AIX-002 built the whole staging contract around, and R5 for
    // this phase: typing in an input field must not dirty the project.
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const componentsBefore = project.getComponents().length;

    buildBenchExport({ project, target: SHARE_ITEM, inputs: { Label: 'Copy link' } });

    expect(JSON.stringify(project.toJSON())).toEqual(before);
    expect(project.getComponents().length).toBe(componentsBefore);
    expect(project.getComponentWithName(BENCH_COMPONENT_NAME)).toBeFalsy();
  });

  it('serves the bench a sandbox with no rows in it, and never the real backend (FIX-013 1(c))', () => {
    const withData = buildBenchExport({ project: loadProject(), target: SHARE_ITEM });
    const shipped = (withData.json!.metadata as Record<string, SandboxDataset>).sandbox;

    // 🔴 THE CONTROL, and the whole distinction this ruling turns on: the
    // dataset is still SHIPPED. `emptyState` empties the sandbox; it does not
    // remove it. A missing `sandbox` key here would mean the shim was never
    // installed and the preview is talking to the project's live backend —
    // AC3's violation wearing the same "no data" description.
    expect(shipped).toBeDefined();

    // The classes the walk MISSED are served empty, which is the half a
    // `records: []` cannot express on its own: `SandboxStore.list()` invents
    // five records for any class it has never heard of, so without this the
    // empty state would be a lie on exactly the components most likely to want
    // one.
    //
    // ⚠️ This carries the spec alone on purpose. `ShareItem` reads no
    // collections, so a `for (const k of Object.values(classes))` loop asserting
    // `records.length === 0` here would iterate **zero times** and pass without
    // measuring anything. The populated case is pinned in the next spec, which
    // supplies a class rather than hoping the fixture has one.
    expect(Object.keys(shipped.classes).length).toBe(0);
    expect(shipped.synthesizeMissing).toBe(false);

    expect(String(withData.summary)).toContain('No sample data');
    expect(String(withData.summary)).not.toContain('Sample data —');

    // Ruling 4's non-destructive branch: `useSampleData` survives as a
    // programmatic option with no UI, so this path is unchanged. It is the one
    // way to reach a real backend, and nothing the bench renders can now ask
    // for it.
    const real = buildBenchExport({ project: loadProject(), target: SHARE_ITEM, useSampleData: false });
    expect((real.json!.metadata as Record<string, unknown>).sandbox).toBeUndefined();
    expect(real.dataset).toBeUndefined();
    expect(String(real.summary)).toContain('Real backend');
  });

  it('serves a named class empty, and a class it never heard of empty too (FIX-013 1(c))', () => {
    // 🔴 **`ShareItem` reads no collections at all** — measured, not assumed:
    // the assertion below fails as `0 to be greater than 0` if that ever
    // changes. That is not a weak fixture, it is *the reported one*: the bug
    // report's `CategoryCard` reads no collections either, which is why its
    // Data panel had literally nothing to edit.
    //
    // It also means the class map is EMPTY here, and an empty map is the one
    // shape that defeats this whole mode on its own: `SandboxStore.list()`
    // invents five records for a class it has never heard of, so a dataset
    // naming nothing would serve five rows per class queried — *more* invented
    // data than before the change meant to remove it. On this component
    // `synthesizeMissing: false` is the only thing standing in the way.
    const bare = buildBenchExport({ project: loadProject(), target: SHARE_ITEM });
    const bareShipped = (bare.json!.metadata as Record<string, SandboxDataset>).sandbox;
    expect(Object.keys(bareShipped.classes).length).toBe(0);
    expect(bareShipped.synthesizeMissing).toBe(false);

    // The other half: a class that DOES exist is named, keeps its field list,
    // and is served empty — being named is what stops the store inventing it,
    // and the fields survive so anything reading the shape still can. Supplied
    // through `userData` because the graph walk finds none for this component.
    //
    // BEN-006's data editor was deleted with the toolbar, so nothing on the
    // bench can put records here any more; a caller passing them
    // programmatically still gets the empty state, because a row the user typed
    // is still a row.
    const withUserData = buildBenchExport({
      project: loadProject(),
      target: SHARE_ITEM,
      userData: { Articles: [{ title: 'A title I typed' }] }
    });
    const withUser = (withUserData.json!.metadata as Record<string, SandboxDataset>).sandbox;
    expect(Object.keys(withUser.classes)).toContain('Articles');
    expect(withUser.classes.Articles.records).toEqual([]);
    expect(withUser.classes.Articles.fields).toContain('title');
  });

  it('does not wrap the graph in a frame', () => {
    // The deviation from BEN-001 §3, recorded as behaviour: the frame is the
    // size of the surface, not a Group injected into the graph. `sizeMode`
    // silently voids width/height and an unsized absolute Group fills its
    // parent — a wrapper that gets either wrong makes a correct component look
    // broken inside the tool built to tell you whether it is.
    //
    // 🔴 **This spec used to pass a `frame`/`stretch` pair in and assert them
    // back out, and that half of it has been deleted by FIX-011.** It looked
    // like coverage of the frame and was coverage of an echo: nothing in the
    // product ever passed those arguments and nothing ever read the result, so
    // the assertion held for as long as the feature did not exist. What is
    // load-bearing here is the *absence* of a wrapper, which is the sentence
    // above and is what remains.
    const result = buildBenchExport({ project: loadProject(), target: SHARE_ITEM });

    // One node in the harness, and it is the component. No wrapper.
    const harness = result.json!.components.find((c) => c.name === BENCH_COMPONENT_NAME) as TSFixme;
    expect(harness.nodes.length).toBe(1);
    expect(rootNodeOf(result.json!).children.length).toBe(0);
  });

  it('does not hang on a component that instantiates itself', () => {
    // `componentClosure` caps at MAX_CLOSURE_DEPTH; this pins that the cap is
    // reached through the harness too, so a self-reference finishes rather than
    // spinning a CPU.
    const project = loadProject();
    const target = project.getComponentWithName(SHARE_ITEM);
    target.graph.addRoot(NodeGraphNode.fromJSON({ id: 'self', type: SHARE_ITEM, x: 0, y: 0 } as TSFixme));

    const result = buildBenchExport({ project, target: SHARE_ITEM });
    expect(result.json).toBeDefined();
  });
});

describe('BEN-001 the harness itself', () => {
  it('is one node, of the target’s type, and owned by nobody', () => {
    const harness = benchHarness('/Components/Card', { title: 'Hello' });

    expect(harness.name).toBe(BENCH_COMPONENT_NAME);
    expect(harness.graph.roots.length).toBe(1);
    expect(harness.graph.roots[0].id).toBe(BENCH_NODE_ID);
    expect(harness.graph.roots[0].parameters.title).toBe('Hello');
    expect(harness.owner).toBeFalsy();
  });
});

/**
 * BEN-002 — the evidence the empty inputs rail shows instead of nothing.
 *
 * "This component declares no inputs" is true and useless on its own. If places
 * in the project are already passing parameters to it, the component does not
 * lack an interface — its interface is backwards (LAS-001), those parameters are
 * landing on ports that do not exist, and the emptiness is a symptom.
 */
describe('BEN-002 how the project already uses the mounted component', () => {
  const PILL = '/Visual Components/Pills/Other Symptom Pill';
  const TRACKING = '/Logic Components/Tracking';

  it('counts the instances passing parameters, and names the parameters', () => {
    const usage = benchInstanceUsage(loadProject(), PILL);

    expect(usage.instances).toBe(3);
    expect(usage.withParameters).toBe(3);
    expect(usage.parameterNames).toContain('Symptom Bucket');
  });

  it('counts instances that pass nothing without claiming they pass something', () => {
    const usage = benchInstanceUsage(loadProject(), TRACKING);

    expect(usage.instances).toBe(2);
    expect(usage.withParameters).toBe(0);
    expect(usage.parameterNames).toEqual([]);
  });

  it('accepts either spelling, like everything else that resolves a component', () => {
    expect(benchInstanceUsage(loadProject(), PILL.slice(1)).instances).toBe(3);
  });

  it('reports nothing rather than throwing for a component that is not there', () => {
    expect(benchInstanceUsage(loadProject(), '/Nope/Not Here')).toEqual({
      instances: 0,
      withParameters: 0,
      parameterNames: []
    });
  });

  it('does not count the component inside itself', () => {
    // A self-instantiating component would otherwise inflate its own usage
    // count, and the number exists to say "other places rely on this".
    const project = loadProject();
    const target = project.getComponentWithName(PILL);
    target.graph.addRoot(
      NodeGraphNode.fromJSON({ id: 'self', type: PILL, x: 0, y: 0, parameters: { 'Symptom Bucket': 'x' } } as TSFixme)
    );

    expect(benchInstanceUsage(project, PILL).instances).toBe(3);
  });
});
