/**
 * SBR-012 — the raw-colour gate's instrument, held apart from the suite that
 * runs it so both populations are scanned by ONE scanner.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Why a module rather than a second copy of two regexes
 *
 * `sb006PublicSite.test.ts` already scans the five SB-006 component sets as they
 * came back from the door, and says so in its own header: *"Deliberately
 * narrower than SBR-012."* SBR-012 widens that idea to the **generated
 * artefact** and the **other component sets**, and adds the arm that a colour
 * check cannot have — whether every `var(--x)` a component consumes actually
 * resolves.
 *
 * Widening by copying the regexes into a second suite would make the two gates
 * drift the moment either is tightened, which is the failure this repo already
 * has a name for. So the literal patterns live here, `sb006PublicSite.test.ts`
 * imports them, and the two suites disagree only about which population they
 * point at.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## The hole this exists to cover
 *
 * `DiagnosticCode.RawColorLiteral` (`validation/parameterValues.ts:1001`, regex
 * at `:578`) is the product's own raw-colour check, and it has **two** structural
 * limits — both deliberate, neither survivable for a template:
 *
 *  1. `CatalogIndex.portTypeName(port) === 'color'` — it reads **colour-typed
 *     ports only**. A hex on a `*`-typed port, inside a `functionScript` body, or
 *     in `applyTheme`'s own `setProperty` calls is invisible to it.
 *  2. `RAW_COLOR = /^\s*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/` — **anchored at the
 *     start of the value**. `'1px solid #ccc'` and
 *     `'linear-gradient(#fff, #000)'` pass it.
 *
 * It is also a **warning by design** and must stay one: the wider corpus carries
 * 553 of these and imported content is not wrong for being untokenised. 🔴 **This
 * gate does not touch the global severity.** It promotes the rule to FAIL for the
 * site-builder's two populations and nothing else.
 *
 * So {@link RAW_COLOR_LITERAL} is unanchored and applied to **every string
 * value on every port**, script bodies included.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## The third arm, and why a colour check cannot be it
 *
 * A typo'd token renders as **nothing** — `var(--tpyo)` is a well-formed CSS
 * value naming a custom property that was never declared, so the browser drops
 * the declaration and the element inherits. There is no literal to find, no
 * diagnostic to raise, and the page looks *almost* right. The only way to see it
 * is to resolve every consumed name against the set of names that exist:
 * {@link tokenUniverse}.
 *
 * @module noodl-mcp/tests
 */
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_TOKENS } from '../../noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens';
import {
  SITE_THEME_PRESETS,
  buildSiteDesignTokens,
  THEME_TOKEN_FIELDS
} from '../../noodl-editor/src/editor/src/models/template/templates/siteTheme';
import { RAW_DIMENSION_EXEMPTIONS, exemptionKey } from './sb006Components';

// ── The two literal patterns, single-sourced ─────────────────────────────────

/**
 * A colour written as a value rather than named as a token.
 *
 * 🔴 **Unanchored, unlike the product's `RAW_COLOR`.** A hex in the middle of a
 * shorthand or a gradient is the same defect as a hex on its own, and the
 * product's anchored version is the reason this file needed writing.
 *
 * The `\b` after the hex digits is what keeps it off an id: the artefact is full
 * of `#`-free ids, but a component path like `#a1b2c3d4e5` (10 digits) is not a
 * colour, and `{3,8}` followed by a word boundary declines to match its prefix.
 */
export const RAW_COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;

/**
 * A port whose value is a **measurement** the token vocabulary has a name for.
 *
 * Enum-ish style ports (`flexDirection: 'row'`, `borderStyle: 'solid'`,
 * `textAlignX: 'center'`) match the prefix but are arrangement rather than
 * measurement, so the dimension arm only fires on numbers and `{value, unit}`
 * objects — a string on one of these ports is either a token or a keyword.
 */
export const STYLE_VALUE_PORT =
  /^(padding|margin|border|font|color|background|width|height|maxWidth|minWidth|maxHeight|minHeight|rowGap|columnGap|letterSpacing|lineHeight|opacity)/i;

// ── Population 1: the component sets, as source text ─────────────────────────

/**
 * The four modules the generator reads. `sb007Template.ts` is in the list
 * because the `App` shell is authored there and nowhere else — a population
 * defined as "the sb00{4,5,6} sets" would leave the one component every page
 * renders inside unscanned.
 */
export const COMPONENT_SET_FILES = [
  'sb004Components.ts',
  'sb005Components.ts',
  'sb006Components.ts',
  'sb007Template.ts'
] as const;

