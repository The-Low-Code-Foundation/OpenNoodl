import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import type { ComponentModelLike, GraphModelLike, GraphNodeModel, NodeContextLike } from '@noodl/types';

import { META_TAGS, Page } from '../../components/navigation/Page';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, ReactNodeInstance } from '../../react-component-node';

interface PageNodeInstance extends ReactNodeInstance {
  _internal: {
    title?: string;
    urlPath?: string;
  };
}

/**
 * NDA-012 (Visual) D1. Derive a URL path segment from a component title.
 *
 * The old derivation was `title.replace(/\s+/g, '-').toLowerCase()` and nothing else, so a
 * component called `Order #1 & Co` proposed the path `order-#1-&-co`. That is not a path: `#`
 * starts the fragment — and the *hash* router puts the whole route after a `#` already — while
 * `&` and `?` are query delimiters. The proposal is what the author accepts by not editing it,
 * so an unsanitised default is a route that silently does not match.
 *
 * What is removed is the RFC 3986 delimiter set plus whitespace, `%` and the characters
 * browsers rewrite — a **deny** list, not an allow list. Allow-listing `[a-z0-9]` was the first
 * version of this and it turned `Über Café` into `ber-caf`, silently deleting most of a title
 * that percent-encodes perfectly well. Non-ASCII titles keep their letters; the router decodes
 * each path segment exactly once, so they round-trip.
 *
 * Runs of separators collapse and the ends are trimmed. A title with no usable characters at
 * all yields `''`, which the author must then fill in — proposing a path of `-` would be worse.
 *
 * ⚠️ Not `\p{L}`-based, which would read better: this package compiles at `target: es5` and
 * unicode property escapes need ES2018.
 */
