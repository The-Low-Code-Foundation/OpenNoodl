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

export const SWITCHER_COMPONENT = '/Site/Switcher';
export const HEADER_COMPONENT = '/Site/Header';
export const FOOTER_COMPONENT = '/Site/Footer';
export const CONTACT_COMPONENT = '/Site/Contact';
export const FEATURE_COMPONENT = '/Site/Feature';
export const STEP_COMPONENT = '/Site/Step';
export const STAT_COMPONENT = '/Site/Stat';
export const PHOTO_CARD_COMPONENT = '/Site/PhotoCard';
export const QUOTE_COMPONENT = '/Site/Quote';
export const FAQ_ROW_COMPONENT = '/Site/FaqRow';
export const HOURS_ROW_COMPONENT = '/Site/HoursRow';
export const CHECK_COMPONENT = '/Site/Check';
export const MOCK_COMPONENT = '/Site/Mock';
export const BIG_STAT_COMPONENT = '/Site/BigStat';
export const PLAN_COMPONENT = '/Site/Plan';
export const FIELD_COMPONENT = '/Site/Field';

export const PAGE_FREELANCER = '/Pages/Freelancer';
export const PAGE_BUSINESS = '/Pages/Business';
export const PAGE_LAUNCH = '/Pages/Launch';

/** The label prefix the editor's node tree lists, and `START-HERE.md` is built from. */
export const EDIT = 'EDIT — ';

/** The address the form sends to until somebody changes it. Obviously unfinished, on purpose. */
export const PLACEHOLDER_ADDRESS = 'EDIT ME — you@example.com';

const COLUMNS_NODE = 'net.noodl.visual.columns';
const ICON_NODE = 'net.noodl.visual.icon';
const BUTTON_NODE = 'net.noodl.controls.button';
const INPUT_NODE = 'net.noodl.controls.textinput';
const LINK_NODE = 'net.noodl.externallink';

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

// ── The app shell ────────────────────────────────────────────────────────────

export const APP_COMPONENT = 'App';

export const APP_NODES = [
  group('app_root', 'App', undefined, { sizeMode: 'explicit', width: pct(100), height: pct(100) }, ['app_router']),
  { id: 'app_router', type: 'Router', label: 'Main router', parent: 'app_root', parameters: { name: ROUTER } }
];
export const APP_WIRES: unknown[] = [];

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

// ── Site/Header — the wordmark and the one way to the form ───────────────────

/**
 * The header's button cannot scroll anything itself — the form is on the page
 * that places the header, and a component cannot reach a node outside itself.
 * So the click leaves through a `Component Outputs` signal and the page wires
 * it to its own ground's `Scroll To Element`.
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
        backgroundColor: 'var(--background)',
        borderBottomStyle: 'solid',
        borderBottomWidth: 'var(--border-1)',
        borderBottomColor: 'var(--border)',
        paddingTop: 'var(--space-4)',
        paddingBottom: 'var(--space-4)'
      },
      ['hdShell']
    ),
    group(
      'hdShell',
      'Shell',
      'hdBand',
      { ...SHELL_ROW, alignItems: 'center', justifyContent: 'space-between', columnGap: 'var(--space-4)' },
      ['hdMark', 'hdContact']
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
    button('hdContact', 'Get in touch', 'hdShell', OUTLINE),
    { id: 'hdOutputs', type: 'Component Outputs', label: 'What the header asks the page to do', ports: [{ name: 'contact', type: 'signal', plug: 'input' }] }
  ],
  connections: [{ fromId: 'hdContact', fromProperty: 'onClick', toId: 'hdOutputs', toProperty: 'contact' }]
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

const PHOTO_CARD: Tpl003Component = {
  path: 'Site/PhotoCard',
  nodes: [
    group('pcCard', 'One card', undefined, CARD, ['pcPhoto', 'pcBody']),
    {
      id: 'pcPhoto',
      type: 'Image',
      label: 'The photograph',
      parent: 'pcCard',
      // `cardImage`: without `sizeMode: explicit` the height and `objectFit` are inert,
      // and three cards of different natural heights are the tell one level down.
      parameters: { ...composition('cardImage'), height: px(220), src: '', alt: '' }
    },
    group('pcBody', 'The words', 'pcCard', { ...CARD_BODY, sizeMode: 'contentHeight' }, ['pcTitle', 'pcLine']),
    text('pcTitle', 'What it is', 'pcBody', '', H_CARD),
    text('pcLine', 'A line about it', 'pcBody', '', T_META),
    inputs('pcInputs', 'The card', ['picture', 'alt', 'title', 'line'])
  ],
  connections: [
    { fromId: 'pcInputs', fromProperty: 'picture', toId: 'pcPhoto', toProperty: 'src' },
    { fromId: 'pcInputs', fromProperty: 'alt', toId: 'pcPhoto', toProperty: 'alt' },
    { fromId: 'pcInputs', fromProperty: 'title', toId: 'pcTitle', toProperty: 'text' },
    { fromId: 'pcInputs', fromProperty: 'line', toId: 'pcLine', toProperty: 'text' }
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

// ── Site/FaqRow — a question and its answer, ruled ───────────────────────────

const FAQ_ROW: Tpl003Component = {
  path: 'Site/FaqRow',
  nodes: [
    group(
      'fqRow',
      'One question',
      undefined,
      { ...composition('ruled'), flexDirection: 'column', alignItems: 'flex-start', rowGap: 'var(--space-2)', paddingTop: 'var(--space-5)', paddingBottom: 'var(--space-5)' },
      ['fqQuestion', 'fqAnswer']
    ),
    text('fqQuestion', 'The question', 'fqRow', '', { ...H_CARD, fontSize: 'var(--text-lg)' }),
    text('fqAnswer', 'The answer', 'fqRow', '', { ...T_BODY, color: 'var(--muted-foreground)' }),
    inputs('fqInputs', 'The question', ['question', 'answer'])
  ],
  connections: [
    { fromId: 'fqInputs', fromProperty: 'question', toId: 'fqQuestion', toProperty: 'text' },
    { fromId: 'fqInputs', fromProperty: 'answer', toId: 'fqAnswer', toProperty: 'text' }
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
export const MISSING_TEXT = 'Please fill in all three boxes first.';

const NOTICE = { ...CARD, ...CARD_BODY, sizeMode: 'contentHeight', backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', mounted: false };

const CONDITION_GATE = { condition: true, 'runOnChange-condition': false };

// ── Site/Field — a label over a control ──────────────────────────────────────

/**
 * One labelled field. A component because the door said so: three of these
 * inline in the form are *"3 sibling subtrees … structurally identical"*, and
 * the remedy it names is this. What was typed leaves through a `Component
 * Outputs` value port, so the form can read three fields from three instances.
 */
