/**
 * BEN-002 — the inputs rail's rules.
 *
 * ⚠️ The **preview** canvas (`views/VisualCanvas`), not the node-graph canvas
 * the rest of this directory tests. It lives here because that is where the
 * module lives, and beside `preview-scope.test.ts` for the same reason.
 *
 * What is under test is everything about the rail a screenshot cannot check:
 * which control a port gets, what the thing you typed becomes, and — the one
 * that would actually destroy something — that a value never reaches the
 * runtime as `NaN`. Phase-55 found a coercing port turning a bad value into a
 * *deleted* property with no message, which is the failure mode a bench must
 * never introduce.
 *
 * The rendering, the live no-reload update and the signal button are BEN-007's
 * job, driven, because none of them is decidable here.
 */

import {
  UNTYPED_HINT,
  benchControlKind,
  benchEnumOptions,
  benchInputGroups,
  benchParameterContent,
  benchSignalContents,
  benchTypeLabel,
  coerceBenchValue,
  portTypeName
} from '../../src/editor/src/views/VisualCanvas/benchInputs';
import {
  BENCH_COMPONENT_NAME,
  BENCH_NODE_ID
} from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import type { BenchPort } from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import { ViewerConnection } from '../../src/editor/src/ViewerConnection';

function port(overrides: Partial<BenchPort> & { name: string }): BenchPort {
  return { type: 'string', ...overrides };
}

describe('BEN-002 which control a port gets', () => {
  it('reads the type name off both spellings the library uses', () => {
    expect(portTypeName('string')).toBe('string');
    expect(portTypeName({ name: 'enum', enums: [] })).toBe('enum');
    expect(portTypeName({ name: 'number', units: ['px'] })).toBe('number');
  });

  it('maps every type the mapping table names', () => {
    expect(benchControlKind(port({ name: 'a', type: 'string' }))).toBe('text');
    expect(benchControlKind(port({ name: 'a', type: 'number' }))).toBe('number');
    expect(benchControlKind(port({ name: 'a', type: 'boolean' }))).toBe('boolean');
    expect(benchControlKind(port({ name: 'a', type: 'color' }))).toBe('color');
    expect(benchControlKind(port({ name: 'a', type: 'object' }))).toBe('json');
    expect(benchControlKind(port({ name: 'a', type: 'array' }))).toBe('json');
    expect(benchControlKind(port({ name: 'a', type: 'signal' }))).toBe('signal');
    expect(benchControlKind(port({ name: 'a', type: { name: 'enum', enums: [] } }))).toBe('enum');
  });

  it('calls an underived port untyped, because that is what it is', () => {
    // The commonest case on a real corpus: `getPorts` derives `type` from
    // connections, so an input wired to nothing arrives as '*'.
    const underived = port({ name: 'Title', type: '*' });
    expect(benchControlKind(underived)).toBe('untyped');
    expect(benchTypeLabel(underived)).toBe('untyped');
    expect(UNTYPED_HINT).toContain('wired to nothing');
  });

  it('gives an unrecognised named type a text field without calling it untyped', () => {
    // It has a type; this module simply has no richer editor for it. Claiming
    // it is untyped would be a second lie on top of a missing feature.
    const font = port({ name: 'Font', type: 'font' });
    expect(benchControlKind(font)).toBe('text');
    expect(benchTypeLabel(font)).toBe('font');
  });

  it('gives stringlist a text field, because it enumerates nothing (register B11)', () => {
    // BEN-002 §1 maps it to a select. There is no option set to build one from
    // — a stringlist is a comma-separated string — and a select over no options
    // is an empty dropdown that reads as broken.
    expect(benchControlKind(port({ name: 'Items', type: 'stringlist' }))).toBe('text');
  });
});

describe('BEN-002 enum options', () => {
  it('accepts both shapes the node library actually ships', () => {
    const labelled = port({
      name: 'Level',
      type: { name: 'enum', enums: [{ label: 'Debug', value: 'debug' }] }
    });
    expect(benchEnumOptions(labelled)).toEqual([{ label: 'Debug', value: 'debug' }]);

    const bare = port({ name: 'Level', type: { name: 'enum', enums: ['debug', 'info'] } });
    expect(benchEnumOptions(bare)).toEqual([
      { label: 'debug', value: 'debug' },
      { label: 'info', value: 'info' }
    ]);
  });

  it('returns nothing for a type carrying no enums, so the row falls back to a field', () => {
    expect(benchEnumOptions(port({ name: 'a', type: 'string' }))).toEqual([]);
    expect(benchEnumOptions(port({ name: 'a', type: { name: 'enum' } }))).toEqual([]);
  });
});

describe('BEN-002 the rail’s rows', () => {
  it('groups by the port group and keeps the interface’s own order', () => {
    const groups = benchInputGroups([
      port({ name: 'Title' }),
      port({ name: 'Width', group: 'Layout' }),
      port({ name: 'Body' }),
      port({ name: 'Height', group: 'Layout' })
    ]);

    expect(groups.map((g) => g.name)).toEqual(['', 'Layout']);
    expect(groups[0].inputs.map((p) => p.name)).toEqual(['Title', 'Body']);
    expect(groups[1].inputs.map((p) => p.name)).toEqual(['Width', 'Height']);
  });

  it('does not re-sort, because getPorts already ordered by index', () => {
    // Re-sorting here would let the rail and the component ports panel disagree
    // about what order this component's interface is in.
    const groups = benchInputGroups([port({ name: 'Z' }), port({ name: 'A' })]);
    expect(groups[0].inputs.map((p) => p.name)).toEqual(['Z', 'A']);
  });
});

