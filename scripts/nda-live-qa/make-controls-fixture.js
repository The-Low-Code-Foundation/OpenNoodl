/*
 * NDA-012 (Visual), remediation stream B — live-QA fixture generator.
 *
 * One project for the seven cells closed on 2026-08-01 in `d6f483c9`, `34ec5660` and `19da638a`.
 * Every node carries only what an author would have typed, because the whole class of defect being
 * checked is "a declared default that never reaches the running node" — a fixture that authors the
 * value under test would answer the wrong question.
 *
 *   node scripts/nda-live-qa/make-controls-fixture.js "<project dir>/project.json"
 *
 * ⚠️ Kill the editor with `-9` BEFORE writing, or its shutdown save overwrites the fixture.
 *
 * | Part | Cells |
 * | --- | --- |
 * | Slider, `Min = 10`, `Max = 100`, nothing else | Slider G1 (null abstains), E1 (Value is a number) |
 * | Text Input, only `label` authored | Text Input DV-ii (placeholder opacity 0.5) |
 * | Text Input with `Set` wired from a Button | Text Input A1 (Clear then Set) |
 * | Radio Button Group with two Radio Buttons | Radio Button A3 (no report from a render) |
 * | Drag with a Text child | Drag G1 (null leaves the position) |
 */
const fs = require('fs');
const path = process.argv[2];

if (!path) {
  console.error('usage: make-controls-fixture.js <project dir>/project.json');
  process.exit(1);
}

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

const ROOT = id('aaaa');
const SLIDER = id('aaaa');
const INPUT_PLAIN = id('aaaa');
const INPUT_SET = id('aaaa');
const SET_BUTTON = id('aaaa');
const CLEAR_BUTTON = id('aaaa');
const RBG = id('aaaa');
const RADIO_A = id('aaaa');
const RADIO_B = id('aaaa');
const DRAG = id('aaaa');
const DRAG_CHILD = id('aaaa');

const app = {
  name: 'App',
  id: id('eeee'),
  graph: {
    connections: [
      // A1's situation: `Set` connected, so `Text` waits for a pulse and `_internal.text` is what
      // gets written through. Without this wire the defect is unreachable.
      { fromId: SET_BUTTON, fromProperty: 'onClick', toId: INPUT_SET, toProperty: 'set' },
      { fromId: CLEAR_BUTTON, fromProperty: 'onClick', toId: INPUT_SET, toProperty: 'clear' }
    ],
    roots: [
      node(ROOT, 'Group', { sizeMode: 'explicit', width: { value: 100, unit: '%' } }, [
        // Slider: Min deliberately above zero, so "abstained" and "clamped to Min" are
        // distinguishable readings once the handle has been moved off Min.
        node(SLIDER, 'net.noodl.controls.range', { min: 10, max: 100 }),

        // Untouched placeholder opacity — the panel says 0.5, and DV-ii is whether the rendered
        // `::placeholder` rule agrees.
        node(INPUT_PLAIN, 'net.noodl.controls.textinput', { label: 'Plain' }),

        node(INPUT_SET, 'net.noodl.controls.textinput', { label: 'With Set', startValue: 'Ada Lovelace' }),
        node(SET_BUTTON, 'net.noodl.controls.button', { label: 'Set' }),
        node(CLEAR_BUTTON, 'net.noodl.controls.button', { label: 'Clear' }),

        // A3: two radios in a group, so one is checked and one is not and both render.
        node(RBG, 'Radio Button Group', { value: 'b' }, [
          node(RADIO_A, 'net.noodl.controls.radiobutton', { value: 'a', useLabel: true, label: 'A' }),
          node(RADIO_B, 'net.noodl.controls.radiobutton', { value: 'b', useLabel: true, label: 'B' })
        ]),

        node(DRAG, 'Drag', {}, [node(DRAG_CHILD, 'Text', { text: 'drag me' })])
      ])
    ],
    visualRoots: [ROOT]
  },
  metadata: {}
};

const project = {
  name: 'VerifyControls',
  components: [app],
  settings: {},
  rootNodeId: ROOT,
  version: '4',
  runtimeVersion: 'react19',
  metadata: { title: 'NDA-012 stream B live QA', description: 'Slider / Text Input / Radio Button / Drag' },
  variants: []
};

fs.writeFileSync(path, JSON.stringify(project, null, 2));
console.log('wrote', path);
console.log(
  JSON.stringify(
    { ROOT, SLIDER, INPUT_PLAIN, INPUT_SET, SET_BUTTON, CLEAR_BUTTON, RBG, RADIO_A, RADIO_B, DRAG },
    null,
    2
  )
);
