import { Columns } from '../../components/visual/Columns';
import { readLayoutToken } from '../../components/visual/Columns/Columns';
import { createNodeFromReactComponent, type ReactNodeDefinition } from '../../react-component-node';
import { createTooltip } from '../../tooltips';

/**
 * NDA-012 (Visual) D1 — the bare-string half of the Columns contract.
 *
 * A layout string is space-separated proportions, and every entry that is not a positive number
 * is **dropped** by `parseLayout`. So `'1 a 1'` is three columns as authored and two as
 * rendered, with nothing said about the difference: the setter validated only that the value
 * *was a string*.
 *
 * ⚠️ The worksheet cell recorded the consequence as "`'1 a 1'` yields a `NaN` column". That was
 * true when it was filed and is not now — NDA-006's autofold pass added the finite-check to
 * `parseLayout`, which converted a visible `NaN` into a silent drop. The defect survived the
 * fix that changed its symptom, which is why the cell reads wrong today. Re-derived, not
 * inherited.
 *
 * Returns the human half of the diagnosis, or `undefined` when the string is wholly usable.
 */
export function describeLayoutString(value: string): string | undefined {
  // A double space splits to an empty entry and means nothing; it is not a mistake worth
  // reporting, and `parseLayout` drops it silently on purpose.
  const tokens = value.split(' ').filter((token) => token !== '');

  if (tokens.length === 0) {
    return 'it has no entries, so one full-width column is rendered';
  }

  const unusable = tokens.filter((token) => readLayoutToken(token) === undefined);
  if (unusable.length === 0) return undefined;

  const listed = unusable.map((token) => JSON.stringify(token)).join(', ');

  if (unusable.length === tokens.length) {
    return `none of its ${tokens.length} entries is a positive number (${listed}), so one full-width column is rendered instead`;
  }

  const rendered = tokens.length - unusable.length;
  return (
    `${listed} ${unusable.length === 1 ? 'is not a positive number and is' : 'are not positive numbers and are'} dropped, ` +
    `so ${tokens.length} columns were authored and ${rendered} ${rendered === 1 ? 'is' : 'are'} rendered`
  );
}

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
        this.revalidateLayoutStrings();
        this.forceUpdate();
      }
    }
  },

  methods: {
    /**
     * NDA-012 (Visual) D1 / B2. Re-check all three layout strings and report once.
     *
     * Two things changed here. The diagnosis is now **the drop**, not the type — a string that
     * *is* a string can still lose columns — and it is raised on the runtime error bus
     * (`FAILURE-CONTRACT.md`) rather than sent straight to `editorConnection.sendWarning`, so
     * it survives into a deployed app, SSR and export instead of vanishing at the moment it
     * starts to matter.
     *
     * All three ports are re-read on every change rather than each reporting for itself. The
     * bus keys an editor warning by `code`, so three ports raising the same code would occupy
     * one slot and fixing any one of them would clear the other two's warning. One code, one
     * combined message, one clear.
     */
    revalidateLayoutStrings() {
      const ports: [string, unknown][] = [
        ['Layout String', this.props.layoutString],
        ['Medium Layout', this.props.mediumLayout],
        ['Small Layout', this.props.smallLayout]
      ];

      const problems: string[] = [];
      for (const [displayName, value] of ports) {
        // A blank breakpoint layout is a port with no opinion, not a mistake — the port's own
        // description says leaving it blank makes the breakpoint inert. Empty-Value Contract:
        // abstain rather than report.
        if (value === undefined || value === null || value === '') continue;

        if (typeof value !== 'string') {
          problems.push(`${displayName} is ${typeof value}, not a string`);
          continue;
        }

        const problem = describeLayoutString(value);
        if (problem) problems.push(`${displayName} (${JSON.stringify(value)}): ${problem}`);
      }

      const code = 'columns/layout-string-invalid';

      if (problems.length === 0) {
        // Keep the editor's clear path. The bus has no "un-raise", and without this a layout
        // string that was briefly wrong while being typed would leave a warning behind for the
        // rest of the session.
        const editorConnection = this.context && this.context.editorConnection;
        if (editorConnection && editorConnection.clearWarning) {
          editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, code);
        }
        return;
      }

      this.raiseRuntimeError(
        code,
        `Columns cannot read every entry of its layout — ${problems.join('; ')}. Entries are space-separated positive numbers, so "1 2 1" makes three columns with a double-width middle one.`
      );
    }
  },

  /**
   * FLD-002 (#22) — the breakpoint the node is at, as ports.
   *
   * The state was computed and unreadable: `pickBreakpointLayout` has always known which of the
   * three layout strings it chose, and nothing outside the component could ask. The workaround
   * in the field was a States node keyed off `boundingWidth`, which re-derives the thresholds by
   * hand in the graph — a second copy of the breakpoints that drifts the moment either port is
   * edited, and one that reads the *bounding* width where the node folds on the *container* width
   * (FLD-001's second half: those differ by one gutter).
   *
   * `outputProps`, not `outputs`: these are values the React component produces, and the
   * machinery in `react-component-node.ts` installs each one as a prop — a plain call for a
   * signal, a `flagOutputDirty` write for a value. The precedent is `group.ts`'s scroll trio,
   * which is the same shape: one number the component publishes plus two pulses beside it.
   *
   * All three sit in `Breakpoints`, beside the four inputs they report on, so the panel reads as
   * one feature rather than as settings in one place and readings in another.
   */
  outputProps: {
    onBreakpointChanged: {
      displayName: 'Breakpoint',
      description:
        'Which layout is in force: Default, Medium or Small. It is Default until the node has been measured, and while Column Sizing is Auto Fit, where no layout string is used',
      type: 'string',
      group: 'Breakpoints'
    },
    onAtMedium: {
      displayName: 'At Medium',
      description: 'Fires when the container narrows or widens into the Medium band, once per crossing',
      type: 'signal',
      group: 'Breakpoints'
    },
    onAtSmall: {
      displayName: 'At Small',
      description: 'Fires when the container narrows or widens into the Small band, once per crossing',
      type: 'signal',
      group: 'Breakpoints'
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
      type: 'string',
      // D1: the breakpoint layouts are the same bare-string contract as `layoutString` and go
      // through the same `parseLayout`, so they drop entries the same silent way. `onChange`,
      // not `set` — on `inputProps` the setter is generated and writing one would stop the
      // value reaching the prop at all (`react-component-node.ts:46-48`).
      onChange() {
        this.revalidateLayoutStrings();
      }
    },
    smallBreakpoint: {
      group: 'Breakpoints',
      displayName: 'Small Below',
      description: 'Container width below which Small Layout replaces the others; it wins over Medium Below',
      type: { name: 'number', units: ['px'], defaultUnit: 'px' }
    },
    // FLD-003 (#22), and it is the whole of that issue's first half. Two bands is
    // where this node stops, and the answer to "I need more" is deliberately NOT a
    // third pair of ports — #22 asked for it and then argued against it in the same
    // breath ("adding a hundred new fields to the Columns node isn't the right way
    // to go about this"). It is a prefab that drives THESE inputs from a States
    // node, and the one place a person is standing when they want it is this port.
    //
    // The pointer is the port's own text, so it reaches three surfaces from one
    // edit: the panel tooltip below, the generated node catalog, and the MCP
    // authoring loop that reads it. `library/prefabs/advanced-columns/` is the
    // other half; `fld003-advanced-columns-pointer.test.ts` fails if either end
    // of that pair moves without the other.
    smallLayout: {
      group: 'Breakpoints',
      displayName: 'Small Layout',
      description:
        'Layout String to use below Small Below; leaving it blank makes the breakpoint inert. ' +
        'For more bands than these two, install the Advanced Columns prefab from the library — it ' +
        'drives these same inputs from a States node, so each band can set its own layout and gaps',
      type: 'string',
      tooltip: createTooltip({
        title: 'More than two breakpoints',
        body: [
          'Medium and Small are the two this node has. They swap the layout string and nothing else.',
          'For a third band, or for a different gap at each one, install the <b>Advanced Columns</b> ' +
            'prefab from the library — Prefabs tab of the node picker. It is a Columns node with a ' +
            'States node wired into these same inputs, shipped with four bands already set up, and ' +
            'you add or change a band by editing that States node.'
        ]
      }),
      onChange() {
        this.revalidateLayoutStrings();
      }
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
