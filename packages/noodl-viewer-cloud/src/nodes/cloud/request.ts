//import CloudStore from '@noodl/runtime/src/api/cloudstore'
import Model from '@noodl/runtime/src/model';
import NoodlRuntime from '@noodl/runtime';

import {
  CloudFunctionBadRequestError,
  DEFAULT_PREFIX,
  REQUIRED_PREFIX,
  REQUEST_PARAM_TYPES,
  TYPE_PREFIX,
  applyRequestContract,
  contractIsEmpty,
  isContractParameter,
  paramNames,
  requestParamSpecs
} from './requestContract';

/**
 * CWF-014 — the type picker offered per declared parameter.
 *
 * `Any` is first and is what an undeclared parameter is, so the enum's own
 * default state and the absence of the parameter mean the same thing. ⚠️ There
 * is deliberately **no `default:`** on the generated port: a declared `default`
 * never runs its setter (the repo's most-repeated trap), so the fallback lives
 * in `requestParamSpecs` where it can actually fire.
 */
const PARAM_TYPE_ENUM = {
  name: 'enum',
  allowEditOnly: true,
  enums: REQUEST_PARAM_TYPES.map((t) => ({
    value: t,
    label: t === '*' ? 'Any' : t.charAt(0).toUpperCase() + t.slice(1)
  }))
};

/** The group the contract rows live in, kept off `Parameters` so the outputs stay readable. */
const CONTRACT_GROUP = 'Parameter Types';