export function toUrlPathSegment(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s:/?#[\]@!$&'()*+,;=%"<>\\^`{|}]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

const PageNode = {
  name: 'Page',
  displayNodeName: 'Page',
  category: 'Visuals',
  docs: 'https://docs.noodl.net/nodes/navigation/page',
  useVariants: false,
  mountedInput: false,
  allowAsExportRoot: false,
  singleton: true,
  connectionPanel: {
    groupPriority: ['General', 'Mounted']
  },
  initialize: function (this: PageNodeInstance) {
    this.props.layout = 'column'; //this allows the children to know what type of layout type they're in
  },
  // The SSR_PageLoading announce must happen AFTER connections are wired:
  // NodeScope.setComponentModel creates all nodes (running initialize) before
  // it adds any connection, so isInputConnected() is always false during
  // initialize — the original announce there could never fire.
  nodeScopeDidInitialize: function (this: PageNodeInstance) {
    if (this.isInputConnected('onPageReady')) {
      this.nodeScope.context.eventEmitter.emit('SSR_PageLoading', this.id);
    }
  },
  defaultCss: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    alignItems: 'flex-start',
    flex: '1 1',
    alignSelf: 'stretch'
  },
  getReactComponent() {
    return Page;
  },
  // Needed so Page can report its root DOM element via setDOMElement
  // (findDOMNode is gone in React 19).
  noodlNodeAsProp: true,
  inputs: {
    // SSR readiness handshake. When this signal is connected, `initialize`
    // emits SSR_PageLoading and the SSR server holds the render until the
    // graph triggers the signal (→ SSR_PageReady) — e.g. after a data fetch
    // completes. Unconnected pages render as soon as the runtime settles.
    // Client-side the events are emitted too but nothing listens; harmless.
    onPageReady: {
      displayName: 'Page Ready',
      description: 'Pulse this once the page has the data it needs; the SSR server holds the rendered HTML until it fires. Unconnected pages render as soon as the runtime settles',
      group: 'Server Side Rendering',
      type: 'signal',
      valueChangedToTrue(this: PageNodeInstance) {
        // ERG-001 §4 — §0.3's "emits an internal `SSR_PageReady` event only". The event goes to
        // the SSR server; nothing on the canvas could see that the handshake had happened, so a
        // graph could not sequence anything after "the page has its data".
        const outcome = this.beginOutcome();
        this.nodeScope.context.eventEmitter.emit('SSR_PageReady', this.id);
        this.reportOutcome(outcome, 'done');
      }
    },
    sitemapIncluded: {
      index: 80001,
      displayName: 'Included',
      description: 'Lists this page in the generated sitemap',
      group: 'Experimental Sitemap',
      default: true,
      type: {
        name: 'boolean',
        allowEditOnly: true
      }
    },
    sitemapChangefreq: {
      index: 80002,
      displayName: 'Change Freq',
      description: 'How often this page changes, as a hint to search-engine crawlers in the sitemap',
      group: 'Experimental Sitemap',
      default: 'weekly',
      type: {
        name: 'enum',
        allowEditOnly: true,
        enums: [
          { label: 'always', value: 'always' },
          { label: 'hourly', value: 'hourly' },
          { label: 'daily', value: 'daily' },
          { label: 'weekly', value: 'weekly' },
          { label: 'monthly', value: 'monthly' },
          { label: 'yearly', value: 'yearly' },
          { label: 'never', value: 'never' }
        ]
      }
    },
    sitemapPriority: {
      index: 80003,
      displayName: 'Priority',
      description: "This page's importance relative to the rest of the site, from 0 to 1, in the sitemap",
      group: 'Experimental Sitemap',
      default: 0.5,
      type: {
        name: 'number',
        allowEditOnly: true
      }
    }
    // NOTE: Hide this for now, this is going to be important for SSR
    // sitemapScript: {
    //   index: 80004,
    //   displayName: 'Script',
    //   group: 'Sitemap',
    //   type: {
    //     name: 'string',
    //     allowEditOnly: true,
    //     codeeditor: 'javascript'
    //   }
    // }
  },
  // ERG-001 §4 / OUTCOME-CONTRACT.md.
  //
  // No `Failure` and no `Unchanged`, deliberately: "a node that cannot fail gets no `Failure`
  // port" and announcing an event on an emitter cannot fail, nor can it be a no-op — every
  // pulse announces. `Completed` is the port with no exemption, so it is here regardless.
  outputs: {
    ...outcomeOutputs({ done: 'Fires once the page has announced that it is ready to render' })
  },
  inputProps: META_TAGS.reduce<Record<string, unknown>>((result, x, index) => {
    result[x.key] = {
      index: 80000 + index,
      displayName: x.displayName,
      editorName: x.editorName || x.displayName,
      description: x.description,
      propPath: 'metatags',
      group: x.group,
      popout: x.popout,
      type: x.type || 'string'
    };
    return result;
  }, {}),
  methods: {
    getUrlPath: function (this: PageNodeInstance) {
      return this._internal.urlPath;
    },
    getTitle: function (this: PageNodeInstance) {
      return this._internal.title;
    },
    /* setRouter:function(value) {
            this._internal.router = value
        },*/
    setTitle: function (this: PageNodeInstance, value: string) {
      this._internal.title = value;
    },
    setUrlPath: function (this: PageNodeInstance, value: string) {
      this._internal.urlPath = value;
    },
    registerInputIfNeeded: function (this: PageNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      /*   if (name === 'router') return this.registerInput(name, {
                set: this.setRouter.bind(this)
            })*/

      if (name === 'title')
        return this.registerInput(name, {
          set: this.setTitle.bind(this)
        });

      if (name === 'urlPath')
        return this.registerInput(name, {
          set: this.setUrlPath.bind(this)
        });
    }
  },
  setup(context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    const editorConnection = context.editorConnection;

    function _managePortsForNode(node: GraphNodeModel) {
      function _updatePorts() {
        const ports = [];

        // Show router selector if more that one
        /*	var routers = graphModel.getNodesWithType('Router')
                if(routers.length > 1) {
                    ports.push({
                        plug: 'input',
                        type: { name: 'enum', enums: routers.map((r) => ({ label: (r.parameters['name'] || 'Main'), value: (r.parameters['name'] || 'Main') })), allowEditOnly: true },
                        group: 'General',
                        displayName: 'Router',
                        name: 'router',
                        default:'Main'
                    })
                }*/

        // Title and urlpath ports
        const titleParts = node.component.name.split('/');
        ports.push({
          name: 'title',
          displayName: 'Title',
          type: 'string',
          group: 'General',
          plug: 'input',
          default: titleParts[titleParts.length - 1]
        });

        const title = (node.parameters['title'] as string) || titleParts[titleParts.length - 1];
        const defaultUrlPath = toUrlPathSegment(title);
        ports.push({
          name: 'urlPath',
          displayName: 'Url Path',
          type: 'string',
          group: 'General',
          plug: 'input',
          default: defaultUrlPath
        });

        editorConnection.sendDynamicPorts(node.id, ports);
      }

      _updatePorts();
      node.on('parameterUpdated', function (ev) {
        if (ev.name === 'title') _updatePorts();
      });

      //  graphModel.on("nodeAdded.Router", _updatePorts)
      //  graphModel.on("nodeWasRemoved.Router", _updatePorts)
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.Page', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      graphModel.on('componentRenamed', function (component: ComponentModelLike) {
        const page = graphModel.getNodesWithType('Page').filter((x) => component.roots.includes(x.id));
        if (page.length > 0) {
          _managePortsForNode(page[0]);
        }
      });

      for (const node of graphModel.getNodesWithType('Page')) {
        _managePortsForNode(node);
      }
    });
  }
};

//NodeSharedPortDefinitions.addSharedVisualInputs(PageNode);
NodeSharedPortDefinitions.addPaddingInputs(PageNode);

export default createNodeFromReactComponent(PageNode);
