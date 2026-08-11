import { outcomeOutputs } from '../../outcome';
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
  setStateByAction(next: boolean): void;
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
      description: 'Switches on, or fires Unchanged if it is already on',
      valueChangedToTrue(this: SwitchInstance) {
        this.setStateByAction(true);
      }
    },
    off: {
      displayName: 'Off',
      group: 'Change State',
      description: 'Switches off, or fires Unchanged if it is already off',
      valueChangedToTrue(this: SwitchInstance) {
        this.setStateByAction(false);
      }
    },
    flip: {
      displayName: 'Flip',
      group: 'Change State',
      description: 'Switches to whichever state it is not currently in',
      valueChangedToTrue(this: SwitchInstance) {
        // Flip cannot no-op — it always lands on the other state — so it reports `Done`
        // unconditionally and the node still gets exactly one outcome per invocation.
        this.setStateByAction(!this._internal.state);
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
      group: 'Values',
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
      group: 'Events',
      description: 'Fires on every state change, alongside whichever of Switched To On and Switched To Off applies'
    },
    switchedToOn: {
      displayName: 'Switched To On',
      type: 'signal',
      group: 'Events',
      description: 'Fires when the switch becomes on'
    },
    switchedToOff: {
      displayName: 'Switched To Off',
      type: 'signal',
      group: 'Events',
      description: 'Fires when the switch becomes off'
    },

    /**
     * ERG-001 §4, §0.3's register. `On` when already on was `if (state === true) return;` — a
     * bare return, and none of the three signals above fires either, because all three are
     * about a *change*. So a graph wired "On, then do the next thing" stopped dead whenever the
     * switch happened to be on already, which is the common case for an idempotent On.
     *
     * Not a failure: the switch is on, which is what `On` asked for.
     */
    ...outcomeOutputs({
      done: 'Fires when the switch actually changed state',
      unchanged: 'Fires when it was already in that state, so none of the Switched signals fired'
    })
  },
  prototypeExtensions: {
    /**
     * `On`, `Off` and `Flip` share this: the only thing that differed between them was the
     * value, and the outcome contract would otherwise have made three near-identical bodies.
     */
    setStateByAction(this: SwitchInstance, next: boolean) {
      const outcome = this.beginOutcome();
      if (this._internal.state === next) {
        this.reportOutcome(outcome, 'unchanged');
        return;
      }
      this._internal.state = next;
      this.flagOutputDirty('state');
      this.emitSignals();
      // Last, after `Switched` and its sibling — the outcome summarises them.
      this.reportOutcome(outcome, 'done');
    },
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

export = {
  node: Switch
};
