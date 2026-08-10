/**
 * BLD-013 — the half of an attachment that needs a browser.
 *
 * `thread/fileAttachments.ts` decides *what* a file is and *what it costs*;
 * this reads its bytes, resizes a bitmap through a `<canvas>` and hands back an
 * `AttachedReference` the chip row can render. Same split as BLD-011's
 * `references.ts` / `referenceSources.ts`, for the same reason: the decisions
 * are what a spec can grade, and a spec cannot construct a `File`.
 *
 * **Three intake paths, one destination.** Drag-and-drop, clipboard paste and
 * the composer's file picker all arrive here as a `File`, so the caps, the
 * refusals, the twin wording and the chip are written once. The picker is the
 * only one of the three that can name what it accepts up front; the other two
 * get whatever the OS hands them, which is why `classifyAttachment` leads with
 * the extension and falls back to the MIME type.
 *
 * @module AiAssistant/authoring/fileReferences
 */

import type { AiDocumentBlock, AiImageBlock, AiImageMediaType } from '../client/content';
import {
  ATTACHMENT_LIMITS,
  classifyAttachment,
  documentSupportWarning,
  documentTwinText,
  formatBytes,
  imageTwinText,
  sizeRefusal
} from '../thread/fileAttachments';
import {
  capReferenceText,
  defaultPinned,
  REFERENCE_CAPS,
  type AttachedReference,
  type ReferenceResolution
} from '../thread/references';

/** What the caller knows about where this turn is going. */
export interface AttachmentTarget {
  /** How the warning names the model — an id is fine, it is what the user set. */
  modelLabel: string;
  /** `capabilities.documents` on the model that will serve the turn. */
  supportsDocuments: boolean;
}

let seq = 0;
function nextId(target: string): string {
  seq += 1;
  return `file:${target}:${seq}`;
}

/**
 * A pasted screenshot has no filename, and "image.png" would be a lie the chip
 * row repeats five times.
 *
 * The index is the clock this module is allowed to read — `Date.now()` in a
 * label would make two identical pastes produce different bytes for the same
 * picture, which is the trap `readComponent`'s fixed timestamp already
 * documents next door.
 */
function pastedLabel(mimeType: string, index: number): string {
  const ext = mimeType.split('/')[1] || 'png';
  return index === 0 ? `Pasted image.${ext}` : `Pasted image ${index + 1}.${ext}`;
}

/**
 * Resolve one dropped, pasted or picked file into a reference.
 *
 * Eager and total, exactly like `resolveCandidate`: every failure comes back as
 * a `failed` reference carrying its own message rather than as a rejection, so
 * build item 6 keeps working — the chip states the problem and blocks the send,
 * and no caller has to turn a thrown error back into this same shape.
 */
export async function resolveAttachment(
  file: File,
  target: AttachmentTarget,
  pastedIndex?: number
): Promise<AttachedReference> {
  const label = file.name || pastedLabel(file.type || 'image/png', pastedIndex ?? 0);
  const base = {
    id: nextId(label),
    kind: 'file' as const,
    label,
    target: label,
    pinned: defaultPinned('file')
  };
  const failed = (error: string): AttachedReference => ({ ...base, status: 'failed', error });

  const classified = classifyAttachment(file.name || '', file.type);
  if (classified.kind === 'refused') return failed(classified.reason);

  const tooBig = sizeRefusal(classified.kind, file.size);
  if (tooBig) return failed(tooBig);

  try {
    if (classified.kind === 'text') {
      const source = await file.text();
      return { ...base, status: 'ready', resolution: capReferenceText(source, label, REFERENCE_CAPS.file) };
    }

    if (classified.kind === 'image') {
      return { ...base, status: 'ready', resolution: await resolveImage(file, label, classified.mediaType) };
    }

    const resolution = await resolveDocument(file, label);
    // ⚠️ Q5's warning rides on the chip, not on the send. The attachment
    // succeeds either way — see `documentSupportWarning` for why refusing here
    // would be the wrong shape.
    const warning = documentSupportWarning(target.modelLabel, target.supportsDocuments);
    return { ...base, status: 'ready', resolution, ...(warning ? { warning } : {}) };
  } catch (e) {
    return failed(e instanceof Error ? e.message : String(e));
  }
}

/**
 * A PDF, whole, as base64.
 *
 * Nothing parses it. `chars` counts the twin rather than the document, because
 * `chars` is what the *text* half of the turn costs and the twin is the only
 * text this reference contributes — the bytes are reported by `bytes`, in the
 * unit they are actually limited by.
 */
async function resolveDocument(file: File, label: string): Promise<ReferenceResolution> {
  const bytes = await file.arrayBuffer();
  const text = documentTwinText(label, file.size);
  const document: AiDocumentBlock = {
    type: 'document',
    data: toBase64(bytes),
    mediaType: 'application/pdf',
    title: label,
    text
  };
  return { text, documents: [document], chars: text.length, truncated: false, originalChars: text.length, bytes: file.size };
}

