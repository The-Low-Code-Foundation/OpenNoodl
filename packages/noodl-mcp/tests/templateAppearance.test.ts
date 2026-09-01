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

/**
 * 🔴 **DEF-030 (P77 D16). The rule this replaced, kept because a control needs
 * it.** It asked whether the page's whole REACHABLE tree — every component the
 * page places, transitively — sets a structural parameter. So a page passed by
 * *placing* something styled, and a page that places the admin shell passes
 * whatever it does itself.
 *
 * **Sabotage at HEAD**: strip every structural parameter from `/Pages/PageEditor`'s
 * own nodes and this still returns `[]`. The check could not fail.
 */
function barePagesByPlacement(t: CensusTemplate): string[] {
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

/**
 * Pages whose OWN tree sets not one structural parameter.
 *
 * The question §4 is meant to ask is whether *this screen* was designed, and
 * placing a designed component is not an answer to it — every admin page places
 * the same shell, so under the old rule the shell answered for all of them at
 * once. A page's own nodes are the part its author wrote.
 *
 * ⚠️ It is not a claim that a page must repaint what it places. `STRUCTURE_PARAMS`
 * is deliberately narrow — no padding, no gaps, no `flexDirection`, because the
 * artefact that provoked this file set 125 of those and was still one column.
 * A page that places a shell and sets a `maxWidth`, a `fontSize` or a surface on
 * anything of its own passes.
 */
function barePages(t: CensusTemplate): string[] {
  return pageComponents(t)
    .filter((page) => !page.nodes.some((n) => Object.keys(n.parameters).some((p) => STRUCTURE_PARAMS.has(p))))
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
  // 11 → 13: TPL-002's `/Pages/Account` and `/Pages/Unsubscribe`. The pin did
  // what it is for again — both pages then had to answer §4, and both do: they
  // are built from `PAGE_GROUND`, `PANEL`, `notice` and `pageHead`, which is the
  // same token vocabulary the other eleven wear.
  'members-area': 13
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
  // 🔴 **Was `['/Home']`, and that entry never matched anything.** The page's
  // legacy name is `/#__page__/Home`, so the allowance was for a page that does
  // not exist under that spelling — and the real one sets a `fontSize`, so it
  // was never bare either. Two ways for the same row to be vacuous.
  'hello-world': [],
  // 🔴 **`/Pages/ThemeEditor` was real debt and SBR-009 PAID it — the row is
  // deleted rather than ticked.** DEF-030's stricter rule surfaced it: the page's
  // own tree set not one structural parameter, because everything that painted
  // the screen belonged to `/Admin/Shell`, which the page merely placed. The
  // theme editor now owns three cards, a presets row and a live preview panel,
  // all of it structure it authors itself.
  // ⚠️ The floor asserts EQUALITY, so a row left here after the repair would red
  // exactly as loudly as a new bare page — which is the whole point of a ratchet,
  // and the reason this entry is gone rather than commented out.
  'site-builder': [],
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
    // 🔴 EQUALITY, not a subset and not a count. The old pair of arms let the
    // floor go stale GENEROUS — which is the failure mode this file already
    // names one screen up, and which it then had: `hello-world`'s allowance was
    // for `/Home`, a name no page in that template carries. A floor that lists
    // a page which is not bare is an allowance nobody can spend and nobody
    // notices. Fixing a page now reddens this arm, and shrinking the floor in
    // the same commit is the point of a ratchet.
    it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s: exactly the pages on the floor are bare', (id, t) => {
      expect(barePages(t)).toEqual([...BARE_PAGES_TODAY[id]].sort());
    });

    it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s: every floor entry names a real page', (id, t) => {
      const names = pageComponents(t).map((c) => c.legacyName);
      expect(BARE_PAGES_TODAY[id].filter((p) => !names.includes(p))).toEqual([]);
    });

    /** One page of one template, with every structural parameter of its OWN tree removed. */
    const stripOwnStructure = (templateId: string, legacyName: string): CensusTemplate => {
      const sabotaged = JSON.parse(JSON.stringify(TEMPLATES.find((t) => t.id === templateId))) as CensusTemplate;
      const page = sabotaged.components.find((c) => c.legacyName === legacyName)!;
      for (const node of page.nodes) {
        for (const key of Object.keys(node.parameters)) if (STRUCTURE_PARAMS.has(key)) delete node.parameters[key];
      }
      return sabotaged;
    };

    it('MUTANT: a page stripped of its own structure reds — and did NOT before', () => {
      const sabotaged = stripOwnStructure('site-builder', '/Pages/PageEditor');

      // 🔴 The two halves together are the defect. The rule that shipped calls
      // the sabotaged page designed, because it still PLACES `/Admin/Shell`;
      // the rule that replaced it names the page. Asserting only the second
      // would prove the new rule works without showing what was wrong.
      expect(barePagesByPlacement(sabotaged)).toEqual([]);
      expect(barePages(sabotaged)).toContain('/Pages/PageEditor');
    });

    it('CONTROL: the placement rule finds NOTHING anywhere, which is why it read green', () => {
      // Not one page in any shipped template is bare by the old rule — so §4's
      // census was an empty set compared against its floor, in all three.
      for (const t of TEMPLATES) expect(barePagesByPlacement(t)).toEqual([]);

      // 🔴 **The positive is CONSTRUCTED now, and that is a fact about the corpus
      // rather than about the rule.** This arm used to point at the real
      // `/Pages/ThemeEditor`, which was the last shipped page bare by the strict
      // rule; SBR-009 paid it, every floor is `[]`, and there is no live example
      // left. A control that kept naming the page that was FIXED would have gone
      // red on the repair — and the cheapest way to make it green again would
      // have been to put the debt back.
      expect(Object.values(BARE_PAGES_TODAY).flat()).toEqual([]);

      const sabotaged = stripOwnStructure('site-builder', '/Pages/ThemeEditor');
      // The pair, on the same page, in the same run: the rule that shipped still
      // calls it designed because it PLACES `/Admin/Shell`; the rule that
      // replaced it names it.
      expect(barePagesByPlacement(sabotaged)).toEqual([]);
      expect(barePages(sabotaged)).toEqual(['/Pages/ThemeEditor']);
    });
  });
});
