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
 *   GET    /admin/workflow-step-kinds       the WF-002 step-kind catalog
 *
 * @module nodegx-backend/server/admin-workflows
 */

import type { RequestContext } from './HttpServer';
import type { WorkflowSubsystem } from '../workflow/WorkflowSubsystem';
import { WorkflowConfigError } from '../workflow/WorkflowRegistry';
import { buildRunPayload, spreadableBody } from '../workflow/runPayload';
import { stepKindCatalog } from '../workflow/steps/kinds';
import type { WorkflowDefinition, WorkflowInput, WorkflowRunResult } from '../workflow/types';
import { HttpError, readJSONBody, sendJSON } from './http-util';

/** `GET /admin/workflow-defs`. */
export interface WorkflowListResponse {
  workflows: WorkflowDefinition[];
}

/** The body of every single-definition response (GET / POST / PUT). */
export interface WorkflowResponse {
  workflow: WorkflowDefinition;
}

/** `DELETE /admin/workflow-defs/:id`. */
export interface WorkflowDeletedResponse {
  deleted: boolean;
  id: string;
}

/** `POST /admin/workflow-defs/:id/run`. */
export interface WorkflowRunResponse {
  run: WorkflowRunResult;
}

export class AdminWorkflowRoutes {
  constructor(private readonly getWorkflows: () => WorkflowSubsystem | null) {}

  private subsystem(): WorkflowSubsystem {
    const wf = this.getWorkflows();
    if (!wf) throw new HttpError(503, 'Workflow engine is not ready');
    return wf;
  }

  /**
   * The step-kind catalog (WF-002): every kind this backend can run, with its
   * params, routes, output shape and prose. This is how an authoring agent — or
   * a human reading the API — discovers the step vocabulary, since a workflow
   * step is not a graph node and so cannot appear in SUB-004's node catalog.
   *
   * Deliberately does NOT go through `subsystem()`: the vocabulary is static,
   * and "what can I author?" must be answerable before the engine is ready.
   */
  stepKinds(ctx: RequestContext): void {
    sendJSON(ctx.res, 200, stepKindCatalog());
  }

  list(ctx: RequestContext): void {
    sendJSON(ctx.res, 200, { workflows: this.subsystem().registry.list() } satisfies WorkflowListResponse);
  }

  get(ctx: RequestContext): void {
    const def = this.subsystem().registry.get(ctx.params.id);
    if (!def) throw new HttpError(404, `No workflow "${ctx.params.id}"`);
    sendJSON(ctx.res, 200, { workflow: def } satisfies WorkflowResponse);
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
      sendJSON(ctx.res, status, { workflow: def } satisfies WorkflowResponse);
    } catch (e) {
      if (e instanceof WorkflowConfigError) throw new HttpError(400, e.message);
      throw e;
    }
  }

  delete(ctx: RequestContext): void {
    const ok = this.subsystem().registry.delete(ctx.params.id);
    if (!ok) throw new HttpError(404, `No workflow "${ctx.params.id}"`);
    sendJSON(ctx.res, 200, { deleted: true, id: ctx.params.id } satisfies WorkflowDeletedResponse);
  }

  /** Run a workflow now (records as a 'manual' execution unless a body says otherwise). */
  async run(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    // `{"payload": …}` is the documented form; a bare object is accepted as the
    // payload itself. WFA-003: whichever it was, the caller's data lands under
    // `body` — and stays spread at the top level as the deprecated legacy view,
    // which is the shape every workflow authored before this reads.
    const callerData = (body && (body.payload as Record<string, unknown>)) || body || {};
    const payload = buildRunPayload({
      type: 'manual',
      body: callerData,
      legacy: spreadableBody(callerData)
    });
    const { found, result } = await this.subsystem().run(
      ctx.params.id,
      { type: 'manual', source: `manual run of ${ctx.params.id}` },
      payload
    );
    if (!found || !result) throw new HttpError(404, `No workflow "${ctx.params.id}"`);
    sendJSON(ctx.res, 200, { run: result } satisfies WorkflowRunResponse);
  }

  /** Cancel an in-flight run by its execution id. */
  cancel(ctx: RequestContext): void {
    const cancelled = this.subsystem().cancel(ctx.params.executionId);
    if (!cancelled) throw new HttpError(404, `No active run "${ctx.params.executionId}"`);
    sendJSON(ctx.res, 200, { cancelling: true, executionId: ctx.params.executionId });
  }
}
