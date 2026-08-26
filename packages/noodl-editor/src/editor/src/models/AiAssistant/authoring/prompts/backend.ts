/**
 * SB-002 — the backend authoring doctrine, as one text both clients speak.
 *
 * ## Why this file exists
 *
 * Phase 76's scoping sweep measured the gap: the MCP's instructions teach
 * componentization for the frontend in four paragraphs and give the backend one
 * sentence — while the shipped prefab library already practices a rich idiom
 * (the `stripe` prefab is 17 cloud components, 3 levels deep; thin
 * Request/Response shells over shared helpers; a Settings component wrapping
 * `noodl.cloud.secret`). Nothing taught it, and the frontend guidance actively
 * misleads: "a component's interface is a Component Inputs node" is TRUE for a
 * cloud helper and FALSE for a cloud function, whose interface is the `params`
 * on its Request node.
 *
 * ## Why it is a result field and not an `instructions` paragraph
 *
 * The surface budget gate (`toolDisclosure.test.ts`) measures `tools/list`
 * PLUS `instructions`, and its headroom is ~57 tokens by design. A tool RESULT
 * is outside that gate however large — so this rides `get_project_info`
 * beside `authoringDoctrine`, the channel LAS-007 measured as the one a model
 * actually reads (what arrives gets read; what must be fetched does not).
 *
 * ## The four runtime rules
 *
 * SB-004 §7 deployed seven MCP-authored components to a real backend and drove
 * them from the outside. Four defects turned up that BOTH authoring doors had
 * passed, and they share a cause: a deployed backend has no editor connection,
 * and much of the runtime's helpfulness is behind `isRunningLocally()`. They
 * are in §"Four things a deployed graph does not do the way the canvas does"
 * because this text is the first thing an agent authoring a cloud function
 * reads; without them every such component is broken in at least one of four
 * ways, and rule 1's failure mode is a thirty-second 504 rather than an error.
 *
 * Same containment rule as `decomposition.ts`: this module imports NOTHING, so
 * `noodl-mcp/src/editor-deps.ts` can re-export it and both clients carry the
 * same bytes. The canonical prose model is
 * `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`; if the two disagree, that
 * page wins or that page changes.
 *
 * @module AiAssistant/authoring/prompts/backend
 */

/**
 * The backend doctrine, in Markdown, for `get_project_info`'s
 * `backendDoctrine` field.
 *
 * Every claim below is measured, not aspirational: the composition idiom is
 * proven by `nodegx-backend/tests/cloud-run-tasks-loop.test.ts`, the
 * helper-is-not-an-endpoint boundary by SB-003's suite, the runtime rule by
 * SB-001's `wrong-runtime-node` gate, and the step-auth trap is CWF-017/-014
 * behaviour recorded in BACKEND-AUTHORING-MODEL.md §"How they join".
 */
