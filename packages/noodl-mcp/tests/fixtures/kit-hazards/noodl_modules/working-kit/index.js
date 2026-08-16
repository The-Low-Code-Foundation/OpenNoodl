/**
 * The healthy kit standing beside a broken one.
 *
 * Its whole job is to still be there in the result: a throwing neighbour must
 * cost you its own nodes and nothing else. Its manifest declares two runtimes,
 * so it also pins `availableIn` coming from the manifest rather than being
 * assumed to be `["browser"]`.
 */
(function () {
  var React = window.React;

  Noodl.defineModule({
    reactNodes: [
      {
        name: 'demo.kit.Survivor',
        displayNodeName: 'Survivor',
        allowChildren: false,
        getReactComponent: function () {
          return function (props) {
            return React.createElement('div', null, props.caption);
          };
        },
        inputProps: {
          caption: { type: 'string', displayName: 'Caption', group: 'Content', default: 'still here' }
        }
      }
    ]
  });
})();
