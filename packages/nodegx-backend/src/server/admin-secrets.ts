/**
 * Admin secrets surface (CWF-009 slice 4) — the door an editor Secrets panel calls.
 *
 *   GET    /admin/secrets          the NAMES provisioned for cloud functions
 *   PUT    /admin/secrets/:name    provision or replace one value
 *   DELETE /admin/secrets/:name    remove one
 *
 * CWF-009 shipped the store, the resolver and the Secret node, but every admin
 * route family is constructed in `HttpServer.ts`, which that pass was scoped out
 * of — so `SecretsStore.names()` existed with no caller and a Secrets panel had
 * nothing to call. This file is that caller and nothing more.
 *
 * ## Two rules this surface must not bend
 *
 * 1. **One namespace, supplied here.** The route has no `:namespace` segment and
 *    never will: it hard-codes {@link FUNCTION_SECRETS_NAMESPACE}, exactly as
 *    `service.ts`'s resolver does for the graph. `webhooks`, `email`, `auth`,
 *    `files` and the top-level `adminToken` stay **unnameable** through this
 *    door rather than merely forbidden — the same property, by the same
 *    construction, so there is one policy and not two. A `:namespace` parameter
 *    would turn `SecretsStore`'s composition rule ("own exactly one top-level
 *    key") into an HTTP-callable way to overwrite the admin credential.
 * 2. **Names leave this process; values never do.** There is deliberately no
 *    GET of a value, no read-back after a write, and no length or fingerprint in
 *    the listing — a surface that can read a secret back is a surface that has
 *    to be permissioned (CWF-009 design question 4), and admin-gating it is not
 *    the same thing as being safe to have. Every response here is derivable from
 *    `SecretsStore.names()`, which is why that method is the only reader.
 *
 * ⚠️ The listing also reports which `NODEGX_SECRET_*` variables this process
 * has, because the resolver has **two doors** and a names-only list of the first
 * one is actively misleading — a panel would report "STRIPE_KEY is not
 * provisioned" about a function that resolves it fine. That adds no exposure:
 * env var *names* are not values, and `process.env` is already fully readable
 * from inside any cloud function (TALK-007 §3.1), so the environment is a door,
 * not a store.
 *
 * ⚠️ Admin-gated means gated *as much as every other admin route*, which under
 * **dev-open** is not at all: `HttpServer.checkAccess` step 2 relaxes every gate
 * when `devOpen` is set and the bind is loopback — the posture the editor's own
 * spawned backend runs in. That is BAK-003's model rather than something this
 * file chose, and it is survivable here only because no route in this family
 * hands back a value; a read-back path would have made dev-open a local
 * credential dump. It is the reason there isn't one.
 *
 * @module nodegx-backend/server/admin-secrets
 */

import {
  FUNCTION_SECRETS_NAMESPACE,
  FUNCTION_SECRET_ENV_PREFIX,
  FUNCTION_SECRET_NAME_PATTERN,
  SecretsStore,
  functionSecretEnvName
} from '../config/SecretsStore';
import type { RequestContext } from './HttpServer';
import { HttpError, readJSONBody, sendJSON } from './http-util';

/**
 * The largest value this door accepts, in bytes of UTF-8.
 *
 * Generous rather than tight: a PEM private key (CWF-010's signing material is
 * the near-term case) runs to a few kilobytes, and a limit that refuses one
 * would push the operator back to hand-editing secrets.json, which is the thing
 * this route exists to stop. It is a guard against a body that was never a
 * credential, not a policy about credential shape.
 */
const MAX_SECRET_BYTES = 64 * 1024;

/** One row of `GET /admin/secrets`. Names and provenance — never a value. */
export interface SecretListing {
  name: string;
  /** The `NODEGX_SECRET_*` variable this name falls back to. */
  envName: string;
  /**
   * This process also has that variable set. The store wins (the resolver reads
   * it first), so this is "there is a second copy", which is exactly the thing
   * that makes a deleted secret keep working and look like a caching bug.
   */
  alsoInEnvironment: boolean;
}

export class AdminSecretsRoutes {
  private readonly secrets: SecretsStore;

  constructor(secrets: SecretsStore) {
    this.secrets = secrets;
  }

  /**
   * The name a route param may carry.
   *
   * The same pattern the Secret node validates against, checked here too rather
   * than trusted from either end: this door writes the key the node later reads,
   * so a name the node cannot express would be a secret that can only ever be
   * deleted. The message states the rule instead of echoing the name back —
   * unusable input is exactly the input not to reflect.
   */
  private requireName(raw: string): string {
    if (!FUNCTION_SECRET_NAME_PATTERN.test(raw)) {
      throw new HttpError(
        400,
        'That is not a usable secret name. Use letters, digits, "_", "." or "-", 1-128 characters — ' +
          'the same names a Secret node can ask for.'
      );
    }
    return raw;
  }

