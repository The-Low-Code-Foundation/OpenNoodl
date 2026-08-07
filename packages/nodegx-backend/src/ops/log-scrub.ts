/**
 * Value-based redaction, for the one place free author text reaches a log (CWF-013).
 *
 * ## Why `redact()` is not enough here, in the author's own words
 *
 * `ops/redact.ts` says it plainly about itself: *"Key-based, not value-based, and that is a
 * deliberate limit worth stating: a secret stored under an innocent name is not caught. The
 * mitigation is that nothing constructs log fields out of arbitrary user text without naming
 * them."*
 *
 * The `Log` node breaks that mitigation, and it is the first thing in the product that does. Its
 * `Message` input **is** arbitrary text, chosen by the author, with no key in front of it. And the
 * shape that produces a leak is not exotic — it is the two-node graph an author writes on their
 * first afternoon:
 *
 *     Secret → Log ("calling stripe with " + Value)
 *
 * Key-based redaction cannot see that. Nothing in `scrubValue` can, because there is no key. So
 * the `Log` sink runs a second pass that works the only way this case can be worked: it knows the
 * VALUES the backend itself provisioned, and replaces them wherever they appear.
 *
 * ## What this catches and what it does not
 *
 * It catches every secret the backend holds for this project — `secrets.json`'s `functions`
 * namespace and every `NODEGX_SECRET_*` variable — which is exactly the set the `Secret` node can
 * hand a graph. It does **not** catch a credential that arrived in a request body, was minted by a
 * Function node, or was typed into a parameter, because the backend has never seen those and
 * cannot recognise them. That limit is stated on the node's page rather than left implied: a
 * promise of "your logs are safe" that is only 90% true is worse than the accurate sentence.
 *
 * ## ⚠️ Two deliberate limits, both of which are worse if you "fix" them
 *
 *  - **Values shorter than {@link MIN_SCRUBBABLE_LENGTH} are ignored.** A secret provisioned as
 *    `"1"` or `"dev"` would otherwise turn every log line in the system into confetti, and a log
 *    nobody can read is its own outage. Real credentials are long; a two-character one is a
 *    placeholder.
 *  - **The value list is cached for {@link REFRESH_INTERVAL_MS}.** A `Log` node inside a Run Tasks
 *    loop calls this thousands of times, and re-reading `secrets.json` per line would make logging
 *    an fs benchmark. A secret provisioned mid-run is therefore unscrubbed for at most that long,
 *    in lines written by a graph that could not have read it yet either.
 *
 * ## What this module does NOT do
 *
 * It never hands a value back. `SecretsStore` deliberately has no "give me every value" method
 * (CWF-009 design question 4), and this module is not a way around that: it reads them one at a
 * time into a private table and exposes exactly one function, `scrub(text) => text`. Nothing here
 * logs, and nothing here returns a secret.
 *
 * @module nodegx-backend/ops/log-scrub
 */

import { FUNCTION_SECRET_ENV_PREFIX, FUNCTION_SECRETS_NAMESPACE, SecretsStore } from '../config/SecretsStore';
import { REDACTED } from './redact';

/**
 * Below this, a "secret" is a word that occurs in ordinary text and scrubbing it destroys the log.
 * Eight characters is shorter than every real API key and longer than every accidental one.
 */
export const MIN_SCRUBBABLE_LENGTH = 8;

/** How long the value table is trusted before `secrets.json` is read again. */
export const REFRESH_INTERVAL_MS = 5000;

/** Regex-escape, so a secret containing `.` or `+` does not become a wildcard. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A scrubber over the secrets one backend holds.
 *
 * Built once per service and handed to the log sink. The values live in a closure field that
 * nothing outside this class can reach.
 */
export class SecretValueScrubber {
  private readonly store: SecretsStore;
  private values: string[] = [];
  private pattern: RegExp | null = null;
  private readAt = 0;

  constructor(store: SecretsStore) {
    this.store = store;
  }

  private refresh(now: number): void {
    if (this.pattern !== null && now - this.readAt < REFRESH_INTERVAL_MS) return;
    this.readAt = now;

    const values: string[] = [];

    // The store, one name at a time — `names()` is the public surface and `get()` is the public
    // read. There is no bulk-value read to add here, and adding one would be the wrong direction.
    try {
      for (const name of this.store.names(FUNCTION_SECRETS_NAMESPACE)) {
        const value = this.store.get(FUNCTION_SECRETS_NAMESPACE, name);
        if (value && value.length >= MIN_SCRUBBABLE_LENGTH) values.push(value);
      }
    } catch {
      // A corrupt secrets.json is loud everywhere else in the service (SecretsStore throws by
      // design). It must not be loud *here*: failing to build the table would take down logging,
      // and the last thing a broken backend needs is to stop being able to say so.
    }

    // The second door (CWF-009): a deploy target that provisions environment variables.
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith(FUNCTION_SECRET_ENV_PREFIX)) continue;
      if (value && value.length >= MIN_SCRUBBABLE_LENGTH) values.push(value);
    }

    // Longest first, so a secret that contains another one is replaced whole.
    values.sort((a, b) => b.length - a.length);
    this.values = values;
    this.pattern = values.length ? new RegExp(values.map(escapeForRegExp).join('|'), 'g') : null;
  }

  /** How many values are currently in the table. Diagnostics — never the values themselves. */
  get size(): number {
    return this.values.length;
  }

  /** `text` with every known secret value replaced. */
  scrub(text: string): string {
    if (!text) return text;
    this.refresh(Date.now());
    if (!this.pattern) return text;
    this.pattern.lastIndex = 0;
    return text.replace(this.pattern, REDACTED);
  }

  /**
   * The same pass over an arbitrary value, for a structured `data` object.
   *
   * ⚠️ This runs *after* `redact()`, not instead of it: key-based redaction catches
   * `{ apiKey: <something we never issued> }`, and this catches `{ note: <something we did> }`.
   * Neither is a superset of the other, which is why the sink runs both.
   */
  scrubValue(value: unknown, depth = 0): unknown {
    if (depth > 6 || value === null || value === undefined) return value;
    if (typeof value === 'string') return this.scrub(value);
    if (Array.isArray(value)) return value.map((v) => this.scrubValue(v, depth + 1));
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        out[key] = this.scrubValue(v, depth + 1);
      }
      return out;
    }
    return value;
  }
}
