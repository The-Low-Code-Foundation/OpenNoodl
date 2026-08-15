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
  subscribeToOpenNode,
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

/**
 * FIX-016 §2 follow-up — waking the editor that is already open.
 *
 * The wrinkle the drive found: message 5 says *"set its Type to Signal in the
 * property panel"*, the panel is behind the popout, and doing it left the message
 * standing. The node half was written once, at open. These pin the half of the
 * repair that lives here — that a republish for the **same node** is a change
 * anyone can hear, which is precisely the case a "write it on open" design has no
 * reason to treat as one.
 */
describe('the open-node subscription', () => {
  const NODE_A_SIGNALLED: OpenNodeFact = {
    ...NODE_A,
    declaredOutputs: [{ name: 'Output_1', type: 'signal' }]
  };

  beforeEach(() => {
    setCodeAuthoringContext(null);
    setOpenNodeContext(null);
  });

  it('wakes a listener when the same node is republished with a changed port type', () => {
    setOpenNodeContext(NODE_A);

    let woken = 0;
    const stop = subscribeToOpenNode(() => woken++);

    setOpenNodeContext(NODE_A_SIGNALLED);

    expect(woken).toBe(1);
    expect(getCodeAuthoringContext().openNode).toEqual(NODE_A_SIGNALLED);
    stop();
  });

  it('wakes a listener on a clear, so a subscriber cannot assume a node is there', () => {
    setOpenNodeContext(NODE_A);

    let seen: unknown = 'never called';
    const stop = subscribeToOpenNode(() => {
      seen = getCodeAuthoringContext().openNode;
    });

    setOpenNodeContext(null);

    expect(seen).toBeUndefined();
    stop();
  });

  it('does not wake anyone for a clear that clears nothing', () => {
    // Every editor whose mode has no declared ports clears an already-clear slot.
    // Waking a live editor to tell it nothing happened is how a signal earns
    // being ignored.
    let woken = 0;
    const stop = subscribeToOpenNode(() => woken++);

    setOpenNodeContext(null);
    setOpenNodeContext(null);

    expect(woken).toBe(0);
    stop();
  });

  it('does not wake anyone for a project-half write', () => {
    // The project half is republished on a debounce every few keystrokes. If it
    // woke the open editor, this seam would re-lint the document continuously.
    setOpenNodeContext(NODE_A);

    let woken = 0;
    const stop = subscribeToOpenNode(() => woken++);

    setCodeAuthoringContext(PROJECT);
    setCodeAuthoringContext(null);

    expect(woken).toBe(0);
    stop();
  });

  it('stops waking a listener that unsubscribed', () => {
    let woken = 0;
    const stop = subscribeToOpenNode(() => woken++);

    setOpenNodeContext(NODE_A);
    stop();
    setOpenNodeContext(NODE_B);

    expect(woken).toBe(1);
  });

  it('survives a listener that unsubscribes from inside its own call', () => {
    // An editor unmounting in response to what it just heard. Deleting from the
    // set being iterated is exactly what the copy in `setOpenNodeContext` is for.
    let woken = 0;
    let other = 0;

    const stopSelf = subscribeToOpenNode(() => {
      woken++;
      stopSelf();
    });
    const stopOther = subscribeToOpenNode(() => other++);

    setOpenNodeContext(NODE_A);
    setOpenNodeContext(NODE_B);

    expect(woken).toBe(1);
    expect(other).toBe(2);
    stopOther();
  });

  it('wakes every live listener, not just the first', () => {
    const woken: string[] = [];
    const stopOne = subscribeToOpenNode(() => woken.push('one'));
    const stopTwo = subscribeToOpenNode(() => woken.push('two'));

    setOpenNodeContext(NODE_A);

    expect(woken).toEqual(['one', 'two']);
    stopOne();
    stopTwo();
  });

  it('has already recomposed by the time a listener reads', () => {
    // The listener's whole job is to re-read. Notifying before the write landed
    // would hand it the value it already had.
    setOpenNodeContext(NODE_A);

    let readBack: unknown = null;
    const stop = subscribeToOpenNode(() => {
      readBack = getCodeAuthoringContext().openNode;
    });

    setOpenNodeContext(NODE_A_SIGNALLED);

    expect(readBack).toEqual(NODE_A_SIGNALLED);
    stop();
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
