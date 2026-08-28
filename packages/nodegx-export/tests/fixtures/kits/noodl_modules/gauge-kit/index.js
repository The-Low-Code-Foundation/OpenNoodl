/**
 * A hand-written kit, in the shape every real one on this machine has: an IIFE reading
 * `window.React`, three node definitions, `Noodl.defineModule` at the end.
 *
 * Deliberately covers every port shape the export has to translate:
 *   Dial   — inputProps, an `outputProps` signal, an `outputs` value AND an `outputs` signal
 *            (`settled`, fired from `initialize` with no outputProps entry — the shape that
 *            disappears if only `outputProps` is read).
 *   Tray   — allowChildren, so children have somewhere to go.
 *   Ticker — a LOGIC node: `nodes:` not `reactNodes:`, `inputs:` with a `set`, no React component.
 */
(function () {
  var React = window.React;
  var h = React.createElement;

  function DialComponent(props) {
    // 🔴 TWO separate targets, and that is what makes the fixture drivable rather than merely
    // observable. The two output paths — the `outputProps` callback prop `onPress`, and the
    // `initialize`-installed `onSettle` that publishes `liveReading` and fires `settled` — write
    // the same popup slot in the graph, so a single click that fired both would prove only that
    // *one* of them arrived. Separate targets let a drive tell them apart.
    return h(
      'div',
      { className: props.className, 'data-dial': props.label },
      String(props.label || '') + ': ' + String(props.reading || 0) + '/' + String(props.maxReading || 0),
      h('button', { type: 'button', 'data-dial-press': '', onClick: props.onPress }, 'press'),
      h(
        'button',
        {
          type: 'button',
          'data-dial-settle': '',
          onClick: function () {
            if (props.onSettle) props.onSettle(Number(props.reading) || 0);
          }
        },
        'settle'
      )
    );
  }

  var Dial = {
    name: 'qa.gauge.Dial',
    displayNodeName: 'Pressure Dial',
    docs: 'A dial that reports what its needle is pointing at.',
    allowChildren: false,
    getReactComponent: function () {
      return DialComponent;
    },
    initialize: function () {
      var self = this;
      this._internal.liveReading = 0;
      this.props.onSettle = function (v) {
        self._internal.liveReading = v;
        self.flagOutputDirty('liveReading');
        self.sendSignalOnOutput('settled');
      };
    },
    inputProps: {
      label: { type: 'string', displayName: 'Label', group: 'Content' },
      reading: { type: 'number', displayName: 'Reading', group: 'Content', default: 0 },
      maxReading: { type: 'number', displayName: 'Max', group: 'Content', default: 100 },
      dialSize: { type: { name: 'number', units: ['px'], defaultUnit: 'px' }, displayName: 'Size', default: 96 },
      showNeedle: { type: 'boolean', displayName: 'Show Needle', default: true }
    },
    outputProps: {
      onPress: { type: 'signal', displayName: 'Pressed', group: 'Events' }
    },
    outputs: {
      liveReading: {
        type: 'number',
        displayName: 'Live Reading',
        group: 'Values',
        get: function () {
          return this._internal.liveReading;
        }
      },
      settled: { type: 'signal', displayName: 'Settled', group: 'Events' }
    }
  };

  function TrayComponent(props) {
    return h('section', { className: props.className, title: props.trayTitle }, props.children);
  }

  var Tray = {
    name: 'qa.gauge.Tray',
    displayNodeName: 'Instrument Tray',
    allowChildren: true,
    getReactComponent: function () {
      return TrayComponent;
    },
    inputProps: {
      trayTitle: { type: 'string', displayName: 'Title', default: 'Instruments' }
    }
  };

  var Ticker = {
    name: 'qa.gauge.Ticker',
    category: 'Data',
    displayNodeName: 'Ticker',
    docs: 'A logic node. It has no React component and this export does not run it.',
    initialize: function () {
      this._internal.value = 0;
    },
    inputs: {
      seed: {
        type: 'number',
        displayName: 'Seed',
        default: 0,
        set: function (v) {
          this._internal.value = v;
          this.flagOutputDirty('tick');
        }
      }
    },
    outputs: {
      tick: {
        type: 'number',
        displayName: 'Tick',
        get: function () {
          return this._internal.value;
        }
      }
    }
  };

  Noodl.defineModule({ reactNodes: [Dial, Tray], nodes: [Ticker] });
})();
