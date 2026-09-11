'use strict';

/**
 * Random Bytes (CWF-010 slice 3) — a block of cryptographically random bytes as text.
 *
 * ⚠️ **It never falls back to `Math.random()`.** That is the whole point of shipping this rather
 * than leaving it to a Function node: a silent downgrade from a CSPRNG produces output that looks
 * identical and is worthless, and `Math.random()` is *the* thing people reach for. `randomBytes`
 * in `./encoding` throws instead, and the throw arrives here as a `Failure` with the reason on
 * `Error`.
 *
 * Shared runtime: a browser generating a nonce, a PKCE verifier or a client-side id wants this
 * as much as a server does, and there is no key involved.
 */

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';
import { ByteEncoding, encodeBytes, randomBytes } from './encoding';

/** Above this, an author has almost certainly wired a number they did not mean. */
const MAX_LENGTH = 4096;

interface RandomBytesNodeInstance extends NodeInstance {
  _internal: {
    length?: number;
    encoding?: ByteEncoding;
    value?: string;
    error?: string;
  };
  _generate(token: unknown): void;
}

const RandomBytesNode: NodeDefinitionOptions = {
  name: 'net.noodl.RandomBytes',
  displayNodeName: 'Random Bytes',
  docs: 'https://docs.noodl.net/nodes/utilities/random-bytes',
  category: 'Utilities',
  color: 'data',
  /** ⚠️ A declared `default` never runs its setter — these two lines are the real defaults. */
  initialize: function (this: RandomBytesNodeInstance) {
    this._internal.length = 32;
    this._internal.encoding = 'hex';
  },
  inputs: {
    length: {
      type: 'number',
      displayName: 'Length',
      group: 'General',
      default: 32,
      description: `How many random BYTES to generate (not characters — hex renders each byte as two). 1 to ${MAX_LENGTH}`,
      set: function (this: RandomBytesNodeInstance, value: number) {
        this._internal.length = Number(value);
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
      description: 'How the bytes are rendered as text. Base64 URL is the safe one for a URL or a token',
      set: function (this: RandomBytesNodeInstance, value: ByteEncoding) {
        this._internal.encoding = value;
      }
    },
    generate: {
      type: 'signal',
      displayName: 'New',
      group: 'Actions',
      description: 'Generates a fresh block of random bytes',
      valueChangedToTrue: function (this: RandomBytesNodeInstance) {
        this._generate(this.beginOutcome());
      }
    }
  },
  outputs: {
    value: {
      type: 'string',
      displayName: 'Value',
      group: 'Values',
      description: 'The random bytes rendered in Encoding, replaced on every New',
      getter: function (this: RandomBytesNodeInstance) {
        return this._internal.value;
      }
    },
    ...outcomeOutputs({
      done: 'Fires once fresh random bytes are available on Value',
      failure:
        'Fires when there is no cryptographic random source here, or Length is out of range. This node ' +
        'will not quietly substitute Math.random()'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why no random bytes were produced',
      getter: function (this: RandomBytesNodeInstance) {
        return this._internal.error;
      }
    }
  },
  methods: {
    _generate: function (this: RandomBytesNodeInstance, token: unknown) {
      // ⚠️ NOT `|| 32`. `Length: 0` is falsy, so `||` would silently turn an author's mistake
      // into 32 valid-looking bytes — the exact shape of defect this node exists to refuse.
      // Only "nobody ever set it" gets the default.
      const length = this._internal.length === undefined ? 32 : this._internal.length;
      const encoding = this._internal.encoding || 'hex';

      const fail = (message: string) => {
        this._internal.error = message;
        this.flagOutputDirty('error');
        this.reportOutcome(token as never, 'failure', { code: 'random-bytes/failed', message });
      };

      if (!Number.isFinite(length) || length < 1 || length > MAX_LENGTH || Math.floor(length) !== length) {
        fail(`Random Bytes: Length must be a whole number from 1 to ${MAX_LENGTH}, and was ${String(length)}.`);
        return;
      }

      try {
        this._internal.value = encodeBytes(randomBytes(length), encoding);
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        return;
      }

      this._internal.error = undefined;
      this.flagOutputDirty('value');
      this.flagOutputDirty('error');
      this.reportOutcome(token as never, 'done');
    }
  }
};

const RandomBytesNodeModule: NodeModule = { node: RandomBytesNode };

export = RandomBytesNodeModule;
