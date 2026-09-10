#!/usr/bin/env node
/**
 * FLD-012 — the fixture the empty-box warning is graded on.
 *
 * [#32](https://github.com/The-Low-Code-Foundation/NodeGX/issues/32) reported
 * `empty-decorated-box` firing on a 24x24 radio and a 16x16 slider thumb, on five of ten pages,
 * *purely for containing a control*. This writes the smallest project that reproduces that and,
 * on a second page, the thing a suppression would break.
 *
 * 🔴 **Two pages, and the second one is the point.** AC1's page is the controls and nothing else,
 * so a correct rule reports zero on it. AC2's page is those same controls PLUS one genuinely
 * empty decorated Group an author left behind — which a rule that suppresses too much would also
 * swallow. Both pages are in ONE project so `render_report`, which photographs every routed page,
 * grades both in a single run: AC1 cannot be satisfied by deleting the rule, because AC2 is
 * measured on the same render.
 *
 * The controls are the real ones, not markup that looks like them, because the defect lives in
 * their shipped DOM:
 *
 *   - `RadioButton.tsx:87-95` renders `<input type="radio" class="ndl-controls-radio-2">`, which
 *     `assets/style.css:86-90` makes `opacity: 0; position: absolute`. It is 24x24, has no
 *     children and no text, and `offsetParent` is not null — so `visible` keeps it and the rule
 *     fires on an element nobody can see.
 *   - `Slider.tsx:172-176` renders the track and the thumb as PLAIN unclassed `<div>`s, siblings
 *     of the range input. No class, no `appearance: none`, not a form control — so #32's own
 *     suggested discriminator (`closest('[class*="ndl-controls-"]')`) misses both of them.
 *
 * Regenerate:  node dev-docs/tasks/phase-84-the-defects-the-field-report-found/demo/build-fld-012.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ⚠️ Colours here are literal hex, deliberately, and this is the one place in the repo where that
// is right. The fixture carries no design-token set, so every 'var(--token)' resolves to nothing —
// measured: the slider thumb never fired the rule at all because 'thumbColor' rendered transparent,
// which would have made the fixture look like it proved something it never exercised. A rule about
// what is DRAWN has to be graded on a page that actually draws.
const OUT = path.join(__dirname, 'fld-012');
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const CATALOG = require(path.join(REPO, 'packages/noodl-types/src/node-catalog.json'));
const VISUAL = new Set(CATALOG.nodes.filter((n) => n.isVisual).map((n) => n.typeName));
const drawsSomething = (node) => VISUAL.has(node.type) || node.type.startsWith('/');

const uuid = (s) => {
  const h = crypto.createHash('md5').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const stamp = '2026-09-10T00:00:00.000Z';
const registry = {};

function writeComponent(compPath, nodes, connections) {
  const dir = path.join(OUT, 'components', compPath);
  fs.mkdirSync(dir, { recursive: true });
  const id = uuid(compPath);
  const conns = connections || [];
  const visualRoots = nodes.filter((n) => !n.parent && drawsSomething(n)).map((n) => n.id);
  fs.writeFileSync(
    path.join(dir, 'component.json'),
    JSON.stringify(
      {
        $schema: 'https://opennoodl.dev/schemas/component-v2.json',
        id,
        name: compPath.split('/').pop(),
        path: '/' + compPath,
        type: 'visual',
        created: stamp,
        modified: stamp,
        modifiedBy: 'fld-012'
      },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(dir, 'nodes.json'),
    JSON.stringify(
      { $schema: 'https://opennoodl.dev/schemas/nodes-v2.json', componentId: id, version: 1, nodes, visualRoots },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(dir, 'connections.json'),
    JSON.stringify(
      { $schema: 'https://opennoodl.dev/schemas/connections-v2.json', componentId: id, version: 1, connections: conns },
      null,
      2
    ) + '\n'
  );
  registry[compPath] = {
    path: compPath,
    type: 'visual',
    nodeCount: nodes.length,
    connectionCount: conns.length,
    modified: stamp,
    created: stamp
  };
}

/**
 * The shell every page shares. It has a background and it has children, so it is never itself an
 * empty box — the rule's first test is `el.children.length !== 0`.
 */
