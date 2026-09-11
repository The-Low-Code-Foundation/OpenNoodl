/**
 * TPL-003 — the landing pages: three looks, one contact form, no backend.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## What this template is
 *
 * Richard, 2026-09-05: *"a simple pretty landing page would be a great simple
 * starter package, no backend just front end small business or freelancer
 * landing page, presentation and a contact form … a few different pages within
 * the same template for different typical 'top 3' landing page types."*
 *
 * So: **three pages, each a complete landing page of a different kind**, sharing
 * one header, one footer and one contact band, and a strip across the top that
 * lets a person flick between the three before deleting the two they do not
 * want. The three kinds are the ones a small business or a freelancer actually
 * needs:
 *
 * | page | route | for |
 * |---|---|---|
 * | `Pages/Freelancer` | `/` | one person selling their skill — services, work, a word from a client |
 * | `Pages/Business` | `/business` | a place people visit — a photograph, what it sells, where it is, when it opens |
 * | `Pages/Launch` | `/launch` | something that does not exist yet — the promise, how it works, the numbers, the questions |
 *
 * ## 🔴 No backend, and the contact form still works
 *
 * A form that posts to nothing is a form that lies. This one composes a
 * `mailto:` link from the three fields and hands it to the browser through the
 * `External Link` node, so **Send opens the person's own mail app with the
 * message already written and addressed**. It needs no server, no keys and no
 * account, and the address it sends to is one `String` node a person changes
 * once. The page then says what just happened, and shows the address in case
 * the mail app did not open.
 *
 * ## Copy — Richard's §E ruling, applied to a template that is ALL copy
 *
 * The members' area made its copy data (§E-i) because it had a door to collect
 * it through. A landing page has none, so this template is the §E-ii case end
 * to end: **no invented business, no fictional client, no made-up numbers.**
 * Every string a person has to replace is written in the shape of the thing it
 * stands for — a headline that tells you what a headline says here, a service
 * named for the kind of service — and every such node is labelled `EDIT —` so
 * the editor's node tree lists them and `docs/START-HERE.md` is generated from
 * that list. Structural words that are the same for every install
 * ("Get in touch", "How it works", "Send") are ordinary labels.
 *
 * ## The parts are components because the door says so
 *
 * `repeated-sibling-subtree` fires at three copies of a three-node subtree, and
 * a landing page is nothing but rows of three. A feature, a photo card, a stat,
 * a quote, a step, a question and an opening-hours line are each one component
 * with a `Component Inputs` node, placed three or four times with different
 * values — which is also what makes them one place to restyle.
 *
 * @module noodl-mcp/tests/tpl003Components
 */
import { composition } from './tpl003Theme';

/** The router every page registers into. */
export const ROUTER = 'Main';

/** One component, in the shape `create_component` takes. */
export interface Tpl003Component {
  path: string;
  nodes: unknown[];
  connections: unknown[];
  /**
   * Ids of nodes that name a component authored later. The switcher strip
   * navigates to all three pages and is placed by all three, so it has to
   * exist before them and point at them: the create pass omits these nodes
   * and their wires, and an `update_component` restores them once the pages
   * are on disk.
   */
  deferred?: string[];
}

// ── The components' legacy names, spelled once ───────────────────────────────

export const SCROLL_TO_COMPONENT = '/Site/ScrollTo';
export const SWITCHER_COMPONENT = '/Site/Switcher';
export const HEADER_COMPONENT = '/Site/Header';
export const FOOTER_COMPONENT = '/Site/Footer';
export const CONTACT_COMPONENT = '/Site/Contact';
export const FEATURE_COMPONENT = '/Site/Feature';
export const SERVICE_CARD_COMPONENT = '/Site/ServiceCard';
export const STEP_COMPONENT = '/Site/Step';
export const STAT_COMPONENT = '/Site/Stat';
export const PHOTO_CARD_COMPONENT = '/Site/PhotoCard';
export const WORK_CARD_COMPONENT = '/Site/WorkCard';
export const CASE_STUDY_COMPONENT = '/Site/CaseStudy';
export const FILTER_PILL_COMPONENT = '/Site/FilterPill';

/** The app-wide variable the pills write and the work list reads. One name, spelled once. */
export const WORK_FILTER_VARIABLE = 'workFilter';
export const QUOTE_COMPONENT = '/Site/Quote';
export const QUOTE_CAROUSEL_COMPONENT = '/Site/QuoteCarousel';
export const FAQ_ROW_COMPONENT = '/Site/FaqRow';
export const HOURS_ROW_COMPONENT = '/Site/HoursRow';
export const CHECK_COMPONENT = '/Site/Check';
export const MOCK_COMPONENT = '/Site/Mock';
export const BIG_STAT_COMPONENT = '/Site/BigStat';
export const PLAN_COMPONENT = '/Site/Plan';
export const FIELD_COMPONENT = '/Site/Field';
export const EMAIL_CHECK_COMPONENT = '/Site/IsValidEmail';

export const PAGE_FREELANCER = '/Pages/Freelancer';
export const PAGE_BUSINESS = '/Pages/Business';
export const PAGE_LAUNCH = '/Pages/Launch';

/** The label prefix the editor's node tree lists, and `START-HERE.md` is built from. */
export const EDIT = 'EDIT — ';

/** The address the form sends to until somebody changes it. Obviously unfinished, on purpose. */
export const PLACEHOLDER_ADDRESS = 'EDIT ME — you@example.com';

// ── The class names the page scrolls to ──────────────────────────────────────

/**
 * TPL-004 — a scroll target is a class on a band, and **the name is derived
 * rather than typed at both ends**. A nav link that aims at `section-flwork`
 * while the band says `section-flWork` scrolls nowhere, silently, and a
 * screenshot cannot see it: `sectionClass()` makes the pair impossible to
 * mistype because there is only one spelling of it.
 */
export const sectionClass = (id: string) => `section-${id}`;

/** The contact band, the one destination every page has. Named, because the header aims at it blind. */
export const CONTACT_CLASS = 'site-contact';

/** The sticky header. 🔴 `SCROLL_SCRIPT` measures its height to offset every scroll — renaming it here and nowhere else sends every jump a header too far. */
export const HEADER_CLASS = 'site-header';

const COLUMNS_NODE = 'net.noodl.visual.columns';
const ICON_NODE = 'net.noodl.visual.icon';
const BUTTON_NODE = 'net.noodl.controls.button';
const INPUT_NODE = 'net.noodl.controls.textinput';
const LINK_NODE = 'net.noodl.externallink';
const CSS_NODE = 'CSS Definition';
const FUNCTION_NODE = 'JavaScriptFunction';
const STATES_NODE = 'States';
const STATIC_DATA_NODE = 'Static Data';
const FOR_EACH_NODE = 'For Each';
const FILTER_NODE = 'Filter Collection';
const VARIABLE_NODE = 'Variable2';
const SET_VARIABLE_NODE = 'Set Variable';
const EXPRESSION_NODE = 'Expression';
const FORMAT_NODE = 'String Format';
const AND_NODE = 'And';
const COUNTER_NODE = 'Counter';
const SHOW_POPUP_NODE = 'NavigationShowPopup';
const CLOSE_POPUP_NODE = 'NavigationClosePopup';

const px = (value: number) => ({ value, unit: 'px' });
const pct = (value: number) => ({ value, unit: '%' });

// ── The look, from the product's own vocabulary ──────────────────────────────

const H_HERO = { ...composition('displayHeadline'), as: 'h1' };
const H_SECTION = { ...composition('sectionHeading'), as: 'h2' };
const H_CARD = { ...composition('cardTitle'), as: 'h3' };
const T_EYEBROW = { ...composition('eyebrow'), as: 'span' };
const T_LEAD = composition('lead');
const T_BODY = composition('body');
const T_META = composition('meta');
const T_LABEL = composition('fieldLabel');
const T_HINT = composition('fieldHint');

/** Type on a dark ground. Every colour the compositions carry was chosen against paper. */
const ON_DARK = { color: 'var(--primary-foreground)' };

const CARD = composition('card');
const CARD_BODY = composition('cardBody');
/** The card's padding laid out as a ROW. `rowGap` is never read on a row, and the door says so. */
const { rowGap: _cardBodyRowGap, ...CARD_BODY_ROW } = CARD_BODY;

/** The one centred container inside a band. `alignX` is what centres it — see `PAGE_GROUND` in TPL-001. */
const SHELL = { ...composition('shell'), sizeMode: 'contentHeight', alignX: 'center', rowGap: 'var(--space-6)' };
/** The same shell laid out as a row — `rowGap` is never read on a row, and the door says so. */
const { rowGap: _shellRowGap, ...SHELL_ROW_BASE } = SHELL;
const SHELL_ROW = { ...SHELL_ROW_BASE, flexDirection: 'row' };

/**
 * A band. `sizeMode: 'contentHeight'` is added to the composition: a `Group`
 * with no `sizeMode` is `flex-grow: 100` in a column, and the column these sit
 * in is floored at the viewport, so one of them would swallow the slack on a
 * short page.
 */
const BAND = { ...composition('band'), sizeMode: 'contentHeight', as: 'section' };
const BAND_SURFACE = { ...composition('bandSurface'), sizeMode: 'contentHeight', as: 'section' };

const SECTION_HEAD = composition('sectionHead');

/**
 * A photograph as a band that GROWS with what is on it. The composition pins
 * `height: 520`, which at 390px wide is shorter than a headline, a line, two
 * buttons and a strip of numbers; `contentHeight` with a floor keeps the
 * photograph tall on a desktop and lets it stretch on a phone.
 */
const { height: _imageGroundHeight, ...IMAGE_GROUND_BASE } = composition('imageGround');
const IMAGE_GROUND = { ...IMAGE_GROUND_BASE, sizeMode: 'contentHeight', minHeight: px(640), paddingTop: 'var(--space-24)', paddingBottom: 'var(--space-16)' };

const PRIMARY = composition('primaryButton');
const OUTLINE = composition('outlineButton');

/** The secondary action on a gradient or a photograph: glass, not an invisible outline. */
const GLASS_BUTTON = {
  ...OUTLINE,
  backgroundColor: 'var(--surface-glass)',
  borderColor: 'var(--border-glass)',
  color: 'var(--primary-foreground)'
};

/** The one filled action on a `--gradient-brand` band, where the filled button would vanish. */
const ON_BRAND_BUTTON = { ...PRIMARY, backgroundColor: 'var(--primary-foreground)', color: 'var(--primary)' };

const FIELD = composition('field');
const TEXT_FIELD = composition('textField');

/** The 44px tinted square a glyph or a step number sits in. */
const BADGE_SQUARE = {
  sizeMode: 'explicit',
  width: px(44),
  height: px(44),
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--accent)',
  borderRadius: 'var(--radius-lg)'
};

/**
 * The button row, made to WRAP. `actionRow` is `contentSize`, and a
 * content-sized row of three buttons is 404px wide on a 390px phone — the third
 * button was photographed cut off at the right edge. At the shell's width the
 * composition's own `flexWrap` has something to wrap within.
 */
const ACTIONS = { ...composition('actionRow'), sizeMode: 'contentHeight', width: pct(100) };

/** The glass composition without its `width`, which is inert on a content-sized panel and the door refuses. */
const { width: _glassWidth, ...GLASS_STRIP } = composition('glassPanel');

/** A pill on a dark ground — the composition as written. */
const PILL = composition('badge');

/**
 * TPL-004 — the `States` node behind every row that opens: the FAQ answers, the
 * expandable services, the things a business sells.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **One `States`, not a `Condition` pair.** Whether the detail is on screen
 * and which way the chevron points are two faces of one fact; carried by two
 * nodes they drift the first time one is rewired. The interface doctrine names
 * the alternative as the pattern *"written badly"*.
 *
 * 🔴 **`mounted`, never `visible`.** `visible` sets `visibility: hidden` and
 * **keeps the space** — a closed answer would still cost its full height, so a
 * column of four closed questions would be as tall as four open ones and the
 * accordion would look broken rather than closed. `mounted` removes the element.
 *
 * ⚠️ **The chevron turns and the panel does not.** `useTransitions` can tween a
 * height, which is the prettier accordion — and a fixed pixel height for a
 * paragraph that rewraps at 390px clips its own words. A card that opens
 * instantly is a smaller failure than a card that eats its copy on a phone, so
 * the motion is on the one thing whose size is known: a 20px chevron.
 */
const DISCLOSURE_STATES = {
  states: 'closed,open',
  values: 'chevron',
  'type-chevron': 'number',
  'value-closed-chevron': 0,
  'value-open-chevron': 180,
  useTransitions: true
};

function glyph(code: string): Record<string, unknown> {
  return { class: 'lucide', code: `icon-${code}`, codeAsClass: true };
}

function icon(id: string, label: string, parent: string, code: string, size: number, color: string): unknown {
  return {
    id,
    type: ICON_NODE,
    label,
    parent,
    parameters: { iconIconSource: glyph(code), iconSize: px(size), iconColor: color }
  };
}

function text(id: string, label: string, parent: string, value: string, params: Record<string, unknown>): unknown {
  return { id, type: 'Text', label, parent, parameters: { text: value, ...params } };
}

function group(
  id: string,
  label: string,
  parent: string | undefined,
  params: Record<string, unknown>,
  children?: string[]
): unknown {
  const node: Record<string, unknown> = { id, type: 'Group', label, parameters: params };
  if (parent) node.parent = parent;
  if (children) node.children = children;
  return node;
}

function button(id: string, label: string, parent: string, params: Record<string, unknown>): unknown {
  return { id, type: BUTTON_NODE, label, parent, parameters: { label, ...params } };
}

/** A component instance, placed. */
function place(id: string, type: string, label: string, parent: string, parameters?: Record<string, unknown>): unknown {
  const node: Record<string, unknown> = { id, type, label, parent };
  if (parameters) node.parameters = parameters;
  return node;
}

/** `Component Inputs` — the ONLY thing that makes an instance parameter arrive. */
function inputs(id: string, label: string, names: string[]): unknown {
  return { id, type: 'Component Inputs', label, ports: names.map((name) => ({ name, type: 'string', plug: 'output' })) };
}

/**
 * The same, when a port is not a string. TPL-004 needs signal and array ports —
 * a `go` a caller fires, a list a repeater walks — and a signal declared as a
 * string is a port that accepts a value and never fires anything.
 */
function typedInputs(id: string, label: string, ports: Array<[string, string]>): unknown {
  return { id, type: 'Component Inputs', label, ports: ports.map(([name, type]) => ({ name, type, plug: 'output' })) };
}

/** `Component Outputs` — what leaves a component. `plug: 'input'`, the mirror of the above. */
function outputs(id: string, label: string, ports: Array<[string, string]>): unknown {
  return { id, type: 'Component Outputs', label, ports: ports.map(([name, type]) => ({ name, type, plug: 'input' })) };
}

/**
 * A node with no parent — a logic node, or an instance of a component that draws
 * nothing. `place()` insists on a parent because everything it placed until
 * TPL-004 was visual; a `Site/ScrollTo` has nowhere to be drawn.
 */
function logic(id: string, type: string, label: string, parameters?: Record<string, unknown>): unknown {
  const node: Record<string, unknown> = { id, type, label };
  if (parameters) node.parameters = parameters;
  return node;
}

/** One wire, spelled the short way — TPL-004 adds about a hundred of them. */
function wire(fromId: string, fromProperty: string, toId: string, toProperty: string): unknown {
  return { fromId, fromProperty, toId, toProperty };
}

// ── The app shell ────────────────────────────────────────────────────────────

export const APP_COMPONENT = 'App';

/**
 * TPL-004 — hover, press and the photograph that moves, in the one place a
 * node port cannot say them.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **Why a stylesheet and not a `States` node per hoverable thing.** `Group`
 * publishes `hoverStart`/`hoverEnd`, so the node-native route exists: a `States`
 * per card, per pill, per link — about thirty extra nodes across nine
 * components, every one of them a thing to keep in step, and **none of them able
 * to say `:hover img { transform }`**, because a parent's hover cannot reach a
 * child's parameter without another wire. `CSS Definition`'s stated job is
 * exactly this, and it is one node.
 *
 * ⚠️ **Nothing here uses `var(--shadow-*)`, and that is not an oversight.** This
 * template sets all five shadow tokens to `none` (`tpl003Theme.ts`) because its
 * look is paper and ink. A hover written as a shadow would be invisible in the
 * template that ships and visible only if somebody changed the tokens — a rule
 * that appears to work and does nothing, which is the worst kind. The lift is a
 * transform and a border, both of which this palette can show.
 *
 * ⚠️ **There IS a `:disabled` rule, and it is worth knowing why it works here.**
 * The `Button` control renders a real `<button disabled>` (`Button.tsx`), so the
 * pseudo-class matches and a disabled Send genuinely refuses the click. A
 * `Group` does not — it is a `div`, and a Group's "disabled" look has to come
 * from its own ports. The rule is written for the control it applies to.
 *
 * The last block is not decoration: a person who has asked their operating
 * system to stop moving things gets a page that does not move.
 */
export const INTERACTION_CSS = `/* The landing pages — interaction states.
   Anything a node port can express is set on the node, not here.
   Every rule is opt-in: a node joins by setting its "cssClassName" input. */

.pressable { cursor: pointer; }
/* A real <button disabled> — the Button control renders one, so this matches.
   It is what tells somebody the form is not finished yet. */
button.pressable:disabled { opacity: 0.45; cursor: not-allowed; }

/* A card that answers the pointer. No shadow — this template's shadow tokens
   are all "none", so a shadow here would be a rule that does nothing. */
.card-lift {
  transition: transform var(--duration-200) var(--ease-out),
              border-color var(--duration-200) var(--ease-out);
}
.card-lift:hover { transform: translateY(-3px); border-color: var(--border-strong); }
.card-lift:active { transform: translateY(-1px); }

/* The photograph moves inside the card's own clip box, so the cut corners stay cut. */
.photo-zoom img { transition: transform var(--duration-500) var(--ease-out); }
.photo-zoom:hover img { transform: scale(1.04); }

.nav-link { cursor: pointer; transition: color var(--duration-150) var(--ease-out); }
.nav-link:hover { color: var(--primary); }

/* A row that opens: the question, the service, the thing with an answer under it. */
.disclosure { cursor: pointer; transition: color var(--duration-150) var(--ease-out); }
.disclosure:hover { color: var(--primary); }

.pill {
  transition: background-color var(--duration-150) var(--ease-out),
              border-color var(--duration-150) var(--ease-out),
              color var(--duration-150) var(--ease-out);
}
.pill:hover { border-color: var(--primary); }

@media (prefers-reduced-motion: reduce) {
  .card-lift, .photo-zoom img, .nav-link, .disclosure, .pill { transition: none; }
  .card-lift:hover, .card-lift:active { transform: none; }
  .photo-zoom:hover img { transform: none; }
}
`;

