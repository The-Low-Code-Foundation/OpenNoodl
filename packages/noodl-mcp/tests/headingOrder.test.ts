/**
 * **Heading LEVELS, in order, on every page of both shipped templates.**
 *
 * REL-011 §5 item 2 and §6 item 3 registered this residual twice with owner
 * `NONE`: *"`<h2>` order is unchecked in both templates. Every section kind
 * carries one, but nothing asserts that a page's headings descend without
 * skipping a level."* The two censuses that exist count `as` tags and assert one
 * `h1` inside one `<main>`; **a count has no order**, so `h1` followed by `h3` is
 * invisible to both.
 *
 * ## 🔴 This gate is GREEN AT HEAD, and that is stated rather than discovered
 *
 * Measured before a line of it was written, over both artefacts: **20 pages, 0
 * skipped levels, every page opening at `h1`.** So this is not a fix wearing a
 * spec — it is a checker over the corpus that exists, and the corpus passes.
 *
 * A gate that has never been red is a gate nobody has read the failure of, so
 * two things stand in for the red arm that history did not provide:
 *
 * - `headingOrderFault` is graded on **synthetic sequences** — the skip, the
 *   page that opens at `h2`, and the ascent that must stay legal — so the
 *   detector is proved to fire before it is pointed at anything;
 * - the template blocks assert **cardinality** as well as absence.
 *   🔴 `/Pages/Site`'s own tree holds **one** heading; the other five arrive
 *   through a `For Each`'s `template` parameter. A walker that missed that edge
 *   would report a lone `h1` and call it well-formed — *the answer this gate
 *   wants, arrived at by seeing nothing.*
 *
 * ⚠️ **Authored, not rendered.** `documentOutline.ts` is the browser half and
 * needs a drive. This reads the artefacts a person is shipped.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describeSequence, headingOrderFault, headingSequence, HeadingRef, OutlineNode, OutlineSource } from './headingOrder';

jest.setTimeout(60000);

// ── The instrument, graded on sequences nobody shipped ────────────────────────

const at = (level: number, id = `n${level}`): HeadingRef => ({
  level,
  tag: `h${level}`,
  id,
  component: '/Probe'
});

describe('headingOrder — the fault detector, before it is pointed at a template', () => {
  it('passes a well-formed descent', () => {
    expect(headingOrderFault([at(1), at(2), at(3)])).toBeNull();
  });

  it('🔴 catches a skipped level, and names both ends of the step', () => {
    const fault = headingOrderFault([at(1), at(3, 'claimsASectionThatDoesNotExist')]);
    expect(fault).toContain('skipped level');
    expect(fault).toContain('claimsASectionThatDoesNotExist');
  });

  it('🔴 catches a page that opens below h1', () => {
    expect(headingOrderFault([at(2), at(3)])).toContain('not <h1>');
  });

  it('⚠️ CONTROL — climbing back up is a second section, not a fault', () => {
    // h1 h2 h3 h2 h3 is what two sections with subsections looks like. A rule
    // that forbade the ascent would redden most pages in both templates.
    expect(headingOrderFault([at(1), at(2), at(3), at(2), at(3)])).toBeNull();
  });

  it('⚠️ CONTROL — an empty sequence is not a fault, so a caller must count as well', () => {
    // This is the pass that means nothing, kept explicit so the template blocks
    // below are obliged to assert cardinality beside their absence.
    expect(headingOrderFault([])).toBeNull();
  });
});

// ── Adapter 1: the site builder, one content.json ─────────────────────────────

const SITE_BUILDER = path.join(
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

function siteBuilderSource(): OutlineSource {
  const content = JSON.parse(fs.readFileSync(SITE_BUILDER, 'utf-8')) as {
    components: Array<{ name: string; graph: { roots: OutlineNode[] } }>;
  };
  const byName = new Map(content.components.map((c) => [c.name, c.graph.roots ?? []]));
  return {
    names: () => [...byName.keys()],
    rootsOf: (name) => byName.get(name) ?? []
  };
}

// ── Adapter 2: the members' area, a directory of nodes.json ───────────────────

const MEMBERS_AREA = path.join(__dirname, '..', '..', '..', 'templates', 'members-area', 'components');

/** The stored shape: a flat node list whose `children` are ids. */
interface StoredNode {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
  children?: string[];
}

