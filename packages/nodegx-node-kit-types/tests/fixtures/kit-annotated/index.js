// @ts-check
/**
 * A correct kit, annotated with the published types — CN-005's AC3 fixture and
 * AC4's smallest caller.
 *
 * This is what a kit's `index.js` looks like: no import, no build, no npm. React
 * arrives as `window.React` before this file runs. The only thing the annotation
 * changes is that the author's editor now knows the shape.
 *
 * In a real kit the annotation points at a copy of the `.d.ts` sitting in the kit
 * folder (`'./types/node-kit'`) — see `resolution.test.js`, which proves that form
 * works with no node_modules and no tsconfig. Here it points into the package so
 * the fixture typechecks where it lives and opens cleanly in an editor.
 */
(function () {
  var React = window.React;
  var h = React.createElement;

  /** @type {import('../../../src/index').ReactNodeDefinition} */
  var Chip = {
    name: 'demokit.Chip',
    displayNodeName: 'Chip',
    docs: 'https://docs.nodegx.io/kits/demo/chip',

    getReactComponent: function () {
      return function ChipComponent(props) {
        return h(
          'span',
          {
            style: props.style,
            onClick: props.onClick,
            ref: function (el) {
              props.noodlNode && props.noodlNode.setDOMElement(el);
            }
          },
          props.label
        );
      };
    },

    noodlNodeAsProp: true,
    usePortAsLabel: 'label',
    useVariants: true,
    visualStates: [{ name: 'hover', label: 'Hover' }],

    // Every decision the app builder should own is a port, not a constant.
    inputProps: {
      label: {
        type: 'string',
        displayName: 'Label',
        group: 'Content',
        default: 'Chip',
        description: 'Text shown inside the chip.'
      },
      tone: {
        type: { name: 'enum', enums: ['neutral', 'positive', 'warning'] },
        displayName: 'Tone',
        group: 'Content',
        default: 'neutral'
      }
    },

    inputCss: {
      backgroundColor: {
        type: 'color',
        displayName: 'Background',
        group: 'Style',
        default: 'var(--color-surface-2)',
        allowVisualStates: true
      },
      paddingLeft: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Padding Left',
        group: 'Style',
        default: 8,
        targetStyleProperty: 'paddingLeft'
      }
    },

    inputs: {
      flash: {
        displayName: 'Flash',
        group: 'Actions',
        // A signal input: `this` is the node instance, fully typed.
        valueChangedToTrue: function () {
          this.setStyle({ opacity: '0.5' });
          this.withInnerComponent(function () {
            /* the inner component exists by now */
          });
          this.forceUpdate();
        }
      }
    },

    outputProps: {
      onClick: { type: 'signal', displayName: 'Click', group: 'Events' }
    },

    outputs: {
      width: {
        type: 'number',
        displayName: 'Width',
        group: 'Geometry',
        get: function () {
          var el = this.getDOMElement();
          return el ? el.clientWidth : 0;
        }
      }
    },

    // The declarative dynamic-port form: names, not port objects.
    dynamicports: [
      {
        name: 'conditionalports/basic',
        condition: 'tone = warning',
        inputs: ['backgroundColor']
      }
    ],

    initialize: function () {
      this._internal.mountedAt = 0;
    },

    methods: {
      remeasure: function () {
        this.flagOutputDirty('width');
      }
    },

    getInspectInfo: function () {
      return [{ type: 'value', value: this.getInputValue('label') }];
    }
  };

  /** @type {import('../../../src/index').NodeKitModule} */
  var module_ = { reactNodes: [Chip] };

  Noodl.defineModule(module_);
})();
