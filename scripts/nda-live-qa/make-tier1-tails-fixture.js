/*
 * Tier-1 live-QA tails fixture generator — NDA-002 criterion 3, NDA-013 criterion 5,
 * NDA-014 criterion 1.
 *
 * ## Why this fixture exists
 *
 * The 2026-07-29 consolidated pass *named* NDA-002/003/013/014 in its header, but every claim
 * it actually recorded was about collection semantics and the editor's typecast **table**.
 * Nothing drove `refresh()`, and nothing wired an `object` output into a Text node's DOM. Both
 * were listed as residuals in that entry and then read as done from the header. This fixture
 * exists so each of the three remaining criteria is measured by something that reads
 * differently under the old code.
 *
 * ⚠️ **The NodeGX QA fixture cannot serve these criteria and that is why they are here.**
 * `dev-docs/qa-fixtures/nodegx-qa-fixture` contains **no `For Each` node at all** (21
 * components; the type inventory is Text/Group/Page/JavaScriptFunction/Expression/Markdown/
 * Router/RouterNavigate/DbCollection2/FilterDBModels), so NDA-013's criterion 4 — "the QA
 * fixture's repeater graphs render identically" — names graphs that no longer exist; the
 * criterion was written against *Shine Phase 2*, which that fixture replaced. Its only
 * Collection consumers are the two DB-backed nodes, which have no local data, and its two
 * Function nodes are wired to **nothing**. Checked against it alone, all three criteria would
 * go green having exercised none of the code they name.
 *
 * ## What each part is for
 *
 * | Part | Claim | Reads differently under the old code because… |
 * | --- | --- | --- |
 * | `SRC` → `REP.items`, a **plain array** parked on `window.__qaList` | NDA-013 setup | `foreach.tsx:240` guards on identity, so re-emitting the same array is a no-op and the array the graph holds stays the one CDP can reach |
 * | `BTN_ADD` → `PUSH.run`, which does `window.__qaList.push(...)` in place | NDA-013, the defect | An in-place `push` fires **no** notification — the A1 defect NDA-002 deliberately did not fix. The row count must **not** move on this click |
 * | `BTN_REFRESH` → `REP.refresh` | **NDA-013 criterion 5** | `refresh` did not exist as a port, and *a connection to a port that does not exist is dropped in silence* — so the click did nothing and the count stayed at 2. Now `refresh()` resyncs the private collection from the bound array (`foreach.tsx:633`) |
 * | `OBJ` (`outtype-payload: object`) → `TXT_OBJ.text` | **NDA-014 criterion 1** | Before the `object → string` cast the connection was refused, so the Text rendered **empty**. "Shows something useful" means a JSON rendering, not `[object Object]` |
 * | `ARR` (`outtype-rows: array`) → `TXT_ARR.text` | NDA-014, the second cast | Same, for `array → string`. Both casts are in `typecasts` in the generated catalog; this is the DOM half the 07-29 pass explicitly did not perform |
 * | The whole graph, loaded | **NDA-002 criterion 3** | Cyclic-loop warnings and renderer exceptions, on a graph that actually churns a Collection — which the QA fixture cannot do |
 *
 * ⚠️ **`window.__qaList` is load-bearing, not a shortcut.** The Function node's script is
 * re-evaluated whenever the node is read; a literal array in the script would mint a **new**
 * array each time, `foreach.tsx:240`'s identity guard would let it through, and the Repeater
 * would resync on its own — which is precisely the notification the measurement needs absent.
 * Parking the array on `window` makes every evaluation return the *same* instance, so the only
 * thing that can move the row count is `refresh()`.
 *
 * ⚠️ **The Function node's author-declared outputs are named `out-<label>`, not `<label>`.**
 * `simplejavascript.ts:569` registers `'out-' + p.label`; the *first* build of this fixture wired
 * `payload`/`items`/`rows`/`size` and every one of the four connections was **dropped in total
 * silence** — the preview rendered each Text's authored placeholder and an empty Repeater, which
 * reads exactly like a runtime that evaluated and produced nothing. Do not confuse this node with
 * the **Script** node (`Javascript2`, `noodl-viewer-react/…/javascript.ts:788`), which names the
 * same family of ports *bare*. Two script hosts, two conventions.
 *
 * ⚠️ **The row count, not the row text, is the witness.** `/Item` renders a static Text on
 * purpose: the model ids are read from the Repeater's own `_forEachModel` bookkeeping over CDP,
 * so "did it re-read the source" is answered by identity rather than by a binding that could
 * fail for its own reasons.
 *
 * ⚠️ Kill the editor with `-9` **before** writing, or its shutdown save overwrites the fixture.
 */
const fs = require('fs');
const path = process.argv[2];

