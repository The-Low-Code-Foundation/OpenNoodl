/*
 * NDA-012 (Visual) streams C and D live-QA fixture generator.
 *
 * ## Why this fixture exists
 *
 * Streams C and D shipped nine cells' worth of viewer changes without one of them being driven
 * in the editor. Every claim below is one jest was deliberately unable to make: they need a
 * real React commit (the pre-mount queue), a real user gesture (`Changed`'s `fromUser`), a real
 * `location` (the router's decode), or a **saved parameter applied while the graph is still
 * being constructed** — which is the one shape a corpus row structurally cannot produce,
 * because a row calls `setInputValue` on a graph that has already been built.
 *
 * ## What each part is for
 *
 * | Part | Claim |
 * | --- | --- |
 * | `COLS` — `Columns`, `Layout String` saved as `'1 a 1'` | **D1.** Two columns render, and `columns/layout-string-invalid` names `"a"` and both counts. Authored as a *parameter*, not typed, so it also exercises apply-before-the-port-exists |
 * | `RB1`/`RB2` in `RBG`, each `Changed` wired to a `Counter` | **A1.** Clicking one radio fires `Changed` on **both** — the selected and the deselected. Setting the *group's* `Value` from the graph must fire neither |
 * | `RB_LONE` — a `Radio Button` with no group above it | **F1.** `radio-button/no-group` in the warnings panel, and the button renders **unchecked**. It rendered permanently checked before the context default became `null` |
 * | `SCROLL_BAD` — `Scroll To Index` 99 into a Group with 2 children | **B2.** `group/scroll-to-index-failed` naming the index and the real child count, on the bus so a deployed app gets it too |
 * | `NAV_PCT` — `Navigate` carrying `pm-code` = `'50% off & more'` | **Router D1.** Before the fix `decodeURI` turned `%25` into a bare `%` and the next `decodeURIComponent` threw `URIError`, taking the whole match down |
 * | `BTN_RESET` → `ROUTER.reset`, after editing Detail's `urlPath` live | **Router A2.** The router compares against a *snapshot* of what it rendered, so an in-place page edit is now visible to an explicit `Reset` |
 * | `VIDEO` in `/#__page__/Detail`, `Page.didMount → Play` | **Stream C A3.** A `Play` delivered in the mount frame is queued and flushed by the ref callback. The `src` is deliberately unplayable, so a flush is witnessed by `onPlaybackFailure` firing — under the old code *neither* `On Play` nor `On Playback Failure` fires at all |
 * | `SCROLLER` in `/#__page__/Detail`, `Page.didMount → Scroll To Element` | **Stream C A3, the other node.** Same mount frame, same queue. Witnessed by `scrollTop` leaving 0 |
 *
 * ⚠️ **`VIDEO`'s `src` being unplayable is load-bearing, not laziness.** The measurement is
 * "did the action reach the element", not "did it play". A missing source rejects `play()` with
 * `NotSupportedError`, which `Video.tsx` reports; an `AbortError` would be swallowed by
 * `SILENT_PLAY_REJECTIONS` and read as the queue having failed.
 *
 * ⚠️ **`TARGET` is a child of `SCROLLER`.** `scrollToElement` now refuses an element the Group
 * does not contain, because `scrollIntoView` would silently scroll a different ancestor — so a
 * target placed outside would report a reason instead of scrolling, and the row would read as
 * the queue not flushing.
 *
 * ⚠️ Kill the editor with `-9` **before** writing, or its shutdown save overwrites the fixture.
 */
const fs = require('fs');
const path = process.argv[2];

