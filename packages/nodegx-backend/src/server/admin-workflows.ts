/**
 * Admin workflow-definition routes (WF-001) — CRUD over the workflow registry
 * plus run/cancel, proxied by the editor and driven by the MCP workflow tools.
 * All routes are `admin` access, mirroring admin-triggers.ts.
 *
 *   GET    /admin/workflow-defs              list
 *   POST   /admin/workflow-defs             create
 *   GET    /admin/workflow-defs/:id         get one
 *   PUT    /admin/workflow-defs/:id         update
 *   DELETE /admin/workflow-defs/:id         delete
 *   POST   /admin/workflow-defs/:id/run     run now (payload optional)
 *   POST   /admin/workflow-runs/:executionId/cancel   cancel an in-flight run
 *
 * @module nodegx-backend/server/admin-workflows
 */

import type { RequestContext } from './HttpServer';
import type { WorkflowSubsystem } from '../workflow/WorkflowSubsystem';
import { WorkflowConfigError } from '../workflow/WorkflowRegistry';
import type { WorkflowInput } from '../workflow/types';
import { HttpError, readJSONBody, sendJSON } from './http-util';

export class AdminWorkflowRoutes {
  constructor(private readonly getWorkflows: () => WorkflowSubsystem | null) {}

  private subsystem(): WorkflowSubsystem {
    const wf = this.getWorkflows();
    if (!wf) throw new HttpError(503, 'Workflow engine is not ready');
    return wf;
  }

  list(ctx: RequestContext): void {
    sendJSON(ctx.res, 200, { workflows: this.subsystem().registry.list() });
  }

  get(ctx: RequestContext): void {
    const def = this.subsystem().registry.get(ctx.params.id);
    if (!def) throw new HttpError(404, `No workflow "${ctx.params.id}"`);
    sendJSON(ctx.res, 200, { workflow: def });
  }

  async create(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    this.upsert(ctx, body as unknown as WorkflowInput, undefined, 201);
  }

  async update(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    this.upsert(ctx, body as unknown as WorkflowInput, ctx.params.id, 200);
  }

  private upsert(ctx: RequestContext, input: WorkflowInput, id: string | undefined, status: number): void {
    try {
      const def = this.subsystem().registry.upsert({ ...input, id: id || input.id });
      sendJSON(ctx.res, status, { workflow: def });
    } catch (e) {
      if (e instanceof WorkflowConfigError) throw new HttpError(400, e.message);
      throw e;
    }
  }

  delete(ctx: RequestContext): void {
    const ok = this.subsystem().registry.delete(ctx.params.id);
    if (!ok) throw new HttpError(404, `No workflow "${ctx.params.id}"`);
    sendJSON(ctx.res, 200, { deleted: true, id: ctx.params.id });
  }

  /** Run a workflow now (records as a 'manual' execution unless a body says otherwise). */
  async run(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const payload = (body && (body.payload as Record<string, unknown>)) || body || {};
    const { found, result } = await this.subsystem().run(
      ctx.params.id,
      { type: 'manual', source: `manual run of ${ctx.params.id}` },
      payload
    );
    if (!found || !result) throw new HttpError(404, `No workflow "${ctx.params.id}"`);
    sendJSON(ctx.res, 200, { run: result });
  }

  /** Cancel an in-flight run by its execution id. */
  cancel(ctx: RequestContext): void {
    const cancelled = this.subsystem().cancel(ctx.params.executionId);
    if (!cancelled) throw new HttpError(404, `No active run "${ctx.params.executionId}"`);
    sendJSON(ctx.res, 200, { cancelling: true, executionId: ctx.params.executionId });
  }
}
