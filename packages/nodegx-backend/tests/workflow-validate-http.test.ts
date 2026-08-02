/**
 * WFA-007 — the dry run, against a real service.
 *
 * The review surface's whole premise is "a candidate that would be rejected on
 * save is never offered as a choice". That premise needs a way to ask a backend
 * whether it would accept a definition WITHOUT it accepting one — and until
 * this route, the only way to find out was to POST or PUT, which persists on
 * success.
 *
 * So the properties worth asserting are exactly two:
 *
 *  1. the answer agrees with what the write path would have done, and
 *  2. **nothing is written either way** — including for a definition that is
 *     perfectly valid, which is the case a careless implementation would get
 *     wrong by simply calling `upsert` and rolling back.
 *
 * Point 2 is also the boot-refusal trap closed at its source: a definition that
 * reaches `workflow-defs/` is one an operator's next restart has to survive.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type {
  WorkflowListResponse,
  WorkflowResponse,
  WorkflowValidateResponse
} from '../src/server/admin-workflows';
import { BackendService } from '../src/service';

import { ErrorBody, httpClient } from './helpers/http';

jest.setTimeout(30000);

describe('WFA-007 — POST /admin/workflow-defs/validate', () => {
  let dataDir: string;
  let service: BackendService;
  let base = '';
  let adminToken: string;
  const http = httpClient(() => base);
  let auth: Record<string, string>;

  const valid = {
    id: 'wf_dryrun',
    name: 'Dry run',
    entry: 'start',
    steps: [
      { id: 'start', kind: 'wait', params: { duration: 1 }, next: ['finish'] },
      { id: 'finish', kind: 'stop' }
    ]
  };

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wfa007-'));
    service = new BackendService({ dataDir, port: 0 });
    const started = await service.start();
    base = `http://127.0.0.1:${started.listen.port}`;
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
    auth = { authorization: `Bearer ${adminToken}` };
  });

  afterAll(async () => {
    await service?.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /** Everything the registry has actually persisted, from the live route. */
  async function persistedIds(): Promise<string[]> {
    const res = await http.get<WorkflowListResponse>('/admin/workflow-defs', auth);
    expect(res.status).toBe(200);
    return (res.json.workflows || []).map((w) => w.id).sort();
  }

  it('says a good definition is valid — and writes nothing', async () => {
    const before = await persistedIds();

    const res = await http.post<WorkflowValidateResponse>('/admin/workflow-defs/validate', valid, auth);
    expect(res.status).toBe(200);
    expect(res.json.valid).toBe(true);
    expect(res.json.errors).toEqual([]);

    // The case a rollback-style implementation gets wrong.
    expect(await persistedIds()).toEqual(before);
    expect(fs.existsSync(path.join(dataDir, 'workflow-defs', 'wf_dryrun.workflow-def.json'))).toBe(false);
  });

  it('reports every reason at once, as a 200 rather than a 400', async () => {
    // A 400 would be indistinguishable from the route being wrong. The caller
    // asked a question; "no, and here is why" is an answer.
    const res = await http.post<WorkflowValidateResponse>(
      '/admin/workflow-defs/validate',
      {
        id: 'wf_bad',
        entry: 'nope',
        steps: [
          { id: 'a', kind: 'wait', params: { duration: 0 } },
          { id: 'b', kind: 'not-a-kind' }
        ]
      },
      auth
    );
    expect(res.status).toBe(200);
    expect(res.json.valid).toBe(false);
    // Every distinct fault is named, not just the first.
    expect(res.json.errors.join('\n')).toMatch(/entry "nope" must name one of the steps/);
    expect(res.json.errors.join('\n')).toMatch(/unknown kind "not-a-kind"/);
    expect(res.json.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('agrees with the write path, in both directions', async () => {
    // Valid → the write is accepted.
    const write = await http.post<WorkflowResponse>('/admin/workflow-defs', valid, auth);
    expect(write.status).toBe(201);
    expect(write.json.workflow.id).toBe('wf_dryrun');

    // Invalid → the write is a 400 naming the same fault the dry run named.
    const bad = { id: 'wf_cycle', entry: 'a', steps: [{ id: 'a', kind: 'stop', next: ['a'] }] };
    const dry = await http.post<WorkflowValidateResponse>('/admin/workflow-defs/validate', bad, auth);
    expect(dry.json.valid).toBe(false);

    const rejected = await http.post<ErrorBody>('/admin/workflow-defs', bad, auth);
    expect(rejected.status).toBe(400);
    for (const error of dry.json.errors) expect(rejected.json.error).toContain(error);
  });

  it('validates an UPDATE against the definition that already exists', async () => {
    // `wf_dryrun` is on the backend from the previous spec. A dry run for an
    // update must not be confused by the id already being taken — and must
    // still leave the stored definition alone.
    const stored = await http.get<WorkflowResponse>('/admin/workflow-defs/wf_dryrun', auth);
    expect(stored.status).toBe(200);

    const res = await http.post<WorkflowValidateResponse>(
      '/admin/workflow-defs/validate',
      { ...valid, name: 'Renamed by a proposal', steps: [{ id: 'start', kind: 'stop' }] },
      auth
    );
    expect(res.status).toBe(200);
    expect(res.json.valid).toBe(true);

    const after = await http.get<WorkflowResponse>('/admin/workflow-defs/wf_dryrun', auth);
    expect(after.json.workflow.name).toBe('Dry run');
    expect(after.json.workflow.steps.length).toBe(2);
  });

  it('rejects a malformed id as an error rather than throwing', async () => {
    const res = await http.post<WorkflowValidateResponse>(
      '/admin/workflow-defs/validate',
      { id: 'not a legal id', entry: 'a', steps: [{ id: 'a', kind: 'stop' }] },
      auth
    );
    expect(res.status).toBe(200);
    expect(res.json.valid).toBe(false);
    expect(res.json.errors.join('\n')).toMatch(/must match/);
  });

  /**
   * Asserted as a COMPARISON rather than as "401 without a token".
   *
   * A fresh data directory is dev-open, so every `admin` route answers an
   * uncredentialed caller — asserting a 401 here would have failed for a reason
   * that has nothing to do with this route. What matters is that the dry run is
   * in the same access class as the writes it predicts: if one day the list
   * route refuses an anonymous caller, this one must refuse it too, and this
   * spec fails if they diverge.
   */
  it('has exactly the access its sibling workflow routes have', async () => {
    const anonymousValidate = await http.post<ErrorBody>('/admin/workflow-defs/validate', valid);
    const anonymousList = await http.get<ErrorBody>('/admin/workflow-defs');
    expect(anonymousValidate.status).toBe(anonymousList.status);

    const badToken = { authorization: 'Bearer definitely-not-the-admin-token' };
    const rejectedValidate = await http.post<ErrorBody>('/admin/workflow-defs/validate', valid, badToken);
    const rejectedList = await http.get<ErrorBody>('/admin/workflow-defs', badToken);
    expect(rejectedValidate.status).toBe(rejectedList.status);
    // A presented-and-wrong credential is always refused, dev-open or not.
    expect(rejectedValidate.status).toBe(401);
  });
});