export const node = {
  name: 'noodl.cloud.request',
  displayNodeName: 'Request',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/request',
  useVariants: false,
  mountedInput: false,
  allowAsExportRoot: false,
  singleton: true,
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Mounted']
  },
  // WFA-009 — the Request node has the same fault F27 records against Response,
  // and F27's own criterion (a wired value comes back from the deployed
  // function) is unreachable without it: in the shipped template the value a
  // function returns comes from its request, so an author needs a port to wire
  // FROM as well as one to wire INTO. Same rule, `plug: 'output'`, no condition.
  // Must stay identical to `setup()` below — see the note on `response.ts`.
  //
  // CWF-014 — three more rules over the same `params`, so a declared name can
  // also declare what it *is*. `typeFromParameter` on the first rule is what
  // carries that declaration onto the value port itself: the output a
  // `number`-typed parameter offers is a `number` output, so the wire out of it
  // is checked like any other. A parameter with no `ptype-` is `'*'`, exactly as
  // before, which is why every existing function's ports are unchanged.
  dynamicports: [
    {
      name: 'namedports/list',
      parameter: 'params',
      port: {
        name: 'pm-{{*}}',
        displayName: '{{*}}',
        type: '*',
        typeFromParameter: TYPE_PREFIX + '{{*}}',
        plug: 'output',
        group: 'Parameters'
      }
    },
    {
      name: 'namedports/list',
      parameter: 'params',
      port: {
        name: TYPE_PREFIX + '{{*}}',
        displayName: '{{*}} — Type',
        type: PARAM_TYPE_ENUM,
        plug: 'input',
        group: CONTRACT_GROUP
      }
    },
    {
      name: 'namedports/list',
      parameter: 'params',
      port: {
        name: REQUIRED_PREFIX + '{{*}}',
        displayName: '{{*}} — Required',
        type: { name: 'boolean', allowEditOnly: true },
        plug: 'input',
        group: CONTRACT_GROUP
      }
    },
    {
      name: 'namedports/list',
      parameter: 'params',
      port: {
        name: DEFAULT_PREFIX + '{{*}}',
        displayName: '{{*}} — Default',
        type: { name: 'string', allowEditOnly: true },
        plug: 'input',
        group: CONTRACT_GROUP
      }
    }
  ],
  outputs: {
    receive: {
      displayName: 'Received',
      type: 'signal',
      group: 'General',
      description: 'Fires when a request arrives, after every parameter output has been updated'
    },
    auth: {
      displayName: 'Authenticated',
      type: 'boolean',
      group: 'Request',
      description: 'Whether the request carried a session token that resolved to a user',
      getter: function () {
        return !!this._internal.authenticated;
      }
    },
    userId: {
      displayName: 'User Id',
      type: 'boolean',
      group: 'Request',
      description: 'Id of the user the session token resolved to, and blank for an unauthenticated request',
      getter: function () {
        return this._internal.authUserId;
      }
    }
  },
  inputs: {
    allowNoAuth: {
      group: 'General',
      type: 'boolean',
      displayName: 'Allow Unauthenticated',
      default: false,
      description: 'Whether a request with no valid session token is allowed to run this function at all',
      set: function (value) {
        this._internal.allowNoAuth = value;
      }
    },
    params: {
      group: 'Parameters',
      type: { name: 'stringlist', allowEditOnly: true },
      description:
        'Names to pull out of the request body, each becoming an output — and a Type, Required and Default row to declare what it is',
      set: function (value) {
        this._internal.params = value;
      }
    }
  },
  initialize: function () {
    this._internal.allowNoAuth = false;
    this._internal.requestParameters = {};
    // CWF-014 — `ptype-`/`preq-`/`pdef-` land here, keyed by their full parameter
    // name, so `requestParamSpecs` reads one bag and the load order of a saved
    // project cannot matter (see `registerInputIfNeeded`).
    this._internal.contract = {};
    this._internal.userProperties = {
      Authenticated: false
    };
  },
  methods: {
    getRequestParameter: function (name) {
      return this._internal.requestParameters[name];
    },
    /**
     * CWF-014 — the contract this function's parameters declare.
     *
     * `params` is read from `_internal` rather than from the node model because
     * the declared input is the one path that survives variants, queued inputs
     * and a live edit; the contract rows join it there through
     * `registerInputIfNeeded`.
     */
    getRequestContract: function () {
      return requestParamSpecs({ ...this._internal.contract, params: this._internal.params });
    },
    setRequestParameter: function (name, value) {
      this._internal.requestParameters[name] = value;
      if (this.hasOutput('pm-' + name)) this.flagOutputDirty('pm-' + name);
    },
    fetchCurrentUser: async function (sessionToken) {
      return new Promise((resolve, reject) => {
        const userService = NoodlRuntime.Services.UserService.forScope(this.nodeScope.modelScope);
        userService.fetchCurrentUser({
          sessionToken,
          success: resolve,
          error: reject
        });
      });
    },
    sendRequest: async function (req) {
      const sessionToken = req.headers['x-parse-session-token'];
      let params = {};
      try {
        params = JSON.parse(req.body);
      } catch (e) {}

      if (sessionToken) {
        // There is a user token, fetch user
        try {
          await this.fetchCurrentUser(sessionToken);

          const userService = NoodlRuntime.Services.UserService.forScope(this.nodeScope.modelScope);
          const userModel = userService.current;

          this._internal.authenticated = true;
          this._internal.authUserId = userModel.getId();
          this.flagOutputDirty('userId');
        } catch (e) {
          // User could not be fetched
          if (!this._internal.allowNoAuth) throw Error('Unauthenticated requests not accepted.');
        }
      } else if (!this._internal.allowNoAuth) throw Error('Unauthenticated requests not accepted.');

      // CWF-014 — the request contract, enforced BEFORE the graph runs.
      //
      // Placed here for two reasons. It is next to the `allowNoAuth` check
      // above, which is the precedent: that check throws before anything
      // downstream sees the request, and the whole point of a 400 is that the
      // graph did not run — a function that half-executed and then complained
      // has already written the record. And it is *after* it, deliberately:
      // whether a caller is allowed to invoke this function at all is a coarser
      // question than whether their body is well-formed, and an unauthenticated
      // caller should not be able to map a function's interface by watching
      // which fields it complains about.
      //
      // ⚠️ A function whose parameters declare nothing — every function written
      // before this task, and every shipped prefab — has an empty contract and
      // takes neither branch. `params` is untouched in that case, right down to
      // object identity.
      const contract = this.getRequestContract();
      if (!contractIsEmpty(contract)) {
        const checked = applyRequestContract(contract, params);
        if (checked.errors.length > 0) throw new CloudFunctionBadRequestError(checked.errors);
        params = checked.values;
      }

      // FH-018: an `await ConfigService.instance.getConfig()` used to sit here, priming
      // the cache so the Config node's synchronous getter had something to read. That node
      // is gone, and with it the only reader — so this was an HTTP round-trip on every
      // single request whose sole remaining effect was to fail the whole function if
      // `/config` was slow or unhappy.

      // Create request object
      const requestModel = (this.nodeScope.modelScope || Model).get('Request');
      requestModel.set('Authenticated', !!this._internal.authenticated);
      requestModel.set('UserId', this._internal.authUserId);
      requestModel.set('Parameters', params);
      requestModel.set('Headers', req.headers);

      this.flagOutputDirty('auth');

      for (let key in params) {
        this.setRequestParameter(key, params[key]);
      }
      this.sendSignalOnOutput('receive');
    },
    registerOutputIfNeeded: function (name) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('pm-'))
        this.registerOutput(name, {
          getter: this.getRequestParameter.bind(this, name.substring('pm-'.length))
        });
    },
    /**
     * CWF-014 — mint a contract row's input the moment its parameter arrives.
     *
     * ⚠️ This is what makes the declaration immune to the repo's recurring
     * load-order trap: **a saved project applies a parameter before the port
     * exists**. `NodeScope.setNodeParameters` walks `Object.keys(parameters)` in
     * an order nobody controls and drops any parameter whose input does not
     * exist by then — so had this hook not been here, `ptype-total` would have
     * been silently discarded whenever it happened to be read before `params`,
     * and the function would have served an untyped body in production while
     * every jest test passed.
     */
    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) {
        return;
      }

      // No `default:` anywhere here — a declared default never runs its setter,
      // and the fallbacks live in `requestParamSpecs`.
      if (isContractParameter(name))
        this.registerInput(name, {
          set: function (value) {
            this._internal.contract[name] = value;
          }
        });
    }
  }
};

