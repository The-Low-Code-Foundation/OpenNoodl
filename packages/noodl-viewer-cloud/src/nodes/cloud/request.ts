//import CloudStore from '@noodl/runtime/src/api/cloudstore'
import Model from '@noodl/runtime/src/model';
import NoodlRuntime from '@noodl/runtime';

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
  dynamicports: [
    {
      name: 'namedports/list',
      parameter: 'params',
      port: {
        name: 'pm-{{*}}',
        displayName: '{{*}}',
        type: '*',
        plug: 'output',
        group: 'Parameters'
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
      description: 'Names to pull out of the request body, each becoming an output',
      set: function (value) {
        this._internal.params = value;
      }
    }
  },
  initialize: function () {
    this._internal.allowNoAuth = false;
    this._internal.requestParameters = {};
    this._internal.userProperties = {
      Authenticated: false
    };
  },
  methods: {
    getRequestParameter: function (name) {
      return this._internal.requestParameters[name];
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

      // Add params outputs
      var params = node.parameters.params;
      if (params !== undefined) {
        // WFA-009: see the note on `response.ts` — empty entries dropped and
        // repeats collapsed, so this agrees port for port with the editor-side
        // `namedports/list` rule.
        params = params.split(',').filter((p, i, all) => p && all.indexOf(p) === i);
        for (var i in params) {
          var p = params[i];

          ports.push({
            type: '*',
            plug: 'output',
            group: 'Parameters',
            name: 'pm-' + p,
            displayName: p
          });
        }
      }

      context.editorConnection.sendDynamicPorts(node.id, ports);
    }

    _updatePorts();
    node.on('parameterUpdated', function (event) {
      if (event.name === 'params') {
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
