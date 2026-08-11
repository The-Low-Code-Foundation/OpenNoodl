import { Drag } from '../../components/visual/Drag';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';

/**
 * NDA-012 (Visual), check `G1` — read a snap coordinate, or refuse to.
 *
 * The four snap ports used to store whatever arrived. A position has no representable empty
 * state, so per `EMPTY-VALUE-CONTRACT.md` this takes the shape `Radio Button Group`'s `Value`
 * took earlier in this phase: `undefined` and `null` abstain and leave the current position
 * alone, rather than being coerced into one.
 *
 * ⚠️ The worksheet recorded the consequence of `null` as `NaN`; **it is 0**. `easeOutCubic`
 * computes `(end - start) * … + start`, so `null` coerces to zero and the element animates to the
 * origin — a plausible position, which is worse than a visible `NaN`. The `NaN` case is a
 * non-numeric string, and nothing coerces a declared `number` port on arrival.
 *
 * Returns `undefined` for "abstain"; the caller reports anything that is neither a number nor
 * empty, because a silent no-op on a `Value` port reads exactly like the port not existing.
 */
function readSnapCoordinate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : Number.NaN;
}

const DragNode: ReactNodeDefinition = {
  name: 'Drag',
  docs: 'https://docs.noodl.net/nodes/utilities/drag',
  allowChildren: true,
  noodlNodeAsProp: true,
  getReactComponent() {
    return Drag;
  },
  initialize() {
    // These four mirror the declared `default`s on the four snap value/duration ports, and
    // that duplication is load-bearing rather than redundant — see `DB-ii` in `FINDINGS.md`.
    // `registerInput` writes a declared `default` straight into `_inputValues` and `NodeScope`
    // queues only the keys the *model* carries, so a port's `set` never runs for its own
    // default. Every one of these four ports does its work in a setter side effect, so without
    // this block a never-touched `Snap To Position X` would read `undefined` for both its value
    // and its duration. Deleting a line here silently disarms the port it mirrors.
    this._internal.snapPositionX = 0;
    this._internal.snapPositionY = 0;
    this._internal.snapDurationX = 300;
    this._internal.snapDurationY = 300;

    // NDA-012 (Visual), check H1 — SR-vi's timer leak, in a fifth node one category over.
    // See `Drag.tsx#stopSnapTimers`. Deleting a node does not unmount its component, so the
    // component's own `componentWillUnmount` is not enough on its own.
    this.addDeleteListener(() => {
      this.innerReactComponentRef && this.innerReactComponentRef.stopSnapTimers();
    });
  },
  inputs: {
    'snapToPositionX.do': {
      group: 'Snap To Position X',
      displayName: 'Do',
      editorName: 'Do|Snap To Position X',
      type: 'signal',
      description: 'Animates the element to Value on the X axis; does nothing if it is already there',
      valueChangedToTrue() {
        this.scheduleAfterInputsHaveUpdated(() => {
          const { snapPositionX, snapDurationX } = this._internal;
          // NDA-012 (Visual) A3, third instance. The worksheet filed this under `B1` — "a
          // `Do` before the component mounts is dropped … with no report" — so the *class* was
          // split across two checks on three nodes. The drop was closed with
          // `withInnerComponent`; ERG-001 §4 closes the report, which is the half NDA-012
          // explicitly left here.
          this.outcomeOnInnerComponent((inner) => inner.snapToPositionX(snapPositionX, snapDurationX), {
            code: 'drag/snap-x-failed'
          });
        });
      }
    },
    'snapToPositionX.value': {
      default: 0,
      group: 'Snap To Position X',
      displayName: 'Value',
      editorName: 'Value|Snap To Position X',
      description:
        'X position the element animates to when Snap To Position X — Do fires. An empty value leaves the current position alone',
      type: 'number',
      set(value) {
        const coordinate = readSnapCoordinate(value);
        if (coordinate === undefined) return;
        if (Number.isNaN(coordinate)) {
          this.raiseRuntimeError(
            'drag/snap-position-not-a-number',
            `Snap To Position X — Value cannot be read as a number (got ${JSON.stringify(value)}), so the snap position is unchanged.`
          );
          return;
        }

        this._internal.snapPositionX = coordinate;
      }
    },
    'snapToPositionX.duration': {
      default: 300,
      group: 'Snap To Position X',
      displayName: 'Duration',
      editorName: 'Duration|Snap To Position X',
      description: 'How long the X snap animation takes, in milliseconds',
      type: 'number',
      set(value) {
        this._internal.snapDurationX = value;
      }
    },
    'snapToPositionY.do': {
      group: 'Snap To Position Y',
      displayName: 'Do',
      editorName: 'Do|Snap To Position Y',
      type: 'signal',
      description: 'Animates the element to Value on the Y axis; does nothing if it is already there',
      valueChangedToTrue() {
        this.scheduleAfterInputsHaveUpdated(() => {
          const { snapPositionY, snapDurationY } = this._internal;
          this.outcomeOnInnerComponent((inner) => inner.snapToPositionY(snapPositionY, snapDurationY), {
            code: 'drag/snap-y-failed'
          });
        });
      }
    },
    'snapToPositionY.value': {
      default: 0,
      group: 'Snap To Position Y',
      displayName: 'Value',
      editorName: 'Value|Snap To Position Y',
      description:
        'Y position the element animates to when Snap To Position Y — Do fires. An empty value leaves the current position alone',
      type: 'number',
      set(value) {
        const coordinate = readSnapCoordinate(value);
        if (coordinate === undefined) return;
        if (Number.isNaN(coordinate)) {
          this.raiseRuntimeError(
            'drag/snap-position-not-a-number',
            `Snap To Position Y — Value cannot be read as a number (got ${JSON.stringify(value)}), so the snap position is unchanged.`
          );
          return;
        }

        this._internal.snapPositionY = coordinate;
      }
    },
    'snapToPositionY.duration': {
      default: 300,
      group: 'Snap To Position Y',
      displayName: 'Duration',
      editorName: 'Duration|Snap To Position Y',
      description: 'How long the Y snap animation takes, in milliseconds',
      type: 'number',
      set(value) {
        this._internal.snapDurationY = value;
      }
    }
  },
  inputProps: {
    enabled: {
      group: 'Drag',
      displayName: 'Enabled',
      description: 'Lets the user drag this element; when off it still renders and still responds to the Snap actions',
      type: 'boolean',
      default: true
    },
    axis: {
      group: 'Drag',
      displayName: 'Axis',
      description: 'Which axes dragging is allowed on',
      type: {
        name: 'enum',
        enums: [
          { label: 'X', value: 'x' },
          { label: 'Y', value: 'y' },
          { label: 'Both', value: 'both' }
        ]
      },
      default: 'x'
    },
    useParentBounds: {
      group: 'Drag',
      displayName: 'Constrain to parent',
      description: 'Stops the element being dragged outside its parent\'s bounds',
      type: 'boolean',
      default: true
    },
    inputPositionX: {
      group: 'Values',
      displayName: 'Start Drag X',
      description: 'Sets the X position the element starts at, before any dragging',
      type: {
        name: 'number'
      }
    },
    inputPositionY: {
      group: 'Values',
      displayName: 'Start Drag Y',
      description: 'Sets the Y position the element starts at, before any dragging',
      type: {
        name: 'number'
      }
    },
    scale: {
      group: 'Values',
      displayName: 'Scale',
      description: 'Divides pointer movement before it becomes element movement, so 2 makes the element move half as far as the pointer',
      default: 1.0,
      type: {
        name: 'number'
      }
    }
  },
  outputProps: {
    onStart: {
      group: 'Events',
      type: 'signal',
      displayName: 'Drag Started',
      description: 'Fires when the user starts dragging'
    },
    onStop: {
      group: 'Events',
      type: 'signal',
      displayName: 'Drag Ended',
      description: 'Fires when the user releases the element, including when the pointer leaves the window'
    },
    onDrag: {
      group: 'Events',
      type: 'signal',
      displayName: 'Drag Moved',
      description: 'Fires on every frame the element moves while being dragged'
    },
    positionX: {
      group: 'Values',
      displayName: 'Drag X',
      type: 'number',
      description: 'Current X position of the element relative to where it started'
    },
    positionY: {
      group: 'Values',
      displayName: 'Drag Y',
      type: 'number',
      description: 'Current Y position of the element relative to where it started'
    },
    deltaX: {
      group: 'Values',
      displayName: 'Delta X',
      type: 'number',
      description: 'How far the element moved on X since the last Drag Moved'
    },
    deltaY: {
      group: 'Values',
      displayName: 'Delta Y',
      type: 'number',
      description: 'How far the element moved on Y since the last Drag Moved'
    },
    /**
     * ERG-001 §4 / DV-viii. Seven of the eight Visual nodes with action inputs could not tell a
     * graph their action had finished; this is one of them. The ports are shared by every action
     * input on the node, which is the same shape `Run Tasks` and `Timer` already have.
     */
    ...outcomeOutputs({
      done: 'Fires once a snap animation has been started on the element',
      failure: 'Fires when the snap never reached the element, because it has still not mounted'
    })
  }
};

export default createNodeFromReactComponent(DragNode);
