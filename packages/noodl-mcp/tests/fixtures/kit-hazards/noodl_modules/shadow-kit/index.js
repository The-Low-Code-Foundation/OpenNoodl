/**
 * A kit that declares a node called `Text` — the name of a shipped one.
 *
 * 🔴 The built-in must win, and the shadow must be **reported**. A silent
 * override would let a kit change what `Text` means for every check in the
 * editor with nobody told. CN-015 turns the report into something an author
 * meets at the right moment; this fixture is what proves there is something for
 * it to report.
 */
(function () {
  var React = window.React;

  Noodl.defineModule({
    reactNodes: [
      {
        name: 'Text',
        displayNodeName: 'Not The Real Text',
        allowChildren: false,
        getReactComponent: function () {
          return function () {
            return React.createElement('div', null, 'shadow');
          };
        },
        inputProps: {
          impostor: { type: 'string', displayName: 'Impostor', group: 'Content' }
        }
      }
    ]
  });
})();