function membersAreaSource(): OutlineSource {
  const byName = new Map<string, OutlineNode[]>();

  const read = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) read(full);
      else if (entry.name !== 'nodes.json') continue;
      else {
        const doc = JSON.parse(fs.readFileSync(full, 'utf-8')) as { nodes: StoredNode[]; visualRoots?: string[] };
        const stored = new Map(doc.nodes.map((n) => [n.id, n]));

        // The children are ids; nest them so one traversal serves both shapes.
        const nest = (node: StoredNode, seen: ReadonlySet<string>): OutlineNode => ({
          id: node.id,
          type: node.type,
          parameters: node.parameters,
          children: (node.children ?? [])
            .filter((id) => stored.has(id) && !seen.has(id))
            .map((id) => nest(stored.get(id) as StoredNode, new Set([...seen, id])))
        });

        const referenced = new Set(doc.nodes.flatMap((n) => n.children ?? []));
        const rootIds = doc.visualRoots?.length ? doc.visualRoots : doc.nodes.filter((n) => !referenced.has(n.id)).map((n) => n.id);

        const name = '/' + path.relative(MEMBERS_AREA, path.dirname(full));
        byName.set(
          name,
          rootIds.filter((id) => stored.has(id)).map((id) => nest(stored.get(id) as StoredNode, new Set([id])))
        );
      }
    }
  };
  read(MEMBERS_AREA);

  return {
    names: () => [...byName.keys()],
    rootsOf: (name) => byName.get(name) ?? []
  };
}

// ── The two templates ─────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 'site-builder', source: siteBuilderSource, pages: 7 },
  { id: 'members-area', source: membersAreaSource, pages: 13 }
] as const;

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('%s — every page descends without skipping', (_id, template) => {
  const source = template.source();
  const pages = source.names().filter((n) => n.startsWith('/Pages/')).sort();

  it('the population is real — every page component the template ships', () => {
    // 🔴 The control for the whole block. If the adapter found no pages, every
    // assertion below would pass by having nothing to say.
    expect(pages).toHaveLength(template.pages);
  });

  it.each(pages.map((p) => [p] as const))('%s', (page) => {
    const sequence = headingSequence(source, page);
    const fault = headingOrderFault(sequence);
    expect(`${page}: ${describeSequence(sequence)} — ${fault ?? 'ok'}`).toBe(`${page}: ${describeSequence(sequence)} — ok`);
  });
});

describe('🔴 the walk reaches headings the page does not hold', () => {
  it("/Pages/Site's own tree holds ONE heading — the other five are behind a For Each", () => {
    const source = siteBuilderSource();

    // The page's own subtree, following children and nothing else: what a
    // walker without the two component edges would see.
    let ownHeadings = 0;
    const walk = (node: OutlineNode): void => {
      const tag = node.parameters?.as;
      if (typeof tag === 'string' && /^h[1-6]$/.test(tag)) ownHeadings++;
      for (const child of node.children ?? []) walk(child);
    };
    for (const root of source.rootsOf('/Pages/Site')) walk(root);

    expect(ownHeadings).toBe(1);
    expect(headingSequence(source, '/Pages/Site')).toHaveLength(6);
  });

  it('and they come from more than one component, so the sequence is a real ordering', () => {
    const sequence = headingSequence(siteBuilderSource(), '/Pages/Site');
    expect(new Set(sequence.map((h) => h.component)).size).toBeGreaterThan(1);
    expect(describeSequence(sequence)).toBe('h1 h2 h2 h2 h2 h2');
  });
});
