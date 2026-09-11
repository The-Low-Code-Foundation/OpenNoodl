/**
 * Dynports Kit — a kit whose nodes declare `dynamicports`, for CN-004 item 4.
 *
 * ⚠️ **A real kit, run by the real extractor.** The shipped `demo-kit` fixture
 * declares no `dynamicports` at all, and the cashflow kit does not either — which
 * is precisely why the overlay called every dynamic mechanism
 * `declared-port-groups` for a whole task without anything noticing. A kit that
 * exercises the shapes had to exist before the carve-out could be graded.
 *
 * The two nodes are the two halves of the distinction CN-004 item 4 turns on:
 *
 *  - **Panel** declares a *conditional group* — a fixed, enumerable port set
 *    switched on by a sibling parameter's value. Its ports are as static as
 *    anyone's and must be checked, condition and all.
 *  - **Feed** declares a *channel port* — a port whose name comes from a channel
 *    at runtime. `generateNodeLibrary` deliberately keeps a channel port out of
 *    the exported static `ports` list, so this is the shape that produces a
 *    guaranteed false `unknown-parameter` if the carve-out is wrong.
 */
(function () {
  var React = window.React;
  var h = React.createElement;

  function Panel(props) {
    return h('div', null, props.title, props.mode === 'list' ? ' (' + props.itemCount + ')' : null);
  }

  function Feed(props) {
    return h('div', null, props.heading);
  }

  var PanelNode = {
    name: 'dynports.kit.Panel',
    displayNodeName: 'Dyn Panel',
    docs: 'A panel whose list options appear only when it is in list mode.',
    getReactComponent: function () {
      return Panel;
    },
    inputProps: {
      title: { type: 'string', displayName: 'Title', group: 'Content', default: 'Panel' },
      mode: {
        type: { name: 'enum', enums: [{ label: 'List', value: 'list' }, { label: 'Grid', value: 'grid' }] },
        displayName: 'Mode',
        group: 'Content',
        default: 'grid'
      },
      // Declared as an ordinary input AND named by the conditional group below —
      // which is how the runtime's own conditional ports are written, and why
      // the exported entry can carry full port metadata.
      itemCount: { type: 'number', displayName: 'Item Count', group: 'List', default: 3 }
    },
    outputProps: {},
    dynamicports: [
      {
        name: 'conditionalports/basic',
        condition: 'mode = list',
        inputs: ['itemCount']
      }
    ]
  };

  var FeedNode = {
    name: 'dynports.kit.Feed',
    displayNodeName: 'Dyn Feed',
    docs: 'A feed that receives its payload over a channel named at runtime.',
    getReactComponent: function () {
      return Feed;
    },
    inputProps: {
      heading: { type: 'string', displayName: 'Heading', group: 'Content', default: 'Feed' }
    },
    outputProps: {},
    dynamicports: [
      {
        // The exporter excludes a channel port from the static `ports` list, so
        // nothing but the mechanism can tell a consumer that this port is real.
        channelPort: { plug: 'input', name: 'channelName' },
        name: 'channel'
      }
    ]
  };

  function defineNodes(Noodl) {
    Noodl.defineModule({
      reactNodes: [PanelNode, FeedNode],
      nodes: [],
      setup: function () {}
    });
  }

  if (typeof Noodl !== 'undefined') defineNodes(Noodl);
  else if (typeof window !== 'undefined' && window.Noodl) defineNodes(window.Noodl);
})();
