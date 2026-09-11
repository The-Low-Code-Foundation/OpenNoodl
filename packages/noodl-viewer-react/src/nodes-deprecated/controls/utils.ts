import type React from 'react';

import PointerListeners, {
  type PointerListenerProps,
  type PointerListeners as PointerListenerMap
} from '../../pointerlisteners';
import type {
  ReactInputPropDefinition,
  ReactNodeDefinition,
  ReactOutputPropDefinition
} from '../../react-component-node';

function _shallowCompare(o1: object, o2: object): boolean {
  for (const p in o1) {
    if (o1.hasOwnProperty(p)) {
      if (o1[p] !== o2[p]) {
        return false;
      }
    }
  }
  for (const p in o2) {
    if (o2.hasOwnProperty(p)) {
      if (o1[p] !== o2[p]) {
        return false;
      }
    }
  }
  return true;
}

const _styleSheets: Record<string, { style: HTMLStyleElement; props: object }> = {};

/**
 * Injects — or updates — a `<style>` element for a generated class name.
 *
 * The sheet is keyed by class name in a module-level record, so every instance
 * sharing a generated class shares one element; the props comparison is what
 * stops each setter call from rewriting it.
 *
 * Generic in the props it carries, because callers pass anything from a
 * two-field literal to the node's whole props bag, and the template that
 * renders them must agree.
 */
function updateStylesForClass<TProps extends object>(
  _class: string,
  props: TProps,
  _styleTemplate: (className: string, props: TProps) => string
): void {
  // Setters call this during graph load, which also happens server-side; the
  // injected stylesheet is browser-only and re-created at hydration.
  if (typeof document === 'undefined') return;

  if (_styleSheets[_class]) {
    // Check if props have changed
    if (!_shallowCompare(props, _styleSheets[_class].props)) {
      _styleSheets[_class].style.innerHTML = _styleTemplate(_class, props);
      _styleSheets[_class].props = Object.assign({}, props);
    }
  } else {
    // Create a new style sheet if none exists
    const style = document.createElement('style');
    style.innerHTML = _styleTemplate(_class, props);
    document.head.appendChild(style);

    _styleSheets[_class] = { style, props: Object.assign({}, props) };
  }
}

/** Merges `values` into one of the definition's port records, creating it if absent. */
function mergeAttribute<TAttribute extends 'inputProps' | 'outputProps'>(
  definition: ReactNodeDefinition,
  attribute: TAttribute,
  values: NonNullable<ReactNodeDefinition[TAttribute]>
): void {
  if (!definition[attribute]) {
    definition[attribute] = {};
  }

  for (const name in values) {
    definition[attribute][name] = values[name];
  }
}

function addInputProps(definition: ReactNodeDefinition, values: Record<string, ReactInputPropDefinition>): void {
  mergeAttribute(definition, 'inputProps', values);
}

function addOutputProps(definition: ReactNodeDefinition, values: Record<string, ReactOutputPropDefinition>): void {
  mergeAttribute(definition, 'outputProps', values);
}

/**
 * Adds the focus / hover / pressed ports every deprecated control shares.
 *
 * Each state is three ports writing one `outputPropValues` entry: the boolean,
 * and the two signals. The boolean's handlers guard their signal with
 * `hasOutput`, since a graph that reads only the state should not pay for
 * signals nobody is listening to; the signal ports send unconditionally,
 * because their existence *is* the connection.
 */
