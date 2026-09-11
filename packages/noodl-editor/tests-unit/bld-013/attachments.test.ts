/**
 * BLD-013 — classification, ceilings, refusals and the twin contract.
 *
 * The arithmetic half of an attachment, which is where a mistake is invisible
 * on screen: a `.pdf` classified as text, a refusal that names no number, a
 * document reaching a model that cannot take one with nothing said about it.
 * All of it decided in `thread/fileAttachments.ts` precisely so it can be
 * graded here rather than by looking at a chip.
 */

import {
  ATTACHMENT_LIMITS,
  classifyAttachment,
  documentSupportWarning,
  documentTwinText,
  formatBytes,
  imageTwinText,
  sizeRefusal
} from '../../src/editor/src/models/AiAssistant/thread/fileAttachments';
import {
  degradeDocuments,
  degradedDocumentText,
  asText,
  hasDocument
} from '../../src/editor/src/models/AiAssistant/client/content';
import type { AiContentBlock } from '../../src/editor/src/models/AiAssistant/client/content';

describe('BLD-013 — what a dropped file is', () => {
  it('classifies by extension first', () => {
    expect(classifyAttachment('BRIEF.md')).toEqual({ kind: 'text' });
    expect(classifyAttachment('mock.PNG')).toEqual({ kind: 'image', mediaType: 'image/png' });
    expect(classifyAttachment('brief.pdf')).toEqual({ kind: 'document', mediaType: 'application/pdf' });
  });

  it('⚠️ trusts the extension over a disagreeing MIME type', () => {
    // The three intake paths report MIME types that disagree with each other on
    // the same file; the extension is the one signal the user can see and
    // therefore correct.
    expect(classifyAttachment('notes.md', 'application/octet-stream')).toEqual({ kind: 'text' });
    expect(classifyAttachment('brief.pdf', 'text/plain')).toEqual({
      kind: 'document',
      mediaType: 'application/pdf'
    });
  });

  it('classifies a pasted screenshot, which has no filename at all', () => {
    // This is the most common intake path in practice and the only one that
    // exercises the MIME fallback.
    expect(classifyAttachment('', 'image/png')).toEqual({ kind: 'image', mediaType: 'image/png' });
  });

  it('classifies SVG as text, deliberately', () => {
    // Source, not a picture — a model reading the markup gets the ids and the
    // colour values; a model reading a rasterisation has to guess them back.
    expect(classifyAttachment('logo.svg')).toEqual({ kind: 'text' });
  });

  it('refuses an unsupported type with a message naming what IS supported', () => {
    const result = classifyAttachment('archive.zip');
    expect(result.kind).toBe('refused');
    if (result.kind !== 'refused') throw new Error('unreachable');
    // "Not supported" without the alternative is a dead end, and the user is
    // standing at the composer with the file in their hand.
    expect(result.reason).toContain('.zip');
    expect(result.reason).toMatch(/Markdown/);
    expect(result.reason).toMatch(/PDF/);
  });
});

describe('BLD-013 — ceilings, and the refusal that names both numbers', () => {
  it('accepts a file at its exact limit and refuses one byte over', () => {
    // Off-by-one at a boundary is the classic way a "limit" ends up being
    // limit-minus-one for everyone who reads the message.
    expect(sizeRefusal('document', ATTACHMENT_LIMITS.documentMaxBytes)).toBeUndefined();
    expect(sizeRefusal('document', ATTACHMENT_LIMITS.documentMaxBytes + 1)).toBeDefined();
    expect(sizeRefusal('text', ATTACHMENT_LIMITS.textMaxBytes)).toBeUndefined();
    expect(sizeRefusal('text', ATTACHMENT_LIMITS.textMaxBytes + 1)).toBeDefined();
  });

  it('names the actual size AND the limit, not just "too large"', () => {
    const message = sizeRefusal('document', 25_000_000);
    // "Too large" tells a user nothing about whether splitting the file in two
    // would have been enough.
    expect(message).toContain('23.8 MB');
    expect(message).toMatch(/Split it/);
  });

  it('🔴 prints a limit that is ROUND in the unit it is displayed in', () => {
    // Found on the drive. `documentMaxBytes: 20_000_000` is a perfectly round
    // constant that `formatBytes` renders as "19.1 MB" — so a user who trimmed
    // a PDF to just under 20MB was told the limit was 19.1. The number was
    // right and the message was useless: nobody checks a ceiling against the
    // source, they check it against the sentence in front of them.
    expect(formatBytes(ATTACHMENT_LIMITS.documentMaxBytes)).toBe('20.0 MB');
    expect(sizeRefusal('document', 25_000_000)).toContain('20.0 MB');
  });

  it('does not cap an image by bytes — it resizes instead', () => {
    // The image path has a recovery (fewer pixels, then JPEG); refusing it
    // would throw away a screenshot that was always going to fit.
    expect(sizeRefusal('image', 40_000_000)).toBeUndefined();
  });

  it('formats bytes in the unit a person can act on', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(4096)).toBe('4 KB');
    expect(formatBytes(1_500_000)).toBe('1.4 MB');
  });
});

