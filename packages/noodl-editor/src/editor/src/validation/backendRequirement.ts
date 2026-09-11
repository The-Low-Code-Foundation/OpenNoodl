/**
 * AIB-007 — which nodes need a backend, and what to say when there isn't one.
 *
 * ## What the task doc asked for, and why this is not that
 *
 * AIB-007 slice 2 asks for a `requires: ['backend']` marker on catalog entries,
 * added by a `catalog:*` generator with a committed snapshot. That is a stale
 * mechanism twice over.
 *
 * **BCN-010 already built the reviewed table.**
 * `@noodl/backend-contract`'s `NODE_CAPABILITIES` binds node types to contract
 * capabilities, and its module note gives three reasons for a table over a
 * per-node field — the first two of which apply here verbatim: *"thirty claims
 * spread across twenty-two files in three packages cannot be reviewed the way
 * one table can"*, and half the ports are pushed at runtime anyway. Adding a
 * second, generated claim about the same nodes would put the product one
 * generator run away from two answers to one question.
 *
 * **And it answers a different question.** `NODE_CAPABILITIES` says *which
 * capability of a backend* a node needs, which is a question about Directus vs
 * PocketBase. This module asks the coarser one — *does this node talk to the
 * project's backend at all* — and the two genuinely differ: `DbModel2` (Record)
 * is in BCN-010's `DELIBERATELY_UNBOUND` because fetch and save work on every
 * backend, and it still does nothing in a project with none.
 *
 * ## The completeness guard
 *
 * A hand-written table goes stale silently, which is the usual and fair
 * objection to one. So every node in the catalog's `Cloud Services` and `Cloud`
 * categories, and every key in `NODE_CAPABILITIES`, must appear in exactly one
 * of {@link NODES_REQUIRING_BACKEND} and {@link DELIBERATELY_BACKEND_FREE} —
 * asserted by `tests-unit/aib-007/backendRequirement.test.ts`. A cloud node
 * added to the catalog fails that test until somebody classifies it, which is
 * the property a generated field would have given us and the reviewability it
 * would not.
 *
 * ⚠️ Keyed by **registered type name**, never display label. Labels move
 * (BCN-010 moved two of them); type names appear in every saved project.
 *
 * @module noodl-editor/validation/backendRequirement
 */

import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';

/**
 * What a node needs from the project.
 *
 * `'backend:auth'` is a strictly stronger claim than `'backend'`: a project can
 * have a backend whose auth is not configured, and the sentence a user needs in
 * that case names sign-in rather than the backend.
 */
export type BackendRequirement = 'backend' | 'backend:auth';

/**
 * The table.
 *
 * Every row was checked against the node's own implementation or its
 * `docs/data/cloud-data/*` page, and the ones that were not checkable were put
 * in {@link DELIBERATELY_BACKEND_FREE} with a reason rather than guessed at —
 * the same bar BCN-010 set.
 */
export const NODES_REQUIRING_BACKEND: Readonly<Record<string, BackendRequirement>> = Object.freeze({
  // ── Cloud Data: records ───────────────────────────────────────────────────
  // Every one of these resolves a backend and issues a request. Without one
  // they fail at runtime with a connection error, which is the failure this
  // diagnostic exists to move earlier.
  DbCollection: 'backend',
  DbCollection2: 'backend',
  DbModel: 'backend',
  DbModel2: 'backend',
  NewDbModelProperties: 'backend',
  SetDbModelProperties: 'backend',
  DeleteDbModelProperties: 'backend',
  AddDbModelRelation: 'backend',
  RemoveDbModelRelation: 'backend',
  'noodl.cloud.aggregate': 'backend',

  // ── Cloud Data: realtime ──────────────────────────────────────────────────
  // Subscribe To Changes is browser-side and its entire function is to open a
  // channel to the project's backend. With none it subscribes to nothing and
  // reports nothing — the silent-success failure the Users note below calls
  // "worse than an error because it looks like it worked". BCN-010 binds it
  // `realtime.subscribe`, which is the same judgement at finer grain.
  SubscribeToChanges: 'backend',

  // ── Cloud Data: files ─────────────────────────────────────────────────────
  'Upload File': 'backend',
  'Sign File URL': 'backend',
  'Cloud File': 'backend',

  // ── Cloud functions, called from the app ──────────────────────────────────
  'Cloud Function': 'backend',
  CloudFunction2: 'backend',

  // ── Users ─────────────────────────────────────────────────────────────────
  // `backend:auth` throughout, including Log Out and User. BCN-010 leaves those
  // two unbound because ending a session is not a *capability* any descriptor
  // describes — a different question from this one. A "who is signed in" node in
  // a project with no backend has no session store to ask, and answers "no one"
  // forever, which is worse than an error because it looks like it worked.
  'net.noodl.user.LogIn': 'backend:auth',
  'net.noodl.user.LogOut': 'backend:auth',
  'net.noodl.user.SignUp': 'backend:auth',
  'net.noodl.user.User': 'backend:auth',
  'net.noodl.user.SetUserProperties': 'backend:auth',
  'net.noodl.user.SignInWith': 'backend:auth',
  'net.noodl.user.RequestMagicLink': 'backend:auth',
  'net.noodl.user.VerifyEmail': 'backend:auth',
  'net.noodl.user.SendEmailVerification': 'backend:auth',
  'net.noodl.user.ResetPassword': 'backend:auth',
  'net.noodl.user.RequestPasswordReset': 'backend:auth'
});

