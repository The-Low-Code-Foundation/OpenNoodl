'use strict';

import type { NodeInstance } from '@noodl/types';

import { findAncestorWithComponentObject } from '@noodl/runtime/src/componentwalk';

import { extendSetComponentObjectProperties } from './base';

/**
 * The **write** half of the Parent Component Object pair, and until now it did not agree with
 * the read half.
 *
 * This carried its own copy of the upward walk with its own type list — modern
 * `net.noodl.ComponentObject` only — while `parentcomponentobject.ts` accepted the deprecated
 * `'Component State'` as well. With a deprecated Component State on `/Outer` and a modern one
 * on `/Root`, the reading node bound to `/Outer` and this one wrote to `/Root`: the same piece
 * of component state read from one place and written to another, with nothing to say so.
 *
 * Both now go through `componentwalk.ts`'s single definition, so the pair cannot diverge again.
 * BINDING-CONTRACT §(a) is still owed here — this node has no explicit-target input yet.
 */
export default extendSetComponentObjectProperties({
  name: 'net.noodl.SetParentComponentObjectProperties',
  displayName: 'Set Parent Component Object Properties',
  docs: 'https://docs.noodl.net/nodes/component-utilities/set-parent-component-object-properties',
  getComponentObjectId: function (this: NodeInstance) {
    const parent = findAncestorWithComponentObject(this.nodeScope.componentOwner);
    if (!parent) return;

    return 'componentState' + parent.getInstanceId();
  }
});