/**
 * 🔴 **The stylesheet lives on `App`, not on each page.** It is one node that
 * mounts for the life of the app, beside the router every page renders into —
 * so there is one copy to edit and no way for three copies to drift. A page is
 * the wrong home for a rule three pages share.
 */
export const APP_NODES = [
  group('app_root', 'App', undefined, { sizeMode: 'explicit', width: pct(100), height: pct(100) }, ['app_router']),
  { id: 'app_router', type: 'Router', label: 'Main router', parent: 'app_root', parameters: { name: ROUTER } },
  logic('app_css', CSS_NODE, 'Hover and press — the whole site', { style: INTERACTION_CSS })
];
export const APP_WIRES: unknown[] = [];

// ── Site/ScrollTo — one button, one section, on any page ─────────────────────

/**
 * TPL-004 — the utility every "take me to that bit of the page" wire goes
 * through. `target` is a **class name**; `go` is the signal that fires it.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **This replaces `Scroll To Element`, and the reason is a port count.** A
 * `Group` holds exactly ONE `Scroll To Element - Element`. TPL-003 wired the
 * page ground's to the contact band and the `main`'s to one other section, and
 * that was the ceiling: two destinations per page, both of them spelled by
 * wiring a `this` output across a component boundary. A header with three nav
 * links needs three more, and there are no more ports.
 *
 * A class name has no such limit, costs one string on the section it names, and
 * is the same mechanism a person would reach for if they wrote the page by
 * hand.
 *
 * ⚠️ **`runOnChange-in-target` is off.** `Run` is ADDITIVE on a
 * `JavaScriptFunction`: with it on, setting the target would scroll the page —
 * so placing this node would move the reader on mount. The `go` signal is the
 * only trigger.
 *
 * ⚠️ **The offset is measured, not assumed.** The header is sticky, so it
 * covers whatever lands at the top of the viewport; the script reads the
 * header's real height at the moment of the scroll rather than carrying a
 * number that goes stale the first time somebody changes the padding.
 *
 * ⚠️ **`behavior` is chosen per reader.** Somebody who has asked their system
 * to stop animating things gets a jump, not a glide — the same decision the
 * stylesheet's last block makes, made again here because a `scrollTo` does not
 * read CSS.
 */
export const SCROLL_SCRIPT =
  "var target = Inputs.target;\n" +
  "if (!target) { Outputs.missing(); return; }\n" +
  "\n" +
  "var section = document.querySelector('.' + target);\n" +
  "if (!section) { Outputs.missing(); return; }\n" +
  "\n" +
  "// The header sticks, so it covers the top of whatever we scroll to.\n" +
  "var header = document.querySelector('." + HEADER_CLASS + "');\n" +
  "var headerHeight = header ? header.getBoundingClientRect().height : 0;\n" +
  "var top = section.getBoundingClientRect().top + window.scrollY - headerHeight;\n" +
  "\n" +
  "var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n" +
  "window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });\n" +
  "Outputs.done();";

const SCROLL_TO: Tpl003Component = {
  path: 'Site/ScrollTo',
  nodes: [
    typedInputs('scInputs', 'Where to go', [
      ['target', 'string'],
      ['go', 'signal']
    ]),
    logic('scFn', FUNCTION_NODE, 'Find the section and scroll to it', {
      functionScript: SCROLL_SCRIPT,
      'runOnChange-in-target': false
    }),
    // `missing` is not decoration: a target nobody spelled right is the one way
    // this fails, and a failure nothing reports is a failure nobody finds.
    outputs('scOutputs', 'What happened', [
      ['done', 'signal'],
      ['missing', 'signal']
    ])
  ],
  connections: [
    wire('scInputs', 'target', 'scFn', 'in-target'),
    wire('scInputs', 'go', 'scFn', 'run'),
    wire('scFn', 'out-done', 'scOutputs', 'done'),
    wire('scFn', 'out-missing', 'scOutputs', 'missing')
  ]
};

// ── Site/Switcher — the strip a person deletes ───────────────────────────────

/**
 * 🔴 **The one node in the template that must not ship on a real site**, and it
 * is built to be obvious about it: an accent strip above the header, a sentence
 * that says what it is and what to do with it, three buttons. It is a component
 * so that deleting it is one act rather than three, and its text node carries
 * the `EDIT —` label so `START-HERE.md` lists it beside everything else.
 */
const SWITCHER: Tpl003Component = {
  path: 'Site/Switcher',
  nodes: [
    group(
      'swStrip',
      'The look switcher',
      undefined,
      {
        width: pct(100),
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'var(--accent)',
        paddingTop: 'var(--space-3)',
        paddingBottom: 'var(--space-3)'
      },
      ['swShell']
    ),
    group(
      'swShell',
      'Shell',
      'swStrip',
      // A column: the sentence, then the three buttons under it. A row with
      // `space-between` was tried and the door named the defect — both children
      // take the shell's width, so there is nothing to push apart.
      { ...SHELL, rowGap: 'var(--space-3)' },
      ['swText', 'swRow']
    ),
    text(
      'swText',
      `${EDIT}the look switcher (delete this strip before you publish)`,
      'swShell',
      'Three looks ship with this template. Keep the one you want, delete the other two pages, then delete this strip.',
      { ...T_META, color: 'var(--accent-foreground)', fontWeight: 'var(--font-medium)' }
    ),
    group('swRow', 'The three looks', 'swShell', ACTIONS, [
      'swFreelancer',
      'swBusiness',
      'swLaunch'
    ]),
    button('swFreelancer', 'Freelancer', 'swRow', { ...OUTLINE, paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }),
    button('swBusiness', 'Local business', 'swRow', { ...OUTLINE, paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }),
    button('swLaunch', 'Product launch', 'swRow', { ...OUTLINE, paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }),
    { id: 'swToFreelancer', type: 'RouterNavigate', label: 'Go to the freelancer look', parameters: { router: ROUTER, target: PAGE_FREELANCER } },
    { id: 'swToBusiness', type: 'RouterNavigate', label: 'Go to the local business look', parameters: { router: ROUTER, target: PAGE_BUSINESS } },
    { id: 'swToLaunch', type: 'RouterNavigate', label: 'Go to the product launch look', parameters: { router: ROUTER, target: PAGE_LAUNCH } }
  ],
  connections: [
    { fromId: 'swFreelancer', fromProperty: 'onClick', toId: 'swToFreelancer', toProperty: 'navigate' },
    { fromId: 'swBusiness', fromProperty: 'onClick', toId: 'swToBusiness', toProperty: 'navigate' },
    { fromId: 'swLaunch', fromProperty: 'onClick', toId: 'swToLaunch', toProperty: 'navigate' }
  ],
  deferred: ['swToFreelancer', 'swToBusiness', 'swToLaunch']
};

// ── Site/Header — the wordmark, three nav links and the way to the form ──────

/**
 * TPL-004 rebuilt this. It was a wordmark and one button whose click left
 * through a `Component Outputs` signal for the page to wire into its own
 * ground's `Scroll To Element`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **Three things changed, and the first one is why the other two are
 * possible.**
 *
 * 1. **The header scrolls itself.** Every destination is a `Site/ScrollTo`
 *    instance living right here, aimed by a class name — so the page no longer
 *    has to lend the header a port, and the header is no longer limited to the
 *    one destination a `Group` has a `Scroll To Element - Element` for. The
 *    `Component Outputs` signal is gone because nothing needs it.
 * 2. **It carries a nav.** Three links, labelled and aimed per page through
 *    `Component Inputs` — so one component serves three pages with three
 *    different section lists, and a person renaming a section changes one
 *    parameter on one instance.
 * 3. **It sticks.** `position: sticky` + `alignY: 'top'` + a `zIndex`, the
 *    shape measured in `Landing page test V2`. ⚠️ The band's background must
 *    stay opaque — a translucent sticky header shows the page sliding through
 *    it — and `site-header` is the class `SCROLL_SCRIPT` measures the offset
 *    from, so renaming it silently sends every scroll a header's height too far.
 *
 * ⚠️ **The shell wraps rather than hiding the nav on a phone.** The obvious
 * alternative is `display: none` under 720px, which is what most sites do and
 * which costs the phone reader the links entirely. Wrapping puts them on a
 * second row, where they still work.
 */
const HEADER: Tpl003Component = {
  path: 'Site/Header',
  nodes: [
    group(
      'hdBand',
      'The header',
      undefined,
      {
        width: pct(100),
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        alignItems: 'center',
        as: 'header',
        position: 'sticky',
        alignY: 'top',
        zIndex: 50,
        backgroundColor: 'var(--background)',
        borderBottomStyle: 'solid',
        borderBottomWidth: 'var(--border-1)',
        borderBottomColor: 'var(--border)',
        paddingTop: 'var(--space-4)',
        paddingBottom: 'var(--space-4)',
        cssClassName: HEADER_CLASS
      },
      ['hdShell']
    ),
    group(
      'hdShell',
      'Shell',
      'hdBand',
      {
        ...SHELL_ROW,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        columnGap: 'var(--space-6)',
        rowGap: 'var(--space-3)'
      },
      ['hdMark', 'hdNav', 'hdContact']
    ),
    group(
      'hdMark',
      'The wordmark',
      'hdShell',
      { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-3)' },
      ['hdGlyphBox', 'hdName']
    ),
    group('hdGlyphBox', 'The mark', 'hdMark', { ...BADGE_SQUARE, width: px(36), height: px(36), borderRadius: 'var(--radius-md)' }, [
      'hdGlyph'
    ]),
    icon('hdGlyph', 'The glyph', 'hdGlyphBox', 'sparkles', 18, 'var(--accent-foreground)'),
    text('hdName', `${EDIT}your name, or the business’s`, 'hdMark', 'Your name here', {
      ...T_BODY,
      fontWeight: 'var(--font-semibold)',
      fontSize: 'var(--text-lg)'
    }),
    group(
      'hdNav',
      'The nav',
      'hdShell',
      { sizeMode: 'contentSize', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 'var(--space-6)', rowGap: 'var(--space-2)', as: 'nav' },
      ['hdLink1', 'hdLink2', 'hdLink3']
    ),
    ...[1, 2, 3].map((n) =>
      text(`hdLink${n}`, `Nav link ${n}`, 'hdNav', '', {
        ...T_BODY,
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-medium)',
        color: 'var(--muted-foreground)',
        sizeMode: 'contentSize',
        cssClassName: 'nav-link'
      })
    ),
    button('hdContact', 'Get in touch', 'hdShell', { ...OUTLINE, cssClassName: 'pressable' }),
    ...[1, 2, 3].map((n) => logic(`hdGo${n}`, SCROLL_TO_COMPONENT, `Nav link ${n} — where it goes`)),
    // The one destination that is the same on all three pages, so it is spelled
    // here rather than asked for.
    logic('hdGoContact', SCROLL_TO_COMPONENT, 'Get in touch — where it goes', { target: CONTACT_CLASS }),
    inputs('hdInputs', 'The nav', ['nav1', 'nav1Target', 'nav2', 'nav2Target', 'nav3', 'nav3Target'])
  ],
  connections: [
    ...[1, 2, 3].flatMap((n) => [
      wire('hdInputs', `nav${n}`, `hdLink${n}`, 'text'),
      wire('hdInputs', `nav${n}Target`, `hdGo${n}`, 'target'),
      wire(`hdLink${n}`, 'onClick', `hdGo${n}`, 'go')
    ]),
    wire('hdContact', 'onClick', 'hdGoContact', 'go')
  ]
};

// ── Site/Footer — the foot of every page ─────────────────────────────────────

const FOOTER: Tpl003Component = {
  path: 'Site/Footer',
  nodes: [
    group('ftBand', 'The foot of the page', undefined, { ...composition('footerBand'), as: 'footer' }, ['ftShell']),
    group('ftShell', 'Shell', 'ftBand', { ...SHELL, rowGap: 'var(--space-2)' }, ['ftMark', 'ftReach', 'ftSmall']),
    group(
      'ftMark',
      'The wordmark',
      'ftShell',
      { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-2)', paddingBottom: 'var(--space-3)' },
      ['ftGlyph', 'ftName']
    ),
    icon('ftGlyph', 'The glyph', 'ftMark', 'sparkles', 18, 'var(--primary)'),
    text('ftName', `${EDIT}the name in the footer`, 'ftMark', 'Your name here', { ...T_BODY, fontWeight: 'var(--font-semibold)' }),
    text('ftReach', `${EDIT}how to reach you`, 'ftShell', 'Your phone number, your address, and when you are open.', T_META),
    text('ftSmall', `${EDIT}the small print`, 'ftShell', '© Your name · Your town. Delete this line or write your own.', T_META)
  ],
  connections: []
};

// ── Site/Feature — a glyph, a title, a line ──────────────────────────────────

/**
 * ⚠️ **The glyph arrives as a NAME and is turned into an icon source inside.**
 * `iconIconSource` takes `{ class, code, codeAsClass }`, which is not a value a
 * string port can carry, so a one-line function builds it from the `icon`
 * input. That is what lets three features on one page wear three glyphs from
 * one component.
 */
const FEATURE: Tpl003Component = {
  path: 'Site/Feature',
  nodes: [
    group('feItem', 'One feature', undefined, composition('featureItem'), ['feBadge', 'feWords']),
    group('feBadge', 'The badge', 'feItem', BADGE_SQUARE, ['feGlyph']),
    icon('feGlyph', 'The glyph', 'feBadge', 'sparkles', 22, 'var(--accent-foreground)'),
    group('feWords', 'The words', 'feItem', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-1)' }, [
      'feTitle',
      'feLine'
    ]),
    text('feTitle', 'What it is', 'feWords', '', H_CARD),
    text('feLine', 'What it means for them', 'feWords', '', { ...T_BODY, color: 'var(--muted-foreground)' }),
    inputs('feInputs', 'The feature', ['icon', 'title', 'line']),
    {
      id: 'feSource',
      type: 'JavaScriptFunction',
      label: 'The glyph, from its name',
      parameters: {
        functionScript:
          "Outputs.source = { class: 'lucide', code: 'icon-' + (Inputs.icon || 'sparkles'), codeAsClass: true };"
      }
    }
  ],
  connections: [
    { fromId: 'feInputs', fromProperty: 'title', toId: 'feTitle', toProperty: 'text' },
    { fromId: 'feInputs', fromProperty: 'line', toId: 'feLine', toProperty: 'text' },
    { fromId: 'feInputs', fromProperty: 'icon', toId: 'feSource', toProperty: 'in-icon' },
    { fromId: 'feSource', fromProperty: 'out-source', toId: 'feGlyph', toProperty: 'iconIconSource' }
  ]
};

// ── Site/Step — a number, a title, a line ────────────────────────────────────

const STEP: Tpl003Component = {
  path: 'Site/Step',
  nodes: [
    group('stItem', 'One step', undefined, composition('featureItem'), ['stBadge', 'stWords']),
    group('stBadge', 'The number', 'stItem', { ...BADGE_SQUARE, borderRadius: 'var(--radius-full)' }, ['stNumber']),
    text('stNumber', 'Which step', 'stBadge', '', {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-bold)',
      letterSpacing: 'var(--tracking-wide)',
      color: 'var(--accent-foreground)'
    }),
    group('stWords', 'The words', 'stItem', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-1)' }, [
      'stTitle',
      'stLine'
    ]),
    text('stTitle', 'What happens', 'stWords', '', H_CARD),
    text('stLine', 'How', 'stWords', '', { ...T_BODY, color: 'var(--muted-foreground)' }),
    inputs('stInputs', 'The step', ['number', 'title', 'line'])
  ],
  connections: [
    { fromId: 'stInputs', fromProperty: 'number', toId: 'stNumber', toProperty: 'text' },
    { fromId: 'stInputs', fromProperty: 'title', toId: 'stTitle', toProperty: 'text' },
    { fromId: 'stInputs', fromProperty: 'line', toId: 'stLine', toProperty: 'text' }
  ]
};

// ── Site/Stat — a number and what it counts ──────────────────────────────────

/**
 * No fill of its own: the business page stands three of these on a glass panel
 * over a photograph, the launch page puts three in `statTile` cards. The
 * `color` input is what lets one component be read on both grounds.
 */
const STAT: Tpl003Component = {
  path: 'Site/Stat',
  nodes: [
    group('saItem', 'One number', undefined, { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-1)' }, [
      'saValue',
      'saLabel'
    ]),
    text('saValue', 'The number', 'saItem', '', {
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-none)',
      letterSpacing: 'var(--tracking-tight)',
      color: 'var(--foreground)'
    }),
    text('saLabel', 'What it counts', 'saItem', '', {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-semibold)',
      letterSpacing: 'var(--tracking-widest)',
      textTransform: 'uppercase',
      color: 'var(--muted-foreground)'
    }),
    inputs('saInputs', 'The stat', ['value', 'label', 'color'])
  ],
  connections: [
    { fromId: 'saInputs', fromProperty: 'value', toId: 'saValue', toProperty: 'text' },
    { fromId: 'saInputs', fromProperty: 'label', toId: 'saLabel', toProperty: 'text' },
    { fromId: 'saInputs', fromProperty: 'color', toId: 'saValue', toProperty: 'color' },
    { fromId: 'saInputs', fromProperty: 'color', toId: 'saLabel', toProperty: 'color' }
  ]
};

// ── Site/PhotoCard — a photograph with a title under it ──────────────────────

/**
 * TPL-004 — a photograph, a line, and the rest of it behind a chevron.
 *
 * ⚠️ **`photo-zoom` needs the card's `clip`, and it has it.** The `card`
 * composition sets `clip: true`, so the photograph can scale inside the rounded
 * corners without spilling past them. Take the clip away and the hover grows a
 * square photograph out of a rounded card.
 */
const PHOTO_CARD: Tpl003Component = {
  path: 'Site/PhotoCard',
  nodes: [
    group('pcCard', 'One card', undefined, { ...CARD, cssClassName: 'card-lift photo-zoom' }, ['pcPhoto', 'pcBody']),
    {
      id: 'pcPhoto',
      type: 'Image',
      label: 'The photograph',
      parent: 'pcCard',
      // `cardImage`: without `sizeMode: explicit` the height and `objectFit` are inert,
      // and three cards of different natural heights are the tell one level down.
      parameters: { ...composition('cardImage'), height: px(220), src: '', alt: '' }
    },
    group('pcBody', 'The words', 'pcCard', { ...CARD_BODY, sizeMode: 'contentHeight', rowGap: 'var(--space-2)' }, ['pcHead', 'pcLine', 'pcDetail']),
    group(
      'pcHead',
      'The title, and the chevron',
      'pcBody',
      { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 'var(--space-3)', cssClassName: 'disclosure' },
      ['pcTitle', 'pcChevron']
    ),
    text('pcTitle', 'What it is', 'pcHead', '', H_CARD),
    icon('pcChevron', 'Open or closed', 'pcHead', 'chevron-down', 18, 'var(--muted-foreground)'),
    text('pcLine', 'A line about it', 'pcBody', '', T_META),
    text('pcDetail', 'The rest of it', 'pcBody', '', { ...T_BODY, color: 'var(--muted-foreground)', mounted: false }),
    logic('pcStates', STATES_NODE, 'Closed / open', { ...DISCLOSURE_STATES }),
    inputs('pcInputs', 'The card', ['picture', 'alt', 'title', 'line', 'detail'])
  ],
  connections: [
    wire('pcInputs', 'picture', 'pcPhoto', 'src'),
    wire('pcInputs', 'alt', 'pcPhoto', 'alt'),
    wire('pcInputs', 'title', 'pcTitle', 'text'),
    wire('pcInputs', 'line', 'pcLine', 'text'),
    wire('pcInputs', 'detail', 'pcDetail', 'text'),
    wire('pcHead', 'onClick', 'pcStates', 'toggle'),
    wire('pcStates', 'at-open', 'pcDetail', 'mounted'),
    wire('pcStates', 'chevron', 'pcChevron', 'transformRotation')
  ]
};

