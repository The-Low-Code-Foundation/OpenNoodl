import fs from 'fs';
import path from 'path';

import { escapeHtml } from '../../src/editor/src/utils/escapeHtml';

/**
 * FIX-003 — `ConfirmModal` and `ErrorModal` render their `message` through
 * `dangerouslySetInnerHTML`, so every caller that composes one out of a name a
 * user or the AI chose is an injection site. Two did: the text-style and
 * colour-style delete confirmations interpolate the style name raw.
 *
 * The behavioural half is graded directly on `escapeHtml`. The call sites are
 * graded on their source, because reaching them for real needs a StylesModel, a
 * PopupLayer and a DOM — none of which this node-env runner has.
 */

const read = (...segments: string[]) => fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');

const PICKERS: [label: string, segments: string[]][] = [
  ['text style', ['src', 'editor', 'src', 'views', 'TextStylePicker', 'TextStylePicker.jsx']],
  [
    'colour style',
    [
      'src',
      'editor',
      'src',
      'views',
      'panels',
      'propertyeditor',
      'DataTypes',
      'ColorPicker',
      'colorstylepicker.jsx'
    ]
  ]
];

describe('escapeHtml', () => {
  it('neutralises the characters that would open a tag or an attribute', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('escapes the ampersand first, so an escape is not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves an ordinary style name untouched', () => {
    expect(escapeHtml('Heading 1')).toBe('Heading 1');
  });
});

describe('the style-delete confirmations', () => {
  it.each(PICKERS)('escapes the %s name before it reaches the HTML sink', (_label, segments) => {
    const source = read(...segments);

    expect(source).toMatch(/\$\{escapeHtml\(name\)\}/);
    // The raw interpolation must be gone, not merely joined by an escaped one.
    expect(source).not.toMatch(/<strong>\$\{name\}<\/strong>/);
  });

  it.each(PICKERS)('imports the shared helper rather than growing a fourth private copy (%s)', (_label, segments) => {
    expect(read(...segments)).toMatch(/import \{ escapeHtml \} from '[^']*utils\/escapeHtml'/);
  });
});
