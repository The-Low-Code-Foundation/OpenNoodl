// @ts-check
/**
 * Example Node Kit — a NodeGX node kit.
 *
 * Hand-written. No SDK, no bundler, no npm install, no build step. The runtime
 * installs React as a global before this file runs, so there is exactly one
 * React on the page and hooks are safe to use.
 *
 * ── The rule this file is written to follow ─────────────────────────────────
 *
 *   Ports are the product. JavaScript is the escape hatch.
 *
 * Every decision somebody building an app should be able to make is a PORT:
 * colour, spacing, radius, font size — and, the one people get wrong, every
 * threshold. Nothing below decides *when* a tile counts as highlighted. That
 * arrives on the `Highlighted` input, so the rule lives in the graph where it
 * is visible and editable without opening this file. README.md shows it wired
 * to a stock Expression node.
 *
 * Colour and spacing ports default to design tokens rather than hex and pixels,
 * so a node from this kit inherits the project's design system instead of
 * fighting it. Change a token once and every node follows.
 *
 * ── Autocomplete ────────────────────────────────────────────────────────────
 *
 * The `@type` annotations below point at `types/node-kit`, a copy of the
 * published definition types that the scaffold wrote next to this file. No npm
 * install and no tsconfig: open this folder in any editor that speaks
 * TypeScript and the fields, port types and callback signatures are all there.
 */
(function () {
  // ✅ D19 — React is a global the runtime installs before this file runs. Read
  // it bare; never `window.React`. A server render (SSR/SSG) and a cloud
  // function have no `window`, so a kit that reaches for one throws at import,
  // is missing from the server-rendered HTML, and shows up only after the
  // browser hydrates — a mismatch that is silent unless you look for it.
  var h = React.createElement;

  /** @type {import('./types/node-kit').ReactNodeDefinition} */
  var StatTile = {
    name: 'example-node-kit.StatTile',
    displayNodeName: 'Stat Tile',

    // One sentence saying what this node is FOR. It is not decoration: it is
    // the node's help text in the property panel, and it is what the AI
    // assistant and an MCP agent are told the node does. Without it a kit node
    // reaches both with a name and nothing else.
    docs: 'Shows one number with a label, and highlights it when the graph says to.',

    // A page of your own, if the kit has one. Kept apart from `docs` above
    // because that field is prose and this one is a link — the panel renders
    // the sentence as help text and this as "read more". Delete the line rather
    // than pointing it somewhere that does not exist yet: an absent field shows
    // no button, a wrong one shows a button that opens a 404.
    // docsUrl: 'https://example.com/docs/example-node-kit',

    getReactComponent: function () {
      return function StatTileComponent(props) {
        // The DOM handoff every visual kit node needs: it is what lets the
        // editor highlight this node on the canvas, and what the shared
        // bounding-box outputs measure. A hook, on purpose — if the page ever
        // had a second React this line would throw rather than misbehave
        // quietly.
        var el = React.useRef(null);
        React.useEffect(function () {
          props.noodlNode && props.noodlNode.setDOMElement(el.current);
        }, []);

        return h(
          'div',
          { ref: el, style: props.style, onClick: props.onClick },
          h('div', { style: { fontSize: props.labelSize, color: props.labelColor } }, props.label),
          h(
            'div',
            {
              style: {
                fontSize: props.valueSize,
                marginTop: props.gap,
                // Note what is NOT here: any rule about when to highlight.
                // The graph decided that and sent the answer in.
                color: props.highlighted ? props.highlightColor : 'inherit'
              }
            },
            props.value
          )
        );
      };
    },

    noodlNodeAsProp: true,
    usePortAsLabel: 'label',

    // Structure, not decisions. These are what make the node a box at all, so
    // they are not ports. The test: if you can imagine wanting to change one
    // from the graph, it was a decision — move it into inputCss.
    defaultCss: { display: 'flex', flexDirection: 'column', borderStyle: 'solid' },

    // Values handed to the React component above, for the elements it draws
    // itself. A colour for inner text has to live here — inputCss styles only
    // this node's own outer box.
    inputProps: {
      label: { type: 'string', displayName: 'Label', group: 'Content', default: 'Revenue' },
      value: {
        type: 'string',
        displayName: 'Value',
        group: 'Content',
        default: '—',
        description: 'Format the number in the graph — a Function or Expression node — not in here.'
      },
      highlighted: {
        type: 'boolean',
        displayName: 'Highlighted',
        group: 'Content',
        default: false,
        description: 'Drive this from an Expression node. The threshold is a decision, so it belongs in the graph.'
      },

      gap: { type: { name: 'number', units: ['px'], defaultUnit: 'px' }, displayName: 'Gap', group: 'Style', default: 'var(--space-1)' },
      labelSize: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Label Size',
        group: 'Style',
        default: 'var(--text-sm)'
      },
      valueSize: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Value Size',
        group: 'Style',
        default: 'var(--text-2xl)'
      },
      labelColor: { type: 'color', displayName: 'Label Colour', group: 'Style', default: 'var(--muted-foreground)' },
      highlightColor: { type: 'color', displayName: 'Highlight Colour', group: 'Style', default: 'var(--primary)' }
    },

    // Styles written straight onto this node's own element.
    inputCss: {
      backgroundColor: { type: 'color', displayName: 'Background', group: 'Style', default: 'var(--surface-raised)' },
      color: { type: 'color', displayName: 'Text Colour', group: 'Style', default: 'var(--foreground)' },
      borderColor: { type: 'color', displayName: 'Border Colour', group: 'Style', default: 'var(--border)' },
      borderWidth: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Border Width',
        group: 'Style',
        default: 'var(--border-1)'
      },
      borderRadius: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Corner Radius',
        group: 'Style',
        default: 'var(--radius-md)'
      },
      padding: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Padding',
        group: 'Style',
        default: 'var(--space-4)'
      }
    },

    // What this node sends back out into the graph.
    outputProps: {
      onClick: { type: 'signal', displayName: 'Click', group: 'Events' }
    }
  };

  /** @type {import('./types/node-kit').NodeKitModule} */
  var kit = {
    reactNodes: [StatTile]
  };

  Noodl.defineModule(kit);
})();
