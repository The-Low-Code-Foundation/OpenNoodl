/**
 * The `publicToken` visibility finding — BCN-009's contribution to OPS-006.
 *
 * ## What this is, and what it deliberately is not
 *
 * A published `publicToken` is exactly the case
 * [OPS-006](../../../../../../../dev-docs/tasks/phase-31-readiness-and-operations/OPS-006-SECURITY-SWEEP.md)
 * exists to catch: "a key on a frontend node ships to every visitor", except
 * that this one is not on a node — it is project metadata, entered in the
 * Backend Services panel, and copied into the deployed app. BCN-009's job is to
 * **produce the input**; OPS-006 owns the sweep, the severity ladder, the
 * dismissal record and the deploy interlock.
 *
 * ⚠️ **OPS-003 has not been built.** The findings store, the `Finding` schema
 * and everything that reads it are specced and unstarted — there is no
 * `.findings/` directory, no writer, and nothing in `packages/` that mentions
 * one. BCN-009's step 6 says "register the finding with OPS-003's findings
 * store", and there is no store to register with.
 *
 * So this file does the only honest version of that: it is the **check**, as a
 * pure function over the project's configured backends, returning the facts a
 * finding needs and nothing more. It writes nothing, persists nothing, and
 * builds no second findings mechanism — which is the one thing BCN-009's spec
 * is explicit about not doing.
 *
 * **When OPS-003 lands**, `SecurityFindingInput` is what OPS-006 maps onto a
 * `Finding` with `source: 'builder'`, and `dismissalKey` is what makes a
 * dismissal survive the second sweep. Nothing here should need rewriting; the
 * shapes were chosen against OPS-003 §1 and OPS-006 §2 as specced.
 *
 * The panel consumes the same function to decide which cards say "this ships
 * with your app", so the check is exercised by the product rather than sitting
 * dormant waiting for a consumer.
 *
 * @module BackendServices/securityFindings
 */

import type { BackendType } from '@noodl/backend-contract';

import { securityFor } from './security';
import { BackendConfig } from './types';

/**
 * The check id. One per class of finding, stable forever, because dismissals
 * are keyed on it and a renamed check un-dismisses everybody's dismissals.
 */
export const PUBLIC_TOKEN_VISIBLE_CHECK = 'security.backend-public-token-visible';

/**
 * OPS-006's severity vocabulary, as specced in its §2 table.
 *
 * Declared here rather than imported because OPS-006 does not exist yet. When it
 * does, this alias is deleted and the import takes its place — it is three
 * words, and duplicating three words is cheaper than either blocking BCN-009 on
 * an unstarted phase or inventing a fourth level that then has to be reconciled.
 */
export type SecurityFindingSeverity = 'critical' | 'high' | 'medium';

/**
 * What a check produces. Not a `Finding` — a finding also needs an id, a
 * timestamp, a status and a capture context, and all four are the store's to
 * assign.
 */
export interface SecurityFindingInput {
  /** Which check produced this. */
  check: string;
  severity: SecurityFindingSeverity;
  /** One line, in the user's language. Shown as the finding's title. */
  title: string;
  /**
   * The body. Written to be read by somebody about to publish, not by us —
   * this is the disclosure prose from `./security.ts`, which is the point:
   * the panel and the security sweep say the same thing in the same words.
   */
  detail: string;
  /**
   * Where to send the user. The Backend Services panel, pointed at one backend.
   *
   * OPS-006's click-through is graph-anchored (`focusNodeId`), and this finding
   * has no node — a backend binding is project metadata. `panelId` + `backendId`
   * is the anchor it does have, and saying so is better than inventing a node id.
   */
  anchor: { panelId: string; backendId: string; backendName: string; backendType: BackendType };
  /**
   * Stable across runs, so that a dismissal survives the next sweep.
   *
   * Keyed on the backend id rather than on the token, so that *rotating* a token
   * does not silently keep a dismissal that was made about a different secret —
   * a dismissal says "this key is safe to publish", and a new key has not earned
   * that. Hence the token fingerprint in the key too.
   */
  dismissalKey: string;
}

/** The panel a `publicToken` finding sends you to. */
const BACKEND_SERVICES_PANEL_ID = 'backend-services';

/**
 * A short, non-reversible marker for a token, so a dismissal can tell one token
 * from the next without the token itself ever being stored.
 *
 * Deliberately **not** the token and not a prefix of it. OPS-003 §4's rule is
 * that redaction is a whitelist, and the safest whitelist for a secret is a
 * length and a cheap hash. This is not a security primitive — it is an equality
 * marker — and it must never be used as one.
 */
export function tokenFingerprint(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 31 + token.charCodeAt(i)) | 0;
  }
  return `${token.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * Every backend in this project whose configuration puts something into the
 * published app that a visitor can read and act with.
 *
 * Two backends never produce a finding however they are configured — the
 * built-in one and Parse both publish an app id, which names a server and opens
 * nothing on its own. PocketBase produces one only if the user filled in a token
 * it did not ask for. That asymmetry is the whole reason the check reads the
 * disclosure table instead of testing `auth.publicToken` for truthiness.
 */
export function collectPublicTokenFindings(backends: readonly BackendConfig[]): SecurityFindingInput[] {
  const findings: SecurityFindingInput[] = [];

  for (const backend of backends) {
    const token = backend.auth?.publicToken?.trim();
    if (!token) continue;

    const disclosure = securityFor(backend.type);
    if (disclosure.publishedCredential === 'app-id' || disclosure.publishedCredential === 'none') {
      // An app id in this field would be published, but it is not a credential —
      // publishing it is the design rather than a mistake.
      continue;
    }

    findings.push({
      check: PUBLIC_TOKEN_VISIBLE_CHECK,
      severity: 'critical',
      title: `"${backend.name}" publishes a key that every visitor can read`,
      detail: `${disclosure.visitorsCanSee} ${disclosure.rulesAreSet}`,
      anchor: {
        panelId: BACKEND_SERVICES_PANEL_ID,
        backendId: backend.id,
        backendName: backend.name,
        backendType: backend.type
      },
      dismissalKey: `${PUBLIC_TOKEN_VISIBLE_CHECK}:${backend.id}:${tokenFingerprint(token)}`
    });
  }

  return findings;
}

/** Does this one backend, as configured, publish a key a visitor can act with? */
export function publishesReadableKey(backend: BackendConfig): boolean {
  return collectPublicTokenFindings([backend]).length > 0;
}
