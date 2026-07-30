/**
 * NDA-010 §1 (re-scoped) — typing the close results.
 *
 * **The section's original premise was stale and the correction is written into the spec**: Show
 * Popup already derives `popupParam-*` from the target component's `inputPorts`, carrying each
 * input's declared type. What it did *not* do is type the other direction — `closeResult-*` ports
 * were pushed as `'*'` — so **one half of the popup boundary type-checked and the other did not**.
 *
 * `'*'` accepts every connection, which is defect class E reached from the far side: a result that
 * is really a `number` cannot be told apart from one that is really a `string`, and nothing on the
 * canvas or in the catalog says which it is.
 *
 * The fix takes the type from the popup component's output port of the same name where one exists,
 * falling back to `'*'`. `foreach.tsx:797-798` reads a target component's `outputPorts` this way
 * already, so it is an existing pattern rather than a new coupling — and the fallback means no graph
 * that works today stops working.
 *
 * **These are `setup`-time rows.** `graph-harness` never calls a node module's `setup` and says so
 * in its own comment, so everything the editor derives is untested by the ordinary corpus unless the
 * `setup` is driven against a fake graph model. Same shape as NDA-009's J-rows.
 *
 * ⚠️ What this does **not** close, and the spec records it as a decision rather than a gap:
 * the result *names* still come from Close Popup's hand-typed `results` stringlist. Deriving those
 * from the component's output ports would change what a popup's Component Outputs mean, which is a
 * design question, not a patch.
 */

/* eslint-env jest */

import ShowPopupModule from '../../../noodl-viewer-react/src/nodes/navigation/showpopup';

interface RecordedPort {
  name: string;
  displayName: string;
  type: unknown;
  plug: string;
  group: string;
}

/** The minimum of `EventEmitter` that `setup` reaches for. */
function emitter() {
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {};
  return {
    on(event: string, cb: (arg?: unknown) => void) {
      (listeners[event] = listeners[event] || []).push(cb);
    },
    emit(event: string, arg?: unknown) {
      (listeners[event] || []).forEach((cb) => cb(arg));
    }
  };
}

/** A popup component with the given input ports, output ports and Close Popup nodes. */
function aPopupComponent(
  inputs: Record<string, string>,
  outputs: Record<string, string>,
  results: string[],
  closeActions?: string[]
) {
  const closePopupNode = Object.assign(emitter(), {
    id: 'close-1',
    type: 'NavigationClosePopup',
    parameters: {
      results: results.join(','),
      ...(closeActions ? { closeActions: closeActions.join(',') } : {})
    }
  });

  const toPorts = (m: Record<string, string>) =>
    Object.fromEntries(Object.entries(m).map(([name, type]) => [name, { name, type }]));

  return Object.assign(emitter(), {
    inputPorts: toPorts(inputs),
    outputPorts: toPorts(outputs),
    getNodesWithType: (type: string) => (type === 'NavigationClosePopup' ? [closePopupNode] : [])
  });
}

/**
  * Runs the module's `setup` over one Show Popup node and records **every** publish, not just the
  * last. The re-publish rows need the history: asserting on a final snapshot cannot tell "the
  * listener fired and re-derived" from "the value was right all along".
  */
function portsFor(component: ReturnType<typeof aPopupComponent>) {
  const publishes: RecordedPort[][] = [];

  const editorConnection = {
    isRunningLocally: () => true,
    sendDynamicPorts(_id: string, published: RecordedPort[]) {
      publishes.push(published);
    }
  };

  const showPopupNode = Object.assign(emitter(), {
    id: 'show-1',
    type: 'NavigationShowPopup',
    parameters: { target: '/Popup' }
  });

  const graphModel = Object.assign(emitter(), {
    components: { '/Popup': component },
    getNodesWithType: (type: string) => (type === 'NavigationShowPopup' ? [showPopupNode] : [])
  });

  (ShowPopupModule as unknown as { setup(context: unknown, graphModel: unknown): void }).setup(
    { editorConnection },
    graphModel
  );
  graphModel.emit('editorImportComplete');

  return {
    get ports() {
      return publishes[publishes.length - 1] || [];
    },
    publishes,
    component,
    graphModel
  };
}

const portNamed = (ports: RecordedPort[], name: string) => ports.find((p) => p.name === name);

describe('NDA-010 §1: close results carry the type the popup declares', () => {
  /**
   * The control, and it is the row that would have caught the section's stale premise: params were
   * *already* typed from the target's inputs, and any claim that the popup boundary is untyped has
   * to survive this passing.
   */
  test('params still carry their declared type, which was never the gap', () => {
    const { ports } = portsFor(aPopupComponent({ userId: 'number' }, {}, []));

    expect(portNamed(ports, 'popupParam-userId')?.type).toBe('number');
  });

  /** The finding. */
  test('a result matching a Component Output takes that output\'s type', () => {
    const { ports } = portsFor(aPopupComponent({}, { chosenId: 'number' }, ['chosenId']));

    expect(portNamed(ports, 'closeResult-chosenId')?.type).toBe('number');
  });

  /**
   * The control that keeps the fix additive. A result the component does not declare an output for
   * stays `'*'` — exactly as connectable as before — so no existing graph is narrowed by this.
   */
  test('a result with no matching output stays untyped, so nothing existing narrows', () => {
    const { ports } = portsFor(aPopupComponent({}, {}, ['freeform']));

    expect(portNamed(ports, 'closeResult-freeform')?.type).toBe('*');
  });

  /**
   * The discrimination control. Two results, one typed and one not, in a single publish — without
   * this the two rows above could both pass on a change that typed *every* result identically, which
   * is the realistic bulk mistake (NDA-005's M5 reasoning: assert two neighbours differ).
   */
  test('two results in one publish are typed independently', () => {
    const { ports } = portsFor(aPopupComponent({}, { total: 'number' }, ['total', 'note']));

    expect(portNamed(ports, 'closeResult-total')?.type).toBe('number');
    expect(portNamed(ports, 'closeResult-note')?.type).toBe('*');
  });

  /** Close actions are signals and must stay signals — the change must not reach them. */
  test('close actions are unaffected', () => {
    const { ports } = portsFor(aPopupComponent({}, { confirm: 'number' }, [], ['confirm']));

    expect(portNamed(ports, 'closeAction-confirm')?.type).toBe('signal');
  });

  /**
   * The type source has to be *tracked*, or adding the Component Output that gives a result its type
   * leaves the port at `'*'` until something unrelated re-runs the derivation. `inputPortAdded` was
   * tracked; the output side was not, because nothing read it until now.
   */
  test('adding the Component Output later re-publishes with the type', () => {
    const harness = portsFor(aPopupComponent({}, {}, ['chosenId']));
    const before = harness.publishes.length;
    expect(portNamed(harness.ports, 'closeResult-chosenId')?.type).toBe('*');

    harness.component.outputPorts['chosenId'] = { name: 'chosenId', type: 'number' };
    harness.component.emit('outputPortAdded');

    // The listener fired at all — without this the type assertion below could pass on a stale
    // snapshot that happened to be right, which is what the first version of this row did.
    expect(harness.publishes.length).toBeGreaterThan(before);
    expect(portNamed(harness.ports, 'closeResult-chosenId')?.type).toBe('number');
  });
});
