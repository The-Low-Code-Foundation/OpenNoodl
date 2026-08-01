import { Columns } from '../../components/visual/Columns';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';
import { createTooltip } from '../../tooltips';

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
      description: 'Column widths as space-separated proportions, so "1 2 1" makes the middle column twice as wide',
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
      description: 'Layout String sets the columns explicitly; Auto Fit derives them from Min Column Width and the space available',
      type: {
        name: 'enum',
        enums: [
          { label: 'Layout String', value: 'layoutString' },
          { label: 'Auto Fit', value: 'autoFit' }
        ]
      },
      default: 'layoutString'
    },
    // NDA-006 §4. Separate from `Column Sizing` on purpose: packing is not a way of deciding how
    // many columns there are, it is what happens to the items once they have one. So masonry
    // composes with `Auto Fit` and with the breakpoints below instead of competing with them —
    // an item is in column `i % columnAmount` and is exactly as wide either way, and Masonry only
    // stops each wrap line from aligning to the tallest item in it. Ordering stays row-major as
    // authored; see `computeMasonryOffsets` for what that rules out.
    packing: {
      group: 'Layout Settings',
      displayName: 'Item Packing',
      description: 'Rows makes every item in a row as tall as the tallest; Masonry lets each column pack independently',
      type: {
        name: 'enum',
        enums: [
          { label: 'Rows', value: 'rows' },
          { label: 'Masonry', value: 'masonry' }
        ]
      },
      default: 'rows',
      // Criterion 4 asks for the ordering to be documented. An author reading the panel is where
      // that has to land, so it is here rather than only in a commit message.
      tooltip: {
        rows: {
          standard: 'Every item in a row is as tall as the tallest one in it',
          extended: createTooltip({
            title: 'Rows',
            body: 'Items fill left to right and wrap. Each row is as tall as its tallest item, so rows line up.'
          })
        },
        masonry: {
          standard: 'Items keep their own height and each column packs independently',
          extended: createTooltip({
            title: 'Masonry',
            body:
              'Items still fill left to right — item 1 goes in the first column, item 2 in the second, and so ' +
              'on — but each column stacks its own items with no gaps, so nothing waits for the tallest item ' +
              'in its row. Columns are not made equal in height; the reading order is kept instead.'
          })
        }
      }
    },
    // Container width, not viewport width — see `pickBreakpointLayout`. A breakpoint with no
    // layout beside it does nothing, so half-configuring these is inert rather than surprising.
    mediumBreakpoint: {
      group: 'Breakpoints',
      displayName: 'Medium Below',
      description: 'Container width below which Medium Layout replaces Layout String; this is the container, not the viewport',
      type: { name: 'number', units: ['px'], defaultUnit: 'px' }
    },
    mediumLayout: {
      group: 'Breakpoints',
      displayName: 'Medium Layout',
      description: 'Layout String to use below Medium Below; leaving it blank makes the breakpoint inert',
      type: 'string'
    },
    smallBreakpoint: {
      group: 'Breakpoints',
      displayName: 'Small Below',
      description: 'Container width below which Small Layout replaces the others; it wins over Medium Below',
      type: { name: 'number', units: ['px'], defaultUnit: 'px' }
    },
    smallLayout: {
      group: 'Breakpoints',
      displayName: 'Small Layout',
      description: 'Layout String to use below Small Below; leaving it blank makes the breakpoint inert',
      type: 'string'
    },
    marginX: {
      group: 'Layout Settings',
      displayName: 'Horizontal Gap',
      description: 'Space between columns, drawn as a gutter rather than as padding on the items',
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
      description: 'Space between rows',
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
      description: 'Columns are dropped from the end rather than shrink below this; with Auto Fit it decides how many there are',
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
      description: 'Whether items fill across rows or down columns',
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
      description: 'Where the columns sit as a group when they do not fill the container',
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
