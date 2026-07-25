/**
 * Admin trigger routes (WF-005) — the CRUD surface over the trigger registry,
 * proxied by the editor's BackendManager and driven by the MCP trigger tools.
 * All routes are `admin` access (the supervisor credential), mirroring
 * admin-security.ts.
 *
 *   GET    /admin/triggers            list
 *   GET    /admin/triggers/:id        get one
 *   POST   /admin/triggers            create (returns webhook secret once)
 *   PUT    /admin/triggers/:id        update
 *   POST   /admin/triggers/:id/enabled   { enabled }
 *   DELETE /admin/triggers/:id        delete
 *   POST   /admin/triggers/:id/fire   manual test fire (payload optional)
 *
 * @module nodegx-backend/server/admin-triggers
 */

import type { RequestContext } from './HttpServer';
import type { TriggerSubsystem } from '../triggers/TriggerSubsystem';
import { TriggerConfigError, TriggerInput } from '../triggers/registry';
import { HttpError, readJSONBody, sendJSON } from './http-util';

export class AdminTriggerRoutes {
  constructor(private readonly triggers: TriggerSubsystem) {}

  list(ctx: RequestContext): void {
    sendJSON(ctx.res, 200, { triggers: this.triggers.registry.list(), maxChangeDepth: this.triggers.registry.getMaxChangeDepth() });
  }

  get(ctx: RequestContext): void {
    const trigger = this.triggers.registry.get(ctx.params.id);
    if (!trigger) throw new HttpError(404, `No trigger "${ctx.params.id}"`);
    sendJSON(ctx.res, 200, { trigger });
  }

  async create(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    this.upsert(ctx, body as unknown as TriggerInput, undefined, 201);
  }

  async update(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    this.upsert(ctx, body as unknown as TriggerInput, ctx.params.id, 200);
  }

  private upsert(ctx: RequestContext, input: TriggerInput, id: string | undefined, status: number): void {
    try {
      const result = this.triggers.registry.upsert({ ...input, id: id || input.id });
      this.triggers.reschedule();
      sendJSON(ctx.res, status, {
        trigger: result.trigger,
        // The plaintext webhook secret is returned exactly once (like an API key).
        ...(result.secret ? { secret: result.secret, secretNote: 'Store this now — it is not recoverable.' } : {})
      });
    } catch (e) {
      if (e instanceof TriggerConfigError) throw new HttpError(400, e.message);
      throw e;
    }
  }

  async setEnabled(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'enabled (boolean) is required');
    const trigger = this.triggers.registry.setEnabled(ctx.params.id, body.enabled);
    if (!trigger) throw new HttpError(404, `No trigger "${ctx.params.id}"`);
    this.triggers.reschedule();
    sendJSON(ctx.res, 200, { trigger });
  }

  delete(ctx: RequestContext): void {
    const ok = this.triggers.registry.delete(ctx.params.id);
    if (!ok) throw new HttpError(404, `No trigger "${ctx.params.id}"`);
    this.triggers.reschedule();
    sendJSON(ctx.res, 200, { deleted: true, id: ctx.params.id });
  }

  /** Manually fire a trigger for testing (records as a 'manual' execution). */
  async fire(ctx: RequestContext): Promise<void> {
    const trigger = this.triggers.registry.get(ctx.params.id);
    if (!trigger) throw new HttpError(404, `No trigger "${ctx.params.id}"`);
    const body = await readJSONBody(ctx.req);
    const outcome = await this.triggers.dispatcher.fire({
      trigger,
      triggerType: 'manual',
      source: `manual test fire of ${trigger.id}`,
      payload: { trigger: 'manual', triggerId: trigger.id, ...(body || {}) }
    });
    sendJSON(ctx.res, 200, { fired: true, result: outcome.result, response: { statusCode: outcome.statusCode } });
  }
}
