/**
 * A kit, reduced to the one thing CN-001's regression test needs it to be: a
 * file that must reach the page as a `<script>` tag.
 *
 * It is not executed by that test — the test asserts on the emitted tag, not on
 * a render — but it is a real, working definition on purpose. A fixture that
 * could not actually run would let the tag assertion pass while the thing the
 * tag exists to load was nonsense.
 */
(function () {
  var React = window.React;

  Noodl.defineModule({
    reactNodes: [
      {
        name: 'demo.kit.Badge',
        displayNodeName: 'Demo Badge',
        allowChildren: false,
        getReactComponent: function () {
          return function Badge(props) {
            return React.createElement('div', { className: props.className }, props.label || '');
          };
        },
        inputProps: {
          label: { type: 'string', displayName: 'Label', group: 'Content', default: '' }
        }
      }
    ]
  });
})();