/**
 * Nodes that sit in a cloud category and need no backend, with the reason.
 *
 * Recorded rather than omitted for BCN-010's reason: the next reader will
 * otherwise re-derive each of these and add half of them. A test asserts this
 * list and {@link NODES_REQUIRING_BACKEND} are disjoint and together cover the
 * catalog's cloud categories.
 */
export const DELIBERATELY_BACKEND_FREE: Readonly<Record<string, string>> = Object.freeze({
  FilterDBModels:
    'Filters an array that is already in memory. It never issues a request — the fetch it filters the results ' +
    'of belongs to Query Records, which does carry the requirement.',

  // ── Cloud category, group 1: it has a deploy target by construction ───────
  // These run INSIDE a cloud function, in the backend process. They are not
  // client-side callers, and a project that has them has already decided it has
  // somewhere to deploy them; a diagnostic here would fire on every cloud
  // function in every project rather than on the case this task is about.
  //
  // ⚠️ This is a per-node classification, not a rule about the category, and it
  // must stay one. `noodl.cloud.aggregate` is cloud-only *and* carries
  // `'backend'` above, because it issues a real data request — so "category
  // Cloud ⇒ backend-free" is already false in this file. A sweep would also
  // destroy the property the completeness guard exists for: a new cloud node
  // should fail that test until somebody decides which of these it is.
  'noodl.cloud.request': 'Runs inside a cloud function; it reads that function\'s own request, not a backend.',
  'noodl.cloud.response': 'Runs inside a cloud function; it writes that function\'s own response.',
  'noodl.cloud.sendemail': 'Runs inside a cloud function, against the backend it is already deployed to.',
  // CWF-015's server-side users. Same argument as Send Email: they act on the
  // user store of the backend hosting the function, which exists because the
  // function is deployed to it.
  'noodl.cloud.createuser': 'Runs inside a cloud function, against the backend it is already deployed to.',
  'noodl.cloud.updateuser': 'Runs inside a cloud function, against the backend it is already deployed to.',
  'noodl.cloud.deleteuser': 'Runs inside a cloud function, against the backend it is already deployed to.',
  'noodl.cloud.verifysessiontoken':
    'Runs inside a cloud function; it checks a token against the session store of the backend hosting it.',
  // SPR-001 F86's role membership, deliberately a *separate* family from the four
  // above: `SystemUsers` documents and tests that it writes neither `_Role` nor
  // the join table, so role mutation got its own seam rather than invalidating
  // that invariant. Same backend-free argument though — they act on the role
  // store of the backend hosting the function.
  'noodl.cloud.addusertorole': 'Runs inside a cloud function, against the backend it is already deployed to.',
  'noodl.cloud.removeuserfromrole': 'Runs inside a cloud function, against the backend it is already deployed to.',
  'noodl.cloud.getuserroles': 'Runs inside a cloud function, against the backend it is already deployed to.',
  // 🔴 P80/DEF-005 (`ab677258`, 2026-08-31) added `List Users In Role` to the
  // catalog and not to this table, and `aib-007/backendRequirement.test.ts` has
  // been red ever since — read by P82 s23. Same family, same argument, same
  // `availableIn: ['cloud']`: it reads the role store of the backend hosting the
  // function, so a "you have no backend" diagnostic would be about the wrong
  // thing. The completeness guard is what caught it, which is the whole reason
  // this table is allowed to be hand-written.
  'noodl.cloud.listusersinrole': 'Runs inside a cloud function, against the backend it is already deployed to.',
  // CWF-009's Secret. Not the same claim as the group above: it reads the
  // hosting *process*’s own secret store through the `functions` namespace, so
  // it is not a request to a configured backend at all. Its real failure —
  // "works locally, 401s in production because nobody provisioned it" — is a
  // provisioning problem, and a "you have no backend" diagnostic names the
  // wrong thing.
  'noodl.cloud.secret':
    'Reads the hosting function process’s own secret store (the `functions` namespace), not a backend. ' +
    'An unprovisioned secret is a provisioning failure, not a missing backend.',

  // ── Cloud category, group 2: it reaches nothing at all ────────────────────
  // CWF-010's crypto kit. Pure computation over `node:crypto`. A strictly
  // stronger claim than group 1 — these would need no backend even if they ran
  // in a browser — and written separately so the two are not merged by the next
  // reader.
  'noodl.cloud.hmac': 'Pure computation over `node:crypto`. It reaches nothing.',
  'noodl.cloud.jwtsign': 'Pure computation over `node:crypto`. It reaches nothing.',
  'noodl.cloud.jwtverify': 'Pure computation over `node:crypto`. It reaches nothing.'
});