export function setup(context, graphModel) {
  if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
    return;
  }

  function _managePortsForNode(node) {
    function _updatePorts() {
      var ports = [];

      // WFA-009: empty entries dropped and repeats collapsed, so this agrees
      // port for port with the editor-side `namedports/list` rule.
      // CWF-014: `paramNames` is that same filter, named — the third copy of it
      // (here, `dynamicPortRules.namesFromListParameter`, and `response.ts`) is
      // what the parity suite exists to keep honest.
      var params = paramNames(node.parameters.params);

      // ⚠️ Rule-major, not name-major: the editor's `generatedPortsForNode`
      // walks rules outermost, so every `pm-` comes before every `ptype-`. The
      // two orders must match or `getPorts()` assigns different indices on the
      // two sides — which is the WFA-009 trap, "a port that appears in the
      // editor and not in the export is worse than no port", in its subtler form.
      for (var i in params) {
        var p = params[i];
        // Verbatim, and `'*'` for anything falsy — the same two lines the
        // editor-side `typeFromParameter` lookup is, because the two must agree
        // port for port and the generic rule has no business knowing this
        // node's vocabulary. A `ptype-` value outside `REQUEST_PARAM_TYPES` can
        // only come from a hand-edited project; `requestParamSpecs` reads it as
        // `'*'` so the function still serves.
        var declared = node.parameters[TYPE_PREFIX + p];
        ports.push({
          type: declared && declared !== '*' ? declared : '*',
          plug: 'output',
          group: 'Parameters',
          name: 'pm-' + p,
          displayName: p
        });
      }

      for (var j in params) {
        ports.push({
          type: PARAM_TYPE_ENUM,
          plug: 'input',
          group: CONTRACT_GROUP,
          name: TYPE_PREFIX + params[j],
          displayName: params[j] + ' — Type'
        });
      }

      for (var k in params) {
        ports.push({
          type: { name: 'boolean', allowEditOnly: true },
          plug: 'input',
          group: CONTRACT_GROUP,
          name: REQUIRED_PREFIX + params[k],
          displayName: params[k] + ' — Required'
        });
      }

      for (var l in params) {
        ports.push({
          type: { name: 'string', allowEditOnly: true },
          plug: 'input',
          group: CONTRACT_GROUP,
          name: DEFAULT_PREFIX + params[l],
          displayName: params[l] + ' — Default'
        });
      }

      context.editorConnection.sendDynamicPorts(node.id, ports);
    }

    _updatePorts();
    node.on('parameterUpdated', function (event) {
      // A `ptype-` change retypes a `pm-` port, so the contract rows re-push too.
      if (event.name === 'params' || isContractParameter(event.name)) {
        _updatePorts();
      }
    });
  }

  graphModel.on('editorImportComplete', () => {
    graphModel.on('nodeAdded.noodl.cloud.request', function (node) {
      _managePortsForNode(node);
    });

    for (const node of graphModel.getNodesWithType('noodl.cloud.request')) {
      _managePortsForNode(node);
    }
  });
}
