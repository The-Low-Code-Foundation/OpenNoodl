/**
 * DSG-005 — the arrangements half of the style vocabulary.
 *
 * ## Why this file exists
 *
 * `get_style_vocabulary` handed an agent tokens and per-element variants:
 * `--space-6` and `Button/primary/lg`. Every one of those is an **atom**. The
 * design doctrine's §6 then says, in Richard's words:
 *
 * > "Before authoring, fix a handful of named parameter sets and reuse them
 * > verbatim: a `card`, a `shell`, a `sectionHead`, one `primaryButton`, one
 * > `outlineButton`, and a type ramp."
 *
 * Nothing supplied those sets. The agent was told to fix them and left to invent
 * them, which is how a page ends up with cards that disagree about their own
 * radius. This module is the supply.
 *
 * ## Where the values come from — and where they do NOT
 *
 * **Not from taste.** Every parameter below is copied out of a shipped recipe in
 * `docs/node-catalog/examples/`, which is gated by `npm run catalog:examples`
 * (error- AND warning-free), and each of those recipes was in turn lifted from
 * the measured DOM of the `ecommerce-example` reference build (DSG-001). The
 * `recipe` field on each composition names the file the values were taken from,
 * so any of them can be diffed against its source. The only edit made in transit
 * is that **content-bearing parameters are dropped** — `text`, `label`, `src`,
 * `alt`, `iconIconSource` — because a parameter set is not a copy of the words.
 *
 * A composition that could not be grounded that way was left out rather than
 * invented; DSG-005's notes record which, and why.
 *
 * ## The pointer, not the graph
 *
 * `recipe` is an **id**, never an inlined graph. The recipes are already
 * fetchable (`get_example`) and already gated; a second copy here would drift,
 * and drift in the corpus an agent imitates is phase 55's F23 all over again.
 * `styleVocabularyPorts.test.ts` checks that every id still names a file.
 *
 * ## Two traps this file is built around
 *
 * 1. **A parameter with no matching port is dropped at apply with only a
 *    warning, which never blocks.** `boxShadow`, the `padding` shorthand and
 *    `fontWeight` all got taught here before a port existed for them. Every
 *    property below is checked against the enriched catalog by a spec, not by a
 *    reviewer.
 * 2. **A dimension is `{ value, unit }`, never `"1200px"`.** `defineRegularInputProp`
 *    reads `value.value`, so a `"1200px"` string is silently dropped (AIB-001,
 *    measured across ~4,000 real parameter values). That is why the value type
 *    here is a union and not `string` — the doctrine's own `maxWidth` cannot be
 *    expressed as one.
 *
 * PURE by construction: this module imports nothing, which is what lets
 * `noodl-mcp/src/editor-deps.ts` re-export it inside the esbuild bundle.
 *
 * @module models/StyleTokensModel/StyleCompositions
 */

/**
 * A parameter value as the runtime actually stores it.
 *
 * Deliberately NOT `string`. `variantStyles` gets away with `Record<string,
 * string>` because every value it carries is a `var(--token)` reference; a
 * composition has to carry `maxWidth`, `minWidth` and breakpoints, and those are
 * `{ value, unit }` objects — the AIB-001 corpus proved that a `"1200px"` string
 * is read as `value.value === undefined` and dropped.
 */
export type VocabParamValue = string | number | boolean | { value: number; unit: string };

/** What part of a page a composition belongs to — only used to group the listing. */
export type VocabCompositionGroup = 'spine' | 'surface' | 'control' | 'media' | 'arrangement' | 'type';

/** One named parameter set, and the recipe that shows it assembled. */
export interface VocabComposition {
  /** The name to fix once and reuse verbatim, e.g. "card". */
  id: string;
  /** The node type these parameters belong on. Every property is a port of it. */
  nodeType: string;
  group: VocabCompositionGroup;
  /** One line: what it is, and the trap it avoids. */
  description: string;
  /** Copy these onto the node as-is. Colours/spacing are `var(--token)` references. */
  parameters: Record<string, VocabParamValue>;
  /** The `ui-*` example id that shows this assembled. Fetch it with `get_example`. */
  recipe: string;
}

const GROUP: { value: number; unit: string } = { value: 100, unit: '%' };

/**
 * The named parameter sets, in the order a page is built: spine, then the
 * surfaces inside it, then controls, media, arrangement, and the type ramp.
 */
