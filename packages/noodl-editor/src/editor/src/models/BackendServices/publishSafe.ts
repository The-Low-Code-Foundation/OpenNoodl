/**
 * Keeping the admin credential out of anything published.
 *
 * ## The promise that was not being kept
 *
 * `BackendAuthConfig.adminToken` has carried this docstring since RUN-003:
 *
 * > Admin token for schema introspection (editor-only).
 * > **This token is NOT published to the deployed app.**
 *
 * ⚠️ It was. `exporter/json.ts` deep-copies the project's whole metadata object into
 * the export — `JSON.parse(JSON.stringify(project.metadata))` — and `backendServices`
 * is one of its keys, so every `backends[].auth.adminToken` shipped inside the deployed
 * bundle where any visitor could read it. Nothing stripped it anywhere; the promise
 * lived only in a comment. (The project's own `project.json` is *not* copied into a
 * deploy — `build/ignore.ts` excludes it by name — so the export JSON was the one and
 * only vector, which is why it went unnoticed.)
 *
 * Found by BCN-005's schema sync, whose whole reason for existing is that the editor
 * holds a credential a running app must never have. Storing the *answers* to admin-only
 * questions in the project is exactly right; storing the *key* is exactly what BCN-009's
 * security disclosure tells the user does not happen.
 *
 * ## Why stripping is safe, measured rather than assumed
 *
 * The runtime never reads any of these. Every adapter takes its credential from
 * `BackendHandle`, and `resolveBackend.ts::handleFor` builds one from **`publicToken`
 * and `sessionToken` only** — `adminToken`, `username` and `password` have no reader
 * anywhere in `noodl-runtime` or `noodl-viewer-react`. So a stripped export behaves
 * identically to an unstripped one, in the deployed app and in the editor's preview.
 *
 * ## What is *not* stripped, and why that is the honest line
 *
 * `publicToken` stays. It is published on purpose and `security.ts` says so on the card
 * before the user chooses the backend: "your Supabase anon key is published with your
 * app". Removing it would break every published app, and hiding a credential the
 * product has already told the user about is not a security improvement.
 *
 * @module BackendServices/publishSafe
 */

/** The credential fields that exist so the **editor** can ask privileged questions. */
const EDITOR_ONLY_CREDENTIALS = ['adminToken', 'username', 'password'] as const;

/**
 * A copy of the project's metadata with every editor-only credential removed.
 *
 * Takes and returns a plain object rather than a typed `BackendServicesMetadata`
 * because the caller is the exporter, which handles metadata as opaque JSON and must
 * not start depending on this module's types to do its job. Unknown shapes pass
 * through untouched: a metadata object with no `backendServices`, or a
 * `backendServices` that is not the shape this expects, is returned as it arrived
 * rather than rejected — an exporter is the wrong place to fail on a schema question.
 *
 * ⚠️ **Mutates nothing.** The exporter's copy is already a deep clone of the live
 * `ProjectModel.metadata`, but this is called by whoever wants a safe object and must
 * never be the reason a user's stored token disappears from the editor they are still
 * working in.
 */
export function withoutEditorOnlyCredentials<T>(metadata: T): T {
  const source = metadata as unknown as { backendServices?: { backends?: unknown[] } } | null | undefined;
  const backends = source?.backendServices?.backends;
  if (!Array.isArray(backends)) return metadata;

  return {
    ...(metadata as object),
    backendServices: {
      ...source!.backendServices,
      backends: backends.map((backend) => {
        const entry = backend as { auth?: Record<string, unknown> } | null;
        if (!entry || typeof entry !== 'object' || !entry.auth || typeof entry.auth !== 'object') return backend;

        const auth: Record<string, unknown> = { ...entry.auth };
        for (const key of EDITOR_ONLY_CREDENTIALS) delete auth[key];
        return { ...entry, auth };
      })
    }
  } as unknown as T;
}
