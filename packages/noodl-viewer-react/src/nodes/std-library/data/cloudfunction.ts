import NoodlRuntime from '@noodl/runtime';
import CloudStore from '@noodl/runtime/src/api/cloudstore';
import { parseSessionStore } from '@noodl/runtime/src/api/backends/SessionStore';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/*var defaultBeforeCallScript = "// Add custom code to setup the parameters send to the function\n"+
"// The parameters are found in the object called 'Parameters'\n";

var defaultAfterCallScript = "// Add custom code modfiy the result from the cloud function\n"+
"// The result is found in the object called 'Result'\n";*/

/**
 * The cloud services block of the project's metadata.
 *
 * Shared in practice with `cloudfunction2.ts` and the `user/` nodes; kept local until a
 * third consumer needs it by name (PLAT-003 NOTES §16).
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
   * Deliberately `any`: the callers index it as an object without narrowing first.
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

  // Check for current users.
  //
  // BCN-006: through `SessionStore`, which is the same object the data wire and
  // the auth adapter read. Three copies of this block spelled
  // `Parse/<appId>/currentUser` out by hand, and each was a separate opinion
  // about who is signed in — the trap BCN-006 names for `cloudstore.js` was
  // real, it was just in three other files by the time the task started.
  const currentUser = parseSessionStore(options.appId).read();
  if (currentUser !== undefined) {
    xhr.setRequestHeader('X-Parse-Session-Token', currentUser.sessionToken);
  }

  xhr.send(JSON.stringify(options.content));
}

/** What the inspector shows after a call. */
interface LastCallResult {
  status: 'success' | 'failure';
  result?: unknown;
  /** The failure body, or the message explaining why no call was made. */
  res?: unknown;
}

/** `this` inside the deprecated Cloud Function node. */
interface CloudFunctionInstance extends NodeInstance {
  _internal: {
    functionName?: string;
    /** The author's `params` stringlist, as typed. Drives the `pm-…` inputs. */
    params?: string;
    /** Values of the `pm-…` inputs, keyed without the prefix. */
    paramsValues: Record<string, unknown>;
    result?: unknown;
    lastCallResult?: LastCallResult;
    hasScheduledCall?: boolean;
  };
  setParamsValue(name: string, value: unknown): void;
  scheduleCall(): void;
  doCall(): void;
}

