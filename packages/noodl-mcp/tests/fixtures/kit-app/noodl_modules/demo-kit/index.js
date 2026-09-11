/**
 * Demo Kit — the smallest real node kit, for CN-003's tests.
 *
 * ⚠️ **A real kit, not a stub.** The suite runs the shipped extractor over this
 * file, so what it declares is what the overlay is built from. A hand-written
 * payload would have been a fixture that never ran, which this phase has already
 * lost time to twice.
 *
 * Written the way the docs will teach (**P2**): every decision is a port, the
 * JavaScript only renders. Colour defaults are `var(--token)` per ✅ **D8** —
 * the bridge passes those through un-suffixed, and a fixture that hardcoded hex
 * would model the opposite of the ruling.
 */
(function () {
  var React = window.React;
  var h = React.createElement;

  function Badge(props) {
    return h(
      'div',
      {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          background: props.background,
          color: props.textColor,
          borderRadius: props.radius,
          padding: '0 ' + props.paddingX + 'px',
          fontSize: props.fontSize
        },
        onClick: props.onClick
      },
      props.label,
      props.showProgress ? ' ' + Math.round(props.progress) + '%' : null
    );
  }

  function Meter(props) {
    var fraction = props.max > 0 ? Math.max(0, Math.min(1, props.value / props.max)) : 0;
    return h(
      'div',
      { style: { background: props.trackColor, borderRadius: props.radius, height: props.height } },
      h('div', {
        style: {
          width: fraction * 100 + '%',
          height: '100%',
          background: props.fillColor,
          borderRadius: props.radius
        }
      })
    );
  }

  var BadgeNode = {
    name: 'demo.kit.Badge',
    displayNodeName: 'Demo Badge',
    docs: 'A labelled badge that can show a percentage.',
    allowChildren: false,
    getReactComponent: function () {
      return Badge;
    },
    initialize: function () {
      var self = this;
      this.props.onClick = function () {
        self.sendSignalOnOutput('clicked');
      };
    },
    inputProps: {
      label: { type: 'string', displayName: 'Label', group: 'Content', default: 'Badge' },
      progress: { type: 'number', displayName: 'Progress', group: 'Content', default: 0 },
      showProgress: { type: 'boolean', displayName: 'Show Progress', group: 'Content', default: true },
      background: { type: 'color', displayName: 'Background', group: 'Style', default: 'var(--color-primary)' },
      textColor: { type: 'color', displayName: 'Text Color', group: 'Style', default: 'var(--color-on-primary)' },
      radius: { type: 'number', displayName: 'Corner Radius', group: 'Style', default: 12 },
      paddingX: { type: 'number', displayName: 'Padding X', group: 'Style', default: 8 },
      fontSize: { type: 'number', displayName: 'Font Size', group: 'Style', default: 12 }
    },
    outputProps: {
      clicked: { type: 'signal', displayName: 'Clicked', group: 'Events' }
    }
  };

  var MeterNode = {
    name: 'demo.kit.Meter',
    displayNodeName: 'Demo Meter',
    docs: 'A horizontal meter. Outputs the fraction it is filled to, as a percentage.',
    allowChildren: false,
    getReactComponent: function () {
      return Meter;
    },
    inputProps: {
      value: { type: 'number', displayName: 'Value', group: 'Content', default: 0 },
      max: { type: 'number', displayName: 'Max', group: 'Content', default: 100 },
      trackColor: { type: 'color', displayName: 'Track Color', group: 'Style', default: 'var(--color-surface)' },
      fillColor: { type: 'color', displayName: 'Fill Color', group: 'Style', default: 'var(--color-primary)' },
      radius: { type: 'number', displayName: 'Corner Radius', group: 'Style', default: 4 },
      height: { type: 'number', displayName: 'Height', group: 'Style', default: 8 }
    },
    outputs: {
      percent: {
        type: 'number',
        displayName: 'Percent',
        group: 'Values',
        get: function () {
          var max = this.inputs && this.inputs.max ? this.inputs.max : 100;
          var value = this.inputs && this.inputs.value ? this.inputs.value : 0;
          return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
        }
      }
    }
  };

  Noodl.defineModule({
    reactNodes: [BadgeNode, MeterNode]
  });
})();
