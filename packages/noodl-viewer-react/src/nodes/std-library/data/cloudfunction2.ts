import NoodlRuntime from '@noodl/runtime';
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';
import { parseSessionStore } from '@noodl/runtime/src/api/backends/SessionStore';
import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';

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
    /**
     * ERG-001. Invocations of `Call` that have not reported yet — an array because
     * `hasScheduledCall` coalesces two pulses in an update pass into one call, and two
     * invocations must still produce two outcomes.
     */
    pendingCall?: OutcomeToken[];
  };
  setError(err: string, tokens?: OutcomeToken[]): void;
  getResultsValue(name: string): unknown;
  setParamsValue(name: string, value: unknown): void;
  setFunctionName(value: string): void;
  scheduleCall(): void;
  doCall(): void;
}

/** NDA-004 §2 — see `setError`. Also the editor's warning key; the bus keys by `code`. */
const CALL_ERROR_CODE = 'cloud-function/call-failed';

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
      description: 'Runs the selected cloud function with the current input values',
      type: 'signal',
      displayName: 'Call',
      group: 'Actions',
      valueChangedToTrue: function (this: CloudFunction2Instance) {
        this.scheduleCall();
      }
    }
  },
  outputs: {
    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001 §4. `Success` renamed to `Done`, plus the universal `Completed`. The group stays
    // `Signals` rather than moving to `Events`, because that is where this node's author has
    // always found them and a port that moves group is a port an author has to hunt for.
    //
    // ⚠️ **No `Unchanged`.** The node cannot know whether the function it invoked changed
    // anything — only the function does, and it says so through its own result outputs.
    ...outcomeOutputs({
      group: 'Signals',
      done: 'Fires once the function has returned and its result outputs are up to date',
      failure:
        'Fires when the function could not be reached or answered with an error, after the reason has been reported on the error channel'
    }),
    error: {
      description: 'Why the last call failed; empty until one does',
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      getter: function (this: CloudFunction2Instance) {
        return this._internal.error;
      }
    }
  },
  methods: {
    /**
     * NDA-004 §2 / FINDINGS B-iv. Not the finding's shape: this posted nowhere at all, so a
     * cloud function that failed had no diagnosis in any runtime, the editor included.
     *
     * `doCall`'s `'cloud-function-2'` warnings are a *different* report — they fire at call
     * time for a missing endpoint or a missing function name, and they are editor-only. They
     * stay where they are; both of those conditions also reach here as an `err`, which is now
     * on the bus.
     *
     * ERG-001: the `failure` pulse and the raise both go through `reportOutcome`, so the outcome
     * and its reason cannot drift apart and `Completed` follows automatically. `tokens` is
     * optional so a direct call — which is what `cloudfunction2.test.ts`'s deploy-shaped rows
     * make — is still a real, complete failure rather than a reason with no outcome behind it.
     */
    setError: function (this: CloudFunction2Instance, err: string, tokens?: OutcomeToken[]) {
      this._internal.error = err;
      this.flagOutputDirty('error');

      reportOutcomes(this, tokens || [this.beginOutcome()], 'failure', {
        code: CALL_ERROR_CODE,
        message: err
      });
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
      // ERG-001. Minted before the coalescing guard, so the second `Call` of a pair still gets an
      // outcome even though it does not get a second request. `scheduleCall` is the only method
      // the `Call` port reaches.
      const pending = internal.pendingCall || (internal.pendingCall = []);
      pending.push(this.beginOutcome());

      if (!internal.hasScheduledCall) {
        internal.hasScheduledCall = true;
        this.scheduleAfterInputsHaveUpdated(this.doCall.bind(this));
      }
    },
    doCall: function (this: CloudFunction2Instance) {
      this._internal.hasScheduledCall = false;

      // Taken into a local before the request goes out, so a second `Call` arriving in flight
      // owns its own batch rather than being settled by this one's answer.
      const tokens = this._internal.pendingCall || [];
      this._internal.pendingCall = [];

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

      if (cloudServices === undefined || cloudServices.endpoint === undefined) {
        const error = 'No cloud services defined in this project.';
        this._internal.lastCallResult = {
          status: 'failure',
          error
        };
        this.setError(error, tokens);
        return;
      }

      // WF-007: this used to redirect to a fixed dev-only port (8577) running a
      // hidden-BrowserWindow cloud-function sandbox whenever the preview ran
      // inside the editor. That sandbox is gone — cloud functions now always
      // execute through whatever backend `cloudservices.endpoint` points at
      // (a local nodegx-backend, auto-set by the Backend Services panel when
      // one is running, or a manually configured deployed/external endpoint).
      const appId = cloudServices.appId;
      const endpoint = cloudServices.endpoint;

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

          // Last, after every `out-…` output it describes.
          reportOutcomes(this, tokens, 'done');
        },
        error: (e) => {
          const error = typeof e === 'string' ? e : e.error || 'Failed running cloud function.';
          this._internal.lastCallResult = {
            status: 'failure',
            error
          };

          this.setError(error, tokens);
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
