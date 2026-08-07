/**
 * Ambient globals the runtime reads but never declares.
 *
 * **This file must stay free of top-level `import`/`export`.** A declaration file with
 * either becomes a *module*, and its top-level declarations are then module-scoped rather
 * than global — which is exactly how `noodl-viewer-react/typings/global.d.ts` came to
 * declare a `Window` interface that had never been in effect (PLAT-003 NOTES §21.3). If
 * something here ever needs a type from `@noodl/types`, wrap the declarations in
 * `declare global { … }` rather than adding an import at the top.
 */

/**
 * Set only inside the cloud runtime bundle, where it carries that runtime's version.
 *
 * Seven runtime modules branch on it, always as `typeof _noodl_cloud_runtime_version ===
 * 'undefined'`, to tell "running in a browser viewer" from "running server-side in cloud
 * functions". It is genuinely absent in the browser, so the `typeof` guard is required —
 * a bare reference would throw a `ReferenceError` rather than read `undefined`.
 */
declare const _noodl_cloud_runtime_version: string | undefined;

/**
 * The backend credentials baked into a *deployed cloud-runtime* bundle.
 *
 * Read only on the branch `_noodl_cloud_runtime_version` has already selected, and always
 * behind its own `typeof … !== 'undefined'` guard, because the two are set independently:
 * a cloud runtime can exist without baked credentials, in which case the reader falls back
 * to whatever it holds on `this`.
 *
 * `masterKey` is present here and nowhere in the browser — this is the server-side path,
 * which is the only place a master key is allowed to appear.
 */
declare const _noodl_cloudservices:
  | {
      endpoint: string;
      appId: string;
      masterKey?: string;
    }
  | undefined;
