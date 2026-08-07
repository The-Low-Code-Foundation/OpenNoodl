/**
 * ALPHA-006 §1 — node help off the network.
 *
 * The acceptance criterion this grades is #2: *the node help panel renders for
 * all 156 nodes, including the 54 that have no page today, with the editor
 * offline.* The catalog ships 153 node types (the "156" in the spec predates
 * three merges), and the whole point of the rewrite is that the answer no longer
 * depends on a network, so it can be asserted here rather than by opening the
 * editor twice.
 *
 * These run in plain Node with no renderer, which is itself part of the claim:
 * the old path could not have been tested this way at all.
 */

import {
  formatInline,
  getNodeDocs,
  getNodeSummary,
  getPortDoc,
  getPortDocs,
  nodeDocsPath
} from '../../src/editor/src/utils/nodeDocs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const catalog = require('../../../noodl-types/src/node-catalog-enriched.json') as {
  nodes: Array<{ typeName: string; docs?: string; isDeprecated?: boolean; enrichment?: unknown }>;
};

describe('ALPHA-006 §1 — node docs from the bundled catalog', () => {
  describe('coverage', () => {
    it('documents every node type in the catalog', () => {
      const undocumented = catalog.nodes.filter((node) => !getNodeDocs(node.typeName));
      expect(undocumented.map((n) => n.typeName)).toEqual([]);
    });

    it('gives every node non-empty help HTML', () => {
      const empty = catalog.nodes.filter((node) => {
        const docs = getNodeDocs(node.typeName);
        return !docs || docs.html.trim().length === 0;
      });
      expect(empty.map((n) => n.typeName)).toEqual([]);
    });

    it('covers the nodes the docs site never had a page for', () => {
      // Finding 1's "no `docs` URL at all" bucket — the ones whose help panel
      // could not have rendered anything before, at any network speed.
      const withoutPage = catalog.nodes.filter((node) => !node.docs);
      expect(withoutPage.length).toBeGreaterThan(0);

      for (const node of withoutPage) {
        const docs = getNodeDocs(node.typeName);
        expect(docs).toBeDefined();
        expect(docs.summary.length).toBeGreaterThan(0);
        // No page means no "read more", and the callers gate the link on it.
        expect(docs.path).toBe('');
      }
    });

    it('gives every node a one-line summary', () => {
      for (const node of catalog.nodes) {
        expect(getNodeSummary(node.typeName)).not.toBe('');
      }
    });
  });

  describe('lookups that should miss', () => {
    it('returns undefined for a type the catalog does not know', () => {
      // Local components and prefab-provided nodes are not in the catalog; a
      // miss must be a miss, not a stale neighbouring page.
      expect(getNodeDocs('/App/SomeUserComponent')).toBeUndefined();
      expect(getNodeDocs(undefined)).toBeUndefined();
      expect(getNodeSummary('nope')).toBe('');
      expect(getPortDocs(undefined)).toEqual({ inputs: {}, outputs: {} });
    });
  });

  describe('the "read more" path', () => {
    it('is site-relative, so the origin stays the caller`s decision', () => {
      const path = nodeDocsPath('Group');
      expect(path.startsWith('/')).toBe(true);
      expect(path).not.toContain('http');
    });

    it('never leaks the legacy host into a path', () => {
      for (const node of catalog.nodes) {
        expect(nodeDocsPath(node.typeName)).not.toContain('noodl.net');
      }
    });

    it('strips the fetch protocol`s markdown suffixes and hash routes', () => {
      // Those suffixes addressed the raw source the old parser fetched; a
      // person following the link wants the page.
      for (const node of catalog.nodes) {
        const path = nodeDocsPath(node.typeName);
        expect(path.endsWith('.md')).toBe(false);
        expect(path.startsWith('/#/')).toBe(false);
      }
    });
  });

  describe('port help', () => {
    it('keys ports by canonical name, not display name', () => {
      const docs = getPortDocs('Group');
      // `visible` is the universal visual port; its display name is "Visible".
      expect(docs.inputs['visible']).toBeDefined();
      expect(docs.inputs['Visible']).toBeUndefined();
    });

    it('documents output ports, which the old marker protocol often did not', () => {
      const documented = catalog.nodes.filter((node) => Object.keys(getPortDocs(node.typeName).outputs).length > 0);
      expect(documented.length).toBeGreaterThan(100);
    });

    it('returns an empty string rather than an empty tooltip for an unknown port', () => {
      expect(getPortDoc('Group', 'input', 'thisPortDoesNotExist')).toBe('');
      expect(getPortDoc('Group', 'output', 'thisPortDoesNotExist')).toBe('');
    });

    it('does not render the same sentence twice when both channels agree', () => {
      // The enrichment may only *add* what the port declaration cannot know
      // (PORT-DESCRIPTION-STYLE.md); where it merely restates, one paragraph.
      for (const node of catalog.nodes) {
        const docs = getPortDocs(node.typeName);
        for (const html of [...Object.values(docs.inputs), ...Object.values(docs.outputs)]) {
          const paragraphs = html.split('</p>').filter(Boolean);
          expect(new Set(paragraphs).size).toBe(paragraphs.length);
        }
      }
    });
  });

  describe('inline formatting', () => {
    it('escapes markup before restoring code and bold', () => {
      expect(formatInline('grows one `in-<name>` input')).toBe('grows one <code>in-&lt;name&gt;</code> input');
      expect(formatInline('**never** &amp')).toBe('<strong>never</strong> &amp;amp');
    });

    it('cannot emit live markup from catalog text', () => {
      expect(formatInline('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('leaves ordinary prose alone', () => {
      expect(formatInline('Fires once the query has returned')).toBe('Fires once the query has returned');
    });
  });

  describe('rendered help', () => {
    it('leads with the summary and carries the when-to-use section', () => {
      const docs = getNodeDocs('AddDbModelRelation');
      expect(docs.html).toContain('class="node-docs-summary"');
      expect(docs.html).toContain('<h3>When to use it</h3>');
    });

    it('says so when a node is deprecated instead of quietly describing it', () => {
      const deprecated = catalog.nodes.find((node) => node.isDeprecated);
      expect(deprecated).toBeDefined();
      expect(getNodeDocs(deprecated.typeName).html).toContain('node-docs-deprecated');
    });

    it('names related nodes by display name, which is what the picker shows', () => {
      // `DbModel2`'s catalog display name is "Record"; the enrichment refers to
      // it by type name. A help panel that says `DbModel2` sends the reader
      // looking for a node that is not in the picker under that name.
      const docs = getNodeDocs('AddDbModelRelation');
      expect(docs.relatedNodes).toContain('DbModel2');
      expect(docs.html).toContain('<h3>Related nodes</h3>');
      expect(docs.html).toContain('Record');
      expect(docs.html).not.toContain('<code>DbModel2</code>');
    });
  });
});
