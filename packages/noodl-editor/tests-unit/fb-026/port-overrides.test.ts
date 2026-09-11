/**
 * FB-026 — the editor half of "the output port is still listed as 'string'".
 *
 * A Text Input's `Value` ports are declared `'*'` and narrowed per instance from the `Type`
 * parameter, over `sendDynamicPorts`. That only works if a dynamic port carrying a static port's
 * own name replaces it; concatenated, the property panel would show `Value` twice and `getPort`
 * would return whichever sorted first by `index`.
 */
import { replaceOrAppendPorts } from '../../src/editor/src/models/nodegraphmodel/portOverrides';

describe('replaceOrAppendPorts', () => {
  it('🔴 replaces a static port with the dynamic one of the same name and plug', () => {
    const merged = replaceOrAppendPorts(
      [{ name: 'onTextChanged', plug: 'output', type: '*' }],
      [{ name: 'onTextChanged', plug: 'output', type: 'number' }]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe('number');
  });

  it('appends a dynamic port that collides with nothing — every existing producer', () => {
    const merged = replaceOrAppendPorts(
      [{ name: 'run', plug: 'input', type: 'signal' }],
      [{ name: 'count', plug: 'input', type: 'number' }]
    );

    expect(merged.map((p) => p.name)).toEqual(['run', 'count']);
  });

  /**
   * The discrimination that stops this being a name-only dedupe. `Component Inputs` and friends
   * carry the same name on both sides of a node, and swallowing one of them would delete a port
   * nobody asked to replace.
   */
  it('leaves a same-named port on the other plug alone', () => {
    const merged = replaceOrAppendPorts(
      [
        { name: 'value', plug: 'input', type: 'string' },
        { name: 'value', plug: 'output', type: 'string' }
      ],
      [{ name: 'value', plug: 'output', type: 'number' }]
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((p) => p.plug === 'input')?.type).toBe('string');
    expect(merged.find((p) => p.plug === 'output')?.type).toBe('number');
  });

  /** A combined plug is a third key: it matches neither, so it can never be silently swallowed. */
  it('does not treat a combined input/output plug as either half', () => {
    const merged = replaceOrAppendPorts(
      [{ name: 'value', plug: 'input/output', type: 'string' }],
      [{ name: 'value', plug: 'output', type: 'number' }]
    );

    expect(merged).toHaveLength(2);
  });

  /**
   * `getPorts` hands this the node *type's* own array when the instance has no ports of its own.
   * Writing through it would edit every node of that type at once.
   */
  it('never mutates either argument', () => {
    const base = [{ name: 'onTextChanged', plug: 'output', type: '*' }];
    const incoming = [{ name: 'onTextChanged', plug: 'output', type: 'number' }];

    replaceOrAppendPorts(base, incoming);

    expect(base[0].type).toBe('*');
    expect(incoming).toHaveLength(1);
  });
});
