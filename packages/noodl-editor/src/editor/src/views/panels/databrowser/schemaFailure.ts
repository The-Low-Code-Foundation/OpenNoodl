/**
 * Why the Data Browser could not list a backend's tables.
 *
 * ## The defect this exists to remove (AAQ-011 / F11)
 *
 * `DataBrowser.loadTables` used to wrap `ipcRenderer.invoke('backend:getSchema')`
 * in one `try/catch` and set the string `'Failed to load tables'` on any
 * rejection. Four different situations arrived at that line, and the user was
 * told the same thing about all four:
 *
 *   1. no backend has been selected at all (`backendId` is `undefined`),
 *   2. the selected backend has since been deleted,
 *   3. the backend exists but is not running (or is still starting),
 *   4. the backend is running and the admin request genuinely failed.
 *
 * Only (4) is "failed to load tables". (1) is not an error at all — it is an
 * empty state with an action. And the main process cannot help: `requireRunning`
 * throws the *same* `Backend must be running to get schema` for a missing id, an
 * unknown id and a stopped backend, which was verified live before this was
 * written. So the classification has to happen here, from two extra facts the
 * renderer can ask for: does the backend still exist (`backend:get` returns
 * `null` when it does not) and what does `backend:status` say.
 *
 * ## Why it is a separate, pure module
 *
 * Everything below is a function of data. Keeping it out of the React component
 * means the wording and the ladder can be tested without Electron, a renderer or
 * a running backend — see `tests-unit/aaq-011/schemaFailure.test.ts`.
 *
 * @module panels/databrowser/schemaFailure
 */

/** The shape `backend:status` returns. Everything is optional on purpose: this
 *  is an IPC payload, and a partial one must degrade rather than throw. */
export interface BackendStatusLike {
  running?: boolean;
  persistence?: {
    mode?: string;
    error?: { message?: string } | null;
  } | null;
}

export type SchemaFailure =
  /** Nothing is selected. Not an error — the panel shows a picker instead. */
  | { kind: 'no-selection' }
  /** A backend was selected, but it is not on disk any more. */
  | { kind: 'missing'; message: string }
  /** It exists and is stopped, failed to start, or is still starting. */
  | { kind: 'not-running'; message: string }
  /** It is running and the request still failed. This one is the real one. */
  | { kind: 'failed'; message: string };

/**
 * Electron wraps a main-process throw as
 * `Error invoking remote method 'backend:getSchema': Error: <the real message>`.
 * Showing that to a user buries the only useful part in IPC plumbing.
 */
export function stripIpcErrorPrefix(raw: string): string {
  const withoutInvoke = raw.replace(/^Error invoking remote method '[^']*':\s*/, '');
  return withoutInvoke.replace(/^(?:[A-Za-z]*Error(?:\s\[[^\]]+\])?):\s*/, '').trim();
}

/** What to call the backend at the start of a sentence. */
function subject(backendName?: string): string {
  const trimmed = backendName?.trim();
  return trimmed ? `“${trimmed}”` : 'This backend';
}

/** The same thing mid-sentence, where the fallback must not be capitalised. */
function object(backendName?: string): string {
  const trimmed = backendName?.trim();
  return trimmed ? `“${trimmed}”` : 'this backend';
}

export interface DescribeSchemaFailureInput {
  /** The id the panel is pointed at, if any. */
  backendId?: string;
  /** The display name, for the sentence. */
  backendName?: string;
  /** `backend:get` returned metadata — i.e. the backend is still on disk. */
  exists: boolean;
  /** `backend:status`, or `null` when that call itself failed. */
  status: BackendStatusLike | null;
  /** The rejection from `backend:getSchema`, verbatim. */
  rawMessage: string;
}

/**
 * Turn a `backend:getSchema` rejection into something the user can act on.
 *
 * The order matters and is the point: "no selection" beats "missing" beats "not
 * running" beats "failed", because each earlier answer explains the later ones
 * away. Asking `status.running` first would report a *deleted* backend as merely
 * stopped, and reporting the raw message first would report all four as broken —
 * which is the bug.
 */
export function describeSchemaFailure({
  backendId,
  backendName,
  exists,
  status,
  rawMessage
}: DescribeSchemaFailureInput): SchemaFailure {
  if (!backendId) return { kind: 'no-selection' };

  if (!exists) {
    return {
      kind: 'missing',
      message: `${subject(backendName)} is not there any more — it may have been deleted. Pick another one in Backend Services.`
    };
  }

  // `status === null` means the status call failed too, which tells us nothing
  // about the backend; fall through to the honest "it failed" branch rather than
  // inventing a diagnosis.
  if (status && status.running !== true) {
    const startError = status.persistence?.error?.message?.trim();
    if (startError) {
      return {
        kind: 'not-running',
        message: `${subject(backendName)} could not start: ${startError}`
      };
    }

    // Deliberately "not running yet". A backend the editor is in the middle of
    // starting (AAQ-011/F10 starts a project's backend on open) reports
    // `running: false` for the second or two before it binds, and this sentence
    // has to be true then as well as when it is simply stopped.
    return {
      kind: 'not-running',
      message: `${subject(backendName)} is not running yet. Start it in Backend Services, then try again.`
    };
  }

  const detail = stripIpcErrorPrefix(rawMessage);
  return {
    kind: 'failed',
    message: detail
      ? `Could not read the tables in ${object(backendName)}: ${detail}`
      : `Could not read the tables in ${object(backendName)}.`
  };
}
