/**
 * Tiny Kit — the smallest real module for LBR-008's install tests.
 *
 * A real kit, not a stub: the suite runs the shipped extractor over this file
 * after install, so what it declares is what the overlay reports. Same shape
 * as CN-003's demo-kit fixture, one node.
 */
(function () {
  var React = window.React;
  var h = React.createElement;

  function Chip(props) {
    return h('span', { style: { background: props.background, borderRadius: 8 } }, props.label);
  }

  var ChipNode = {
    name: 'tiny.kit.Chip',
    displayNodeName: 'Tiny Chip',
    docs: 'A one-word chip.',
    allowChildren: false,
    getReactComponent: function () {
      return Chip;
    },
    inputProps: {
      label: { type: 'string', displayName: 'Label', group: 'Content', default: 'Chip' },
      background: { type: 'color', displayName: 'Background', group: 'Style', default: 'var(--color-surface)' }
    }
  };

  Noodl.defineModule({
    reactNodes: [ChipNode]
  });
})();
