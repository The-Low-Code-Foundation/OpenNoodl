'use strict';

import {
  COMPONENT_OBJECT_TYPES,
  componentAncestorNames,
  findAncestorWithComponentObject,
  findAncestorWithName
} from '@noodl/runtime/src/componentwalk';

// CWF-008: the base and the *self* variants moved into `@noodl/runtime` so a cloud function can
// hold per-request state. This parent variant stays browser-only (a function graph rarely nests
// and "parent" has no meaning at the top of one), so it reaches across for the shared base.
import {
  extendSetComponentObjectProperties,
  type SetComponentObjectPropertiesInstance
} from '@noodl/runtime/src/nodes/std-library/componentutils/base';

/**
 * The **write** half of the Parent Component Object pair.
 *
 * ## What NDA-015 fixed here
 *
 * This carried its own copy of the upward walk with its own type list — modern
 * `net.noodl.ComponentObject` only — while `parentcomponentobject.ts` accepted the deprecated
 * `'Component State'` as well. With a deprecated Component State on `/Outer` and a modern one
 * on `/Root`, the reading node bound to `/Outer` and this one wrote to `/Root`: the same piece
 * of component state read from one place and written to another, with nothing to say so. Both
 * now go through `componentwalk.ts`'s single definition, so the pair cannot diverge again.
 *
 * ## What NDA-004 §2 fixes here
 *
 * The walk missing was a **false success**, not a silence. `getComponentObjectId` returned
 * `undefined` and the base handed that to `Model.get`, whose `undefined` branch is the anonymous
 * tier: a fresh unnamed record per store, unreachable from anywhere else in the graph. The node
 * wrote the author's properties into it and emitted `Done`. See the comment on the base's
 * `scheduleStore`, which is where the raise now lives.
 *
 * This node also gains the explicit target BINDING-CONTRACT §(a) had been owed since NDA-015 —
 * the last ⚠️ row in that document's table — so the reader and the writer of one piece of
 * component state can now be aimed at the same ancestor *by name* instead of both being trusted
 * to walk to the same place.
 */
export default extendSetComponentObjectProperties({
  name: 'net.noodl.SetParentComponentObjectProperties',
  displayName: 'Set Parent Component Object Properties',
  docs: 'https://docs.noodl.net/nodes/component-utilities/set-parent-component-object-properties',
  canFailToResolve: true,
  inputs: {
    /**
     * Mirrors `parentcomponentobject.ts`'s input exactly — same name, same type, same
     * display name, same "unset means nearest" default — because the pair is meant to be
     * configured as a pair. Two inputs that mean the same thing must look the same or an
     * author will reasonably assume they do not.
     */
    targetComponent: {
      type: 'component',
      displayName: 'Parent Component',
      group: 'General',
      description: 'Which ancestor to write to; leave blank for the nearest one that has a Component Object',
      set: function (this: SetComponentObjectPropertiesInstance, value: string) {
        this._internal.targetComponent = value || undefined;
        this.reportResolution();
      }
    }
  },
  resolveComponentObject: function (this: SetComponentObjectPropertiesInstance) {
    const self = this.nodeScope.componentOwner;
    const wanted = this._internal.targetComponent;

    // Explicit target. A miss is a *failure*, never a quiet fall back to the nearest ancestor:
    // falling back would write to *something*, which is worse than writing nowhere — the author
    // would see `Done` and believe the component they named had been updated.
    if (wanted) {
      const named = findAncestorWithName(self, wanted);

      if (!named) {
        return {
          missCode: 'set-parent-component-object-properties/target-not-found',
          missMessage: 'No ancestor component named "' + wanted + '"',
          missDetail: { target: wanted, ancestors: componentAncestorNames(self) }
        };
      }

      // Named, but with nothing to write into. Distinct from the above on purpose, and split
      // the same way the reader splits it: "you named the right component and it has no
      // Component Object" and "you named a component that is not above this one" are different
      // mistakes with different fixes.
      if (!COMPONENT_OBJECT_TYPES.some((type) => named.nodeScope.getNodesWithType(type).length > 0)) {
        return {
          missCode: 'set-parent-component-object-properties/target-has-no-object',
          missMessage: 'The component "' + wanted + '" has no Component Object node',
          missDetail: { target: wanted }
        };
      }

      return { id: 'componentState' + named.getInstanceId(), name: named.name };
    }

    // Implicit: nearest ancestor that owns a Component Object. Unchanged resolution, so every
    // existing graph writes exactly where it wrote before — what is new is that a miss says so.
    const parent = findAncestorWithComponentObject(self);

    if (!parent) {
      return {
        missCode: 'set-parent-component-object-properties/no-ancestor',
        missMessage: 'No ancestor component has a Component Object node — nothing was written',
        missDetail: { ancestors: componentAncestorNames(self) }
      };
    }

    return { id: 'componentState' + parent.getInstanceId(), name: parent.name };
  }
});
