/**
 * Escape a string for interpolation into an HTML fragment.
 *
 * ⚠️ Reach for this whenever a name a user or the AI can choose ends up inside
 * a string handed to `dangerouslySetInnerHTML` — `ConfirmModal` and `ErrorModal`
 * (`views/PopupLayer/ConfirmModal.tsx`) both render their `message` that way, so
 * every caller composing one owes its interpolated values this call.
 *
 * Three private copies of this function already exist (`utils/nodeDocs.ts`,
 * `utils/capability-gating/nodeWarning.ts`, `models/lessonformat.ts`); this is
 * the shared one for new callers. The semantics match them exactly.
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
