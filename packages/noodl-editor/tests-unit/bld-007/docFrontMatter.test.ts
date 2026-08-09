/**
 * BLD-007 — a doc declares its own injection, in its own front matter.
 *
 * The defect this closes is that a doc the user writes can be created, listed
 * and rendered, and is then **silently ignored forever**: `KNOWN_DOCS` was the
 * vocabulary, not a seed set. These checks are written against the pure
 * `docsText` submodule deliberately — it is free of `filesystem`, `ProjectModel`
 * and Electron, so the rules that decide what reaches a model are provable in a
 * plain-Node runner rather than only inside a renderer.
 *
 * The one that matters most is the last block: **a project with no user docs
 * must produce byte-identical bytes to before this task landed.** Front matter
 * is opt-in, and a format that quietly rewrote the cached prefix for everyone
 * would have paid for openness with every existing project's prompt cache.
 */

import {
  DEFAULT_DOC_CAP,
  DOC_CAPS,
  KNOWN_DOCS,
  describeDoc,
  docBody,
  parseDocFrontMatter,
  renderDocForPrompt,
  resolveInjection
} from '@noodl-models/ProjectDocs/docsText';

describe('BLD-007 — front matter', () => {
  it('reads title, inject and when from a leading block', () => {
    const parsed = parseDocFrontMatter(
      ['---', 'title:  UK VAT rules', 'inject: pull', 'when:   tax, VAT, pricing, invoices', '---', '', '# VAT', 'body'].join(
        '\n'
      )
    );

    expect(parsed.hadFrontMatter).toBe(true);
    expect(parsed.frontMatter.title).toBe('UK VAT rules');
    expect(parsed.frontMatter.inject).toBe('pull');
    expect(parsed.frontMatter.when).toEqual(['tax', 'VAT', 'pricing', 'invoices']);
    // The model reads prose, never the block that configured the plumbing.
    expect(parsed.body).toBe('# VAT\nbody');
  });

  it('accepts a bracketed list for when, and quoted values', () => {
    const parsed = parseDocFrontMatter(['---', 'title: "Pricing"', 'when: [tax, invoices]', '---', 'x'].join('\n'));
    expect(parsed.frontMatter.title).toBe('Pricing');
    expect(parsed.frontMatter.when).toEqual(['tax', 'invoices']);
  });

  it('is not fooled by a horizontal rule further down the file', () => {
    const source = ['# Heading', '', 'Some prose.', '', '---', '', 'inject: always', '', 'More prose.'].join('\n');
    const parsed = parseDocFrontMatter(source);

    expect(parsed.hadFrontMatter).toBe(false);
    expect(parsed.frontMatter).toEqual({});
    // Nothing stripped: the rule belongs to the prose.
    expect(parsed.body).toBe(source);
  });

  it('reports an unusable inject value instead of guessing', () => {
    const parsed = parseDocFrontMatter(['---', 'inject: sometimes', '---', 'x'].join('\n'));

    expect(parsed.frontMatter.inject).toBeUndefined();
    expect(parsed.problems.join(' ')).toContain('sometimes');
  });

  it('survives CRLF and an unterminated block', () => {
    expect(parseDocFrontMatter('---\r\ninject: always\r\n---\r\nbody').frontMatter.inject).toBe('always');

    const unterminated = parseDocFrontMatter('---\ninject: always\nbody with no closing fence');
    expect(unterminated.hadFrontMatter).toBe(false);
    expect(unterminated.body).toBe('---\ninject: always\nbody with no closing fence');
  });
});

describe('BLD-007 — descriptors: KNOWN_DOCS seeds, it does not gate', () => {
  it('gives a user doc with no front matter the pull default', () => {
    const doc = describeDoc('docs/uk-vat.md', '# VAT\n\nRules.');

    expect(doc.path).toBe('docs/uk-vat.md');
    expect(doc.inject).toBe('pull');
    expect(doc.kind).toBeUndefined();
    expect(doc.declared).toBe(false);
    expect(doc.cap).toBe(DEFAULT_DOC_CAP);
    // A title the tool list can show without the user having declared one.
    expect(doc.title).toBe('VAT');
  });

  it('honours a user doc that opts into every turn', () => {
    const doc = describeDoc('docs/uk-vat.md', ['---', 'title: UK VAT rules', 'inject: always', '---', 'body'].join('\n'));

    expect(doc.inject).toBe('always');
    expect(doc.title).toBe('UK VAT rules');
    expect(doc.declared).toBe(true);
  });

  it('keeps the three seed docs on their historical defaults when they carry no front matter', () => {
    expect(resolveInjection('docs/CONVENTIONS.md', undefined)).toBe('always');
    expect(resolveInjection('docs/BRIEF.md', undefined)).toBe('always');
    expect(resolveInjection('docs/ARCHITECTURE.md', undefined)).toBe('pull');
    expect(resolveInjection('docs/anything-else.md', undefined)).toBe('pull');
  });

  it('lets a seed doc override its own default — the vocabulary is no longer in code', () => {
    const doc = describeDoc('docs/ARCHITECTURE.md', ['---', 'inject: always', '---', 'body'].join('\n'));
    expect(doc.inject).toBe('always');
    expect(doc.kind).toBe('architecture');
    // Its cap stays the architecture cap: the file is what it is regardless of
    // how it is delivered.
    expect(doc.cap).toBe(DOC_CAPS.architecture);
  });

  it('applies the per-doc cap through the same heading-boundary truncator', () => {
    const long = ['# One', 'a'.repeat(DEFAULT_DOC_CAP * 3), '', '## Two', 'tail'].join('\n');
    const doc = describeDoc('docs/big.md', long);
    const rendered = renderDocForPrompt(doc, docBody(long));

    // Well under the source, and the cut is stated rather than silent.
    expect(rendered.length).toBeLessThan(long.length / 2);
    expect(rendered).toContain('[TRUNCATED — docs/big.md is');
    // The prose kept is inside the cap; the footer is the part that overruns.
    expect(rendered.slice(0, rendered.indexOf('[TRUNCATED')).trim().length).toBeLessThanOrEqual(DEFAULT_DOC_CAP);
  });
});

describe('BLD-007 — the cache-safety property', () => {
  it('leaves a doc without front matter byte-identical', () => {
    const source = '# Conventions\n\nUse tokens, never hex.\n';
    expect(docBody(source)).toBe(source);
  });

  it('renders the three seed docs exactly as before for the always-block', () => {
    const conventions = KNOWN_DOCS.find((d) => d.kind === 'conventions')!;
    const source = '# Conventions\n\nUse tokens, never hex.\n';
    // The pre-BLD-007 call shape still works and still returns the raw bytes.
    expect(renderDocForPrompt(conventions, source)).toBe(source);
  });
});
