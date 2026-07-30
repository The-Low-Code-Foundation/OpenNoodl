import type { InspectInfo, NodeDefinitionOptions, NodeInstance } from '@noodl/types';

/**
 * `emitSignals` is hung off the prototype via `prototypeExtensions`, so it is not on
 * `NodeInstance` — which is closed on purpose. Declare it here and bind the callbacks
 * that call it to this shape.
 */
interface SwitchInstance extends NodeInstance {
  _internal: {
    state: boolean;
    initialized: boolean;
  };
  emitSignals(): void;
}

const Switch: NodeDefinitionOptions = {
  name: 'Switch',
  docs: 'https://docs.noodl.net/nodes/logic/switch',
  category: 'Logic',
  initialize(this: SwitchInstance) {
    this._internal.state = false;
    this._internal.initialized = false;
  },
  getInspectInfo(this: SwitchInstance): InspectInfo {
    // Wrapped as a value entry — a bare boolean renders as nothing in the
    // editor's inspector popup (DEBT-006, PLAT-003 NOTES §13.3).
    return [{ type: 'value', value: this._internal.state }];
  },
  inputs: {
    on: {
      displayName: 'On',
      group: 'Change State',
      description: 'Switches on, doing nothing if it is already on',
      valueChangedToTrue(this: SwitchInstance) {
        if (this._internal.state === true) {
          return;
        }
        this._internal.state = true;
        this.flagOutputDirty('state');
        this.emitSignals();
      }
    },
    off: {
      displayName: 'Off',
      group: 'Change State',
      description: 'Switches off, doing nothing if it is already off',
      valueChangedToTrue(this: SwitchInstance) {
        if (this._internal.state === false) {
          return;
        }
        this._internal.state = false;
        this.flagOutputDirty('state');
        this.emitSignals();
      }
    },
    flip: {
      displayName: 'Flip',
      group: 'Change State',
      description: 'Switches to whichever state it is not currently in',
      valueChangedToTrue(this: SwitchInstance) {
        this._internal.state = !this._internal.state;
        this.flagOutputDirty('state');
        this.emitSignals();
      }
    },
    onFromStart: {
      type: 'boolean',
      displayName: 'State',
      group: 'General',
      description: 'State to start in, and setting it announces a switch on Switched even though nothing switched',
      default: false,
      set(this: SwitchInstance, value: unknown) {
        this._internal.state = !!value;
        this.flagOutputDirty('state');
        this.emitSignals();
      }
    }
  },
  outputs: {
    state: {
      type: 'boolean',
      displayName: 'Current State',
      description: 'True while the switch is on',
      getter(this: SwitchInstance) {
        return this._internal.state;
      }
    },
    switched: {
      displayName: 'Switched',
      type: 'signal',
      group: 'Signals',
      description: 'Fires on every state change, alongside whichever of Switched To On and Switched To Off applies'
    },
    switchedToOn: {
      displayName: 'Switched To On',
      type: 'signal',
      group: 'Signals',
      description: 'Fires when the switch becomes on'
    },
    switchedToOff: {
      displayName: 'Switched To Off',
      type: 'signal',
      group: 'Signals',
      description: 'Fires when the switch becomes off'
    }
  },
  prototypeExtensions: {
    emitSignals(this: SwitchInstance) {
      if (this._internal.state === true) {
        this.sendSignalOnOutput('switchedToOn');
      } else {
        this.sendSignalOnOutput('switchedToOff');
      }
      this.sendSignalOnOutput('switched');
    }
  }
};

export default {
  node: Switch
};
