'use strict';

/**
 * Hash (CWF-010 slice 1) — a SHA-2 digest of a string, as a node.
 *
 * The engine was already there: TALK-007 §3.1 ran a real `crypto.subtle.digest('SHA-256', …)`
 * inside a cloud function, and the browser has had WebCrypto for a decade. So the cost of this
 * node was never the algorithm — it is port shape, defaults and failure behaviour.
 *
 * ⚠️ **Shared runtime, deliberately.** Hashing is as ordinary in a browser (content addressing,
 * a cache key, an integrity check) as on a server. The nodes CWF-010 keeps cloud-only are the
 * ones that take a KEY — HMAC and JWT Sign — because a key in a browser is a key in the hands of
 * everyone who opens the page.
 *
 * ⚠️ **MD5 and SHA-1 are absent and stay absent.** WebCrypto does not implement MD5 at all and
 * offers SHA-1 only for legacy verification; hand-rolling either so a node could offer it would
 * be shipping a broken hash with our name on it. A legacy checksum is a Function node's problem.
 *
 * ⚠️ **`crypto.subtle` is asynchronous**, so `Done` fires from the promise's continuation, never
 * beside the `Do` that started it. A node that signalled Done first would pass a single-node test
 * and hand the next node a stale digest in a real graph.
 */

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { outcomeOutputs, reportOutcomes } from '../../../outcome';
import { ByteEncoding, DigestAlgorithm, encodeBytes, requireSubtle, utf8Bytes } from './encoding';

interface HashNodeInstance extends NodeInstance {
  _internal: {
    value?: string;
    algorithm?: DigestAlgorithm;
    encoding?: ByteEncoding;
    digest?: string;
    error?: string;
    pendingOutcomes?: unknown[];
    scheduled?: boolean;
  };
  _run(): void;
  _fail(message: string, tokens: unknown[]): void;
}

const HashNode: NodeDefinitionOptions = {
  name: 'net.noodl.Hash',
  displayNodeName: 'Hash',
  docs: 'https://docs.noodl.net/nodes/utilities/hash',
  category: 'Utilities',
  color: 'data',
  /**
   * ⚠️ A declared `default` NEVER runs its setter — the repo's single most-repeated defect
   * (`nodedefinition.ts` fills `_inputValues` and nothing pushes those through). The `default`
   * keys below are what the property panel DISPLAYS; these two lines are what the node actually
   * runs with until an author touches the field.
   */
  initialize: function (this: HashNodeInstance) {
    this._internal.algorithm = 'SHA-256';
    this._internal.encoding = 'hex';
  },
  inputs: {
    value: {
      type: 'string',
      displayName: 'Value',
      group: 'General',
      description: 'The text to hash, as UTF-8 bytes',
      set: function (this: HashNodeInstance, value: string) {
        this._internal.value = value;
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
      description: 'Which SHA-2 digest to compute. MD5 and SHA-1 are not offered — WebCrypto has neither',
      set: function (this: HashNodeInstance, value: DigestAlgorithm) {
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
      description: 'How the digest bytes are rendered as text',
      set: function (this: HashNodeInstance, value: ByteEncoding) {
        this._internal.encoding = value;
      }
    },
    hash: {
      type: 'signal',
      displayName: 'Do',
      group: 'Actions',
      description: 'Computes the digest of Value',
      valueChangedToTrue: function (this: HashNodeInstance) {
        const token = this.beginOutcome();
        if (!this._internal.pendingOutcomes) this._internal.pendingOutcomes = [];
        this._internal.pendingOutcomes.push(token);
        if (this._internal.scheduled) return;
        this._internal.scheduled = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          this._internal.scheduled = false;
          this._run();
        });
      }
    }
  },
  outputs: {
    digest: {
      type: 'string',
      displayName: 'Digest',
      group: 'Values',
      description: 'The hash of Value, rendered in Encoding. Available once Done has fired',
      getter: function (this: HashNodeInstance) {
        return this._internal.digest;
      }
    },
    ...outcomeOutputs({
      done: 'Fires once the digest has been computed and is available on Digest',
      failure: 'Fires when the digest could not be computed, most often because WebCrypto is not available here'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the digest could not be computed',
      getter: function (this: HashNodeInstance) {
        return this._internal.error;
      }
    }
  },
  methods: {
    _fail: function (this: HashNodeInstance, message: string, tokens: unknown[]) {
      this._internal.error = message;
      this.flagOutputDirty('error');
      reportOutcomes(this, tokens as never[], 'failure', { code: 'hash/failed', message });
    },
    _run: function (this: HashNodeInstance) {
      const tokens = this._internal.pendingOutcomes || [];
      this._internal.pendingOutcomes = undefined;

      // `|| fallback` and not `?? fallback`: an empty string here is an author who cleared the
      // field, and an empty algorithm name is not a thing WebCrypto can do anything with.
      const algorithm = this._internal.algorithm || 'SHA-256';
      const encoding = this._internal.encoding || 'hex';
      const value = this._internal.value || '';

      let digesting: Promise<ArrayBuffer>;
      try {
        digesting = requireSubtle().digest(algorithm, utf8Bytes(value));
      } catch (e) {
        this._fail(e instanceof Error ? e.message : String(e), tokens);
        return;
      }

      digesting
        .then((buffer) => {
          this._internal.digest = encodeBytes(new Uint8Array(buffer), encoding);
          this._internal.error = undefined;
          this.flagOutputDirty('digest');
          this.flagOutputDirty('error');
          reportOutcomes(this, tokens as never[], 'done');
        })
        .catch((e) => this._fail(e instanceof Error ? e.message : String(e), tokens));
    }
  }
};

const HashNodeModule: NodeModule = { node: HashNode };

export = HashNodeModule;