if (!path) {
  console.error('usage: node make-visual-cd-fixture.js "<project dir>/project.json"');
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

const COLS = id('aaaa');
const COL_A = id('aaaa');
const COL_B = id('aaaa');

const RBG = id('aaaa');
const RB1 = id('aaaa');
const RB2 = id('aaaa');
const CNT1 = id('aaaa');
const CNT2 = id('aaaa');
const TXT_C1 = id('aaaa');
const TXT_C2 = id('aaaa');

const RB_LONE = id('aaaa');

const SCROLL_BAD = id('aaaa');
const SCROLL_BAD_A = id('aaaa');
const SCROLL_BAD_B = id('aaaa');

const BTN_NAV = id('aaaa');
const BTN_RESET = id('aaaa');
const NAV_PCT = id('aaaa');
const ROUTER = id('aaaa');

// ---------------------------------------------------------------------------------------------
// /#__page__/Home
// ---------------------------------------------------------------------------------------------
const PAGE_H = id('bbbb');

// ---------------------------------------------------------------------------------------------
// /#__page__/Detail
// ---------------------------------------------------------------------------------------------
const PAGE_D = id('cccc');
const PI = id('cccc');
const TXT_CODE = id('cccc');
const VIDEO = id('cccc');
const CNT_PLAY = id('cccc');
const CNT_FAIL = id('cccc');
const TXT_PLAY = id('cccc');
const TXT_FAIL = id('cccc');
const SCROLLER = id('cccc');
const SPACER = id('cccc');
const TARGET = id('cccc');

const DETAIL_COMPONENT = '/#__page__/Detail';

const app = {
  name: '/App',
  id: id('eeee'),
  graph: {
    connections: [
      // A1 — one Counter per button, so "which of the two fired" is readable rather than a total.
      { fromId: RB1, fromProperty: 'onChange', toId: CNT1, toProperty: 'increase' },
      { fromId: RB2, fromProperty: 'onChange', toId: CNT2, toProperty: 'increase' },
      { fromId: CNT1, fromProperty: 'currentCount', toId: TXT_C1, toProperty: 'text' },
      { fromId: CNT2, fromProperty: 'currentCount', toId: TXT_C2, toProperty: 'text' },

      // B2 — an index past the end, fired once the Group has mounted.
      { fromId: SCROLL_BAD, fromProperty: 'didMount', toId: SCROLL_BAD, toProperty: 'scrollToIndex.do' },

      // Router D1 / A2
      { fromId: BTN_NAV, fromProperty: 'onClick', toId: NAV_PCT, toProperty: 'navigate' },
      { fromId: BTN_RESET, fromProperty: 'onClick', toId: ROUTER, toProperty: 'reset' }
    ],
    roots: [
      node(ROOT, 'Group', { sizeMode: 'contentSize', width: { value: 100, unit: '%' } }, [
        label(id('aaaa'), 'A — Columns D1: "1 a 1" must render TWO columns and warn about "a".'),
        // ⚠️ Authored as a saved parameter on purpose. A corpus row can only reach this port
        // with `setInputValue` on a built graph; a saved project applies it while the graph is
        // still being constructed, and that is the ordering no row has ever measured.
        node(COLS, 'net.noodl.visual.columns', { layoutString: '1 a 1' }, [
          label(COL_A, 'column one'),
          label(COL_B, 'column two')
        ]),

        label(id('aaaa'), 'B — Radio A1: clicking either button must move BOTH counters.'),
        node(RBG, 'Radio Button Group', { flexDirection: 'row' }, [
          node(RB1, 'net.noodl.controls.radiobutton', { value: 'one', useLabel: true, label: 'One' }),
          node(RB2, 'net.noodl.controls.radiobutton', { value: 'two', useLabel: true, label: 'Two' })
        ]),
        label(TXT_C1, 'rb1-changes'),
        label(TXT_C2, 'rb2-changes'),

        label(id('aaaa'), 'C — Radio F1: the button below has no group. Expect a warning, and UNCHECKED.'),
        node(RB_LONE, 'net.noodl.controls.radiobutton', { value: 'lone', useLabel: true, label: 'Lone' }),

        label(id('aaaa'), 'D — Group B2: Scroll To Index 99 into a Group with two children.'),
        node(
          SCROLL_BAD,
          'Group',
          {
            scrollEnabled: true,
            sizeMode: 'explicit',
            height: { value: 60, unit: 'px' },
            width: { value: 200, unit: 'px' },
            'scrollToIndex.index': 99
          },
          [label(SCROLL_BAD_A, 'first'), label(SCROLL_BAD_B, 'second')]
        ),

        label(id('aaaa'), 'E — Router D1 and A2.'),
        node(BTN_NAV, 'net.noodl.controls.button', { label: 'Navigate with a % in the parameter' }),
        node(BTN_RESET, 'net.noodl.controls.button', { label: 'Reset router' }),

        node(ROUTER, 'Router', {
          name: 'Main',
          pages: {
            startPage: '/#__page__/Home',
            routes: ['/#__page__/Home', DETAIL_COMPONENT]
          }
        })
      ]),

      node(CNT1, 'Counter', { startValue: 0 }),
      node(CNT2, 'Counter', { startValue: 0 }),

      // ⚠️ The literal `%` is the whole point. `Navigate` sends this through
      // `encodeURIComponent`, so it leaves as `50%25%20off%20%26%20more`; the old
      // `decodeURI` turned `%25` back into a bare `%` and the per-parameter
      // `decodeURIComponent` then threw `URIError: URI malformed`, uncaught.
      node(NAV_PCT, 'RouterNavigate', {
        router: 'Main',
        target: DETAIL_COMPONENT,
        'pm-code': '50% off & more'
      })
    ],
    visualRoots: [ROOT]
  },
  metadata: {}
};

const home = {
  name: '/#__page__/Home',
  id: id('eeee'),
  graph: {
    connections: [],
    roots: [node(PAGE_H, 'Page', { title: 'Home', urlPath: 'home' }, [label(id('bbbb'), 'Home page')])],
    visualRoots: [PAGE_H]
  },
  metadata: {}
};

const detail = {
  name: DETAIL_COMPONENT,
  id: id('eeee'),
  graph: {
    connections: [
      // Router D1 witness — the decoded parameter, rendered.
      { fromId: PI, fromProperty: 'pm-code', toId: TXT_CODE, toProperty: 'text' },

      // Stream C A3 — both actions fired in the frame the page mounts, which is before React
      // has run the wrapper's ref callback. Under the old `innerReactComponentRef && …` both
      // were dropped in silence.
      { fromId: PAGE_D, fromProperty: 'didMount', toId: VIDEO, toProperty: 'play' },
      { fromId: PAGE_D, fromProperty: 'didMount', toId: SCROLLER, toProperty: 'scrollToElement.do' },
      { fromId: TARGET, fromProperty: 'this', toId: SCROLLER, toProperty: 'scrollToElement.element' },

      { fromId: VIDEO, fromProperty: 'onPlay', toId: CNT_PLAY, toProperty: 'increase' },
      { fromId: VIDEO, fromProperty: 'onPlaybackFailure', toId: CNT_FAIL, toProperty: 'increase' },
      { fromId: CNT_PLAY, fromProperty: 'currentCount', toId: TXT_PLAY, toProperty: 'text' },
      { fromId: CNT_FAIL, fromProperty: 'currentCount', toId: TXT_FAIL, toProperty: 'text' }
    ],
    roots: [
      node(PAGE_D, 'Page', { title: 'Detail', urlPath: 'detail/{code}' }, [
        label(id('cccc'), 'Detail page'),
        label(TXT_CODE, 'code-goes-here'),

        node(VIDEO, 'Video', {
          // Unplayable on purpose — see the header. A flush is witnessed by the failure count.
          src: 'nda-012-there-is-no-such-video.mp4',
          muted: true,
          controls: true,
          autoplay: false,
          sizeMode: 'explicit',
          width: { value: 160, unit: 'px' },
          height: { value: 90, unit: 'px' }
        }),
        label(TXT_PLAY, 'play-count'),
        label(TXT_FAIL, 'fail-count'),

        node(
          SCROLLER,
          'Group',
          {
            scrollEnabled: true,
            sizeMode: 'explicit',
            height: { value: 120, unit: 'px' },
            width: { value: 240, unit: 'px' }
          },
          [
            node(SPACER, 'Group', {
              sizeMode: 'explicit',
              height: { value: 500, unit: 'px' },
              width: { value: 200, unit: 'px' },
              backgroundColor: '#333333'
            }),
            label(TARGET, 'SCROLL TARGET')
          ]
        )
      ]),

      node(PI, 'PageInputs', { pathParams: 'code' }),
      node(CNT_PLAY, 'Counter', { startValue: 0 }),
      node(CNT_FAIL, 'Counter', { startValue: 0 })
    ],
    visualRoots: [PAGE_D]
  },
  metadata: {}
};

const project = {
  name: 'VerifyVisualCD',
  components: [app, home, detail],
  settings: { htmlTitle: 'NDA-012 Visual C+D' },
  rootNodeId: ROOT,
  version: '4',
  runtimeVersion: 'react19',
  metadata: { title: 'NDA-012 Visual streams C and D live QA', description: 'Pre-mount queue, radio Changed, bare-string contracts, router path and reset' },
  variants: []
};

fs.writeFileSync(path, JSON.stringify(project, null, 2));
console.log('wrote', path);
console.log(
  JSON.stringify(
    { ROOT, COLS, RBG, RB1, RB2, RB_LONE, CNT1, CNT2, SCROLL_BAD, BTN_NAV, BTN_RESET, NAV_PCT, ROUTER, PAGE_D, VIDEO, SCROLLER, TARGET, CNT_PLAY, CNT_FAIL },
    null,
    2
  )
);
