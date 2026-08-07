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
 *   POST   /admin/triggers/:id/secret    rotate a webhook secret (WFA-008)
 *   DELETE /admin/triggers/:id        delete
 *   POST   /admin/triggers/:id/fire   manual test fire (payload optional)
 *
 * @module nodegx-backend/server/admin-triggers
 */

import { buildRunPayload, spreadableBody } from '../workflow/runPayload';
import type { RequestContext } from './HttpServer';
import type { TriggerSubsystem } from '../triggers/TriggerSubsystem';
import { TriggerConfigError, TriggerDef, TriggerInput } from '../triggers/registry';
import { HttpError, readJSONBody, sendJSON } from './http-util';

/** `GET /admin/triggers`. */
export interface TriggerListResponse {
  triggers: TriggerDef[];
  maxChangeDepth: number;
}

/**
 * The body of every single-trigger response (`GET`, `POST`, `PUT`, the
 * enable/disable toggle). `secret` rides along on exactly one of them — the
 * create/update that minted it — which is why it is optional here rather than a
 * separate type: the callers all read `.trigger` the same way.
 */
export interface TriggerResponse {
  trigger: TriggerDef;
  /** Plaintext webhook secret, returned exactly once and never recoverable. */
  secret?: string;
  secretNote?: string;
}

/** `DELETE /admin/triggers/:id`. */
export interface TriggerDeletedResponse {
  deleted: boolean;
  id: string;
}

/** `POST /admin/triggers/:id/fire`. */
export interface TriggerFiredResponse {
  fired: boolean;
  result: unknown;
  /**
   * What a real caller would have received. `body` is CWF-002: a test fire that
   * reports only a status code cannot show an author what their workflow
   * answers with, which is the one thing "Test fire" is for.
   */
  response: { statusCode: number; body?: string };
}

export class AdminTriggerRoutes {
  constructor(private readonly triggers: TriggerSubsystem) {}

  list(ctx: RequestContext): void {
    sendJSON(ctx.res, 200, {
      triggers: this.triggers.registry.list(),
      maxChangeDepth: this.triggers.registry.getMaxChangeDepth()
    } satisfies TriggerListResponse);
  }

  get(ctx: RequestContext): void {
    const trigger = this.triggers.registry.get(ctx.params.id);
    if (!trigger) throw new HttpError(404, `No trigger "${ctx.params.id}"`);
    sendJSON(ctx.res, 200, { trigger } satisfies TriggerResponse);
  }

  async create(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    this.upsert(ctx, body as unknown as TriggerInput, undefined, 201);
  }

  async update(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);

    /**
     * A PUT to an id the registry does not hold is a 404 (WFA-008, F59).
     *
     * `upsert` is legitimately an upsert — the boot path and `POST` both go
     * through it — so this belongs to the HTTP verb rather than the registry.
     * Without it, a PUT to a trigger deleted while an editor form was open
     * silently RECREATED it: same id, a **new** webhook secret (delete removed
     * the old one), a reset fire count, and 200 reported as a successful edit.
     */
    if (!this.triggers.registry.get(ctx.params.id)) {
      throw new HttpError(404, `No trigger "${ctx.params.id}" — it may have been deleted. Nothing was changed.`);
    }

    this.upsert(ctx, body as unknown as TriggerInput, ctx.params.id, 200);
  }

  /**
   * `POST /admin/triggers/:id/secret` — mint a new webhook secret (WFA-008 §3).
   *
   * Rotation is a verb rather than a field on an update: sending `secret` to
   * `upsert` replaces it, so an edit form carrying the key would rotate as a
   * side effect of changing a cron. The response says, in the body, what the
   * caller has just done to every existing sender.
   */
  rotateSecret(ctx: RequestContext): void {
    const result = this.triggers.registry.rotateWebhookSecret(ctx.params.id);
    if (result === null) throw new HttpError(404, `No trigger "${ctx.params.id}"`);
    if (result === 'not-a-webhook') {
      throw new HttpError(400, `Trigger "${ctx.params.id}" is not a webhook — only a webhook has a secret.`);
    }
    sendJSON(ctx.res, 200, {
      trigger: result.trigger,
      secret: result.secret,
      secretNote:
        'Store this now — it is not recoverable. Every sender using the previous secret is now rejected until it is updated.'
    } satisfies TriggerResponse);
  }

  private upsert(ctx: RequestContext, input: TriggerInput, id: string | undefined, status: number): void {
    try {
      const result = this.triggers.registry.upsert({ ...input, id: id || input.id });
      this.triggers.reschedule();
      sendJSON(ctx.res, status, {
        trigger: result.trigger,
        // The plaintext webhook secret is returned exactly once (like an API key).
        ...(result.secret ? { secret: result.secret, secretNote: 'Store this now — it is not recoverable.' } : {})
      } satisfies TriggerResponse);
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
    sendJSON(ctx.res, 200, { trigger } satisfies TriggerResponse);
  }

  delete(ctx: RequestContext): void {
    const ok = this.triggers.registry.delete(ctx.params.id);
    if (!ok) throw new HttpError(404, `No trigger "${ctx.params.id}"`);
    this.triggers.reschedule();
    sendJSON(ctx.res, 200, { deleted: true, id: ctx.params.id } satisfies TriggerDeletedResponse);
  }

  /** Manually fire a trigger for testing (records as a 'manual' execution). */
  async fire(ctx: RequestContext): Promise<void> {
    const trigger = this.triggers.registry.get(ctx.params.id);
    if (!trigger) throw new HttpError(404, `No trigger "${ctx.params.id}"`);
    const posted = await readJSONBody(ctx.req);
    // A test fire with no body of its own reproduces what the schedule itself
    // sends (WFA-005). Otherwise "Test fire" would exercise a payload the real
    // fire never uses, which is the one thing a test fire must not do. An
    // explicitly posted body still wins — that is how you try a variation.
    const scheduled = trigger.type === 'schedule' ? trigger.schedule?.payload : undefined;
    const body = posted && Object.keys(posted).length > 0 ? posted : scheduled || posted;
    const outcome = await this.triggers.dispatcher.fire({
      trigger,
      triggerType: 'manual',
      source: `manual test fire of ${trigger.id}`,
      // WFA-003: the posted body used to be SPREAD at the top level, so a
      // definition authored against a manual fire read `Inputs.total` while the
      // same definition fired by a webhook had to read `Inputs.body.total`. It
      // now lands under `body` like every other entry point; the spread stays as
      // the deprecated legacy view.
      payload: buildRunPayload({
        type: 'manual',
        triggerId: trigger.id,
        body: body || {},
        legacy: { triggerId: trigger.id, ...spreadableBody(body) }
      })
    });
    sendJSON(ctx.res, 200, {
      fired: true,
      result: outcome.result,
      response: { statusCode: outcome.statusCode, ...(outcome.body ? { body: outcome.body } : {}) }
    } satisfies TriggerFiredResponse);
  }
}
