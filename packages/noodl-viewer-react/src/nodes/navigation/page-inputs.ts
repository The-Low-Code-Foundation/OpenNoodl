import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

interface PageInputsInstance extends NodeInstance {
  _internal: {
    /** Current value of each page parameter, keyed without the `pm-` prefix. */
    params: Record<string, unknown>;
    pathParams?: string;
    queryParams?: string;
  };
  getPageParam(name: string): unknown;
}

const PageInputsNode: NodeDefinitionOptions = {
  name: 'PageInputs',
  displayNodeName: 'Page Inputs',
  category: 'Navigation',
  docs: 'https://docs.noodl.net/nodes/navigation/page-inputs',
  color: 'component',
  initialize: function (this: PageInputsInstance) {
    const internal = this._internal;

    internal.params = {};
  },
  inputs: {
    pathParams: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Path Parameters',
      group: 'Path Parameters',
      description: 'Names of the braced segments in this page’s route, one output port each',
      set: function (this: PageInputsInstance, value: string) {
        this._internal.pathParams = value;
      }
    },
    queryParams: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Query Parameters',
      group: 'Query Parameters',
      description: 'Names of query-string parameters to read from the URL, one output port each',
      set: function (this: PageInputsInstance, value: string) {
        this._internal.queryParams = value;
      }
    }
  },
  outputs: {},
  methods: {
    /** Called by the Router / Component Stack when this node's page is (re)entered. */
    _setPageParams: function (this: PageInputsInstance, params: Record<string, unknown>) {
      for (const key in params) {
        this._internal.params[key] = params[key];
        if (this.hasOutput('pm-' + key)) this.flagOutputDirty('pm-' + key);
      }
    },
    getPageParam: function (this: PageInputsInstance, name: string) {
      return this._internal.params[name];
    },
    registerOutputIfNeeded: function (this: PageInputsInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('pm-'))
        return this.registerOutput(name, {
          getter: this.getPageParam.bind(this, name.substring('pm-'.length))
        });
    }
  }
};

/**
 * NDA-012 (Navigation). **This node had no connectable ports at all**, and had not had any
 * since the initial commit — the whole of `setup` was commented out, so nothing ever called
 * `sendDynamicPorts` for it. Every one of its real outputs is a `pm-*` announced from here.
 *
 * The runtime half was intact the entire time: `_setPageParams` is called by the Router
 * (`router.tsx:298,330`) and by the Component Stack, and `registerOutputIfNeeded` resolves
 * `pm-*` to `getPageParam`. What was missing was the editor ever being told the ports exist,
 * and a port the editor does not know about cannot be connected to — so a `Page Inputs` node
 * in the picker (`nodelibraryexport.ts:568`) added a node with two edit-only stringlists and
 * no way to read a single parameter out of it. This is the same shape as the Cloud Services
 * pass's FINDINGS CS-i, one step further along: there the node could not be added, here it
 * can be added and does nothing.
 *
 * `params` reaches the node as one flat map — the Router merges path matches and query
 * (`router.tsx:272`) before handing it over — so both stringlists produce ports in the same
 * namespace, and a name in both lists is one port, not two.
 */
function setup(context: NodeContextLike, graphModel: GraphModelLike) {
  if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
    return;
  }
  const editorConnection: EditorConnectionLike = context.editorConnection;

  function _managePortsForNode(node: GraphNodeModel) {
    function _updatePorts() {
      const uniqueNames = new Set<string>();

      for (const key of ['pathParams', 'queryParams']) {
        const value = node.parameters[key] as string | undefined;
        if (value === undefined) continue;
        for (const name of value.split(',')) {
          // A trailing comma in the stringlist would otherwise announce a port with an
          // empty name, which the editor renders as an unlabelled row.
          if (name !== '') uniqueNames.add(name);
        }
      }

      const ports = Array.from(uniqueNames).map((outputName) => ({
        name: 'pm-' + outputName,
        displayName: outputName,
        type: '*',
        plug: 'output' as const,
        group: 'Parameters'
      }));

      editorConnection.sendDynamicPorts(node.id, ports);
    }

    _updatePorts();
    node.on('parameterUpdated', function (event) {
      if (event.name === 'pathParams' || event.name === 'queryParams') {
        _updatePorts();
      }
    });
  }

  graphModel.on('editorImportComplete', () => {
    graphModel.on('nodeAdded.PageInputs', function (node: GraphNodeModel) {
      _managePortsForNode(node);
    });

    for (const node of graphModel.getNodesWithType('PageInputs')) {
      _managePortsForNode(node);
    }
  });
}

const PageInputsModule: NodeModule = {
  node: PageInputsNode,
  setup: setup
};

export default PageInputsModule;
