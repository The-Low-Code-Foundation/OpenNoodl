// @ts-check
/**
 * A LOGIC-only kit, annotated with the published types — CN-012's AC3 fixture.
 *
 * The green arm above (`kit-annotated`) is a *visual* kit, and until CN-012 the
 * logic half of this package was marked provisional precisely because nothing
 * like this file existed. So this is the fixture that earns the marker's
 * removal: no React, no DOM, no `getReactComponent` — `nodes` rather than
 * `reactNodes`, which is the half nobody had run.
 *
 * 🔴 Every member touched here is one CN-012 measured on a kit that really ran:
 * a signal input holding state, `flagOutputDirty`, `sendSignalOnOutput`, and the
 * `runOnValueChange` / `shouldRunOnValueChange` pair — which is the one that
 * caught the author out, because declaring the field creates the checkbox port
 * and wires nothing.
 */
(function () {
  /** @type {import('../../../src/index').LogicNodeDefinition} */
  var Accumulator = {
    name: 'tally.kit.Accumulator',
    displayNodeName: 'Tally Accumulator',
    category: 'Math',
    color: 'data',
    docs: 'Adds Step to a running total each time Add fires.',

    initialize: function () {
      this._internal.total = 0;
      this._internal.step = 1;
    },

    getInspectInfo: function () {
      return 'Total: ' + this._internal.total;
    },

    inputs: {
      add: {
        group: 'Actions',
        displayName: 'Add',
        valueChangedToTrue: function () {
          this._internal.total = Number(this._internal.total) + Number(this._internal.step);
          this.flagOutputDirty('total');
          this.sendSignalOnOutput('totalChanged');
        }
      },
      step: {
        group: 'Values',
        type: 'number',
        displayName: 'Step',
        default: 1,
        set: function (value) {
          this._internal.step = Number(value);
        }
      }
    },

    outputs: {
      total: {
        group: 'Values',
        type: 'number',
        displayName: 'Total',
        getter: function () {
          return this._internal.total;
        }
      },
      totalChanged: {
        group: 'Events',
        type: 'signal',
        displayName: 'Total Changed'
      }
    }
  };

  /** @type {import('../../../src/index').LogicNodeDefinition} */
  var Gauge = {
    name: 'tally.kit.Gauge',
    category: 'Math',
    displayNodeName: 'Tally Gauge',

    initialize: function () {
      this._internal.reading = 0;
    },

    inputs: {
      read: {
        group: 'Actions',
        displayName: 'Read',
        valueChangedToTrue: function () {
          this.flagOutputDirty('output');
        }
      },
      reading: {
        group: 'Values',
        type: 'number',
        displayName: 'Reading',
        default: 0,
        set: function (value) {
          this._internal.reading = Number(value);
          // 🔴 The guard the declaration does NOT write for you. Without it the
          // output keeps the value pushed at boot and the node looks broken.
          if (this.shouldRunOnValueChange('reading')) this.flagOutputDirty('output');
        }
      }
    },

    runOnValueChange: {
      controlSignal: 'read',
      inputs: ['reading']
    },

    outputs: {
      output: {
        group: 'Values',
        type: 'number',
        displayName: 'Output',
        getter: function () {
          return this._internal.reading;
        }
      }
    }
  };

  /** @type {import('../../../src/index').NodeKitModule} */
  var module_ = { nodes: [Accumulator, Gauge] };

  Noodl.defineModule(module_);
})();
