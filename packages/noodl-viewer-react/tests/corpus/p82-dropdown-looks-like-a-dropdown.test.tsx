/**
 * P82 — the three things Richard asked for on 2026-09-06, after driving the Dropdown work of
 * 2026-09-04/05:
 *
 * > *"The initial rendering of the dropdown has no padding at all between the input border and
 * > contained option, and no chevron down icon by default, to make it immediately look like a
 * > 'normal' dropdown input … the default value when placing a dropdown node is 'option-1' even
 * > though the label is 'Option 1' which will further confuse the user … I'd love to let the user
 * > have the dropdown selector on that field to choose one of the options they've created."*
 *
 * 🔴 **Every row grades the CONSEQUENCE, not the declaration.** A padding `default` that the
 * property panel shows and no element receives is the exact shape of NDA-012's Icon defect, and a
 * static read of `options.ts` cannot tell that apart from a live one — so the padding rows read
 * what a placed node hands its React component, and the chevron rows read the rendered markup.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createCorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';
import { Select } from '../../src/components/controls/Select/Select';

// The node modules reach `Noodl.deployed` at import time to decide whether to build editor
// tooltips, so it has to exist before the `require` below.
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/* eslint-disable @typescript-eslint/no-var-requires */
const OptionsModule = require('../../src/nodes/controls/options').default;
/* eslint-enable @typescript-eslint/no-var-requires */

/** The graph harness hands back untyped node internals; this names that rather than repeating it. */
type AnyValue = any; // eslint-disable-line @typescript-eslint/no-explicit-any

interface DrivableNode {
  props: Record<string, AnyValue>;
}

async function placeDropdown(parameters: Record<string, unknown> = {}): Promise<DrivableNode> {
  const graph = await createCorpusGraph({
    modules: [OptionsModule as never],
    data: {
      components: [
        {
          name: '/root',
          nodes: [{ id: 'dropdown', type: OptionsModule.node.name, parameters }]
        }
      ]
    } as never
  });

  (graph.context as unknown as { styles: unknown }).styles = {
    getTextStyle: () => ({}),
    resolveColor: (c: unknown) => c
  };
  graph.update();

  return graph.node('dropdown') as unknown as DrivableNode;
}

function renderSelect(overrides: Record<string, unknown> = {}): string {
  const props = {
    id: 'dropdown-test',
    items: [{ Label: 'Option 1', Value: 'Option 1' }],
    value: 'Option 1',
    style: {},
    dom: {},
    styles: {},
    placeholder: '',
    placeholderOpacity: 1,
    ...overrides
  };
  return renderToStaticMarkup(React.createElement(Select as never, props as never));
}

describe('§1 — 🔴 the border no longer sits hard against the label', () => {
  it('a never-authored Dropdown hands its wrapper real padding, in px', async () => {
    const dropdown = await placeDropdown();

    // ⚠️ `props.styles.inputWrapper` is what `Select.tsx` spreads onto the bordered element. The
    // panel's own number is NOT read here: every other node's padding default is inert by design
    // (`applyDefault: false`), so a declaration alone would leave this object empty and the
    // element at 0 while the panel showed 8.
    expect(dropdown.props.styles.inputWrapper).toMatchObject({
      paddingLeft: '8px',
      paddingRight: '8px',
      paddingTop: '6px',
      paddingBottom: '6px'
    });
  });

  it('an authored padding still wins, so the default is a starting point and not a floor', async () => {
    const dropdown = await placeDropdown({ paddingLeft: 24 });

    expect(dropdown.props.styles.inputWrapper.paddingLeft).toBe('24px');
  });

  it('⚠️ the sides nobody asked for stay inert — this did not turn on padding everywhere', async () => {
    // The guard on the change to `addPaddingInputs`: it now applies a default only for a side the
    // CALLER named. `Checkbox` names none, so its four padding ports must still declare 0 and
    // apply nothing, or every node in the library just gained a `padding: 0px` that beats its
    // stylesheet — which is the reason they were all inert in the first place.
    /* eslint-disable @typescript-eslint/no-var-requires */
    const CheckboxModule = require('../../src/nodes/controls/checkbox').default;
    /* eslint-enable @typescript-eslint/no-var-requires */

    const graph = await createCorpusGraph({
      modules: [CheckboxModule as never],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'checkbox', type: CheckboxModule.node.name, parameters: {} }] }]
      } as never
    });
    (graph.context as unknown as { styles: unknown }).styles = {
      getTextStyle: () => ({}),
      resolveColor: (c: unknown) => c
    };
    graph.update();

    const checkbox = graph.node('checkbox') as unknown as { props: Record<string, AnyValue> };
    const style = checkbox.props.style || {};

    expect(style.paddingLeft).toBeUndefined();
    expect(style.paddingTop).toBeUndefined();
  });
});

