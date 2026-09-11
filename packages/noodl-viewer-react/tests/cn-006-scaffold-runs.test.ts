/**
 * CN-006 — **build the caller.** The generated kit, executed.
 *
 * ⚠️ Every other test of the scaffold grades *strings*: that the source contains
 * a token, that the README's table matches. All of those pass on a kit that
 * throws on line one. This one takes the exact `index.js` the scaffold emits,
 * runs it the way the runtime runs it, hands the definition it registers to the
 * real bridge, and renders the component with the real React.
 *
 * That ordering is the point. The scaffold is the file everybody copies, so
 * "the generated node arrives, with its ports, drawing its tokens" is the only
 * property worth having — and it is not implied by any amount of source
 * inspection.
 *
 * ## What a working scaffold looks like, written down before it was driven
 *
 * - `Noodl.defineModule` is called exactly once, with one `reactNodes` entry.
 * - The bridge registers **fifteen** ports with the names and homes the README
 *   claims.
 * - An instance with **no parameters set** carries `padding: 'var(--space-4)'`
 *   in its style — not `'var(--space-4)px'`, and not absent.
 * - Rendering it produces markup containing the label, with the token strings
 *   in the emitted `style` attributes.
 *
 * A broken scaffold fails the third even while passing the first two, which is
 * exactly what happened before this task fixed the bridge's default path.
 */

/* eslint-env jest */

(globalThis as Record<string, any>).Noodl = { deployed: false };

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createNodeFromReactComponent, type ReactNodeDefinition } from '../src/react-component-node';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { scaffoldKitFiles, EXAMPLE_PORTS } = require('@nodegx/kit-scaffold');

/**
 * Run the generated `index.js` the way the runtime does: **globals**, no module system.
 *
 * 🔴 **This used to hand `window` and `Noodl` in as function PARAMETERS, and that was a hole.** A
 * kit is a `<script>` tag: it runs in global scope and reaches `Noodl` and `React` as globals. A
 * parameter-passing wrapper makes the file's opening line work no matter what the surrounding
 * runtime actually provides — which is the same divergence `static/ssr/kit-modules.js` documents
 * about itself and deliberately avoids (`new Function(source)()`, never a wrapper).
 *
 * It was invisible until ✅ D19 changed the scaffold from `var React = window.React;` to the bare
 * `React` global that the shipped kit types recommend and that works on a server render too. The
 * emitted file was correct for every real host and this harness was the only thing that rejected
 * it. Fixed here rather than reverted there, because the harness was the wrong one.
 */
function loadGeneratedKit(source: string) {
  const defined: any[] = [];
  const g = globalThis as Record<string, any>;
  const previousNoodl = g.Noodl;

  /*
   * ⚠️ **`React` is installed once and LEFT there; only `Noodl` is swapped per load.** That is what
   * the real bootstrap does — a `<script>` tag installs React before any module script and it stays
   * for the life of the page — and the difference is observable: the scaffolded component reads
   * `React.useRef` at RENDER time, not at import time, so a harness that tore the global down after
   * loading rendered `undefined.useRef`. Two rows below failed on exactly that and they were right
   * to: a runtime that removed React between load and render would break this kit for real.
   */
  g.React = React;
  g.Noodl = { defineModule: (m: unknown) => defined.push(m), deployed: false };

  try {
    // eslint-disable-next-line no-new-func
    new Function(source)();
  } finally {
    g.Noodl = previousNoodl;
  }

  return { defined, modules: defined };
}

/** Instantiate a bridge-produced node far enough to read `style` and `props`. */
function instantiate(mod: any) {
  const node = mod.node;
  const instance: Record<string, any> = {
    props: {},
    style: {},
    _internal: {},
    context: {
      frameNumber: 0,
      eventEmitter: { once() {}, on() {}, off() {}, emit() {} },
      scheduleUpdate() {}
    },
    raiseRuntimeError() {
      /* not under test */
    }
  };
  for (const key of Object.keys(node.methods || {})) instance[key] = node.methods[key].bind(instance);
  node.initialize.call(instance);
  return instance;
}

const plan = scaffoldKitFiles({ name: 'Weather Kit' });
const indexJs: string = plan.files.find((f: any) => f.path === 'index.js').contents;

