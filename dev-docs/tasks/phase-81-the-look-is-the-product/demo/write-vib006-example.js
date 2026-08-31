/**
 * VIB-006 — writes `docs/node-catalog/examples/ui-landing-page.json`.
 *
 * 🔴 **The output is CORPUS, not a demo.** Every other artefact this phase has rendered lives in
 * `demo/` and is reachable by nothing but a look file. This one ships in the example corpus, which
 * means `get_example('ui-landing-page')` returns it and `npm run catalog:examples` gates it — and
 * that is the whole point of the task. V8's predicate, re-derived over all 66 examples before a line
 * of this was written: **the most top-level bands on any `Page` node in the corpus is 2**, zero
 * examples have four, and zero have three bands with a picture and a glyph. A model imitating this
 * corpus has never seen a page.
 *
 * ## Why a generator rather than hand-written JSON
 *
 * Every parameter set below is copied out of `StyleCompositions.ts` **verbatim** and named after the
 * composition it is (`band`, `shell`, `imageGround`, `card`, `cardBody`, `statTile`, `badge`,
 * `actionRow`, `featureItem`, `testimonialCard`, `ctaBand`, `footerBand`, and the type ramp). Written
 * by hand, a 200-node page drifts from its own vocabulary by the third card — which is precisely the
 * failure `card`/`shell`/`sectionHead` exist to prevent. Here a composition is one constant, used N
 * times, and a diff against the source file is mechanical.
 *
 * ⚠️ The generated file is the artefact. Regenerate with:
 *   node dev-docs/tasks/phase-81-the-look-is-the-product/demo/write-vib006-example.js
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const OUT = path.join(REPO, 'docs/node-catalog/examples/ui-landing-page.json');
const IMG = 'noodl_modules/starter-imagery/';

// ── The compositions, verbatim from StyleCompositions.ts ─────────────────────
const PCT100 = { value: 100, unit: '%' };
const band = { width: PCT100, flexDirection: 'column', alignItems: 'center', paddingTop: 'var(--space-20)', paddingBottom: 'var(--space-20)' };
const bandSurface = {
  ...band,
  backgroundColor: 'var(--surface)',
  borderTopStyle: 'solid', borderTopWidth: 'var(--border-1)', borderTopColor: 'var(--border)',
  borderBottomStyle: 'solid', borderBottomWidth: 'var(--border-1)', borderBottomColor: 'var(--border)'
};
// 🔴 `sizeMode: contentHeight` is on the shell deliberately and it is register **V1/V17**: without
// it a shell is the runtime's 100%×100% default, becomes flexGrow:100 in a column and eats the band.
const shell = {
  width: PCT100, maxWidth: { value: 1200, unit: 'px' }, sizeMode: 'contentHeight',
  flexDirection: 'column', paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)'
};
const sectionHead = { width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-3)', paddingBottom: 'var(--space-10)' };
const card = {
  width: PCT100, sizeMode: 'contentHeight', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)',
  borderStyle: 'solid', borderWidth: 'var(--border-1)', borderColor: 'var(--border)', clip: true, flexDirection: 'column'
};
const cardBody = {
  width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-2)',
  paddingLeft: 'var(--space-5)', paddingRight: 'var(--space-5)', paddingTop: 'var(--space-5)', paddingBottom: 'var(--space-5)'
};
const cardImage = { sizeMode: 'explicit', objectFit: 'cover', width: PCT100, height: { value: 240, unit: 'px' } };
const badge = {
  sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-2)',
  backgroundColor: 'var(--surface-glass)', borderStyle: 'solid', borderWidth: 'var(--border-1)',
  borderColor: 'var(--border-glass)', borderRadius: 'var(--radius-full)',
  paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)', paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)'
};
const actionRow = {
  sizeMode: 'contentSize', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
  columnGap: 'var(--space-3)', rowGap: 'var(--space-3)', paddingTop: 'var(--space-2)'
};
const featureItem = { width: PCT100, sizeMode: 'contentHeight', flexDirection: 'row', columnGap: 'var(--space-3)', alignItems: 'flex-start' };
const testimonialCard = {
  width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-5)',
  backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', borderStyle: 'solid',
  borderWidth: 'var(--border-1)', borderColor: 'var(--border)', boxShadowEnabled: true,
  boxShadowOffsetY: { value: 1, unit: 'px' }, boxShadowBlurRadius: { value: 3, unit: 'px' }, boxShadowColor: 'var(--border)',
  paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)', paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)'
};
const columnsThreeUp = { layoutString: '1 1 1', marginX: { value: 24, unit: 'px' }, mediumBreakpoint: { value: 900, unit: 'px' }, mediumLayout: '1', smallBreakpoint: { value: 640, unit: 'px' }, smallLayout: '1' };
const columnsTwoUp = { layoutString: '1 1', marginX: { value: 48, unit: 'px' }, mediumBreakpoint: { value: 900, unit: 'px' }, mediumLayout: '1', smallBreakpoint: { value: 640, unit: 'px' }, smallLayout: '1' };

// Type ramp, verbatim.
const displayHeadline = { fontSize: 'var(--display-lg)', fontWeight: 'var(--font-bold)', lineHeight: 'var(--leading-none)', letterSpacing: 'var(--tracking-tighter)', color: 'var(--foreground)' };
const sectionHeading = { fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-semibold)', lineHeight: 'var(--leading-tight)', letterSpacing: 'var(--tracking-tight)', color: 'var(--foreground)' };
const cardTitle = { fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', lineHeight: 'var(--leading-snug)', color: 'var(--foreground)' };
const eyebrow = { fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--primary)' };
const lead = { fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-relaxed)', color: 'var(--muted-foreground)', maxWidth: { value: 560, unit: 'px' } };
const body = { fontSize: 'var(--text-base)', lineHeight: 'var(--leading-relaxed)', color: 'var(--foreground)' };
const meta = { fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' };

// Controls, verbatim.
const primaryButton = {
  sizeMode: 'contentSize', backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)',
  borderRadius: 'var(--radius-full)', borderStyle: 'none',
  paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)', paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)',
  fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)'
};
// ⚠️ The on-dark arm of `outlineButton`. `--border-control` and `--foreground` are ink-on-ink over a
// photograph or a gradient; the vocabulary says so on every ground composition ("light text only —
// pair with var(--primary-foreground)") and `ui-cta-band` already ships exactly this pair.
const outlineOnDark = {
  sizeMode: 'contentSize', backgroundColor: 'transparent', color: 'var(--primary-foreground)',
  borderRadius: 'var(--radius-full)', borderStyle: 'solid', borderWidth: 'var(--border-1)', borderColor: 'var(--border-glass)',
  paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)', paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)',
  fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)'
};

const glyph = (code) => ({ class: 'lucide', code: 'icon-' + code, codeAsClass: true });

// ── Node helpers ─────────────────────────────────────────────────────────────
//
// 🔴 **Node ids are unique across the whole PROJECT, not per component.** The first build of this
// file gave five item components a node called `root` and five a node called `inputs`, and
// `duplicate-node-id` rejected it with the reason: the editor regenerates ids whenever a component
// is copied, so a repeat means the project was assembled outside it. Every component below therefore
// carries a prefix, applied mechanically at assembly rather than typed into each id.
const nodes = [];
const N = (id, type, label, parameters, parent, children) => {
  const n = { id, type, label, parameters };
  if (parent) n.parent = parent;
  if (children) n.children = children;
  nodes.push(n);
  return id;
};
const T = (id, ramp, text, parent, extra) => N(id, 'Text', id, { ...ramp, ...(extra || {}), text }, parent);

/** Take everything built since the last call, prefixed so its ids are unique project-wide. */
function harvest(prefix, connections) {
  const ns = nodes.splice(0, nodes.length).map((n) => {
    const c = JSON.parse(JSON.stringify(n));
    c.id = prefix + c.id;
    if (c.parent) c.parent = prefix + c.parent;
    if (c.children) c.children = c.children.map((k) => prefix + k);
    return c;
  });
  const cs = (connections || []).map((c) => ({ ...c, fromId: prefix + c.fromId, toId: prefix + c.toId }));
  return { nodes: ns, connections: cs };
}

