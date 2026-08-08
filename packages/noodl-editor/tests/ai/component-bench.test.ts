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
  benchInterface,
  benchParameters,
  buildBenchExport,
  type BenchInterface
} from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import { NodeGraphNode } from '../../src/editor/src/models/nodegraphmodel';
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

describe('BEN-001 the component interface, as the bench reads it', () => {
  it('reads declared inputs off the plug the runtime agrees with', () => {
    // ⚠️ The inversion: a component INPUT is a port on a Component Inputs node
    // whose own plug is "output". Phase-55 F8 and F23 are both this, and both
    // shipped. If this spec ever inverts, the rail goes empty and the outputs
    // rail fills up with things you are supposed to be able to type into.
    const iface = benchInterface(loadProject().getComponentWithName(SHARE_ITEM));

    expect(iface.inputs.map((p) => p.name).sort()).toEqual(['Icon Src Set', 'Label']);
    expect(iface.inputs.map((p) => p.name)).not.toContain('Do');
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

  it('serves the bench sample data, and none against a real backend', () => {
    const withData = buildBenchExport({ project: loadProject(), target: SHARE_ITEM });
    const shipped = (withData.json!.metadata as Record<string, SandboxDataset>).sandbox;
    expect(shipped).toBeDefined();
    expect(String(withData.summary)).toContain('Sample data');

    const real = buildBenchExport({ project: loadProject(), target: SHARE_ITEM, useSampleData: false });
    expect((real.json!.metadata as Record<string, unknown>).sandbox).toBeUndefined();
    expect(real.dataset).toBeUndefined();
    expect(String(real.summary)).toContain('Real backend');
  });

  it('takes the user’s own records, the same way the AI preview does (BEN-006)', () => {
    // One substrate, two clients. If this ever needs its own dialect, the
    // shared module has stopped being shared.
    const result = buildBenchExport({
      project: loadProject(),
      target: SHARE_ITEM,
      userData: { Articles: [{ title: 'A title I typed' }] }
    });

    const shipped = (result.json!.metadata as Record<string, SandboxDataset>).sandbox;
    expect(shipped.classes.Articles.records[0].title).toBe('A title I typed');
  });

  it('carries the frame through untouched instead of wrapping the graph in one', () => {
    // The deviation from BEN-001 §3, recorded as behaviour: the frame is the
    // size of the surface, not a Group injected into the graph. `sizeMode`
    // silently voids width/height and an unsized absolute Group fills its
    // parent — a wrapper that gets either wrong makes a correct component look
    // broken inside the tool built to tell you whether it is.
    const result = buildBenchExport({
      project: loadProject(),
      target: SHARE_ITEM,
      frame: { width: 320 },
      stretch: true
    });

    expect(result.frame).toEqual({ width: 320 });
    expect(result.stretch).toBe(true);
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
