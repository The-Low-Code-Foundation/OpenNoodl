/**
 * UNI-007 slice 3 — URLs a lesson may name.
 *
 * 🔴 Compiled step HTML reaches `innerHTML` (`views/lessonlayer2.ts`) and
 * `dangerouslySetInnerHTML` (`views/lessons/LessonItem.jsx`) inside the
 * **editor's own renderer**, which has node integration — `require` is reachable
 * from page script there, as any CDP session will show you. So a `javascript:`
 * href in a lesson body is not a defaced link; it is arbitrary code with
 * filesystem access, one click away.
 *
 * `escapeAttr` never stopped this and was never meant to: it escapes quotes and
 * angle brackets, and `javascript:alert(1)` contains neither.
 *
 * ⚠️ **The threat model changed, not the sink.** Until the Learning folder,
 * lesson content came from `LessonTemplatesModel`'s hosted index — one
 * first-party endpoint. Slice 3 installs a bundle from **any folder on disk**,
 * and UNI-010 makes a language model a producer by design. This task promoted a
 * latent sink to a live one and is the right place to close it.
 *
 * Two layers on purpose: the verifier reports (so the author is told) and the
 * compiler neutralises (so anything skipping the verifier — the legacy
 * `lesson.html` reader does — still cannot execute).
 */

import { compileLessonManifest, safeLessonUrl } from '../../src/editor/src/models/lessonformat';
import { verifyLessonManifest } from '../../src/editor/src/models/lessonverify';

/** `java<TAB>script:` and friends: browsers strip these before reading the scheme. */
const TAB = String.fromCharCode(9);
const NEWLINE = String.fromCharCode(10);
const SOH = String.fromCharCode(1);

describe('safeLessonUrl', () => {
  it('allows what a real lesson actually uses', () => {
    for (const url of ['media/cat.png', '/media/cat.png', 'https://nodegx.dev/docs', 'http://localhost:8080/x']) {
      expect(safeLessonUrl(url)).toBe(url);
    }
    expect(safeLessonUrl('mailto:hi@nodegx.dev')).toBeTruthy();
    expect(safeLessonUrl('data:image/png;base64,AAAA', 'media')).toBeTruthy();
  });

  it('refuses javascript:, including the spellings a naive prefix test misses', () => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      '   javascript:alert(1)',
      `java${TAB}script:alert(1)`,
      `java${NEWLINE}script:alert(1)`,
      `${SOH}javascript:alert(1)`,
      'vbscript:msgbox(1)',
      'file:///etc/passwd'
    ]) {
      expect(safeLessonUrl(url)).toBeUndefined();
    }
  });

  it('refuses a data: URL as a LINK even though media may carry one', () => {
    // `data:text/html,…` navigates to an attacker-authored document; an <img
    // src> cannot. The two kinds are not interchangeable.
    expect(safeLessonUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeLessonUrl('data:text/html,<script>alert(1)</script>', 'media')).toBeUndefined();
  });

  it('reads the scheme AFTER stripping, not as a prefix of the raw string', () => {
    // The ordering is the whole defence. `java<TAB>script:` is a working URL in
    // a browser and walks straight past `startsWith('javascript:')`; stripping
    // first and matching the scheme on the stripped form is what catches it.
    // `new URL()` would give this for free but throws on the relative paths
    // every hosted lesson's media actually uses, so the scheme is matched here.
    expect(safeLessonUrl(`  java${TAB}${NEWLINE}script:alert(1)`)).toBeUndefined();
    // …and a relative path that merely CONTAINS a colon later is still relative.
    expect(safeLessonUrl('media/cat:2.png')).toBe('media/cat:2.png');
  });

  it('treats an empty or absent value as nothing to emit', () => {
    expect(safeLessonUrl('')).toBeUndefined();
    expect(safeLessonUrl('   ')).toBeUndefined();
    expect(safeLessonUrl(undefined as unknown as string)).toBeUndefined();
  });
});

