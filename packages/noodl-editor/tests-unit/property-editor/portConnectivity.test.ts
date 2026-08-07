/**
 * SPR-003 §1 (F82) — "the Ports tab lists ports the canvas refuses to connect".
 *
 * ## What this suite is actually defending
 *
 * The defect was not a missing feature, it was **two lists asking different
 * questions of the same data**. The canvas connection popup dropped every port
 * whose declared type carries `allowEditOnly: true`; the Ports tab never looked.
 * So `Treat Unchanged as` on a String variable — a port the runtime marks
 * edit-only *precisely so it cannot be wired* — was absent from the port menu
 * and present, unqualified, in the tab.
 *
 * The two assertions below are therefore of different kinds on purpose:
 *
 * 1. **Behavioural**, against the *real* port declarations. `variablebase.ts`,
 *    `run-on-value-change.ts`, `page-inputs.ts` and `css-definition.ts` are all
 *    import-free (type-only imports), so this plain-Node runner can build the
 *    genuine definitions rather than a copy of them. A copy would keep passing
 *    after the declaration changed, which is the failure mode this whole
 *    directory exists to avoid.
 * 2. **Structural**, over the two source files. "Both lists ask the same
 *    question through one helper" is a property of the *source*, not of any
 *    value, and it is the property that rotted last time: nothing stops a third
 *    copy of `!(typeof p.type === 'object' && p.type.allowEditOnly)` appearing
 *    next to the other two. So the last block reads the two files and fails if
 *    either grows its own predicate back, or calls the conditional-port filter
 *    with a hand-written scope instead of the shared constant.
 */

import * as fs from 'fs';
import * as path from 'path';

import CSSDefinitionModule from '../../../noodl-viewer-react/src/nodes/visual/css-definition';
import PageInputsModule from '../../../noodl-viewer-react/src/nodes/navigation/page-inputs';
import { createDefinition } from '../../../noodl-runtime/src/nodes/std-library/variables/variablebase';
import { runOnChangeInput } from '../../../noodl-runtime/src/run-on-value-change';
import {
  isPortConnectable,
  omitHiddenPorts,
  PORT_CONDITION_FILTER_MODES,
  PortLike
} from '../../src/editor/src/models/nodelibrary/portConnectivity';

/** `{ name, type }` pairs the way `model.getPorts()` hands them to both lists. */
function portsOf(ports: Record<string, { type?: unknown }> | undefined): PortLike[] {
  return Object.keys(ports || {}).map((name) => ({ name, type: (ports[name] || {}).type as PortLike['type'] }));
}

function connectableNames(ports: PortLike[]): string[] {
  return ports.filter(isPortConnectable).map((port) => port.name);
}

function unconnectableNames(ports: PortLike[]): string[] {
  return ports.filter((port) => !isPortConnectable(port)).map((port) => port.name);
}

/**
 * The String variable, built from the same factory `variables/string.ts` calls
 * with the same arguments. Its own module cannot be imported here: it
 * `require`s `noodl-runtime` for `NodeDefinition.extend`, which pulls the whole
 * runtime in. The factory is where every port in question is declared.
 */
const stringVariable = createDefinition({
  name: 'String',
  startValue: '',
  type: { name: 'string' },
  cast: (value: unknown) => String(value),
  emptyOptions: [
    { value: 'null', label: 'Null (default)', coerce: null },
    { value: 'empty-string', label: 'Empty string ("")', coerce: '' }
  ]
});

describe('SPR-003 F82 — the String variable, the node Richard was looking at', () => {
  const inputs = portsOf(stringVariable.inputs as TSFixmeRecord);

  it('declares the two ports from the screenshot', () => {
    // Guards the test itself: if the runtime renames these, the assertions
    // below would silently pass over an empty set.
    expect(inputs.map((p) => p.name)).toEqual(expect.arrayContaining(['treatEmptyAs', 'treatUnchangedAs']));
  });

  it('does not let `Treat Unchanged as` read as connectable', () => {
    expect(isPortConnectable(inputs.find((p) => p.name === 'treatUnchangedAs'))).toBe(false);
  });

  it('does not let `Treat empty as` read as connectable', () => {
    expect(isPortConnectable(inputs.find((p) => p.name === 'treatEmptyAs'))).toBe(false);
  });

  it('still lets the ports an author really wires through', () => {
    // `value` is a plain typed input and `saveValue` is the control signal —
    // the fix must not cost the tab anything real.
    expect(connectableNames(inputs)).toEqual(expect.arrayContaining(['value', 'saveValue']));
  });

  it('leaves every output connectable — nothing declares an edit-only output', () => {
    const outputs = portsOf(stringVariable.outputs as TSFixmeRecord);
    expect(unconnectableNames(outputs)).toEqual([]);
  });
});