describe('BEN-002 what the thing you typed becomes', () => {
  it('never hands the runtime a NaN', () => {
    // The phase-55 defect this guards: a value that could not be parsed reached
    // a coercing port as "NaNpx" and the property was DELETED, silently.
    const result = coerceBenchValue('number', '768320px oops');
    expect(result.value).toBeUndefined();
    expect(result.error).toContain('not a number');
  });

  it('parses a number, and treats an empty number field as unset', () => {
    expect(coerceBenchValue('number', ' 42 ')).toEqual({ value: 42 });
    expect(coerceBenchValue('number', '')).toEqual({ value: undefined });
  });

  it('keeps an empty text field as an empty string, which is a value', () => {
    // "Show me this card with no title" is a state worth previewing. Reset is
    // how you go back to unset; a blanked field must not silently do it.
    expect(coerceBenchValue('text', '')).toEqual({ value: '' });
  });

  it('reports invalid JSON rather than sending it', () => {
    const result = coerceBenchValue('json', '{ "a": ');
    expect(result.value).toBeUndefined();
    expect(typeof result.error).toBe('string');
  });

  it('parses valid JSON, and treats an empty JSON field as unset', () => {
    expect(coerceBenchValue('json', '{"a":1}')).toEqual({ value: { a: 1 } });
    expect(coerceBenchValue('json', '  ')).toEqual({ value: undefined });
  });

  it('guesses JSON first and falls back to the string, for an untyped port', () => {
    expect(coerceBenchValue('untyped', '12')).toEqual({ value: 12 });
    expect(coerceBenchValue('untyped', 'true')).toEqual({ value: true });
    expect(coerceBenchValue('untyped', '["a"]')).toEqual({ value: ['a'] });
    expect(coerceBenchValue('untyped', 'Hello')).toEqual({ value: 'Hello' });
  });

  it('coerces a boolean without going through the text path', () => {
    expect(coerceBenchValue('boolean', true)).toEqual({ value: true });
    expect(coerceBenchValue('boolean', false)).toEqual({ value: false });
  });
});

describe('BEN-002 the update the runtime is sent', () => {
  it('names the harness node, which is the end a component’s inputs are fed from', () => {
    expect(benchParameterContent('Title', 'Hello')).toEqual({
      type: 'parameterChanged',
      componentName: BENCH_COMPONENT_NAME,
      nodeId: BENCH_NODE_ID,
      parameterName: 'Title',
      parameterValue: 'Hello'
    });
  });

  it('unsets a port with an undefined value, which is how Reset works', () => {
    const content = benchParameterContent('Title', undefined);
    expect(content.parameterValue).toBeUndefined();
    // JSON.stringify drops the key; the runtime's setParameter then deletes the
    // parameter and the node falls back to its default.
    expect(JSON.parse(JSON.stringify(content)).parameterName).toBe('Title');
    expect('parameterValue' in JSON.parse(JSON.stringify(content))).toBe(false);
  });

  it('sends a signal as two updates, because a pulse is a rising AND a falling edge', () => {
    // Send only the `true` and the signal fires once and never rearms.
    const contents = benchSignalContents('Do');
    expect(contents.length).toBe(2);
    expect(contents[0].parameterValue).toBe(true);
    expect(contents[1].parameterValue).toBe(false);
    expect(contents.every((c) => c.parameterName === 'Do')).toBe(true);
  });
});

describe('BEN-002 / B2 the update is addressed to one client', () => {
  /**
   * The whole of B2 in one spec: a bench input must not reach the app preview.
   *
   * ⚠️ It is `target` that does this, not a `clientId` inside `content` — the
   * relay routes any message carrying a `target` to that socket alone and only
   * broadcasts the ones without. The BEN-002 task file proposed the other
   * mechanism and would have needed a runtime change to get it.
   */
  /**
   * The real method, borrowed off the prototype onto a recorder.
   *
   * ⚠️ Importing the module is safe *only* because the singleton is built
   * behind `process.env.devMode !== 'test'` — the spec bundle sets `devMode` to
   * `'test'`, so nothing here opens a socket.
   */
  function capture() {
    const sent: TSFixme[] = [];
    return {
      sent,
      send(request: TSFixme) {
        sent.push(request);
      },
      sendModelUpdateToClient: ViewerConnection.prototype.sendModelUpdateToClient
    };
  }

  it('puts the client id on the request, where the relay reads it', () => {
    const connection = capture();
    connection.sendModelUpdateToClient('sandbox-abc', benchParameterContent('Title', 'Hello'));

    expect(connection.sent.length).toBe(1);
    expect(connection.sent[0].cmd).toBe('modelUpdate');
    expect(connection.sent[0].target).toBe('sandbox-abc');
    expect(connection.sent[0].content.parameterName).toBe('Title');
  });

  it('leaves the broadcast path alone — an ordinary model update carries no target', () => {
    // Nothing that broadcast before passes a target, so existing clients are
    // unaffected by construction. This pins the property rather than the code.
    const connection = capture();
    connection.send({ cmd: 'modelUpdate', content: { type: 'parameterChanged' } });
    expect('target' in connection.sent[0]).toBe(false);
  });
});
