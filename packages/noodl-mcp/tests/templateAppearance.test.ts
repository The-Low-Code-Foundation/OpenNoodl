/**
 * Phase 78 — the appearance ratchet.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Why this file exists
 *
 * Richard drove TPL-001 by hand on 2026-08-28 and the verdict was one sentence:
 * *"it's so basic, black and white, everything left aligned in one column, it
 * doesn't even look like a website."* Forty-one byte-identity specs, forty-five
 * drive specs and two typechecks were green over that artefact. Not one of them
 * could see it.
 *
 * 🔴 **A gate cannot judge beauty.** It can judge the absence that produced this
 * one, and the absence is stark and countable: **zero colour parameters, zero
 * type-ramp parameters, zero constrained widths, no token block at all.** Those
 * are not aesthetic opinions, they are a template that never opened the design
 * system the product ships.
 *
 * ## The control pair, measured before this file was written
 *
 * The two shipped templates disagree on every check here, which is the only
 * reason to believe the checks measure anything (a gate that reddens on
 * everything and a gate that reddens on nothing are the same instrument):
 *
 * | | members-area (before) | site-builder |
 * |---|---|---|
 * | design-token block | **absent** | 19 tokens |
 * | colour parameters | **0** | 16 |
 * | type-ramp parameters | **0** | 19 |
 * | `maxWidth` | **0** | 1 |
 * | pages with any structure | **0 of 11** | 1 of 5 |
 *
 * ⚠️ **And it found something the brief had wrong.** The session prompt recorded
 * both templates as equally unstyled; they are not. site-builder's *public site*
 * is designed — tokens, cards, hairlines, a centred measure. Its **four admin
 * pages are as bare as the members' area**, and an author lives in the admin
 * panel. That is why §4's census is a ratchet over a recorded floor rather than
 * a pass/fail: the debt is real, it is not this task's to pay, and hiding it
 * behind an exclusion list would make it invisible instead of pending.
 *
 * ## What is deliberately NOT graded, and how the boundary is pinned
 *
 * `hello-world` is one page and its product *is* emptiness — it is the blank
 * canvas, and a palette forced onto it would be a worse starter. So the
 * assertions apply to templates that ship **more than one page**. That is a
 * measured trigger, not a name on a list: §1 pins every template's page count,
 * so a hello-world that grows a second page joins the population and reddens
 * rather than slipping through a category check.
 */
import * as fs from 'fs';
import * as path from 'path';

import { helloWorldTemplate } from '../../noodl-editor/src/editor/src/models/template/templates/hello-world.template';
import { siteBuilderTemplate } from '../../noodl-editor/src/editor/src/models/template/templates/site-builder.template';

// ── The two shapes a template ships in ───────────────────────────────────────

interface CensusNode {
  type: string;
  parameters: Record<string, unknown>;
}
interface CensusComponent {
  /** Legacy name — what an instance of this component uses as its node type. */
  legacyName: string;
  nodes: CensusNode[];
}
interface CensusTemplate {
  id: string;
  components: CensusComponent[];
  colourTokenCount: number;
}

const REPO = path.join(__dirname, '..', '..', '..');

/**
 * An embedded template: `content.components[].graph.roots[]`, children nested.
 *
 * ⚠️ Read from the `ProjectTemplate` object rather than from
 * `site-builder.content.json`, because the token block is NOT in that file — it
 * is `buildSiteDesignTokens()` on the template, written into project metadata by
 * `EmbeddedTemplateProvider.install`. Reading the JSON alone would report every
 * embedded template as having no tokens, which is the wrong answer arrived at
 * by looking in the wrong place.
 */
function censusEmbedded(template: {
  id: string;
  content: unknown;
  designTokens?: { customTokens?: Array<{ name: string; category?: string }> };
}): CensusTemplate {
  const content = template.content as { components?: Array<{ name: string; graph?: { roots?: unknown[] } }> };
  const components: CensusComponent[] = (content.components ?? []).map((c) => {
    const nodes: CensusNode[] = [];
    const walk = (n: Record<string, unknown>) => {
      nodes.push({ type: String(n.type ?? ''), parameters: (n.parameters as Record<string, unknown>) ?? {} });
      for (const child of ((n.children as Record<string, unknown>[]) ?? [])) walk(child);
    };
    for (const root of (c.graph?.roots ?? []) as Record<string, unknown>[]) walk(root);
    // Embedded component names are already in legacy form ("/Pages/Site").
    return { legacyName: c.name.startsWith('/') ? c.name : `/${c.name}`, nodes };
  });
  const custom = template.designTokens?.customTokens ?? [];
  return { id: template.id, components, colourTokenCount: custom.filter((t) => isColourToken(t)).length };
}