/**
 * 🔴 Comments are stripped before counting, and this is not tidiness.
 *
 * These modules are heavily annotated and several comments quote the hexes they
 * exist to explain — `DefaultTokens.ts`'s header does exactly that about
 * `#3b82f6`. A scan that counted them would red on prose, the next reader would
 * add an exclusion, and the exclusion would be the hole.
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

export interface SourceHit {
  file: string;
  line: number;
  text: string;
}

/** Every raw colour in a component-set source, comments removed. */
export function rawColoursInSource(file: string, source: string): SourceHit[] {
  const hits: SourceHit[] = [];
  stripComments(source)
    .split('\n')
    .forEach((text, i) => {
      if (RAW_COLOR_LITERAL.test(text)) hits.push({ file, line: i + 1, text: text.trim() });
    });
  return hits;
}

/** Reads a component-set module off disk. */
export function readComponentSet(file: string): string {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

// ── Population 2: the generated artefact ─────────────────────────────────────

export const ARTEFACT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'noodl-editor',
  'src',
  'editor',
  'src',
  'models',
  'template',
  'templates',
  'site-builder.content.json'
);

interface ArtefactNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  children?: ArtefactNode[];
}
export interface ArtefactContent {
  components: Array<{ name: string; graph: { roots: ArtefactNode[] } }>;
}

/** One parameter on one node, with enough identity to name it in a failure. */
export interface ParamRow {
  component: string;
  label: string;
  type: string;
  port: string;
  value: unknown;
}

export function readArtefact(): ArtefactContent {
  return JSON.parse(fs.readFileSync(ARTEFACT_PATH, 'utf8')) as ArtefactContent;
}

/**
 * Flattens the artefact to one row per parameter.
 *
 * ⚠️ The label falls back to the type rather than to the id: ids are reallocated
 * by the door to be unique across the project (SB-004 F9), so an id in a failure
 * message — or in an exemption key — is a name that can silently stop matching.
 */
export function artefactParams(content: ArtefactContent): ParamRow[] {
  const rows: ParamRow[] = [];
  const walk = (node: ArtefactNode, component: string) => {
    for (const [port, value] of Object.entries(node.parameters ?? {})) {
      rows.push({ component, label: node.label ?? node.type, type: node.type, port, value });
    }
    for (const child of node.children ?? []) walk(child, component);
  };
  for (const component of content.components) for (const root of component.graph.roots) walk(root, component.name);
  return rows;
}

/**
 * Every raw colour in the artefact — **on any port, of any type, including
 * script bodies**, which is the whole point (see the header's hole #1).
 *
 * Structured values are stringified rather than skipped: a `{value, unit}` is
 * not the only object shape a port takes, and a colour hiding one level down in
 * a style object would otherwise be invisible.
 */
export function rawColoursInArtefact(rows: ParamRow[]): string[] {
  const found: string[] = [];
  for (const row of rows) {
    const text = typeof row.value === 'string' ? row.value : JSON.stringify(row.value ?? null);
    if (RAW_COLOR_LITERAL.test(text)) found.push(templateExemptionKey(row.component, row.label, row.port));
  }
  return found.sort();
}

/**
 * SBR-009 — **the one allowed home for a colour literal**, and SBR-012's own
 * scope is where the allowance comes from: *"the artefact-level scan is
 * therefore textual over parameter values AND script sources, with the
 * `designTokens`/**preset-data** blocks as the one allowed home for literals"*
 * (SBR-012 §2, bullet 4). There was no preset-data block when the gate was
 * built, so the list it asserted was empty; SBR-009 introduces the block the
 * scope anticipated.
 *
 * 🔴 **An exemption on a colour is worth far less than an exemption on a
 * dimension, and this one is not asked to carry the weight alone.** A raw width
 * is exempted because there is no token for a proportion; a raw hex is exempted
 * only because it is *data* — the seed values of a `Theme` record, the same
 * thing a client types into the primary box. That argument is only true while
 * the values are the ones in `siteTheme.ts`, so {@link presetHexesInArtefact}
 * asserts exactly that and `sbr012RawColourGate` runs it in the same breath as
 * this list. A drifted second copy of the palette would satisfy the exemption
 * and fail the derivation, which is the property that makes the carve-out safe.
 *
 * ⚠️ The **source** population gains nothing: the script is
 * `JSON.stringify(SITE_THEME_PRESETS)`, so `rawColoursInSource` still reads zero
 * and the hexes are hand-written in exactly one file in the repository.
 */