export const BACKEND_DOCTRINE_MD = `## The backend in one sentence

A workflow orchestrates; a cloud function computes; a workflow calls cloud functions.

## The runtime is the path

A component under \`#__cloud__/\` runs in the cloud runtime; everything else runs in the browser.
The two share no node set: browser nodes (Text, Group, Page…) do not exist in the cloud runtime and
cloud nodes (\`noodl.cloud.request\`, \`noodl.cloud.secret\`…) do not exist in the browser — the
write gate rejects a node in the wrong runtime (\`wrong-runtime-node\`), and a component instance
may only be placed inside a component of the same runtime.

## Function vs helper — two kinds of cloud component

- A cloud **function** is a cloud component whose graph holds a \`noodl.cloud.request\` node:
  Request in → logic → Response out. It is callable as \`POST /functions/<name>\` and from the
  app's Cloud Function node. **Its interface is the \`params\` on the Request node** (a
  comma-separated list of names, each becoming an output port) — NOT a Component Inputs node.
  Answer on every path with a \`noodl.cloud.response\`; a path that ends without one hangs the
  request until the timeout.
- A cloud **helper** is a cloud component with no Request node. It is not an endpoint — calling it
  by name 404s, and it never appears in the permissions panel. It is the unit of reuse: instantiate
  it from other cloud graphs (its interface IS Component Inputs/Outputs, like any component), or
  hand it to Run Tasks as the per-item template.

## Compose the backend the way you compose pages

The shipped prefab idiom, and the one to copy: thin function shells that receive the request and
delegate to shared helpers; one Settings helper wrapping \`noodl.cloud.secret\` so a credential is
read in exactly one place; nested names (\`Stripe/Subscriptions/Cancel\`) to group a family.
Secrets live in the backend's \`functions\` namespace — the only one a graph can read — and do not
travel with a deploy; provision them per environment.

## Auth at the boundary

The Request node's \`Allow Unauthenticated\` is the function's default rule; a per-function
\`call\` rule set in the Permissions panel overrides it. Two consequences worth wiring for:
a workflow step calls its function IN PROCESS with no session, so a step-called function needs
\`Allow Unauthenticated\` ticked (the panel rule cannot fix a failing step); and a function holding
the system user/role nodes (\`noodl.cloud.createuser\`, \`noodl.cloud.addusertorole\`…) with no
call rule falls back to that checkbox — which, ticked, is account creation for the open internet.

## Four things a deployed graph does not do the way the canvas does

Every one of these was found by running an MCP-authored cloud function on a real backend, and every
one was green through both authoring doors first. They share a cause worth stating on its own: **a
deployed backend has no editor connection**, and a surprising amount of the runtime's helpfulness is
behind \`isRunningLocally()\`.

**1. Declare a code node's custom signal outputs, or they are dead.** \`Outputs.done()\` is a call,
and it resolves only if \`out-done\` is on the node as a \`signal\` port. The editor derives those
ports by parsing the script and saves what it derived; the MCP door derives nothing. So an authored
\`JavaScriptFunction\` needs them written out —
\`"ports": [{ "name": "out-ok", "plug": "output", "type": "signal" }]\` beside the
\`functionScript\`. Undeclared, the script throws mid-run, no Response node is reached, and the
caller waits out the 30-second timeout. The built-in \`success\`/\`failure\` outcome outputs are
declared on the node type and always work — which is why this is invisible until you name your own
signal.

**2. A signal is not a promise that the values beside it have arrived.** Values are queued per input
name and drained a pass at a time, so a node triggered by one producer's signal can run before
another producer's value reaches it. A code node fed by **two** producers must therefore guard:
\`if (Inputs.items === undefined || Inputs.flag === undefined) return;\`. Returning is safe and
cheap — \`runOnValueChange\` is ticked by default, so a late value re-runs the node by itself.
**Acting on the incomplete first run is what cannot be undone.** Better still, prefer a chain to a
fan-out, so every consumer's values are at least one hop older than its trigger. ⚠️ This is why
\`receive\` is not the universal answer: it fires once every parameter output on the **Request node**
has updated, and says nothing about when those values reach a node three hops away.

**3. A \`Query Records\` node fetches once, unfiltered, when the graph is built.**
\`collectionName\` and \`visualFilter\` are parameters, and setting either schedules a fetch. That
first query has no \`qp-\` value, a rule with an undefined value is *dropped* rather than failed, and
a dropped rule is no \`where\` — every row in the class, delivered on \`fetched\` before your request
has done anything. For a query **with** a filter parameter, switch off the implicit triggers and
leave \`Do\` unwired, so the filter value arriving is the only trigger:
\`"runOnChange-collectionName": false, "runOnChange-querySettings": false\`. ⚠️ **Do the opposite for
an unfiltered query** — with those boxes off and no load-time fetch, the \`isEmpty\` output is never
flagged and reads \`true\` for a collection that has rows in it.

**4. \`points to\` cannot narrow anything from a cloud function, and it widens instead of failing.**
It is the one operator that needs the collection schema, the schema cache is never populated in the
cloud runtime, and the translator's refusal is reported through the editor connection that is not
there. The query then runs with no filter at all. **Use a plain id String and \`equal to\` for a link
a cloud function has to filter on.** Pointers are fine to write and fine to read back; it is
filtering on one that does not work here.

## Which one do I reach for?

"Run this now and answer the user" → a cloud function, called from the app. "Every night / when a
record changes / retry three times then wait" → a workflow, calling cloud functions to do the work.
Real work — records, HTTP, mail, code — always lives in a cloud function, never in a workflow step.
`;