const shell = (id, children) => ({
  id,
  type: 'Group',
  label: 'Shell',
  parameters: {
    width: { value: 100, unit: '%' },
    sizeMode: 'contentHeight',
    flexDirection: 'column',
    rowGap: '24px',
    paddingTop: '32px',
    paddingBottom: '32px',
    paddingLeft: '24px',
    paddingRight: '24px',
    backgroundColor: '#ffffff'
  },
  children
});

/**
 * The two controls #32 named, with the dimensions it named them at.
 *
 * 🔴 **The type names are the ones the node picker offers, and that is not a detail.**
 * The catalog carries two of each: `net.noodl.controls.radiobutton` / `net.noodl.controls.range`
 * (`inNodePicker: true`) and the bare `Radio Button` / `Range` (`isDeprecated: true`,
 * `inNodePicker: false`). They render DIFFERENT components with different markup, and the first
 * version of this fixture used the deprecated pair by accident — which reproduced a false positive,
 * but a different one from the reporter's. `deprecated: true` builds that arm deliberately, so the
 * fix is graded against both implementations in the same run rather than against whichever one the
 * fixture happened to pick.
 */
const controls = (parent, suffix, { deprecated = false } = {}) => [
  {
    id: 'group' + suffix,
    type: 'Radio Button Group',
    label: 'Radio Button Group',
    parent,
    parameters: { flexDirection: 'column', sizeMode: 'contentSize', value: 'a' },
    children: ['radio_a' + suffix, 'radio_b' + suffix]
  },
  {
    // 24x24 is the size #32 reported. The circle a person sees is drawn by the wrapper; the element
    // the rule fires on is the `opacity: 0; position: absolute` input inside it
    // (`RadioButton.tsx:87-95` + `assets/style.css:86-90`).
    id: 'radio_a' + suffix,
    type: deprecated ? 'Radio Button' : 'net.noodl.controls.radiobutton',
    label: 'Radio A',
    parent: 'group' + suffix,
    parameters: {
      value: 'a',
      width: { value: 24, unit: 'px' },
      height: { value: 24, unit: 'px' },
      backgroundColor: '#d8d8d8',
      borderRadius: 12
    }
  },
  {
    id: 'radio_b' + suffix,
    type: deprecated ? 'Radio Button' : 'net.noodl.controls.radiobutton',
    label: 'Radio B',
    parent: 'group' + suffix,
    parameters: {
      value: 'b',
      width: { value: 24, unit: 'px' },
      height: { value: 24, unit: 'px' },
      backgroundColor: '#d8d8d8',
      borderRadius: 12
    }
  },
  {
    // The current Slider draws its track and its thumb as PLAIN unclassed `<div>`s, siblings of the
    // range input (`Slider.tsx:172-176`). 16x16 is #32's thumb.
    id: 'slider' + suffix,
    type: deprecated ? 'Range' : 'net.noodl.controls.range',
    label: 'Slider',
    parent,
    parameters: {
      width: { value: 320, unit: 'px' },
      height: { value: 32, unit: 'px' },
      min: 0,
      max: 100,
      value: 40,
      thumbWidth: { value: 16, unit: 'px' },
      thumbHeight: { value: 16, unit: 'px' },
      thumbColor: '#2f6fed',
      trackColor: '#c9c9c9',
      trackHeight: { value: 4, unit: 'px' }
    }
  }
];

// ── AC1 — the controls and nothing else. A correct rule reports ZERO here. ────────────────────
writeComponent(
  'Pages/Controls',
  [
    {
      id: 'page_controls',
      type: 'Page',
      label: 'Controls',
      parameters: { title: 'FLD-012 — controls only', urlPath: 'controls' },
      children: ['shell_controls']
    },
    { ...shell('shell_controls', ['heading_controls', 'group_c', 'slider_c']), parent: 'page_controls' },
    {
      // One real sentence, so the page is not blank for a different reason and `poverty` findings
      // do not confuse the readout. Text is not an empty box.
      id: 'heading_controls',
      type: 'Text',
      label: 'heading',
      parent: 'shell_controls',
      parameters: { text: 'Pick one, then set the amount', textStyle: 'h2', color: '#111111' }
    },
    ...controls('shell_controls', '_c')
  ],
  []
);