export const TEMPLATE_COLOUR_EXEMPTIONS: ReadonlyArray<TemplateExemption> = [
  {
    component: '/Pages/ThemeEditor',
    label: 'The three presets',
    port: 'functionScript',
    why: 'SBR-009 §2: a preset row is the answer to "a client never faces an empty colour picker", and a preset IS a palette — a component that named tokens here could not offer a choice between palettes at all. These are record VALUES, not styling: the same bytes the client would otherwise type into the primary box. Serialised from SITE_THEME_PRESETS, and presetHexesInArtefact asserts they still are.'
  }
];

/**
 * Every colour literal in the artefact's preset block, in the order they appear.
 *
 * The gate compares this against the same list read straight out of
 * `SITE_THEME_PRESETS`, so the exemption above cannot quietly become the home of
 * a palette nobody generated.
 */
export function presetHexesInArtefact(rows: ParamRow[]): string[] {
  const key = templateExemptionKey('/Pages/ThemeEditor', 'The three presets', 'functionScript');
  const row = rows.find((r) => templateExemptionKey(r.component, r.label, r.port) === key);
  if (!row) return [];
  return String(row.value).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
}

/** The same list, derived from the single source rather than from the artefact. */
export function presetHexesInSource(): string[] {
  return JSON.stringify(SITE_THEME_PRESETS).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
}

/** Every measurement in the artefact that is not a token. */
export function rawDimensionsInArtefact(rows: ParamRow[]): string[] {
  const found: string[] = [];
  for (const row of rows) {
    if (!STYLE_VALUE_PORT.test(row.port)) continue;
    const isUnitObject = typeof row.value === 'object' && row.value !== null && 'value' in (row.value as object);
    if (typeof row.value === 'number' || isUnitObject) {
      found.push(templateExemptionKey(row.component, row.label, row.port));
    }
  }
  return found.sort();
}

// ── The token universe, and what consumes it ─────────────────────────────────

/**
 * Every custom-property name a site-builder component may name.
 *
 * Three sources, and all three are needed:
 *
 *  - `DEFAULT_TOKENS` — the 182 the product gives every project;
 *  - `buildSiteDesignTokens()` — the template's own `designTokens` block, which
 *    overrides eighteen of those and **mints** `--site-measure`;
 *  - `THEME_TOKEN_FIELDS` — the twelve a `Theme` record writes at run time.
 *
 * ⚠️ The third overlaps the first two entirely today, and is still read rather
 * than assumed redundant: a field added to the theme contract that does not also
 * appear in the token block would be a name components may legitimately consume
 * and this set would otherwise refuse it.
 */
export function tokenUniverse(): Set<string> {
  const names = new Set<string>();
  for (const token of DEFAULT_TOKENS) names.add(token.name);
  for (const token of buildSiteDesignTokens().customTokens ?? []) names.add(token.name);
  for (const name of Object.values(THEME_TOKEN_FIELDS)) names.add(name);
  return names;
}

/** Every `--x` named inside a `var(...)` in the given text. */
export function tokensUsedIn(text: string): Set<string> {
  const used = new Set<string>();
  for (const match of text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) used.add(match[1]);
  return used;
}

/** The consumed names that resolve nowhere — a declaration the browser drops. */
export function unresolvedTokens(text: string, universe = tokenUniverse()): string[] {
  return [...tokensUsedIn(text)].filter((name) => !universe.has(name)).sort();
}

// ── The exemption list, widened to the whole template ────────────────────────

/**
 * 🔴 Keyed by **component** as well as label, unlike {@link exemptionKey}.
 *
 * SB-006's four exemptions live in one component set where `label` alone is
 * unique. The template has **five** components carrying a node labelled
 * `Heading`, and exactly one of them sets a raw width — so a label-only key
 * would exempt a raw dimension on four nodes nobody looked at. Component names
 * are the one identity the door does *not* reallocate.
 */
export const templateExemptionKey = (component: string, label: string, port: string): string =>
  `${component} | ${label} | ${port}`;

export interface TemplateExemption {
  component: string;
  label: string;
  port: string;
  why: string;
}

/**
 * The reason SB-006 already wrote for one of its four, fetched by key rather
 * than retyped. A second copy of a rationale drifts exactly like a second copy
 * of a palette, and this one has a gate on it either way.
 */
function sb006Why(label: string, port: string): string {
  const found = RAW_DIMENSION_EXEMPTIONS.find((e) => exemptionKey(e.label, e.port) === exemptionKey(label, port));
  if (!found) {
    throw new Error(
      `SBR-012: no SB-006 exemption named "${exemptionKey(label, port)}". ` +
        'The template-wide list is derived from RAW_DIMENSION_EXEMPTIONS, so a rename there must be ' +
        'followed here rather than silently producing an entry with no reason.'
    );
  }
  return found.why;
}