describe('the compiler neutralises at the sink', () => {
  it('strips the href and keeps the words for a refused link', () => {
    const compiled = compileLessonManifest({
      title: 'T',
      steps: [{ kind: 'popup', body: 'Read [the docs](javascript:alert(1)) first.' }]
    });

    expect(compiled.steps[0]).not.toMatch(/javascript/i);
    expect(compiled.steps[0]).not.toMatch(/<a /);
    // The sentence the author wrote survives; only the link does not.
    expect(compiled.steps[0]).toMatch(/the docs/);
  });

  it('emits no element at all for a refused media src', () => {
    const compiled = compileLessonManifest({
      title: 'T',
      steps: [{ kind: 'popup', body: 'Look', media: { type: 'image', src: 'javascript:alert(1)' } }]
    });

    expect(compiled.steps[0]).not.toMatch(/<img/);
    expect(compiled.steps[0]).not.toMatch(/javascript/i);
  });

  /**
   * The HTML-entity spelling, checked on the **compiled output** rather than on
   * `safeLessonUrl` — because here the two defences compose and neither alone is
   * the answer.
   *
   * `&#106;avascript:` has no scheme `safeLessonUrl` can read (it starts with
   * `&`), so it is passed through as a relative URL. What makes it inert is the
   * escaper that follows: `escapeAttr` turns the `&` into `&amp;`, so the
   * browser decodes the attribute back to the literal text `&#106;avascript:`
   * and never to a scheme. Pinned so a future "tidy up the double-escaping"
   * cannot quietly remove the half that is load-bearing.
   */
  it('leaves an entity-encoded scheme inert, via the escaper rather than the allow-list', () => {
    const compiled = compileLessonManifest({
      title: 'T',
      steps: [
        {
          kind: 'popup',
          body: 'Click [here](&#106;avascript:alert(1))',
          media: { type: 'image', src: '&#106;avascript:alert(1)' }
        }
      ]
    });

    // The `&` is escaped, so nothing in the output can be read as a scheme.
    expect(compiled.steps[0]).not.toMatch(/href="j/i);
    expect(compiled.steps[0]).not.toMatch(/src="j/i);
    expect(compiled.steps[0]).toMatch(/&amp;/);
  });

  it('still emits an ordinary link and an ordinary image', () => {
    const compiled = compileLessonManifest({
      title: 'T',
      steps: [
        { kind: 'popup', body: 'Read [the docs](https://nodegx.dev).', media: { type: 'image', src: 'cat.png' } }
      ]
    });

    expect(compiled.steps[0]).toMatch(/<a href="https:\/\/nodegx\.dev">the docs<\/a>/);
    expect(compiled.steps[0]).toMatch(/<img src="cat\.png">/);
  });
});

describe('the verifier tells the author', () => {
  it('reports an unsafe URL in prose and in media, as an error', () => {
    const report = verifyLessonManifest({
      title: 'Dodgy',
      steps: [
        { title: 'One', body: 'Click [here](javascript:require("child_process").exec("id"))' },
        { title: 'Two', media: { type: 'video', src: 'file:///etc/passwd' } }
      ]
    });

    expect(report.ok).toBe(false);
    const unsafe = report.findings.filter((f) => f.code === 'unsafe-url');
    expect(unsafe).toHaveLength(2);
    expect(unsafe[0].where).toMatch(/"body"/);
    expect(unsafe[0].step).toBe(0);
    expect(unsafe[1].where).toMatch(/"media\.src"/);
    expect(unsafe.every((f) => f.severity === 'error')).toBe(true);
  });

  it('says nothing about the URLs a normal lesson carries', () => {
    const report = verifyLessonManifest({
      title: 'Fine',
      steps: [
        { title: 'One', body: 'See [the docs](https://nodegx.dev).', media: { type: 'image', src: 'media/cat.png' } }
      ]
    });

    expect(report.findings.filter((f) => f.code === 'unsafe-url')).toEqual([]);
  });
});
