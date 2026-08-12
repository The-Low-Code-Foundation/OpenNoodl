/**
 * FUN-003 — the registry's two slots, and the one that must be cleared.
 *
 * The project half is republished on a debounce every time a parameter changes
 * anywhere in the graph (`models/CodeAuthoringContext/install.ts`), which is
 * every few keystrokes in a property field. The node half is written when a code
 * popout opens and cleared when it closes. Held in one object, the first erases
 * the second while an editor is open — so the interference test below is the
 * point of the design, not a detail of it.
 *
 * The acceptance criterion these stand in for is *"open node A, close, open node
 * B: B's editor never sees A's ports."* Driving that end to end needs the real
 * property panel; what is checkable headlessly is the registry contract the
 * drive depends on, which is exactly the half that can be got wrong silently.
 */
import {
  EMPTY_AUTHORING_CONTEXT,
  getCodeAuthoringContext,
  setCodeAuthoringContext,
  setOpenNodeContext,
  type CodeAuthoringContext,
  type OpenNodeFact
} from '@noodl-core-ui/components/code-editor/authoringContext';

const PROJECT: CodeAuthoringContext = {
  libraries: [{ name: 'Charting', global: 'Chart' }],
  variables: ['total'],
  objects: ['User'],
  arrays: ['Users']
};

const NODE_A: OpenNodeFact = {
  nodeId: 'node-a',
  typeName: 'JavaScriptFunction',
  declaredInputs: [{ name: 'Input_1', type: 'string' }],
  declaredOutputs: [{ name: 'Output_1', type: '*' }]
};

const NODE_B: OpenNodeFact = {
  nodeId: 'node-b',
  typeName: 'JavaScriptFunction',
  declaredInputs: [{ name: 'Celsius', type: 'number' }],
  declaredOutputs: [{ name: 'Fahrenheit', type: 'number' }]
};

describe('the open-node slot', () => {
  beforeEach(() => {
    setCodeAuthoringContext(null);
    setOpenNodeContext(null);
  });

  it('is absent until an editor opens', () => {
    expect(getCodeAuthoringContext()).toEqual(EMPTY_AUTHORING_CONTEXT);
    expect(getCodeAuthoringContext().openNode).toBeUndefined();
  });

  it('is readable once an editor publishes it', () => {
    setOpenNodeContext(NODE_A);
    expect(getCodeAuthoringContext().openNode).toEqual(NODE_A);
  });

  it('is gone once the popout clears it', () => {
    setOpenNodeContext(NODE_A);
    setOpenNodeContext(null);
    expect(getCodeAuthoringContext().openNode).toBeUndefined();
  });

  it('never lets node B see node A’s ports', () => {
    setOpenNodeContext(NODE_A);
    setOpenNodeContext(null); // popout closes
    setOpenNodeContext(NODE_B); // the next node's editor opens

    expect(getCodeAuthoringContext().openNode).toEqual(NODE_B);
    expect(getCodeAuthoringContext().openNode.declaredInputs).toEqual([{ name: 'Celsius', type: 'number' }]);
  });

  it('leaves nothing behind for an editor whose mode has no declared ports', () => {
    // A CSS Definition's `style` opened after a Function node. The producer
    // passes `null` rather than skipping the write, so "no ports here" overwrites
    // the previous node instead of inheriting it.
    setOpenNodeContext(NODE_A);
    setOpenNodeContext(null);
    expect(getCodeAuthoringContext().openNode).toBeUndefined();
  });
});

describe('the two slots do not overwrite each other', () => {
  beforeEach(() => {
    setCodeAuthoringContext(null);
    setOpenNodeContext(null);
  });

  it('keeps the project surface when a node is published', () => {
    setCodeAuthoringContext(PROJECT);
    setOpenNodeContext(NODE_A);

    const context = getCodeAuthoringContext();
    expect(context.variables).toEqual(['total']);
    expect(context.libraries).toEqual([{ name: 'Charting', global: 'Chart' }]);
    expect(context.openNode).toEqual(NODE_A);
  });

  it('survives a debounced project republish while an editor is open', () => {
    setOpenNodeContext(NODE_A);
    setCodeAuthoringContext(PROJECT); // a parameter changed somewhere in the graph

    expect(getCodeAuthoringContext().openNode).toEqual(NODE_A);
  });

  it('survives a project closing', () => {
    setOpenNodeContext(NODE_A);
    setCodeAuthoringContext(null);

    expect(getCodeAuthoringContext().openNode).toEqual(NODE_A);
    expect(getCodeAuthoringContext().variables).toEqual([]);
  });

  it('ignores an openNode smuggled in on the project half', () => {
    // The slot belongs to whoever opened the editor. A project refresh carrying
    // one would be a second, unsynchronised writer of the same field.
    setCodeAuthoringContext({ ...PROJECT, openNode: NODE_A });
    expect(getCodeAuthoringContext().openNode).toBeUndefined();
  });

  it('returns the same object between writes', () => {
    setCodeAuthoringContext(PROJECT);
    setOpenNodeContext(NODE_A);

    // Read per keystroke by every completion source, so it must not be rebuilt
    // per call.
    expect(getCodeAuthoringContext()).toBe(getCodeAuthoringContext());
  });
});