function addControlEventsAndStates(definition: ReactNodeDefinition): void {
  addInputProps(definition, {
    blockTouch: {
      group: 'Pointer Events',
      index: 450,
      displayName: 'Block Pointer Events',
      type: 'boolean'
    },
    // FH-015 slice 2. These nodes are deprecated but still render through `pointerProps`, so
    // the new click-bubbling default reaches them whether they declare the port or not. They
    // get it too, or a project still using them would have no way back to the old behaviour.
    clickBubbling: {
      group: 'Pointer Events',
      index: 451,
      displayName: 'Click Bubbling',
      type: {
        name: 'enum',
        enums: [
          { label: 'Automatic', value: 'auto' },
          { label: 'Always', value: 'always' },
          { label: 'Never', value: 'never' }
        ]
      },
      default: 'auto'
    }
  });

  addOutputProps(definition, {
    // Focus
    focusState: {
      displayName: 'Focused',
      group: 'States',
      type: 'boolean',
      props: {
        onFocus() {
          this.outputPropValues.focusState = true;
          this.flagOutputDirty('focusState');
          this.hasOutput('onFocus') && this.sendSignalOnOutput('onFocus');
        },
        onBlur() {
          this.outputPropValues.focusState = false;
          this.flagOutputDirty('focusState');
          this.hasOutput('onBlur') && this.sendSignalOnOutput('onBlur');
        }
      }
    },
    onFocus: {
      displayName: 'Focused',
      group: 'Events',
      type: 'signal',
      props: {
        onFocus() {
          this.outputPropValues.focusState = true;
          this.flagOutputDirty('focusState');
          this.sendSignalOnOutput('onFocus');
        }
      }
    },
    onBlur: {
      displayName: 'Blurred',
      group: 'Events',
      type: 'signal',
      props: {
        onBlur() {
          this.outputPropValues.focusState = false;
          this.flagOutputDirty('focusState');
          this.sendSignalOnOutput('onBlur');
        }
      }
    },

    // Hover
    hoverState: {
      displayName: 'Hover',
      group: 'States',
      type: 'boolean',
      props: {
        onMouseOver() {
          this.outputPropValues.hoverState = true;
          this.flagOutputDirty('hoverState');
          this.hasOutput('hoverStart') && this.sendSignalOnOutput('hoverStart');
        },
        onMouseLeave() {
          this.outputPropValues.hoverState = false;
          this.flagOutputDirty('hoverState');
          this.hasOutput('hoverEnd') && this.sendSignalOnOutput('hoverEnd');
        }
      }
    },
    hoverStart: {
      displayName: 'Hover Start',
      group: 'Events',
      type: 'signal',
      props: {
        onMouseOver() {
          this.outputPropValues.hoverState = true;
          this.flagOutputDirty('hoverState');
          this.sendSignalOnOutput('hoverStart');
        }
      }
    },
    hoverEnd: {
      displayName: 'Hover End',
      group: 'Events',
      type: 'signal',
      props: {
        onMouseLeave() {
          this.outputPropValues.hoverState = false;
          this.flagOutputDirty('hoverState');
          this.sendSignalOnOutput('hoverEnd');
        }
      }
    },

    // Pressed
    pressedState: {
      displayName: 'Pressed',
      group: 'States',
      type: 'boolean',
      props: {
        onMouseDown() {
          this.outputPropValues.pressedState = true;
          this.flagOutputDirty('pressedState');
          this.hasOutput('pointerDown') && this.sendSignalOnOutput('pointerDown');
        },
        onTouchStart() {
          this.outputPropValues.pressedState = true;
          this.flagOutputDirty('pressedState');
          this.hasOutput('pointerDown') && this.sendSignalOnOutput('pointerDown');
        },
        onMouseUp() {
          this.outputPropValues.pressedState = false;
          this.flagOutputDirty('pressedState');
          this.hasOutput('pointerUp') && this.sendSignalOnOutput('pointerUp');
        },
        onTouchEnd() {
          this.outputPropValues.pressedState = false;
          this.flagOutputDirty('pressedState');
          this.hasOutput('pointerUp') && this.sendSignalOnOutput('pointerUp');
        },
        onTouchCancel() {
          this.outputPropValues.pressedState = false;
          this.flagOutputDirty('pressedState');
          this.hasOutput('pointerUp') && this.sendSignalOnOutput('pointerUp');
        }
      }
    },
    pointerDown: {
      displayName: 'Pointer Down',
      group: 'Events',
      type: 'signal',
      props: {
        onMouseDown() {
          this.outputPropValues.pressedState = true;
          this.flagOutputDirty('pressedState');
          this.sendSignalOnOutput('pointerDown');
        },
        onTouchStart() {
          this.outputPropValues.pressedState = true;
          this.flagOutputDirty('pressedState');
          this.sendSignalOnOutput('pointerDown');
        }
      }
    },
    pointerUp: {
      displayName: 'Pointer Up',
      group: 'Events',
      type: 'signal',
      props: {
        onMouseUp() {
          this.outputPropValues.pressedState = false;
          this.flagOutputDirty('pressedState');
          this.sendSignalOnOutput('pointerUp');
        },
        onTouchEnd() {
          this.outputPropValues.pressedState = false;
          this.flagOutputDirty('pressedState');
          this.sendSignalOnOutput('pointerUp');
        },
        onTouchCancel() {
          this.outputPropValues.pressedState = false;
          this.flagOutputDirty('pressedState');
          this.sendSignalOnOutput('pointerUp');
        }
      }
    }
  });
}

/** The focus/blur pair plus every pointer listener, ready to spread onto an element. */
function controlEvents(props: PointerListenerProps): PointerListenerMap & {
  onFocus?: React.FocusEventHandler;
  onBlur?: React.FocusEventHandler;
} {
  return Object.assign(
    {},
    {
      onFocus: props.onFocus,
      onBlur: props.onBlur
    },
    PointerListeners(props)
  );
}

export default {
  updateStylesForClass,
  addControlEventsAndStates,
  controlEvents
};
