/**
 * FIX-002 — the send key, as one pure decision.
 *
 * Ruled 2026-08-14: **Enter sends, Shift+Enter inserts a newline** — the
 * industry default, and the opposite of what `TextArea` did for its whole
 * life before this file existed (Shift+Enter submitted, plain Enter fell
 * through to the browser's newline). The flip is here, in a module with no
 * imports, because the component's runners are node-env with no jsdom — an
 * inline JSX handler is behaviour no spec in this repo can reach, and a
 * keystroke policy that two AI composers and BLD-016's completion menu all
 * depend on must not live only in a place tests cannot see.
 *
 * ⚠️ `defaultPrevented` is honoured *before* the key is read: a completion
 * menu (BLD-016) that consumed Enter to pick a row must not also submit the
 * composer on the same keystroke. The DOM already has the word for "this key
 * is spoken for", and this function repeats it rather than inventing a flag.
 */

export interface TextAreaKeyEventLike {
  key: string;
  shiftKey: boolean;
  defaultPrevented: boolean;
}

/**
 * True exactly when a keydown on the textarea should call `onEnter` (and
 * prevent the default newline): a plain, unconsumed Enter, on a component
 * whose consumer asked to hear about it at all. Shift+Enter, a prevented
 * Enter, and every other key fall through to the browser.
 */
export function shouldSubmitOnKey(ev: TextAreaKeyEventLike, hasOnEnter: boolean): boolean {
  if (!hasOnEnter) return false;
  if (ev.defaultPrevented) return false;
  return ev.key === 'Enter' && !ev.shiftKey;
}
