/**
 * JWT Sign (CWF-010 slice 4) — mint a signed token.
 *
 * ⚠️ **Cloud only, and this one is not a judgement call:** signing in a browser means the signing
 * key is in the browser, and a token anyone can mint is not a token. Registered in
 * `noodl-viewer-cloud/src/nodes/index.ts` for the same reason the Secret node is.
 *
 * HS256/384/512 only, on WebCrypto (`@noodl/runtime/.../crypto/jwt`). **RS256 is deliberately not
 * in this pass**: it needs `crypto.subtle.importKey` with a PEM and a key-format decision, still
 * with no dependency, and it is a slice of its own rather than a flag on this one.
 */

import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';
import { signJwt } from '@noodl/runtime/src/nodes/std-library/crypto/jwt';

export const node = {
  name: 'noodl.cloud.jwtsign',
  displayNodeName: 'JWT Sign',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/jwt-sign',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'Values', 'Events', 'Error']
  },
  /** ⚠️ A declared `default` never runs its setter — this line is the real default. */
  initialize: function () {
    this._internal.algorithm = 'HS256';
  },
  inputs: {
    claims: {
      type: { name: 'object', allowConnectionsOnly: true },
      displayName: 'Claims',
      group: 'General',
      description:
        'The payload object. `iat` is always added; `exp` is added when Expires In is set. Anything ' +
        'you put here is readable by whoever holds the token — a JWT is signed, not encrypted',
      set: function (value) {
        this._internal.claims = value;
      }
    },
    key: {
      type: 'string',
      displayName: 'Key',
      group: 'General',
      description: 'The signing secret. Wire this from a Secret node — never type a credential into the graph',
      set: function (value) {
        this._internal.key = value;
      }
    },
    algorithm: {
      type: {
        name: 'enum',
        enums: [
          { label: 'HS256', value: 'HS256' },
          { label: 'HS384', value: 'HS384' },
          { label: 'HS512', value: 'HS512' }
        ]
      },
      displayName: 'Algorithm',
      group: 'General',
      default: 'HS256',
      description: 'Which HMAC signs the token. RS256 is not offered yet — it needs a key-import pass of its own',
      set: function (value) {
        this._internal.algorithm = value;
      }
    },
    expiresIn: {
      type: 'number',
      displayName: 'Expires In (s)',
      group: 'General',
      description:
        'Seconds until the token expires, stamped as `exp`. Leave empty for a token with no expiry — ' +
        'which is a decision, not a default',
      set: function (value) {
        this._internal.expiresIn = value;
      }
    },
    sign: {
      type: 'signal',
      displayName: 'Do',
      group: 'Actions',
      description: 'Signs the claims and puts the token on Token',
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
    token: {
      type: 'string',
      displayName: 'Token',
      group: 'Values',
      description: 'The signed JWT, available once Done has fired',
      getter: function () {
        return this._internal.token;
      }
    },
    ...outcomeOutputs({
      done: 'Fires once the token has been signed and is available on Token',
      failure: 'Fires when the token could not be signed — no Key, or claims that will not serialise'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why no token was produced. It names the problem, never the key',
      getter: function () {
        return this._internal.error;
      }
    }
  },
  methods: {
    failSign: function (message, tokens) {
      this._internal.error = message;
      this.flagOutputDirty('error');
      reportOutcomes(this, tokens || [], 'failure', { code: 'jwt-sign/failed', message });
    },
    runSign: function () {
      const tokens = this._internal.pendingOutcomes || [];
      this._internal.pendingOutcomes = undefined;

      const claims = this._internal.claims;
      if (claims !== undefined && (typeof claims !== 'object' || claims === null || Array.isArray(claims))) {
        this.failSign('JWT Sign: Claims must be an object.', tokens);
        return;
      }

      const expiresIn = this._internal.expiresIn === undefined ? undefined : Number(this._internal.expiresIn);

      signJwt(claims || {}, this._internal.key, this._internal.algorithm || 'HS256', expiresIn)
        .then((token) => {
          this._internal.token = token;
          this._internal.error = undefined;
          this.flagOutputDirty('token');
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
