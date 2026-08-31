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
      'A full-width section on the page background. It is HALF a section: a band always holds exactly one shell, ' +
      'and a band whose content is not inside one runs edge to edge. Sections alternate band and bandSurface.',
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
    // 🔴 P78 D26 / phase-80 DEF-010 C1. Until this pair, **two** of eighteen
    // compositions carried a content fill and **both were `var(--surface)`** —
    // so there was exactly one way to make something look like a distinct
    // object, and nine kinds of thing on the members-area template wore it.
    // Richard, on the finished landing page: *"It's definitely got that standard
    // bootstrap feel about it."* That is the cause, and it is in the kit rather
    // than in any template.
    //
    // 🔴 **`--surface-raised` was already in the token set and read by nothing.**
    // The second surface never needed designing — it needed a reader. This is it.
    //
    // ⚠️ **It only reads as raised on a `--surface` ground.** `--surface-raised`
    // is `#ffffff` and so is `--background`, so this on the page background is
    // invisible. The recipe uses it exactly that way: a header row inside a
    // `--surface` table. The description says so, because a composition that
    // disappears where an author first tries it is worse than none.
    id: 'raised',
    nodeType: 'Group',
    group: 'surface',
    description:
      'A band that sits above the surface it is on — a table header, a toolbar, the head of a list. Only reads as raised on a var(--surface) ground, never on the page background.',
    parameters: {
      width: GROUP,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'var(--surface-raised)',
      borderBottomStyle: 'solid',
      borderBottomWidth: 'var(--border-1)',
      borderBottomColor: 'var(--border)',
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)'
    },
    recipe: 'ui-data-table'
  },
  {
    // 🔴 The other half of D26, and the one that stops a list looking like a
    // stack of cards: a row separated by a **hairline** rather than boxed.
    //
    // ⚠️ **No `backgroundColor` at all** — that is the whole point and it is
    // lifted, not chosen. A ruled row inherits the surface it sits on, so ten of
    // them read as one object with divisions rather than ten objects. Giving it
    // a fill would make it another flavour of `card`, which is precisely what
    // phase 78 asked us not to add.
    //
    // ⚠️ `--border-subtle`, not `--border`. Also lifted: the recipe rules
    // *between* rows more quietly than it rules the header off from them, and
    // that difference is what keeps a long list from reading as a grid.
    id: 'ruled',
    nodeType: 'Group',
    group: 'surface',
    description:
      'One row in a list, separated from the next by a hairline instead of being boxed. Carries no fill on purpose — it inherits the surface it sits on.',
    parameters: {
      width: GROUP,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomStyle: 'solid',
      borderBottomWidth: 'var(--border-1)',
      borderBottomColor: 'var(--border-subtle)',
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)'
    },
    recipe: 'ui-data-table'
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

  {
    // 🔴 P78 D20 / phase-80 DEF-006 §0(c). Until this composition the vocabulary
    // named **page furniture only** — band, shell, card, a type ramp — and an
    // agent building the empty half of any list had no recipe to follow, so it
    // invented one. That invention is the divergence (a) and (b) punish it for
    // on the parts that ARE covered.
    //
    // ⚠️ **`dashed`, and `--border-strong` rather than `--border`.** Both lifted,
    // neither chosen: a dashed edge is what distinguishes "nothing here yet"
    // from a card that failed to load, and the heavier border is what keeps the
    // dash visible at 1px. A solid `--border` here reads as an empty card.
    id: 'emptyState',
    nodeType: 'Group',
    group: 'surface',
    description:
      'The empty half of a list: a dashed, centred panel saying there is nothing here yet. Dashed on purpose — a solid edge reads as a card that failed to load.',
    parameters: {
      width: GROUP,
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'var(--space-4)',
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-xl)',
      borderStyle: 'dashed',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-strong)',
      paddingTop: 'var(--space-16)',
      paddingBottom: 'var(--space-16)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    recipe: 'ui-empty-state'
  },

  // ─── The marketing kit (VIB-004, register V6/V12/V27/V29) ─────────────────
  //
  // 🔴 **The recipes for most of these already shipped and none of them was a
  // named set.** Measured at the door before writing anything: of the seven
  // arrangements V6 asked for, five already had a gated recipe in
  // `docs/node-catalog/examples/` — hero (`ui-split-hero`, `ui-gradient-hero`),
  // featureItem (`ui-icon-feature-strip`), statTile (`ui-stat-tile-row`), footer
  // (`ui-footer-columns`), and the grounds above. What was missing was never the
  // ability to build a marketing section; it was that `get_style_vocabulary`
  // named `card`, `shell` and `field` and stopped, so an agent reading the
  // vocabulary had no evidence that a stat tile or a feature item was a thing
  // this system has an opinion about. Two arrangements genuinely had no recipe
  // and were written for this task: `ui-cta-band` and `ui-testimonial-row`.
  //
  // 🔴 **V29, ruled by Richard 2026-08-31, is built into `ctaBand` and it is the
  // one rule here that is not a preference**: *"the wider you go … white space to
  // the left and right **equally** … not just on one side, that's weird … the
  // structural page divs have a max width and are centred."* So a measure belongs
  // to the SHELL, which a band centres, and never to the text inside it. A
  // headline carrying its own `maxWidth` inside a full-width band is left-anchored
  // by construction: at 1900 the `ui-image-scrim-band` recipe measured 374px of
  // space on the left and 766px on the right, and that asymmetry is a defect
  // rather than negative space.
  //
  // ⚠️ **The `--shadow-*` tokens cannot be used by any of these.** `Group` exposes
  // `boxShadowOffsetY`/`BlurRadius`/`Color` as separate ports and no port anywhere
  // in the catalog takes a whole box-shadow string, so the seven shipped shadow
  // tokens are unreachable through the sanctioned door — recorded as **V31**.
  // `testimonialCard` therefore composes its shadow from parts and colours it with
  // `var(--border)`, which is the only on-system way to get depth today.
  {
    id: 'ctaBand',
    nodeType: 'Group',
    group: 'spine',
    description:
      'The closing call-to-action band: a gradient ground so the page ends on a different surface, and a measure that is CENTRED rather than left-anchored. Put a shell with maxWidth 720 and alignItems center inside it, and set textAlignX center on the type — never a maxWidth on the headline, which strands the white space on one side. Light text only.',
    parameters: {
      width: GROUP,
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundGradient: 'var(--gradient-brand)',
      paddingTop: 'var(--space-24)',
      paddingBottom: 'var(--space-24)'
    },
    recipe: 'ui-cta-band'
  },
  {
    id: 'footerBand',
    nodeType: 'Group',
    group: 'spine',
    description:
      'The band a page ends in: a muted ground with a hairline above it, and deliberately asymmetric padding — more air above the links than below the copyright line. A page whose last section is the same ground as its first has no ending.',
    parameters: {
      width: GROUP,
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: 'var(--muted)',
      borderTopStyle: 'solid',
      borderTopWidth: 'var(--border-1)',
      borderTopColor: 'var(--border)',
      paddingTop: 'var(--space-16)',
      paddingBottom: 'var(--space-10)'
    },
    recipe: 'ui-footer-columns'
  },
  {
    id: 'statTile',
    nodeType: 'Group',
    group: 'surface',
    description:
      'A tile whose only large thing is the number. Pair with the type ramp: an uppercase --text-xs label in --muted-foreground, one --text-3xl value, a --text-sm delta. A tile whose label competes with its number reads as a form, not a dashboard.',
    parameters: {
      width: GROUP,
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-xl)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      clip: true,
      flexDirection: 'column',
      rowGap: 'var(--space-2)',
      paddingTop: 'var(--space-5)',
      paddingBottom: 'var(--space-5)',
      paddingLeft: 'var(--space-5)',
      paddingRight: 'var(--space-5)'
    },
    recipe: 'ui-stat-tile-row'
  },
  {
    // 🔴 The shadow is what makes this a designed OBJECT rather than a paragraph
    // with a border, and it is the tell Richard named on the VIB-003 page:
    // *"nothing on the page is a designed object."* `card` above has a border and
    // no depth; this is the same surface lifted off the band.
    id: 'testimonialCard',
    nodeType: 'Group',
    group: 'surface',
    description:
      'A quote card that sits ABOVE its band rather than in it — the card surface plus a composed shadow, because no port takes a --shadow-* token. Hold the quote, then a ruled author row with a portrait, a name and a role.',
    parameters: {
      width: GROUP,
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      rowGap: 'var(--space-5)',
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-xl)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      boxShadowEnabled: true,
      boxShadowOffsetY: { value: 1, unit: 'px' },
      boxShadowBlurRadius: { value: 3, unit: 'px' },
      boxShadowColor: 'var(--border)',
      paddingTop: 'var(--space-6)',
      paddingBottom: 'var(--space-6)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)'
    },
    recipe: 'ui-testimonial-row'
  },
  {
    // 🔴 Register **V27**, in one parameter set. Richard, on the VIB-003 page:
    // *"still some spacing problems in the cards, for example between the circle
    // and the start of the card text … spacing and padding seems to be a weak
    // point with the MCP."* The sweep behind that sentence found **58** row and
    // column Groups in the shipped corpus with two or more children and no gap of
    // any kind. A row of an icon and some words is the shape it happens to most,
    // so the gap is in the named set rather than left to be re-decided.
    id: 'badge',
    nodeType: 'Group',
    group: 'surface',
    description:
      'A pill: the smallest designed object a page can carry, and the cheapest way to stop a hero reading as a bare heading. contentSize so it hugs its words, radius-full, and a columnGap so a glyph beside a label is not touching it. Over a gradient ground use it as written; on the page background swap the fill to var(--surface) and the border to var(--border).',
    parameters: {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'var(--space-2)',
      backgroundColor: 'var(--surface-glass)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-glass)',
      borderRadius: 'var(--radius-full)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)',
      paddingTop: 'var(--space-2)',
      paddingBottom: 'var(--space-2)'
    },
    recipe: 'ui-cta-band'
  },

  // ─── Grounds (VIB-002, register V5/V13) ────────────────────────────────────
  //
  // 🔴 Why these are `spine` and not `surface`: they are what a BAND is made of.
  // The phase-81 baseline's single most repeated sentence about both shipped
  // templates was *one background colour end to end*, and the reason was not
  // taste — `get_node_type('Group')` answered `notFound` to `backgroundImage`,
  // so there was no ground to reach for. `band` and `bandSurface` above are the
  // only two grounds the vocabulary had, and both are flat fills.
  //
  // ⚠️ Every one of these puts light text on a dark ground, so pair them with
  // `color: var(--primary-foreground)` on the type — the ramp compositions below
  // all specify `--foreground`, which is ink on ink here.
  {
    id: 'heroGround',
    nodeType: 'Group',
    group: 'spine',
    description:
      'The band a landing page opens with: a gradient ground instead of a flat fill. Light text only — pair with var(--primary-foreground). Swap the token for var(--gradient-brand) or var(--gradient-deep) to change the mood without touching the layout.',
    parameters: {
      width: GROUP,
      flexDirection: 'column',
      alignItems: 'center',
      backgroundGradient: 'var(--gradient-spotlight)',
      paddingTop: 'var(--space-24)',
      paddingBottom: 'var(--space-24)'
    },
    recipe: 'ui-gradient-hero'
  },
  {
    // The two background ports compose into one `background-image`, gradient
    // first — so the scrim paints OVER the picture. That ordering is the whole
    // composition: it is what makes a headline readable on a photograph nobody
    // has seen yet.
    //
    // ⚠️ `sizeMode: explicit` + `height` are load-bearing, not decoration. A band
    // whose only child is a heading collapses to the heading's height and the
    // picture becomes a stripe.
    //
    // 🔴 **And the `shell` you put inside it needs `sizeMode: 'contentHeight'`.**
    // Measured, not predicted: the first render of `ui-image-scrim-band` put its
    // copy at the TOP of the band with 250px of empty photograph below it, and
    // `justifyContent: 'flex-end'` was set correctly the whole time. The default
    // `shell` above carries no `sizeMode`, so it is the runtime's 100%×100%,
    // becomes `flexGrow:100` in a column and fills the band — leaving
    // `justifyContent` nothing to justify. That is register **V1** biting a
    // brand-new, gate-clean recipe written by a session that had just read the
    // diagnosis of it. VIB-005 owns the door diagnostic; this comment is the
    // stopgap.
    id: 'imageGround',
    nodeType: 'Group',
    group: 'spine',
    description:
      'A photograph as a section ground with a scrim over it, so text stays readable whatever the picture is. Set backgroundImage to a project asset; the gradient is drawn on top of it. backgroundColor is the fallback ground while the image loads or if it is empty.',
    parameters: {
      width: GROUP,
      sizeMode: 'explicit',
      height: { value: 520, unit: 'px' },
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      backgroundGradient: 'var(--gradient-scrim)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: 'var(--foreground)',
      paddingBottom: 'var(--space-12)'
    },
    recipe: 'ui-image-scrim-band'
  },
  {
    // 🔴 The one way to express translucency here. `opacity` on a Group fades its
    // own children, so a see-through panel has to come from an alpha FILL — and
    // an alpha fill written inline (`rgb(255 255 255 / 0.12)`) draws
    // `raw-color-literal`. Hence `--surface-glass`: the capability existed in the
    // engine the whole time and was unreachable through the sanctioned door.
    id: 'glassPanel',
    nodeType: 'Group',
    group: 'surface',
    description:
      'A translucent, frosted panel for sitting ON a gradient or image ground — a stat strip, a quote, a signup card over a hero. Only reads on a dark ground; on the page background it is invisible.',
    parameters: {
      width: GROUP,
      flexDirection: 'row',
      backgroundColor: 'var(--surface-glass)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-glass)',
      borderRadius: 'var(--radius-2xl)',
      backdropBlur: { value: 14, unit: 'px' },
      columnGap: 'var(--space-10)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      paddingTop: 'var(--space-5)',
      paddingBottom: 'var(--space-5)'
    },
    recipe: 'ui-gradient-hero'
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
      // DEF-006 (a) — `borderStyle: 'none'` is the whole instruction, and
      // `borderWidth: 0` used to sit beside it. `borderWidth` is declared
      // `borderStyle = solid OR dashed OR dotted`, so this composition switched
      // the port off with one parameter and then set it with the next: applying
      // it verbatim earned an `inactive-conditional-parameter` warning per
      // button, twelve on one generation run. An agent following the design
      // system exactly as instructed could only ignore a real diagnostic or
      // diverge from the system. Removed here **and** from `ui-split-hero`,
      // which is where the value was copied from — a composition that stops
      // matching its own recipe cannot be diffed against it, which is the one
      // property §"Where the values come from" claims.
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
      'The secondary action. A control border needs 3:1, which is what --border-control is for; --border is decoration and only reaches 1.23:1.',
    parameters: {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderRadius: 'var(--radius-full)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      // DEF-001: this is the line the previous comment said to change, and the
      // condition it named has been met. That comment recorded — correctly, at
      // the time — that `--border-control` did NOT exist, that `ui-split-hero`
      // wrote it anyway, and that an undefined custom property makes
      // `border-color` invalid so the border falls back to `currentColor`. The
      // stand-in was `--muted-foreground` (4.76:1), which passed but meant a
      // control border and a muted paragraph were the same token.
      //
      // The token now ships in `DefaultTokens.ts` (#7c8894) and in all four
      // presets that override, and it clears 3:1 in every one of them (3.62 to
      // 4.83 against `--background`). So the recipe, the element configs and
      // this composition finally say the same thing, and
      // `tests-unit/def-001/design-token-contrast.test.ts` fails if they stop.
      borderColor: 'var(--border-control)',
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
    // 🔴 P78 D20 / phase-80 DEF-006 §0(c). **No composition had ever named a
    // control that takes typing** — the biggest single hole in the vocabulary,
    // in a system whose users are building forms.
    //
    // 🔴 **`sizeMode: 'contentHeight'` is the whole composition.** The node ships
    // `sizeMode: 'contentSize'`, and in that mode the `width` port is INERT:
    // measured inside a 592px card, a field left at the default renders **196px
    // wide at 1280px AND at 390px**, never once responding to its container.
    // Same field at `contentHeight` measures 526px on desktop and 276px on
    // phone. `explicit` frees the width too but takes the height port with it,
    // so a field that should grow with its own padding and font wants
    // `contentHeight`. An agent copying width:100% without the sizeMode gets a
    // field that silently ignores it.
    //
    // ⚠️ `--border-control`, not `--border`: the control-boundary token exists
    // because `--border` does not clear WCAG 1.4.11's 3:1 (DEF-001).
    id: 'textField',
    nodeType: 'net.noodl.controls.textinput',
    group: 'control',
    description:
      'A text field that fills its column. sizeMode contentHeight is required — at the shipped contentSize the width port is inert and the field renders 196px at every viewport.',
    parameters: {
      sizeMode: 'contentHeight',
      width: GROUP,
      type: 'text',
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)',
      fontSize: 'var(--text-base)',
      borderStyle: 'solid',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-control)',
      borderRadius: 'var(--radius-md)',
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)',
      paddingLeft: 'var(--space-3)',
      paddingRight: 'var(--space-3)'
    },
    recipe: 'ui-form-field'
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
    // 🔴 The other half of **V27**. `featureItem` and `actionRow` are the two
    // multi-child rows a marketing page is built out of, and both carry an
    // explicit gap for the same reason: the corpus sweep found 58 row/column
    // Groups with 2+ children and no gap, and a glyph touching its own label is
    // what that looks like on screen. A gap is not a judgement call on a row of
    // an icon and some words — it is the only correct value.
    id: 'featureItem',
    nodeType: 'Group',
    group: 'arrangement',
    description:
      'One item of a feature or trust strip: a glyph, then a column of title and body, with the gap between them set rather than left at zero. alignItems flex-start keeps the glyph on the first line of the title instead of centring it against a two-line paragraph.',
    parameters: {
      width: GROUP,
      flexDirection: 'row',
      columnGap: 'var(--space-3)',
      alignItems: 'flex-start'
    },
    recipe: 'ui-icon-feature-strip'
  },
  {
    // ⚠️ `flexWrap` is what stops this being a 988px-viewport defect: two
    // contentSize buttons in a row with no wrap push the second one off the
    // measure at the editor preview's own default width.
    id: 'actionRow',
    nodeType: 'Group',
    group: 'arrangement',
    description:
      'The button pair under a headline. contentSize so the row hugs the buttons, a columnGap so they are not touching, a rowGap and flexWrap so they stack instead of overflowing on a narrow viewport, and paddingTop for the air a primary action needs above it. Set justifyContent center inside a centred ctaBand; leave it out in a left-aligned hero.',
    parameters: {
      sizeMode: 'contentSize',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 'var(--space-3)',
      rowGap: 'var(--space-3)',
      paddingTop: 'var(--space-2)'
    },
    recipe: 'ui-cta-band'
  },
  {
    id: 'gridAutoFit',
    nodeType: 'net.noodl.visual.columns',
    group: 'arrangement',
    description:
      // DEF-018 (P78 D28): the second sentence is the product's cheapest honest fix — nothing in
      // either button recipe or this one said the three do not compose, and the overlap appears
      // at wide viewports, where auto-fit makes the columns narrow. The door's
      // `columns-child-keeps-own-width` is the mechanical half; this is the teaching half.
      'A grid of unknown length. Fits as many columns as the CONTAINER holds and reflows itself — no breakpoints to maintain. ' +
      'Children must take the column\'s width: sizeMode "contentHeight" with width 100%. A contentSize child (what both button recipes stamp) keeps its own width and draws across the next column.',
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

  {
    // 🔴 P78 D20 / phase-80 DEF-006 §0(c). The unit every form is made of, and
    // the reason the three type entries below it exist as a set.
    //
    // ⚠️ **The error line under this wants `mounted`, not `visible`.** `visible`
    // sets visibility:hidden and KEEPS the space — measured, a clean field is
    // 71px with `mounted` and 87px with `visible`, so every valid control in a
    // form carries 16px of dead row under it. That is wiring rather than a
    // parameter, which is why it is a comment here and a demonstration in the
    // recipe.
    id: 'field',
    nodeType: 'Group',
    group: 'arrangement',
    description:
      'One labelled form field: label, control, error and hint in a column. Pair with fieldLabel, textField, fieldError and fieldHint.',
    parameters: {
      width: GROUP,
      sizeMode: 'contentHeight',
      flexDirection: 'column',
      rowGap: 'var(--space-2)'
    },
    recipe: 'ui-form-field'
  },

  // ─── The type ramp (doctrine §3) ──────────────────────────────────────────
  {
    id: 'displayHeadline',
    nodeType: 'Text',
    group: 'type',
    description:
      'Exactly ONE per page. fontSize does not scale — pick --text-4xl/--text-5xl instead if the page must work at 390px.',
    parameters: {
      // VIB-002 / V13. Was `--text-6xl` — a fixed 60px, which the doctrine then
      // had to talk authors DOWN from ("pick the size that still works at 390px
      // — usually --text-4xl or --text-5xl"), capping every headline in the
      // product at 48px. `--display-lg` is a clamp(): 44px at 390 and 96px at
      // 1900, from this one parameter. The advice it replaces is deleted from
      // `prompts/design.ts` rather than left to contradict this.
      fontSize: 'var(--display-lg)',
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
    // 🔴 P78 D18 / phase-80 Track C2. This sentence used to end "Never set
    // fontFamily — the project body already carries var(--font-sans)", which is
    // true for Text and was false for every form control: `<button>`, `<input>`
    // and `<textarea>` do not inherit `font-family` from `body` in any browser.
    // It is what an agent reads *before deciding not to set a font*, so the CSS
    // repair alone would have been rewritten by the next generator that read it.
    // Scoped to Text now, which is the only node this composition applies to.
    description:
      'Ordinary running text. No need to set fontFamily on a Text node — the project body already carries var(--font-sans).',
    parameters: {
      fontSize: 'var(--text-base)',
      color: 'var(--foreground)'
    },
    recipe: 'ui-page-shell-bands'
  },
  {
    // 🔴 P78 D20 / phase-80 DEF-006 §0(c).
    id: 'fieldLabel',
    nodeType: 'Text',
    group: 'type',
    description: 'The label above a form control. Pairs with field, textField, fieldError and fieldHint.',
    parameters: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-medium)',
      color: 'var(--foreground)'
    },
    recipe: 'ui-form-field'
  },
  {
    // 🔴 P78 D20 / phase-80 DEF-006 §0(c), and **the one judgement in it.**
    //
    // 🔴 **`--red-700` is deliberate, and `--destructive` is the wrong token
    // here — measured, not reasoned.** The obvious objection is that a raw
    // palette token is one no preset moves, so a re-themed app keeps a brick-red
    // error line: true, and it is still the right trade. As 14px text this is
    // graded by WCAG 1.4.3's 4.5:1 against the `--surface` a form card sits on,
    // and across the six shipped palettes:
    //
    //   --red-700     6.03 – 6.20:1   passes in all six
    //   --destructive 4.38 – 6.18:1   FAILS in two — Playful 4.38, Soft 4.49
    //
    // `--destructive` is a FILL colour, sized for white text on top of it, and
    // Playful/Soft move it to rose `#e11d48`. Swapping to it would ship an error
    // message two of the five presets render illegibly.
    //
    // ⚠️ **The recipe's own note said 3.60:1 and that number is stale** — it was
    // measured on 2026-08-11 when `--destructive` was `#ef4444`; DEF-001 moved it
    // to `#dc2626` on 2026-08-29, which is 4.62:1 and passes. The conclusion
    // survived the change that invalidated its evidence. The numbers above are
    // at HEAD.
    //
    // 🔴 **What is actually missing is a semantic token for error TEXT** — one a
    // preset moves and that clears 4.5:1 as type. There is none; `--destructive`
    // is the only semantic red and it is a fill. Registered as its own row
    // rather than invented here, because adding a token means adding it to all
    // five presets and that is a design decision.
    id: 'fieldError',
    nodeType: 'Text',
    group: 'type',
    description:
      'The validation message under a form control. Uses --red-700, not --destructive: --destructive is a fill colour and fails 4.5:1 as text on --surface in two of the shipped presets.',
    parameters: {
      fontSize: 'var(--text-sm)',
      color: 'var(--red-700)',
      lineHeight: 'var(--leading-snug)'
    },
    recipe: 'ui-form-field'
  },
  {
    // 🔴 P78 D20 / phase-80 DEF-006 §0(c).
    id: 'fieldHint',
    nodeType: 'Text',
    group: 'type',
    description: 'The quiet helper line under a form control — format, limits, why you are being asked.',
    parameters: {
      fontSize: 'var(--text-xs)',
      color: 'var(--muted-foreground)',
      lineHeight: 'var(--leading-snug)'
    },
    recipe: 'ui-form-field'
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