describe('BLD-013 — Q5: the capability gate, not a parser', () => {
  it('says nothing when the model takes documents', () => {
    // Absent-means-omitted: the common case puts no sentence on the chip.
    expect(documentSupportWarning('claude-opus-5', true)).toBeUndefined();
  });

  it('names the model and what it will actually receive', () => {
    const warning = documentSupportWarning('gpt-4.1', false);
    expect(warning).toContain('gpt-4.1');
    // ⚠️ The distinction the user needs is not "unsupported" — it is that the
    // send still happens and the model gets a description instead.
    expect(warning).toMatch(/omitted/);
    expect(warning).toMatch(/not what it says/);
  });
});

describe('BLD-013 — the twin contract for a document', () => {
  const pdf: AiContentBlock = {
    type: 'document',
    data: 'AAAA',
    mediaType: 'application/pdf',
    title: 'brand-guidelines.pdf',
    text: documentTwinText('brand-guidelines.pdf', 240_000)
  };

  it('degrades to a DECLARED substitution, never to bare prose', () => {
    const degraded = degradeDocuments([pdf]);
    expect(hasDocument(degraded)).toBe(false);
    const text = asText(degraded);
    expect(text).toContain('document omitted');
    expect(text).toContain('brand-guidelines.pdf');
  });

  it('🔴 forbids the model reasoning from the filename', () => {
    // A PDF's name is often a decent summary of it, and a model handed only
    // the name will reason from it happily. This sentence is the difference
    // between a declared absence and a confident guess.
    expect(degradedDocumentText(pdf)).toMatch(/Do not infer the document's contents from its filename/);
  });

  it('⚠️ never emits a document block\'s `text` bare', () => {
    // `AiDocumentBlock.text` and `AiTextBlock.text` are the same field name and
    // wholly different meanings. A fall-through in `asText` would have emitted
    // the twin's words with none of the declaration that makes them honest —
    // and it would have looked completely fine.
    const text = asText([pdf]);
    expect(text).not.toBe(pdf.text);
    expect(text).toContain('[document omitted');
  });

  it('preserves the cache marker when it substitutes', () => {
    // Degrading must not move the breakpoint. Same rule `degradeImages` keeps,
    // and the reason it carries the marker onto the substituted block.
    const marked: AiContentBlock[] = [{ ...pdf, cache: true }];
    const degraded = degradeDocuments(marked) as AiContentBlock[];
    expect(degraded[0].cache).toBe(true);
  });

  it('leaves content with no document byte-identical', () => {
    // Absent-means-unchanged, so a turn that carries no PDF produces exactly
    // the bytes it produced before this task existed.
    const plain: AiContentBlock[] = [{ type: 'text', text: 'hello' }];
    expect(degradeDocuments(plain)).toBe(plain);
    expect(degradeDocuments('hello')).toBe('hello');
  });
});

describe('BLD-013 — the twin says what it knows and stops', () => {
  it('states the size an image is sent at, and whether it was resized', () => {
    expect(imageTwinText('mock.png', 800, 600, false)).toContain('800×600');
    expect(imageTwinText('mock.png', 1568, 900, true)).toMatch(/resized down/);
  });

  it('describes rather than interprets', () => {
    // Nothing here has looked at the pixels. Anything more than "an image the
    // user attached, this size" would be invention — which is the failure the
    // twin exists to prevent, not one it is allowed to commit.
    const twin = imageTwinText('checkout.png', 400, 300, false);
    expect(twin).toContain('checkout.png');
    expect(twin.length).toBeLessThan(160);
  });
});
