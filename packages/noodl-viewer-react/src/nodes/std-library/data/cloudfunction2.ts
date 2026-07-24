import NoodlRuntime from '@noodl/runtime';
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * The cloud services block of the project's metadata. See the note on the same interface
 * in `cloudfunction.ts` — promote to `@noodl/types` when a third consumer needs it.
 */
interface CloudServicesMetadata {
  appId: string;
  endpoint: string;
  /** Set only for a deployed backend; pinned onto every request as a header. */
  deployVersion?: string;
}

interface RequestOptions {
  appId: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  content?: unknown;
  /**
   * Receives the parsed JSON body, or `undefined` when the body would not parse.
   * Deliberately `any`: the error handler treats it as both a string and an object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  success(response?: any): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(response?: any): void;
}

function _makeRequest(path: string, options: RequestOptions): void {
  const xhr = new XMLHttpRequest();

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      let json;
      try {
        json = JSON.parse(xhr.response);
      } catch (e) {
        // Not JSON — leave `json` undefined and let the handlers below decide.
      }

      if (xhr.status === 200 || xhr.status === 201) {
        options.success(json);
      } else options.error(json);
    }
  };

  xhr.open(options.method || 'GET', options.endpoint + path, true);

  xhr.setRequestHeader('X-Parse-Application-Id', options.appId);
  xhr.setRequestHeader('Content-Type', 'application/json');

  const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices') as CloudServicesMetadata | undefined;
  if (cloudServices && cloudServices.deployVersion) {
    xhr.setRequestHeader('x-noodl-cloud-version', cloudServices.deployVersion);
  }

  // Check for current users
  const _cu = localStorage['Parse/' + options.appId + '/currentUser'];
  if (_cu !== undefined) {
    try {
      const currentUser = JSON.parse(_cu);
      xhr.setRequestHeader('X-Parse-Session-Token', currentUser.sessionToken);
    } catch (e) {
      // Failed to extract session token
    }
  }

  xhr.send(JSON.stringify(options.content));
}

/** What the inspector shows after a call. */
interface LastCallResult {
  status: 'success' | 'failure';
  parameters?: Record<string, unknown>;
  /** The result map, or the literal string `'empty'` when the function returned nothing. */
  results?: Record<string, unknown> | 'empty';
  error?: string;
}

/** `this` inside the Cloud Function node. */
interface CloudFunction2Instance extends NodeInstance {
  _internal: {
    /** Arrives on the dynamic `function` input, not a declared port. */
    functionName?: string;
    /** Values of the `in-…` inputs, keyed without the prefix. Sent as the request body. */
    paramsValues: Record<string, unknown>;
    /** Values behind the `out-…` outputs, keyed without the prefix. */
    resultsValues: Record<string, unknown>;
    error?: string;
    lastCallResult?: LastCallResult;
    hasScheduledCall?: boolean;
  };
  setError(err: string): void;
  getResultsValue(name: string): unknown;
  setParamsValue(name: string, value: unknown): void;
  setFunctionName(value: string): void;
  scheduleCall(): void;
  doCall(): void;
}

const CloudFunctionNode: NodeDefinitionOptions = {
  name: 'CloudFunction2',
  displayName: 'Cloud Function',
  category: 'Cloud Services',
  color: 'data',
  usePortAsLabel: 'function',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/cloud-function',
  initialize: function (this: CloudFunction2Instance) {
    this._internal.paramsValues = {};
    this._internal.resultsValues = {};
  },
  getInspectInfo(this: CloudFunction2Instance): InspectInfo {
    const result = this._internal.lastCallResult;
    if (!result) return '[Not executed yet]';

    return [{ type: 'value', value: result }];
  },
  inputs: {
    call: {
      type: 'signal',
      displayName: 'Call',
      group: 'Actions',
      valueChangedToTrue: function (this: CloudFunction2Instance) {
        this.scheduleCall();
      }
    }
  },
  outputs: {
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Signals'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Signals'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      getter: function (this: CloudFunction2Instance) {
        return this._internal.error;
      }
    }
  },
  methods: {
    setError: function (this: CloudFunction2Instance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
    },
    getResultsValue: function (this: CloudFunction2Instance, name: string) {
      return this._internal.resultsValues[name];
    },
    registerOutputIfNeeded: function (this: CloudFunction2Instance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('out-'))
        this.registerOutput(name, {
          getter: this.getResultsValue.bind(this, name.substring('out-'.length))
        });
    },
    setParamsValue: function (this: CloudFunction2Instance, name: string, value: unknown) {
      this._internal.paramsValues[name] = value;
    },
    setFunctionName: function (this: CloudFunction2Instance, value: string) {
      this._internal.functionName = value;
    },
    registerInputIfNeeded: function (this: CloudFunction2Instance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'function')
        this.registerInput(name, {
          set: this.setFunctionName.bind(this)
        });

      if (name.startsWith('in-'))
        this.registerInput(name, {
          set: this.setParamsValue.bind(this, name.substring('in-'.length))
        });
    },
    scheduleCall: function (this: CloudFunction2Instance) {
      const internal = this._internal;
      if (!internal.hasScheduledCall) {
        internal.hasScheduledCall = true;
        this.scheduleAfterInputsHaveUpdated(this.doCall.bind(this));
      }
    },
    // Both reads below the warning block assume `context.editorConnection` and
    // `cloudServices` are present, having just handled the case where they are not: the
    // node throws rather than reporting a failure when the project has no cloud services,
    // and throws on every call in a deployed app, where there is no editor connection at
    // all. See PLAT-003 NOTES §17 — deliberately not fixed here, since either repair
    // changes what a running app does.
    doCall: function (this: CloudFunction2Instance) {
      this._internal.hasScheduledCall = false;

      const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices') as CloudServicesMetadata | undefined;
      if (this.context.editorConnection) {
        if (cloudServices === undefined || cloudServices.endpoint === undefined) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'cloud-function-2', {
            message: 'No cloud services defined in this project.'
          });
        } else if (this._internal.functionName === undefined) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'cloud-function-2', {
            message: 'No function specified'
          });
        } else {
          this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'cloud-function-2');
        }
      }

      const appId = cloudServices.appId;
      const endpoint = this.context.editorConnection.isRunningLocally()
        ? `http://${window.location.hostname}:8577`
        : cloudServices.endpoint;

      _makeRequest('/functions/' + encodeURIComponent(this._internal.functionName), {
        appId,
        endpoint,
        content: this._internal.paramsValues,
        method: 'POST',
        success: (res) => {
          if (res === undefined) {
            // No result, still success

            this._internal.lastCallResult = {
              status: 'success',
              parameters: this._internal.paramsValues,
              results: 'empty'
            };
          } else {
            const results = res.result || {};
            for (const key in results) {
              this._internal.resultsValues[key] = results[key];
              if (this.hasOutput('out-' + key)) this.flagOutputDirty('out-' + key);
            }

            this._internal.lastCallResult = {
              status: 'success',
              parameters: this._internal.paramsValues,
              results: this._internal.resultsValues
            };
          }

          this.sendSignalOnOutput('success');
        },
        error: (e) => {
          const error = typeof e === 'string' ? e : e.error || 'Failed running cloud function.';
          this._internal.lastCallResult = {
            status: 'failure',
            error
          };

          this.setError(error);
        }
      });
    }
  }
};

const CloudFunction2Module: NodeModule = {
  node: CloudFunctionNode,
  setup: function () {
    // Handled in editor adapter
  }
};

export default CloudFunction2Module;