/**
 * An on-disk v2 artefact: `templates/<id>/components/**\/nodes.json`, flat node
 * lists with `parent`/`children` by id, plus one `nodegx.project.json`.
 */
function censusArtefact(id: string): CensusTemplate {
  const dir = path.join(REPO, 'templates', id);
  const componentsDir = path.join(dir, 'components');
  const components: CensusComponent[] = [];

  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name === 'nodes.json') {
        const stored = JSON.parse(fs.readFileSync(full, 'utf8')) as {
          nodes?: Array<{ type?: string; parameters?: Record<string, unknown> }>;
        };
        const rel = path.relative(componentsDir, current).split(path.sep).join('/');
        components.push({
          legacyName: `/${rel}`,
          nodes: (stored.nodes ?? []).map((n) => ({ type: String(n.type ?? ''), parameters: n.parameters ?? {} }))
        });
      }
    }
  };
  visit(componentsDir);

  const project = JSON.parse(fs.readFileSync(path.join(dir, 'nodegx.project.json'), 'utf8')) as {
    metadata?: { designTokens?: { customTokens?: Array<{ name: string; category?: string }> } };
  };
  const custom = project.metadata?.designTokens?.customTokens ?? [];
  return { id, components, colourTokenCount: custom.filter((t) => isColourToken(t)).length };
}

/**
 * A colour token by CATEGORY where the record carries one, falling back to the
 * name. ⚠️ The fallback matters: `--primary`, `--foreground` and `--border` do
 * not contain the word "colour", so a name-only test would count zero of the
 * eight semantic colours the Studio block actually ships.
 */
function isColourToken(token: { name: string; category?: string }): boolean {
  if (token.category) return token.category.startsWith('color');
  return /^--(primary|secondary|background|foreground|surface|border|muted|accent|destructive|ring)/.test(token.name);
}

// ── What counts as having been designed ──────────────────────────────────────

/** Any parameter that paints. `fill` is the Circle/Icon spelling. */
const COLOUR_PARAMS = (name: string) => name === 'color' || name === 'fill' || /Color$/.test(name);

/** The type ramp — a size or a face, not an alignment. */
const TYPE_PARAMS = new Set(['fontSize', 'fontFamily', 'lineHeight', 'letterSpacing']);

/**
 * Structure: the parameters that make a page read as parts rather than as a
 * scroll. A page whose whole tree sets none of these is the defect Richard named
 * — "everything left aligned in one column".
 *
 * 🔴 Padding, gaps and `flexDirection` are deliberately NOT here. The members'
 * area set 125 style parameters and every one of them was layout plumbing of
 * exactly that kind; a check that counted them would have been green on the
 * artefact that provoked this file. `rowGap` is excluded by the same reasoning
 * that excludes padding — it spaces siblings, it does not give a page parts —
 * and including it moved two of site-builder's admin pages from bare to passing
 * without anything about them having been designed.
 */
const STRUCTURE_PARAMS = new Set([
  'maxWidth',
  'backgroundColor',
  'borderRadius',
  'borderWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'fontSize',
  'boxShadow'
]);

const RAW_COLOUR = /^\s*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/;

function allNodes(t: CensusTemplate): CensusNode[] {
  return t.components.flatMap((c) => c.nodes);
}

function countParams(t: CensusTemplate, predicate: (name: string) => boolean): number {
  return allNodes(t).reduce((n, node) => n + Object.keys(node.parameters).filter(predicate).length, 0);
}

/** Component legacy names reachable from `start` by instance placement. */
function reachable(t: CensusTemplate, start: string): Set<string> {
  const byName = new Map(t.components.map((c) => [c.legacyName, c]));
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const name = stack.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const node of byName.get(name)?.nodes ?? []) {
      if (byName.has(node.type) && !seen.has(node.type)) stack.push(node.type);
    }
  }
  return seen;
}

function pageComponents(t: CensusTemplate): CensusComponent[] {
  return t.components.filter((c) => c.nodes.some((n) => n.type === 'Page'));
}

/** Pages whose whole reachable tree sets not one structural parameter. */
function barePages(t: CensusTemplate): string[] {
  const byName = new Map(t.components.map((c) => [c.legacyName, c]));
  return pageComponents(t)
    .filter((page) => {
      for (const name of reachable(t, page.legacyName)) {
        for (const node of byName.get(name)?.nodes ?? []) {
          if (Object.keys(node.parameters).some((p) => STRUCTURE_PARAMS.has(p))) return false;
        }
      }
      return true;
    })
    .map((c) => c.legacyName)
    .sort();
}

// ── The population ───────────────────────────────────────────────────────────

const TEMPLATES: CensusTemplate[] = [
  censusEmbedded(helloWorldTemplate as never),
  censusEmbedded(siteBuilderTemplate as never),
  censusArtefact('members-area')
];

