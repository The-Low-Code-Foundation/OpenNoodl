/**
 * BLD-013 — what a dropped file *is*, and what it costs, decided once.
 *
 * ## Why this is pure, and next door to `references.ts`
 *
 * Same boundary, same reason. The part of an attachment where a mistake is
 * invisible on screen is the arithmetic and the classification: a `.pdf` sent
 * to a model that cannot take one, an image re-encoded past the point of being
 * readable, a 40MB drop that fails at request time instead of in the chip. All
 * of that is graded in `tests-unit/bld-013/` in a plain-Node runner. The half
 * that needs a `<canvas>` to resize a bitmap, or a `File` to read bytes, lives
 * in `authoring/fileReferences.ts` and calls into here for every decision.
 *
 * ## Q5 — no PDF library, and that is the whole answer
 *
 * The task costed `pdfjs-dist` as "the one genuinely new dependency the phase
 * would take on, in a packaged Electron app that is already large". Richard's
 * ruling made it unnecessary rather than cheaper: *"If they're using an image
 * model (Anthropic, OpenAI, Google) accept. If not throw a warning like 'PDFs
 * might not be supported by this model'."* Anthropic's Messages API takes a
 * base64 `application/pdf` block natively and does its own text extraction and
 * page rasterisation server-side — so the dependency would have bought a worse
 * version of something the endpoint already does. What is left is a
 * **capability gate**, which is this module and a flag on the model registry.
 *
 * ⚠️ The gate is stated *before* the send, on the chip, not after. See
 * {@link documentSupportWarning}.
 *
 * @module AiAssistant/thread/fileAttachments
 */

import type { AiDocumentMediaType, AiImageMediaType } from '../client/content';

/** What we do with a file, once we know what it is. */
export type AttachmentKind = 'text' | 'image' | 'document';

/**
 * Ceilings, in the units each one is actually limited by.
 *
 * ⚠️ Three different units, because three different things run out. Text runs
 * out of **context window** and is capped in characters by `REFERENCE_CAPS`.
 * An image runs out of **tokens** and is capped by its longest edge. A document
 * runs out of **request size** and is capped in bytes. A single "max size"
 * would have had to pick one of those and be wrong about the other two.
 */
export const ATTACHMENT_LIMITS = {
  /**
   * Longest edge, in pixels, before an image is resized.
   *
   * 1568 is the width above which Anthropic's own cost guidance stops paying
   * for itself: a picture at this edge costs roughly 1.6k tokens, and the
   * high-resolution tier above it costs up to ~4.8k for detail that a design
   * mock or an app screenshot does not need. The render tooling reached the
   * same conclusion from the other direction — *"a full page at 1280px wide and
   * 4000px tall is ~500KB of PNG at 0.5"* — and this reuses that judgement
   * rather than re-deriving it, which is what build item 3 asks for.
   */
  imageMaxEdge: 1568,
  /**
   * Bytes an image may occupy after resizing, before it is re-encoded as JPEG.
   *
   * Well under Anthropic's own 5MB-per-image ceiling on purpose: this is a cost
   * lever, not a validity check. A 4MB phone screenshot is the case build item
   * 3 names, and it clears this by a factor of three even before resizing.
   */
  imageMaxBytes: 1_500_000,
  /**
   * Bytes a document may occupy, full stop. No re-encoding path exists — a PDF
   * is sent whole or refused.
   *
   * 20MB against a documented 32MB request ceiling, so that the rest of the
   * prompt (a 24k component serialization, the catalog, the docs) cannot push a
   * legal attachment over the line. A refusal that names the real ceiling is
   * useless if the real ceiling depends on what else is attached.
   *
   * 🔴 **Binary MB, not decimal, and the drive is why.** Written as
   * `20_000_000` this is a perfectly round ceiling that {@link formatBytes}
   * prints as **"19.1 MB"** — so a user who trimmed a PDF to just under 20MB
   * was told the limit was 19.1. The number was correct and the message was
   * useless: nobody checks a limit against the constant in the source, they
   * check it against the sentence in front of them. A ceiling has to be round
   * *in the unit it is displayed in*.
   */
  documentMaxBytes: 20 * 1024 * 1024,
  /**
   * Bytes a text file may occupy on disk before it is refused outright.
   *
   * Distinct from `REFERENCE_CAPS.file`, which cuts the *content* at 12,000
   * characters with a stated truncation. This is the point at which reading the
   * file into a string to then throw 99% of it away stops being reasonable —
   * a 5MB log is not a document that got long, it is the wrong file.
   */
  // Binary, for the reason `documentMaxBytes` documents — this one is printed
  // in a refusal too.
  textMaxBytes: 2 * 1024 * 1024
} as const;

const TEXT_EXTENSIONS = [
  'md',
  'markdown',
  'txt',
  'text',
  'json',
  'csv',
  'tsv',
  'yml',
  'yaml',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'js',
  'jsx',
  'ts',
  'tsx',
  'log',
  /**
   * ⚠️ SVG is classified as **text**, not as an image, and it is the one
   * classification here that is a judgement rather than a lookup.
   *
   * An SVG is source. A model reading the markup gets the shapes, the ids and
   * the colour values it can act on; a model reading a rasterisation of it gets
   * a picture and has to guess all three back. Rasterising it would also mean
   * running untrusted markup through a `<canvas>` to convert it, which is a
   * larger decision than this task needs to make.
   */
  'svg'
] as const;