// ── Site/ServiceCard — what one person sells, and the detail of it ───────────

/**
 * TPL-004. The freelancer page's three services were `Site/Feature`: a glyph, a
 * title and one line, three times, and nothing else could ever be said about
 * them. A service is the thing being sold, so it is the one place on that page
 * where somebody actually has more to say — what is included, what they get at
 * the end, what it costs — and a card that cannot hold it forces all of that
 * into a nine-word line or off the page.
 *
 * So: the same glyph and title, plus a price line and a detail that opens.
 * `Site/Feature` is untouched and still does what it does — a reason, a fact, a
 * thing that genuinely is one line — on the business and launch pages.
 */
const SERVICE_CARD: Tpl003Component = {
  path: 'Site/ServiceCard',
  nodes: [
    group('svCard', 'One service', undefined, { ...CARD, cssClassName: 'card-lift' }, ['svHead', 'svDetail']),
    group(
      'svHead',
      'What it is, and the chevron',
      'svCard',
      { ...CARD_BODY_ROW, sizeMode: 'contentHeight', flexDirection: 'row', alignItems: 'flex-start', columnGap: 'var(--space-4)', cssClassName: 'disclosure' },
      ['svBadge', 'svWords', 'svChevron']
    ),
    group('svBadge', 'The badge', 'svHead', BADGE_SQUARE, ['svGlyph']),
    icon('svGlyph', 'The glyph', 'svBadge', 'sparkles', 22, 'var(--accent-foreground)'),
    group('svWords', 'The words', 'svHead', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-1)' }, ['svTitle', 'svPrice', 'svLine']),
    text('svTitle', 'What it is', 'svWords', '', H_CARD),
    text('svPrice', 'What it costs', 'svWords', '', { ...T_META, fontWeight: 'var(--font-semibold)', color: 'var(--primary)' }),
    text('svLine', 'What it means for them', 'svWords', '', { ...T_BODY, color: 'var(--muted-foreground)' }),
    icon('svChevron', 'Open or closed', 'svHead', 'chevron-down', 20, 'var(--muted-foreground)'),
    group(
      'svDetail',
      'The rest of it',
      'svCard',
      {
        ...CARD_BODY,
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        rowGap: 'var(--space-2)',
        paddingTop: 'var(--space-5)',
        borderTopStyle: 'solid',
        borderTopWidth: 'var(--border-1)',
        borderTopColor: 'var(--border-subtle)',
        mounted: false
      },
      ['svDetailText', 'svGetLabel', 'svGet']
    ),
    text('svDetailText', 'How it works', 'svDetail', '', { ...T_BODY, color: 'var(--foreground)' }),
    text('svGetLabel', 'What you get', 'svDetail', 'What you get', {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-semibold)',
      letterSpacing: 'var(--tracking-widest)',
      textTransform: 'uppercase',
      color: 'var(--muted-foreground)'
    }),
    text('svGet', 'What they end up with', 'svDetail', '', { ...T_BODY, color: 'var(--muted-foreground)' }),
    logic('svStates', STATES_NODE, 'Closed / open', { ...DISCLOSURE_STATES }),
    inputs('svInputs', 'The service', ['icon', 'title', 'price', 'line', 'detail', 'deliverable']),
    // The same one-line trick `Site/Feature` uses: `iconIconSource` takes an
    // object, which is not a value a string port can carry.
    logic('svSource', FUNCTION_NODE, 'The glyph, from its name', {
      functionScript: "Outputs.source = { class: 'lucide', code: 'icon-' + (Inputs.icon || 'sparkles'), codeAsClass: true };"
    })
  ],
  connections: [
    wire('svInputs', 'title', 'svTitle', 'text'),
    wire('svInputs', 'price', 'svPrice', 'text'),
    wire('svInputs', 'line', 'svLine', 'text'),
    wire('svInputs', 'detail', 'svDetailText', 'text'),
    wire('svInputs', 'deliverable', 'svGet', 'text'),
    wire('svInputs', 'icon', 'svSource', 'in-icon'),
    wire('svSource', 'out-source', 'svGlyph', 'iconIconSource'),
    wire('svHead', 'onClick', 'svStates', 'toggle'),
    wire('svStates', 'at-open', 'svDetail', 'mounted'),
    wire('svStates', 'chevron', 'svChevron', 'transformRotation')
  ]
};

// ── Site/FilterPill — one category, lit or not ──────────────────────────────

/**
 * TPL-004. A pill that writes `workFilter` and lights up when it is the one
 * selected.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **It emits a state NAME, not a boolean.** An `Expression` reading
 * `((selected || '') === (mine || '')) ? 'on' : 'off'` wires straight into
 * `States.currentState`, which the door's own `States` documentation says is an
 * enum input that selects a state in one wire. A `Condition` driving
 * `to-on`/`to-off` is two more nodes saying the same thing.
 *
 * 🔴 **The `|| ''` on BOTH sides is what makes "All" work on first load.**
 * Nobody has written the variable when the page opens, and the All pill's own
 * value is the empty string — without the guards that is `undefined === ''`,
 * which is false, and the page opens with no pill lit and every card showing.
 * That reads as broken, and it is a two-character fix rather than a `Set
 * Variable` fired from a `didMount`.
 */
const FILTER_PILL: Tpl003Component = {
  path: 'Site/FilterPill',
  nodes: [
    group(
      'fpPill',
      'One pill',
      undefined,
      {
        sizeMode: 'contentSize',
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 'var(--radius-full)',
        borderStyle: 'solid',
        borderWidth: 'var(--border-1)',
        borderColor: 'var(--border-control)',
        backgroundColor: 'transparent',
        paddingLeft: 'var(--space-4)',
        paddingRight: 'var(--space-4)',
        paddingTop: 'var(--space-2)',
        paddingBottom: 'var(--space-2)',
        cssClassName: 'pill pressable'
      },
      ['fpLabel']
    ),
    text('fpLabel', 'What it says', 'fpPill', '', { ...T_META, fontWeight: 'var(--font-medium)', sizeMode: 'contentSize' }),
    logic('fpCurrent', VARIABLE_NODE, 'What is selected, app-wide', { name: WORK_FILTER_VARIABLE }),
    logic('fpState', EXPRESSION_NODE, 'Am I the selected one?', { expression: "((selected || '') === (mine || '')) ? 'on' : 'off'" }),
    logic('fpLook', STATES_NODE, 'Off / on', {
      states: 'off,on',
      values: 'bg,fg,edge',
      'type-bg': 'color',
      'type-fg': 'color',
      'type-edge': 'color',
      'value-off-bg': 'transparent',
      'value-on-bg': 'var(--primary)',
      'value-off-fg': 'var(--foreground)',
      'value-on-fg': 'var(--primary-foreground)',
      'value-off-edge': 'var(--border-control)',
      'value-on-edge': 'var(--primary)',
      useTransitions: true
    }),
    // An unset `value` would write `undefined` into the variable, and `undefined`
    // is not the empty string the filter reads as "everything".
    logic('fpValue', EXPRESSION_NODE, 'The category, or nothing at all', { expression: "v || ''" }),
    logic('fpWrite', SET_VARIABLE_NODE, 'Select this category', { name: WORK_FILTER_VARIABLE, setWith: 'string' }),
    inputs('fpInputs', 'The pill', ['label', 'value'])
  ],
  connections: [
    wire('fpInputs', 'label', 'fpLabel', 'text'),
    wire('fpInputs', 'value', 'fpState', 'mine'),
    wire('fpInputs', 'value', 'fpValue', 'v'),
    wire('fpCurrent', 'value', 'fpState', 'selected'),
    wire('fpState', 'asString', 'fpLook', 'currentState'),
    wire('fpLook', 'bg', 'fpPill', 'backgroundColor'),
    wire('fpLook', 'edge', 'fpPill', 'borderColor'),
    wire('fpLook', 'fg', 'fpLabel', 'color'),
    wire('fpValue', 'asString', 'fpWrite', 'value'),
    wire('fpPill', 'onClick', 'fpWrite', 'do')
  ]
};

// ── Site/WorkCard — one piece of work, and the way into it ──────────────────

/**
 * TPL-004. What `For Each` draws once per row of the work list.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **The card owns its own `Show Popup`, and that is a race the design
 * removes rather than a race it wins.** The obvious wiring is the other way
 * round: the repeater publishes `itemOutputSignal-clicked` and
 * `itemOutput-title`, and the section holds one `NavigationShowPopup` fed from
 * those. But a signal is not a promise that the values beside it have arrived —
 * they are queued per input name and drained a pass at a time — so that version
 * is correct only if `show` happens to be delivered last.
 *
 * Here every data input is wired from this instance's OWN `Component Inputs`,
 * which the repeater settled when it built the row, long before anybody clicked.
 * The click carries the signal and nothing else. No ordering assumption exists
 * to be wrong about.
 *
 * ⚠️ **The nine data ports are `popupParam-<name>`, not `<name>`.** The node's
 * own description says its inputs "mirror the component inputs of the target
 * popup component", which is true of what they are called in the panel and not
 * of what a connection has to name — the same prefix trap the `Function` node
 * carries, and the write gate accepts the bare name in silence.
 */
