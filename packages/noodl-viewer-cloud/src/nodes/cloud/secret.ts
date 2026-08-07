/**
 * Secret node (CWF-009) — the door to a stored credential from inside a cloud
 * function.
 *
 * ## Why this node exists when `process.env` already works
 *
 * TALK-007 §3.1 measured a Function node inside a cloud function reaching
 * `process.env` in full — 79 keys. So reading a credential was never the gap.
 * The gap was that the only way to do it was to type `process.env.STRIPE_KEY`
 * into a script and hope the deploy set it: a habit, not a door. This node is
 * the door, and the namespace policy behind it (nodegx-backend
 * `config/SecretsStore.ts`) is the actual work.
 *
 * ## ⚠️ Cloud only, deliberately — the first node registered here for this reason
 *
 * Registered in `noodl-viewer-cloud/src/nodes/index.ts` beside Request and
 * Response, NOT in `@noodl/runtime`'s shared list. That list reaches every
 * runtime (`noodl-runtime.ts` registerNodes), so a node put there by mistake
 * silently becomes browser vocabulary — which is exactly how AIX-005 leaked
 * fourteen nodes into the cloud. Here the mistake would run the other way and
 * be far worse: **a Secret node in a browser bundle is a secret in a browser
 * bundle.** The generated catalog records this as `availableIn: ["cloud"]`; if
 * it ever says `browser`, the registration moved.
 *
 * ## What stops the value escaping
 *
 *  - **The graph carries a name, never a value.** The only input that matters is
 *    `name`; there is no port and no parameter that could hold the credential,
 *    so nothing lands in the exported `.workflow.json` a deploy ships.
 *  - **No `getInspectInfo`.** That method is the node-level debug inspector's
 *    only source (`nodecontext.ts:_getDebugInspectorValueForNode`), and it is
 *    left unimplemented here on purpose — this comment is the reason, so nobody
 *    adds one "for symmetry" later. (The backend's runner also passes
 *    `connectToEditor: false` unconditionally, so no inspector channel is open
 *    at all; the missing method is the second layer, not the first.)
 *  - **Nothing here logs.** Not the value, not on failure. The resolver's error
 *    messages are built from the NAME alone (`service.ts` resolveFunctionSecret),
 *    and the execution-history record stores only the scrubbed request — a cloud
 *    function's internal node outputs are never written anywhere.
 *  - The one thing this node cannot prevent is an author wiring `Value` into a
 *    Response. That is the author writing a credential into their own API's
 *    reply, and no node can second-guess it.
 */

import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';

/** What `_noodl_get_secret` answers with — see nodegx-backend `service.ts`. */
interface SecretLookupResult {
  found: boolean;
  value?: string;
  error?: string;
}

export const node = {
  name: 'noodl.cloud.secret',
  displayNodeName: 'Secret',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/secret',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'Value', 'Events', 'Error']
  },
  inputs: {
    name: {
      group: 'General',
      displayName: 'Name',
      type: 'string',
      description:
        'Which stored secret to read. A cloud function can only ever read the project\'s own secrets — the ' +
        'backend\'s webhook, email, auth and admin credentials are not addressable from here',
      set: function (value) {
        this._internal.name = value;
      }
    },
    fetch: {
      group: 'Actions',
      displayName: 'Do',
      type: 'signal',
      description: 'Reads the secret and puts it on Value',
      valueChangedToTrue: function () {
        // ERG-001 §4: only the port mints an outcome token, and `read` has no
        // other caller — no value setter on this node triggers a read.
        this.scheduleRead(this.beginOutcome());
      }
    }
  },
  outputs: {
    value: {
      group: 'Value',
      displayName: 'Value',
      type: 'string',
      description: 'The secret, available once Done has fired. Blank until then, and blank after a Failure',
      getter: function () {
        return this._internal.value;
      }
    },
    ...outcomeOutputs({
      done: 'Fires once the secret has been read and is available on Value',
      failure:
        'Fires when the secret is not provisioned on this machine, or the Name is unusable. A missing ' +
        'credential is loud here rather than an empty string that becomes a 401 from somebody else an hour later'
    }),
    error: {
      displayName: 'Error',
      type: 'string',
      group: 'Error',
      description: 'Why the secret could not be read — names the secret and where to put it, never a value',
      getter: function () {
        return this._internal.error;
      }
    }
  },
  methods: {
    /** Publish on `Error` and settle every invocation in this batch as a failure. */
    setError: function (message, tokens) {
      this._internal.error = message;
      this._internal.value = undefined;
      this.flagOutputDirty('error');
      this.flagOutputDirty('value');
      reportOutcomes(this, tokens || [], 'failure', { code: 'secret/unavailable', message });
    },
    /**
     * ⚠️ The pending array is created lazily rather than in `initialize`, for
     * the reason Send Email records: several suites build a node as a bag of
     * bound methods and never call `initialize`, and an eager field is
     * `undefined` exactly where the first invocation reads it.
     */
    scheduleRead: function (token) {
      if (token) {
        if (!this._internal.pendingReadOutcomes) this._internal.pendingReadOutcomes = [];
        this._internal.pendingReadOutcomes.push(token);
      }

      if (this._internal.readScheduled) return;
      this._internal.readScheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.readScheduled = false;
        this.doRead();
      });
    },
    doRead: function () {
      const tokens = this._internal.pendingReadOutcomes || [];
      this._internal.pendingReadOutcomes = undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getSecret = (globalThis as any)._noodl_get_secret;
      if (typeof getSecret !== 'function') {
        // Same two-case split as Send Email: absent means "this graph is not
        // running inside nodegx-backend at all", which is a different problem
        // from "running here but the secret is not provisioned".
        this.setError(
          'Secret: no secret store is available. This node only works inside a nodegx-backend cloud ' +
            'function (CWF-009) — it is not usable in the browser viewer.',
          tokens
        );
        return;
      }

      let result: SecretLookupResult;
      try {
        result = getSecret(this._internal.name);
      } catch {
        // Deliberately does NOT forward the thrown value: a store that throws
        // while holding a credential must not get to choose the log line.
        this.setError('Secret: the secret store could not be read.', tokens);
        return;
      }

      if (!result || !result.found) {
        this.setError((result && result.error) || 'Secret: the secret could not be read.', tokens);
        return;
      }

      this._internal.error = undefined;
      this._internal.value = result.value;
      this.flagOutputDirty('error');
      this.flagOutputDirty('value');
      reportOutcomes(this, tokens, 'done');
    }
  }
};

export function setup() {
  // No editor-only dynamic-port behaviour (unlike Request/Response) — every
  // port here is static, and deliberately so: a dynamic port on this node would
  // be a port whose NAME is derived from a credential's surroundings.
}