/** The requirement for a type, or `undefined`. */
export function backendRequirementFor(typeName: string): BackendRequirement | undefined {
  return Object.prototype.hasOwnProperty.call(NODES_REQUIRING_BACKEND, typeName)
    ? NODES_REQUIRING_BACKEND[typeName]
    : undefined;
}

/** A node as this check sees it — the same minimal shape `checkParameterValues` takes. */
export interface BackendRequiringNode {
  id: string;
  type: string;
  label?: string;
}

/**
 * What the project can offer, as the caller knows it.
 *
 * `plannedProvision` is the piece that makes this usable inside an AI plan run:
 * a plan that provisions a backend authors its pages *before* that backend
 * exists, and a diagnostic firing on every Sign Up node in a plan that is about
 * to create the very backend they need would be pure noise — and worse, would
 * push the authoring model to remove them.
 */
export interface ProjectBackendFacts {
  /** The project has cloud services configured today. */
  hasBackend: boolean;
  /** That backend has auth. Defaults to `hasBackend` — see {@link checkBackendRequirements}. */
  hasAuth?: boolean;
  /** A plan operation will create one before this candidate is applied. */
  plannedProvision?: { collections?: readonly string[]; needsAuth?: boolean };
  /**
   * The scoping conversation recorded `backend.kind === 'none'`.
   *
   * This is what makes the difference between an error and a warning, and the
   * asymmetry is deliberate. "You agreed there is no backend and then built a
   * Sign Up page" is a contradiction inside one session, and worth stopping. "No
   * backend is configured yet" is a state every project passes through on its
   * way to having one.
   */
  scopeSaidNone?: boolean;
}

export interface CheckBackendRequirementsOptions extends ProjectBackendFacts {
  /** Component identifier for the diagnostic location. */
  component: string;
}

/**
 * AIB-007 criterion 2 — a diagnostic naming the node and the missing
 * precondition.
 *
 * One diagnostic per node rather than one per component: the repair is per node
 * (drop it, or provision), and the AI repair loop is told to take diagnostics
 * literally, so a summary line would tell it to fix "the component".
 */
export function checkBackendRequirements(
  nodes: readonly BackendRequiringNode[],
  options: CheckBackendRequirementsOptions
): Diagnostic[] {
  const { component, hasBackend, plannedProvision, scopeSaidNone } = options;
  // A backend with no auth configured is not a state the editor can observe
  // from `cloudservices` — the endpoint says nothing about whether sign-up is
  // switched on. So `hasAuth` defaults to `hasBackend`: we claim ignorance
  // rather than reporting a problem we cannot see. A caller that DOES know
  // (a provision spec that did not ask for auth) passes it.
  const hasAuth = options.hasAuth ?? hasBackend;

  const willProvision = Boolean(plannedProvision);
  const willHaveAuth = plannedProvision?.needsAuth === true;

  const diagnostics: Diagnostic[] = [];
  for (const node of nodes) {
    const requirement = backendRequirementFor(node.type);
    if (!requirement) continue;

    const needsAuth = requirement === 'backend:auth';
    const satisfied = needsAuth ? hasAuth || willHaveAuth : hasBackend || willProvision;
    if (satisfied) continue;

    // An auth node in a project that has a backend but no sign-in is a
    // different sentence from an auth node in a project with no backend at all,
    // and the repair differs too.
    const backendPresent = hasBackend || willProvision;
    const severity: Severity = scopeSaidNone ? 'error' : 'warning';

    diagnostics.push({
      code: DiagnosticCode.MissingBackend,
      severity,
      message: message(node, needsAuth, backendPresent, scopeSaidNone === true),
      location: {
        component,
        nodeId: node.id,
        nodeType: node.type,
        ...(node.label ? { nodeLabel: node.label } : {})
      },
      suggestion: backendPresent
        ? 'Turn on sign-in for this project\'s backend in Backend Services.'
        : 'Add a backend in Backend Services, or let the build plan provision one.'
    });
  }
  return diagnostics;
}

function message(node: BackendRequiringNode, needsAuth: boolean, backendPresent: boolean, saidNone: boolean): string {
  const name = node.label ? `${node.label} (${node.type})` : node.type;
  if (needsAuth && backendPresent) {
    return `${name} signs people in, and this project's backend has no accounts configured.`;
  }
  const what = needsAuth ? 'needs a backend with user accounts' : 'reads and writes on a backend';
  const state = saidNone
    ? 'and this app was scoped with no backend'
    : 'and this project has no cloud services configured';
  return `${name} ${what}, ${state}.`;
}