describe('§2 — 🔴 it looks like a dropdown before anyone configures it', () => {
  it('draws a chevron with no parameters set at all', async () => {
    // Asserted through the RENDER of what a placed node actually hands `Select`, not through the
    // port declaration — a `default` the panel shows and the component never receives is the
    // failure this is guarding.
    const dropdown = await placeDropdown();

    expect(dropdown.props.showChevron).toBe(true);
    expect(renderSelect({ showChevron: dropdown.props.showChevron })).toContain('<svg');
  });

  it('⚠️ and draws it for an ABSENT prop too, not only for an explicit true', () => {
    // The default arrives through the port, so it is present on a node placed today. It is not on
    // a `Select` rendered from anywhere that bypasses the port — and `props.showChevron &&` would
    // silently draw nothing there, which is the same defect one layer along.
    expect(renderSelect()).toContain('<svg');
  });

  it('the chevron inherits the control colour rather than declaring one', () => {
    // A hard-coded colour would be invisible on a dark-styled Dropdown, and would need a port of
    // its own to keep in step with the text style.
    expect(renderSelect()).toContain('currentColor');
  });

  it('and it can be turned off', () => {
    expect(renderSelect({ showChevron: false })).not.toContain('<svg');
  });

  it('⚠️ the chevron does not eat the click the overlaid select needs', () => {
    // The native `<select>` is `opacity: 0` and absolutely positioned over the whole control; a
    // decoration painted on top of it that took pointer events would make the last few pixels of
    // the control dead.
    expect(renderSelect()).toMatch(/pointer-events:\s*none/);
  });
});

describe('§3 — 🔴 the Value field offers the options this node has', () => {
  /** The dynamic ports one `nodeAdded` would publish for a node with these parameters. */
  function publishedPorts(parameters: Record<string, unknown>): AnyValue[] {
    let sent: AnyValue[] | undefined;

    const editorConnection = {
      isRunningLocally: () => true,
      sendDynamicPorts: (_id: string, ports: AnyValue[]) => {
        sent = ports;
      }
    };

    const node = { id: 'dropdown', parameters, on: () => undefined };
    const graphModel = {
      on: (event: string, handler: (n: unknown) => void) => {
        if (event === 'nodeAdded.' + OptionsModule.node.name) handler(node);
      }
    };

    OptionsModule.setup({ editorConnection } as never, graphModel as never);

    if (sent === undefined) throw new Error('setup published no dynamic ports at all');
    return sent;
  }

  const valuePort = (parameters: Record<string, unknown>) =>
    publishedPorts(parameters).find((p) => p.name === 'value' && p.plug === 'input');

  it('a never-authored Dropdown offers its two default options', () => {
    expect(valuePort({}).type).toEqual({
      name: 'enum',
      enums: [
        { label: 'Option 1', value: 'Option 1' },
        { label: 'Option 2', value: 'Option 2' }
      ]
    });
  });

  it('🔴 it tracks the options the author actually typed', () => {
    const port = valuePort({
      items: [
        { Label: 'Small', Value: 'Small' },
        { Label: 'Large', Value: 'Large' }
      ]
    });

    expect(port.type.enums.map((e: AnyValue) => e.value)).toEqual(['Small', 'Large']);
  });

  it('🔴 shows the LABEL and stores the VALUE, so an Advanced-mode override still reads right', () => {
    // Richard's "Large" → `l` case. Picking must say "Large" and write `l`; an enum built from
    // values alone would show the author `l` and hide which option it is.
    const port = valuePort({ items: [{ Label: 'Large', Value: 'l' }] });

    expect(port.type.enums).toEqual([{ label: 'Large', value: 'l' }]);
  });

  it('reads the legacy stored form — a string holding the JSON', () => {
    const port = valuePort({ items: '[{"Label":"Small","Value":"s"}]' });

    expect(port.type.enums).toEqual([{ label: 'Small', value: 's' }]);
  });

  it('⚠️ keeps a value that matches no option, and says that is what it is', () => {
    // `EnumType` draws a value it cannot find as blank. A Dropdown whose Value came from a
    // database, or was set before the options were edited, would look empty while the parameter
    // still held it — and nothing here writes, so the parameter itself is untouched either way.
    const port = valuePort({ items: [{ Label: 'Small', Value: 'Small' }], value: 'from-the-database' });

    expect(port.type.enums).toEqual([
      { label: 'Small', value: 'Small' },
      { label: 'from-the-database (not in Items)', value: 'from-the-database' }
    ]);
  });

  it('does not duplicate an in-list value into a second "not in Items" row', () => {
    const port = valuePort({ items: [{ Label: 'Small', Value: 'Small' }], value: 'Small' });

    expect(port.type.enums).toEqual([{ label: 'Small', value: 'Small' }]);
  });

  it('🔴 REPLACES the static string port rather than sitting beside it', () => {
    // `NodeGraphNode.getPorts` keys an override on name AND plug (FB-026, `portOverrides.ts`).
    // A different plug here would append, and the panel would show `Value` twice.
    const port = valuePort({});

    expect(port.plug).toBe('input');
    expect(port.displayName).toBe('Value');
    expect(port.group).toBe('General');
  });

  it('⚠️ leaves the `value` OUTPUT alone', () => {
    expect(publishedPorts({}).some((p) => p.plug === 'output')).toBe(false);
  });

  it('⚠️ publishes nothing when the items cannot be read, rather than an empty picker', () => {
    // An empty enum is a field an author can neither pick from nor type into. Publishing nothing
    // leaves the static `string` port in place, which is still editable.
    expect(publishedPorts({ items: 'not a list at all' })).toEqual([]);
    expect(publishedPorts({ items: [] })).toEqual([]);
  });

  it('⚠️ does nothing at all when no editor is connected', () => {
    let called = false;
    OptionsModule.setup(
      { editorConnection: { isRunningLocally: () => false, sendDynamicPorts: () => (called = true) } } as never,
      { on: () => (called = true) } as never
    );

    expect(called).toBe(false);
  });
});