/**
 * Pages per template, pinned. This is what keeps §2–§4's "more than one page"
 * trigger from being an exclusion list: a template that grows past one page
 * reddens HERE first, and then has to answer the rest.
 */
const EXPECTED_PAGE_COUNT: Record<string, number> = {
  'hello-world': 1,
  // 5 → 6: SBR-017's `/Pages/SignIn`. The pin did exactly what it is for — it
  // reddened when the template grew a page, and the page then had to answer §4
  // below. It answers it by NOT being bare: the sign-in screen carries the
  // template's own tokens, so the floor set does not grow with it.
  'site-builder': 6,
  'members-area': 11
};

/**
 * §4's floor — the pages that are bare today, BY NAME, and the set may only
 * shrink. Names rather than a count, because a count alone lets one page be
 * fixed and another go bare with the gate none the wiser.
 *
 * 🔴 site-builder's four admin pages are real debt, not a carve-out. They are
 * listed so the allowance has a reason attached and paying it is a visible
 * pending job rather than a silent exemption. Phase 76/77 own that template.
 *
 * `hello-world`'s single page is the blank canvas and is meant to be bare; it is
 * here because §1 pins its page count, so it cannot quietly become an app.
 */
const BARE_PAGES_TODAY: Record<string, string[]> = {
  'hello-world': ['/Home'],
  'site-builder': ['/Pages/Admin', '/Pages/PageEditor', '/Pages/Setup', '/Pages/ThemeEditor'],
  'members-area': []
};

const multiPage = () => TEMPLATES.filter((t) => pageComponents(t).length > 1);

describe('template appearance ratchet', () => {
  // ── §1 the population, pinned ──────────────────────────────────────────────
  describe('§1 the population', () => {
    it('grades every shipped template', () => {
      expect(TEMPLATES.map((t) => t.id).sort()).toEqual(['hello-world', 'members-area', 'site-builder']);
    });

    it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s has the pinned page count', (id, t) => {
      expect(pageComponents(t).length).toBe(EXPECTED_PAGE_COUNT[id]);
    });

    it('the multi-page population is the two app templates', () => {
      expect(multiPage().map((t) => t.id).sort()).toEqual(['members-area', 'site-builder']);
    });
  });

  // ── §2 the token block ─────────────────────────────────────────────────────
  describe('§2 a look the recipient can open and change', () => {
    it.each(multiPage().map((t) => [t.id, t] as const))(
      '%s ships design tokens including semantic colours',
      (_id, t) => {
        expect(t.colourTokenCount).toBeGreaterThan(0);
      }
    );
  });

  // ── §3 the design system is actually referenced ────────────────────────────
  describe('§3 the nodes reference it', () => {
    it.each(multiPage().map((t) => [t.id, t] as const))('%s sets colour parameters', (_id, t) => {
      expect(countParams(t, COLOUR_PARAMS)).toBeGreaterThan(0);
    });

    it.each(multiPage().map((t) => [t.id, t] as const))('%s sets type-ramp parameters', (_id, t) => {
      expect(countParams(t, (n) => TYPE_PARAMS.has(n))).toBeGreaterThan(0);
    });

    it.each(multiPage().map((t) => [t.id, t] as const))('%s constrains a width somewhere', (_id, t) => {
      expect(countParams(t, (n) => n === 'maxWidth')).toBeGreaterThan(0);
    });

    /**
     * 🔴 Applies to EVERY template, one page or eleven. A raw hex in a node
     * parameter is a value the style panel cannot reach and the deploy's `:root`
     * stamp cannot re-theme — the token block becomes decoration.
     */
    it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s uses tokens, never raw colour literals', (_id, t) => {
      const offenders = allNodes(t).flatMap((node) =>
        Object.entries(node.parameters)
          .filter(([name, value]) => COLOUR_PARAMS(name) && typeof value === 'string' && RAW_COLOUR.test(value))
          .map(([name, value]) => `${node.type}.${name} = ${String(value)}`)
      );
      expect(offenders).toEqual([]);
    });
  });

  // ── §4 the ratchet ─────────────────────────────────────────────────────────
  describe('§4 no page is an unstyled column', () => {
    it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s adds no newly bare page', (id, t) => {
      // The names are in the failure message on purpose: a count tells whoever
      // reddened this nothing about which screen to go and look at.
      expect(barePages(t).filter((p) => !BARE_PAGES_TODAY[id].includes(p))).toEqual([]);
    });

    it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s never grows its bare-page count', (id, t) => {
      expect(barePages(t).length).toBeLessThanOrEqual(BARE_PAGES_TODAY[id].length);
    });
  });
});
