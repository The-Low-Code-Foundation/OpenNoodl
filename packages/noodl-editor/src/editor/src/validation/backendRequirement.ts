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
  DbConfig:
    'Reads the project\'s own cloud-services config and reports whether one is set. It is the node you would ' +
    'use to check, so it must work when the answer is "there is none".',
  FilterDBModels:
    'Filters an array that is already in memory. It never issues a request — the fetch it filters the results ' +
    'of belongs to Query Records, which does carry the requirement.',
  // The three Cloud-category nodes run INSIDE a cloud function, in the backend
  // process. They are not client-side callers, and a project that has them has
  // already decided it has somewhere to deploy them; a diagnostic here would
  // fire on every cloud function in every project rather than on the case this
  // task is about.
  'noodl.cloud.request': 'Runs inside a cloud function; it reads that function\'s own request, not a backend.',
  'noodl.cloud.response': 'Runs inside a cloud function; it writes that function\'s own response.',
  'noodl.cloud.sendemail': 'Runs inside a cloud function, against the backend it is already deployed to.'
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
