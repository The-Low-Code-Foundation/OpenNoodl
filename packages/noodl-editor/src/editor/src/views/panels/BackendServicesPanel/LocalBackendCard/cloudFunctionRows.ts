/**
 * DEF-047 — **the rows the cloud-functions section draws, as one list.**
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **A STALE FUNCTION USED TO RENDER TWICE — a green ✓ and a warning triangle, one line
 * apart.** `CloudFunctionsSection` mapped `backendFunctions` for the ticks and, immediately
 * below, mapped `stale` for the warnings; `stale` is a SUBSET of `backendFunctions`, so a
 * function the backend serves that the project no longer has appeared as a healthy row *and*
 * as a problem row in the same list. Found by DEF-015 s12 in its own AC2 control frame and
 * visible in its screenshot; the panel has shipped that way.
 *
 * 🔴 **THE FIX IS NOT A FILTER, IT IS ONE LIST.** Filtering `stale` out of the tick map would
 * have closed this instance and left the shape that produced it: five sibling `.map()` calls
 * over four overlapping arrays, where any future bucket can overlap any other and nothing
 * says so. Here every visible row is produced ONCE, by one pass, so a name appearing twice
 * is not a bug to be re-fixed — it is unrepresentable. The section renders `rows.map(...)`
 * and chooses an icon from `kind`; it does no classification of its own.
 *
 * ⚠️ **This is also the only reason the section is gradeable at all.** `tests-unit` is a
 * plain-Node runner — no jsdom, no `@testing-library/react` — so a component that calls hooks
 * and renders `Icon` cannot be mounted there. A function returning plain objects can, which
 * is the same move LGC-008 made with `buildTabWorkspaces` and for the same reason.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @module BackendServicesPanel/LocalBackendCard/cloudFunctionRows
 */

import type { CloudComponentClassification } from '../../../../utils/exporter/cloudFunctions';

/**
 * Which of the five things a row can be saying. The section maps this to an icon and a tone;
 * nothing else may.
 */
export type CloudFunctionRowKind = 'live' | 'missing' | 'stale' | 'workers' | 'unreachable';

export interface CloudFunctionRow {
  kind: CloudFunctionRowKind;
  /** React key — unique across the whole list, which is what a single map lets us promise. */
  key: string;
  /** The `data-test` attribute a drive reaches this row by. Unchanged from before DEF-047. */
  testId: string;
  /** The whole visible sentence, so no wording lives in the JSX. */
  text: string;
}

export interface CloudFunctionRowsInput {
  backendId: string;
  /** The project's `/#__cloud__/` components, each with the role DEF-015 gave it. */
  cloudComponents: readonly CloudComponentClassification[];
  /** What `GET /admin/workflows` says this backend is serving, right now. */
  backendFunctions: readonly string[];
}

export interface CloudFunctionRowsResult {
  rows: CloudFunctionRow[];
  /**
   * Endpoints in the project, for the backend-stopped sentence. Counted here rather than in
   * the view so that "how many are there" and "which rows are drawn" cannot disagree.
   */
  endpointCount: number;
}

/**
 * Classify every function the backend serves and every cloud component the project holds into
 * one ordered list of rows — at most one row per name.
 *
 * ## The three buckets, and why `stale` is measured against the WHOLE project
 *
 * - **`live`** — the backend serves it and the project has it. Matched against *every* cloud
 *   component, whatever its role, because the sentence a tick makes is *"this is here"* and a
 *   worker the backend happens to report is here.
 * - **`missing`** — an **endpoint** the backend is not serving. Endpoints only, which is
 *   DEF-015's whole point: a worker has no route to be absent from, and diffing on the full
 *   list put a warning triangle under every helper in every project, permanently, immediately
 *   after a successful deploy.
 * - **`stale`** — the backend serves it and the project has **no component of that name at
 *   all**.
 *
 * 🔴 **`stale` is deliberately NOT `backendFunctions` minus `endpoints`.** That set can
 * contain a name the project *does* hold as a worker, and the row's sentence — *"on this
 * backend, not in the project"* — would then be false. On the measured population the two
 * definitions coincide (the backend's list is the components holding a Request node, so it
 * reports endpoints), which is exactly why the difference is worth writing down rather than
 * discovering later: this is the definition under which every sentence the section says is
 * true, including on a population nobody has produced yet.
 *
 * Order is the shipped order — live, missing, stale, workers, unreachable — because a drive
 * and a screenshot both read it.
 */
export function cloudFunctionRows({
  backendId,
  cloudComponents,
  backendFunctions
}: CloudFunctionRowsInput): CloudFunctionRowsResult {
  const endpoints = cloudComponents.filter((c) => c.role === 'endpoint').map((c) => c.name);
  const workers = cloudComponents.filter((c) => c.role === 'worker');
  const unreachable = cloudComponents.filter((c) => c.role === 'unreachable');
  const inProject = new Set(cloudComponents.map((c) => c.name));

  const rows: CloudFunctionRow[] = [];

  for (const name of backendFunctions) {
    // The one place a backend-reported name is decided, so it cannot also be decided below.
    if (inProject.has(name)) {
      rows.push({ kind: 'live', key: `live-${name}`, testId: `cloud-function-live-${name}`, text: name });
    } else {
      rows.push({
        kind: 'stale',
        key: `stale-${name}`,
        testId: `cloud-function-stale-${name}`,
        text: `${name} — on this backend, not in the project`
      });
    }
  }

  const served = new Set(backendFunctions);
  for (const name of endpoints) {
    if (served.has(name)) continue;
    rows.push({
      kind: 'missing',
      key: `missing-${name}`,
      testId: `cloud-function-missing-${name}`,
      text: `${name} — in the project, not on this backend`
    });
  }

  // Counted rather than silenced. A worker has no endpoint to be absent from, so it can never
  // be "missing" — but one that has genuinely been deleted from the project is worth noticing,
  // and a number that drops is how you notice.
  if (workers.length > 0) {
    rows.push({
      kind: 'workers',
      key: `workers-${backendId}`,
      testId: `cloud-workers-${backendId}`,
      text: `${workers.length} ${workers.length === 1 ? 'worker' : 'workers'}, run in-process by these functions`
    });
  }

  // The classification's third bucket. Nothing can start these — no route, and no endpoint
  // reaches them — so this is the one case in the section where a warning is the honest answer.
  for (const c of unreachable) {
    rows.push({
      kind: 'unreachable',
      key: `unreachable-${c.componentName}`,
      testId: `cloud-component-unreachable-${c.name}`,
      text: `${c.name} — in the project, but nothing calls it and it has no endpoint`
    });
  }

  return { rows, endpointCount: endpoints.length };
}
