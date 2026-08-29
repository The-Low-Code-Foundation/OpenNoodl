/**
 * DEF-009 (P76 F3) — a public write door with no rate limit, and nothing says so.
 *
 * The mechanism is not missing from the platform: `nodegx-backend` has one
 * per-function token-bucket limiter (`ops/rate-limit.ts`), settable per function
 * as `functions.<name>.rateLimit = { ratePerMinute, burst }` — in the project's
 * `nodegx.security.json` (seeded into a fresh backend) or live via
 * `PUT /admin/permissions/functions/<name>`. What was missing is any surface
 * that tells the AUTHOR the limit exists to set: the boot-time warnings fire on
 * service-wide configuration, never on this endpoint being unlimited, and the
 * shipped site-builder's `submitContactForm` is `call: "public"` with no
 * `rateLimit` — the evidence row the defect was filed from. The members-area
 * template is the counterexample: `claimAssociation` ships `5/min, burst 5`.
 *
 * Where it bites: the site owner who installs a template and gives out the URL.
 * A bot finds the contact form and writes rows until the disk is full — and the
 * one person who could have set a limit was never told there was one to set.
 *
 * ## The predicate
 *
 * Fires when ALL of:
 *  - the component is a cloud function (`/#__cloud__/` name) whose Request node
 *    ticks `allowNoAuth` — the graph's own public posture
 *    (`functionDeclarations.ts`: posture defaults from the graph),
 *  - the configured `call` posture does not override it shut (an entry of
 *    `authenticated`/`role:*`/`nobody` means the HTTP gate refuses anonymous
 *    calls before the graph runs — `security/model.ts::effectiveFunctionRule`),
 *  - the graph contains a record-writing node (see {@link RECORD_WRITE_NODE_TYPES},
 *    each entry re-checked against the catalog so a renamed node type ages out
 *    loudly rather than silently — the `COMMIT_PORTS` idiom),
 *  - and no `rateLimit` with `ratePerMinute > 0` is configured for the function.
 *
 * Negative arms are the acceptance: the same function WITH a `rateLimit`, and a
 * public READ-ONLY function, both produce nothing — a warning that fires on
 * every cloud function would be switched off within a week (DEF-009 AC3).
 *
 * ## What it deliberately does not do
 *
 *  - **`security` omitted (undefined) means "do not check"** — the convention
 *    `urlPaths`/`backend`/`interfaces` follow. A caller that cannot read the
 *    project root cannot tell a limited door from an unlimited one, and firing
 *    on members-area's `claimAssociation` — which IS limited — is the false
 *    positive that kills the rule. A caller that CAN read the root and finds no
 *    policy file passes `null`, which reads as "no function has an entry".
 *  - Warning severity, never blocking: the limit may legitimately be configured
 *    later, or live only on the running backend. Whether a public function's
 *    `rateLimit` should DEFAULT to something is Richard's ruling (DEF-009 §3.2),
 *    registered in phase 80's TASKS.md; this check is the diagnostic half only.
 *  - A write inside a HELPER this function reaches through `Run Tasks` is not
 *    seen — the predicate is per-graph. The template's own doors all write in
 *    their endpoint graph or are non-public; widening to transitive reach is a
 *    corpus decision for the day a measured instance exists.
 *
 * @module noodl-editor/validation/publicWriteDoor
 */

import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic } from './diagnostics';
import type { ParameterizedNode } from './parameterValues';

/** The cloud component name prefix, as `componentRuntimeOf` reads it. */
const CLOUD_PREFIX = '/#__cloud__/';

/** The Request node's stored type name. */
export const CLOUD_REQUEST_TYPE = 'noodl.cloud.request';

/**
 * The node types that create or mutate records. Narrower than DEF-004's
 * `COMMIT_PORTS` (which includes `response.send` — an answer, not a row) and
 * wider than `RECORD_WRITE_TYPES` in `cloudDynamicPorts.ts` (which serves port
 * derivation, not risk): a public door that can delete rows or rewrite
 * relations unmetered is the same standing invitation as one that inserts them.
 */
export const RECORD_WRITE_NODE_TYPES: readonly string[] = [
  'NewDbModelProperties',
  'SetDbModelProperties',
  'DeleteDbModelProperties',
  'AddDbModelRelation',
  'RemoveDbModelRelation'
];

/** One function's entry in `nodegx.security.json`'s `functions` block. */
export interface FunctionSecurityEntry {
  call?: string;
  rateLimit?: { ratePerMinute?: number; burst?: number } | null;
}

/** The `functions` block of a project's security policy. */
export type FunctionSecurityPolicy = Readonly<Record<string, FunctionSecurityEntry>>;

export interface CheckPublicWriteDoorOptions {
  /** Legacy name of the component being submitted. */
  component: string;
  /**
   * The project's per-function security policy (`functions` in
   * `nodegx.security.json`). **`undefined` means "do not check"; `null` means
   * "the project has no policy file"** — see the module docblock for why the
   * two must stay distinct.
   */
  security?: FunctionSecurityPolicy | null;
  /** The catalog, used only to age the write-node list loudly. */
  catalog?: CatalogIndex;
}

export function checkPublicWriteDoor(
  nodes: readonly ParameterizedNode[],
  options: CheckPublicWriteDoorOptions
): Diagnostic[] {
  const { component, security, catalog } = options;
  if (security === undefined) return [];
  if (!component.startsWith(CLOUD_PREFIX)) return [];

  const request = nodes.find((n) => n.type === CLOUD_REQUEST_TYPE);
  if (!request || request.parameters?.['allowNoAuth'] !== true) return [];

  const functionName = component.slice(CLOUD_PREFIX.length);
  const entry = security?.[functionName];
  if (entry?.call !== undefined && entry.call !== 'public') return [];

  const writeTypes = new Set(
    RECORD_WRITE_NODE_TYPES.filter((t) => !catalog || catalog.hasType(t))
  );
  const writer = nodes.find((n) => typeof n.type === 'string' && writeTypes.has(n.type));
  if (!writer) return [];

  const limit = entry?.rateLimit;
  if (limit && typeof limit.ratePerMinute === 'number' && limit.ratePerMinute > 0) return [];

  return [
    {
      code: DiagnosticCode.PublicWriteDoorUnlimited,
      severity: 'warning',
      message:
        `"${functionName}" accepts unauthenticated calls (its Request node ticks Allow Unauthenticated) and ` +
        `writes records ("${writer.type}"), and no rate limit is set for it — so anyone holding the URL can ` +
        'write rows as fast as they can send requests. The backend has a per-function limiter: add ' +
        `\`"functions": { "${functionName}": { "rateLimit": { "ratePerMinute": 10, "burst": 10 } } }\` to the ` +
        "project's nodegx.security.json (numbers to taste), or set it on a running backend via " +
        `PUT /admin/permissions/functions/${functionName}. The class default (600/min per caller) is the only ` +
        'bound until one of those is set.',
      location: {
        component,
        nodeId: request.id,
        nodeType: request.type,
        ...(request.label ? { nodeLabel: request.label } : {}),
        port: 'allowNoAuth',
        plug: 'input' as const
      }
    }
  ];
}
