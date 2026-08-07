/*
 * NDA-017 §2 live-QA fixture generator — "Run on value change".
 *
 * ## Why a purpose-built fixture rather than the existing one
 *
 * Every claim here is about a port the author has **not** touched. Constraint 2 is that an
 * untouched input reads as ticked, and constraint 4 is about what a node publishes before it
 * has ever evaluated — both are claims about *absence*, and a fixture carrying stray
 * parameters cannot make them. So nothing below sets a `runOnChange-…` parameter except the
 * one node that exists to prove unticking works.
 *
 * ## What each part is for
 *
 * | Part | Claim |
 * | --- | --- |
 * | `EXPR_RUN` — `a + b`, `Run` wired to a Button, both inputs from Text Inputs | Constraints 1+2: wiring `Run` no longer makes the value ports passive. Typing in either field must update Result *without* pressing the button |
 * | `EXPR_UNTICK` — same graph, `runOnChange-a` set `false` | Constraint 2's other half, and the only place a checkbox parameter is authored. Typing in `a` must do nothing; typing in `b` must re-run |
 * | `EXPR_NEVER` — `x + y`, `Run` wired, **nothing** wired to `x` or `y` | Constraint 4. Result must read blank/null, not `0`. This is the connect-time push §0 found, and it is why the node has a Text bound to its Result |
 * | `FN_RUN` — Function `Outputs.out = Inputs.p * 2`, `Run` wired, `p` from a Text Input | The reported workaround. Same claim as `EXPR_RUN`, on the node the reporter migrated to |
 *
 * ⚠️ **`EXPR_NEVER`'s inputs are deliberately unwired and unparameterised.** An Expression
 * whose ports have never delivered is the whole of constraint 4, and giving it a parameter to
 * be helpful would delete the measurement.
 *
 * Kill the editor with `-9` **before** writing, or its shutdown save overwrites the fixture.
 */
const fs = require('fs');
const path = process.argv[2];

