'use strict';

import type { NodeInstance } from '@noodl/types';

/**
 * Builds the setter installed on a signal input — one declared with `valueChangedToTrue`.
 *
 * Signals arrive as a false → true → false sequence, and only the rising edge is an event.
 * The closed-over `currentValue` is what makes this per-instance state, which is why
 * `nodedefinition.js` cannot share signal setters between node instances the way it shares
 * ordinary ones.
 */
function createSetter(args: { valueChangedToTrue: (this: NodeInstance) => void }) {
  console.log('[EdgeTriggeredInput] 🔧 createSetter called for signal input');

  var currentValue = false;

  return function (this: NodeInstance, value: unknown) {
    console.log('[EdgeTriggeredInput] ⚡ setter called with value:', value, 'currentValue:', currentValue);
    const nextValue = value ? true : false;
    //value changed from false to true
    if (nextValue && currentValue === false) {
      console.log('[EdgeTriggeredInput] ✅ Triggering valueChangedToTrue!');
      args.valueChangedToTrue.call(this);
    }
    currentValue = nextValue;
  };
}

export = {
  createSetter: createSetter
};
