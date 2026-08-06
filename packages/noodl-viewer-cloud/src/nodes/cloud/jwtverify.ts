/**
 * JWT Verify (CWF-010 slice 4) — check a token somebody else issued.
 *
 * ⚠️ **This is not how you authenticate your own users, and the distinction cost Richard an hour.**
 * The original ask was "grabbing a JWT to authenticate the user in the backend". The **Request**
 * node already does that: it resolves the caller from the `x-parse-session-token` header before
 * the graph runs and outputs `Authenticated` and `User Id` (TALK-007 Pile C). Reach for those.
 *
 * JWT Verify is for **somebody else's** token — a partner's signed webhook, an OIDC `id_token`, a
 * download link your own backend minted with JWT Sign. If the token came in on your own session
 * header, this is the wrong node.
 *
 * ⚠️ The algorithm is what you tell it, never what the token claims. `alg: none` and
 * algorithm-confusion are both refused before the signature is even computed — see the module
 * comment on `@noodl/runtime/.../crypto/jwt`.
 *
 * Cloud only: an HS256 key is a shared secret, so verifying in a browser means shipping it.
 */

import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';
import { verifyJwt } from '@noodl/runtime/src/nodes/std-library/crypto/jwt';

export const node = {
  name: 'noodl.cloud.jwtverify',
  displayNodeName: 'JWT Verify',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/jwt-verify',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'Value', 'Events', 'Error']
  },
  /** ⚠️ A declared `default` never runs its setter — these lines are the real defaults. */
  initialize: function () {
    this._internal.algorithm = 'HS256';
    this._internal.clockTolerance = 0;
  },
  inputs: {
    token: {
      type: 'string',
      displayName: 'Token',
      group: 'General',
      description: 'The JWT to check, without any "Bearer " prefix',
      set: function (value) {
        this._internal.token = value;
      }
    },
    key: {
      type: 'string',
      displayName: 'Key',
      group: 'General',
      description: 'The shared secret the issuer signed with. Wire this from a Secret node',
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
      description:
        'The algorithm the token MUST have been signed with. A token whose header says anything else ' +
        'is refused unread — that is what stops alg:none and algorithm confusion',
      set: function (value) {
        this._internal.algorithm = value;
      }
    },
    clockTolerance: {
      type: 'number',
      displayName: 'Clock Tolerance (s)',
      group: 'General',
      default: 0,
      description: 'Seconds of leeway on exp and nbf, for issuers whose clock is not quite yours',
      set: function (value) {
        this._internal.clockTolerance = value;
      }
    },
    verify: {
      type: 'signal',
      displayName: 'Do',
      group: 'Actions',
      description: 'Checks the token',
      valueChangedToTrue: function () {
        const outcome = this.beginOutcome();
        if (!this._internal.pendingOutcomes) this._internal.pendingOutcomes = [];
        this._internal.pendingOutcomes.push(outcome);
        if (this._internal.scheduled) return;
        this._internal.scheduled = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          this._internal.scheduled = false;
          this.runVerify();
        });
      }
    }
  },
  outputs: {
    valid: {
      type: 'boolean',
      displayName: 'Valid',
      group: 'Value',
      description: 'Whether the token verified. False whenever Failure fired, so either can be wired',
      getter: function () {
        return this._internal.valid === true;
      }
    },
    claims: {
      type: 'object',
      displayName: 'Claims',
      group: 'Value',
      description:
        'The token payload — set ONLY after the signature verified. Nothing in a token can be believed ' +
        'before that, so this is left alone on a failure rather than handed over unchecked',
      getter: function () {
        return this._internal.claims;
      }
    },
    ...outcomeOutputs({
      done: 'Fires when the token verified and Claims holds its payload',
      failure:
        'Fires when the token did not verify, for any reason — expired, not yet valid, wrong key, wrong ' +
        'algorithm, tampered with, or malformed. Error says which'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the token did not verify',
      getter: function () {
        return this._internal.error;
      }
    }
  },
  methods: {
    failVerify: function (message, tokens) {
      this._internal.valid = false;
      this._internal.error = message;
      this.flagOutputDirty('valid');
      this.flagOutputDirty('error');
      reportOutcomes(this, tokens || [], 'failure', { code: 'jwt-verify/rejected', message });
    },
    runVerify: function () {
      const tokens = this._internal.pendingOutcomes || [];
      this._internal.pendingOutcomes = undefined;

      const tolerance = Number(this._internal.clockTolerance) || 0;

      verifyJwt(this._internal.token, this._internal.key, this._internal.algorithm || 'HS256', tolerance)
        .then((result) => {
          if (!result.valid) {
            this.failVerify(result.reason || 'JWT Verify: the token did not verify.', tokens);
            return;
          }
          this._internal.valid = true;
          this._internal.claims = result.claims;
          this._internal.error = undefined;
          this.flagOutputDirty('valid');
          this.flagOutputDirty('claims');
          this.flagOutputDirty('error');
          reportOutcomes(this, tokens, 'done');
        })
        .catch((e) => this.failVerify(e instanceof Error ? e.message : String(e), tokens));
    }
  }
};

export function setup() {
  // No editor-only dynamic-port behaviour; every port here is static.
}
