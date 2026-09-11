/**
 * HMAC (CWF-010 slice 2) — a keyed digest of a string.
 *
 * ⚠️ **Cloud only, and the reason is the key.** CWF-010's trap list names JWT Sign as the
 * cloud-only one and leaves HMAC unstated; the same argument decides it. Every real use of an
 * HMAC — verifying a Stripe or GitHub webhook signature, signing an outbound API request,
 * minting a download token — holds a shared secret. Registering this in the shared runtime would
 * put a node in the browser whose Key input can only be filled from a literal or a fetch, and
 * either way the secret is in the page. The one browser-legitimate case (verifying with a
 * *public* key) is RS256, which is asymmetric and is not what this node does.
 *
 * It is the same `hmacBytes` the JWT nodes sign and verify with — one implementation, so a token
 * this backend signs and a signature this node checks cannot drift apart.
 */

import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';
import { encodeBytes, hmacBytes } from '@noodl/runtime/src/nodes/std-library/crypto/encoding';

export const node = {
  name: 'noodl.cloud.hmac',
  displayNodeName: 'HMAC',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/hmac',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'Values', 'Events', 'Error']
  },
  /** ⚠️ A declared `default` never runs its setter — these two lines are the real defaults. */
  initialize: function () {
    this._internal.algorithm = 'SHA-256';
    this._internal.encoding = 'hex';
  },
  inputs: {
    value: {
      type: 'string',
      displayName: 'Value',
      group: 'General',
      description: 'The message to sign, as UTF-8 bytes. For a webhook signature this is the raw request body',
      set: function (value) {
        this._internal.value = value;
      }
    },
    key: {
      type: 'string',
      displayName: 'Key',
      group: 'General',
      description: 'The shared secret. Wire this from a Secret node — never type a credential into the graph',
      set: function (value) {
        this._internal.key = value;
      }
    },
    algorithm: {
      type: {
        name: 'enum',
        enums: [
          { label: 'SHA-256', value: 'SHA-256' },
          { label: 'SHA-384', value: 'SHA-384' },
          { label: 'SHA-512', value: 'SHA-512' }
        ]
      },
      displayName: 'Algorithm',
      group: 'General',
      default: 'SHA-256',
      description: 'Which SHA-2 digest the HMAC is built on. HMAC-SHA256 is what almost every webhook uses',
      set: function (value) {
        this._internal.algorithm = value;
      }
    },
    encoding: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Hex', value: 'hex' },
          { label: 'Base64', value: 'base64' },
          { label: 'Base64 URL', value: 'base64url' }
        ]
      },
      displayName: 'Encoding',
      group: 'General',
      default: 'hex',
      description: 'How the signature bytes are rendered as text. Match whatever the other side sends',
      set: function (value) {
        this._internal.encoding = value;
      }
    },
    sign: {
      type: 'signal',
      displayName: 'Do',
      group: 'Actions',
      description: 'Computes the signature of Value under Key',
      valueChangedToTrue: function () {
        const token = this.beginOutcome();
        if (!this._internal.pendingOutcomes) this._internal.pendingOutcomes = [];
        this._internal.pendingOutcomes.push(token);
        if (this._internal.scheduled) return;
        this._internal.scheduled = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          this._internal.scheduled = false;
          this.runSign();
        });
      }
    }
  },
  outputs: {
    signature: {
      type: 'string',
      displayName: 'Signature',
      group: 'Values',
      description: 'The HMAC of Value, rendered in Encoding. Available once Done has fired',
      getter: function () {
        return this._internal.signature;
      }
    },
    ...outcomeOutputs({
      done: 'Fires once the signature has been computed and is available on Signature',
      failure: 'Fires when the signature could not be computed — most often no Key'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why no signature was produced. It names the problem, never the key',
      getter: function () {
        return this._internal.error;
      }
    }
  },
  methods: {
    failSign: function (message, tokens) {
      this._internal.error = message;
      this.flagOutputDirty('error');
      reportOutcomes(this, tokens || [], 'failure', { code: 'hmac/failed', message });
    },
    runSign: function () {
      const tokens = this._internal.pendingOutcomes || [];
      this._internal.pendingOutcomes = undefined;

      const key = this._internal.key;
      if (!key) {
        this.failSign('HMAC: a Key is required. Wire one from a Secret node.', tokens);
        return;
      }

      const algorithm = this._internal.algorithm || 'SHA-256';
      const encoding = this._internal.encoding || 'hex';

      hmacBytes(key, this._internal.value || '', algorithm)
        .then((bytes) => {
          this._internal.signature = encodeBytes(bytes, encoding);
          this._internal.error = undefined;
          this.flagOutputDirty('signature');
          this.flagOutputDirty('error');
          reportOutcomes(this, tokens, 'done');
        })
        .catch((e) => this.failSign(e instanceof Error ? e.message : String(e), tokens));
    }
  }
};

export function setup() {
  // No editor-only dynamic-port behaviour; every port here is static.
}
