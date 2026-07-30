/* NDA-006/010/011/007 live-QA fixture generator. Writes VerifyFix4/project.json. */
const fs = require('fs');
const path = process.argv[2];

let n = 0;
const id = (tag) => `${tag}-0000-0000-0000-${String(++n).padStart(12, '0')}`;

const node = (nid, type, parameters = {}, children = []) => ({
  id: nid,
  type,
  x: 0,
  y: 0,
  parameters,
  ports: [],
  dynamicports: [],
  children
});

// ---- App ----
const ROOT = id('aaaa');
const WRAP_BP = id('aaaa');
const COL_BP = id('aaaa');
const bpTexts = [1, 2, 3, 4].map(() => id('aaaa'));
const WRAP_AF = id('aaaa');
const COL_AF = id('aaaa');
const afTexts = [1, 2, 3, 4, 5, 6].map(() => id('aaaa'));
const WRAP_REP = id('aaaa');
const COL_REP = id('aaaa');
const FOREACH = id('aaaa');
const WRAP_MAS = id('aaaa');
const COL_MAS = id('aaaa');
const masBoxes = [1,2,3,4,5,6,7].map(() => id('aaaa'));
const ICON_PRESET = id('aaaa');
const ICON_BLANK = id('aaaa');
const BTN = id('aaaa');
const DATA = id('aaaa');
const SP_A = id('aaaa');
const SP_B = id('aaaa');
const EXPR = id('aaaa');

const app = {
  name: 'App',
  id: id('eeee'),
  graph: {
    connections: [
      { fromId: DATA, fromProperty: 'items', toId: FOREACH, toProperty: 'items' },
      { fromId: BTN, fromProperty: 'onClick', toId: SP_A, toProperty: 'show' },
      { fromId: BTN, fromProperty: 'onClick', toId: SP_B, toProperty: 'show' }
    ],
    roots: [
      node(ROOT, 'Group', { sizeMode: 'explicit', width: { value: 100, unit: '%' } }, [
        // Breakpoint Columns: 4 fractions at wide, '1 1' below 800, '1' below 500.
        node(WRAP_BP, 'Group', {}, [
          node(
            COL_BP,
            'net.noodl.visual.columns',
            {
              layoutString: '1 1 1 1',
              sizing: 'layoutString',
              mediumBreakpoint: { value: 800, unit: 'px' },
              mediumLayout: '1 1',
              smallBreakpoint: { value: 500, unit: 'px' },
              smallLayout: '1',
              marginX: { value: 0, unit: 'px' },
              marginY: { value: 0, unit: 'px' }
            },
            bpTexts.map((t, i) => node(t, 'Text', { text: 'BP' + (i + 1) }))
          )
        ]),
        // Auto Fit Columns: as many 200px-min columns as fit.
        node(WRAP_AF, 'Group', {}, [
          node(
            COL_AF,
            'net.noodl.visual.columns',
            {
              layoutString: '1 2 1',
              sizing: 'autoFit',
              minWidth: { value: 200, unit: 'px' },
              marginX: { value: 0, unit: 'px' },
              marginY: { value: 0, unit: 'px' }
            },
            afTexts.map((t, i) => node(t, 'Text', { text: 'AF' + (i + 1) }))
          )
        ]),
        // Columns whose ONLY authored child is a Repeater.
        node(WRAP_REP, 'Group', {}, [
          node(COL_REP, 'net.noodl.visual.columns', { layoutString: '1', marginX: { value: 0, unit: 'px' }, marginY: { value: 0, unit: 'px' } }, [
            node(FOREACH, 'For Each', { templateType: 'explicit', template: '/Row' })
          ])
        ]),
        // Masonry: 7 boxes of known, unequal heights over 3 equal columns, zero gaps so the
        // expected tops are exact. Round-robin puts 0,3,6 in column 0; 1,4 in column 1; 2,5 in
        // column 2 — tops 0,40,160 / 0,90 / 0,60 and a packed height of 230.
        node(WRAP_MAS, 'Group', {}, [
          node(
            COL_MAS,
            'net.noodl.visual.columns',
            {
              layoutString: '1 1 1',
              packing: 'masonry',
              marginX: { value: 0, unit: 'px' },
              marginY: { value: 0, unit: 'px' }
            },
            [40, 90, 60, 120, 50, 80, 70].map((h, i) =>
              node(masBoxes[i], 'Group', {
                sizeMode: 'explicit',
                width: { value: 100, unit: '%' },
                height: { value: h, unit: 'px' },
                backgroundColor: i % 2 ? '#3355aa' : '#aa5533'
              })
            )
          )
        ]),
        // NDA-007 §2/§3: one Icon with a hand-set sprite value (proves the viewer alone) and one
        // blank, to be set from the picker live (proves picker -> IconType -> parameter -> viewer).
        node(ICON_PRESET, 'net.noodl.visual.icon', {
          iconIconSource: { kind: 'sprite', url: 'noodl_modules/qa-sprites/assets/sprite.svg', symbolId: 'qa-star' },
          iconColor: '#ff9900',
          iconSize: { value: 48, unit: 'px' }
        }),
        node(ICON_BLANK, 'net.noodl.visual.icon', { iconColor: '#33ccff', iconSize: { value: 48, unit: 'px' } }),
        node(BTN, 'net.noodl.controls.button', { label: 'Open popups' })
      ]),
      node(DATA, 'Static Data', {
        type: 'json',
        json: JSON.stringify([{ label: 'R0' }, { label: 'R1' }, { label: 'R2' }, { label: 'R3' }])
      }),
      node(SP_A, 'NavigationShowPopup', { target: '/PopupA', stackPolicy: 'replace' }),
      node(SP_B, 'NavigationShowPopup', { target: '/PopupB', stackPolicy: 'replace' }),
      // NDA-004 §2 criterion 2: a raised failure that needs no interaction and no `On App Error`
      // node to be observable. `Run` is deliberately left unconnected, so setting `expression`
      // at boot schedules the evaluation itself (`expression.ts:321`) and `_calculateExpression`
      // reports `expression/compile-failed` on the first frame. The witness is a `[noodl]` line
      // on the *default* channel — the path a project gets without the author doing anything,
      // which is precisely the path criterion 2 had never been checked through.
      node(EXPR, 'Expression', { expression: '1 +* ' })
    ],
    visualRoots: [ROOT]
  },
  metadata: {}
};

