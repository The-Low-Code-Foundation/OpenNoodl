/**
 * WFA-004 — the served catalog, translated into node types.
 *
 * The catalog's own SHAPE is asserted against a real running backend, in
 * `packages/nodegx-backend/tests/workflow-canvas-contract.test.ts` — the WF-003
 * pattern, so nothing here has to stand in for a served contract. What these
 * specs cover is the other half: given a catalog, does the translation produce
 * ports the canvas and the property editor can actually use.
 */

import {
  buildWorkflowNodeLibrary,
  isRoutePort,
  kindFromTypeName,
  PORT_IN,
  PORT_NEXT,
  PORT_ON_ERROR,
  PORT_TYPE_CONDITION,
  routeNameFromPort,
  routePortName,
  typeNameForKind,
  WORKFLOW_TYPE_PREFIX
} from '../../src/editor/src/models/workflow/workflowNodeLibrary';
import { WIRE_TYPE_ERROR } from '../../src/editor/src/views/nodegrapheditor/canvas/CanvasTheme';

import type { StepKindCatalog } from '../../src/editor/src/models/workflow/types';

const CATALOG: StepKindCatalog = {
  version: 'test',
  source: 'test',
  docs: 'test',
  valueLanguage: {},
  kinds: [
    {
      kind: 'call-function',
      displayName: 'Call Function',
      category: 'Workflow',
      source: 'WF-001',
      summary: 'Invokes a cloud function.',
      whenToUse: 'The workhorse step.',
      invokesFunction: true,
      params: [{ name: 'ref', type: 'string', required: true, description: 'The cloud function.' }],
      routes: [],
      output: ''
    },
    {
      kind: 'branch',
      displayName: 'Branch (IF)',
      category: 'Workflow Logic',
      source: 'CF11-001',
      summary: '',
      whenToUse: '',
      invokesFunction: false,
      params: [{ name: 'condition', type: 'condition', raw: true, required: true, description: 'A condition.' }],
      routes: [
        { name: 'ontrue', description: 'true' },
        { name: 'onfalse', description: 'false' }
      ],
      output: ''
    },
    {
      kind: 'switch',
      displayName: 'Switch',
      category: 'Workflow Logic',
      source: 'CF11-001',
      summary: '',
      whenToUse: '',
      invokesFunction: false,
      params: [
        { name: 'value', type: 'any', description: '' },
        { name: 'cases', type: 'array', raw: true, required: true, description: '' }
      ],
      routes: [
        { name: '<case label>', description: '', dynamic: true },
        { name: 'default', description: '' }
      ],
      output: ''
    },
    {
      kind: 'merge',
      displayName: 'Merge',
      category: 'Workflow Logic',
      source: 'CF11-001',
      summary: '',
      whenToUse: '',
      invokesFunction: false,
      params: [{ name: 'mode', type: 'enum', enums: ['all', 'any'], default: 'all', description: '' }],
      routes: [],
      output: ''
    }
  ]
};

function library() {
  return buildWorkflowNodeLibrary(CATALOG);
}

function typeFor(kind: string) {
  return library().nodetypes.find((t) => t.name === typeNameForKind(kind));
}

function portsOf(kind: string): { name: string; plug: string; type: unknown }[] {
  return (typeFor(kind) as unknown as { ports: { name: string; plug: string; type: unknown }[] }).ports;
}

describe('WFA-004 step kinds become node types', () => {
  it('namespaces every type name so nothing can collide with a runtime node', () => {
    for (const type of library().nodetypes) {
      expect(type.name.startsWith(WORKFLOW_TYPE_PREFIX)).toBe(true);
    }
    expect(kindFromTypeName(typeNameForKind('branch'))).toBe('branch');
    expect(kindFromTypeName('Text')).toBeUndefined();
  });

  it('gives every step one input, so an edge always has somewhere to land', () => {
    for (const kind of CATALOG.kinds) {
      const inputs = portsOf(kind.kind).filter((p) => p.plug === 'input' && p.name === PORT_IN);
      expect(inputs.length).toBe(1);
    }
  });

  it('gives every step a next and an onError output', () => {
    for (const kind of CATALOG.kinds) {
      const outputs = portsOf(kind.kind)
        .filter((p) => p.plug === 'output')
        .map((p) => p.name);
      expect(outputs).toContain(PORT_NEXT);
      expect(outputs).toContain(PORT_ON_ERROR);
    }
  });

  it('paints the error edge with the danger wire type — the one legitimate red', () => {
    const onError = portsOf('branch').find((p) => p.name === PORT_ON_ERROR);
    expect((onError.type as { name: string }).name).toBe(WIRE_TYPE_ERROR);
  });

  it('asks for the route name to be drawn on the wire, but not for the plain next edge', () => {
    // A card only grows a port row for a port that is ALREADY connected, so an
    // unlabelled branch would be unreadable. `next` stays unlabelled on purpose
    // — labelling every edge would drown the ones that carry meaning.
    const ontrue = portsOf('branch').find((p) => p.name === routePortName('ontrue'));
    expect((ontrue.type as { connectionLabel?: boolean }).connectionLabel).toBe(true);

    const next = portsOf('branch').find((p) => p.name === PORT_NEXT);
    expect(typeof next.type).toBe('string');
  });

  it('namespaces route ports, so a route may safely be called `next`', () => {
    expect(isRoutePort(routePortName('next'))).toBe(true);
    expect(routeNameFromPort(routePortName('next'))).toBe('next');
    expect(isRoutePort(PORT_NEXT)).toBe(false);
  });

  it('skips the dynamic route placeholder — those ports come per node, from its params', () => {
    const outputs = portsOf('switch')
      .filter((p) => p.plug === 'output')
      .map((p) => p.name);
    expect(outputs).toContain(routePortName('default'));
    expect(outputs).not.toContain(routePortName('<case label>'));
  });

  it('gives a condition param its own port type, so it never renders as a JSON textarea', () => {
    const condition = portsOf('branch').find((p) => p.name === 'condition');
    expect((condition.type as { name: string }).name).toBe(PORT_TYPE_CONDITION);
  });

  it('turns an enum param into an enum port with its values', () => {
    const mode = portsOf('merge').find((p) => p.name === 'mode');
    expect((mode.type as { name: string; enums: string[] }).name).toBe('enum');
    expect((mode.type as { enums: string[] }).enums).toEqual(['all', 'any']);
  });

  it('lifts `ref` out of the params into a first, named function port', () => {
    const inputs = portsOf('call-function').filter((p) => p.plug === 'input');
    const refPorts = inputs.filter((p) => p.name === 'ref');
    // Exactly one: the catalog lists it as a param AND it is a step field.
    expect(refPorts.length).toBe(1);
    expect(inputs[1].name).toBe('ref');
  });

  it('colours by the served category, using only the canvas taxonomy', () => {
    expect(typeFor('call-function').color).toBe('component');
    expect(typeFor('branch').color).toBe('logic');
  });

  it('builds a picker category per served category, listing its kinds', () => {
    const index = library().nodeIndex.coreNodes;
    const logic = index.find((c) => c.name === 'Workflow Logic');
    expect(logic).toBeDefined();
    expect(logic.subCategories[0].items).toContain(typeNameForKind('branch'));
    expect(logic.subCategories[0].items).toContain(typeNameForKind('switch'));
  });
});
