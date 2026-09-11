/**
 * DEF-047 — **a stale cloud function rendered twice, and nothing could see it.**
 *
 * The backend-services card drew a green ✓ for every function `GET /admin/workflows` reported
 * and, one line below, a warning triangle for the `stale` subset of that same list. So a
 * function the backend still serves that the project no longer has appeared as a healthy row
 * *and* as a problem row, one line apart. Found by DEF-015 s12 in its own AC2 control frame,
 * visible in its screenshot, shipped.
 *
 * ## What this file gates, and what it deliberately cannot
 *
 * `CloudFunctionsSection` cannot be mounted here: `tests-unit` is `testEnvironment: 'node'`
 * with no jsdom and no `@testing-library/react`, and `Icon` alone makes a spec fail *to run*
 * (`Tests: 0 total`). That is not an aside — it is the reason this defect survived: the
 * classification lived inside the JSX, where no runner in this repo could reach it. So the fix
 * moved it into `cloudFunctionRows`, which returns plain objects, and this file grades that.
 *
 * ⚠️ What it does NOT prove: that the JSX renders one `<li>` per row. That is now structural
 * rather than asserted — the view holds a single `rows.map(...)` and a `kind → icon` table
 * with no list of its own — and the shipped `data-test` ids are carried in the rows so a drive
 * still reaches each one by the name it always had.
 *
 * 🔴 **The absence assertions below are each paired with a presence control on the SAME call.**
 * "No live row for the stale name" would pass just as happily on a function that returned
 * nothing at all, so every case also names a row it must contain and asserts the total count.
 */

import {
  cloudFunctionRows,
  CloudFunctionRow,
  CloudFunctionRowKind
} from '../../src/editor/src/views/panels/BackendServicesPanel/LocalBackendCard/cloudFunctionRows';

const BACKEND = 'backend-1';

/** Rows of one kind, in the order they were produced. */
function ofKind(rows: CloudFunctionRow[], kind: CloudFunctionRowKind): CloudFunctionRow[] {
  return rows.filter((r) => r.kind === kind);
}

/** Every row whose text starts with this function name — the "how many times is it drawn" question. */
function rowsNaming(rows: CloudFunctionRow[], name: string): CloudFunctionRow[] {
  return rows.filter((r) => r.text === name || r.text.startsWith(`${name} —`));
}