const FIELD_PART: Tpl003Component = {
  path: 'Site/Field',
  nodes: [
    group('fdField', 'The field', undefined, FIELD, ['fdLabel', 'fdInput']),
    text('fdLabel', 'The label', 'fdField', '', T_LABEL),
    { id: 'fdInput', type: INPUT_NODE, label: 'The control', parent: 'fdField', parameters: { ...TEXT_FIELD, placeholder: '' } },
    inputs('fdInputs', 'The field', ['label', 'type']),
    { id: 'fdOutputs', type: 'Component Outputs', label: 'What was typed', ports: [{ name: 'text', type: 'string', plug: 'input' }] }
  ],
  connections: [
    { fromId: 'fdInputs', fromProperty: 'label', toId: 'fdLabel', toProperty: 'text' },
    { fromId: 'fdInputs', fromProperty: 'type', toId: 'fdInput', toProperty: 'type' },
    { fromId: 'fdInput', fromProperty: 'onTextChanged', toId: 'fdOutputs', toProperty: 'text' }
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
    place('ctName', FIELD_COMPONENT, 'Your name', 'ctCard', { label: 'Your name', type: 'text' }),
    place('ctEmail', FIELD_COMPONENT, 'Your email', 'ctCard', { label: 'Your email', type: 'email' }),
    place('ctMessage', FIELD_COMPONENT, 'Your message', 'ctCard', { label: 'Your message', type: 'textArea' }),
    button('ctSend', 'Send', 'ctCard', PRIMARY),
    text('ctHint', 'What Send does', 'ctCard', 'Send opens your mail app with the message written for you.', T_HINT),
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
 * 🔴 **The scroll targets are two different Groups, and that is a port count,
 * not a preference.** A Group holds ONE `Scroll To Element - Element`, so the
 * ground scrolls to the form and the `main` scrolls to whatever the hero's
 * second button points at.
 */
function pageFrame(
  p: string,
  opts: { title: string; urlPath: string; label: string; mainChildren: string[]; secondTarget?: string; contact: { heading: string; line: string; button: string } }
): { nodes: unknown[]; connections: unknown[] } {
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
    place(`${p}Header`, HEADER_COMPONENT, 'The header', `${p}Ground`),
    group(`${p}Main`, 'The page', `${p}Ground`, { as: 'main', width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, [
      ...opts.mainChildren,
      `${p}ContactAnchor`
    ]),
    // 🔴 A plain Group around the instance, because a component INSTANCE has no
    // `this` output — measured in the first render: *"Node /Site/Contact
    // doesn't have a port named this"* on every page, and nothing scrolled.
    group(`${p}ContactAnchor`, 'Where "Get in touch" lands', `${p}Main`, { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, [`${p}Contact`]),
    place(`${p}Contact`, CONTACT_COMPONENT, 'The contact band', `${p}ContactAnchor`, opts.contact),
    place(`${p}Footer`, FOOTER_COMPONENT, 'The foot of the page', `${p}Ground`)
  ];
  const connections: unknown[] = [
    { fromId: `${p}ContactAnchor`, fromProperty: 'this', toId: `${p}Ground`, toProperty: 'scrollToElement.element' },
    { fromId: `${p}Header`, fromProperty: 'contact', toId: `${p}Ground`, toProperty: 'scrollToElement.do' }
  ];
  if (opts.secondTarget) {
    connections.push({ fromId: opts.secondTarget, fromProperty: 'this', toId: `${p}Main`, toProperty: 'scrollToElement.element' });
  }
  return { nodes, connections };
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
    group(id, head.eyebrow, parent, ground === 'paper' ? BAND : BAND_SURFACE, [`${id}Shell`]),
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
    { fromId: `${p}HeroPrimary`, fromProperty: 'onClick', toId: `${p}Ground`, toProperty: 'scrollToElement.do' },
    { fromId: `${p}HeroSecondary`, fromProperty: 'onClick', toId: `${p}Main`, toProperty: 'scrollToElement.do' }
  ];
}

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
      { id: 'flService1', type: FEATURE_COMPONENT, label: 'the first service', parameters: { icon: 'pencil', title: 'The first service', line: 'One line on what it includes and what they get at the end.' } },
      { id: 'flService2', type: FEATURE_COMPONENT, label: 'the second service', parameters: { icon: 'layout-grid', title: 'The second service', line: 'One line on what it includes and what they get at the end.' } },
      { id: 'flService3', type: FEATURE_COMPONENT, label: 'the third service', parameters: { icon: 'line-chart', title: 'The third service', line: 'One line on what it includes and what they get at the end.' } }
    ]),
    ...section('flWork', 'flMain', 'surface', { eyebrow: 'Recent work', heading: 'Three pieces of work you are proud of' }, ['flWorkGrid']),
    ...grid('flWorkGrid', 'flWorkShell', [
      { id: 'flWork1', type: PHOTO_CARD_COMPONENT, label: 'the first piece of work', parameters: { picture: photo('work-leather-bench.webp'), alt: 'A leather workbench with tools laid out', title: 'A piece of work', line: 'Who it was for, and what changed.' } },
      { id: 'flWork2', type: PHOTO_CARD_COMPONENT, label: 'the second piece of work', parameters: { picture: photo('food-bakery.webp'), alt: 'A bakery counter', title: 'Another piece of work', line: 'Who it was for, and what changed.' } },
      { id: 'flWork3', type: PHOTO_CARD_COMPONENT, label: 'the third piece of work', parameters: { picture: photo('people-desk.webp'), alt: 'Someone working at a laptop by a window', title: 'A third piece of work', line: 'Who it was for, and what changed.' } }
    ]),
    // About — a photograph beside a short story, two-up, one column on a phone.
    group('flAbout', 'About', 'flMain', BAND, ['flAboutShell']),
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
    ...section('flQuotes', 'flMain', 'surface', { eyebrow: 'Kind words', heading: 'What clients say', editHeading: false }, ['flQuotesGrid']),
    ...grid('flQuotesGrid', 'flQuotesShell', [
      { id: 'flQuote1', type: QUOTE_COMPONENT, label: 'the first client’s words', parameters: { quote: '“A sentence or two a client actually said about working with you. Ask them; most people are glad to.”', name: 'Their name', role: 'What they do, and where', portrait: photo('avatar-4.webp'), alt: 'A man smiling, arms folded' } },
      { id: 'flQuote2', type: QUOTE_COMPONENT, label: 'the second client’s words', parameters: { quote: '“Another client, in their own words. Two quotes is plenty; three is a wall.”', name: 'Their name', role: 'What they do, and where', portrait: photo('avatar-5.webp'), alt: 'A woman smiling outdoors' } }
    ], 440)
  ],
  connections: [...FREELANCER_FRAME.connections, ...heroWires('fl')]
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
      { id: 'bzOffer1', type: PHOTO_CARD_COMPONENT, label: 'the first thing you sell', parameters: { picture: photo('food-bread.webp'), alt: 'Sourdough loaves', title: 'The first thing', line: 'One line on it: what it is, when it is ready, what it costs.' } },
      { id: 'bzOffer2', type: PHOTO_CARD_COMPONENT, label: 'the second thing you sell', parameters: { picture: photo('food-plate.webp'), alt: 'A plated dish', title: 'The second thing', line: 'One line on it: what it is, when it is ready, what it costs.' } },
      { id: 'bzOffer3', type: PHOTO_CARD_COMPONENT, label: 'the third thing you sell', parameters: { picture: photo('texture-coffee.webp'), alt: 'Roasted coffee beans', title: 'The third thing', line: 'One line on it: what it is, when it is ready, what it costs.' } }
    ]),
    ...section('bzWhy', 'bzMain', 'surface', { eyebrow: 'Why here', heading: 'Three reasons this is the place' }, ['bzWhyGrid']),
    ...grid('bzWhyGrid', 'bzWhyShell', [
      { id: 'bzWhy1', type: FEATURE_COMPONENT, label: 'the first reason', parameters: { icon: 'leaf', title: 'The first reason', line: 'Where things come from, who makes them, what you refuse to do.' } },
      { id: 'bzWhy2', type: FEATURE_COMPONENT, label: 'the second reason', parameters: { icon: 'heart', title: 'The second reason', line: 'The people. Say who is behind the counter and how long they have been.' } },
      { id: 'bzWhy3', type: FEATURE_COMPONENT, label: 'the third reason', parameters: { icon: 'truck', title: 'The third reason', line: 'Something practical: delivery, parking, a room for a party.' } }
    ]),
    // Where and when — the address and the hours beside a photograph of the street.
    group('bzVisit', 'Visit', 'bzMain', BAND, ['bzVisitShell']),
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
    ...section('bzQuotes', 'bzMain', 'surface', { eyebrow: 'Kind words', heading: 'What regulars say', editHeading: false }, ['bzQuotesGrid']),
    ...grid('bzQuotesGrid', 'bzQuotesShell', [
      { id: 'bzQuote1', type: QUOTE_COMPONENT, label: 'the first regular’s words', parameters: { quote: '“A sentence or two a customer actually said. Pull it from a review if you have one.”', name: 'Their name', role: 'A regular since whenever', portrait: photo('avatar-3.webp'), alt: 'A woman smiling in a hooded coat' } },
      { id: 'bzQuote2', type: QUOTE_COMPONENT, label: 'the second regular’s words', parameters: { quote: '“Another one. Real words beat polished ones; leave the typos in if you like.”', name: 'Their name', role: 'A regular since whenever', portrait: photo('avatar-1.webp'), alt: 'A young man laughing' } }
    ], 440)
  ],
  connections: [...BUSINESS_FRAME.connections, ...heroWires('bz')]
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
    ...section('lnPricing', 'lnMain', 'paper', { eyebrow: 'The price', heading: 'Say the number' }, ['lnPlans']),
    { id: 'lnPlans', type: COLUMNS_NODE, label: 'Two plans', parent: 'lnPricingShell', parameters: { ...composition('columnsTwoUp'), marginX: px(24), marginY: px(24) }, children: ['lnPlanFreeCell', 'lnPlanPaidCell'] },
    group('lnPlanFreeCell', 'The free plan — its cell', 'lnPlans', { width: pct(100), sizeMode: 'contentHeight', flexDirection: 'column' }, ['lnPlanFree']),
    place('lnPlanFree', PLAN_COMPONENT, `${EDIT}the first plan`, 'lnPlanFreeCell', {
      name: 'While it is in beta',
      price: 'Free',
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
      price: 'The number goes here',
      line: 'Per month, or per year, or per seat — say which.',
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
    { fromId: 'lnCtaButton', fromProperty: 'onClick', toId: 'lnGround', toProperty: 'scrollToElement.do' },
    // Both plans lead to the form: the price is a reason to sign up, not a checkout.
    { fromId: 'lnPlanFree', fromProperty: 'chosen', toId: 'lnGround', toProperty: 'scrollToElement.do' },
    { fromId: 'lnPlanPaid', fromProperty: 'chosen', toId: 'lnGround', toProperty: 'scrollToElement.do' }
  ]
};

// ── Author order ─────────────────────────────────────────────────────────────

/** The parts a page places, before the pages that place them. */
export const TPL003_PARTS: Tpl003Component[] = [SWITCHER, HEADER, FOOTER, FEATURE, STEP, STAT, PHOTO_CARD, QUOTE, FAQ_ROW, HOURS_ROW, FIELD_PART, CONTACT, CHECK, MOCK_ROW, MOCK, BIG_STAT, PLAN];

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
