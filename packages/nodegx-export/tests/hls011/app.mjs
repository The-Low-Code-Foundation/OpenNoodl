/**
 * HLS-011 — the app the drive authors, as one source of truth.
 *
 * Two shapes are here on purpose, because two earlier tasks in this phase found defects in them:
 *
 *  - an `Expression` doing arithmetic on a **component input** (HLS-004 / issue #24: the exporter's
 *    own wrapper emitted `TS18048: possibly undefined` and the export did not build);
 *  - a **component input wired to a `width`** (HLS-005 / issue #23: a sink in neither the style
 *    table nor the content table fell through both, silently, and the report said
 *    *"nothing left over"*).
 *
 * The readings are chosen so that every number on the page is unique and none of them is a number
 * the graph also contains literally: `reading * 4 + 2` over 6, 11 and 3 gives 26, 46, 14. A page
 * that showed `6` would be showing the input; a page that showed `26` has run the arithmetic.
 */

export const HOME_HEADING = 'Kettle Log — every boil, counted';
export const READINGS_HEADING = 'Readings, most recent first';
export const HOME_TITLE = 'Kettle Log';
export const READINGS_TITLE = 'Readings';

/** label → [reading, barWidth, expected `reading * 4 + 2`] */
export const GAUGES = {
  Morning: [6, 120, 26],
  Evening: [11, 200, 46],
  Latest: [3, 64, 14]
};

export const EXPRESSION = 'reading * 4 + 2';

export const GAUGE = {
  path: 'Components/Gauge',
  nodes: [
    {
      id: 'gauge_inputs',
      type: 'Component Inputs',
      ports: [
        { name: 'label', plug: 'output', type: 'string' },
        { name: 'reading', plug: 'output', type: 'number' },
        { name: 'barWidth', plug: 'output', type: 'number' }
      ]
    },
    { id: 'gauge_root', type: 'Group', parameters: { flexDirection: 'column' } },
    { id: 'gauge_label', type: 'Text', parent: 'gauge_root', parameters: { text: '', cssClassName: 'gauge-label' } },
    { id: 'gauge_total', type: 'Text', parent: 'gauge_root', parameters: { text: '', cssClassName: 'gauge-total' } },
    {
      id: 'gauge_bar',
      type: 'Group',
      parent: 'gauge_root',
      parameters: { cssClassName: 'gauge-bar', backgroundColor: '#3355ff', height: { value: 8, unit: 'px' } }
    },
    { id: 'gauge_expr', type: 'Expression', parameters: { expression: EXPRESSION } }
  ],
  connections: [
    { fromId: 'gauge_inputs', fromProperty: 'label', toId: 'gauge_label', toProperty: 'text' },
    { fromId: 'gauge_inputs', fromProperty: 'reading', toId: 'gauge_expr', toProperty: 'reading' },
    { fromId: 'gauge_expr', fromProperty: 'result', toId: 'gauge_total', toProperty: 'text' },
    // HLS-005's shape: a component input reaching a dimension port.
    { fromId: 'gauge_inputs', fromProperty: 'barWidth', toId: 'gauge_bar', toProperty: 'width' }
  ],
  visual_roots: ['gauge_root']
};

const gaugeInstance = (id, parent, label) => ({
  id,
  type: '/Components/Gauge',
  parent,
  parameters: { label, reading: GAUGES[label][0], barWidth: GAUGES[label][1] }
});

export const HOME = {
  path: 'Pages/Home',
  nodes: [
    { id: 'home_page', type: 'Page', parameters: { title: HOME_TITLE, urlPath: 'home' } },
    { id: 'home_heading', type: 'Text', parent: 'home_page', parameters: { text: HOME_HEADING, cssClassName: 'home-heading' } },
    gaugeInstance('home_morning', 'home_page', 'Morning'),
    gaugeInstance('home_evening', 'home_page', 'Evening')
  ]
};

export const READINGS = {
  path: 'Pages/Readings',
  nodes: [
    { id: 'readings_page', type: 'Page', parameters: { title: READINGS_TITLE, urlPath: 'readings' } },
    {
      id: 'readings_heading',
      type: 'Text',
      parent: 'readings_page',
      parameters: { text: READINGS_HEADING, cssClassName: 'readings-heading' }
    },
    gaugeInstance('readings_latest', 'readings_page', 'Latest')
  ]
};

/**
 * What must be readable on each page, whoever drew it.
 *
 * 🔴 The totals are here and the readings are not. `26` can only appear if the `Expression` ran;
 * `6` would appear if the input were rendered raw, which is the failure this is meant to catch.
 */
export const EXPECTED = {
  home: [HOME_HEADING, 'Morning', 'Evening', '26', '46'],
  readings: [READINGS_HEADING, 'Latest', '14']
};

export const SCOPE = {
  name: 'Kettle Log',
  request: 'A log of kettle boils with a reading gauge per entry, for the HLS-011 end-to-end drive.',
  summary: 'Two pages that show gauge readings, authored entirely over MCP with no editor running.',
  audience: 'The HLS-011 drive, and anyone reading what a headless build produces.',
  pages: [
    { name: 'Home', purpose: 'The day so far: one gauge per boil.' },
    { name: 'Readings', purpose: 'Every reading, most recent first.' }
  ],
  backend: { kind: 'none', description: 'Nothing is stored; the readings are authored into the graph.' },
  outOfScope: ['Any backend', 'Any authentication', 'Any persistence'],
  agreed: true
};