describe('DEF-047 — cloudFunctionRows draws every function exactly once', () => {
  it('🔴 a function on the backend that the project does not have is ONE stale row, not a tick and a warning', () => {
    const { rows } = cloudFunctionRows({
      backendId: BACKEND,
      // The presence control rides along on the same call: `charge` is healthy, so the live
      // bucket is demonstrably firing in the very result where `ghost` must not appear in it.
      cloudComponents: [{ name: 'charge', componentName: '/#__cloud__/charge', role: 'endpoint' }],
      backendFunctions: ['charge', 'ghost']
    });

    expect(rows).toHaveLength(2);

    const ghost = rowsNaming(rows, 'ghost');
    expect(ghost).toHaveLength(1);
    expect(ghost[0].kind).toBe('stale');
    expect(ghost[0].text).toBe('ghost — on this backend, not in the project');
    expect(ghost[0].testId).toBe('cloud-function-stale-ghost');

    // The control, in the same breath: the healthy one IS ticked.
    const charge = rowsNaming(rows, 'charge');
    expect(charge).toHaveLength(1);
    expect(charge[0].kind).toBe('live');
    expect(charge[0].testId).toBe('cloud-function-live-charge');
  });

  it('no name is ever drawn twice, across every bucket at once', () => {
    const { rows } = cloudFunctionRows({
      backendId: BACKEND,
      cloudComponents: [
        { name: 'charge', componentName: '/#__cloud__/charge', role: 'endpoint' },
        { name: 'refund', componentName: '/#__cloud__/refund', role: 'endpoint' },
        { name: 'sendMail', componentName: '/#__cloud__/sendMail', role: 'worker' },
        { name: 'orphan', componentName: '/#__cloud__/orphan', role: 'unreachable' }
      ],
      backendFunctions: ['charge', 'ghost']
    });

    // live charge · stale ghost · missing refund · workers · unreachable orphan
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.kind)).toEqual(['live', 'stale', 'missing', 'workers', 'unreachable']);

    // 🔴 The cardinality assertion the old shape could not have passed: two producers of rows
    // that overlapped is exactly what this measures.
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.testId)).size).toBe(rows.length);

    for (const name of ['charge', 'refund', 'ghost', 'sendMail', 'orphan']) {
      expect(rowsNaming(rows, name).length).toBeLessThanOrEqual(1);
    }
  });

  it('an endpoint the backend is not serving is a missing row, and only endpoints are diffed (DEF-015)', () => {
    const { rows } = cloudFunctionRows({
      backendId: BACKEND,
      cloudComponents: [
        { name: 'charge', componentName: '/#__cloud__/charge', role: 'endpoint' },
        { name: 'sendMail', componentName: '/#__cloud__/sendMail', role: 'worker' }
      ],
      backendFunctions: []
    });

    const missing = ofKind(rows, 'missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].text).toBe('charge — in the project, not on this backend');
    expect(missing[0].testId).toBe('cloud-function-missing-charge');

    // DEF-015's whole point: the worker is counted, never warned about.
    expect(rowsNaming(rows, 'sendMail')).toHaveLength(0);
    expect(ofKind(rows, 'workers')).toHaveLength(1);
    expect(ofKind(rows, 'workers')[0].text).toBe('1 worker, run in-process by these functions');
    expect(ofKind(rows, 'workers')[0].testId).toBe(`cloud-workers-${BACKEND}`);
  });

  it('🔴 stale is measured against the WHOLE project, so its sentence is true of every name it draws', () => {
    // A backend reporting a name the project holds as a WORKER. `backendFunctions` minus
    // `endpoints` would call this stale and say "not in the project", which is false — it is
    // in the project, as a worker. ⚠️ The measured population is empty today (the backend
    // reports the components holding a Request node), which is why the difference is asserted
    // here rather than left to be discovered.
    const { rows } = cloudFunctionRows({
      backendId: BACKEND,
      cloudComponents: [{ name: 'sendMail', componentName: '/#__cloud__/sendMail', role: 'worker' }],
      backendFunctions: ['sendMail']
    });

    expect(ofKind(rows, 'stale')).toHaveLength(0);
    const sendMail = rowsNaming(rows, 'sendMail');
    expect(sendMail).toHaveLength(1);
    expect(sendMail[0].kind).toBe('live');
  });

  it('pluralises the worker count and keeps it out of the endpoint count', () => {
    const { rows, endpointCount } = cloudFunctionRows({
      backendId: BACKEND,
      cloudComponents: [
        { name: 'charge', componentName: '/#__cloud__/charge', role: 'endpoint' },
        { name: 'sendMail', componentName: '/#__cloud__/sendMail', role: 'worker' },
        { name: 'resize', componentName: '/#__cloud__/resize', role: 'worker' }
      ],
      backendFunctions: ['charge']
    });

    expect(ofKind(rows, 'workers')[0].text).toBe('2 workers, run in-process by these functions');
    // The backend-stopped sentence says "<n> in the project" and means endpoints — the number
    // and the rows come from one call so they cannot disagree.
    expect(endpointCount).toBe(1);
  });

  it('an unreachable component is keyed by its component name, so two with the same short name cannot collide', () => {
    const { rows } = cloudFunctionRows({
      backendId: BACKEND,
      cloudComponents: [
        { name: 'orphan', componentName: '/#__cloud__/orphan', role: 'unreachable' },
        { name: 'orphan', componentName: '/#__cloud__/site/orphan', role: 'unreachable' }
      ],
      backendFunctions: []
    });

    const unreachable = ofKind(rows, 'unreachable');
    expect(unreachable).toHaveLength(2);
    expect(new Set(unreachable.map((r) => r.key)).size).toBe(2);
    expect(unreachable[0].text).toBe('orphan — in the project, but nothing calls it and it has no endpoint');
  });

  it('CONTROL: an empty project and an empty backend produce no rows at all', () => {
    // Asserted so that every `toHaveLength(0)` above is read against a function that is
    // demonstrably capable of returning something — the section itself renders nothing here.
    const { rows, endpointCount } = cloudFunctionRows({
      backendId: BACKEND,
      cloudComponents: [],
      backendFunctions: []
    });
    expect(rows).toEqual([]);
    expect(endpointCount).toBe(0);
  });
});