const WORK_CARD: Tpl003Component = {
  path: 'Site/WorkCard',
  nodes: [
    group('wcCard', 'One piece of work', undefined, { ...CARD, cssClassName: 'card-lift photo-zoom pressable' }, ['wcPhoto', 'wcBody']),
    {
      id: 'wcPhoto',
      type: 'Image',
      label: 'The photograph',
      parent: 'wcCard',
      parameters: { ...composition('cardImage'), height: px(220), src: '', alt: '' }
    },
    group('wcBody', 'The words', 'wcCard', { ...CARD_BODY, sizeMode: 'contentHeight', rowGap: 'var(--space-2)' }, ['wcTag', 'wcTitle', 'wcMeta', 'wcLine', 'wcMore']),
    group('wcTag', 'What kind of work', 'wcBody', { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', backgroundColor: 'var(--accent)', borderRadius: 'var(--radius-full)', paddingLeft: 'var(--space-3)', paddingRight: 'var(--space-3)', paddingTop: 'var(--space-1)', paddingBottom: 'var(--space-1)' }, ['wcTagText']),
    text('wcTagText', 'The kind', 'wcTag', '', { ...T_META, fontWeight: 'var(--font-semibold)', color: 'var(--accent-foreground)', sizeMode: 'contentSize' }),
    text('wcTitle', 'What it was', 'wcBody', '', H_CARD),
    text('wcMeta', 'Who it was for, and when', 'wcBody', '', T_META),
    text('wcLine', 'What changed', 'wcBody', '', { ...T_BODY, color: 'var(--muted-foreground)' }),
    text('wcMore', 'The way in', 'wcBody', 'Read the story →', { ...T_META, fontWeight: 'var(--font-semibold)', color: 'var(--primary)' }),
    logic('wcMetaFmt', FORMAT_NODE, 'Client · year', { format: '{client} · {year}' }),
    logic('wcPopup', SHOW_POPUP_NODE, 'Open this story', { target: CASE_STUDY_COMPONENT, stackPolicy: 'replace' }),
    inputs('wcInputs', 'The piece of work', ['picture', 'alt', 'title', 'client', 'year', 'category', 'summary', 'brief', 'did', 'outcome'])
  ],
  connections: [
    wire('wcInputs', 'picture', 'wcPhoto', 'src'),
    wire('wcInputs', 'alt', 'wcPhoto', 'alt'),
    wire('wcInputs', 'title', 'wcTitle', 'text'),
    wire('wcInputs', 'category', 'wcTagText', 'text'),
    wire('wcInputs', 'summary', 'wcLine', 'text'),
    wire('wcInputs', 'client', 'wcMetaFmt', 'client'),
    wire('wcInputs', 'year', 'wcMetaFmt', 'year'),
    wire('wcMetaFmt', 'formatted', 'wcMeta', 'text'),
    wire('wcCard', 'onClick', 'wcPopup', 'show'),
    // 🔴 `popupParam-`, on every one of the nine.
    ...['picture', 'alt', 'title', 'client', 'year', 'category', 'brief', 'did', 'outcome'].map((name) =>
      wire('wcInputs', name, 'wcPopup', `popupParam-${name}`)
    )
  ]
};

// ── Site/CaseStudy — the story behind a card, over the page ─────────────────

/**
 * TPL-004 — the popup `Site/WorkCard` opens. Three headings, because a case
 * study that is one paragraph is a caption: what they came with, what was done,
 * what happened.
 *
 * 🔴 **`clickBubbling: 'never'` on the panel is not tidiness — without it the
 * popup closes when you click inside it.** The backdrop closes on a click, the
 * panel sits inside the backdrop, and a click on a child runs the ancestor's
 * `Click` as well unless the child's own click is wired or it says never
 * (`pointerlisteners.ts`). Nothing on the panel is clickable, so `auto` does not
 * save it. This is the shape of a defect that renders perfectly.
 */
const CASE_STUDY: Tpl003Component = {
  path: 'Site/CaseStudy',
  nodes: [
    group(
      'csBackdrop',
      'Over the page',
      undefined,
      {
        sizeMode: 'explicit',
        width: pct(100),
        height: pct(100),
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundGradient: 'var(--gradient-scrim)',
        scrollEnabled: true,
        nativeScroll: true,
        paddingTop: 'var(--space-16)',
        paddingBottom: 'var(--space-16)',
        paddingLeft: 'var(--space-4)',
        paddingRight: 'var(--space-4)'
      },
      ['csPanel']
    ),
    group(
      'csPanel',
      'The panel',
      'csBackdrop',
      {
        width: pct(100),
        maxWidth: px(720),
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        backgroundColor: 'var(--background)',
        borderRadius: 'var(--radius-2xl)',
        borderStyle: 'solid',
        borderWidth: 'var(--border-1)',
        borderColor: 'var(--border)',
        clip: true,
        clickBubbling: 'never'
      },
      ['csMedia', 'csBody']
    ),
    group('csMedia', 'The photograph', 'csPanel', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, ['csPhoto']),
    {
      id: 'csPhoto',
      type: 'Image',
      label: 'The photograph',
      parent: 'csMedia',
      parameters: { ...composition('cardImage'), height: px(300), src: '', alt: '' }
    },
    // 🔴 The way out is IN FLOW and it says "Close" in words.
    //
    // It was an absolutely-positioned round button floating over the
    // photograph — prettier, and two things wrong with it. The door refused it
    // (`unsized-absolute-box`: an absolute box with no width or height defaults
    // to 100% of its parent and paints its background across all of it), and the
    // fix that keeps the float is an icon-only button — which this Button node
    // has no way to label, so a screen reader would announce nothing at all.
    group('csCloseRow', 'The way out', 'csBody', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'row', justifyContent: 'flex-end' }, ['csClose']),
    button('csClose', 'Close', 'csCloseRow', {
      sizeMode: 'contentSize',
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderRadius: 'var(--radius-full)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-control)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)',
      paddingTop: 'var(--space-2)',
      paddingBottom: 'var(--space-2)',
      fontSize: 'var(--text-sm)',
      cssClassName: 'pressable'
    }),
    group('csBody', 'The story', 'csPanel', { ...CARD_BODY, sizeMode: 'contentHeight', rowGap: 'var(--space-3)' }, [
      'csCloseRow',
      'csMetaRow',
      'csTitle',
      'csClient',
      'csBriefLabel',
      'csBrief',
      'csDidLabel',
      'csDid',
      'csOutcomeLabel',
      'csOutcome'
    ]),
    group('csMetaRow', 'The kind, and the year', 'csBody', { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-3)' }, ['csTag', 'csYear']),
    group('csTag', 'What kind of work', 'csMetaRow', { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', backgroundColor: 'var(--accent)', borderRadius: 'var(--radius-full)', paddingLeft: 'var(--space-3)', paddingRight: 'var(--space-3)', paddingTop: 'var(--space-1)', paddingBottom: 'var(--space-1)' }, ['csTagText']),
    text('csTagText', 'The kind', 'csTag', '', { ...T_META, fontWeight: 'var(--font-semibold)', color: 'var(--accent-foreground)', sizeMode: 'contentSize' }),
    text('csYear', 'The year', 'csMetaRow', '', { ...T_META, sizeMode: 'contentSize' }),
    text('csTitle', 'What it was', 'csBody', '', { ...H_SECTION, fontSize: 'var(--text-3xl)' }),
    text('csClient', 'Who it was for', 'csBody', '', { ...T_BODY, color: 'var(--muted-foreground)' }),
    ...[
      ['Brief', 'What they came with'],
      ['Did', 'What you did'],
      ['Outcome', 'What happened']
    ].flatMap(([key, heading]) => [
      text(`cs${key}Label`, `${heading} — the label`, 'csBody', heading, {
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-semibold)',
        letterSpacing: 'var(--tracking-widest)',
        textTransform: 'uppercase',
        color: 'var(--primary)'
      }),
      text(`cs${key}`, heading, 'csBody', '', T_BODY)
    ]),
    logic('csClosePopup', CLOSE_POPUP_NODE, 'Put it away', { closeActions: 'close' }),
    inputs('csInputs', 'The story', ['picture', 'alt', 'title', 'client', 'year', 'category', 'brief', 'did', 'outcome'])
  ],
  connections: [
    wire('csInputs', 'picture', 'csPhoto', 'src'),
    wire('csInputs', 'alt', 'csPhoto', 'alt'),
    wire('csInputs', 'title', 'csTitle', 'text'),
    wire('csInputs', 'client', 'csClient', 'text'),
    wire('csInputs', 'year', 'csYear', 'text'),
    wire('csInputs', 'category', 'csTagText', 'text'),
    wire('csInputs', 'brief', 'csBrief', 'text'),
    wire('csInputs', 'did', 'csDid', 'text'),
    wire('csInputs', 'outcome', 'csOutcome', 'text'),
    wire('csClose', 'onClick', 'csClosePopup', 'closeAction-close'),
    wire('csBackdrop', 'onClick', 'csClosePopup', 'closeAction-close')
  ]
};

// ── Site/Quote — what a client said ──────────────────────────────────────────

const QUOTE: Tpl003Component = {
  path: 'Site/Quote',
  nodes: [
    group('quCard', 'One quote', undefined, composition('testimonialCard'), ['quGlyph', 'quText', 'quWho']),
    icon('quGlyph', 'The mark', 'quCard', 'quote', 28, 'var(--accent-foreground)'),
    text('quText', 'What they said', 'quCard', '', {
      fontSize: 'var(--text-lg)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--foreground)'
    }),
    group('quWho', 'Who said it', 'quCard', { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-3)' }, [
      'quFace',
      'quNames'
    ]),
    group('quFace', 'The portrait, rounded', 'quWho', { sizeMode: 'explicit', width: px(44), height: px(44), borderRadius: 'var(--radius-full)', clip: true }, [
      'quPortrait'
    ]),
    {
      id: 'quPortrait',
      type: 'Image',
      label: 'The portrait',
      parent: 'quFace',
      parameters: { sizeMode: 'explicit', objectFit: 'cover', width: pct(100), height: pct(100), src: '', alt: '' }
    },
    group('quNames', 'Name and role', 'quWho', { sizeMode: 'contentSize', flexDirection: 'column' }, ['quName', 'quRole']),
    text('quName', 'Their name', 'quNames', '', T_LABEL),
    text('quRole', 'Who they are', 'quNames', '', T_META),
    inputs('quInputs', 'The quote', ['quote', 'name', 'role', 'portrait', 'alt'])
  ],
  connections: [
    { fromId: 'quInputs', fromProperty: 'quote', toId: 'quText', toProperty: 'text' },
    { fromId: 'quInputs', fromProperty: 'name', toId: 'quName', toProperty: 'text' },
    { fromId: 'quInputs', fromProperty: 'role', toId: 'quRole', toProperty: 'text' },
    { fromId: 'quInputs', fromProperty: 'portrait', toId: 'quPortrait', toProperty: 'src' },
    { fromId: 'quInputs', fromProperty: 'alt', toId: 'quPortrait', toProperty: 'alt' }
  ]
};

// ── Site/QuoteCarousel — one quote at a time, and a way to the next ─────────

/**
 * TPL-004. Both the freelancer page and the business page ended on two quotes
 * side by side, which is the most a row can hold — and two is exactly the number
 * that reads as *"we could only find two"*. A carousel holds as many as somebody
 * has, shows one, and takes up the room of one.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **There is no "the item at index N" node, and this is what there is
 * instead.** `Filter Collection` exposes `filterEnableLimit`, which mints
 * `filterLimit` and `filterSkip` — so a `Counter` driving `filterSkip` with
 * `filterLimit: 1` is a one-item repeater that steps. `limitsEnabled` on the
 * Counter is what stops it walking off either end.
 *
 * ⚠️ **`count` is an input and not worked out from `items`.** An `Expression`
 * reading `(v || []).length` would do it, and `parsePorts` is a text scan that
 * would mint a second port called `length` and then wait for a value nobody is
 * ever going to send it. The page wires both ports from the same `Static Data`
 * node, so the two cannot disagree without somebody rewiring one of them.
 *
 * ⚠️ **The buttons disable at the ends rather than wrapping.** A carousel that
 * wraps gives a person no way to know they have seen all of them.
 */
const QUOTE_CAROUSEL: Tpl003Component = {
  path: 'Site/QuoteCarousel',
  nodes: [
    group('qcRoot', 'The quotes', undefined, { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', alignItems: 'center', rowGap: 'var(--space-6)' }, ['qcStage', 'qcControls']),
    group('qcStage', 'The one showing', 'qcRoot', { width: pct(100), maxWidth: px(720), sizeMode: 'contentHeight', flexDirection: 'column' }, ['qcRepeat']),
    logic('qcRepeat', FOR_EACH_NODE, 'The quote the filter let through', { template: QUOTE_COMPONENT, templateType: 'explicit' }),
    group('qcControls', 'Back, where you are, forward', 'qcRoot', { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-4)' }, ['qcPrev', 'qcPosition', 'qcNext']),
    ...['Prev', 'Next'].map((which) =>
      button(`qc${which}`, which === 'Prev' ? 'Back' : 'Next', 'qcControls', {
        sizeMode: 'contentSize',
        backgroundColor: 'transparent',
        color: 'var(--foreground)',
        borderRadius: 'var(--radius-full)',
        borderStyle: 'solid',
        borderWidth: 'var(--border-1)',
        borderColor: 'var(--border-control)',
        paddingLeft: 'var(--space-5)',
        paddingRight: 'var(--space-5)',
        paddingTop: 'var(--space-2)',
        paddingBottom: 'var(--space-2)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-medium)',
        cssClassName: 'pressable'
      })
    ),
    text('qcPosition', 'Which one of how many', 'qcControls', '', { ...T_META, sizeMode: 'contentSize', fontVariantNumeric: 'tabular-nums' }),
    logic('qcCounter', COUNTER_NODE, 'Which quote is showing', { limitsEnabled: true, limitsMin: 0, startValue: 0 }),
    logic('qcLast', EXPRESSION_NODE, 'The last valid index', { expression: 'total - 1' }),
    logic('qcFilter', FILTER_NODE, 'One quote, skipping to the current index', { filterEnableLimit: true, filterLimit: 1 }),
    logic('qcHuman', EXPRESSION_NODE, 'Where a person would say they are', { expression: 'i + 1' }),
    logic('qcFmt', FORMAT_NODE, 'n of m', { format: '{pos} of {total}' }),
    logic('qcCanPrev', EXPRESSION_NODE, 'Is there one before this?', { expression: 'i > 0' }),
    logic('qcCanNext', EXPRESSION_NODE, 'Is there one after this?', { expression: 'i < total - 1' }),
    typedInputs('qcInputs', 'The quotes', [
      ['items', 'array'],
      ['count', 'number']
    ])
  ],
  connections: [
    wire('qcInputs', 'items', 'qcFilter', 'items'),
    wire('qcFilter', 'items', 'qcRepeat', 'items'),
    wire('qcInputs', 'count', 'qcLast', 'total'),
    wire('qcLast', 'asNumber', 'qcCounter', 'limitsMax'),
    wire('qcCounter', 'currentCount', 'qcFilter', 'filterSkip'),
    wire('qcPrev', 'onClick', 'qcCounter', 'decrease'),
    wire('qcNext', 'onClick', 'qcCounter', 'increase'),
    wire('qcCounter', 'currentCount', 'qcHuman', 'i'),
    wire('qcHuman', 'asNumber', 'qcFmt', 'pos'),
    wire('qcInputs', 'count', 'qcFmt', 'total'),
    wire('qcFmt', 'formatted', 'qcPosition', 'text'),
    wire('qcCounter', 'currentCount', 'qcCanPrev', 'i'),
    wire('qcCanPrev', 'asBoolean', 'qcPrev', 'enabled'),
    wire('qcCounter', 'currentCount', 'qcCanNext', 'i'),
    wire('qcInputs', 'count', 'qcCanNext', 'total'),
    wire('qcCanNext', 'asBoolean', 'qcNext', 'enabled')
  ]
};

// ── Site/FaqRow — a question, and the answer under it ───────────────────────

/**
 * TPL-004 made the answer open. It used to be a question with its answer always
 * under it — which is a list of paragraphs with some of the words in bold, not a
 * set of questions. Eight of these on a page is a wall; eight questions a person
 * can read in one glance and open the one they came for is the thing itself.
 */
const FAQ_ROW: Tpl003Component = {
  path: 'Site/FaqRow',
  nodes: [
    group(
      'fqRow',
      'One question',
      undefined,
      { ...composition('ruled'), flexDirection: 'column', alignItems: 'flex-start', rowGap: 'var(--space-2)', paddingTop: 'var(--space-5)', paddingBottom: 'var(--space-5)' },
      ['fqHead', 'fqAnswer']
    ),
    group(
      'fqHead',
      'The question, and the chevron',
      'fqRow',
      { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', columnGap: 'var(--space-4)', cssClassName: 'disclosure' },
      ['fqQuestion', 'fqChevron']
    ),
    text('fqQuestion', 'The question', 'fqHead', '', { ...H_CARD, fontSize: 'var(--text-lg)' }),
    icon('fqChevron', 'Open or closed', 'fqHead', 'chevron-down', 20, 'var(--muted-foreground)'),
    text('fqAnswer', 'The answer', 'fqRow', '', { ...T_BODY, color: 'var(--muted-foreground)', mounted: false }),
    logic('fqStates', STATES_NODE, 'Closed / open', { ...DISCLOSURE_STATES }),
    inputs('fqInputs', 'The question', ['question', 'answer'])
  ],
  connections: [
    wire('fqInputs', 'question', 'fqQuestion', 'text'),
    wire('fqInputs', 'answer', 'fqAnswer', 'text'),
    wire('fqHead', 'onClick', 'fqStates', 'toggle'),
    wire('fqStates', 'at-open', 'fqAnswer', 'mounted'),
    wire('fqStates', 'chevron', 'fqChevron', 'transformRotation')
  ]
};

// ── Site/HoursRow — a day and when the door is open ──────────────────────────

const HOURS_ROW: Tpl003Component = {
  path: 'Site/HoursRow',
  nodes: [
    group('hrRow', 'One day', undefined, { ...composition('ruled'), justifyContent: 'space-between', columnGap: 'var(--space-4)' }, ['hrDay', 'hrTime']),
    text('hrDay', 'The day', 'hrRow', '', { ...T_BODY, fontWeight: 'var(--font-medium)', sizeMode: 'contentSize' }),
    text('hrTime', 'The hours', 'hrRow', '', { ...T_BODY, color: 'var(--muted-foreground)', sizeMode: 'contentSize' }),
    inputs('hrInputs', 'The day', ['day', 'time'])
  ],
  connections: [
    { fromId: 'hrInputs', fromProperty: 'day', toId: 'hrDay', toProperty: 'text' },
    { fromId: 'hrInputs', fromProperty: 'time', toId: 'hrTime', toProperty: 'text' }
  ]
};

// ── Site/Contact — the form, and what it does with no backend ────────────────

/**
 * 🔴 **`Run` is ADDITIVE on a `JavaScriptFunction`** (`run-on-value-change.ts`
 * §1): with the per-input boxes left on, this node would compose and open the
 * mail link on every keystroke. All four are off, so the only trigger is the
 * button.
 *
 * ⚠️ `openInNewTab: false` on the link. A `mailto:` handed to `window.open` in
 * a new tab leaves a blank tab beside the mail app in most browsers; opened in
 * place it hands over to the mail app and the page stays exactly where it was.
 */
export const COMPOSE_SCRIPT =
  "var name = String(Inputs.name || '').trim();\n" +
  "var email = String(Inputs.email || '').trim();\n" +
  "var message = String(Inputs.message || '').trim();\n" +
  'if (!name || !email || !message) { Outputs.missing(); return; }\n' +
  "var subject = 'Website enquiry from ' + name;\n" +
  "var body = message + '\\n\\n— ' + name + ' (' + email + ')';\n" +
  "Outputs.link = 'mailto:' + String(Inputs.to || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);\n" +
  'Outputs.go();';

export const SENT_TEXT = 'Your mail app should have opened with the message written and addressed. If it did not, write to the address on the left.';

/**
 * 🔴 **TPL-004 made this notice unreachable, and it stays anyway.**
 *
 * Send is now disabled until all three boxes pass, so the `Outputs.missing()`
 * branch of `COMPOSE_SCRIPT` cannot be reached through the button. Deleting the
 * notice would tidy four nodes away **and remove the only thing standing between
 * a person and a silent dead end if the gate above it is ever wired wrong** —
 * which is the exact shape of a defect that heals itself out of sight. The
 * script keeps its guard because a script that trusts its caller is a script
 * that breaks when somebody rewires the caller.
 */
export const MISSING_TEXT = 'Please fill in all three boxes first.';

/** How many characters of message count as a message. One number, read by the check and by the helper. */
export const MESSAGE_MINIMUM = 20;

export const SEND_HINT_READY = 'Send opens your mail app with the message written for you.';
export const SEND_HINT_WAITING = 'Fill in your name, your email and a few lines, and Send will light up.';

const NOTICE = { ...CARD, ...CARD_BODY, sizeMode: 'contentHeight', backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', mounted: false };

const CONDITION_GATE = { condition: true, 'runOnChange-condition': false };

// ── Site/Field — a label over a control ──────────────────────────────────────

/**
 * One labelled field. A component because the door said so: three of these
 * inline in the form are *"3 sibling subtrees … structurally identical"*, and
 * the remedy it names is this. What was typed leaves through a `Component
 * Outputs` value port, so the form can read three fields from three instances.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **TPL-004 gave it a voice.** It could say a label and take a value; it
 * could not say *that is not an address we could reply to*. Two inputs do it:
 * `message` (a line under the control) and `edge` (the control's border), both
 * decided by whoever placed the field, because validity is a property of the
 * form and not of a text box.
 *
 * ⚠️ **The message is `mounted`, not `visible`.** `visible` sets
 * `visibility: hidden` and **keeps the space** — sixteen dead pixels under every
 * clean field, on every field, forever. `mounted` removes the element. The
 * `ui-form-field` recipe measured that difference; it is not a preference.
 *
 * ⚠️ The `mounted` flag is computed **here**, from the message itself, rather
 * than passed in beside it. A second input saying "and now show it" is a second
 * statement of the same fact, and the two drift the first time one is wired and
 * the other is not.
 */
const FIELD_PART: Tpl003Component = {
  path: 'Site/Field',
  nodes: [
    group('fdField', 'The field', undefined, FIELD, ['fdLabel', 'fdInput', 'fdMessage']),
    text('fdLabel', 'The label', 'fdField', '', T_LABEL),
    { id: 'fdInput', type: INPUT_NODE, label: 'The control', parent: 'fdField', parameters: { ...TEXT_FIELD, placeholder: '' } },
    text('fdMessage', 'What is wrong, or what is still needed', 'fdField', '', { ...T_HINT, mounted: false }),
    logic('fdHasMessage', EXPRESSION_NODE, 'Is there anything to say?', { expression: "(m || '').length > 0" }),
    typedInputs('fdInputs', 'The field', [
      ['label', 'string'],
      ['type', 'string'],
      ['message', 'string'],
      ['messageColor', 'color'],
      ['edge', 'color']
    ]),
    outputs('fdOutputs', 'What was typed', [['text', 'string']])
  ],
  connections: [
    wire('fdInputs', 'label', 'fdLabel', 'text'),
    wire('fdInputs', 'type', 'fdInput', 'type'),
    wire('fdInputs', 'edge', 'fdInput', 'borderColor'),
    wire('fdInputs', 'message', 'fdMessage', 'text'),
    wire('fdInputs', 'messageColor', 'fdMessage', 'color'),
    wire('fdInputs', 'message', 'fdHasMessage', 'm'),
    wire('fdHasMessage', 'asBoolean', 'fdMessage', 'mounted'),
    wire('fdInput', 'onTextChanged', 'fdOutputs', 'text')
  ]
};

// ── Site/IsValidEmail — the rule, in one place ───────────────────────────────

/**
 * TPL-004 — *is this an address we could reply to?* A component and not four
 * nodes inside the form, because the doctrine's rule for a named utility is that
 * it is a component **however small it is**, and because the answer is wanted in
 * two shapes — a boolean for the Send button and a sentence for the person.
 *
 * ⚠️ **An empty box is not an error.** It returns `false` (so Send stays
 * disabled) with an **empty message** (so a form nobody has touched yet is not
 * covered in red). Those are two different facts and the two outputs carry them
 * separately; a single "is it ok" boolean cannot say both.
 *
 * ⚠️ This is deliberately not a regular expression. The address that matters is
 * the one a person can receive mail at, and no expression decides that; this
 * catches the four mistakes people actually make — no `@`, nothing after the
 * dot, a space in the middle, two `@`s — and lets everything else through.
 */
export const EMAIL_SCRIPT =
  "var typed = String(Inputs.email || '').trim();\n" +
  "\n" +
  "if (typed.length === 0) {\n" +
  "  Outputs.isValid = false;\n" +
  "  Outputs.message = '';\n" +
  "  return;\n" +
  "}\n" +
  "\n" +
  "var at = typed.indexOf('@');\n" +
  "var lastDot = typed.lastIndexOf('.');\n" +
  "var valid =\n" +
  "  at > 0 &&\n" +
  "  lastDot > at + 1 &&\n" +
  "  lastDot < typed.length - 2 &&\n" +
  "  typed.indexOf(' ') === -1 &&\n" +
  "  typed.indexOf('@', at + 1) === -1;\n" +
  "\n" +
  "Outputs.isValid = valid;\n" +
  "Outputs.message = valid ? '' : 'That is not an address we could reply to — check it over.';";

const EMAIL_CHECK: Tpl003Component = {
  path: 'Site/IsValidEmail',
  nodes: [
    inputs('ecInputs', 'The address', ['email']),
    logic('ecFn', FUNCTION_NODE, 'Check the address', { functionScript: EMAIL_SCRIPT }),
    outputs('ecOutputs', 'The verdict', [
      ['isValid', 'boolean'],
      ['message', 'string']
    ])
  ],
  connections: [
    wire('ecInputs', 'email', 'ecFn', 'in-email'),
    wire('ecFn', 'out-isValid', 'ecOutputs', 'isValid'),
    wire('ecFn', 'out-message', 'ecOutputs', 'message')
  ]
};

const CONTACT: Tpl003Component = {
  path: 'Site/Contact',
  nodes: [
    group('ctBand', 'The contact band', undefined, BAND_SURFACE, ['ctShell']),
    group('ctShell', 'Shell', 'ctBand', SHELL, ['ctColumns']),
    {
      id: 'ctColumns',
      type: COLUMNS_NODE,
      label: 'What this is for, beside the form',
      parent: 'ctShell',
      parameters: { ...composition('columnsTwoUp'), marginY: px(32) },
      children: ['ctIntro', 'ctCard']
    },
    group('ctIntro', 'What this is for', 'ctColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-3)' }, [
      'ctEyebrow',
      'ctHeading',
      'ctLine',
      'ctAddressLabel',
      'ctAddress'
    ]),
    text('ctEyebrow', 'Get in touch', 'ctIntro', 'Get in touch', T_EYEBROW),
    text('ctHeading', 'The heading', 'ctIntro', '', H_SECTION),
    text('ctLine', 'The line under it', 'ctIntro', '', T_LEAD),
    text('ctAddressLabel', 'Email', 'ctIntro', 'Or email directly', T_META),
    text('ctAddress', 'The address, shown', 'ctIntro', '', { ...T_BODY, fontWeight: 'var(--font-semibold)', color: 'var(--primary)' }),
    group('ctCard', 'The form', 'ctColumns', { ...CARD, ...CARD_BODY, sizeMode: 'contentHeight', rowGap: 'var(--space-4)' }, [
      'ctName',
      'ctEmail',
      'ctMessage',
      'ctSend',
      'ctHint',
      'ctSent',
      'ctMissing'
    ]),
    place('ctName', FIELD_COMPONENT, 'Your name', 'ctCard', { label: 'Your name', type: 'text', edge: 'var(--border-control)' }),
    place('ctEmail', FIELD_COMPONENT, 'Your email', 'ctCard', { label: 'Your email', type: 'email', messageColor: 'var(--destructive)' }),
    place('ctMessage', FIELD_COMPONENT, 'Your message', 'ctCard', { label: 'Your message', type: 'textArea', edge: 'var(--border-control)', messageColor: 'var(--muted-foreground)' }),
    button('ctSend', 'Send', 'ctCard', { ...PRIMARY, cssClassName: 'pressable', enabled: false }),
    text('ctHint', 'What Send does, or what is still missing', 'ctCard', SEND_HINT_WAITING, T_HINT),

    // ── TPL-004: the form answers while you type ──────────────────────────
    //
    // 🔴 The three checks are three nodes and not one script, and that is the
    // node-library rule pointing the way it usually does: each of them is a
    // question a person can read off the canvas and change without opening a
    // code editor. The ONE thing that is a script is the address check, because
    // "is this an address" is four rules and a sentence, and that is a
    // component (`Site/IsValidEmail`).
    logic('ctNameOk', EXPRESSION_NODE, 'Is there a name?', { expression: "(n || '').trim().length > 1" }),
    logic('ctEmailCheck', EMAIL_CHECK_COMPONENT, 'Is the address one you could reply to?'),
    logic('ctMsgOk', EXPRESSION_NODE, 'Is the message long enough?', { expression: `(m || '').trim().length >= ${MESSAGE_MINIMUM}` }),
    logic('ctAnd', AND_NODE, 'Everything, at once'),
    // The message field's helper counts DOWN and then reports. A field that only
    // goes red once you stop typing tells you after the fact; this tells you
    // while there is still something to do about it.
    logic('ctMsgHelper', EXPRESSION_NODE, 'How much more is needed', {
      expression: `(m || '').trim().length >= ${MESSAGE_MINIMUM} ? 'That is plenty — go ahead.' : ('About ' + (${MESSAGE_MINIMUM} - (m || '').trim().length) + ' more characters, please.')`
    }),
    // 🔴 The address field's border and its message are ONE fact read twice, so
    // they are derived from the same string. A second boolean saying "and now
    // go red" is the second statement that drifts.
    logic('ctEmailEdge', EXPRESSION_NODE, 'The address box’s border', {
      expression: "(msg || '').length > 0 ? 'var(--destructive)' : 'var(--border-control)'"
    }),
    // ⚠️ A disabled button with no explanation is a dead end. This line is the
    // explanation, and it is the same Text that says what Send does once the
    // form is ready — one node, two states, nothing to keep in step.
    logic('ctHintText', EXPRESSION_NODE, 'What the line under Send says', {
      expression: `ok ? ${JSON.stringify(SEND_HINT_READY)} : ${JSON.stringify(SEND_HINT_WAITING)}`
    }),
    group('ctSent', 'It went', 'ctCard', NOTICE, ['ctSentText']),
    text('ctSentText', 'It went — the words', 'ctSent', SENT_TEXT, { ...T_META, color: 'var(--accent-foreground)' }),
    group('ctMissing', 'Something is empty', 'ctCard', NOTICE, ['ctMissingText']),
    text('ctMissingText', 'Something is empty — the words', 'ctMissing', MISSING_TEXT, { ...T_META, color: 'var(--accent-foreground)' }),
    // 🔴 The address is ONE node. It feeds the link and the line on the left.
    { id: 'ctTo', type: 'String', label: `${EDIT}the address the form sends to`, parameters: { value: PLACEHOLDER_ADDRESS } },
    {
      id: 'ctCompose',
      type: 'JavaScriptFunction',
      label: 'Write the email',
      ports: [
        { name: 'out-go', plug: 'output', type: 'signal' },
        { name: 'out-missing', plug: 'output', type: 'signal' }
      ],
      parameters: {
        'runOnChange-in-name': false,
        'runOnChange-in-email': false,
        'runOnChange-in-message': false,
        'runOnChange-in-to': false,
        functionScript: COMPOSE_SCRIPT
      }
    },
    { id: 'ctOpen', type: LINK_NODE, label: 'Hand it to the mail app', parameters: { openInNewTab: false } },
    { id: 'ctSentGate', type: 'Condition', label: 'Say it went', parameters: { ...CONDITION_GATE } },
    { id: 'ctMissingGate', type: 'Condition', label: 'Say something is empty', parameters: { ...CONDITION_GATE } },
    { id: 'ctMissingClear', type: 'Condition', label: 'Put that away once it goes', parameters: { condition: false, 'runOnChange-condition': false } },
    { id: 'ctSentClear', type: 'Condition', label: 'Put "it went" away if the next try is empty', parameters: { condition: false, 'runOnChange-condition': false } },
    inputs('ctInputs', 'The band', ['heading', 'line', 'button'])
  ],
  connections: [
    { fromId: 'ctInputs', fromProperty: 'heading', toId: 'ctHeading', toProperty: 'text' },
    { fromId: 'ctInputs', fromProperty: 'line', toId: 'ctLine', toProperty: 'text' },
    { fromId: 'ctInputs', fromProperty: 'button', toId: 'ctSend', toProperty: 'label' },
    { fromId: 'ctTo', fromProperty: 'savedValue', toId: 'ctAddress', toProperty: 'text' },
    { fromId: 'ctTo', fromProperty: 'savedValue', toId: 'ctCompose', toProperty: 'in-to' },
    { fromId: 'ctName', fromProperty: 'text', toId: 'ctCompose', toProperty: 'in-name' },
    { fromId: 'ctEmail', fromProperty: 'text', toId: 'ctCompose', toProperty: 'in-email' },
    { fromId: 'ctMessage', fromProperty: 'text', toId: 'ctCompose', toProperty: 'in-message' },
    { fromId: 'ctSend', fromProperty: 'onClick', toId: 'ctCompose', toProperty: 'run' },
    // TPL-004 — what is typed, read as it is typed.
    wire('ctName', 'text', 'ctNameOk', 'n'),
    wire('ctEmail', 'text', 'ctEmailCheck', 'email'),
    wire('ctMessage', 'text', 'ctMsgOk', 'm'),
    wire('ctMessage', 'text', 'ctMsgHelper', 'm'),
    // 🔴 `And.result` is FALSE while nothing is connected — which is exactly the
    // state a form starts in, so Send is disabled before anybody has typed
    // without a node to say so.
    wire('ctNameOk', 'asBoolean', 'ctAnd', 'input 0'),
    wire('ctEmailCheck', 'isValid', 'ctAnd', 'input 1'),
    wire('ctMsgOk', 'asBoolean', 'ctAnd', 'input 2'),
    wire('ctAnd', 'result', 'ctSend', 'enabled'),
    wire('ctAnd', 'result', 'ctHintText', 'ok'),
    wire('ctHintText', 'asString', 'ctHint', 'text'),
    wire('ctEmailCheck', 'message', 'ctEmail', 'message'),
    wire('ctEmailCheck', 'message', 'ctEmailEdge', 'msg'),
    wire('ctEmailEdge', 'asString', 'ctEmail', 'edge'),
    wire('ctMsgHelper', 'asString', 'ctMessage', 'message'),
    { fromId: 'ctCompose', fromProperty: 'out-link', toId: 'ctOpen', toProperty: 'link' },
    { fromId: 'ctCompose', fromProperty: 'out-go', toId: 'ctOpen', toProperty: 'do' },
    { fromId: 'ctOpen', fromProperty: 'done', toId: 'ctSentGate', toProperty: 'eval' },
    { fromId: 'ctSentGate', fromProperty: 'result', toId: 'ctSent', toProperty: 'mounted' },
    { fromId: 'ctCompose', fromProperty: 'out-missing', toId: 'ctMissingGate', toProperty: 'eval' },
    { fromId: 'ctMissingGate', fromProperty: 'result', toId: 'ctMissing', toProperty: 'mounted' },
    { fromId: 'ctCompose', fromProperty: 'out-go', toId: 'ctMissingClear', toProperty: 'eval' },
    { fromId: 'ctMissingClear', fromProperty: 'result', toId: 'ctMissing', toProperty: 'mounted' },
    { fromId: 'ctCompose', fromProperty: 'out-missing', toId: 'ctSentClear', toProperty: 'eval' },
    { fromId: 'ctSentClear', fromProperty: 'result', toId: 'ctSent', toProperty: 'mounted' }
  ]
};

// ── Site/Check — a tick and a line ───────────────────────────────────────────

const CHECK: Tpl003Component = {
  path: 'Site/Check',
  nodes: [
    group('ckRow', 'One point', undefined, { sizeMode: 'contentHeight', width: pct(100), flexDirection: 'row', alignItems: 'flex-start', columnGap: 'var(--space-3)' }, [
      'ckGlyph',
      'ckText'
    ]),
    icon('ckGlyph', 'The tick', 'ckRow', 'check', 18, 'var(--primary)'),
    text('ckText', 'The point', 'ckRow', '', { ...T_BODY, sizeMode: 'contentHeight', width: pct(100) }),
    inputs('ckInputs', 'The point', ['text', 'color'])
  ],
  connections: [
    { fromId: 'ckInputs', fromProperty: 'text', toId: 'ckText', toProperty: 'text' },
    { fromId: 'ckInputs', fromProperty: 'color', toId: 'ckText', toProperty: 'color' }
  ]
};

// ── Site/MockRow — one line inside the stand-in product window ───────────────

const MOCK_ROW: Tpl003Component = {
  path: 'Site/MockRow',
  nodes: [
    group(
      'mrRow',
      'One row',
      undefined,
      { ...composition('ruled'), borderBottomColor: 'var(--border-glass)', justifyContent: 'space-between', columnGap: 'var(--space-4)' },
      ['mrLabel', 'mrPill']
    ),
    text('mrLabel', 'The row', 'mrRow', '', { ...T_BODY, fontSize: 'var(--text-sm)', sizeMode: 'contentSize', ...ON_DARK }),
    group('mrPill', 'Its state', 'mrRow', { ...PILL, paddingTop: 'var(--space-1)', paddingBottom: 'var(--space-1)' }, ['mrState']),
    text('mrState', 'The state', 'mrPill', '', { fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', ...ON_DARK }),
    inputs('mrInputs', 'The row', ['label', 'state'])
  ],
  connections: [
    { fromId: 'mrInputs', fromProperty: 'label', toId: 'mrLabel', toProperty: 'text' },
    { fromId: 'mrInputs', fromProperty: 'state', toId: 'mrState', toProperty: 'text' }
  ]
};

// ── Site/Mock — a stand-in for a picture of the product ──────────────────────

/**
 * A launch page has a product to show and this template cannot know what it
 * looks like, so it draws one: a dark window with a title bar, three rows with
 * a state on each, and a bar chart. It is built from Groups so it re-themes
 * with the tokens and weighs nothing, and its instances are labelled `EDIT —`
 * because the day there is a real screenshot this is what it replaces.
 *
 * ⚠️ The six bars are single nodes, deliberately: `repeated-sibling-subtree`
 * fires on three copies of a THREE-node subtree, and a bar is one.
 */
const BAR_HEIGHTS = [28, 44, 36, 60, 48, 72];
const MOCK: Tpl003Component = {
  path: 'Site/Mock',
  nodes: [
    group(
      'mkWindow',
      'The window',
      undefined,
      {
        width: pct(100),
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        rowGap: 'var(--space-4)',
        backgroundColor: 'var(--foreground)',
        borderRadius: 'var(--radius-xl)',
        borderStyle: 'solid',
        borderWidth: 'var(--border-1)',
        borderColor: 'var(--border-glass)',
        boxShadowEnabled: true,
        boxShadowOffsetY: px(24),
        boxShadowBlurRadius: px(48),
        boxShadowColor: 'var(--border-strong)',
        paddingTop: 'var(--space-4)',
        paddingBottom: 'var(--space-5)',
        paddingLeft: 'var(--space-5)',
        paddingRight: 'var(--space-5)',
        clip: true
      },
      ['mkBar', 'mkTitle', 'mkRow1', 'mkRow2', 'mkRow3', 'mkChart']
    ),
    group('mkBar', 'The title bar', 'mkWindow', { sizeMode: 'contentSize', flexDirection: 'row', columnGap: 'var(--space-2)' }, ['mkDot1', 'mkDot2', 'mkDot3']),
    ...[1, 2, 3].map((n) =>
      group(`mkDot${n}`, `Dot ${n}`, 'mkBar', { sizeMode: 'explicit', width: px(10), height: px(10), borderRadius: 'var(--radius-full)', backgroundColor: 'var(--border-glass)' })
    ),
    text('mkTitle', 'What the window is showing', 'mkWindow', '', { ...T_META, fontWeight: 'var(--font-semibold)', ...ON_DARK }),
    place('mkRow1', '/Site/MockRow', 'Row 1', 'mkWindow', { label: 'The first row', state: 'Done' }),
    place('mkRow2', '/Site/MockRow', 'Row 2', 'mkWindow', { label: 'The second row', state: 'Due today' }),
    place('mkRow3', '/Site/MockRow', 'Row 3', 'mkWindow', { label: 'The third row', state: 'New' }),
    group(
      'mkChart',
      'The chart',
      'mkWindow',
      { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'row', alignItems: 'flex-end', columnGap: 'var(--space-2)', paddingTop: 'var(--space-2)' },
      BAR_HEIGHTS.map((_, i) => `mkBar${i + 1}`)
    ),
    ...BAR_HEIGHTS.map((h, i) =>
      group(`mkBar${i + 1}`, `Bar ${i + 1}`, 'mkChart', {
        sizeMode: 'explicit',
        width: pct(100),
        height: px(h),
        borderRadius: 'var(--radius-sm)',
        backgroundColor: i === BAR_HEIGHTS.length - 1 ? 'var(--primary)' : 'var(--surface-glass)'
      })
    ),
    inputs('mkInputs', 'The window', ['title', 'row1', 'row2', 'row3'])
  ],
  connections: [
    { fromId: 'mkInputs', fromProperty: 'title', toId: 'mkTitle', toProperty: 'text' },
    { fromId: 'mkInputs', fromProperty: 'row1', toId: 'mkRow1', toProperty: 'label' },
    { fromId: 'mkInputs', fromProperty: 'row2', toId: 'mkRow2', toProperty: 'label' },
    { fromId: 'mkInputs', fromProperty: 'row3', toId: 'mkRow3', toProperty: 'label' }
  ]
};

// ── Site/BigStat — a number set large, on a dark band ────────────────────────

const BIG_STAT: Tpl003Component = {
  path: 'Site/BigStat',
  nodes: [
    group(
      'bsItem',
      'One number',
      undefined,
      {
        width: pct(100),
        sizeMode: 'contentHeight',
        flexDirection: 'column',
        rowGap: 'var(--space-2)',
        borderLeftStyle: 'solid',
        borderLeftWidth: 'var(--border-1)',
        borderLeftColor: 'var(--border-glass)',
        paddingLeft: 'var(--space-5)'
      },
      ['bsValue', 'bsLabel']
    ),
    text('bsValue', 'The number', 'bsItem', '', {
      fontSize: 'var(--display-sm)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-none)',
      letterSpacing: 'var(--tracking-tighter)',
      ...ON_DARK
    }),
    text('bsLabel', 'What it counts', 'bsItem', '', { ...T_META, ...ON_DARK }),
    inputs('bsInputs', 'The number', ['value', 'label'])
  ],
  connections: [
    { fromId: 'bsInputs', fromProperty: 'value', toId: 'bsValue', toProperty: 'text' },
    { fromId: 'bsInputs', fromProperty: 'label', toId: 'bsLabel', toProperty: 'text' }
  ]
};

// ── Site/Plan — one pricing card, light or dark by its inputs ────────────────

/**
 * Two plans side by side, and the recommended one is DARK. One component, not
 * two: the ground, its edge and the ink arrive as inputs, so the page decides
 * which card is the ink card and nothing inside is duplicated.
 */
const PLAN: Tpl003Component = {
  path: 'Site/Plan',
  nodes: [
    group('plCard', 'The plan', undefined, { ...CARD, ...CARD_BODY, sizeMode: 'contentHeight', rowGap: 'var(--space-4)', paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)', paddingLeft: 'var(--space-8)', paddingRight: 'var(--space-8)' }, [
      'plName',
      'plPrice',
      'plLine',
      'plPoint1',
      'plPoint2',
      'plPoint3',
      'plAction'
    ]),
    text('plName', 'The plan’s name', 'plCard', '', T_EYEBROW),
    text('plPrice', 'What it costs', 'plCard', '', {
      fontSize: 'var(--display-sm)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-none)',
      letterSpacing: 'var(--tracking-tighter)',
      color: 'var(--foreground)'
    }),
    text('plLine', 'Who it is for', 'plCard', '', T_META),
    place('plPoint1', '/Site/Check', 'The first point', 'plCard', { text: '', color: 'var(--foreground)' }),
    place('plPoint2', '/Site/Check', 'The second point', 'plCard', { text: '', color: 'var(--foreground)' }),
    place('plPoint3', '/Site/Check', 'The third point', 'plCard', { text: '', color: 'var(--foreground)' }),
    button('plAction', 'Choose', 'plCard', { ...PRIMARY, sizeMode: 'contentHeight', width: pct(100) }),
    inputs('plInputs', 'The plan', ['name', 'price', 'line', 'point1', 'point2', 'point3', 'action', 'ground', 'edge', 'ink']),
    { id: 'plOutputs', type: 'Component Outputs', label: 'The plan was chosen', ports: [{ name: 'chosen', type: 'signal', plug: 'input' }] }
  ],
  connections: [
    { fromId: 'plInputs', fromProperty: 'name', toId: 'plName', toProperty: 'text' },
    { fromId: 'plInputs', fromProperty: 'price', toId: 'plPrice', toProperty: 'text' },
    { fromId: 'plInputs', fromProperty: 'line', toId: 'plLine', toProperty: 'text' },
    { fromId: 'plInputs', fromProperty: 'point1', toId: 'plPoint1', toProperty: 'text' },
    { fromId: 'plInputs', fromProperty: 'point2', toId: 'plPoint2', toProperty: 'text' },
    { fromId: 'plInputs', fromProperty: 'point3', toId: 'plPoint3', toProperty: 'text' },
    { fromId: 'plInputs', fromProperty: 'action', toId: 'plAction', toProperty: 'label' },
    { fromId: 'plInputs', fromProperty: 'ground', toId: 'plCard', toProperty: 'backgroundColor' },
    { fromId: 'plInputs', fromProperty: 'edge', toId: 'plCard', toProperty: 'borderColor' },
    { fromId: 'plInputs', fromProperty: 'ink', toId: 'plPrice', toProperty: 'color' },
    { fromId: 'plInputs', fromProperty: 'ink', toId: 'plLine', toProperty: 'color' },
    { fromId: 'plInputs', fromProperty: 'ink', toId: 'plPoint1', toProperty: 'color' },
    { fromId: 'plInputs', fromProperty: 'ink', toId: 'plPoint2', toProperty: 'color' },
    { fromId: 'plInputs', fromProperty: 'ink', toId: 'plPoint3', toProperty: 'color' },
    { fromId: 'plAction', fromProperty: 'onClick', toId: 'plOutputs', toProperty: 'chosen' }
  ]
};

// ── Page building blocks ─────────────────────────────────────────────────────

/** The starter photographs every project is created with; the template ships none of the bytes. */
const photo = (file: string) => `noodl_modules/starter-imagery/${file}`;

/**
 * The frame every page shares: the strip, the header, a `main`, the foot — on a
 * ground floored at the viewport.
 *
 * 🔴 **TPL-004 took the `Scroll To Element` wires out of here.** They read:
 *
 *     ContactAnchor.this  -> Ground.scrollToElement.element
 *     Header.contact      -> Ground.scrollToElement.do
 *     <second target>.this -> Main.scrollToElement.element
 *
 * — and the second and third lines are the same mechanism used twice **because a
 * `Group` holds exactly one `Scroll To Element - Element`**, so reaching two
 * destinations needed two Groups. That ceiling is why the header could offer one
 * link. Every destination is now a class name and a `Site/ScrollTo`, and a page
 * can have as many as it has sections.
 *
 * ⚠️ The `ContactAnchor` Group stays. It is no longer a port-holder, but it is
 * still what carries `site-contact` — the contact band is a component instance,
 * and an instance cannot take a `cssClassName`.
 */
function pageFrame(
  p: string,
  opts: { title: string; urlPath: string; label: string; mainChildren: string[]; secondTarget?: string; nav: [string, string][]; contact: { heading: string; line: string; button: string } }
): { nodes: unknown[]; connections: unknown[] } {
  const navParams: Record<string, unknown> = {};
  opts.nav.forEach(([label, target], i) => {
    navParams[`nav${i + 1}`] = label;
    navParams[`nav${i + 1}Target`] = target;
  });
  const nodes: unknown[] = [
    { id: `${p}Page`, type: 'Page', label: opts.label, parameters: { title: opts.title, urlPath: opts.urlPath }, children: [`${p}Ground`] },
    group(
      `${p}Ground`,
      'Page ground',
      `${p}Page`,
      { width: pct(100), sizeMode: 'contentHeight', minHeight: { value: 100, unit: 'vh' }, flexDirection: 'column', backgroundColor: 'var(--background)' },
      [`${p}Switcher`, `${p}Header`, `${p}Main`, `${p}Footer`]
    ),
    place(`${p}Switcher`, SWITCHER_COMPONENT, 'The look switcher', `${p}Ground`),
    place(`${p}Header`, HEADER_COMPONENT, `${EDIT}the three nav links at the top`, `${p}Ground`, navParams),
    group(`${p}Main`, 'The page', `${p}Ground`, { as: 'main', width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, [
      ...opts.mainChildren,
      `${p}ContactAnchor`
    ]),
    group(`${p}ContactAnchor`, 'Where "Get in touch" lands', `${p}Main`, { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', cssClassName: CONTACT_CLASS }, [`${p}Contact`]),
    place(`${p}Contact`, CONTACT_COMPONENT, 'The contact band', `${p}ContactAnchor`, opts.contact),
    place(`${p}Footer`, FOOTER_COMPONENT, 'The foot of the page', `${p}Ground`),
    // The page's own two destinations: the form, and whatever the hero's second
    // button points at. Both are the same utility, aimed differently.
    logic(`${p}GoContact`, SCROLL_TO_COMPONENT, 'To the form', { target: CONTACT_CLASS })
  ];
  if (opts.secondTarget) {
    nodes.push(logic(`${p}GoSecond`, SCROLL_TO_COMPONENT, 'To the section the hero’s second button names', { target: sectionClass(opts.secondTarget) }));
  }
  return { nodes, connections: [] };
}

/** A section: a band, its shell, a head with an eyebrow and a heading, then whatever follows. */
function section(
  id: string,
  parent: string,
  ground: 'paper' | 'surface',
  head: { eyebrow: string; heading: string; lead?: string; editHeading?: boolean; center?: boolean },
  content: string[]
): unknown[] {
  const headChildren = [`${id}Eyebrow`, `${id}Heading`, ...(head.lead ? [`${id}Lead`] : [])];
  const center = head.center ? { textAlignX: 'center' } : {};
  const nodes: unknown[] = [
    // TPL-004 — the class is what a nav link aims at. Derived, never typed twice.
    group(id, head.eyebrow, parent, { ...(ground === 'paper' ? BAND : BAND_SURFACE), cssClassName: sectionClass(id) }, [`${id}Shell`]),
    group(`${id}Shell`, 'Shell', id, SHELL, [`${id}Head`, ...content]),
    group(`${id}Head`, `${head.eyebrow} — head`, `${id}Shell`, head.center ? { ...SECTION_HEAD, alignItems: 'center' } : SECTION_HEAD, headChildren),
    text(`${id}Eyebrow`, `${head.eyebrow} — eyebrow`, `${id}Head`, head.eyebrow, { ...T_EYEBROW, ...center }),
    text(`${id}Heading`, head.editHeading === false ? `${head.eyebrow} — heading` : `${EDIT}${head.eyebrow} — heading`, `${id}Head`, head.heading, { ...H_SECTION, ...center })
  ];
  if (head.lead) nodes.push(text(`${id}Lead`, `${EDIT}${head.eyebrow} — the line under it`, `${id}Head`, head.lead, { ...T_LEAD, ...center }));
  return nodes;
}

/** A reflowing grid of placed components — each in a cell that takes the column's width. */
/**
 * `gridAutoFit`'s own 280px minimum fits FOUR columns in a 1200 shell, so three
 * cards sat in three of four columns with a quarter of the measure empty on the
 * right — photographed at 1280 on every grid of the first render. 340 was tried
 * next and fell to two-and-an-orphan at 988, the editor preview's default width
 * and the first render of every project; 300 fits three at both, two at a
 * tablet, one on a phone. A two-item grid takes 440.
 */
function grid(
  id: string,
  parent: string,
  cells: Array<{ id: string; type: string; label: string; parameters: Record<string, unknown> }>,
  minWidth = 300
): unknown[] {
  return [
    {
      id,
      type: COLUMNS_NODE,
      label: 'The grid',
      parent,
      parameters: { ...composition('gridAutoFit'), minWidth: px(minWidth), marginY: px(24) },
      children: cells.map((cell) => `${cell.id}Cell`)
    },
    ...cells.flatMap((cell) => [
      group(`${cell.id}Cell`, cell.label, id, { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, [cell.id]),
      place(cell.id, cell.type, `${EDIT}${cell.label}`, `${cell.id}Cell`, cell.parameters)
    ])
  ];
}

/** A hero on a gradient. `center` is the launch page's centred shape. */
function gradientHero(
  p: string,
  parent: string,
  opts: { gradient: 'deep' | 'spotlight'; badgeIcon: string; badge: string; headline: string; lead: string; primary: string; secondary: string; center?: boolean }
): unknown[] {
  const center = opts.center ? { textAlignX: 'center' } : {};
  return [
    group(
      `${p}Hero`,
      'The hero',
      parent,
      { ...composition('heroGround'), sizeMode: 'contentHeight', backgroundGradient: `var(--gradient-${opts.gradient})` },
      [`${p}HeroShell`]
    ),
    group(
      `${p}HeroShell`,
      'Shell',
      `${p}Hero`,
      opts.center ? { ...SHELL, alignItems: 'center', maxWidth: px(880), rowGap: 'var(--space-5)' } : { ...SHELL, alignItems: 'flex-start', rowGap: 'var(--space-5)' },
      [`${p}HeroBadge`, `${p}HeroHeading`, `${p}HeroLead`, `${p}HeroActions`]
    ),
    group(`${p}HeroBadge`, 'The badge', `${p}HeroShell`, PILL, [`${p}HeroBadgeGlyph`, `${p}HeroBadgeText`]),
    icon(`${p}HeroBadgeGlyph`, 'The badge — glyph', `${p}HeroBadge`, opts.badgeIcon, 14, 'var(--primary-foreground)'),
    text(`${p}HeroBadgeText`, `${EDIT}the badge on the hero`, `${p}HeroBadge`, opts.badge, { ...T_META, fontWeight: 'var(--font-medium)', ...ON_DARK }),
    text(`${p}HeroHeading`, `${EDIT}the headline`, `${p}HeroShell`, opts.headline, { ...H_HERO, ...ON_DARK, ...center }),
    text(`${p}HeroLead`, `${EDIT}the line under the headline`, `${p}HeroShell`, opts.lead, { ...T_LEAD, ...ON_DARK, ...center }),
    group(`${p}HeroActions`, 'The two actions', `${p}HeroShell`, opts.center ? { ...ACTIONS, justifyContent: 'center' } : ACTIONS, [
      `${p}HeroPrimary`,
      `${p}HeroSecondary`
    ]),
    button(`${p}HeroPrimary`, opts.primary, `${p}HeroActions`, PRIMARY),
    button(`${p}HeroSecondary`, opts.secondary, `${p}HeroActions`, GLASS_BUTTON)
  ];
}

/** The wires every hero has: the first button to the form, the second to the page's other target. */
function heroWires(p: string): unknown[] {
  return [
    wire(`${p}HeroPrimary`, 'onClick', `${p}GoContact`, 'go'),
    wire(`${p}HeroSecondary`, 'onClick', `${p}GoSecond`, 'go')
  ];
}

/**
 * TPL-004 — the freelancer page's work, as data.
 *
 * ⚠️ **§E-ii survives the move to a list.** Nothing here is an invented studio or
 * a fictional client: every row is written in the shape of the thing it stands
 * for, the same rule the hand-placed cards followed. What changed is that a
 * person edits six rows in one node instead of three copies of a subtree.
 *
 * 🔴 **`category` is the field the pills filter on, and the pill labels are the
 * category strings themselves.** Those two are in different nodes, which is a
 * pair that can be mistyped — so the gate asserts every pill's value appears as
 * a category in this list. Rename a kind of work here and the gate names the
 * pill you forgot.
 */
export const WORK_CATEGORIES = ["The first kind of work", "The second kind of work", "The third kind of work"];

export const WORK_JSON = JSON.stringify([{"picture": "noodl_modules/starter-imagery/work-leather-bench.webp","alt": "A leather workbench with tools laid out","category": "The first kind of work","title": "A piece of work","client": "Who it was for","year": "2026","summary": "One line on what it was and what changed. This is all the card shows.","brief": "What they came to you with, and what was hard about it. Two sentences.","did": "What you actually did — the decisions, not the deliverables. Two or three sentences.","outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."},{"picture": "noodl_modules/starter-imagery/food-bakery.webp","alt": "A bakery counter with loaves on it","category": "The first kind of work","title": "Another of the same kind","client": "Who it was for","year": "2025","summary": "One line on what it was and what changed. This is all the card shows.","brief": "What they came to you with, and what was hard about it. Two sentences.","did": "What you actually did — the decisions, not the deliverables. Two or three sentences.","outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."},{"picture": "noodl_modules/starter-imagery/people-desk.webp","alt": "Someone working at a laptop by a window","category": "The second kind of work","title": "A piece of a different kind","client": "Who it was for","year": "2026","summary": "One line on what it was and what changed. This is all the card shows.","brief": "What they came to you with, and what was hard about it. Two sentences.","did": "What you actually did — the decisions, not the deliverables. Two or three sentences.","outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."},{"picture": "noodl_modules/starter-imagery/work-machine-shop.webp","alt": "A machine shop with a lathe in use","category": "The second kind of work","title": "Another of that kind","client": "Who it was for","year": "2025","summary": "One line on what it was and what changed. This is all the card shows.","brief": "What they came to you with, and what was hard about it. Two sentences.","did": "What you actually did — the decisions, not the deliverables. Two or three sentences.","outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."},{"picture": "noodl_modules/starter-imagery/people-meeting.webp","alt": "Three people talking around a table","category": "The third kind of work","title": "A piece of the third kind","client": "Who it was for","year": "2024","summary": "One line on what it was and what changed. This is all the card shows.","brief": "What they came to you with, and what was hard about it. Two sentences.","did": "What you actually did — the decisions, not the deliverables. Two or three sentences.","outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."},{"picture": "noodl_modules/starter-imagery/work-potter.webp","alt": "A potter shaping a bowl on a wheel","category": "The third kind of work","title": "The last one on the list","client": "Who it was for","year": "2024","summary": "One line on what it was and what changed. This is all the card shows.","brief": "What they came to you with, and what was hard about it. Two sentences.","did": "What you actually did — the decisions, not the deliverables. Two or three sentences.","outcome": "What happened afterwards. A number here is worth a paragraph of adjectives."}], null, 2);

// ── Pages/Freelancer — one person, three services, the work, a word ──────────

const FL_CONTACT = {
  heading: 'Tell me about your project',
  line: 'A few lines on what you need and when you need it by. I reply to everything.',
  button: 'Send'
};

const FREELANCER_FRAME = pageFrame('fl', {
  title: 'Home',
  urlPath: '',
  label: 'Freelancer',
  mainChildren: ['flHero', 'flServices', 'flWork', 'flAbout', 'flQuotes'],
  secondTarget: 'flWork',
  nav: [
    ['What I do', sectionClass('flServices')],
    ['Work', sectionClass('flWork')],
    ['About', sectionClass('flAbout')]
  ],
  contact: FL_CONTACT
});

const FREELANCER: Tpl003Component = {
  path: 'Pages/Freelancer',
  nodes: [
    ...FREELANCER_FRAME.nodes,
    ...gradientHero('fl', 'flMain', {
      gradient: 'deep',
      badgeIcon: 'sparkles',
      badge: 'Taking new projects from next month',
      headline: 'One line that says what you do, and who it is for',
      lead: 'Two sentences on the difference it makes for the people who hire you. Keep it plain; this is the first thing they read.',
      primary: 'Start a project',
      secondary: 'See recent work'
    }),
    ...section('flServices', 'flMain', 'paper', { eyebrow: 'What I do', heading: 'Three things I can take off your plate' }, ['flServicesGrid']),
    ...grid('flServicesGrid', 'flServicesShell', [
      {
        id: 'flService1',
        type: SERVICE_CARD_COMPONENT,
        label: 'the first service',
        parameters: {
          icon: 'pencil',
          title: 'The first service',
          price: 'From — say a number, or “on a day rate”',
          line: 'One line on what it includes.',
          detail: 'How the work actually goes: what you need from them at the start, how long it takes, how often they hear from you.',
          deliverable: 'What lands in their inbox at the end, and in what form.'
        }
      },
      {
        id: 'flService2',
        type: SERVICE_CARD_COMPONENT,
        label: 'the second service',
        parameters: {
          icon: 'layout-grid',
          title: 'The second service',
          price: 'From — say a number, or “on a day rate”',
          line: 'One line on what it includes.',
          detail: 'The same three things for this one. If two services have the same answer here, they are probably one service.',
          deliverable: 'What they end up with, described as a thing rather than an activity.'
        }
      },
      {
        id: 'flService3',
        type: SERVICE_CARD_COMPONENT,
        label: 'the third service',
        parameters: {
          icon: 'line-chart',
          title: 'The third service',
          price: 'From — say a number, or “on a day rate”',
          line: 'One line on what it includes.',
          detail: 'Three services is the most a page like this can carry. If you have five, the other two belong on their own page.',
          deliverable: 'What they end up with, described as a thing rather than an activity.'
        }
      }
    ]),
    // ── TPL-004: the work is a LIST, and the page reads it ────────────────
    //
    // 🔴 **This was three hand-placed cards.** Adding a fourth meant copying a
    // node and rewiring four parameters; changing how a card looks meant doing
    // it three times. It is now one `Static Data` node a person edits like a
    // spreadsheet, narrowed by a `Filter Collection` and drawn by a `For Each` —
    // so the page has as many pieces of work as the list has rows, and the card
    // is one component.
    //
    // 🔴 **The filter is nodes, not six lines of JavaScript.** `Filter
    // Collection`'s own documentation is what makes it possible: `filterFilter`
    // is a list of property names, and each one mints
    // `filterFilterType-<p>`, `filterFilterOp-<p>` and a **connectable**
    // `filterFilterValue-<p>`. The obvious `items.filter(i => ...)` would work
    // and would put the one decision a person is most likely to change — which
    // field the pills filter on — inside a code editor.
    //
    // ⚠️ An empty filter value with `op: regex` matches everything, which is the
    // "All" pill for free rather than a special case anywhere in the graph.
    ...section('flWork', 'flMain', 'surface', { eyebrow: 'Recent work', heading: 'The work, and the story behind each piece' }, [
      'flWorkPills',
      'flWorkCountRow',
      'flWorkGrid',
      'flWorkEmpty'
    ]),
    group('flWorkPills', 'The filter', 'flWorkShell', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 'var(--space-2)', rowGap: 'var(--space-2)' }, [
      'flWorkPillAll',
      'flWorkPill1',
      'flWorkPill2',
      'flWorkPill3'
    ]),
    place('flWorkPillAll', FILTER_PILL_COMPONENT, 'Everything', 'flWorkPills', { label: 'Everything', value: '' }),
    ...WORK_CATEGORIES.map((category, i) =>
      place(`flWorkPill${i + 1}`, FILTER_PILL_COMPONENT, `${EDIT}the ${['first', 'second', 'third'][i]} kind of work`, 'flWorkPills', { label: category, value: category })
    ),
    group('flWorkCountRow', 'How many are showing', 'flWorkShell', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'row', alignItems: 'center', paddingTop: 'var(--space-5)' }, ['flWorkCount']),
    text('flWorkCount', 'Showing n of m', 'flWorkCountRow', '', { ...T_META, fontVariantNumeric: 'tabular-nums' }),
    {
      id: 'flWorkGrid',
      type: COLUMNS_NODE,
      label: 'The grid',
      parent: 'flWorkShell',
      parameters: { ...composition('gridAutoFit'), minWidth: px(300), marginY: px(24) },
      children: ['flWorkRepeat']
    },
    logic('flWorkRepeat', FOR_EACH_NODE, 'One card per piece of work', { template: WORK_CARD_COMPONENT, templateType: 'explicit' }),
    // The one screen a filter can produce that nothing else on the page can, and
    // the one nobody writes until they have seen it empty.
    group('flWorkEmpty', 'When the filter matches nothing', 'flWorkShell', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', alignItems: 'center', rowGap: 'var(--space-3)', backgroundColor: 'var(--surface-raised)', borderRadius: 'var(--radius-xl)', borderStyle: 'solid', borderWidth: 'var(--border-1)', borderColor: 'var(--border)', paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)', mounted: false }, [
      'flWorkEmptyText',
      'flWorkEmptyButton'
    ]),
    text('flWorkEmptyText', 'Nothing here', 'flWorkEmpty', 'Nothing of that kind yet.', { ...T_BODY, color: 'var(--muted-foreground)', sizeMode: 'contentSize' }),
    button('flWorkEmptyButton', 'Show everything', 'flWorkEmpty', { ...OUTLINE, cssClassName: 'pressable' }),
    {
      id: 'flWorkData',
      type: STATIC_DATA_NODE,
      label: `${EDIT}the work itself — this list IS the page`,
      parameters: { type: 'json', json: WORK_JSON }
    },
    logic('flWorkVariable', VARIABLE_NODE, 'Which kind is selected', { name: WORK_FILTER_VARIABLE }),
    logic('flWorkFilter', FILTER_NODE, 'Narrow to the selected kind', {
      filterFilter: 'category',
      'filterFilterType-category': 'string',
      'filterFilterOp-category': 'regex',
      'filterFilterOption-case-category': false
    }),
    logic('flWorkCountFmt', FORMAT_NODE, 'Showing n of m', { format: 'Showing {n} of {total}' }),
    logic('flWorkIsEmpty', EXPRESSION_NODE, 'Did it match nothing?', { expression: 'shown === 0' }),
    logic('flWorkClear', SET_VARIABLE_NODE, 'Show everything again', { name: WORK_FILTER_VARIABLE, setWith: 'emptyString' }),
    // About — a photograph beside a short story, two-up, one column on a phone.
    // 🔴 A hand-built band, so `section()` did not give it its class — and the
    // nav link aimed at it scrolled nowhere until the target gate said so.
    group('flAbout', 'About', 'flMain', { ...BAND, cssClassName: sectionClass('flAbout') }, ['flAboutShell']),
    group('flAboutShell', 'Shell', 'flAbout', SHELL, ['flAboutColumns']),
    { id: 'flAboutColumns', type: COLUMNS_NODE, label: 'The photograph beside the story', parent: 'flAboutShell', parameters: { ...composition('columnsTwoUp'), marginY: px(32) }, children: ['flAboutPhotoBox', 'flAboutWords'] },
    group('flAboutPhotoBox', 'The photograph, rounded', 'flAboutColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', borderRadius: 'var(--radius-2xl)', clip: true }, ['flAboutPhoto']),
    {
      id: 'flAboutPhoto',
      type: 'Image',
      label: `${EDIT}a photograph of you at work`,
      parent: 'flAboutPhotoBox',
      parameters: { ...composition('cardImage'), height: px(420), src: photo('people-cafe.webp'), alt: 'A person working at a laptop in a café' }
    },
    group('flAboutWords', 'The story', 'flAboutColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-4)' }, [
      'flAboutEyebrow',
      'flAboutHeading',
      'flAboutBody1',
      'flAboutBody2',
      'flAboutWhere'
    ]),
    text('flAboutEyebrow', 'About — eyebrow', 'flAboutWords', 'About', T_EYEBROW),
    text('flAboutHeading', `${EDIT}About — heading`, 'flAboutWords', 'A short story about you', H_SECTION),
    text('flAboutBody1', `${EDIT}About — first paragraph`, 'flAboutWords', 'How you came to do this work, and how long you have been doing it. Say it the way you would say it to a client across a table.', T_BODY),
    text('flAboutBody2', `${EDIT}About — second paragraph`, 'flAboutWords', 'What you care about in the work, and what working with you is like. One paragraph is enough.', T_BODY),
    text('flAboutWhere', `${EDIT}About — where you are`, 'flAboutWords', 'Based in your town · working with people everywhere', T_META),
    // TPL-004 — two quotes side by side read as "we could only find two". One at
    // a time, with a way to the next, holds as many as somebody actually has.
    ...section('flQuotes', 'flMain', 'surface', { eyebrow: 'Kind words', heading: 'What clients say', editHeading: false }, ['flQuotesCarousel']),
    place('flQuotesCarousel', QUOTE_CAROUSEL_COMPONENT, 'The quotes, one at a time', 'flQuotesShell'),
    {
      id: 'flQuotesData',
      type: STATIC_DATA_NODE,
      label: `${EDIT}what clients said — add a row for each one`,
      parameters: { type: 'json', json: JSON.stringify([{"quote": "“A sentence or two a client actually said about working with you. Ask them; most people are glad to.”","name": "Their name","role": "What they do, and where","portrait": "noodl_modules/starter-imagery/avatar-4.webp","alt": "A man smiling, arms folded"},{"quote": "“Another one, in their own words. Leave the way they say things alone — polished quotes read as written by you.”","name": "Their name","role": "What they do, and where","portrait": "noodl_modules/starter-imagery/avatar-5.webp","alt": "A woman smiling outdoors"},{"quote": "“A third. Four or five is plenty: a person will read two and trust the rest exist.”","name": "Their name","role": "What they do, and where","portrait": "noodl_modules/starter-imagery/avatar-3.webp","alt": "A woman smiling in a hooded coat"},{"quote": "“The last one. If you have none yet, delete this whole band rather than write them yourself.”","name": "Their name","role": "What they do, and where","portrait": "noodl_modules/starter-imagery/avatar-1.webp","alt": "A young man laughing"}], null, 2) }
    }
  ],
  connections: [
    ...FREELANCER_FRAME.connections,
    ...heroWires('fl'),
    wire('flQuotesData', 'items', 'flQuotesCarousel', 'items'),
    wire('flQuotesData', 'count', 'flQuotesCarousel', 'count'),
    // TPL-004 — the list, the filter, the count, the empty state.
    wire('flWorkData', 'items', 'flWorkFilter', 'items'),
    wire('flWorkVariable', 'value', 'flWorkFilter', 'filterFilterValue-category'),
    wire('flWorkFilter', 'items', 'flWorkRepeat', 'items'),
    wire('flWorkFilter', 'count', 'flWorkCountFmt', 'n'),
    wire('flWorkData', 'count', 'flWorkCountFmt', 'total'),
    wire('flWorkCountFmt', 'formatted', 'flWorkCount', 'text'),
    wire('flWorkFilter', 'count', 'flWorkIsEmpty', 'shown'),
    wire('flWorkIsEmpty', 'asBoolean', 'flWorkEmpty', 'mounted'),
    wire('flWorkEmptyButton', 'onClick', 'flWorkClear', 'do')
  ]
};

// ── Pages/Business — a place people visit ────────────────────────────────────

const BZ_CONTACT = {
  heading: 'Book a table, or just ask',
  line: 'Questions, bookings, orders for a crowd. Say when you would like to come and how many of you there are.',
  button: 'Send'
};

const BUSINESS_FRAME = pageFrame('bz', {
  title: 'Local business',
  urlPath: 'business',
  label: 'Local business',
  mainChildren: ['bzHero', 'bzOffer', 'bzWhy', 'bzVisit', 'bzQuotes'],
  secondTarget: 'bzVisit',
  nav: [
    ['What we make', sectionClass('bzOffer')],
    ['Why here', sectionClass('bzWhy')],
    ['Visit', sectionClass('bzVisit')]
  ],
  contact: BZ_CONTACT
});

const BUSINESS: Tpl003Component = {
  path: 'Pages/Business',
  nodes: [
    ...BUSINESS_FRAME.nodes,
    // The hero stands on a photograph — a business is a place, and a place is
    // photographed rather than painted. The scrim is the composition's own.
    group(
      'bzHero',
      'The hero — a photograph of the place',
      'bzMain',
      { ...IMAGE_GROUND, backgroundImage: photo('people-coffee-shop.webp') },
      ['bzHeroShell']
    ),
    group('bzHeroShell', 'Shell', 'bzHero', { ...SHELL, alignItems: 'flex-start', rowGap: 'var(--space-5)' }, [
      'bzHeroBadge',
      'bzHeroHeading',
      'bzHeroLead',
      'bzHeroActions',
      'bzHeroNumbers'
    ]),
    group('bzHeroBadge', 'The badge', 'bzHeroShell', PILL, ['bzHeroBadgeGlyph', 'bzHeroBadgeText']),
    icon('bzHeroBadgeGlyph', 'The badge — glyph', 'bzHeroBadge', 'clock', 14, 'var(--primary-foreground)'),
    text('bzHeroBadgeText', `${EDIT}the badge on the hero`, 'bzHeroBadge', 'Open today until six', { ...T_META, fontWeight: 'var(--font-medium)', ...ON_DARK }),
    text('bzHeroHeading', `${EDIT}the headline`, 'bzHeroShell', 'What you make, and why people cross town for it', { ...H_HERO, ...ON_DARK }),
    text('bzHeroLead', `${EDIT}the line under the headline`, 'bzHeroShell', 'One sentence on the place itself: the street it is on, the people behind the counter, what it smells like at eight in the morning.', { ...T_LEAD, ...ON_DARK }),
    group('bzHeroActions', 'The two actions', 'bzHeroShell', ACTIONS, ['bzHeroPrimary', 'bzHeroSecondary']),
    button('bzHeroPrimary', 'Book a table', 'bzHeroActions', PRIMARY),
    button('bzHeroSecondary', 'Find us', 'bzHeroActions', GLASS_BUTTON),
    // Three numbers on glass, on the photograph.
    group(
      'bzHeroNumbers',
      'Three numbers, on glass',
      'bzHeroShell',
      // `contentSize` so the glass hugs the three numbers rather than running
      // the width of the shell; the first render had each number on its own
      // row inside a strip as wide as the photograph, because a stat is
      // `width: 100%` and a row hands a percentage child the whole row.
      { ...GLASS_STRIP, sizeMode: 'contentSize', maxWidth: pct(100), flexWrap: 'wrap', rowGap: 'var(--space-4)', columnGap: 'var(--space-8)' },
      ['bzNumber1Cell', 'bzNumber2Cell', 'bzNumber3Cell']
    ),
    ...[
      ['1', '2009', 'The year you opened'],
      ['2', '4.9', 'Your rating, and where from'],
      ['3', '7 days', 'Something true about the place']
    ].flatMap(([n, value, label]) => [
      group(`bzNumber${n}Cell`, `Number ${n} — its cell`, 'bzHeroNumbers', { sizeMode: 'contentHeight', width: px(190), flexDirection: 'column' }, [`bzNumber${n}`]),
      place(`bzNumber${n}`, STAT_COMPONENT, `${EDIT}number ${n} on the hero`, `bzNumber${n}Cell`, { value, label, color: 'var(--primary-foreground)' })
    ]),
    ...section('bzOffer', 'bzMain', 'paper', { eyebrow: 'What we make', heading: 'Three things people come in for' }, ['bzOfferGrid']),
    ...grid('bzOfferGrid', 'bzOfferShell', [
      { id: 'bzOffer1', type: PHOTO_CARD_COMPONENT, label: 'the first thing you sell', parameters: { picture: photo('food-bread.webp'), alt: 'Sourdough loaves', title: 'The first thing', line: 'One line on it: what it is, when it is ready, what it costs.', detail: 'What is in it, where it comes from, and what happens if somebody wants twenty of them.' } },
      { id: 'bzOffer2', type: PHOTO_CARD_COMPONENT, label: 'the second thing you sell', parameters: { picture: photo('food-plate.webp'), alt: 'A plated dish', title: 'The second thing', line: 'One line on it: what it is, when it is ready, what it costs.', detail: 'What is in it, where it comes from, and what happens if somebody wants twenty of them.' } },
      { id: 'bzOffer3', type: PHOTO_CARD_COMPONENT, label: 'the third thing you sell', parameters: { picture: photo('texture-coffee.webp'), alt: 'Roasted coffee beans', title: 'The third thing', line: 'One line on it: what it is, when it is ready, what it costs.', detail: 'What is in it, where it comes from, and what happens if somebody wants twenty of them.' } }
    ]),
    ...section('bzWhy', 'bzMain', 'surface', { eyebrow: 'Why here', heading: 'Three reasons this is the place' }, ['bzWhyGrid']),
    ...grid('bzWhyGrid', 'bzWhyShell', [
      { id: 'bzWhy1', type: FEATURE_COMPONENT, label: 'the first reason', parameters: { icon: 'leaf', title: 'The first reason', line: 'Where things come from, who makes them, what you refuse to do.' } },
      { id: 'bzWhy2', type: FEATURE_COMPONENT, label: 'the second reason', parameters: { icon: 'heart', title: 'The second reason', line: 'The people. Say who is behind the counter and how long they have been.' } },
      { id: 'bzWhy3', type: FEATURE_COMPONENT, label: 'the third reason', parameters: { icon: 'truck', title: 'The third reason', line: 'Something practical: delivery, parking, a room for a party.' } }
    ]),
    // Where and when — the address and the hours beside a photograph of the street.
    // The same hole, and this one cost two links: the nav's third and the hero's
    // "Find us".
    group('bzVisit', 'Visit', 'bzMain', { ...BAND, cssClassName: sectionClass('bzVisit') }, ['bzVisitShell']),
    group('bzVisitShell', 'Shell', 'bzVisit', SHELL, ['bzVisitColumns']),
    { id: 'bzVisitColumns', type: COLUMNS_NODE, label: 'Where and when, beside the street', parent: 'bzVisitShell', parameters: { ...composition('columnsTwoUp'), marginY: px(32) }, children: ['bzVisitWords', 'bzVisitPhotoBox'] },
    group('bzVisitWords', 'Where and when', 'bzVisitColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-3)' }, [
      'bzVisitEyebrow',
      'bzVisitHeading',
      'bzVisitAddress',
      'bzHours1',
      'bzHours2',
      'bzHours3',
      'bzHours4'
    ]),
    text('bzVisitEyebrow', 'Visit — eyebrow', 'bzVisitWords', 'Visit', T_EYEBROW),
    text('bzVisitHeading', 'Visit — heading', 'bzVisitWords', 'Where we are and when we are open', H_SECTION),
    text('bzVisitAddress', `${EDIT}the address`, 'bzVisitWords', 'Your street address, your town, your postcode. Delete this and write yours.', T_BODY),
    place('bzHours1', HOURS_ROW_COMPONENT, `${EDIT}opening hours, weekdays`, 'bzVisitWords', { day: 'Monday to Friday', time: '7am – 6pm' }),
    place('bzHours2', HOURS_ROW_COMPONENT, `${EDIT}opening hours, Saturday`, 'bzVisitWords', { day: 'Saturday', time: '8am – 5pm' }),
    place('bzHours3', HOURS_ROW_COMPONENT, `${EDIT}opening hours, Sunday`, 'bzVisitWords', { day: 'Sunday', time: '9am – 3pm' }),
    place('bzHours4', HOURS_ROW_COMPONENT, `${EDIT}opening hours, holidays`, 'bzVisitWords', { day: 'Bank holidays', time: 'Closed' }),
    group('bzVisitPhotoBox', 'The street, rounded', 'bzVisitColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', borderRadius: 'var(--radius-2xl)', clip: true }, ['bzVisitPhoto']),
    {
      id: 'bzVisitPhoto',
      type: 'Image',
      label: `${EDIT}a photograph of the street or the door`,
      parent: 'bzVisitPhotoBox',
      parameters: { ...composition('cardImage'), height: px(420), src: photo('food-grocer.webp'), alt: 'A greengrocer stall with a customer' }
    },
    ...section('bzQuotes', 'bzMain', 'surface', { eyebrow: 'Kind words', heading: 'What regulars say', editHeading: false }, ['bzQuotesCarousel']),
    place('bzQuotesCarousel', QUOTE_CAROUSEL_COMPONENT, 'The quotes, one at a time', 'bzQuotesShell'),
    {
      id: 'bzQuotesData',
      type: STATIC_DATA_NODE,
      label: `${EDIT}what regulars said — add a row for each one`,
      parameters: { type: 'json', json: JSON.stringify([{"quote": "“A sentence or two a customer actually said about working with you. Ask them; most people are glad to.”","name": "Their name","role": "A regular since whenever","portrait": "noodl_modules/starter-imagery/avatar-4.webp","alt": "A man smiling, arms folded"},{"quote": "“Another one, in their own words. Leave the way they say things alone — polished quotes read as written by you.”","name": "Their name","role": "A regular since whenever","portrait": "noodl_modules/starter-imagery/avatar-5.webp","alt": "A woman smiling outdoors"},{"quote": "“A third. Four or five is plenty: a person will read two and trust the rest exist.”","name": "Their name","role": "A regular since whenever","portrait": "noodl_modules/starter-imagery/avatar-3.webp","alt": "A woman smiling in a hooded coat"},{"quote": "“The last one. If you have none yet, delete this whole band rather than write them yourself.”","name": "Their name","role": "A regular since whenever","portrait": "noodl_modules/starter-imagery/avatar-1.webp","alt": "A young man laughing"}], null, 2) }
    }
  ],
  connections: [
    ...BUSINESS_FRAME.connections,
    ...heroWires('bz'),
    wire('bzQuotesData', 'items', 'bzQuotesCarousel', 'items'),
    wire('bzQuotesData', 'count', 'bzQuotesCarousel', 'count')
  ]
};

// ── Pages/Launch — something that does not exist yet ─────────────────────────

const LN_CONTACT = {
  heading: 'Get early access',
  line: 'Leave your name and a line about what you would use it for. The first people in get it first, and free.',
  button: 'Count me in'
};

const LAUNCH_FRAME = pageFrame('ln', {
  title: 'Product launch',
  urlPath: 'launch',
  label: 'Product launch',
  mainChildren: ['lnHero', 'lnFeatures', 'lnNumbers', 'lnSteps', 'lnPricing', 'lnFaq', 'lnCta'],
  secondTarget: 'lnSteps',
  nav: [
    ['What it does', sectionClass('lnFeatures')],
    ['How it works', sectionClass('lnSteps')],
    ['Price', sectionClass('lnPricing')]
  ],
  contact: LN_CONTACT
});

/**
 * 🔴 **Not the freelancer page with different words.** The first version was —
 * three bands of three cards under a gradient hero — and Richard said so:
 * *"too much like the freelancer one … three rows of three column cards
 * repeated, it feels lazy."* A launch page has a different job: it has to show
 * a thing that does not exist yet. So it opens on the product (a stand-in
 * window beside the headline), explains it in two alternating text-and-window
 * rows, sets its numbers large on ink, lists the steps down a column, prices
 * it, and answers questions in two columns. No card grid anywhere.
 */
function zigzag(id: string, parent: string, flip: boolean, words: { eyebrow: string; heading: string; body: string; points: string[] }, mock: { title: string; rows: string[] }): unknown[] {
  const wordsId = `${id}Words`;
  const mockId = `${id}Mock`;
  return [
    {
      id,
      type: COLUMNS_NODE,
      label: flip ? 'The window, then the words' : 'The words, then the window',
      parent,
      parameters: { ...composition('columnsTwoUp'), marginY: px(32) },
      children: flip ? [`${mockId}Cell`, wordsId] : [wordsId, `${mockId}Cell`]
    },
    group(wordsId, words.eyebrow, id, { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-4)', justifyContent: 'center' }, [
      `${id}Eyebrow`,
      `${id}Heading`,
      `${id}Body`,
      `${id}Points`
    ]),
    text(`${id}Eyebrow`, `${words.eyebrow} — eyebrow`, wordsId, words.eyebrow, T_EYEBROW),
    text(`${id}Heading`, `${EDIT}${words.eyebrow} — heading`, wordsId, words.heading, H_SECTION),
    text(`${id}Body`, `${EDIT}${words.eyebrow} — the paragraph`, wordsId, words.body, { ...T_BODY, color: 'var(--muted-foreground)' }),
    group(`${id}Points`, 'The points', wordsId, { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-3)' }, words.points.map((_, i) => `${id}Point${i + 1}`)),
    ...words.points.map((point, i) => place(`${id}Point${i + 1}`, CHECK_COMPONENT, `${EDIT}${words.eyebrow} — point ${i + 1}`, `${id}Points`, { text: point, color: 'var(--foreground)' })),
    group(`${mockId}Cell`, 'The window', id, { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)' }, [mockId]),
    place(mockId, MOCK_COMPONENT, `${EDIT}a picture of the product goes here (this window is a stand-in)`, `${mockId}Cell`, {
      title: mock.title,
      row1: mock.rows[0],
      row2: mock.rows[1],
      row3: mock.rows[2]
    })
  ];
}

const LAUNCH: Tpl003Component = {
  path: 'Pages/Launch',
  nodes: [
    ...LAUNCH_FRAME.nodes,
    // ── The hero: the promise beside the product ──────────────────────────
    group('lnHero', 'The hero', 'lnMain', { ...composition('heroGround'), sizeMode: 'contentHeight', paddingBottom: 'var(--space-16)' }, ['lnHeroShell']),
    group('lnHeroShell', 'Shell', 'lnHero', SHELL, ['lnHeroColumns']),
    {
      id: 'lnHeroColumns',
      type: COLUMNS_NODE,
      label: 'The words beside the window',
      parent: 'lnHeroShell',
      parameters: { ...composition('columnsTwoUp'), marginY: px(40) },
      children: ['lnHeroWords', 'lnHeroMockCell']
    },
    group('lnHeroWords', 'The promise', 'lnHeroColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', alignItems: 'flex-start', rowGap: 'var(--space-5)', justifyContent: 'center' }, [
      'lnHeroBadge',
      'lnHeroHeading',
      'lnHeroLead',
      'lnHeroActions',
      'lnHeroNote'
    ]),
    group('lnHeroBadge', 'The badge', 'lnHeroWords', PILL, ['lnHeroBadgeGlyph', 'lnHeroBadgeText']),
    icon('lnHeroBadgeGlyph', 'The badge — glyph', 'lnHeroBadge', 'rocket', 14, 'var(--primary-foreground)'),
    text('lnHeroBadgeText', `${EDIT}the badge on the hero`, 'lnHeroBadge', 'Launching this spring', { ...T_META, fontWeight: 'var(--font-medium)', ...ON_DARK }),
    // `--display-md`, not `-lg`: this headline has half the measure.
    text('lnHeroHeading', `${EDIT}the headline`, 'lnHeroWords', 'The promise, in one line, in words a customer would use', { ...H_HERO, fontSize: 'var(--display-md)', ...ON_DARK }),
    text('lnHeroLead', `${EDIT}the line under the headline`, 'lnHeroWords', 'Two sentences on what it replaces and what it feels like to use instead. Say the boring thing it saves people from.', { ...T_LEAD, ...ON_DARK }),
    group('lnHeroActions', 'The two actions', 'lnHeroWords', ACTIONS, ['lnHeroPrimary', 'lnHeroSecondary']),
    button('lnHeroPrimary', 'Get early access', 'lnHeroActions', PRIMARY),
    button('lnHeroSecondary', 'How it works', 'lnHeroActions', GLASS_BUTTON),
    text('lnHeroNote', `${EDIT}the small line under the buttons`, 'lnHeroWords', 'Free while it is in beta · no card needed', { ...T_META, ...ON_DARK }),
    group('lnHeroMockCell', 'The window', 'lnHeroColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column', justifyContent: 'center' }, ['lnHeroMock']),
    place('lnHeroMock', MOCK_COMPONENT, `${EDIT}a picture of the product goes here (this window is a stand-in)`, 'lnHeroMockCell', {
      title: 'What the product shows first',
      row1: 'The first thing in it',
      row2: 'The second thing in it',
      row3: 'The third thing in it'
    }),

    // ── What it does: two rows, words beside a window, alternating ────────
    ...section('lnFeatures', 'lnMain', 'paper', { eyebrow: 'What it does', heading: 'Two things it does that nothing else does' }, ['lnFeatureA', 'lnFeatureB']),
    ...zigzag('lnFeatureA', 'lnFeaturesShell', false, {
      eyebrow: 'The first thing',
      heading: 'What it does, said as a benefit',
      body: 'A paragraph on the problem it removes. Describe the Tuesday afternoon it saves, not the feature list.',
      points: ['A specific thing it does', 'Another specific thing it does', 'The thing people will not believe until they try it']
    }, { title: 'The first thing, shown', rows: ['A row that shows it', 'Another row', 'A third row'] }),
    ...zigzag('lnFeatureB', 'lnFeaturesShell', true, {
      eyebrow: 'The second thing',
      heading: 'The second thing, as a benefit',
      body: 'A paragraph on what happens on its own once it is set up. Say what they never have to think about again.',
      points: ['A specific thing it does', 'Another specific thing it does', 'What it costs them if they keep doing it by hand']
    }, { title: 'The second thing, shown', rows: ['A row that shows it', 'Another row', 'A third row'] }),

    // ── The numbers, large, on ink ────────────────────────────────────────
    group('lnNumbers', 'The numbers', 'lnMain', { ...BAND, backgroundGradient: 'var(--gradient-deep)' }, ['lnNumbersShell']),
    group('lnNumbersShell', 'Shell', 'lnNumbers', SHELL, ['lnNumbersHead', 'lnNumbersGrid']),
    group('lnNumbersHead', 'The numbers — head', 'lnNumbersShell', SECTION_HEAD, ['lnNumbersEyebrow', 'lnNumbersHeading']),
    text('lnNumbersEyebrow', 'The numbers — eyebrow', 'lnNumbersHead', 'From the pilot', { ...T_EYEBROW, ...ON_DARK }),
    text('lnNumbersHeading', `${EDIT}The numbers — heading`, 'lnNumbersHead', 'Three numbers you can stand behind', { ...H_SECTION, ...ON_DARK }),
    { id: 'lnNumbersGrid', type: COLUMNS_NODE, label: 'The grid', parent: 'lnNumbersShell', parameters: { ...composition('gridAutoFit'), minWidth: px(300), marginY: px(32) }, children: ['lnNumber1Cell', 'lnNumber2Cell', 'lnNumber3Cell'] },
    ...[
      ['1', '2,400', 'Of the thing it counts, in the pilot'],
      ['2', '98%', 'Of the thing it improves'],
      ['3', '11 min', 'Saved every time, on average']
    ].flatMap(([n, value, label]) => [
      group(`lnNumber${n}Cell`, `Number ${n} — its cell`, 'lnNumbersGrid', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, [`lnNumber${n}`]),
      place(`lnNumber${n}`, BIG_STAT_COMPONENT, `${EDIT}the number, ${n === '1' ? 'first' : n === '2' ? 'second' : 'third'}`, `lnNumber${n}Cell`, { value, label })
    ]),

    // ── How it works: down a column, not across a row ─────────────────────
    ...section('lnSteps', 'lnMain', 'surface', { eyebrow: 'How it works', heading: 'Three steps, one afternoon' }, ['lnStepsList']),
    group('lnStepsList', 'The steps', 'lnStepsShell', { width: pct(100), maxWidth: px(720), sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-8)' }, ['lnStep1', 'lnStep2', 'lnStep3']),
    place('lnStep1', STEP_COMPONENT, `${EDIT}the first step`, 'lnStepsList', { number: '01', title: 'The first step', line: 'What they do first, and how long it takes. This is the only step that costs them anything.' }),
    place('lnStep2', STEP_COMPONENT, `${EDIT}the second step`, 'lnStepsList', { number: '02', title: 'The second step', line: 'What happens next, without them doing anything.' }),
    place('lnStep3', STEP_COMPONENT, `${EDIT}the third step`, 'lnStepsList', { number: '03', title: 'The third step', line: 'What they have at the end that they did not have before.' }),

    // ── The price, two ways, one of them in ink ───────────────────────────
    ...section('lnPricing', 'lnMain', 'paper', { eyebrow: 'The price', heading: 'Say the number' }, ['lnPeriodRow', 'lnPlans', 'lnPeriodNote']),
    // ── TPL-004: monthly or yearly, from one node ─────────────────────────
    //
    // 🔴 **Seven values on ONE `States`, and that is the point.** A price, a
    // second price, a line under the table and the two pills' own colours are
    // all the same fact — *which period is selected* — read five ways. Split
    // across a `Condition` per colour and an `Expression` per price it is nine
    // nodes that can disagree with each other; here there is one node and no
    // arrangement of it that can show a yearly price beside a lit "Monthly".
    // ⚠️ `padding` is not a Group port — there are four, and the door refused the
    // shorthand. Likewise `borderWidth`/`borderColor` are inert on a button whose
    // `borderStyle` is `none`, so `OUTLINE` cannot be spread here: these two are
    // built from their own parameters, and `States` supplies both colours.
    group('lnPeriodRow', 'Monthly or yearly', 'lnPricingShell', {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'var(--space-1)',
      paddingTop: 'var(--space-1)',
      paddingBottom: 'var(--space-1)',
      paddingLeft: 'var(--space-1)',
      paddingRight: 'var(--space-1)',
      backgroundColor: 'var(--muted)',
      borderRadius: 'var(--radius-full)'
    }, ['lnPeriodMonthly', 'lnPeriodYearly']),
    ...['Monthly', 'Yearly'].map((period) =>
      button(`lnPeriod${period}`, period, 'lnPeriodRow', {
        sizeMode: 'contentSize',
        borderStyle: 'none',
        borderRadius: 'var(--radius-full)',
        paddingTop: 'var(--space-2)',
        paddingBottom: 'var(--space-2)',
        paddingLeft: 'var(--space-5)',
        paddingRight: 'var(--space-5)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--font-semibold)',
        backgroundColor: 'transparent',
        color: 'var(--muted-foreground)',
        cssClassName: 'pill pressable'
      })
    ),
    text('lnPeriodNote', `${EDIT}what the yearly price actually saves them`, 'lnPricingShell', '', { ...T_META, textAlignX: 'center' }),
    logic('lnPeriod', STATES_NODE, `${EDIT}the two prices, monthly and yearly`, {
      states: 'monthly,yearly',
      values: 'freePrice,paidPrice,note,mBg,mFg,yBg,yFg',
      'type-freePrice': 'string',
      'type-paidPrice': 'string',
      'type-note': 'string',
      'type-mBg': 'color',
      'type-mFg': 'color',
      'type-yBg': 'color',
      'type-yFg': 'color',
      'value-monthly-freePrice': 'Free',
      'value-yearly-freePrice': 'Free',
      'value-monthly-paidPrice': 'The number, a month',
      'value-yearly-paidPrice': 'The number, a year',
      'value-monthly-note': 'Say what a month costs. If you have not decided, say “pricing when we launch”.',
      'value-yearly-note': 'Say what a year costs, and what that saves against paying monthly.',
      'value-monthly-mBg': 'var(--surface-raised)',
      'value-yearly-mBg': 'transparent',
      'value-monthly-mFg': 'var(--foreground)',
      'value-yearly-mFg': 'var(--muted-foreground)',
      'value-monthly-yBg': 'transparent',
      'value-yearly-yBg': 'var(--surface-raised)',
      'value-monthly-yFg': 'var(--muted-foreground)',
      'value-yearly-yFg': 'var(--foreground)',
      useTransitions: false
    }),
    { id: 'lnPlans', type: COLUMNS_NODE, label: 'Two plans', parent: 'lnPricingShell', parameters: { ...composition('columnsTwoUp'), marginX: px(24), marginY: px(24) }, children: ['lnPlanFreeCell', 'lnPlanPaidCell'] },
    group('lnPlanFreeCell', 'The free plan — its cell', 'lnPlans', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, ['lnPlanFree']),
    place('lnPlanFree', PLAN_COMPONENT, `${EDIT}the first plan`, 'lnPlanFreeCell', {
      name: 'While it is in beta',
      line: 'For everyone who joins before launch.',
      point1: 'Everything it does today',
      point2: 'A say in what it does next',
      point3: 'Your price held when it launches',
      action: 'Get early access',
      ground: 'var(--surface)',
      edge: 'var(--border)',
      ink: 'var(--foreground)'
    }),
    group('lnPlanPaidCell', 'The paid plan — its cell', 'lnPlans', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, ['lnPlanPaid']),
    place('lnPlanPaid', PLAN_COMPONENT, `${EDIT}the second plan`, 'lnPlanPaidCell', {
      name: 'After launch',
      line: 'Everything in the first plan, and the thing people pay for.',
      point1: 'Everything in the first plan',
      point2: 'The thing the paid plan adds',
      point3: 'The other thing it adds',
      action: 'Join the list',
      ground: 'var(--foreground)',
      edge: 'var(--foreground)',
      ink: 'var(--primary-foreground)'
    }),

    // ── Questions, two columns ────────────────────────────────────────────
    ...section('lnFaq', 'lnMain', 'surface', { eyebrow: 'Questions', heading: 'The things people ask before they sign up' }, ['lnFaqColumns']),
    { id: 'lnFaqColumns', type: COLUMNS_NODE, label: 'Two columns of questions', parent: 'lnFaqShell', parameters: { ...composition('columnsTwoUp'), marginY: px(0) }, children: ['lnFaqLeft', 'lnFaqRight'] },
    group('lnFaqLeft', 'The left column', 'lnFaqColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, ['lnFaq1', 'lnFaq2']),
    group('lnFaqRight', 'The right column', 'lnFaqColumns', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, ['lnFaq3', 'lnFaq4']),
    place('lnFaq1', FAQ_ROW_COMPONENT, `${EDIT}the first question`, 'lnFaqLeft', { question: 'The question people ask first', answer: 'The honest answer, in two sentences. If the answer is “not yet”, say so and say when.' }),
    place('lnFaq2', FAQ_ROW_COMPONENT, `${EDIT}the second question`, 'lnFaqLeft', { question: 'Whether their data is safe', answer: 'Where it lives, who can see it, and how they get it out again.' }),
    place('lnFaq3', FAQ_ROW_COMPONENT, `${EDIT}the third question`, 'lnFaqRight', { question: 'What happens after they sign up', answer: 'The next thing they will hear from you, and roughly when.' }),
    place('lnFaq4', FAQ_ROW_COMPONENT, `${EDIT}the fourth question`, 'lnFaqRight', { question: 'Whether they can leave', answer: 'How to cancel, and what happens to what they made.' }),

    // ── The closing band ──────────────────────────────────────────────────
    group('lnCta', 'The closing band', 'lnMain', { ...composition('ctaBand'), as: 'section' }, ['lnCtaShell']),
    group('lnCtaShell', 'Shell', 'lnCta', { ...SHELL, maxWidth: px(720), alignItems: 'center', rowGap: 'var(--space-5)' }, ['lnCtaHeading', 'lnCtaLead', 'lnCtaButton']),
    text('lnCtaHeading', `${EDIT}the closing line`, 'lnCtaShell', 'Be first through the door', { ...H_SECTION, ...ON_DARK, textAlignX: 'center' }),
    text('lnCtaLead', `${EDIT}the line under the closing line`, 'lnCtaShell', 'One sentence on what the first people in get that nobody else will.', { ...T_LEAD, ...ON_DARK, textAlignX: 'center' }),
    button('lnCtaButton', 'Join the list', 'lnCtaShell', ON_BRAND_BUTTON)
  ],
  connections: [
    ...LAUNCH_FRAME.connections,
    ...heroWires('ln'),
    wire('lnCtaButton', 'onClick', 'lnGoContact', 'go'),
    // Both plans lead to the form: the price is a reason to sign up, not a checkout.
    wire('lnPlanFree', 'chosen', 'lnGoContact', 'go'),
    wire('lnPlanPaid', 'chosen', 'lnGoContact', 'go'),
    // TPL-004 — the period toggle, and the five things it decides.
    wire('lnPeriodMonthly', 'onClick', 'lnPeriod', 'to-monthly'),
    wire('lnPeriodYearly', 'onClick', 'lnPeriod', 'to-yearly'),
    wire('lnPeriod', 'freePrice', 'lnPlanFree', 'price'),
    wire('lnPeriod', 'paidPrice', 'lnPlanPaid', 'price'),
    wire('lnPeriod', 'note', 'lnPeriodNote', 'text'),
    wire('lnPeriod', 'mBg', 'lnPeriodMonthly', 'backgroundColor'),
    wire('lnPeriod', 'mFg', 'lnPeriodMonthly', 'color'),
    wire('lnPeriod', 'yBg', 'lnPeriodYearly', 'backgroundColor'),
    wire('lnPeriod', 'yFg', 'lnPeriodYearly', 'color')
  ]
};

// ── Author order ─────────────────────────────────────────────────────────────

/** The parts a page places, before the pages that place them. */
export const TPL003_PARTS: Tpl003Component[] = [SCROLL_TO, SWITCHER, HEADER, FOOTER, FEATURE, SERVICE_CARD, STEP, STAT, PHOTO_CARD, FILTER_PILL, CASE_STUDY, WORK_CARD, QUOTE, QUOTE_CAROUSEL, FAQ_ROW, HOURS_ROW, EMAIL_CHECK, FIELD_PART, CONTACT, CHECK, MOCK_ROW, MOCK, BIG_STAT, PLAN];

/** The pages. 🔴 The first one written becomes the router's start page, and it must be the freelancer look at `/`. */
export const TPL003_PAGES: Tpl003Component[] = [FREELANCER, BUSINESS, LAUNCH];

export const TPL003_COMPONENTS: Tpl003Component[] = [...TPL003_PARTS, ...TPL003_PAGES];

/** The create-pass payload: the same nodes, minus the ones that name something not yet authored. */
export function createPass(component: Tpl003Component): { nodes: unknown[]; connections: unknown[] } {
  if (!component.deferred?.length) return { nodes: component.nodes, connections: component.connections };
  const deferred = new Set(component.deferred);
  return {
    nodes: component.nodes.filter((n) => !deferred.has((n as { id: string }).id)),
    connections: component.connections.filter(
      (c) => !deferred.has((c as { fromId: string }).fromId) && !deferred.has((c as { toId: string }).toId)
    )
  };
}
