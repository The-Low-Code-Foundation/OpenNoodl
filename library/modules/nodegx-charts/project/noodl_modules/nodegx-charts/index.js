// @ts-check
/**
 * NodeGX Charts — a node kit that draws charts from an array.
 *
 * ── Why this is a kit and not two core nodes ────────────────────────────────
 *
 * Issue #39: *"the parts of my dashboard that were actually charts were the
 * parts that did not survive export."* There is no chart node, so a chart is
 * assembled out of Groups whose `width` or `height` is wired — and a wired
 * structure port is exactly what the React export refuses, because the
 * rendered shape is then not static.
 *
 * A kit node has no such problem, and the reason is worth knowing before you
 * edit this file. A kit node is `role: 'custom'`: the export dispatches it
 * before it ever asks a visual node's "is this structure static" question, so
 * it never reaches the refusal. Its wired inputs are emitted as ordinary React
 * props and its own code is copied into the exported repo and run there. The
 * chart below therefore runs the SAME source in the editor preview, in a
 * deploy, and in an exported Next.js app — one implementation, three places,
 * by construction rather than by three people keeping three copies in step.
 *
 * ⚠️ **The honest cost, and it is why this is a decision and not a fix:** a kit
 * is not in the node picker until somebody installs it. For anyone who has not,
 * *"there is no chart primitive"* is still true.
 *
 * ── The rule this file is written to follow ─────────────────────────────────
 *
 *   Ports are the product. JavaScript is the escape hatch.
 *
 * Every decision a person building a dashboard should be able to make is a
 * PORT: the colours, the spacing, the baseline, the ceiling, the labels. What
 * is deliberately NOT a port is any rule about what the numbers MEAN — no
 * thresholds, no "red when negative", no formatting. Those are decisions, they
 * belong in the graph where they are visible, and an Expression or Function
 * node makes them there.
 *
 * Colour and spacing ports default to design tokens rather than hex and pixels,
 * so a chart inherits the project's design system instead of fighting it.
 *
 * ── Two things this file deliberately does NOT use ──────────────────────────
 *
 * 1. **No `frame:`, and no `inputCss`.** Both would give the node the editor's
 *    shared Layout ports, which live in `inputCss` — and the export reads
 *    `inputProps` and `inputs` and *not* `inputCss` (`parse/kitSource.ts`
 *    `readDefinition`). A size set through a Layout port would therefore apply
 *    in the editor and be absent from the export: the same chart, two sizes.
 *    Size arrives on `chartHeight` / `chartWidth`, which are `inputProps`, so
 *    the two renders cannot disagree.
 * 2. **No measurement.** Nothing here reads a bounding box or installs a
 *    `ResizeObserver`. The bars are percentage heights in a flex row and the
 *    sparkline is a `viewBox` with `preserveAspectRatio="none"`, so both are
 *    correct at whatever width the box happens to be, on the first frame, with
 *    no layout pass to wait for. A chart that has to measure itself to be right
 *    is a chart that is wrong in a server-rendered page.
 */