describe('CN-006 — the generated kit runs', () => {
  test('it executes and defines exactly one module with one react node', () => {
    const { modules } = loadGeneratedKit(indexJs);

    expect(modules).toHaveLength(1);
    expect(modules[0].reactNodes).toHaveLength(1);
    expect(modules[0].reactNodes[0].name).toBe('weather-kit.StatTile');
    expect(modules[0].reactNodes[0].displayNodeName).toBe('Stat Tile');
  });

  test('the bridge accepts the definition and registers every documented port', () => {
    const { modules } = loadGeneratedKit(indexJs);
    const mod = createNodeFromReactComponent(modules[0].reactNodes[0] as ReactNodeDefinition);
    const node = mod.node as any;

    // The bridge folds inputProps and inputCss into one `inputs` map and
    // outputProps into `outputs`, so this is what a graph can actually connect.
    for (const port of EXAMPLE_PORTS) {
      const where = port.where === 'outputProps' ? node.outputs : node.inputs;
      expect({ port: port.name, registered: Object.hasOwn(where, port.name) }).toEqual({
        port: port.name,
        registered: true
      });
    }

    // Two-sided: a bridge that registered everything under the sun would pass
    // the loop above. The scaffold's own ports are these fifteen; the rest of
    // `node.inputs` is the shared visual set every React node gets.
    expect(EXAMPLE_PORTS.length).toBe(15);
  });

  test('🔴 an instance with no parameters set carries its token defaults', () => {
    // The assertion this task turned on. Before the bridge fix these read
    // `'var(--space-4)px'`, `'var(--radius-md)px'`, `'var(--border-1)px'` —
    // invalid CSS, dropped by the browser with no error, while the property
    // panel still showed the correct token.
    const { modules } = loadGeneratedKit(indexJs);
    const instance = instantiate(createNodeFromReactComponent(modules[0].reactNodes[0] as ReactNodeDefinition));

    expect(instance.style).toMatchObject({
      backgroundColor: 'var(--surface-raised)',
      color: 'var(--foreground)',
      borderColor: 'var(--border)',
      borderWidth: 'var(--border-1)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)'
    });

    // The inputProps half, which lands on the component rather than the style.
    expect(instance.props).toMatchObject({
      label: 'Revenue',
      gap: 'var(--space-1)',
      labelSize: 'var(--text-sm)',
      valueSize: 'var(--text-2xl)',
      labelColor: 'var(--muted-foreground)',
      highlightColor: 'var(--primary)'
    });

    // The failure shape, named: nothing anywhere may be a token wearing a unit.
    expect(JSON.stringify({ style: instance.style, props: instance.props })).not.toContain(')px');
  });

  test('the structural defaults are there and are not ports', () => {
    const { modules } = loadGeneratedKit(indexJs);
    const instance = instantiate(createNodeFromReactComponent(modules[0].reactNodes[0] as ReactNodeDefinition));

    expect(instance.style).toMatchObject({ display: 'flex', flexDirection: 'column', borderStyle: 'solid' });
  });

  test('it renders, with real React, and the tokens reach the markup', () => {
    // The single-React guarantee, exercised rather than assumed: the component
    // calls `useRef` and `useEffect`, so a second React copy would throw
    // "Invalid hook call" right here.
    const { modules } = loadGeneratedKit(indexJs);
    const def = modules[0].reactNodes[0] as ReactNodeDefinition;
    const Component = (def.getReactComponent as any)() as React.ComponentType<any>;
    const instance = instantiate(createNodeFromReactComponent(def));

    const markup = renderToStaticMarkup(
      React.createElement(Component, {
        ...instance.props,
        style: instance.style,
        value: '£1,234.50',
        noodlNode: null
      })
    );

    expect(markup).toContain('Revenue');
    expect(markup).toContain('£1,234.50');
    // ⚠️ Written first as `toContain('var(--space-1)')`, which passes on the
    // broken build too — `var(--space-1)px` contains it. The unit-suffix check
    // is what makes these assertions distinguish the two worlds; the containment
    // ones alone do not.
    expect(markup).toContain('margin-top:var(--space-1)');
    expect(markup).toContain('font-size:var(--text-sm)');
    expect(markup).toContain('color:var(--muted-foreground)');
    expect(markup).not.toContain(')px');
  });

  test('the highlight decision comes from the graph, and it works both ways', () => {
    // P2 as behaviour rather than as a comment: flipping the *input* changes
    // the colour, and nothing in the component decided when to flip it.
    const { modules } = loadGeneratedKit(indexJs);
    const def = modules[0].reactNodes[0] as ReactNodeDefinition;
    const Component = (def.getReactComponent as any)() as React.ComponentType<any>;
    const instance = instantiate(createNodeFromReactComponent(def));

    const render = (highlighted: boolean) =>
      renderToStaticMarkup(
        React.createElement(Component, { ...instance.props, highlighted, style: instance.style, noodlNode: null })
      );

    expect(render(true)).toContain('var(--primary)');
    // The control: the same assertion has to be false in the other arm, or it
    // is measuring the presence of a string rather than the effect of a port.
    expect(render(false)).not.toContain('var(--primary)');
  });
});
