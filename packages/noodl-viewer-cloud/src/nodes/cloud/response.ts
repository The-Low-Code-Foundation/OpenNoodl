import { outcomeOutputs } from '@noodl/runtime/src/outcome';

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
    },
    // WFA-009 — the same ports `setup()` below pushes, declared so the editor can
    // mint them with nothing running. The two MUST stay identical: if a cloud
    // runtime with an editor connection ever returns, both write the same
    // `setDynamicPorts`, and `portsEqual` makes the second a no-op only while
    // they agree. `wfa-009-dynamic-port-parity.test.ts` fails naming both files
    // if one is edited without the other.
    {
      name:'namedports/list',
      condition:"status = success OR status NOT SET",
      parameter:'params',
      port:{
        name:'pm-{{*}}',
        displayName:'{{*}}',
        type:'*',
        plug:'input',
        group:'Parameters'
      }
    }
  ],
  initialize:function() {
    this._internal.responseParameters = {}
  },
  inputs: {
    params: {
      group: 'Parameters',
      type:{name:'stringlist',allowEditOnly:true},
      description: 'Names to return in the response body, each becoming an input to supply it',
      set: function (value) {
        this._internal.params = value;
      }
    },
    errorMessage: {
      group: 'General',
      type: 'string',
      displayName:'Error Message',
      description: 'Message returned to the caller; used only when Status is Failure',
      set: function (value) {
        this._internal.errorMessage = value;
      }
    },
    send: {
      displayName: 'Send',
      type: 'signal',
      group: 'General',
      description: 'Sends the response and ends the request, which can only happen once',
      valueChangedToTrue: function () {
        // ERG-001 §4. Only the port mints, and there is nothing else here that could: this
        // node has no value-driven route into `sendResponse`.
        this.sendResponse(this.beginOutcome());
      }
    },
    status: {
      group: 'General',
      displayName:'Status',
      description: 'Whether the caller gets a 200 carrying Parameters or a 400 carrying Error Message',
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
    // ERG-001 §4. `Sent` became `Done`; the grep is clean, because `sendResponse` is reached
    // from the `Send` port and from nothing else. No `Unchanged` — a Response either answers
    // the request or fails to, and there is no branch where the post-condition already held.
    ...outcomeOutputs({
      done: 'Fires as the response goes out, and before the request scope is torn down',
      failure:
        'Fires when the response could not be sent, because there is no request in scope or one was already answered'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Why the response could not be sent',
      getter: function () {
        return this._internal.lastError;
      }
    }
  },
  methods:{
    setResponseParameter:function(name,value) {
      this._internal.responseParameters[name] = value
    },
    /**
     * Publish on `Error` and report the failure. One place, so the two codes cannot drift.
     *
     * ⚠️ ERG-001 §4: `token` is optional, and its absence is not an oversight. The one caller
     * that omits it is the belt-and-braces branch *after* the response has gone out, where the
     * invocation's token is already spent — see the note in `sendResponse`. There the reason
     * still has to reach the NDA-004 channel and the `Error` output; what it must not do is
     * report a second outcome, because "exactly one" is the load-bearing half of Rule 1.
     */
    _failResponse: function (code, message, detail, token) {
      this._internal.lastError = message;
      this.flagOutputDirty('error');
      if (token) {
        this.reportOutcome(token, 'failure', { code, message, detail });
      } else {
        this.raiseRuntimeError(code, message, detail);
      }
    },
    sendResponse: function (token) {
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
          { status: isSuccess ? 'success' : 'failure' },
          token
        );
      }

      const alreadySent =
        'The request has already been answered — a cloud function can only send one response';

      // A request can only be answered once, and two Response nodes on two branches of one
      // graph is exactly how an author reaches the second call. Asked *before* delivering, so
      // the failure is reported while this node still exists to report it.
      if (this._internal._requestIsOpen && !this._internal._requestIsOpen()) {
        return this._failResponse(
          'response/already-sent',
          alreadySent,
          { status: isSuccess ? 'success' : 'failure' },
          token
        );
      }

      const payload = isSuccess
        ? { statusCode: 200, body: JSON.stringify({ result: this._internal.responseParameters }) }
        : { statusCode: 400, body: JSON.stringify({ error: this._internal.errorMessage }) };

      // ERG-001 §4: `Done` (and, with it, `Completed`) fires BEFORE the callback, and that
      // ordering is forced rather than chosen — it is the contract's navigation exception in a
      // second family. The note below is the whole of the reason and predates the rename.
      //
      // `Sent` fired BEFORE the callback, and that ordering is forced rather than chosen.
      // Delivering the response tears the request down synchronously — `NoodlCloudRuntime.run`
      // calls `functionComponent._onNodeDeleted()` and `requestScope.reset()` inside the
      // callback, *before* resolving — so by the time it returns, this node and everything
      // wired to its outputs have been deleted. A completion signal sent afterwards would
      // reach a graph that no longer exists, which is a completion signal in name only.
      //
      // Firing first is safe because nothing can intervene: the check above has established
      // the request is open, and the call below is the next statement on the same tick.
      this.reportOutcome(token, 'done');

      // Belt and braces for a host that installs the callback without `_requestIsOpen` (the
      // return value is the older, coarser answer). Reached only if something downstream of
      // `Done` answered the request first, which is pathological but not impossible.
      //
      // ⚠️ No token: this invocation has already reported, and a second report would raise
      // `outcome/duplicate` instead of diagnosing anything. The reason still reaches the
      // NDA-004 channel and the `Error` output, which is where a host bug of this shape is
      // actually read.
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
          // WFA-009: empty entries dropped (matching `decodeStringList`, ERG-003's
          // one definition of the `stringlist` format) and repeats collapsed, so
          // this agrees port for port with the editor-side `namedports/list` rule.
          // `''.split(',')` is `['']`, which used to mint a `pm-` port with a
          // blank label the moment an author emptied the list; a name listed
          // twice used to mint the port twice, though the runtime registers the
          // input once either way.
          params = params.split(',').filter((p, i, all) => p && all.indexOf(p) === i);
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