(function () {
  // ✅ D19 — React is a global the runtime installs before this file runs. Read
  // it bare; never `window.React`. A server render (SSR/SSG) and a cloud
  // function have no `window`, so a kit that reaches for one throws at import,
  // is missing from the server-rendered HTML, and shows up only after the
  // browser hydrates — a mismatch that is silent unless you look for it.
  var h = React.createElement;

  // ── the one piece of shared reading ──────────────────────────────────────
  //
  // 🔴 Written once and used by both nodes on purpose. Two chart nodes that
  // each decided for themselves what "the numbers" are would eventually
  // disagree about a null, and the two charts on one dashboard would then
  // disagree about the same row. FLD-015 §4 AC5 is the same rule one level up:
  // two implementations of one piece of maths is the defect, not the tidy-up.

  /**
   * The numbers a `series` holds, in order.
   *
   * `series` is whatever the graph sent: a Static Data array, an Array node's
   * Items, a query result. Rows may be plain numbers or objects. `valueKey`
   * names the field when they are objects; when it is empty the row itself is
   * read as the number. Anything that is not a finite number becomes `null` —
   * a gap, not a zero, because a zero is a claim about the data and a gap is
   * a claim about our reading of it.
   *
   * @param {unknown} series
   * @param {string} valueKey
   * @returns {Array<number|null>}
   */
  function readNumbers(series, valueKey) {
    if (!Array.isArray(series)) return [];
    var key = typeof valueKey === 'string' ? valueKey.trim() : '';
    return series.map(function (row) {
      var raw = row;
      if (key !== '') {
        // An Object node's value lives under `.data`; a plain row is the object
        // itself. Reading only one of the two shapes is how a chart ends up
        // empty in front of somebody whose data is right there in the inspector.
        var bag = row && typeof row === 'object' && row.data && typeof row.data === 'object' ? row.data : row;
        raw = bag && typeof bag === 'object' ? bag[key] : undefined;
      }
      var n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      return isFinite(n) ? n : null;
    });
  }

  /**
   * The labels a `series` holds, in order — same rules, and `''` where there
   * is nothing to show.
   *
   * @param {unknown} series
   * @param {string} labelKey
   * @returns {string[]}
   */
  function readLabels(series, labelKey) {
    if (!Array.isArray(series)) return [];
    var key = typeof labelKey === 'string' ? labelKey.trim() : '';
    return series.map(function (row, i) {
      if (key === '') return String(i + 1);
      var bag = row && typeof row === 'object' && row.data && typeof row.data === 'object' ? row.data : row;
      var raw = bag && typeof bag === 'object' ? bag[key] : undefined;
      return raw === undefined || raw === null ? '' : String(raw);
    });
  }

  /**
   * The vertical extent to draw against.
   *
   * 🔴 **`autoScale` is a port and not a heuristic.** A chart that silently
   * decided its own ceiling would move every bar the day a new row arrived, and
   * nothing on the canvas would say why. With it off, `minValue`/`maxValue` are
   * exactly what they say; with it on, they are a floor and a ceiling the data
   * may WIDEN and never narrow.
   *
   * ⚠️ Both default to 0, which is why the shipped defaults read the way the
   * README says: baseline 0, and the largest number in the data at the top.
   * Measured, because it was wrong first — `maxValue` shipped at 100 for one
   * afternoon, and a revenue series of 32..67 drew its tallest bar at 67% of
   * the track while the README promised the top. A default is a claim about
   * every chart nobody configures, which is most of them.
   *
   * A flat series (every number equal) has no extent at all. `hi === lo` would
   * divide by zero, so the span becomes 1 and every bar is drawn at the top —
   * which is what a flat series looks like when it is read correctly.
   *
   * @param {Array<number|null>} numbers
   * @param {boolean} autoScale
   * @param {number} minValue
   * @param {number} maxValue
   * @returns {{ lo: number, hi: number }}
   */
  function extentOf(numbers, autoScale, minValue, maxValue) {
    var lo = Number(minValue);
    var hi = Number(maxValue);
    if (!isFinite(lo)) lo = 0;
    if (!isFinite(hi)) hi = 0;
    if (autoScale) {
      var present = numbers.filter(function (n) {
        return n !== null;
      });
      if (present.length > 0) {
        lo = Math.min.apply(null, present.concat([lo]));
        hi = Math.max.apply(null, present.concat([hi]));
      }
    }
    if (!(hi > lo)) hi = lo + 1;
    return { lo: lo, hi: hi };
  }

  /** Where `n` sits between `lo` and `hi`, as 0–1, clamped. */
  function fractionOf(n, lo, hi) {
    var f = (n - lo) / (hi - lo);
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }

  /**
   * The DOM handoff every visual kit node needs: it is what lets the editor
   * highlight this node on the canvas, and what the shared bounding-box
   * outputs measure. A hook, on purpose — if the page ever had a second React
   * this line would throw rather than misbehave quietly.
   *
   * ⚠️ `noodlNode` is absent in an exported app (the export's shim hands the
   * component its props and nothing else), which is why the call is guarded
   * rather than assumed.
   */
  function useNoodlElement(props) {
    var el = React.useRef(null);
    React.useEffect(function () {
      props.noodlNode && props.noodlNode.setDOMElement(el.current);
    }, []);
    return el;
  }

  /** The placeholder an empty series draws — never an empty box with no explanation. */
  function emptyState(props, ref, text) {
    return h(
      'div',
      {
        ref: ref,
        className: props.className,
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: props.chartHeight,
          color: props.labelColor,
          fontSize: props.labelSize
        },
        'data-chart-empty': ''
      },
      text
    );
  }

  // ── Bar Chart ────────────────────────────────────────────────────────────

  function BarChartComponent(props) {
    var el = useNoodlElement(props);
    var numbers = readNumbers(props.series, props.valueKey);
    var labels = readLabels(props.series, props.labelKey);

    if (numbers.length === 0) return emptyState(props, el, props.emptyText);

    var extent = extentOf(numbers, props.autoScale, props.minValue, props.maxValue);

    var bars = numbers.map(function (n, i) {
      // 🔴 The height is a PERCENTAGE of the track, not a pixel count. That is
      // what makes the bar right without measuring anything: the track is
      // `chartHeight` tall in both the editor and the export, and a percentage
      // of it needs no layout pass to be correct.
      var pct = n === null ? 0 : fractionOf(n, extent.lo, extent.hi) * 100;
      var onSelect = function () {
        if (props.onBarSelect) props.onBarSelect(i, n, labels[i]);
      };

      return h(
        'div',
        {
          key: i,
          style: { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch' },
          'data-chart-column': String(i)
        },
        h(
          'div',
          {
            style: {
              height: props.chartHeight,
              display: 'flex',
              alignItems: 'flex-end',
              backgroundColor: props.trackColor,
              borderRadius: props.barRadius
            }
          },
          h('div', {
            style: {
              width: '100%',
              height: pct + '%',
              backgroundColor: n === null ? 'transparent' : props.barColor,
              borderRadius: props.barRadius,
              cursor: props.onBarSelect ? 'pointer' : 'default'
            },
            onClick: onSelect,
            // Read by the drive, and by anybody debugging a chart whose bars
            // are the wrong height: the value the bar was drawn from is in the
            // DOM beside the height it was drawn at.
            'data-chart-bar': String(i),
            'data-chart-value': n === null ? '' : String(n)
          })
        ),
        props.showValues
          ? h(
              'div',
              {
                style: {
                  fontSize: props.labelSize,
                  color: props.valueColor,
                  textAlign: 'center',
                  marginTop: props.labelGap
                }
              },
              n === null ? '' : String(n)
            )
          : null,
        props.showLabels
          ? h(
              'div',
              {
                style: {
                  fontSize: props.labelSize,
                  color: props.labelColor,
                  textAlign: 'center',
                  marginTop: props.labelGap,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                },
                'data-chart-label': String(i)
              },
              labels[i]
            )
          : null
      );
    });

    return h(
      'div',
      {
        ref: el,
        className: props.className,
        style: { display: 'flex', alignItems: 'flex-end', gap: props.barGap, width: '100%' },
        'data-chart': 'bar'
      },
      bars
    );
  }

  /** @type {import('./types/node-kit').ReactNodeDefinition} */
  var BarChart = {
    name: 'nodegx.charts.BarChart',
    displayNodeName: 'Bar Chart',
    docs: 'Draws one bar per row of an array. Feed it a Static Data node, an Array, or a query result, and set Value Key to the field holding the number.',
    color: 'visual',
    allowChildren: false,
    noodlNodeAsProp: true,
    usePortAsLabel: 'valueKey',

    getReactComponent: function () {
      return BarChartComponent;
    },

    initialize: function () {
      var self = this;
      this._internal.selectedIndex = -1;
      this._internal.selectedValue = 0;
      this._internal.selectedLabel = '';
      // Installed onto `props` rather than declared in `outputProps` because
      // one click has to publish three values AND fire a signal, and the order
      // matters: a graph that reads Selected Value off the signal must find the
      // new value already there.
      this.props.onBarSelect = function (index, value, label) {
        self._internal.selectedIndex = index;
        self._internal.selectedValue = value === null ? 0 : value;
        self._internal.selectedLabel = label === undefined || label === null ? '' : String(label);
        self.flagOutputDirty('selectedIndex');
        self.flagOutputDirty('selectedValue');
        self.flagOutputDirty('selectedLabel');
        self.sendSignalOnOutput('barSelected');
      };
    },

    inputProps: {
      series: {
        type: 'array',
        displayName: 'Series',
        group: 'Data',
        description: 'The rows to draw. Wire a Static Data, an Array or a query result here.'
      },
      valueKey: {
        type: 'string',
        displayName: 'Value Key',
        group: 'Data',
        default: '',
        description: 'Which field on each row holds the number. Leave empty when the rows are plain numbers.'
      },
      labelKey: {
        type: 'string',
        displayName: 'Label Key',
        group: 'Data',
        default: '',
        description: 'Which field holds the label under each bar. Empty numbers them 1, 2, 3.'
      },

      autoScale: {
        type: 'boolean',
        displayName: 'Auto Scale',
        group: 'Scale',
        default: true,
        description: 'Take the ceiling from the data. Turn it off to pin the scale so two charts can be compared.'
      },
      minValue: {
        type: 'number',
        displayName: 'Baseline',
        group: 'Scale',
        default: 0,
        description: 'The value a zero-height bar stands for. With Auto Scale on this is a floor, not the floor.'
      },
      maxValue: {
        type: 'number',
        displayName: 'Ceiling',
        group: 'Scale',
        default: 0,
        description:
          'The value a full-height bar stands for. Leave it at 0 with Auto Scale on and the ' +
          'largest number in the data becomes the ceiling; set it to pin the scale.'
      },

      chartHeight: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Chart Height',
        group: 'Style',
        default: 160
      },
      barColor: { type: 'color', displayName: 'Bar Colour', group: 'Style', default: 'var(--primary)' },
      trackColor: { type: 'color', displayName: 'Track Colour', group: 'Style', default: 'transparent' },
      barGap: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Bar Gap',
        group: 'Style',
        default: 'var(--space-2)'
      },
      barRadius: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Bar Radius',
        group: 'Style',
        default: 'var(--radius-sm)'
      },

      showLabels: { type: 'boolean', displayName: 'Show Labels', group: 'Labels', default: true },
      showValues: { type: 'boolean', displayName: 'Show Values', group: 'Labels', default: false },
      labelColor: { type: 'color', displayName: 'Label Colour', group: 'Labels', default: 'var(--muted-foreground)' },
      valueColor: { type: 'color', displayName: 'Value Colour', group: 'Labels', default: 'var(--foreground)' },
      labelSize: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Label Size',
        group: 'Labels',
        default: 'var(--text-xs)'
      },
      labelGap: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Label Gap',
        group: 'Labels',
        default: 'var(--space-1)'
      },
      emptyText: {
        type: 'string',
        displayName: 'Empty Text',
        group: 'Labels',
        default: 'No data',
        description: 'Shown instead of an empty box when the series has no rows.'
      }
    },

    outputs: {
      selectedIndex: {
        type: 'number',
        displayName: 'Selected Index',
        group: 'Selection',
        get: function () {
          return this._internal.selectedIndex;
        }
      },
      selectedValue: {
        type: 'number',
        displayName: 'Selected Value',
        group: 'Selection',
        get: function () {
          return this._internal.selectedValue;
        }
      },
      selectedLabel: {
        type: 'string',
        displayName: 'Selected Label',
        group: 'Selection',
        get: function () {
          return this._internal.selectedLabel;
        }
      },
      barSelected: { type: 'signal', displayName: 'Bar Selected', group: 'Selection' }
    }
  };

  // ── Sparkline ────────────────────────────────────────────────────────────

  function SparklineComponent(props) {
    var el = useNoodlElement(props);
    var numbers = readNumbers(props.series, props.valueKey);

    if (numbers.length === 0) return emptyState(props, el, props.emptyText);

    var extent = extentOf(numbers, props.autoScale, props.minValue, props.maxValue);

    // 🔴 A 0–100 viewBox with `preserveAspectRatio="none"`, and every stroked
    // element carrying `vectorEffect="non-scaling-stroke"`. That pair is what
    // lets the line be correct at any box size without measuring the box: the
    // geometry stretches and the stroke does not, so a sparkline in a 600px
    // column and the same one in a 90px cell are the same line at the same
    // weight. Drop the vectorEffect and the stroke stretches with the
    // geometry — the line goes fat horizontally and thin vertically, which
    // reads as a rendering bug and is really a missing attribute.
    var span = numbers.length > 1 ? numbers.length - 1 : 1;
    var points = [];
    numbers.forEach(function (n, i) {
      if (n === null) return; // a gap, not a zero — see `readNumbers`
      var x = (i / span) * 100;
      var y = 100 - fractionOf(n, extent.lo, extent.hi) * 100;
      points.push({ x: x, y: y, value: n, index: i });
    });

    if (points.length === 0) return emptyState(props, el, props.emptyText);

    var line = points
      .map(function (p) {
        return p.x.toFixed(3) + ',' + p.y.toFixed(3);
      })
      .join(' ');

    var children = [];
    if (props.fillColor && props.fillColor !== 'transparent') {
      children.push(
        h('polygon', {
          key: 'fill',
          points: points[0].x.toFixed(3) + ',100 ' + line + ' ' + points[points.length - 1].x.toFixed(3) + ',100',
          fill: props.fillColor,
          stroke: 'none'
        })
      );
    }
    children.push(
      h('polyline', {
        key: 'line',
        points: line,
        fill: 'none',
        stroke: props.lineColor,
        strokeWidth: props.lineWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        vectorEffect: 'non-scaling-stroke',
        'data-chart-line': ''
      })
    );
    if (props.showDots) {
      points.forEach(function (p) {
        children.push(
          // 🔴 A `<line>` of zero length, not a `<circle>`. A circle's `r` is in
          // viewBox units, and this viewBox is stretched — so the dot would be
          // an ellipse the moment the box is not square, and `vectorEffect`
          // cannot fix a radius (it only spares the stroke). A zero-length
          // stroked segment with a round cap IS a circle, in stroke units,
          // which the non-scaling stroke keeps round at any box shape.
          h('line', {
            key: 'dot' + p.index,
            x1: p.x.toFixed(3),
            y1: p.y.toFixed(3),
            x2: p.x.toFixed(3),
            y2: p.y.toFixed(3),
            stroke: props.dotColor,
            strokeWidth: Number(String(props.lineWidth).replace('px', '')) * 2.5 || 5,
            strokeLinecap: 'round',
            vectorEffect: 'non-scaling-stroke',
            'data-chart-dot': String(p.index),
            'data-chart-value': String(p.value)
          })
        );
      });
    }

    return h(
      'div',
      {
        ref: el,
        className: props.className,
        style: { width: props.chartWidth, height: props.chartHeight },
        'data-chart': 'sparkline'
      },
      h(
        'svg',
        {
          width: '100%',
          height: '100%',
          viewBox: '0 0 100 100',
          preserveAspectRatio: 'none',
          style: { display: 'block', overflow: 'visible' }
        },
        children
      )
    );
  }

  /** @type {import('./types/node-kit').ReactNodeDefinition} */
  var Sparkline = {
    name: 'nodegx.charts.Sparkline',
    displayNodeName: 'Sparkline',
    docs: 'Draws one line through an array of numbers. No axes and no labels — a shape, for beside a number.',
    color: 'visual',
    allowChildren: false,
    noodlNodeAsProp: true,
    usePortAsLabel: 'valueKey',

    getReactComponent: function () {
      return SparklineComponent;
    },

    inputProps: {
      series: {
        type: 'array',
        displayName: 'Series',
        group: 'Data',
        description: 'The rows to draw. Wire a Static Data, an Array or a query result here.'
      },
      valueKey: {
        type: 'string',
        displayName: 'Value Key',
        group: 'Data',
        default: '',
        description: 'Which field on each row holds the number. Leave empty when the rows are plain numbers.'
      },

      autoScale: { type: 'boolean', displayName: 'Auto Scale', group: 'Scale', default: true },
      minValue: { type: 'number', displayName: 'Baseline', group: 'Scale', default: 0 },
      maxValue: { type: 'number', displayName: 'Ceiling', group: 'Scale', default: 0 },

      chartWidth: {
        type: { name: 'number', units: ['px', '%'], defaultUnit: 'px' },
        displayName: 'Chart Width',
        group: 'Style',
        default: 120
      },
      chartHeight: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Chart Height',
        group: 'Style',
        default: 32
      },
      lineColor: { type: 'color', displayName: 'Line Colour', group: 'Style', default: 'var(--primary)' },
      lineWidth: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Line Width',
        group: 'Style',
        default: 2
      },
      fillColor: {
        type: 'color',
        displayName: 'Fill Colour',
        group: 'Style',
        default: 'transparent',
        description: 'Fills the area under the line. Leave transparent for a bare line.'
      },
      showDots: { type: 'boolean', displayName: 'Show Dots', group: 'Style', default: false },
      dotColor: { type: 'color', displayName: 'Dot Colour', group: 'Style', default: 'var(--primary)' },

      labelColor: { type: 'color', displayName: 'Empty Text Colour', group: 'Labels', default: 'var(--muted-foreground)' },
      labelSize: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Empty Text Size',
        group: 'Labels',
        default: 'var(--text-xs)'
      },
      emptyText: { type: 'string', displayName: 'Empty Text', group: 'Labels', default: '—' }
    }
  };

  /** @type {import('./types/node-kit').NodeKitModule} */
  var kit = {
    reactNodes: [BarChart, Sparkline]
  };

  Noodl.defineModule(kit);
})();
