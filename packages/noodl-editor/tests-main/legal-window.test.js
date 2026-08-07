/**
 * ALPHA-005 — the legal document window.
 *
 * The window itself is Electron chrome and not worth a test; the Markdown
 * renderer is the only part with logic, and it runs against two files that
 * ship in the product. So the interesting assertions are made against the
 * *real* `PRIVACY.md` and `TERMS.md` rather than fixtures: a document that
 * grows a construct the renderer cannot handle should fail here, not in front
 * of a user reading a privacy policy.
 */

const fs = require('fs');
const path = require('path');

// `jest.mock` factories may not close over out-of-scope variables, so the
// package directory is recomputed inside it rather than reusing `path`.
jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  shell: { openExternal: jest.fn() },
  app: { getAppPath: () => require('path').join(__dirname, '..') }
}));

const { renderMarkdown, resolveDocumentPath, DOCUMENTS } = require('../src/main/src/legal-window');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

describe('legal document rendering', () => {
  describe.each(Object.entries(DOCUMENTS))('%s (%o)', (id, doc) => {
    const source = fs.readFileSync(path.join(REPO_ROOT, doc.file), 'utf8');
    const html = renderMarkdown(source);

    it('produces a non-trivial document', () => {
      expect(html.length).toBeGreaterThan(1000);
      expect(html).toContain('<h1>');
    });

    it('leaves no code-span placeholder in the output', () => {
      expect(html).not.toContain('');
      expect(html).not.toContain('<code>undefined</code>');
    });

    it('strips the maintainer TODO comments', () => {
      // These are notes to us about the contact section, not text for a reader.
      expect(source).toContain('TODO(ALPHA-005)');
      expect(html).not.toContain('TODO(ALPHA-005)');
    });

    it('converts every Markdown link', () => {
      expect(html).not.toMatch(/\]\(/);
      expect(html).toContain('<a href=');
    });

    it('escapes HTML rather than emitting it raw', () => {
      // The only tags present should be ones the renderer produced.
      expect(html).not.toMatch(/<script/i);
    });
  });

  it('renders tables, which PRIVACY.md relies on for the data-flow lists', () => {
    const html = renderMarkdown(fs.readFileSync(path.join(REPO_ROOT, 'PRIVACY.md'), 'utf8'));
    expect(html).toContain('<table>');
    expect(html).toContain('<th>');
    expect(html).toContain('api.anthropic.com');
  });

  it('does not mistake numbers in prose for code spans', () => {
    // The bug the delimited sentinel exists to prevent.
    const html = renderMarkdown('sections 15 and 16 of the GPL, plus `real code` here.');
    expect(html).toContain('<code>real code</code>');
    expect(html).toContain('sections 15 and 16');
  });

  it('escapes HTML inside code spans', () => {
    expect(renderMarkdown('a `<script>` span')).toContain('<code>&lt;script&gt;</code>');
  });

  it('renders headings, lists and rules', () => {
    const html = renderMarkdown('## Heading\n\n- one\n- two\n\n---\n');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<hr />');
  });

  it('joins wrapped paragraph lines into one paragraph', () => {
    const html = renderMarkdown('a wrapped\nparagraph here\n\nsecond one\n');
    expect(html).toContain('<p>a wrapped paragraph here</p>');
    expect(html).toContain('<p>second one</p>');
  });
});

describe('document resolution', () => {
  it('finds both documents when running from source', () => {
    for (const doc of Object.values(DOCUMENTS)) {
      expect(resolveDocumentPath(doc.file)).toBe(path.join(REPO_ROOT, doc.file));
    }
  });

  it('returns null for a document that does not exist', () => {
    expect(resolveDocumentPath('NOT-A-REAL-DOCUMENT.md')).toBeNull();
  });
});

describe('the packaged build ships the documents', () => {
  it('lists both under extraResources', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const targets = pkg.build.extraResources.map((entry) => entry.to);
    // resolveDocumentPath looks in `<resources>/legal/<file>` first.
    for (const doc of Object.values(DOCUMENTS)) {
      expect(targets).toContain(`legal/${doc.file}`);
    }
  });
});