/**
 * One band, as its own component — which is what the gate asked for and what doctrine §0 says.
 *
 * 🔴 The first build put all eight bands directly on the `Page`, and `oversized-page` answered:
 * *"This page's own graph is 90 nodes. Above about 40 a page has usually inlined sections that
 * wanted to be components of their own."* It is an INFO, so it did not fail the run — and it was
 * right. A page that is eight section instances is the shape a model should copy; a page that is
 * ninety nodes is the shape it should not.
 */
const sections = [];
function section(name, prefix, build) {
  build();
  const { nodes: ns, connections } = harvest(prefix, []);
  sections.push({ name, nodes: ns, connections });
  return name;
}

// ═══ The eight sections ══════════════════════════════════════════════════════
const BANDS = {
  hero: '/Sections/Hero',
  strip: '/Sections/TrustStrip',
  story: '/Sections/HowItWorks',
  boxes: '/Sections/Boxes',
  stats: '/Sections/Numbers',
  quotes: '/Sections/Testimonials',
  cta: '/Sections/ClosingCta',
  footer: '/Sections/SiteFooter'
};

section('/Sections/Hero', '', () => {
  // ── Band 1 · the hero: a photograph as the ground, nav over it ───────────────
  // `imageGround`, with three deliberate departures, each one a decision this page had to make:
  //  · height 640 rather than 520 — the band carries a nav row AND the copy, not a heading alone.
  //  · justifyContent flex-start on the band, because the SHELL does the justifying here.
  //  · 🔴 the shell is `explicit` 100% height with `space-between`, which is the exact opposite of the
  //    contentHeight rule everywhere else on this page. That rule (V1/V17) is about a shell that fills
  //    a band ACCIDENTALLY and leaves the band's justifyContent nothing to justify. Filling it on
  //    purpose, and then justifying inside it, is how a nav sits at the top of a hero and the copy at
  //    the foot without one absolutely-positioned node.
  N('hero_band', 'Group', 'Hero — photograph ground under a scrim', {
    width: PCT100, sizeMode: 'explicit', height: { value: 660, unit: 'px' },
    flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
    backgroundImage: IMG + 'texture-soil.webp',
    backgroundGradient: 'var(--gradient-scrim)',
    backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: 'var(--foreground)',
    paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-16)'
  }, undefined, ['hero_shell']);
  N('hero_shell', 'Group', 'Shell', {
    ...shell, sizeMode: 'explicit', height: PCT100, justifyContent: 'space-between'
  }, 'hero_band', ['hero_nav', 'hero_copy']);

  // The nav, over the picture. A row of contentSize items with the links pushed away from the
  // wordmark by `flexGrow` on the spacer — no absolute positioning anywhere on this page.
  // 🔴 **Found by looking, at two widths.** The first version put a `flexGrow: 1` spacer between the
  // wordmark and the links: at 1280 the link Texts were squeezed and "The garden" and "Saturday
  // stall" each wrapped onto two lines, and at 390 the links and the button were pushed off the row
  // entirely — the phone shot showed a nav of "Ashcombe Market Garden" and the word "Boxes". Neither
  // is visible to any gate: `unreachablePx` was 0 and `textChars` was identical, because the words
  // were all still in the DOM. `justifyContent: space-between` needs no spacer node at all, and
  // `flexWrap` lets the links drop to a second line instead of off the end.
  N('hero_nav', 'Group', 'Nav', {
    width: PCT100, sizeMode: 'contentHeight', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 'var(--space-6)', rowGap: 'var(--space-3)'
  }, 'hero_shell', ['hero_mark', 'hero_links', 'hero_navcta']);
  N('hero_mark', 'Group', 'Wordmark', { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-2)' }, 'hero_nav', ['hero_markicon', 'hero_marktext']);
  N('hero_markicon', 'net.noodl.visual.icon', 'Wordmark glyph', { iconIconSource: glyph('sprout'), iconSize: { value: 22, unit: 'px' }, iconColor: 'var(--primary-foreground)' }, 'hero_mark');
  T('hero_marktext', { fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', letterSpacing: 'var(--tracking-tight)', color: 'var(--primary-foreground)' }, 'Ashcombe Market Garden', 'hero_mark');
  N('hero_links', 'Group', 'Nav links', { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-6)' }, 'hero_nav', ['hero_l1', 'hero_l2', 'hero_l3']);
  const navLink = { sizeMode: 'contentSize', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--primary-foreground)' };
  T('hero_l1', navLink, 'Boxes', 'hero_links');
  T('hero_l2', navLink, 'The garden', 'hero_links');
  T('hero_l3', navLink, 'Saturday stall', 'hero_links');
  N('hero_navcta', 'net.noodl.controls.button', 'Nav action', {
    ...outlineOnDark, label: 'Take a box', paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)', paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)'
  }, 'hero_nav');

  N('hero_copy', 'Group', 'Hero copy', {
    width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-5)', maxWidth: { value: 900, unit: 'px' }
  }, 'hero_shell', ['hero_badge', 'hero_head', 'hero_lead', 'hero_actions']);
  N('hero_badge', 'Group', 'Badge', badge, 'hero_copy', ['hero_badgeicon', 'hero_badgetext']);
  N('hero_badgeicon', 'net.noodl.visual.icon', 'Badge glyph', { iconIconSource: glyph('map-pin'), iconSize: { value: 14, unit: 'px' }, iconColor: 'var(--primary-foreground)' }, 'hero_badge');
  T('hero_badgetext', { fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', letterSpacing: 'var(--tracking-wide)', color: 'var(--primary-foreground)' }, 'Somerset · packed Thursday, delivered Friday', 'hero_badge');
  // 🔴 `--display-lg` is a clamp(): 44px at 390 and 96px at 1900 from this one parameter (V13). The
  // measure lives on the COPY group above, never on the headline — a maxWidth on the type is what
  // strands the white space on one side (V29).
  T('hero_head', displayHeadline, 'Eleven acres, forty crops, one van.', 'hero_copy', { color: 'var(--primary-foreground)' });
  T('hero_lead', lead, 'We grow what this ground actually wants, pick it on Thursday morning and drive it out on Friday. You do not choose what is in the box. The season does.', 'hero_copy', { color: 'var(--primary-foreground)', maxWidth: { value: 620, unit: 'px' } });
  N('hero_actions', 'Group', 'Actions', actionRow, 'hero_copy', ['hero_cta', 'hero_secondary']);
  N('hero_cta', 'net.noodl.controls.button', 'Primary', { ...primaryButton, label: 'Take a box — £14 a week' }, 'hero_actions');
  N('hero_secondary', 'net.noodl.controls.button', 'Secondary', { ...outlineOnDark, label: "See this week's box" }, 'hero_actions');
});

section('/Sections/TrustStrip', '', () => {
  // ── Band 2 · the trust strip: three glyphs doing communicative work ──────────
  N('strip_band', 'Group', 'Trust strip', { ...bandSurface, paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-10)' }, undefined, ['strip_shell']);
  N('strip_shell', 'Group', 'Shell', shell, 'strip_band', ['strip_cols']);
  N('strip_cols', 'net.noodl.visual.columns', 'Three up', { ...columnsThreeUp, marginX: { value: 48, unit: 'px' } }, 'strip_shell', ['strip_i1', 'strip_i2', 'strip_i3']);
  N('strip_i1', '/Components/FeatureItem', 'Grown here', { icon: glyph('sprout'), title: 'Picked eleven miles away', body: 'Two fields at Ashcombe and a polytunnel we put up in 2021.' }, 'strip_cols');
  N('strip_i2', '/Components/FeatureItem', 'Delivery', { icon: glyph('truck'), title: 'One van, one morning', body: 'Friday between six and eleven. We text when we are two stops away.' }, 'strip_cols');
  N('strip_i3', '/Components/FeatureItem', 'Crates', { icon: glyph('recycle'), title: 'The crate comes back', body: 'Leave it out the week after and we swap it. Forty lost in four years.' }, 'strip_cols');
});

section('/Sections/HowItWorks', '', () => {
  // ── Band 3 · the story: copy beside a photograph of the actual thing ─────────
  N('story_band', 'Group', 'How it works', band, undefined, ['story_shell']);
  N('story_shell', 'Group', 'Shell', shell, 'story_band', ['story_cols']);
  N('story_cols', 'net.noodl.visual.columns', 'Two up', columnsTwoUp, 'story_shell', ['story_copy', 'story_media']);
  // 🔴 **Three configurations, one rendering, and the parameter comes OUT.** Against the photograph
  // the copy sat at the top. `justifyContent: center` on a `contentHeight` box does nothing — it hugs
  // its children, so there is nothing to centre. `sizeMode: explicit` with `height: 100%` rendered
  // **identically**, and so did an explicit `420px` matching the photograph: `contentBottom` was
  // 3766 on all three at 1280, and the pictures agree. `Columns` in its default `rows` mode already
  // makes *"every item in a row as tall as the tallest one in it"*, so the height was never the
  // missing thing and a child cannot centre itself against a taller sibling.
  //
  // 🔴 **So it is deleted rather than left in.** An inert parameter in a corpus example is worse than
  // no parameter: a model copies `justifyContent: center` from here, believes it centres a column,
  // and cannot see that it does nothing. The composition is fixed by making the photograph closer to
  // the copy's own height instead. Filed as a register row — there is no on-system way to centre one
  // Columns child against another, and the door says nothing about it.
  N('story_copy', 'Group', 'Copy', { width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-4)' }, 'story_cols', ['story_eyebrow', 'story_head', 'story_p1', 'story_p2']);
  T('story_eyebrow', eyebrow, 'How it works', 'story_copy');
  T('story_head', sectionHeading, 'You get what came out of the ground that week.', 'story_copy');
  T('story_p1', body, 'There is no choosing. In February that means celeriac, leeks and enough kale to bore you. In July it means we are apologising for the courgettes. Both are the same promise kept.', 'story_copy');
  T('story_p2', body, 'Every box carries a card saying what is in it, what to do with the awkward one, and what we got wrong that week.', 'story_copy', { color: 'var(--muted-foreground)' });
  // ⚠️ Same finding, same treatment: no `height: 100%` and no `justifyContent` here either. The
  // column is already the row's height; the wrapper only has to hold the picture.
  N('story_media', 'Group', 'Media', { width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column' }, 'story_cols', ['story_photo']);
  N('story_photo', 'Image', 'Photograph', {
    sizeMode: 'explicit', objectFit: 'cover', width: PCT100, height: { value: 360, unit: 'px' },
    borderRadius: 'var(--radius-2xl)', src: IMG + 'people-market.webp',
    alt: 'A grower weighing produce on a market stall'
  }, 'story_media');
});

section('/Sections/Boxes', '', () => {
  // ── Band 4 · the boxes: three cards, each with its own picture ───────────────
  N('boxes_band', 'Group', 'The boxes', bandSurface, undefined, ['boxes_shell']);
  N('boxes_shell', 'Group', 'Shell', shell, 'boxes_band', ['boxes_head', 'boxes_cols']);
  N('boxes_head', 'Group', 'Section head', sectionHead, 'boxes_shell', ['boxes_eyebrow', 'boxes_title', 'boxes_lead']);
  T('boxes_eyebrow', eyebrow, 'The boxes', 'boxes_head');
  T('boxes_title', sectionHeading, 'Three sizes, and a table on Saturdays.', 'boxes_head');
  T('boxes_lead', lead, 'Cancel any week before Wednesday midnight. No contract, no minimum, no app.', 'boxes_head');
  N('boxes_cols', 'net.noodl.visual.columns', 'Three up', columnsThreeUp, 'boxes_shell', ['boxes_c1', 'boxes_c2', 'boxes_c3']);
  N('boxes_c1', '/Components/BoxCard', 'Small box', {
    image: IMG + 'food-carrots.webp', alt: 'Carrots in a wooden crate',
    title: 'The small box', price: '£14 a week',
    body: 'Six or seven lines. Enough for two people who cook most nights.'
  }, 'boxes_cols');
  N('boxes_c2', '/Components/BoxCard', 'Full box', {
    image: IMG + 'food-board.webp', alt: 'A red onion and peppercorns on a wooden board',
    title: 'The full box', price: '£22 a week',
    body: 'Ten to twelve lines, including the awkward ones. Feeds four, or two who batch-cook.'
  }, 'boxes_cols');
  N('boxes_c3', '/Components/BoxCard', 'Saturday stall', {
    image: IMG + 'food-grocer.webp', alt: 'A greengrocer stall with a customer choosing vegetables',
    title: 'The Saturday stall', price: 'Eight until it goes',
    body: 'Whatever did not fit in a box, on the table at Ashcombe Cross.'
  }, 'boxes_cols');
});

section('/Sections/Numbers', '', () => {
  // ── Band 5 · the numbers, on the page's one dark ground ──────────────────────
  // `heroGround` with `--gradient-deep`, and the tiles are `glassPanel`'s SURFACE with a column
  // arrangement — which is how a surface composition and an arrangement are meant to compose. A
  // `statTile` here would be a --surface card on a dark band: a light rectangle, not a designed object.
  N('stats_band', 'Group', 'The numbers', {
    width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', alignItems: 'center',
    backgroundGradient: 'var(--gradient-deep)', paddingTop: 'var(--space-20)', paddingBottom: 'var(--space-20)'
  }, undefined, ['stats_shell']);
  N('stats_shell', 'Group', 'Shell', shell, 'stats_band', ['stats_head', 'stats_cols']);
  N('stats_head', 'Group', 'Section head', sectionHead, 'stats_shell', ['stats_eyebrow', 'stats_title']);
  T('stats_eyebrow', eyebrow, 'Last season', 'stats_head', { color: 'var(--primary-foreground)' });
  T('stats_title', sectionHeading, 'The whole business, in four numbers.', 'stats_head', { color: 'var(--primary-foreground)' });
  N('stats_cols', 'net.noodl.visual.columns', 'Four up', {
    layoutString: '1 1 1 1', marginX: { value: 20, unit: 'px' },
    mediumBreakpoint: { value: 900, unit: 'px' }, mediumLayout: '1 1',
    smallBreakpoint: { value: 640, unit: 'px' }, smallLayout: '1 1'
  }, 'stats_shell', ['stats_t1', 'stats_t2', 'stats_t3', 'stats_t4']);
  N('stats_t1', '/Components/StatTile', 'Acres', { value: '11', label: 'acres in cultivation' }, 'stats_cols');
  N('stats_t2', '/Components/StatTile', 'Crops', { value: '40', label: 'crops through the year' }, 'stats_cols');
  N('stats_t3', '/Components/StatTile', 'Boxes', { value: '318', label: 'boxes packed last week' }, 'stats_cols');
  N('stats_t4', '/Components/StatTile', 'Air miles', { value: '0', label: 'air miles in the boxes' }, 'stats_cols');
});

section('/Sections/Testimonials', '', () => {
  // ── Band 6 · three customers, three different faces ──────────────────────────
  // 🔴 Doctrine §5: "a testimonial row wearing one face three times is the thing a reader notices
  // before they read a word." Three of the six avatars, chosen to be visibly different people.
  N('quotes_band', 'Group', 'Testimonials', {
    ...band, backgroundGradient: 'var(--gradient-surface)',
    borderBottomStyle: 'solid', borderBottomWidth: 'var(--border-1)', borderBottomColor: 'var(--border)'
  }, undefined, ['quotes_shell']);
  N('quotes_shell', 'Group', 'Shell', shell, 'quotes_band', ['quotes_head', 'quotes_cols']);
  N('quotes_head', 'Group', 'Section head', sectionHead, 'quotes_shell', ['quotes_eyebrow', 'quotes_title']);
  T('quotes_eyebrow', eyebrow, 'Six hundred households', 'quotes_head');
  T('quotes_title', sectionHeading, 'What people say when we ask them to stop.', 'quotes_head');
  N('quotes_cols', 'net.noodl.visual.columns', 'Three up', columnsThreeUp, 'quotes_shell', ['quotes_q1', 'quotes_q2', 'quotes_q3']);
  N('quotes_q1', '/Components/QuoteCard', 'Priya', {
    quote: 'I throw away less food in a year of this than I used to in a month. The card in the box tells you what to do with the kohlrabi.',
    name: 'Priya Raman', role: 'Wells · since 2023', avatar: IMG + 'avatar-2.webp'
  }, 'quotes_cols');
  N('quotes_q2', '/Components/QuoteCard', 'Tom', {
    quote: 'They emailed in March to say the crop had failed and knocked a week off before I noticed. Nobody does that.',
    name: 'Tom Beckett', role: 'Shepton Mallet · since 2021', avatar: IMG + 'avatar-4.webp'
  }, 'quotes_cols');
  N('quotes_q3', '/Components/QuoteCard', 'Amal', {
    quote: 'It is not cheaper than the supermarket. It is better, and it turns up, and I have stopped thinking about it.',
    name: 'Amal Haddad', role: 'Frome · since 2024', avatar: IMG + 'avatar-6.webp'
  }, 'quotes_cols');
});

section('/Sections/ClosingCta', '', () => {
  // ── Band 7 · the closing CTA — `ctaBand`, a CENTRED measure (V29) ────────────
  N('cta_band', 'Group', 'Closing CTA', {
    width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', alignItems: 'center',
    backgroundGradient: 'var(--gradient-brand)', paddingTop: 'var(--space-24)', paddingBottom: 'var(--space-24)'
  }, undefined, ['cta_shell']);
  // 🔴 V29's mechanism: the measure is a maxWidth on the SHELL with alignItems center, and the type
  // carries textAlignX center and NO maxWidth of its own. A maxWidth on the headline strands the
  // white space on one side, which is the "that's weird" Richard named at 1900.
  N('cta_shell', 'Group', 'Shell', {
    width: PCT100, maxWidth: { value: 720, unit: 'px' }, sizeMode: 'contentHeight',
    flexDirection: 'column', alignItems: 'center', rowGap: 'var(--space-5)',
    paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)'
  }, 'cta_band', ['cta_badge', 'cta_head', 'cta_sub', 'cta_actions']);
  N('cta_badge', 'Group', 'Badge', badge, 'cta_shell', ['cta_badgeicon', 'cta_badgetext']);
  N('cta_badgeicon', 'net.noodl.visual.icon', 'Badge glyph', { iconIconSource: glyph('sprout'), iconSize: { value: 14, unit: 'px' }, iconColor: 'var(--primary-foreground)' }, 'cta_badge');
  T('cta_badgetext', { fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', letterSpacing: 'var(--tracking-wide)', color: 'var(--primary-foreground)' }, 'Eleven boxes left on the spring round', 'cta_badge');
  T('cta_head', { fontSize: 'var(--display-md)', fontWeight: 'var(--font-bold)', lineHeight: 'var(--leading-none)', letterSpacing: 'var(--tracking-tighter)', color: 'var(--primary-foreground)' }, 'Start on Friday.', 'cta_shell', { textAlignX: 'center' });
  T('cta_sub', { fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-relaxed)', color: 'var(--primary-foreground)' }, 'Pick a size, tell us where the crate goes, and cancel any week you like.', 'cta_shell', { textAlignX: 'center' });
  N('cta_actions', 'Group', 'Actions', { ...actionRow, justifyContent: 'center' }, 'cta_shell', ['cta_primary', 'cta_secondary']);
  N('cta_primary', 'net.noodl.controls.button', 'Primary', {
    ...primaryButton, backgroundColor: 'var(--primary-foreground)', color: 'var(--primary)', label: 'Take a box'
  }, 'cta_actions');
  N('cta_secondary', 'net.noodl.controls.button', 'Secondary', { ...outlineOnDark, label: 'Check the delivery area' }, 'cta_actions');
});

section('/Sections/SiteFooter', '', () => {
  // ── Band 8 · the footer — a page whose last ground is its first has no ending ─
  N('footer_band', 'Group', 'Footer', {
    width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', alignItems: 'center',
    backgroundColor: 'var(--muted)', borderTopStyle: 'solid', borderTopWidth: 'var(--border-1)', borderTopColor: 'var(--border)',
    paddingTop: 'var(--space-16)', paddingBottom: 'var(--space-10)'
  }, undefined, ['footer_shell']);
  N('footer_shell', 'Group', 'Shell', { ...shell, rowGap: 'var(--space-10)' }, 'footer_band', ['footer_cols', 'footer_rule']);
  N('footer_cols', 'net.noodl.visual.columns', 'Four up', {
    layoutString: '2 1 1 1', marginX: { value: 32, unit: 'px' },
    mediumBreakpoint: { value: 900, unit: 'px' }, mediumLayout: '1 1',
    smallBreakpoint: { value: 640, unit: 'px' }, smallLayout: '1'
  }, 'footer_shell', ['footer_about', 'footer_k1', 'footer_k2', 'footer_k3']);
  N('footer_about', 'Group', 'About', { width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-3)' }, 'footer_cols', ['footer_mark', 'footer_blurb']);
  N('footer_mark', 'Group', 'Wordmark', { sizeMode: 'contentSize', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-2)' }, 'footer_about', ['footer_markicon', 'footer_marktext']);
  N('footer_markicon', 'net.noodl.visual.icon', 'Wordmark glyph', { iconIconSource: glyph('sprout'), iconSize: { value: 20, unit: 'px' }, iconColor: 'var(--primary)' }, 'footer_mark');
  T('footer_marktext', { fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', letterSpacing: 'var(--tracking-tight)', color: 'var(--foreground)' }, 'Ashcombe Market Garden', 'footer_mark');
  T('footer_blurb', { ...meta, maxWidth: { value: 320, unit: 'px' }, lineHeight: 'var(--leading-relaxed)' }, 'Ashcombe Cross, Somerset. Eleven acres, growing since 2019. Boxes packed Thursday and out on Friday.', 'footer_about');
  N('footer_k1', '/Components/FooterColumn', 'Boxes', { heading: 'Boxes', a: 'The small box', b: 'The full box', c: 'Gift a box' }, 'footer_cols');
  N('footer_k2', '/Components/FooterColumn', 'The garden', { heading: 'The garden', a: 'What we grow', b: 'Open days', c: 'Volunteering' }, 'footer_cols');
  N('footer_k3', '/Components/FooterColumn', 'Practical', { heading: 'Practical', a: 'Delivery area', b: 'Cancel a week', c: 'Get in touch' }, 'footer_cols');
  N('footer_rule', 'Group', 'Bottom rule', {
    width: PCT100, sizeMode: 'contentHeight', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-4)',
    borderTopStyle: 'solid', borderTopWidth: 'var(--border-1)', borderTopColor: 'var(--border)', paddingTop: 'var(--space-6)'
  }, 'footer_shell', ['footer_copy']);
  T('footer_copy', meta, '© 2026 Ashcombe Market Garden · Photographs are CC0 from the bundled starter imagery', 'footer_rule');
});

// 🔴 **The page is nine nodes**: a `Page` and eight section instances. That is doctrine §0 — *"a
// page is an assembly of components, not a graph of nodes"* — and it is what `oversized-page` asked
// for when the first build put all ninety on the page itself.
const homeNodes = [
  { id: 'page', type: 'Page', label: 'Home', parameters: { title: 'Ashcombe Market Garden', urlPath: '' }, children: Object.keys(BANDS).map((k) => 'sec_' + k) },
  ...Object.entries(BANDS).map(([k, name], i) => ({ id: 'sec_' + k, type: name, label: name.split('/').pop(), parameters: {}, parent: 'page', x: 60, y: 160 + i * 90 }))
];

// ═══ The item components ═════════════════════════════════════════════════════
// 🔴 Every one has a `Component Inputs` with an explicit `ports` array whose entries are plugged
// "output". Register **V22**: 14 shipped examples carry a `Component Inputs` with NO ports array and
// connections out of it, and `catalog:examples` runs them 66/66 strict. A port that is not declared
// is a parameter that is silently discarded at the instance.
const componentOf = (name, prefix, build, ports, connections) => {
  build();
  N('inputs', 'Component Inputs', 'What varies per instance', undefined);
  const h = harvest(prefix, connections);
  const inputs = h.nodes.find((n) => n.id === prefix + 'inputs');
  delete inputs.parameters;
  inputs.x = 40;
  inputs.y = 40;
  inputs.ports = ports.map((p) => ({ name: p, plug: 'output', type: '*' }));
  return { name, nodes: h.nodes, connections: h.connections };
};

const featureItemComp = componentOf('/Components/FeatureItem', 'fi_', () => {
  N('root', 'Group', 'Item', featureItem, undefined, ['icon', 'copy']);
  N('icon', 'net.noodl.visual.icon', 'Glyph', {
    iconIconSource: glyph('sprout'), iconSize: { value: 22, unit: 'px' },
    // 🔴 Register V21: `addIconInputs` defaults `iconColor` to #FFFFFF, so a complete, correct,
    // drawable glyph renders white on a white band and produces nothing visible.
    iconColor: 'var(--primary)'
  }, 'root');
  N('copy', 'Group', 'Copy', { width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-1)' }, 'root', ['t', 'b']);
  T('t', { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--foreground)' }, 'Title', 'copy');
  T('b', { fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', color: 'var(--muted-foreground)' }, 'Body', 'copy');
}, ['title', 'body', 'icon'], [
  { fromId: 'inputs', fromProperty: 'icon', toId: 'icon', toProperty: 'iconIconSource' },
  { fromId: 'inputs', fromProperty: 'title', toId: 't', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'body', toId: 'b', toProperty: 'text' }
]);

const boxCardComp = componentOf('/Components/BoxCard', 'bc_', () => {
  N('root', 'Group', 'Card', card, undefined, ['photo', 'body']);
  // `clip: true` on the card is what makes the radius cut the photograph (doctrine §5).
  N('photo', 'Image', 'Photograph', { ...cardImage, src: IMG + 'food-carrots.webp', alt: 'Vegetables' }, 'root');
  N('body', 'Group', 'Card body', cardBody, 'root', ['title', 'price', 'text']);
  T('title', cardTitle, 'Title', 'body');
  T('price', { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', letterSpacing: 'var(--tracking-wide)', color: 'var(--primary)' }, 'Price', 'body');
  T('text', { fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', color: 'var(--muted-foreground)' }, 'Body', 'body');
}, ['image', 'alt', 'title', 'price', 'body'], [
  { fromId: 'inputs', fromProperty: 'image', toId: 'photo', toProperty: 'src' },
  { fromId: 'inputs', fromProperty: 'alt', toId: 'photo', toProperty: 'alt' },
  { fromId: 'inputs', fromProperty: 'title', toId: 'title', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'price', toId: 'price', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'body', toId: 'text', toProperty: 'text' }
]);

const statTileComp = componentOf('/Components/StatTile', 'st_', () => {
  // `glassPanel`'s surface — the only on-system way to express translucency — in a column.
  N('root', 'Group', 'Tile', {
    width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-2)',
    backgroundColor: 'var(--surface-glass)', borderStyle: 'solid', borderWidth: 'var(--border-1)',
    borderColor: 'var(--border-glass)', borderRadius: 'var(--radius-2xl)', backdropBlur: { value: 14, unit: 'px' },
    paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)', paddingLeft: 'var(--space-5)', paddingRight: 'var(--space-5)'
  }, undefined, ['value', 'label']);
  T('value', { fontSize: 'var(--text-5xl)', fontWeight: 'var(--font-bold)', lineHeight: 'var(--leading-none)', letterSpacing: 'var(--tracking-tighter)', color: 'var(--primary-foreground)' }, '0', 'root');
  T('label', { fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--gray-300)', lineHeight: 'var(--leading-snug)' }, 'Label', 'root');
}, ['value', 'label'], [
  { fromId: 'inputs', fromProperty: 'value', toId: 'value', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'label', toId: 'label', toProperty: 'text' }
]);

const quoteCardComp = componentOf('/Components/QuoteCard', 'qc_', () => {
  N('root', 'Group', 'Quote card', testimonialCard, undefined, ['mark', 'quote', 'author']);
  N('mark', 'net.noodl.visual.icon', 'Quote mark', { iconIconSource: glyph('quote'), iconSize: { value: 22, unit: 'px' }, iconColor: 'var(--primary)' }, 'root');
  T('quote', { fontSize: 'var(--text-base)', lineHeight: 'var(--leading-relaxed)', color: 'var(--foreground)' }, 'Quote', 'root');
  N('author', 'Group', 'Author row', {
    width: PCT100, sizeMode: 'contentHeight', flexDirection: 'row', alignItems: 'center', columnGap: 'var(--space-3)',
    borderTopStyle: 'solid', borderTopWidth: 'var(--border-1)', borderTopColor: 'var(--border-subtle)', paddingTop: 'var(--space-4)'
  }, 'root', ['face', 'who']);
  N('face', 'Image', 'Portrait', {
    sizeMode: 'explicit', objectFit: 'cover', width: { value: 44, unit: 'px' }, height: { value: 44, unit: 'px' },
    borderRadius: 'var(--radius-full)', src: IMG + 'avatar-2.webp', alt: 'Portrait'
  }, 'author');
  N('who', 'Group', 'Who', { sizeMode: 'contentHeight', width: PCT100, flexDirection: 'column', rowGap: 'var(--space-0-5)' }, 'author', ['name', 'role']);
  T('name', { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--foreground)' }, 'Name', 'who');
  T('role', { fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)' }, 'Role', 'who');
}, ['quote', 'name', 'role', 'avatar'], [
  { fromId: 'inputs', fromProperty: 'quote', toId: 'quote', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'name', toId: 'name', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'role', toId: 'role', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'avatar', toId: 'face', toProperty: 'src' }
]);

const footerColumnComp = componentOf('/Components/FooterColumn', 'fc_', () => {
  N('root', 'Group', 'Footer column', { width: PCT100, sizeMode: 'contentHeight', flexDirection: 'column', rowGap: 'var(--space-3)' }, undefined, ['heading', 'a', 'b', 'c']);
  T('heading', { fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--foreground)' }, 'Heading', 'root');
  const link = { fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' };
  T('a', link, 'Link', 'root');
  T('b', link, 'Link', 'root');
  T('c', link, 'Link', 'root');
}, ['heading', 'a', 'b', 'c'], [
  { fromId: 'inputs', fromProperty: 'heading', toId: 'heading', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'a', toId: 'a', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'b', toId: 'b', toProperty: 'text' },
  { fromId: 'inputs', fromProperty: 'c', toId: 'c', toProperty: 'text' }
]);

const example = {
  id: 'ui-landing-page',
  title: 'A complete landing page: eight bands, seven photographs, five item components',
  description:
    "THE WORKED PAGE. Every other UI recipe in this corpus is one band; this is what they look like assembled, and it is the thing to copy when the brief is \"a landing page\". Read it for the SHAPE, then replace every word and every picture — the copy here is a Somerset veg-box scheme because a page written in a real voice about a real thing is the only kind that shows what the voice is for. " +
    'Eight bands, and the grounds ALTERNATE: a photograph under a scrim, --surface with hairlines, the page background, --surface again, --gradient-deep, --gradient-surface, --gradient-brand, --muted. That sequence is the point. A page with one background colour end to end is the first thing that reads as a template, and no amount of spacing rescues it. ' +
    'Each band is exactly ONE shell (maxWidth 1200, --space-6 either side), so all eight gutters agree; a band that disagrees reads as a bug rather than a choice. ' +
    'THE HERO is the one departure worth studying: `imageGround` with a real photograph, a --gradient-scrim over it, and a shell that is EXPLICIT 100% height with justifyContent space-between — so the nav sits at the top of the picture and the copy at its foot, with no absolutely-positioned node anywhere. Everywhere else on this page a shell carries sizeMode contentHeight, because a shell that fills its band by accident leaves the band nothing to justify. Filling one on purpose and justifying inside it is a different thing. ' +
    'THE MEASURE lives on the shell and on the copy GROUP, never on the headline. A maxWidth on the type strands the white space on one side of a wide viewport, which is the thing that reads as broken at 1900. ' +
    'THE PICTURES are seven different photographs from the bundled starter imagery, each chosen by SUBJECT: turned soil as the hero ground because the page is about growing; a market stall beside the copy that explains the boxes; three different vegetables on three cards; three different faces in three testimonials. Nothing here is decoration — a page whose every image is the same abstract is decorated, not designed. ' +
    'THE REPEATED THINGS are components (FeatureItem, BoxCard, StatTile, QuoteCard, FooterColumn), each with a Component Inputs node whose ports are explicitly declared and plugged "output". An undeclared port is a parameter silently discarded at the instance, and writing the subtree out three times is a repeated-sibling-subtree warning.',
  demonstrates: ['Page', 'Group', 'Text', 'Image', 'net.noodl.visual.icon', 'net.noodl.visual.columns', 'net.noodl.controls.button', 'Component Inputs'],
  components: [
    { name: '/Pages/Home', nodes: homeNodes, connections: [] },
    ...sections,
    featureItemComp,
    boxCardComp,
    statTileComp,
    quoteCardComp,
    footerColumnComp
  ]
};

fs.writeFileSync(OUT, JSON.stringify(example, null, 2) + '\n');
const total = example.components.reduce((a, c) => a + c.nodes.length, 0);
// eslint-disable-next-line no-console
console.log(
  `wrote ${OUT}\n  ${example.components.length} components, ${total} nodes, ` +
    `${homeNodes.find((n) => n.id === 'page').children.length} bands, page graph = ${homeNodes.length} nodes`
);