export const STYLE_COMPOSITIONS: VocabComposition[] = [
  // ─── The spine (doctrine §1) ───────────────────────────────────────────────
  {
    id: 'band',
    nodeType: 'Group',
    group: 'spine',
    description:
      'A full-width section on the page background. Centres its shell; sections alternate band and bandSurface.',
    parameters: {
      width: GROUP,
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 'var(--space-20)',
      paddingBottom: 'var(--space-20)'
    },
    recipe: 'ui-page-shell-bands'
  },
  {
    id: 'bandSurface',
    nodeType: 'Group',
    group: 'spine',
    description:
      'The alternate band: raised surface with hairlines top and bottom, so the page reads as parts, not a scroll.',
    parameters: {
      width: GROUP,
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: 'var(--surface)',
      borderTopStyle: 'solid',
      borderTopWidth: 'var(--border-1)',
      borderTopColor: 'var(--border)',
      borderBottomStyle: 'solid',
      borderBottomWidth: 'var(--border-1)',
      borderBottomColor: 'var(--border)',
      paddingTop: 'var(--space-20)',
      paddingBottom: 'var(--space-20)'
    },
    recipe: 'ui-page-shell-bands'
  },
  {
    id: 'shell',
    nodeType: 'Group',
    group: 'spine',
    description:
      'The one centred container inside a band. Content that touches the viewport edge is the loudest sign nobody designed the page.',
    parameters: {
      width: GROUP,
      maxWidth: { value: 1200, unit: 'px' },
      flexDirection: 'column',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    recipe: 'ui-page-shell-bands'
  },
  {
    id: 'sectionHead',
    nodeType: 'Group',
    group: 'spine',
    description: 'Wrapper for eyebrow + sectionHeading + lead, with the air before the content built in.',
    parameters: {
      width: GROUP,
      flexDirection: 'column',
      rowGap: 'var(--space-3)',
      paddingBottom: 'var(--space-10)'
    },
    recipe: 'ui-page-shell-bands'
  },

  // ─── Surfaces ──────────────────────────────────────────────────────────────
  {
    id: 'card',
    nodeType: 'Group',
    group: 'surface',
    description:
      'The card shell. width 100% lets the column size it, so the same card works in a grid, a 2-up row and a sidebar.',
    parameters: {
      width: GROUP,
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-xl)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      clip: true,
      flexDirection: 'column'
    },
    recipe: 'ui-card-grid-repeater'
  },
  {
    id: 'cardBody',
    nodeType: 'Group',
    group: 'surface',
    description:
      'The padded half of a card, below the media. Gap ports between siblings, never margins on the children.',
    parameters: {
      width: GROUP,
      flexDirection: 'column',
      rowGap: 'var(--space-2)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)',
      paddingTop: 'var(--space-5)',
      paddingBottom: 'var(--space-5)'
    },
    recipe: 'ui-card-grid-repeater'
  },

  // ─── Controls (doctrine §6, and §4's two contrast rules) ───────────────────
  {
    id: 'primaryButton',
    nodeType: 'net.noodl.controls.button',
    group: 'control',
    description:
      'The one filled action. `variant` is connection-only, so these concrete parameters are the way to get it.',
    parameters: {
      backgroundColor: 'var(--primary)',
      color: 'var(--primary-foreground)',
      borderRadius: 'var(--radius-full)',
      borderWidth: { value: 0, unit: 'px' },
      borderStyle: 'none',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-semibold)',
      sizeMode: 'contentSize'
    },
    recipe: 'ui-split-hero'
  },
  {
    id: 'outlineButton',
    nodeType: 'net.noodl.controls.button',
    group: 'control',
    description:
      'The secondary action. A control border needs 3:1 and no --border* token reaches it (best 1.48:1), so this uses --muted-foreground (4.76:1).',
    parameters: {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderRadius: 'var(--radius-full)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      // ⚠️ DEVIATION from `ui-split-hero`, which writes `var(--border-control)`.
      // THAT TOKEN DOES NOT EXIST — it is named in the design doctrine (§4) and
      // in this one recipe, and in neither DefaultTokens.ts nor any preset. An
      // undefined custom property makes `border-color` invalid, so the border
      // falls back to `currentColor`: precisely the "a control at 1.00:1"
      // failure §4 exists to prevent, shipped by the sentence preventing it.
      //
      // Measured against `--background` (#ffffff): --border 1.23:1,
      // --border-subtle 1.10:1, --border-strong 1.48:1. No border token in the
      // default set reaches the doctrine's 3:1. `--muted-foreground` (#64748b)
      // is 4.76:1 and is real, so it is what a 3:1 control border can be TODAY.
      // If a `--border-control` token is ever added, this is the line to change.
      borderColor: 'var(--muted-foreground)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-semibold)',
      sizeMode: 'contentSize'
    },
    recipe: 'ui-split-hero'
  },

  // ─── Media (doctrine §5, and the sizeMode gate of §8) ─────────────────────
  {
    id: 'cardImage',
    nodeType: 'Image',
    group: 'media',
    description:
      'A photo with a real box. Without sizeMode "explicit", width/height/objectFit are all inert. Put it in a clip:true parent.',
    parameters: {
      sizeMode: 'explicit',
      objectFit: 'cover',
      width: GROUP,
      height: { value: 300, unit: 'px' }
    },
    recipe: 'ui-card-grid-repeater'
  },

  // ─── Arrangement (doctrine §7 — Columns is the only thing that reflows) ────
  {
    id: 'gridAutoFit',
    nodeType: 'net.noodl.visual.columns',
    group: 'arrangement',
    description:
      'A grid of unknown length. Fits as many columns as the CONTAINER holds and reflows itself — no breakpoints to maintain.',
    parameters: {
      sizing: 'autoFit',
      minWidth: { value: 280, unit: 'px' },
      marginX: { value: 12, unit: 'px' }
    },
    recipe: 'ui-card-grid-repeater'
  },
  {
    id: 'columnsTwoUp',
    nodeType: 'net.noodl.visual.columns',
    group: 'arrangement',
    description:
      'A fixed 2-up that collapses to one column. A Group row cannot: no Group in the runtime has a breakpoint.',
    parameters: {
      layoutString: '1 1',
      marginX: { value: 48, unit: 'px' },
      mediumBreakpoint: { value: 900, unit: 'px' },
      mediumLayout: '1',
      smallBreakpoint: { value: 640, unit: 'px' },
      smallLayout: '1'
    },
    recipe: 'ui-split-hero'
  },

  // ─── The type ramp (doctrine §3) ──────────────────────────────────────────
  {
    id: 'displayHeadline',
    nodeType: 'Text',
    group: 'type',
    description:
      'Exactly ONE per page. fontSize does not scale — pick --text-4xl/--text-5xl instead if the page must work at 390px.',
    parameters: {
      fontSize: 'var(--text-6xl)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-none)',
      letterSpacing: 'var(--tracking-tighter)',
      color: 'var(--foreground)'
    },
    recipe: 'ui-split-hero'
  },
  {
    id: 'sectionHeading',
    nodeType: 'Text',
    group: 'type',
    description:
      'The heading of a section head. Tight tracking is what makes a large heading look set rather than typed.',
    parameters: {
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: 'var(--tracking-tight)',
      color: 'var(--foreground)'
    },
    recipe: 'ui-page-shell-bands'
  },
  {
    id: 'cardTitle',
    nodeType: 'Text',
    group: 'type',
    description: 'The title inside a card or tile.',
    parameters: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--foreground)'
    },
    recipe: 'ui-card-grid-repeater'
  },
  {
    id: 'eyebrow',
    nodeType: 'Text',
    group: 'type',
    description:
      'The small uppercase line that announces a section. One of the at-most-three things the accent is spent on.',
    parameters: {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-semibold)',
      letterSpacing: 'var(--tracking-widest)',
      textTransform: 'uppercase',
      color: 'var(--primary)'
    },
    recipe: 'ui-page-shell-bands'
  },
  {
    id: 'lead',
    nodeType: 'Text',
    group: 'type',
    description:
      'One sub-line under a heading, capped so it wraps at a readable measure rather than the full shell width.',
    parameters: {
      fontSize: 'var(--text-lg)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--muted-foreground)',
      maxWidth: { value: 560, unit: 'px' }
    },
    recipe: 'ui-page-shell-bands'
  },
  {
    id: 'body',
    nodeType: 'Text',
    group: 'type',
    description: 'Ordinary running text. Never set fontFamily — the project body already carries var(--font-sans).',
    parameters: {
      fontSize: 'var(--text-base)',
      color: 'var(--foreground)'
    },
    recipe: 'ui-page-shell-bands'
  },
  {
    id: 'meta',
    nodeType: 'Text',
    group: 'type',
    description: 'Secondary text: a tagline, a delta, a caption.',
    parameters: {
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)'
    },
    recipe: 'ui-card-grid-repeater'
  }
];

/** Render one parameter value the way it must be written into `parameters`. */
export function formatCompositionValue(value: VocabParamValue): string {
  if (typeof value === 'object' && value !== null) {
    // Printed as JSON on purpose. `"1200px"` is silently dropped by the runtime,
    // so an abbreviation here would teach the one form that does not work.
    return `{"value":${value.value},"unit":"${value.unit}"}`;
  }
  return String(value);
}