if (!path) {
  console.error('usage: node make-tier1-tails-fixture.js "<project dir>/project.json"');
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

const label = (nid, text) => node(nid, 'Text', { text });

// ---------------------------------------------------------------------------------------------
// /App
// ---------------------------------------------------------------------------------------------
const ROOT = id('aaaa');

// NDA-013
const LIST = id('aaaa');
const REP = id('aaaa');
const SRC = id('aaaa');
const PUSH = id('aaaa');
const BTN_ADD = id('aaaa');
const BTN_REFRESH = id('aaaa');
const TXT_SIZE = id('aaaa');

// NDA-014
const OBJ = id('aaaa');
const TXT_OBJ = id('aaaa');
const ARR = id('aaaa');
const TXT_ARR = id('aaaa');

const ITEM_COMPONENT = '/Item';

// The two proplist rows. `id` is the parentItemId the `outtype-` port hangs off.
const OUT_ITEMS = id('pppp');
const OUT_SIZE = id('pppp');
const OUT_PAYLOAD = id('pppp');
const OUT_ROWS = id('pppp');

const app = {
  name: '/App',
  id: id('eeee'),
  graph: {
    connections: [
      // NDA-013 — the source array, then the two buttons.
      { fromId: SRC, fromProperty: 'out-items', toId: REP, toProperty: 'items' },
      { fromId: BTN_ADD, fromProperty: 'onClick', toId: PUSH, toProperty: 'run' },
      { fromId: PUSH, fromProperty: 'out-size', toId: TXT_SIZE, toProperty: 'text' },
      // ⚠️ The criterion-5 wire. If `refresh` were not a real port this connection would be
      // dropped without a word, and the click below would read exactly like a working refresh
      // that found nothing to do. The port is `signal`/`allowConnectionsOnly` in the catalog.
      { fromId: BTN_REFRESH, fromProperty: 'onClick', toId: REP, toProperty: 'refresh' },

      // NDA-014 — the DOM half of criterion 1.
      { fromId: OBJ, fromProperty: 'out-payload', toId: TXT_OBJ, toProperty: 'text' },
      { fromId: ARR, fromProperty: 'out-rows', toId: TXT_ARR, toProperty: 'text' }
    ],
    roots: [
      node(ROOT, 'Group', { sizeMode: 'contentSize', width: { value: 100, unit: '%' } }, [
        label(id('aaaa'), 'A — NDA-013: Add pushes in place (count must NOT move), Refresh must show it.'),
        node(BTN_ADD, 'net.noodl.controls.button', { label: 'Add (in-place push)' }),
        node(BTN_REFRESH, 'net.noodl.controls.button', { label: 'Refresh' }),
        label(TXT_SIZE, 'array-size'),

        // The Repeater adds its rows as siblings of itself under this Group.
        node(LIST, 'Group', { sizeMode: 'contentSize' }, [
          node(REP, 'For Each', { template: ITEM_COMPONENT, templateType: 'explicit' })
        ]),

        label(id('aaaa'), 'B — NDA-014: an object output and an array output, each into a Text.'),
        label(TXT_OBJ, 'object-goes-here'),
        label(TXT_ARR, 'array-goes-here')
      ]),

      // ⚠️ Same instance on every evaluation — see the header.
      node(SRC, 'JavaScriptFunction', {
        functionScript:
          "if (!window.__qaList) { window.__qaList = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]; }\n" +
          'Outputs.items = window.__qaList;\n',
        scriptOutputs: [{ id: OUT_ITEMS, label: 'items' }],
        'outtype-items': 'array'
      }),

      node(PUSH, 'JavaScriptFunction', {
        functionScript:
          "window.__qaList.push({ id: 'c-' + window.__qaList.length, label: 'Gamma' });\n" +
          'Outputs.size = window.__qaList.length;\n',
        scriptOutputs: [{ id: OUT_SIZE, label: 'size' }],
        'outtype-size': 'number'
      }),

      node(OBJ, 'JavaScriptFunction', {
        functionScript: "Outputs.payload = { user: 'Ada', roles: ['admin'] };\n",
        scriptOutputs: [{ id: OUT_PAYLOAD, label: 'payload' }],
        'outtype-payload': 'object'
      }),

      node(ARR, 'JavaScriptFunction', {
        functionScript: "Outputs.rows = ['one', 'two', 'three'];\n",
        scriptOutputs: [{ id: OUT_ROWS, label: 'rows' }],
        'outtype-rows': 'array'
      })
    ],
    visualRoots: [ROOT]
  },
  metadata: {}
};

// Static on purpose — the row count and the Repeater's `_forEachModel` ids are the witnesses.
const ITEM_ROOT = id('bbbb');
const item = {
  name: ITEM_COMPONENT,
  id: id('eeee'),
  graph: {
    connections: [],
    roots: [node(ITEM_ROOT, 'Group', { sizeMode: 'contentSize' }, [label(id('bbbb'), 'row')])],
    visualRoots: [ITEM_ROOT]
  },
  metadata: {}
};

const project = {
  name: 'VerifyTier1Tails',
  components: [app, item],
  settings: { htmlTitle: 'Tier-1 tails' },
  rootNodeId: ROOT,
  version: '4',
  runtimeVersion: 'react19',
  metadata: {
    title: 'Tier-1 live-QA tails',
    description: 'NDA-013 Refresh, NDA-014 object/array to Text, NDA-002 cyclic warnings'
  },
  variants: []
};

fs.writeFileSync(path, JSON.stringify(project, null, 2));
console.log('wrote', path);
console.log(JSON.stringify({ ROOT, LIST, REP, SRC, PUSH, BTN_ADD, BTN_REFRESH, TXT_SIZE, OBJ, TXT_OBJ, ARR, TXT_ARR }, null, 2));
