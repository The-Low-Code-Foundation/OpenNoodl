'use strict';

import { extendSetComponentObjectProperties, type SetComponentObjectPropertiesInstance } from './base';

/**
 * The self variant, and the one node in this family that is **🔵 by evidence** (NDA-004 §2).
 *
 * Its record is `componentState<own instance id>`. `getInstanceId()` always returns one and
 * `Model.get` is create-on-read, so there is no walk to miss and no branch on which this node
 * can be asked to write and be unable to. It therefore gets no `Failure` port — the contract is
 * explicit that a vestigial port implying a failure mode that does not exist is worse than none,
 * and it is the whole reason `canFailToResolve` is opt-in rather than always on.
 *
 * The near-identical `setparentcomponentobjectproperties.ts` *does* walk, and was writing into a
 * throwaway record while reporting `Done`. Same file, same shape, opposite verdict — which is
 * this phase's recurring lesson about reading what reaches a site rather than matching on shape.
 */
export = extendSetComponentObjectProperties({
  name: 'net.noodl.SetComponentObjectProperties',
  displayName: 'Set Component Object Properties',
  docs: 'https://docs.noodl.net/nodes/component-utilities/set-component-object-properties',
  resolveComponentObject: function (this: SetComponentObjectPropertiesInstance) {
    const owner = this.nodeScope.componentOwner;
    return {
      id: 'componentState' + owner.getInstanceId(),
      name: owner.name
    };
  }
});
