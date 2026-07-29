export const node = {
  name: 'noodl.cloud.response',
  displayNodeName: 'Response',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/response',
  useVariants: false,
  mountedInput: false,
  allowAsExportRoot: false,
  color: "data",
  connectionPanel: {
    groupPriority: ['General', 'Mounted']
  },
  dynamicports:[
    {
        name:'conditionalports/extended',
        condition:"status = success OR status NOT SET",
        inputs:['params']
    },
    {
      name:'conditionalports/extended',
      condition:"status = failure",
      inputs:['errorMessage']
    }
  ],
  initialize:function() {
    this._internal.responseParameters = {}
  },
  inputs: {
    params: {
      group: 'Parameters',
      type:{name:'stringlist',allowEditOnly:true},
      set: function (value) {
        this._internal.params = value;
      }
    },
    errorMessage: {
      group: 'General',
      type: 'string',
      displayName:'Error Message',
      set: function (value) {
        this._internal.errorMessage = value;
      }
    },
    send: {
      displayName: 'Send',
      type: 'signal',
      group: 'General',
      valueChangedToTrue: function () {
        this.sendResponse();
      }
    },
    status: {
      group: 'General',
      displayName:'Status',
      type: {
        name: 'enum',
        enums: [
          {
            label: 'Success',
            value: 'success'
          },
          {
            label: 'Failure',
            value: 'failure'
          }
        ]
      },
      default:'success',
      set: function(value) {
        this._internal.status = value;
      }
    }
  },
  // NDA-004 §3 — the last of the mute ten to be reachable.
  //
  // This node took a signal and emitted nothing at all, which hid two different things. A
  // Response node whose callback was never installed threw a `TypeError` from inside an input
  // setter (see `sendResponse`), and a second Send on an already-answered request was
  // swallowed in `noodl-viewer-cloud/src/index.ts` with no trace. Both now report, and a
  // response that *did* go out says so, so downstream logging and cleanup can be sequenced.
  outputs: {
    sent: {
      type: 'signal',
      displayName: 'Sent',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function () {
        return this._internal.lastError;
      }
    }
  },
  methods:{
    setResponseParameter:function(name,value) {
      this._internal.responseParameters[name] = value
    },
    /** Raise, publish on `Error`, and fire `Failure`. One place, so the two codes cannot drift. */
    _failResponse: function (code, message, detail) {
      this._internal.lastError = message;
      this.raiseRuntimeError(code, message, detail);
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
    },
    sendResponse: function () {
      const isSuccess = this._internal.status === undefined || this._internal.status === 'success';

      // `_sendResponseCallback` is installed per request, by `NoodlCloudRuntime.run`, over the
      // Response nodes that exist *at the moment the function component is created*. A Response
      // node created later — inside a Repeater template, or a component instantiated in response
      // to the request — is never given one, and this call used to be an unguarded invocation of
      // `undefined`: a `TypeError` thrown from inside an input setter, which is the least
      // legible way a node can fail. Now it is a failure with a name.
      if (typeof this._internal._sendResponseCallback !== 'function') {
        return this._failResponse(
          'response/no-request-in-scope',
          'This Response node has no request to answer — it was not part of the cloud function when the request arrived',
          { status: isSuccess ? 'success' : 'failure' }
        );
      }

      const alreadySent =
        'The request has already been answered — a cloud function can only send one response';

      // A request can only be answered once, and two Response nodes on two branches of one
      // graph is exactly how an author reaches the second call. Asked *before* delivering, so
      // the failure is reported while this node still exists to report it.
      if (this._internal._requestIsOpen && !this._internal._requestIsOpen()) {
        return this._failResponse('response/already-sent', alreadySent, { status: isSuccess ? 'success' : 'failure' });
      }

      const payload = isSuccess
        ? { statusCode: 200, body: JSON.stringify({ result: this._internal.responseParameters }) }
        : { statusCode: 400, body: JSON.stringify({ error: this._internal.errorMessage }) };

      // `Sent` fires BEFORE the callback, and that ordering is forced rather than chosen.
      // Delivering the response tears the request down synchronously — `NoodlCloudRuntime.run`
      // calls `functionComponent._onNodeDeleted()` and `requestScope.reset()` inside the
      // callback, *before* resolving — so by the time it returns, this node and everything
      // wired to its outputs have been deleted. A completion signal sent afterwards would
      // reach a graph that no longer exists, which is a completion signal in name only.
      //
      // Firing first is safe because nothing can intervene: the check above has established
      // the request is open, and the call below is the next statement on the same tick.
      this.sendSignalOnOutput('sent');

      // Belt and braces for a host that installs the callback without `_requestIsOpen` (the
      // return value is the older, coarser answer). Reached only if something downstream of
      // `Sent` answered the request first, which is pathological but not impossible.
      if (this._internal._sendResponseCallback(payload) === false) {
        this._failResponse('response/already-sent', alreadySent, { status: isSuccess ? 'success' : 'failure' });
      }
    },
    registerInputIfNeeded: function(name) {
      if(this.hasInput(name)) {
          return;
      }

      if(name.startsWith('pm-')) this.registerInput(name, {
          set: this.setResponseParameter.bind(this, name.substring('pm-'.length))
      })
    },
  }
};

export function setup(context, graphModel) {
  if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
    return;
  }

  function _managePortsForNode(node) {
    function _updatePorts() {
      var ports = []

      // Add params outputs
      if(node.parameters.status === 'success' || node.parameters.status === undefined) {
        var params = node.parameters.params;
        if (params !== undefined) {
          params = params.split(',');
          for (var i in params) {
            var p = params[i];

            ports.push({
              type: '*',
              plug: 'input',
              group: 'Parameters',
              name: 'pm-' + p,
              displayName: p
            })
          }
        }
      }

      context.editorConnection.sendDynamicPorts(node.id, ports);
    }

    _updatePorts();
    node.on("parameterUpdated", function (event) {
      if (event.name === 'params') {
        _updatePorts();
      }
    });
  }

  graphModel.on("editorImportComplete", () => {
    graphModel.on("nodeAdded.noodl.cloud.response", function (node) {
      _managePortsForNode(node)
    })

    for (const node of graphModel.getNodesWithType('noodl.cloud.response')) {
      _managePortsForNode(node)
    }
  })
}
