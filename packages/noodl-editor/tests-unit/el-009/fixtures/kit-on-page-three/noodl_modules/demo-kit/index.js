/**
 * A kit that is actually EXECUTED, which is what separates this fixture from
 * CN-001's.
 *
 * CN-001 asserts on the emitted `<script>` tag and never runs the file, and it
 * says so and gives its reason. EL-009 AC4 is the other half of that sentence:
 * a tag in the document proves the injector fired, and proves nothing about
 * whether the node it defines ever drew on the page the caller cares about.
 * This module therefore has to work in a real browser.
 *
 * ⚠️ `window.React` is read INSIDE `getReactComponent`, not at module scope.
 * Module scripts are emitted before the viewer bundle — deliberately, because
 * `defineModule` must exist and be collected before the viewer reads
 * `__noodl_modules` — so at the moment this IIFE runs, `window.React` is still
 * undefined. Reading it at module scope binds `undefined` forever and the node
 * renders nothing, which would look exactly like the injection failing.
 */
(function () {
  Noodl.defineModule({
    reactNodes: [
      {
        name: 'demo.kit.Badge',
        displayNodeName: 'Demo Badge',
        allowChildren: false,
        getReactComponent: function () {
          var React = window.React;
          return function Badge(props) {
            return React.createElement(
              'div',
              {
                className: props.className,
                // Explicit and visible: an element with no size is
                // `content-not-visible`, a different finding from the blank
                // this fixture's control is meant to produce.
                style: { fontSize: '24px', lineHeight: '32px', color: '#101828', padding: '16px' }
              },
              props.label || ''
            );
          };
        },
        inputProps: {
          label: { type: 'string', displayName: 'Label', group: 'Content', default: '' }
        }
      }
    ]
  });
})();