if (!path) {
  console.error('usage: node make-run-on-change-fixture.js "<project dir>/project.json"');
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

// Section 1 — Run wired, nothing unticked. The default must behave like no Run at all.
const IN_A = id('aaaa');
const IN_B = id('aaaa');
const BTN_RUN = id('aaaa');
const EXPR_RUN = id('aaaa');
const OUT_RUN = id('aaaa');

// Section 2 — same, with `a` unticked.
const IN_C = id('aaaa');
const IN_D = id('aaaa');
const BTN_UNTICK = id('aaaa');
const EXPR_UNTICK = id('aaaa');
const OUT_UNTICK = id('aaaa');

// Section 3 — never evaluated.
const BTN_NEVER = id('aaaa');
const EXPR_NEVER = id('aaaa');
const OUT_NEVER = id('aaaa');

// Section 4 — the Function node, the reporter's workaround.
const IN_P = id('aaaa');
const BTN_FN = id('aaaa');
const FN_RUN = id('aaaa');
const OUT_FN = id('aaaa');

const label = (nid, text) => node(nid, 'Text', { text });

// ⚠️ The Text Input's value output is `onTextChanged`, not `text`. The first cut of this
// fixture wired `text`, which does not exist — the connection was silently dropped, every
// Expression's scope stayed `{}`, and the whole thing read as "the fix does not work live".
// Nothing anywhere reports a connection to a port that is not there.

const app = {
  name: 'App',
  id: id('eeee'),
  graph: {
    connections: [
      // 1 — the default
      { fromId: IN_A, fromProperty: 'onTextChanged', toId: EXPR_RUN, toProperty: 'a' },
      { fromId: IN_B, fromProperty: 'onTextChanged', toId: EXPR_RUN, toProperty: 'b' },
      { fromId: BTN_RUN, fromProperty: 'onClick', toId: EXPR_RUN, toProperty: 'run' },
      { fromId: EXPR_RUN, fromProperty: 'asString', toId: OUT_RUN, toProperty: 'text' },

      // 2 — `a` unticked
      { fromId: IN_C, fromProperty: 'onTextChanged', toId: EXPR_UNTICK, toProperty: 'a' },
      { fromId: IN_D, fromProperty: 'onTextChanged', toId: EXPR_UNTICK, toProperty: 'b' },
      { fromId: BTN_UNTICK, fromProperty: 'onClick', toId: EXPR_UNTICK, toProperty: 'run' },
      { fromId: EXPR_UNTICK, fromProperty: 'asString', toId: OUT_UNTICK, toProperty: 'text' },

      // 3 — never evaluated. `Run` is wired so the node is in the reported configuration, but
      //     the button is never pressed and neither input is fed.
      { fromId: BTN_NEVER, fromProperty: 'onClick', toId: EXPR_NEVER, toProperty: 'run' },
      // `result`, not `asString`: `asString` renders null as '' by contract, which would make
      // "abstained" and "empty string" the same reading — the coincidence trap again. Wiring
      // the raw `*` port means a `0` would be visible as "0" and a null as nothing.
      { fromId: EXPR_NEVER, fromProperty: 'result', toId: OUT_NEVER, toProperty: 'text' },

      // 4 — Function
      { fromId: IN_P, fromProperty: 'onTextChanged', toId: FN_RUN, toProperty: 'in-p' },
      { fromId: BTN_FN, fromProperty: 'onClick', toId: FN_RUN, toProperty: 'run' },
      { fromId: FN_RUN, fromProperty: 'out-out', toId: OUT_FN, toProperty: 'text' }
    ],
    roots: [
      node(ROOT, 'Group', { sizeMode: 'explicit', width: { value: 100, unit: '%' } }, [
        label(id('aaaa'), '1 — Run wired, nothing unticked. Typing must update Result.'),
        node(IN_A, 'net.noodl.controls.textinput', { startValue: '1' }),
        node(IN_B, 'net.noodl.controls.textinput', { startValue: '2' }),
        node(BTN_RUN, 'net.noodl.controls.button', { label: 'Run 1' }),
        label(OUT_RUN, 'result-1'),

        label(id('aaaa'), '2 — a unticked. Typing in the FIRST field must do nothing.'),
        node(IN_C, 'net.noodl.controls.textinput', { startValue: '1' }),
        node(IN_D, 'net.noodl.controls.textinput', { startValue: '2' }),
        node(BTN_UNTICK, 'net.noodl.controls.button', { label: 'Run 2' }),
        label(OUT_UNTICK, 'result-2'),

        label(id('aaaa'), '3 — never evaluated. Result must be blank, not 0.'),
        node(BTN_NEVER, 'net.noodl.controls.button', { label: 'Run 3' }),
        label(OUT_NEVER, 'result-3'),

        label(id('aaaa'), '4 — Function, the reported workaround.'),
        node(IN_P, 'net.noodl.controls.textinput', { startValue: '3' }),
        node(BTN_FN, 'net.noodl.controls.button', { label: 'Run 4' }),
        label(OUT_FN, 'result-4')
      ]),

      node(EXPR_RUN, 'Expression', { expression: 'a + b' }),
      // The one authored checkbox in the fixture. `false` is the only value worth authoring —
      // `true` is what absent already means, so writing it would prove nothing.
      node(EXPR_UNTICK, 'Expression', { expression: 'a + b', 'runOnChange-a': false }),
      node(EXPR_NEVER, 'Expression', { expression: 'x + y' }),
      node(FN_RUN, 'JavaScriptFunction', {
        functionScript: 'Outputs.out = Number(Inputs.p) * 2;',
        scriptInputs: [{ id: 'p', label: 'p' }],
        scriptOutputs: [{ id: 'out', label: 'out' }]
      })
    ],
    visualRoots: [ROOT]
  },
  metadata: {}
};

const project = {
  name: 'VerifyRunOnChange',
  components: [app],
  settings: {},
  rootNodeId: ROOT,
  version: '4',
  runtimeVersion: 'react19',
  metadata: { title: 'NDA-017 §2 live QA', description: 'Run on value change' },
  variants: []
};

fs.writeFileSync(path, JSON.stringify(project, null, 2));
console.log('wrote', path);
console.log(JSON.stringify({ ROOT, EXPR_RUN, EXPR_UNTICK, EXPR_NEVER, FN_RUN, IN_A, IN_C, IN_P, OUT_RUN, OUT_UNTICK, OUT_NEVER, OUT_FN }, null, 2));