// ---- /Row (repeater template) ----
const ROW_GROUP = id('bbbb');
const ROW_INPUT = id('bbbb');
const row = {
  name: '/Row',
  id: id('eeee'),
  graph: {
    connections: [],
    roots: [node(ROW_GROUP, 'Group', {}, [node(ROW_INPUT, 'net.noodl.controls.textinput', { startValue: 'row' })])],
    visualRoots: [ROW_GROUP]
  },
  metadata: {}
};

const popup = (name, label) => {
  const g = id('cccc');
  return {
    name,
    id: id('eeee'),
    graph: {
      connections: [],
      roots: [node(g, 'Group', {}, [node(id('cccc'), 'Text', { text: label })])],
      visualRoots: [g]
    },
    metadata: {}
  };
};

const project = {
  name: 'VerifyFix4',
  components: [app, row, popup('/PopupA', 'POPUP-A'), popup('/PopupB', 'POPUP-B')],
  settings: {},
  rootNodeId: ROOT,
  version: '4',
  runtimeVersion: 'react19',
  metadata: { title: 'NDA live QA fixture', description: 'phase 30 live QA' },
  variants: []
};

fs.writeFileSync(path, JSON.stringify(project, null, 2));
console.log('wrote', path);
console.log(JSON.stringify({ ICON_PRESET, ICON_BLANK, ROOT, COL_BP, COL_AF, COL_REP, COL_MAS, FOREACH, BTN, DATA, SP_A, SP_B, EXPR, ROW_INPUT }, null, 2));
