/**
 * The renderer's one door to `ipcRenderer` (F55).
 *
 * Twelve modules had written the same three lines — an `any` cast, an
 * eslint-disable for it, and `window.require('electron').ipcRenderer` — because
 * `window.require` is Electron's, not the DOM's, and nothing types it. Twelve
 * copies of a cast is twelve chances to make it differently, and it accounted
 * for a third of the editor's `any` markers on its own.
 *
 * **`window.require`, not `import 'electron'`.** The two are not equivalent
 * here: the import form is bundled by webpack, the `window.require` form is
 * resolved by Electron at runtime, and every backend-facing module in this
 * codebase deliberately uses the second. This module preserves that exactly —
 * it is a de-duplication, not a change of mechanism.
 *
 * **It is guarded, because the editor's specs run outside Electron.** The
 * Jasmine suite renders these panels in a plain renderer with no `require`, and
 * a panel must not fail to mount over an IPC channel it only uses to stay
 * fresh. `getIpc()` answers `null` there; `ipcInvoke` throws only when a caller
 * genuinely needs an answer it cannot get.
 *
 * @module noodl-editor/utils/ipc
 */

/** What the renderer actually uses of `ipcRenderer`. */
export interface IpcRendererLike {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (event: unknown, ...args: never[]) => void): void;
  removeListener(channel: string, listener: (event: unknown, ...args: never[]) => void): void;
}

/**
 * `ipcRenderer`, or `null` when there is no Electron around us.
 *
 * The one place in the renderer that is allowed to reach through `window` for
 * it — hence the one `any`.
 */
export function getIpc(): IpcRendererLike | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.require !== 'function') return null;
  try {
    return (w.require('electron')?.ipcRenderer as IpcRendererLike) ?? null;
  } catch {
    return null;
  }
}

/**
 * `ipcRenderer`, or throw.
 *
 * For call sites whose whole purpose is an IPC round trip: they have nothing to
 * fall back to, and a thrown error naming the channel beats `undefined` two
 * frames later.
 */
export function requireIpc(channel?: string): IpcRendererLike {
  const ipc = getIpc();
  if (!ipc) {
    throw new Error(
      channel
        ? `Cannot reach the main process for "${channel}" — no ipcRenderer in this window.`
        : 'Cannot reach the main process — no ipcRenderer in this window.'
    );
  }
  return ipc;
}

/** `ipcRenderer.invoke`, typed at the call site rather than cast at each one. */
export async function ipcInvoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  return (await requireIpc(channel).invoke(channel, ...args)) as T;
}