/**
 * An image, resized to the token ceiling and re-encoded only when it has to be.
 *
 * ⚠️ **PNG stays PNG unless the bytes force the issue**, and that is the whole
 * of the encoding policy. The images this feature actually receives are UI
 * screenshots and design mocks — flat colour and small text, which is the one
 * case JPEG is worst at: re-encoding a 12px label produces ringing that a model
 * then reads as a rendering defect, and BLD-014's whole premise is that a
 * capture is *evidence*. So dimensions are cut first (which costs tokens and
 * nothing else), and JPEG is the fallback for the case where that was not
 * enough rather than the default.
 */
async function resolveImage(file: File, label: string, mediaType: AiImageMediaType): Promise<ReferenceResolution> {
  const original = await loadBitmap(file);
  const scale = Math.min(1, ATTACHMENT_LIMITS.imageMaxEdge / Math.max(original.width, original.height));
  const width = Math.max(1, Math.round(original.width * scale));
  const height = Math.max(1, Math.round(original.height * scale));
  const resized = scale < 1;

  let encoded = resized || file.size > ATTACHMENT_LIMITS.imageMaxBytes
    ? await drawToDataUrl(original, width, height, mediaType)
    : { mediaType, data: toBase64(await file.arrayBuffer()), bytes: file.size };

  // Still over the ceiling after resizing — this is the 4MB phone screenshot,
  // and now the trade is worth making.
  if (encoded.bytes > ATTACHMENT_LIMITS.imageMaxBytes && encoded.mediaType !== 'image/jpeg') {
    encoded = await drawToDataUrl(original, width, height, 'image/jpeg');
  }

  const text = imageTwinText(label, width, height, resized);
  const image: AiImageBlock = { type: 'image', data: encoded.data, mediaType: encoded.mediaType, text };
  return { text, images: [image], chars: text.length, truncated: false, originalChars: text.length, bytes: encoded.bytes };
}

interface EncodedImage {
  mediaType: AiImageMediaType;
  data: string;
  bytes: number;
}

/**
 * ⚠️ GIF and WebP are re-encoded as **PNG**, not as themselves.
 *
 * `canvas.toBlob('image/gif')` is not implemented in Chromium and silently
 * falls back to PNG *while still reporting the type you asked for* — which
 * would have produced a block whose `mediaType` says `image/gif` over PNG
 * bytes, and an endpoint that rejects it for a reason naming neither. The
 * substitution is made here, deliberately, so the declared type is the one that
 * was actually written. An animated GIF loses its animation; a model was only
 * ever going to see one frame of it anyway.
 */
function encodableAs(mediaType: AiImageMediaType): AiImageMediaType {
  return mediaType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
}

function drawToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  mediaType: AiImageMediaType
): Promise<EncodedImage> {
  const type = encodableAs(mediaType);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not resize this image — no 2D canvas is available.');
  context.drawImage(source, 0, 0, width, height);

  return new Promise<EncodedImage>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode this image after resizing it.'));
          return;
        }
        void blob
          .arrayBuffer()
          .then((buffer) => resolve({ mediaType: type, data: toBase64(buffer), bytes: blob.size }))
          .catch(reject);
      },
      type,
      // Only consulted for JPEG. 0.85 is the point where a screenshot's text
      // is still legible; below it the ringing this function exists to avoid
      // comes back through the fallback path.
      0.85
    );
  });
}

/**
 * Decode to something `drawImage` accepts.
 *
 * `createImageBitmap` where it exists (it decodes off the main thread, which
 * matters for a 4MB screenshot dropped into a panel that is mid-render), and an
 * object-URL `<img>` where it does not. The URL is revoked on both paths —
 * a leaked one pins the whole decoded bitmap for the life of the window.
 */
async function loadBitmap(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read this image — it may be corrupt or an unsupported format.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Bytes to base64, in chunks.
 *
 * ⚠️ The chunking is not a micro-optimisation. `String.fromCharCode(...bytes)`
 * spreads one argument per byte, and a 20MB PDF is 20 million arguments — which
 * does not throw a helpful error, it overflows the call stack. 32KB is
 * comfortably inside every engine's argument limit.
 */
export function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(binary);
}

/** What the composer's file picker says it accepts. One source, not two lists. */
export const ATTACHMENT_ACCEPT =
  '.md,.markdown,.txt,.json,.csv,.tsv,.yml,.yaml,.xml,.html,.css,.scss,.js,.jsx,.ts,.tsx,.log,.svg,' +
  '.png,.jpg,.jpeg,.gif,.webp,.pdf';

/** Re-exported so the panel imports one module for the whole feature. */
export { formatBytes };
