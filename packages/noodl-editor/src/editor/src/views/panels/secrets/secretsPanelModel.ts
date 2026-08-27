/**
 * The Secrets panel's decisions, as functions over values (SB-015 §6.4a).
 *
 * ## Why this is a separate module
 *
 * `SecretsPanel.tsx` calls `window.require('electron')` at module scope and is
 * a hook-bearing component, and this repo's jest runs `testEnvironment: 'node'`
 * with no jsdom and no `@testing-library/react`. A spec that imported the panel
 * would not fail an assertion — it would fail to *load*, which reads as a broken
 * harness rather than a broken decision.
 *
 * So the decisions that can be wrong live here, where they are graded over real
 * inputs. It is the same extraction SB-016 made for its endpoint predicate and
 * s13 made for `buildSpawnArgs`, for the same reason: the alternative assertion
 * available over a component this environment cannot mount is a source-text one,
 * and source text passes just as happily on unreachable code.
 *
 * ⚠️ What this module deliberately does NOT contain: anything that talks to the
 * backend. The IPC calls stay in the component, because a spec over a fake
 * `ipcRenderer` would grade the fake.
 *
 * @module panels/secrets/secretsPanelModel
 */

/**
 * The name rule, copied from `nodegx-backend`'s `FUNCTION_SECRET_NAME_PATTERN`.
 *
 * A copy, not an import: the renderer does not depend on the backend package.
 * `secretsPanelModel.test.ts` pins both copies against the same table so the
 * duplication is *checked* rather than merely admitted — a second copy of a
 * constant is only safe while something fails when they disagree.
 */
export const SECRET_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

/** The `NODEGX_SECRET_*` prefix, likewise copied and likewise pinned. */
export const SECRET_ENV_PREFIX = 'NODEGX_SECRET_';

/**
 * Mirrors the backend's `functionSecretEnvName`.
 *
 * ⚠️ This transform does not invert (it folds runs of punctuation and
 * upper-cases), which is why the panel only ever shows it *beside* a name the
 * user typed and never tries to derive a secret name from a variable.
 */
export function envNameForSecret(name: string): string {
  return SECRET_ENV_PREFIX + name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
}

/** The message shown under the Name field, or null when the name is usable. */
export function describeNameProblem(name: string): string | null {
  if (name.length === 0) return null;
  if (!SECRET_NAME_PATTERN.test(name)) {
    return 'Use letters, digits, "_", "." or "-", 1-128 characters — the same names a Secret node can ask for.';
  }
  return null;
}

/** What `DELETE /admin/secrets/:name` answered, as the panel reads it. */
export interface DeleteOutcome {
  name: string;
  existed: boolean;
  stillResolvesFromEnvironment: boolean;
  envName: string;
}

/**
 * How a delete is reported, and at what severity.
 *
 * 🔴 Three outcomes, not two, and the third is the one that matters: removing
 * the stored copy while `NODEGX_SECRET_<NAME>` is set does **not** stop functions
 * resolving the secret. A panel that says "deleted" over a credential that still
 * works is how somebody concludes the backend caches credentials and goes
 * looking for a bug that is not there — so that case is an `error`, which the
 * panel does not auto-dismiss, rather than a `notice`, which vanishes.
 */
export function describeDeleteOutcome(outcome: DeleteOutcome): { severity: 'error' | 'notice'; message: string } {
  if (outcome.stillResolvesFromEnvironment) {
    return {
      severity: 'error',
      message:
        `"${outcome.name}" was removed from this backend's store, but ${outcome.envName} is still set in the ` +
        `environment this backend is running in — so functions asking for "${outcome.name}" keep resolving it. ` +
        `Unset that variable and restart the backend to finish removing it.`
    };
  }
  if (outcome.existed) {
    return {
      severity: 'notice',
      message: `"${outcome.name}" was removed. A Secret node asking for it now fires its failure output.`
    };
  }
  return { severity: 'notice', message: `"${outcome.name}" was not stored here, so nothing changed.` };
}

/** One row of `GET /admin/secrets`. Names and provenance — never a value. */
export interface SecretListing {
  name: string;
  envName: string;
  alsoInEnvironment: boolean;
}

/**
 * The `NODEGX_SECRET_*` variables that resolve but are not in the store.
 *
 * The resolver reads the store first and the environment second, so a variable
 * whose name is already claimed by a stored secret is *shadowed* and must not be
 * listed as a separate thing the author can act on. Everything left over does
 * resolve, exactly like a stored secret, and a panel that lists only the store
 * reports "not provisioned" about a function that works fine.
 */
export function environmentOnlyVariables(secrets: SecretListing[], environment: string[]): string[] {
  const shadowed = new Set(secrets.map((s) => s.envName));
  return environment.filter((name) => !shadowed.has(name));
}

/** Whether the Save button can fire. */
export function canSave(args: { name: string; value: string; busy: boolean }): boolean {
  if (args.busy) return false;
  if (args.name.length === 0 || args.value.length === 0) return false;
  return describeNameProblem(args.name) === null;
}

/**
 * A value the author can accept rather than invent: 32 CSPRNG bytes, base64url.
 *
 * The randomness is injected so this is gradeable; the panel passes
 * `window.crypto.getRandomValues`. Minting happens **in the renderer** and goes
 * out through the ordinary `PUT` — deliberately not minted by the backend,
 * because a backend that mints a credential then has to tell somebody what it
 * is, and its only channel is its log, which `SecretValueScrubber` redacts on a
 * 5-second refresh (so it would leak the real value *sometimes* and print
 * `REDACTED` the rest of the time).
 */
export function generateSecretValue(fill: (bytes: Uint8Array) => void): string {
  const bytes = new Uint8Array(32);
  fill(bytes);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