describe('SPR-003 F82 — a cross-node sample of the 139 `allowEditOnly` declarations', () => {
  it('Run On Value Change: the per-input checkbox is a setting, not a port to wire', () => {
    // `run-on-value-change.ts:66` states the intent in its own words: marked
    // `allowEditOnly` "so it cannot be wired".
    expect(isPortConnectable({ name: 'runOnChange-value', type: runOnChangeInput('value').type as PortLike['type'] })).toBe(
      false
    );
  });

  it('Page Inputs: both stringlists are edit-only, and nothing else on the node is', () => {
    const inputs = portsOf(PageInputsModule.node.inputs as TSFixmeRecord);
    expect(unconnectableNames(inputs).sort()).toEqual(['pathParams', 'queryParams']);
  });

  it('CSS Definition: the stylesheet body is edit-only', () => {
    const inputs = portsOf(CSSDefinitionModule.node.inputs as TSFixmeRecord);
    expect(unconnectableNames(inputs)).toContain('style');
  });

  it('treats a bare type name, a plain object type and a null type as connectable', () => {
    // The popup's original predicate would have thrown on `type: null`
    // (`typeof null === 'object'`). The tab lists every port, so it meets more
    // shapes than the popup ever did.
    expect(isPortConnectable({ name: 'a', type: 'string' })).toBe(true);
    expect(isPortConnectable({ name: 'b', type: { name: 'enum', enums: [] } })).toBe(true);
    expect(isPortConnectable({ name: 'c', type: null })).toBe(true);
    expect(isPortConnectable({ name: 'd' })).toBe(true);
    expect(isPortConnectable({ name: 'e', type: { name: 'boolean', allowEditOnly: false } })).toBe(true);
  });
});

describe('SPR-003 F82 — the conditional-port scope', () => {
  it('is `extended`, the scope a saved connection is validated against', () => {
    // `NodeGraphModel.ts:613` asks `isConditionalPortValid(node, port,
    // ['extended'])` when deciding whether a connection is still valid, so
    // `extended` is the mode that means "this port is not on the node". A
    // plain `conditionalports/*` rule only suppresses the property row.
    expect(Array.from(PORT_CONDITION_FILTER_MODES)).toEqual(['extended']);
  });

  it('drops exactly the named ports and keeps the order of the rest', () => {
    const ports = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    expect(omitHiddenPorts(ports, ['b'])).toEqual([{ name: 'a' }, { name: 'c' }]);
    expect(omitHiddenPorts(ports, [])).toEqual(ports);
    expect(omitHiddenPorts(ports, undefined)).toEqual(ports);
    // A copy, never the caller's array: `ConnectionBar` used to `splice` the
    // array `getPorts()` returned.
    expect(omitHiddenPorts(ports, [])).not.toBe(ports);
  });
});

describe('SPR-003 F82 — the two lists ask the question through one helper', () => {
  const EDITOR_SRC = path.resolve(__dirname, '../../src/editor/src');
  const SOURCES = {
    'the connection popup': path.join(EDITOR_SRC, 'views/ConnectionPopup/components/ConnectionBar.tsx'),
    'the Ports tab': path.join(EDITOR_SRC, 'views/panels/propertyeditor/components/PortsTab/PortsTab.tsx')
  };

  for (const [what, file] of Object.entries(SOURCES)) {
    describe(what, () => {
      const source = fs.readFileSync(file, 'utf8');

      it('imports the shared predicate', () => {
        expect(source).toContain('isPortConnectable');
        expect(source).toMatch(/from '@noodl-models\/nodelibrary\/portConnectivity'/);
      });

      it('does not carry its own copy of the `allowEditOnly` rule', () => {
        // The whole defect was a predicate that existed in one list and not the
        // other. A third copy is the same defect with a longer fuse.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).not.toContain('allowEditOnly');
      });

      it('asks for the conditional-port scope by the shared constant', () => {
        expect(source).toMatch(/applyPortConditionsFilterForNode\(\s*model,\s*PORT_CONDITION_FILTER_MODES\s*\)/);
      });
    });
  }
});

/** The port maps carry functions and enums this suite never inspects. */
type TSFixmeRecord = Record<string, { type?: unknown }>;
