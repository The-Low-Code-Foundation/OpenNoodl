'use strict';

/**
 * UUID (CWF-010 slice 3) — a random version-4 UUID.
 *
 * ⚠️ **This is not a duplicate of `Unique Id`, and CWF-010 guessed wrong about which one it is.**
 * The task said: "if it is already a UUID v4, this slice is *documentation*, not a node." It is
 * not. `Unique Id` returns `Model.guid()`, which is **ten characters** built from
 * `Math.random()` (`model.ts` `_randomString`) — a short, human-scannable key for a list item,
 * with no cryptographic strength and a birthday collision risk that is fine at list scale and
 * nowhere near fine at database scale.
 *
 * So both nodes exist and both descriptions now say which is which:
 *
 * | | `Unique Id` | `UUID` |
 * |---|---|---|
 * | Shape | 10 chars, alphanumeric | 36 chars, RFC 4122 v4 |
 * | Source | `Math.random()` | `crypto.randomUUID` / `crypto.getRandomValues` |
 * | Use it for | a key in a rendered list | a record id, an idempotency key, a token |
 *
 * Shared runtime: no key is involved and both surfaces want ids.
 */

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';
import { randomUuid } from './encoding';

interface UuidNodeInstance extends NodeInstance {
  _internal: {
    uuid?: string;
    error?: string;
  };
  _generate(token: unknown): void;
}

const UuidNode: NodeDefinitionOptions = {
  name: 'net.noodl.UUID',
  displayNodeName: 'UUID',
  docs: 'https://docs.noodl.net/nodes/utilities/uuid',
  category: 'Utilities',
  color: 'data',
  /**
   * One id at creation, so the value output is never empty — the shape `Unique Id` established.
   * A construction-time failure (no crypto at all) leaves `Id` blank and is reported the first
   * time `New` fires, because there is no outcome token to report against here.
   */
  initialize: function (this: UuidNodeInstance) {
    try {
      this._internal.uuid = randomUuid();
    } catch {
      this._internal.uuid = undefined;
    }
  },
  getInspectInfo(this: UuidNodeInstance): InspectInfo {
    return this._internal.uuid;
  },
  inputs: {
    generate: {
      type: 'signal',
      displayName: 'New',
      group: 'Actions',
      description: 'Generates a fresh UUID, replacing the one on Id',
      valueChangedToTrue: function (this: UuidNodeInstance) {
        this._generate(this.beginOutcome());
      }
    }
  },
  outputs: {
    uuid: {
      type: 'string',
      displayName: 'Id',
      group: 'Values',
      description:
        'A random version-4 UUID, generated once when the node is created and again on every New. ' +
        'Use this rather than Unique Id wherever the id has to be globally unique or unguessable',
      getter: function (this: UuidNodeInstance) {
        return this._internal.uuid;
      }
    },
    ...outcomeOutputs({
      done: 'Fires once a new UUID is available on Id',
      failure: 'Fires when there is no cryptographic random source here, leaving Id as it was'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why no UUID could be generated',
      getter: function (this: UuidNodeInstance) {
        return this._internal.error;
      }
    }
  },
  methods: {
    _generate: function (this: UuidNodeInstance, token: unknown) {
      try {
        this._internal.uuid = randomUuid();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this._internal.error = message;
        this.flagOutputDirty('error');
        this.reportOutcome(token as never, 'failure', { code: 'uuid/failed', message });
        return;
      }
      this._internal.error = undefined;
      this.flagOutputDirty('uuid');
      this.flagOutputDirty('error');
      this.reportOutcome(token as never, 'done');
    }
  }
};

const UuidNodeModule: NodeModule = { node: UuidNode };

export = UuidNodeModule;