  /** `GET /admin/secrets` — what is provisioned, by name. */
  list(ctx: RequestContext): void {
    const names = this.secrets.names(FUNCTION_SECRETS_NAMESPACE);
    const secrets: SecretListing[] = names.map((name) => {
      const envName = functionSecretEnvName(name);
      return { name, envName, alsoInEnvironment: process.env[envName] !== undefined };
    });

    // Every NODEGX_SECRET_* this process has. Reported as variable names, not
    // secret names, because `functionSecretEnvName` upper-cases and folds
    // punctuation — it does not invert, and inventing a name here would print
    // one no Secret node would resolve.
    const environment = Object.keys(process.env)
      .filter((key) => key.startsWith(FUNCTION_SECRET_ENV_PREFIX) && process.env[key] !== undefined)
      .sort();

    sendJSON(ctx.res, 200, {
      namespace: FUNCTION_SECRETS_NAMESPACE,
      secrets,
      environment,
      /** Said in the response so a panel does not have to hard-code the policy. */
      readable: false,
      envPrefix: FUNCTION_SECRET_ENV_PREFIX
    });
  }

  /**
   * `PUT /admin/secrets/:name` with `{ "value": "…" }`.
   *
   * Answers whether the name was already there (`created`), which is the one
   * thing a panel can say about a value it is not allowed to read back.
   */
  async put(ctx: RequestContext): Promise<void> {
    const name = this.requireName(ctx.params.name);
    const body = await readJSONBody(ctx.req);

    const unknown = Object.keys(body).filter((key) => key !== 'value');
    if (unknown.length > 0) {
      throw new HttpError(
        400,
        `Unknown field(s) ${unknown.map((k) => `"${k}"`).join(', ')} for secret "${name}". Expected { "value": "<the secret>" }.`
      );
    }
    if (typeof body.value !== 'string') {
      throw new HttpError(400, `Secret "${name}" needs a string "value". To remove it, use DELETE.`);
    }
    if (body.value.length === 0) {
      throw new HttpError(
        400,
        `Secret "${name}" cannot be an empty string — an empty credential fails at whatever it is sent to, ` +
          `an hour later and somewhere else. To remove it, use DELETE.`
      );
    }
    const bytes = Buffer.byteLength(body.value, 'utf-8');
    if (bytes > MAX_SECRET_BYTES) {
      // The SIZE, never the value, in the message.
      throw new HttpError(400, `Secret "${name}" is ${bytes} bytes; the limit is ${MAX_SECRET_BYTES}.`);
    }

    const created = !this.secrets.names(FUNCTION_SECRETS_NAMESPACE).includes(name);
    // ⚠️ Never `ctx.audit` the value. The audit trail is a queryable database
    // row and the access log is shipped off-box; the whole point of this file is
    // that the value reaches secrets.json and nothing else.
    ctx.audit({ namespace: FUNCTION_SECRETS_NAMESPACE, created, bytes });

    // Whole-file read-modify-write, inside SecretsStore — this is the writer the
    // store's convention exists for, and going around it would destroy
    // `adminToken`.
    this.secrets.set(FUNCTION_SECRETS_NAMESPACE, name, body.value);

    sendJSON(ctx.res, created ? 201 : 200, {
      success: true,
      name,
      created,
      namespace: FUNCTION_SECRETS_NAMESPACE
    });
  }

  /**
   * `DELETE /admin/secrets/:name`.
   *
   * Reports whether the environment still answers for this name. Removing the
   * stored copy while `NODEGX_SECRET_<NAME>` is set does NOT stop functions
   * resolving it, and a panel that says "deleted" over a secret that still works
   * is how someone concludes the backend is caching credentials.
   */
  delete(ctx: RequestContext): void {
    const name = this.requireName(ctx.params.name);
    const existed = this.secrets.names(FUNCTION_SECRETS_NAMESPACE).includes(name);
    const envName = functionSecretEnvName(name);
    const stillResolvesFromEnvironment = process.env[envName] !== undefined;

    ctx.audit({ namespace: FUNCTION_SECRETS_NAMESPACE, existed, stillResolvesFromEnvironment });
    this.secrets.delete(FUNCTION_SECRETS_NAMESPACE, name);

    sendJSON(ctx.res, 200, {
      success: true,
      name,
      existed,
      stillResolvesFromEnvironment,
      envName
    });
  }
}