/**
 * SBR-012 AC3 — every dimension in the shipped template that is NOT a token,
 * each with the reason it cannot be one.
 *
 * An **exemption list, not a relaxation**: the gate asserts this equals what is
 * actually on disk, so adding a raw dimension reds until someone writes down
 * why, and *removing* one reds until the entry goes too. Both directions matter
 * — an exemption that matches nothing reads exactly like a raw value that was
 * never introduced.
 *
 * 🔴 Colour, radius, gap, face and font size have **no** entries and must not
 * gain any: the vocabulary covers all five, so a raw one there is a defect
 * rather than a gap.
 */
export const TEMPLATE_DIMENSION_EXEMPTIONS: ReadonlyArray<TemplateExemption> = [
  {
    component: '/App',
    label: 'App',
    port: 'width',
    why: 'The app root is the window. 100% is not a measurement anyone could tokenise — it is the statement that there is nothing outside this box, and an unstated size here means "contentSize", which collapses every page to its text.'
  },
  {
    component: '/App',
    label: 'App',
    port: 'height',
    why: 'Same box, other axis, and the axis that matters more: without it a short page leaves the ground colour ending partway down the viewport, which is the exact artefact SBR-004 set out to remove.'
  },
  {
    component: '/Admin/Shell',
    label: 'Sidebar',
    port: 'width',
    why: 'A fixed rail has no token because the vocabulary is the SITE\'s contract — a client themes their public site, not the admin chrome they were handed. An unstated width is 100% along the frame\'s row, which Layout.size turns into a sidebar eating half the screen.'
  },
  {
    component: '/Admin/NewPageDialog',
    label: 'Dialog card',
    port: 'width',
    why: 'Raw for the same reason as the rail: the token contract is the client\'s site theme, and a dialog in the admin panel is not part of it. 420px is a form measure, and --site-measure is the READING measure — a different quantity that happens to be a length.'
  },
  {
    component: '/Pages/PageEditor',
    label: 'Heading',
    port: 'width',
    why: 'A 60% column split in an editing screen is a proportion of the pane, not a distance. The vocabulary has no ratios, and inventing --editor-heading-width would be a token with exactly one consumer, which is a literal with extra indirection.'
  },
  // SBR-005: the one-node section view is five components now, and its 320px
  // image band went with it. The crop that remains is the gallery tile's.
  {
    component: '/Site/GalleryTile',
    label: 'Gallery tile',
    port: 'height',
    why: sb006Why('Gallery tile', 'height')
  },
  {
    component: '/Site/GalleryTile',
    label: 'Gallery tile',
    port: 'width',
    why: sb006Why('Gallery tile', 'width')
  },
  {
    component: '/Pages/Site',
    label: 'Page ground',
    port: 'minHeight',
    why: sb006Why('Page ground', 'minHeight')
  },
  // REL-011c / §3 seam 3, 2026-09-05. The same statement `/Pages/Site`'s ground
  // makes one row above, on the admin half — which had gone without it since the
  // panel was built, leaving ~640px of unpainted `<body>` under every admin
  // screen short enough to fit. See the note on `Admin frame`.
  {
    component: '/Admin/Shell',
    label: 'Admin frame',
    port: 'minHeight',
    why: 'A viewport relation, and the vocabulary is deliberately viewport-free — the identical reason /Pages/Site states it. `flexGrow` grows a box inside its parent and the chain from /App through the Page hands no height down, so "the shell IS the admin page ground" (ADMIN_FILL_EXEMPTIONS) is only true once this is stated out loud.'
  },
  {
    component: '/Pages/Site',
    label: 'Page shell',
    port: 'width',
    why: sb006Why('Page shell', 'width')
  },
  // REL-011c A2. The section card's picture used to state no size at all and
  // took its SOURCE's intrinsic width, which is what made the page editor
  // 1216px wide at every viewport — see the note on the node.
  {
    component: '/Admin/SectionRow',
    label: 'Image preview',
    port: 'width',
    why: 'The crop fills the card it sits in, and 100% of a card is a layout instruction rather than a distance — the same statement /Site/GalleryTile makes, and the one quantity the token vocabulary deliberately has no name for.'
  },
  {
    component: '/Admin/SectionRow',
    label: 'Image preview',
    port: 'height',
    why: 'A crop band, so that four section cards holding four differently shaped photographs read as four cards rather than four page lengths. It is a picture box, not spacing, so the spacing scale is the wrong vocabulary for it — exactly the argument /Site/GalleryTile\'s 180px carries.'
  }
];