const CloudFunctionNode: NodeDefinitionOptions = {
  name: 'Cloud Function',
  category: 'Cloud Services',
  color: 'data',
  usePortAsLabel: 'functionName',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/cloud-function',
  deprecated: true,
  initialize: function (this: CloudFunctionInstance) {
    this._internal.paramsValues = {};
    // this._internal.resultsValues = {};
    // this._internal.convertArraysAndObjects = true;
  },
  getInspectInfo(this: CloudFunctionInstance): InspectInfo {
    const result = this._internal.lastCallResult;
    if (!result) return '[Not executed yet]';

    return [{ type: 'value', value: result }];
  },
  inputs: {
    functionName: {
      description: 'Name of the cloud function to run',
      type: 'string',
      displayName: 'Function Name',
      group: 'General',
      set: function (this: CloudFunctionInstance, value: string) {
        this._internal.functionName = value;
      }
    },
    params: {
      description: 'Names of the parameters to send, each of which becomes an input port',
      group: 'Parameters',
      type: { name: 'stringlist', allowEditOnly: true },
      set: function (this: CloudFunctionInstance, value: string) {
        this._internal.params = value;
      }
    },
    /* results:{
        group:'Result',
        type:{name:'stringlist',allowEditOnly:true},
        set:function(value) {
            this._internal.results = value;
        }
    },
    beforeCallScript: {
        group:'Scripts',
        displayName:'Before Call',
        default:defaultBeforeCallScript,
        type:{name:'string',codeeditor:'javascript'},
        set: function(scriptCode) {
            try {
                if(scriptCode !== undefined) {
                    var args = ['Parameters'].concat([scriptCode]);
                    this._internal.scriptBeforeCallFunc = Function.apply(null,args);
                }
            }
            catch(e) {
                this._internal.scriptBeforeCallFunc = undefined;
                console.log('Error while parsing script (before call): ' +  e);
            }
        }
    },
    afterCallScript: {
        group:'Scripts',
        displayName:'After Call',
        default:defaultAfterCallScript,
        type:{name:'string',codeeditor:'javascript'},
        set: function(scriptCode) {
            try {
                if(scriptCode !== undefined) {
                    var args = ['Result'].concat([scriptCode]);
                    this._internal.scriptAfterCallFunc = Function.apply(null,args);
                }
            }
            catch(e) {
                this._internal.scriptAfterCallFunc = undefined;
                console.log('Error while parsing script (after call): ' +  e);
            }
        }
    },*/
    call: {
      description: 'Runs the named cloud function with the current parameter values',
      type: 'signal',
      displayName: 'Call',
      group: 'Actions',
      valueChangedToTrue: function (this: CloudFunctionInstance) {
        this.scheduleCall();
      }
    }
    /* convertArraysAndObjects:{
        group:'Advanced',
        displayName:'Convert Objects',
        type:'boolean',
        default:true,
        set: function(value) {
            this._internal.convertArraysAndObjects = value;
        }
    }*/
  },
  outputs: {
    success: {
      description: 'Fires once the function has returned and Result is up to date',
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      description:
        'Fires when the call failed, and also when it succeeded without returning a result; this node carries no reason for either',
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    result: {
      description: 'Whatever the function returned, with records and arrays deserialised where they can be',
      type: '*',
      displayName: 'Result',
      group: 'Output',
      getter: function (this: CloudFunctionInstance) {
        return this._internal.result;
      }
    }
  },
  methods: {
    /* getResultsValue:function(name) {
        return this._internal.resultsValues[name];
    },*/
    registerOutputIfNeeded: function (this: CloudFunctionInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      /*  if(name.startsWith('res-')) this.registerOutput(name, {
          getter: this.getResultsValue.bind(this, name.substring('res-'.length))
      });*/
    },
    setParamsValue: function (this: CloudFunctionInstance, name: string, value: unknown) {
      this._internal.paramsValues[name] = value;
    },
    registerInputIfNeeded: function (this: CloudFunctionInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('pm-'))
        this.registerInput(name, {
          set: this.setParamsValue.bind(this, name.substring('pm-'.length))
        });
    },
    scheduleCall: function (this: CloudFunctionInstance) {
      const internal = this._internal;
      if (!internal.hasScheduledCall) {
        internal.hasScheduledCall = true;
        this.scheduleAfterInputsHaveUpdated(this.doCall.bind(this));
      }
    },
    doCall: function (this: CloudFunctionInstance) {
      this._internal.hasScheduledCall = false;

      const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices') as CloudServicesMetadata | undefined;
      if (cloudServices === undefined) {
        console.log('No cloud services defined in this project.');
        this._internal.lastCallResult = {
          status: 'failure',
          res: 'No active cloud services in this project'
        };

        this.sendSignalOnOutput('failure');
        return;
      }

      const appId = cloudServices.appId;
      const endpoint = cloudServices.endpoint;
      // Run before call script
      /*  if(this._internal.scriptBeforeCallFunc !== undefined) {
            this._internal.scriptBeforeCallFunc(this._internal.paramsValues);
        }*/

      _makeRequest('/functions/' + encodeURIComponent(this._internal.functionName), {
        appId,
        endpoint,
        content: this._internal.paramsValues,
        method: 'POST',
        success: (response) => {
          const res = response.result; // Cloud functions always return "result"
          if (res === undefined) {
            this.sendSignalOnOutput('failure');
            return;
          }

          // Run after call script
          /* if(this._internal.scriptAfterCallFunc !== undefined) {
                    this._internal.scriptAfterCallFunc(res);
                }*/

          this._internal.result = CloudStore._deserializeJSON(res);
          this.flagOutputDirty('result');

          this._internal.lastCallResult = {
            status: 'success',
            result: this._internal.result
          };

          // Deserialize values into Noodl arrays and objects
          /*  if(this._internal.convertArraysAndObjects) {
                    for(var key in res) {
                        if(res[key] !== undefined)
                            res[key] = CloudStore._fromJSON(res[key]);
                    }
                }*/

          /*this._internal.resultsValues = res;

                for(var key in res) {
                    if(this.hasOutput('res-'+key)) {
                        this.flagOutputDirty('res-'+key);
                    }
                }*/

          this.sendSignalOnOutput('success');
        },
        error: (res) => {
          this._internal.lastCallResult = {
            status: 'failure',
            res
          };

          this.sendSignalOnOutput('failure');
        }
      });
    }
  }
};

const CloudFunctionModule: NodeModule = {
  node: CloudFunctionNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    const editorConnection: EditorConnectionLike = context.editorConnection;

    function _managePortsForNode(node: GraphNodeModel) {
      function _updatePorts() {
        const ports = [];

        // Add results outputs
        /*    var results = node.parameters.results;
                if (results !== undefined) {
                    results = results.split(',');
                    for (var i in results) {
                        var p = results[i];

                        ports.push({
                            type: {
                                name: '*',
                            },
                            plug: 'output',
                            group: 'Results',
                            name: 'res-' + p,
                            displayName: p
                        });

                    }
                }*/

        // Add params inputs
        const params = node.parameters.params as string | undefined;
        if (params !== undefined) {
          for (const p of params.split(',')) {
            ports.push({
              type: '*',
              plug: 'input',
              group: 'Parameters',
              name: 'pm-' + p,
              displayName: p
            });
          }
        }

        editorConnection.sendDynamicPorts(node.id, ports);
      }

      _updatePorts();
      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name === 'params') {
          _updatePorts();
        }
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.Cloud Function', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('Cloud Function')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default CloudFunctionModule;
