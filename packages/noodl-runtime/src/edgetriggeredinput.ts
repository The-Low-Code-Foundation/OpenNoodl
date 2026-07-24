'use strict';

function createSetter(args) {
  console.log('[EdgeTriggeredInput] 🔧 createSetter called for signal input');

  var currentValue = false;

  return function (value) {
    console.log('[EdgeTriggeredInput] ⚡ setter called with value:', value, 'currentValue:', currentValue);
    value = value ? true : false;
    //value changed from false to true
    if (value && currentValue === false) {
      console.log('[EdgeTriggeredInput] ✅ Triggering valueChangedToTrue!');
      args.valueChangedToTrue.call(this);
    }
    currentValue = value;
  };
}

module.exports = {
  createSetter: createSetter
};
