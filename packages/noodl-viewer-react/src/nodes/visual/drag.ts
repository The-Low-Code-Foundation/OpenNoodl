import { Drag } from '../../components/visual/Drag';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';

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
          this.innerReactComponentRef && this.innerReactComponentRef.snapToPositionX(snapPositionX, snapDurationX);
        });
      }
    },
    'snapToPositionX.value': {
      default: 0,
      group: 'Snap To Position X',
      displayName: 'Value',
      editorName: 'Value|Snap To Position X',
      type: 'number',
      set(value) {
        this._internal.snapPositionX = value;
      }
    },
    'snapToPositionX.duration': {
      default: 300,
      group: 'Snap To Position X',
      displayName: 'Duration',
      editorName: 'Duration|Snap To Position X',
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
      valueChangedToTrue() {
        this.scheduleAfterInputsHaveUpdated(() => {
          const { snapPositionY, snapDurationY } = this._internal;
          this.innerReactComponentRef && this.innerReactComponentRef.snapToPositionY(snapPositionY, snapDurationY);
        });
      }
    },
    'snapToPositionY.value': {
      default: 0,
      group: 'Snap To Position Y',
      displayName: 'Value',
      editorName: 'Value|Snap To Position Y',
      type: 'number',
      set(value) {
        this._internal.snapPositionY = value;
      }
    },
    'snapToPositionY.duration': {
      default: 300,
      group: 'Snap To Position Y',
      displayName: 'Duration',
      editorName: 'Duration|Snap To Position Y',
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
      type: 'boolean',
      default: true
    },
    axis: {
      group: 'Drag',
      displayName: 'Axis',
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
      type: 'boolean',
      default: true
    },
    inputPositionX: {
      displayName: 'Start Drag X',
      type: {
        name: 'number'
      }
    },
    inputPositionY: {
      displayName: 'Start Drag Y',
      type: {
        name: 'number'
      }
    },
    scale: {
      displayName: 'Scale',
      default: 1.0,
      type: {
        name: 'number'
      }
    }
  },
  outputProps: {
    onStart: {
      group: 'Signals',
      type: 'signal',
      displayName: 'Drag Started'
    },
    onStop: {
      group: 'Signals',
      type: 'signal',
      displayName: 'Drag Ended'
    },
    onDrag: {
      group: 'Signals',
      type: 'signal',
      displayName: 'Drag Moved'
    },
    positionX: {
      group: 'Values',
      displayName: 'Drag X',
      type: 'number'
    },
    positionY: {
      group: 'Values',
      displayName: 'Drag Y',
      type: 'number'
    },
    deltaX: {
      group: 'Values',
      displayName: 'Delta X',
      type: 'number'
    },
    deltaY: {
      group: 'Values',
      displayName: 'Delta Y',
      type: 'number'
    }
  }
};

export default createNodeFromReactComponent(DragNode);
