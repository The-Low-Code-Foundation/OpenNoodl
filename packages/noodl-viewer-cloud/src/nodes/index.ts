import NoodlRuntime from '@noodl/runtime';

export function registerNodes(runtime: NoodlRuntime) {
  [
    require('./cloud/request'),
    require('./cloud/response'),
    require('./cloud/sendemail'),

    /**
     * CWF-009 — `Secret`. Registered here rather than in `@noodl/runtime`'s
     * shared list for the one reason that matters: the shared list reaches
     * every runtime, and a Secret node in a browser bundle is a secret in a
     * browser bundle. See the module comment on `cloud/secret.ts`.
     */
    require('./cloud/secret'),

    /**
     * CWF-010 — the three crypto nodes that take a KEY. Hash, Random Bytes and UUID are in the
     * shared runtime because none of them does; these are here because a key in a browser is a
     * key in the hands of everyone who opens the page. JWT Verify is here for the same reason:
     * an HS256 key is a shared secret, so verifying in a browser means shipping it.
     */
    require('./cloud/hmac'),
    require('./cloud/jwtsign'),
    require('./cloud/jwtverify'),

    require('./data/aggregatenode'),

    /**
     * CWF-003 — `HTTP Request`, the modern HTTP node.
     *
     * Registered **here** rather than by uncommenting the shared list in `noodl-runtime.ts`:
     * `noodl-viewer-react/src/register-nodes.js` already requires this same module for the
     * browser, so uncommenting the shared line would register it twice there. Until this line, a
     * cloud function's only HTTP node was the deprecated `REST2` — which the picker hides,
     * because it carries `deprecated: true`. So server-side HTTP was, in practice, unreachable
     * without a Function node.
     *
     * Two things this depends on, both checked rather than assumed:
     *
     *  - **The transport is `fetch`, unconditionally** (`httpnode.ts:697`) — there is no
     *    `XMLHttpRequest` branch to guard, unlike `cloudfunction2.ts`. Node 22 supplies `fetch`,
     *    `FormData`, `Blob` and `Headers` as globals in this process (TALK-007 §3.2 measured
     *    them inside a real cloud function), so the multipart path has what it needs too.
     *  - **The editor-connection listeners are inert here.** The shared comment said the node was
     *    "moved to viewer for debugging", which invited the guess that its `setup()` was the
     *    reason. It is not: `setup()` returns immediately unless
     *    `context.editorConnection.isRunningLocally()` — the same guard `restnode`,
     *    `filtercollectionnode` and eight other already-shared nodes carry — and the cloud
     *    runtime only sets `isRunningLocally` when it was asked to connect to an editor, which
     *    the backend never does.
     */
    require('@noodl/runtime/src/nodes/std-library/data/httpnode')
  ].forEach(function (nodeDefinition) {
    runtime.registerNode(nodeDefinition);
  });
}
