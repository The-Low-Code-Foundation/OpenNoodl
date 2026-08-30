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
 *    later, or live only on the running backend.
 *  - A write inside a HELPER this function reaches through `Run Tasks` is not
 *    seen — the predicate is per-graph. The template's own doors all write in
 *    their endpoint graph or are non-public; widening to transitive reach is a
 *    corpus decision for the day a measured instance exists.
 *
 * ## What changed under it, 2026-08-30 (DEF-009 AC4)
 *
 * 🔴 **This warning used to end by saying the class bucket was "the only bound",
 * and that sentence is now false.** Richard ruled that a public, record-writing
 * cloud function with no `rateLimit` gets a real default — **60/min, burst 30,
 * per caller** (`nodegx-backend/security/model.ts`'s
 * `PUBLIC_WRITE_DEFAULT_RATE_LIMIT`), the `auth` rung of the ladder the product
 * already has. So the endpoint this fires on is no longer unmetered, and the
 * warning's job narrowed: it tells the author their door is public, writes rows,
 * and is running on a number **nobody chose for it** — which is the right
 * warning for a contact form and an urgent one for a provider webhook.
 *
 * ⚠️ **The default's list of record-writing types is a second copy of
 * {@link RECORD_WRITE_NODE_TYPES}**, in a package this one cannot import. They
 * are held equal by `nodegx-backend/tests/def009-public-write-default.test.ts`,
 * which reads this file. If you edit the list here, that spec is what tells you
 * the other half did not follow.
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

  // 🔴 Two states reach this line and they are no longer the same state. A door
  // with NOTHING declared runs on the backend's public-write default; a door
  // carrying a deliberate zeroed policy — the limiter's "unlimited" convention —
  // runs on nothing at all. Telling the second author they are bounded at 60/min
  // would be exactly the sentence AC4 had to come back and correct in this file.
  const optedOut = limit !== undefined && limit !== null;
  const budget = optedOut
    ? 'you have declared { "ratePerMinute": 0, "burst": 0 } for it, which is the backend\'s way of saying no ' +
      'limit at all — so anyone holding the URL can write rows as fast as they can send requests. That is a ' +
      'real answer for a webhook a provider retries; it is the wrong one for a form.'
    : 'it is running on the public-write default of 60 requests a minute, burst 30, per caller, which is a ' +
      'number nobody chose for this door. If it is a form a person fills in, that is generous and you can ' +
      'leave it. If it is a webhook a payment or delivery provider calls back, a retry storm will be ' +
      'refused: say so explicitly.';

  return [
    {
      code: DiagnosticCode.PublicWriteDoorUnlimited,
      severity: 'warning',
      message:
        `"${functionName}" accepts unauthenticated calls (its Request node ticks Allow Unauthenticated) and ` +
        `writes records ("${writer.type}"), and no working rate limit is set for it — ${budget} ` +
        `Add \`"functions": { "${functionName}": { "rateLimit": { "ratePerMinute": 10, "burst": 10 } } }\` to ` +
        "the project's nodegx.security.json (numbers to taste, or 0/0 for no limit at all), or set it on a " +
        `running backend via PUT /admin/permissions/functions/${functionName}.`,
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