// ── AC2 — the presence control. The same controls, PLUS one box an author really did leave empty.
writeComponent(
  'Pages/Mixed',
  [
    {
      id: 'page_mixed',
      type: 'Page',
      label: 'Mixed',
      parameters: { title: 'FLD-012 — controls and one real empty box', urlPath: 'mixed' },
      children: ['shell_mixed']
    },
    { ...shell('shell_mixed', ['heading_mixed', 'group_m', 'slider_m', 'author_empty_box']), parent: 'page_mixed' },
    {
      id: 'heading_mixed',
      type: 'Text',
      label: 'heading',
      parent: 'shell_mixed',
      parameters: { text: 'Pick one, then set the amount', textStyle: 'h2', color: '#111111' }
    },
    ...controls('shell_mixed', '_m'),
    {
      // 🔴 THE PRESENCE CONTROL. No children, no text, 320x120, a background and a border — the
      // author meant to put something here and did not. This MUST still be reported after the fix.
      // If it is not, the rule was suppressed rather than corrected, and AC1 is worthless.
      id: 'author_empty_box',
      type: 'Group',
      label: 'The box nobody filled',
      parent: 'shell_mixed',
      parameters: {
        sizeMode: 'explicit',
        width: { value: 320, unit: 'px' },
        height: { value: 120, unit: 'px' },
        backgroundColor: '#eeeeee',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#888888',
        borderRadius: '8px'
      }
    }
  ],
  []
);

// ── The SAME two controls, built from the DEPRECATED node types. ───────────────────────
// `nodes-deprecated/controls/radiobutton.tsx` renders a styled `<input type="radio">` — opacity 1,
// visible, `appearance: none`, `border: solid` — so it trips the rule by a route the opacity fix
// does not touch. A project made before the current controls existed still renders this, and a rule
// that is only correct for today's markup is only correct for today's projects.
writeComponent(
  'Pages/Deprecated',
  [
    {
      id: 'page_dep',
      type: 'Page',
      label: 'Deprecated',
      parameters: { title: 'FLD-012 — the deprecated controls', urlPath: 'deprecated' },
      children: ['shell_dep']
    },
    { ...shell('shell_dep', ['heading_dep', 'group_d', 'slider_d']), parent: 'page_dep' },
    {
      id: 'heading_dep',
      type: 'Text',
      label: 'heading',
      parent: 'shell_dep',
      parameters: { text: 'The same two controls, the old way', textStyle: 'h2', color: '#111111' }
    },
    ...controls('shell_dep', '_d', { deprecated: true })
  ],
  []
);

writeComponent(
  'App',
  [
    {
      id: 'app_root',
      type: 'Group',
      label: 'App',
      children: ['app_router'],
      parameters: { sizeMode: 'explicit', width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } },
      x: 40,
      y: 40
    },
    {
      id: 'app_router',
      type: 'Router',
      label: 'Main router',
      parent: 'app_root',
      parameters: {
        name: 'Main',
        pages: {
          startPage: '/Pages/Controls',
          routes: ['/Pages/Controls', '/Pages/Mixed', '/Pages/Deprecated']
        }
      },
      x: 100,
      y: 160
    }
  ],
  []
);

fs.writeFileSync(
  path.join(OUT, 'components', '_registry.json'),
  JSON.stringify(
    { $schema: 'https://opennoodl.dev/schemas/registry-v2.json', version: 1, lastUpdated: stamp, components: registry },
    null,
    2
  ) + '\n'
);
fs.writeFileSync(
  path.join(OUT, 'nodegx.project.json'),
  JSON.stringify(
    {
      $schema: 'https://opennoodl.dev/schemas/project-v2.json',
      name: 'FLD-012 — the empty-box warning stops crying wolf',
      version: '4',
      nodegxVersion: '1.1.0',
      // `path`, not the `hash` default — register row P17: a hash-routed project reports `/#/page`
      // and the harness's per-page navigation is cleaner without it.
      settings: { htmlTitle: 'FLD-012', navigationPathType: 'path' },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      rootNodeId: 'app_root'
    },
    null,
    2
  ) + '\n'
);

// eslint-disable-next-line no-console
console.log(`wrote ${Object.keys(registry).length} components to ${OUT}`);