const IMAGE_EXTENSIONS: Record<string, AiImageMediaType> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
};

const DOCUMENT_EXTENSIONS: Record<string, AiDocumentMediaType> = {
  pdf: 'application/pdf'
};

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

/** A classification, or the reason there isn't one. */
export type AttachmentClass =
  | { kind: 'text' }
  | { kind: 'image'; mediaType: AiImageMediaType }
  | { kind: 'document'; mediaType: AiDocumentMediaType }
  | { kind: 'refused'; reason: string };

/**
 * What this file is, by extension first and MIME type second.
 *
 * ⚠️ Extension wins, and the order matters. The three intake paths report MIME
 * types that disagree: a drag-and-drop from Finder gives a real one, a paste of
 * a screenshot gives `image/png` with **no filename at all**, and a drop of a
 * `.md` file frequently arrives as `text/markdown`, `text/plain` or `""`
 * depending on the platform. An extension is the one signal the user can see
 * and therefore the one they can correct.
 */
export function classifyAttachment(filename: string, mimeType?: string): AttachmentClass {
  const ext = fileExtension(filename);

  if (IMAGE_EXTENSIONS[ext]) return { kind: 'image', mediaType: IMAGE_EXTENSIONS[ext] };
  if (DOCUMENT_EXTENSIONS[ext]) return { kind: 'document', mediaType: DOCUMENT_EXTENSIONS[ext] };
  if ((TEXT_EXTENSIONS as readonly string[]).includes(ext)) return { kind: 'text' };

  // No usable extension — a pasted screenshot is the case this exists for, and
  // it arrives with an empty name and an honest MIME type.
  const mime = (mimeType || '').toLowerCase();
  const imageMatch = Object.values(IMAGE_EXTENSIONS).find((type) => type === mime);
  if (imageMatch) return { kind: 'image', mediaType: imageMatch };
  if (mime === 'application/pdf') return { kind: 'document', mediaType: 'application/pdf' };
  if (mime.startsWith('text/') || mime === 'application/json') return { kind: 'text' };

  return {
    kind: 'refused',
    reason: ext
      ? `.${ext} files can't be attached. Text, Markdown, images (PNG, JPEG, GIF, WebP) and PDFs can.`
      : `This file can't be attached — it has no extension and its type (${mimeType || 'unknown'}) isn't one we can read.`
  };
}

/** Bytes, in the shortest form a person can act on. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Build item's "refused or truncated **with a message**, before send" — the
 * size half.
 *
 * Returns the refusal, or `undefined` when the file is within its ceiling. The
 * message names the actual number on both sides, because "too large" tells a
 * user nothing about whether cropping the screenshot would have been enough.
 */
export function sizeRefusal(kind: AttachmentKind, bytes: number): string | undefined {
  if (kind === 'document' && bytes > ATTACHMENT_LIMITS.documentMaxBytes) {
    return `This PDF is ${formatBytes(bytes)}; the limit is ${formatBytes(
      ATTACHMENT_LIMITS.documentMaxBytes
    )}. Split it, or attach the pages that matter as images.`;
  }
  if (kind === 'text' && bytes > ATTACHMENT_LIMITS.textMaxBytes) {
    return `This file is ${formatBytes(bytes)}; the limit is ${formatBytes(
      ATTACHMENT_LIMITS.textMaxBytes
    )}. Attach the part you want read.`;
  }
  return undefined;
}

/**
 * The text twin for an attached image — required by `AiImageBlock`, and the
 * only thing a text-only model ever learns about it.
 *
 * It states what it is and where it came from, and stops there. Nothing here
 * has looked at the pixels, so anything more would be invention — which is the
 * failure the twin exists to prevent, not one it is allowed to commit.
 */
export function imageTwinText(label: string, width: number, height: number, resized: boolean): string {
  const size = `${width}×${height}`;
  return resized
    ? `An image the user attached, "${label}", shown at ${size} (resized down from the original to keep it affordable).`
    : `An image the user attached, "${label}", ${size}.`;
}

/** The same contract for a document. See {@link imageTwinText}. */
export function documentTwinText(label: string, bytes: number): string {
  return `A PDF the user attached, "${label}", ${formatBytes(bytes)}.`;
}

/**
 * ⚠️ Q5's warning, and the reason it is a *pre-send* string rather than an
 * error.
 *
 * Richard's ruling was to accept a PDF where the model takes one and "throw a
 * warning like 'PDFs might not be supported by this model'" where it does not.
 * A refusal would be the wrong shape: the user may be attaching the PDF for a
 * later turn, may be about to switch models, or may simply want the filename in
 * the conversation. So the attachment succeeds, the chip says this, and the
 * model receives the declared twin rather than bytes its endpoint would reject.
 *
 * Returns `undefined` when the model does take documents, which is what keeps
 * this off every chip in the common case.
 */
export function documentSupportWarning(modelLabel: string, supportsDocuments: boolean): string | undefined {
  if (supportsDocuments) return undefined;
  return `${modelLabel} can't receive PDFs — it will be told the document was attached and omitted, not what it says.`;
}
