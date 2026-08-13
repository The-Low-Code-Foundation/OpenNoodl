/**
 * Which links in a release body the update dialog will hand to the OS browser.
 *
 * Richard, on v0.1.7: the notes rendered as plain text, so the links were not
 * clickable — and the global `div { user-select: none }` meant they could not be
 * selected and copied either, which left a reader who wanted a URL with no way
 * to get it out of the dialog at all.
 *
 * Rendering markdown fixes that and opens a door: release notes are text
 * fetched from the network, and this function is what stands between them and
 * `shell.openExternal`.
 */

import { linkActionFor } from '../../src/editor/src/views/UpdateManager/releaseLinks';

describe('a link in release notes', () => {
  describe('is opened when it is an ordinary web link', () => {
    it.each([
      'https://github.com/The-Low-Code-Foundation/NodeGX/releases',
      'http://example.com',
      'HTTPS://EXAMPLE.COM/SHOUTING',
      'https://discord.gg/hESuTU8nPM',
      'https://example.com/path?query=1&other=2#fragment'
    ])('opens %s', (href) => {
      expect(linkActionFor(href)).toBe('open');
    });

    it('tolerates the whitespace a markdown renderer can leave on an href', () => {
      expect(linkActionFor('  https://example.com  ')).toBe('open');
    });
  });

  describe('is ignored when opening it would run something', () => {
    // The renderer refuses these and parses with raw HTML off, so none of them
    // should reach here. That is the argument for the first lock, not against
    // the second: this stays correct if that dependency ever changes.
    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
    ])('ignores %s', (href) => {
      expect(linkActionFor(href)).toBe('ignore');
    });
  });

  describe('is ignored when it would reach past the browser', () => {
    it('ignores a file: URL, which would open something on the user disk', () => {
      expect(linkActionFor('file:///etc/passwd')).toBe('ignore');
    });

    // Handing our own protocol handler a string out of a release body is a
    // deep-link injection with extra steps.
    it('ignores our own protocol', () => {
      expect(linkActionFor('nodegx://open?project=/tmp/evil')).toBe('ignore');
    });

    it.each(['mailto:someone@example.com', 'tel:+1234567890', 'ftp://example.com/x'])(
      'ignores %s',
      (href) => {
        expect(linkActionFor(href)).toBe('ignore');
      }
    );
  });

  describe('is ignored when it is not a URL at all', () => {
    it.each([
      ['an empty string', ''],
      ['whitespace only', '   '],
      ['a bare fragment', '#section'],
      ['a relative path', '/releases/tag/v0.1.7'],
      ['a protocol-relative URL', '//example.com']
    ])('ignores %s', (_label, href) => {
      expect(linkActionFor(href)).toBe('ignore');
    });

    it.each([
      ['null', null],
      ['undefined', undefined]
    ])('ignores %s, which is what a missing href attribute reads as', (_label, href) => {
      expect(linkActionFor(href as unknown as string)).toBe('ignore');
    });
  });

  // A regex on the raw string passes `javascript:` and fails this, which is why
  // the implementation parses instead of pattern-matching.
  it('is not fooled by a scheme that only looks like the start of the string', () => {
    expect(linkActionFor('not-https://example.com')).toBe('ignore');
  });
});
