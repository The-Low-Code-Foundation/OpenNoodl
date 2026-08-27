/**
 * FB-026 — a Text Input set to **Number** published a string.
 *
 * Richard's report: *"I add an input, I change the 'type' from string to number, but the output
 * port is still listed as 'string', and the value that comes out of the input is a string type
 * with double quotes, and the connector goes dotted and errors when I connect it to a number
 * port because it expects a number and gets a string."*
 *
 * Every `<input>` reports `event.target.value` as a string, `type="number"` included, and both
 * value ports were hard-declared `type: 'string'`. So all three symptoms were one defect and its
 * honest consequence: the value really was `"5"`, and FIX-025's dashed wire was telling the truth
 * about it. Fixing the value is what makes the port type worth narrowing, and narrowing the port
 * type is what stops the wire dashing.
 *
 * These rows grade the three surfaces separately, because the conversion has four callers and the
 * bug was that only some of them agreed: the component converting a keystroke, the node converting
 * a `Set` that lands before the field mounts, `Clear` deciding whether it changed anything, and
 * `updatePorts` telling the canvas what the ports are.
 */

// `node-shared-port-definitions` reads the viewer's `Noodl` global at import time, so it has to
// exist before the node module is required. Same shape the CN-006 suites use.
(globalThis as unknown as Record<string, unknown>).Noodl = { deployed: false };

import {
  emptyValueForFieldType,
  outwardValueForFieldType,
  portTypeForFieldType
} from '../src/nodes/controls/textInputValue';

import TextInputModule from '../src/nodes/controls/text-input';

describe('FB-026 — the value a Number field publishes', () => {
  it('is a number, not the string the DOM reports', () => {
    expect(outwardValueForFieldType('number', '5')).toBe(5);
    expect(outwardValueForFieldType('number', '5')).not.toBe('5');
    expect(outwardValueForFieldType('number', '-2.5')).toBe(-2.5);
  });

  /**
   * The control. Every other Type is a string with a keyboard or a validation hint, and widening
   * one of them would be a claim the value does not support — an `email` field holds whatever was
   * typed, valid or not.
   */
  it('is left as text for every other Type', () => {
    for (const type of ['text', 'textArea', 'email', 'password', 'url']) {
      expect(outwardValueForFieldType(type, '5')).toBe('5');
    }
  });

  /**
   * `EMPTY-VALUE-CONTRACT.md` E3/E4 — `null` distinguishable from `0`, `NaN` never stored. A `NaN`
   * here would raise OBS-003's `node/nan-input` on whatever node received it, several hops from
   * the empty field that caused it.
   */
  it('is null rather than NaN when the field is empty or unparseable', () => {
    expect(outwardValueForFieldType('number', '')).toBeNull();
    expect(outwardValueForFieldType('number', 'not a number')).toBeNull();
    expect(outwardValueForFieldType('number', NaN)).toBeNull();
    // Not `0`: an empty number field has no value, and `0` is a value someone typed.
    expect(outwardValueForFieldType('number', '')).not.toBe(0);
  });

  it('agrees with the empty value Clear compares against', () => {
    expect(emptyValueForFieldType('number')).toBeNull();
    expect(emptyValueForFieldType('text')).toBe('');
    expect(outwardValueForFieldType('number', emptyValueForFieldType('number'))).toBeNull();
    expect(outwardValueForFieldType('text', emptyValueForFieldType('text'))).toBe('');
  });
});

describe('FB-026 — the port type follows Type', () => {
  it('is number for a Number field and string for the rest', () => {
    expect(portTypeForFieldType('number')).toBe('number');
    for (const type of ['text', 'textArea', 'email', 'password', 'url', undefined]) {
      expect(portTypeForFieldType(type)).toBe('string');
    }
  });

  /**
   * The static declarations stay `'*'`, and that is not laziness: a deployed viewer and the node
   * catalog read them with nothing running to narrow anything, and there the true answer is
   * "it depends on Type". The narrowing below is what an editor sees.
   */
  it('declares both value ports as * statically, so nothing claims a type it cannot know', () => {
    const node = TextInputModule.node as never as {
      inputs: Record<string, { type: unknown; displayName: string }>;
      outputs: Record<string, { type: unknown; displayName: string }>;
    };

    expect(node.inputs.startValue.type).toBe('*');
    expect(node.outputs.onTextChanged.type).toBe('*');
  });

  /** Richard: *"which we should rename to 'value' I think because it's not always text"*. */
  it('calls both ports Value, while the port ids stay frozen', () => {
    const node = TextInputModule.node as never as {
      inputs: Record<string, { displayName: string }>;
      outputs: Record<string, { displayName: string }>;
    };

    expect(node.inputs.startValue.displayName).toBe('Value');
    expect(node.outputs.onTextChanged.displayName).toBe('Value');
    expect(node.outputs.textChanged.displayName).toBe('Value Changed');
  });

  /**
   * The narrowing itself, over the seam it actually uses. `sendDynamicPorts` is recorded rather
   * than stubbed away, because *which* ports are published — and that they carry the static
   * ports' own names, so `getPorts` replaces rather than appends — is the whole mechanism.
   */
  it('publishes a narrowed port over the same name and plug as the static one', () => {
    const published: Record<string, { name: string; type: string; plug: string }[]> = {};
    const listeners: Record<string, (node: unknown) => void> = {};
    const paramListeners: ((event: { name: string }) => void)[] = [];

    const node = {
      id: 'ti-1',
      parameters: { type: 'number' } as Record<string, unknown>,
      on(event: string, cb: (e: { name: string }) => void) {
        if (event === 'parameterUpdated') paramListeners.push(cb);
      }
    };

    TextInputModule.setup(
      {
        editorConnection: {
          isRunningLocally: () => true,
          sendDynamicPorts(id: string, ports: never) {
            published[id] = ports;
          }
        }
      } as never,
      {
        on(event: string, cb: (n: unknown) => void) {
          listeners[event] = cb;
        }
      } as never
    );

    listeners['nodeAdded.net.noodl.controls.textinput'](node);

    expect(published['ti-1']).toEqual([
      expect.objectContaining({ name: 'startValue', plug: 'input', type: 'number' }),
      expect.objectContaining({ name: 'onTextChanged', plug: 'output', type: 'number' })
    ]);

    // And it follows the parameter, which is the gesture Richard made: change Type, the port
    // changes with it. Without this the narrowing would be right once and stale for ever.
    node.parameters.type = 'text';
    paramListeners.forEach((cb) => cb({ name: 'type' }));

    expect(published['ti-1']).toEqual([
      expect.objectContaining({ name: 'startValue', type: 'string' }),
      expect.objectContaining({ name: 'onTextChanged', type: 'string' })
    ]);
  });
});
