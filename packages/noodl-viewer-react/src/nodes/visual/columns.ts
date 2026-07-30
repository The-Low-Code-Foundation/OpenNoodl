import { Columns } from '../../components/visual/Columns';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';

const ColumnsNode: ReactNodeDefinition = {
  name: 'net.noodl.visual.columns',
  displayName: 'Columns',
  docs: 'https://docs.noodl.net/nodes/basic-elements/columns',
  allowChildren: true,
  noodlNodeAsProp: true,
  connectionPanel: {
    groupPriority: [
      'General',
      'Style',
      'Actions',
      'Events',
      'States',
      'Mounted',
      'Label',
      'Label Text Style',
      'Hover Events',
      'Pointer Events',
      'Focus Events'
    ]
  },

  initialize() {
    this.props.layoutString = '1 2 1';
    this.props.minWidth = 0;
    this.props.marginX = 16;
    this.props.marginY = 16;
    this.props.direction = 'row';
    this.props.justifyContent = 'flex-start';
  },

  getReactComponent() {
    return Columns;
  },

  inputs: {
    layoutString: {
      group: 'Layout Settings',
      displayName: 'Layout String',
      type: 'string',
      default: '1 2 1',
      set(value) {
        this.props.layoutString = value;

        if (typeof value !== 'string') {
          this.context.editorConnection.sendWarning(
            this.nodeScope.componentOwner.name,
            this.id,
            'layout-type-warning',
            {
              message: 'Layout String needs to be a string.'
            }
          );
        } else {
          this.context.editorConnection.clearWarning(
            this.nodeScope.componentOwner.name,
            this.id,
            'layout-type-warning'
          );
        }

        this.forceUpdate();
      }
    }
  },

  inputProps: {
    // NDA-006 §3. Auto Fit is the one-input answer — "columns at least this wide, as many as
    // fit" — and covers most real layouts without any breakpoint to manage. The breakpoint
    // pair below covers the rest. Default stays `layoutString`, so nothing moves until asked.
    sizing: {
      group: 'Layout Settings',
      displayName: 'Column Sizing',
      type: {
        name: 'enum',
        enums: [
          { label: 'Layout String', value: 'layoutString' },
          { label: 'Auto Fit', value: 'autoFit' }
        ]
      },
      default: 'layoutString'
    },
    // Container width, not viewport width — see `pickBreakpointLayout`. A breakpoint with no
    // layout beside it does nothing, so half-configuring these is inert rather than surprising.
    mediumBreakpoint: {
      group: 'Breakpoints',
      displayName: 'Medium Below',
      type: { name: 'number', units: ['px'], defaultUnit: 'px' }
    },
    mediumLayout: {
      group: 'Breakpoints',
      displayName: 'Medium Layout',
      type: 'string'
    },
    smallBreakpoint: {
      group: 'Breakpoints',
      displayName: 'Small Below',
      type: { name: 'number', units: ['px'], defaultUnit: 'px' }
    },
    smallLayout: {
      group: 'Breakpoints',
      displayName: 'Small Layout',
      type: 'string'
    },
    marginX: {
      group: 'Layout Settings',
      displayName: 'Horizontal Gap',
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      default: 16
    },
    marginY: {
      group: 'Layout Settings',
      displayName: 'Vertical Gap',
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      default: 16
    },
    minWidth: {
      group: 'Constraints',
      displayName: 'Min Column Width',
      type: {
        name: 'number',
        units: ['px'],
        defaultUnit: 'px'
      },
      default: 0
    },
    direction: {
      group: 'Layout Settings',
      displayName: 'Layout Direction',
      type: {
        name: 'enum',
        enums: [
          {
            label: 'Horizontal',
            value: 'row'
          },
          {
            label: 'Vertical',
            value: 'column'
          }
        ]
      },
      default: 'row'
    },
    justifyContent: {
      group: 'Justify Content',
      displayName: 'Justify Content',
      type: {
        name: 'enum',
        enums: [
          { label: 'Start', value: 'flex-start' },
          { label: 'End', value: 'flex-end' },
          { label: 'Center', value: 'center' }
        ],
        alignComp: 'align-items'
      },
      default: 'flex-start'
    }
  }
};

export default createNodeFromReactComponent(ColumnsNode);
