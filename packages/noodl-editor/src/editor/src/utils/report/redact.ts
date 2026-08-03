/**
 * ALPHA-007 §3 — the redactor.
 *
 * This is the module that publishes. Everything that passes through it can end
 * up in a GitHub issue on a **public** repository, under the reporter's own
 * name, permanently. There is no "unsend".
 *
 * Two defences, and the order matters:
 *
 * 1. **The allow-list is the real one.** `diagnostics.ts` builds the payload by
 *    naming the fields it wants — counts, booleans, a bucketed type histogram —
 *    rather than by walking the project and filtering. Nothing that is not
 *    named can leak, whatever this file does. If you are tempted to add a field
 *    carrying a *string the user typed*, the answer is no.
 * 2. **This file is the second line**, for the free text that has to travel
 *    anyway: the captured error tail. Free text is unbounded, so it gets a
 *    deny-list of credential shapes plus an aggressive URL and path rewrite.
 *
 * Deliberately biased towards over-redaction. A `[redacted]` where a harmless
 * word used to be costs a maintainer one clarifying question. The other
 * direction costs a tester their API key.
 *
 * Pure: no imports, no I/O, no editor singletons — so it is unit-testable from
 * `tests-unit/` without a renderer.
 *
 * @module utils/report/redact
 */

export const REDACTED = '[redacted]';
export const REDACTED_EMAIL = '[redacted-email]';
export const REDACTED_PATH = '<path>';
export const REDACTED_URL = '<url>';

/**
 * Credential shapes, most specific first.
 *
 * `replace` may carry `$n` back-references, so a rule can keep the part that
 * says *which kind* of secret it was (`Bearer [redacted]`) while destroying the
 * secret. That distinction is genuinely useful in a bug report and costs
 * nothing.
 */
const CREDENTIAL_RULES: { name: string; pattern: RegExp; replace: string }[] = [
  // JSON Web Tokens. First, because the payload segment is base64 and the
  // looser rules below would otherwise nibble at it.
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, replace: REDACTED },

  // OpenAI / Anthropic style. Covers `sk-`, `sk-proj-`, `sk-ant-api03-`.
  { name: 'sk', pattern: /\bsk-[A-Za-z0-9_-]{16,}/g, replace: REDACTED },

  // GitHub: ghp_ gho_ ghu_ ghs_ ghr_ and the fine-grained github_pat_ form.
  { name: 'github', pattern: /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{16,}/g, replace: REDACTED },

  // Google API keys. Documented as exactly 35 characters after the prefix, but
  // matched as "30 or more": an exact count turns a format change into a silent
  // leak, and nothing that starts `AIza` and runs 30 characters is innocent.
  { name: 'google', pattern: /\bAIza[0-9A-Za-z_-]{30,}/g, replace: REDACTED },

  // AWS access key ids. The *secret* access key has no distinguishable shape
  // and is caught by the assignment rule instead.
  {
    name: 'aws-key-id',
    pattern: /\b(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    replace: REDACTED
  },

  // Slack.
  { name: 'slack', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, replace: REDACTED },

  // Stripe and friends: sk_live_, pk_live_, rk_test_ …
  { name: 'stripe', pattern: /\b[a-z]{2}_(?:live|test)_[A-Za-z0-9]{16,}/g, replace: REDACTED },

  // Authorization headers. Keeps the scheme.
  { name: 'auth-header', pattern: /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, replace: '$1 ' + REDACTED },

  // Query parameters that carry credentials. Keeps the parameter name, which is
  // what tells a maintainer which call was being made.
  {
    name: 'query-param',
    pattern:
      /([?&#][A-Za-z0-9_-]*(?:api[_-]?key|apikey|[_-]key|token|secret|password|passwd|pwd|auth|sig|signature|session)[A-Za-z0-9_-]*=)[^&\s"'<>]+/gi,
    replace: '$1' + REDACTED
  },
  // The bare `?key=` case, which the rule above deliberately cannot reach: an
  // unanchored `key` would also swallow `monkey=`.
  { name: 'query-key', pattern: /([?&#]key=)[^&\s"'<>]+/gi, replace: '$1' + REDACTED },

  // `apiKey: "…"`, `masterKey=…`, `"password": "…"`. Broad on purpose: a false
  // positive reads as `tokenCount: [redacted]`, which is survivable.
  //
  // The `*Id` keys are here for a reason the hostile fixture found: a Parse
  // request logs `{"masterKey":"…","appId":"acme-legal-prod"}`, and while the
  // key is obviously a secret, the application id names the reporter's client
  // just as loudly. §3's "never the endpoint" is about not identifying someone
  // else's backend, and an app id identifies it.
  //
  // The value alternative refuses a value that is already `[redacted]`, or one
  // beginning with an auth scheme the rule above has already dealt with —
  // otherwise `Authorization: Bearer [redacted]` gets a second pass and comes
  // out as `Authorization: [redacted] [redacted]`, losing the scheme, which is
  // the one part of that header worth reading.
  {
    name: 'assignment',
    pattern:
      /((?:"|')?\b[A-Za-z0-9_-]*(?:api[_-]?key|apikey|access[_-]?key|master[_-]?key|client[_-]?key|private[_-]?key|secret|password|passwd|credential|authorization|token|app[_-]?id|client[_-]?id|instance[_-]?id|tenant[_-]?id|account[_-]?id|project[_-]?id)[A-Za-z0-9_-]*\b(?:"|')?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|(?!\[redacted\]|Bearer\b|Basic\b|Token\b)[^\s,;}\])]+)/gi,
    replace: '$1' + REDACTED
  }
];

/** Loose enough to catch what a stack trace or a log line would contain. */
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/**
 * Hosts whose *name* may survive into a public issue.
 *
 * Not a security boundary — it is an editorial one. A URL naming one of these
 * says something about NodeGX; any other host says something about the
 * reporter's own infrastructure, which §3 forbids ("whether a backend is
 * configured (boolean, never the endpoint)"). The path is dropped either way,
 * because a path can carry an id or a signed token.
 */
const KNOWN_HOSTS = [
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'docs.noodl.net',
  'forum.noodl.net',
  'noodl.net',
  'the-low-code-foundation.github.io',
  'api.anthropic.com',
  'api.openai.com',
  'openrouter.ai',
  'generativelanguage.googleapis.com',
  'registry.npmjs.org',
  'localhost',
  '127.0.0.1',
  '0.0.0.0'
];

/**
 * A path "word": one segment's worth of characters, stopping at whitespace, a
 * separator, a quote or sentence punctuation.
 */
const WORD = "[^\\s\\\\/\"'<>,;:)\\]}]+";

/** A segment that may contain single spaces — `Acme Legal Portal`. */
const SPACED = `${WORD}(?:[ \\t]+${WORD})*`;

/**
 * A generic segment. The spaced form is only accepted when a separator follows
 * it, because in free text there is nothing else to say where the path stopped:
 * without that check `open /tmp/report failed` swallows the verb.
 */
const SEGMENT = `(?:${SPACED}(?=[\\\\/])|${WORD})`;

/** `scheme://host[:port][/path][?query]`. */
const URL_SOURCE = "(?<scheme>[a-z][a-z0-9+.-]*):\\/\\/(?<host>[^\\s\\\\/\"'<>]+)(?:[^\\s\"'<>]*)";

/**
 * An absolute path under no root we recognise. The lookbehind is what makes the
 * whole redactor idempotent: `<project>/...`, `<app>/src/x.js` and `~/...` are
 * this module's own output and must survive a second pass unchanged.
 */
const GENERIC_PATH_SOURCE = `(?<![>~])(?:[A-Za-z]:[\\\\/]|[\\\\/])${SEGMENT}(?:[\\\\/]${SEGMENT})*`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A root directory, matched with either separator and refusing to claim a
 * longer sibling.
 *
 * The trailing `(?![\w.-])` is not decoration. `/Users/richard` is a prefix of
 * `/Users/richardosborne`, and without it a home-directory rewrite silently
 * mangles a different user's path into `~osborne/…` — which is both wrong and
 * a disclosure of the real account name.
 */
function rootSource(dir: string): string {
  return dir
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .map(escapeRegExp)
    .join('[\\\\/]') + '(?![\\w.-])';
}

function normaliseDir(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export interface RedactorOptions {
  /** The open project's directory, if any. Becomes `<project>` / `<project>/...`. */
  projectDir?: string;
  /** The application directory. Ours, so its paths are kept as `<app>/…`. */
  appDir?: string;
  /** The user's home directory. Becomes `~` / `~/...`. */
  homeDir?: string;
}

type RootRule = {
  group: string;
  dir: string;
  /** Whether the part after the root survives. */
  keepRemainder: boolean;
  render: (remainder: string) => string;
};

function rootRules(options: RedactorOptions): RootRule[] {
  const rules: RootRule[] = [];
  if (options.projectDir) {
    rules.push({
      group: 'proj',
      dir: options.projectDir,
      keepRemainder: false,
      render: (rest) => (rest ? '<project>/...' : '<project>')
    });
  }
  if (options.appDir) {
    // Our own tree carries no user content, and these are the stack frames
    // anyone actually reads.
    rules.push({ group: 'app', dir: options.appDir, keepRemainder: true, render: (rest) => '<app>' + rest });
  }
  if (options.homeDir) {
    rules.push({
      group: 'home',
      dir: options.homeDir,
      keepRemainder: false,
      render: (rest) => (rest ? '~/...' : '~')
    });
  }

  // Longest root first, so a project inside the home directory is not claimed
  // by the home rule.
  return rules.sort((a, b) => normaliseDir(b.dir).length - normaliseDir(a.dir).length);
}

/**
 * Rewrite every URL and path in `text`.
 *
 * **One pass, not three.** A URL rewritten first and then re-scanned for paths
 * comes back out as `http<path>`, because `s:/` is indistinguishable from a
 * Windows drive root. So URLs, known roots and generic paths are alternatives
 * of a single regex and every character is consumed exactly once, by whichever
 * alternative starts earliest.
 *
 * §3 asks for the home directory as `~` and project paths as `<project>/…`.
 * This goes further in two respects, both deliberate, both required by
 * acceptance criterion 4:
 *
 * - **The remainder is dropped** under the project and home roots, and a path
 *   under no known root collapses to `<path>` entirely. Rewriting only the
 *   prefix does not satisfy "a path outside the project root does not appear":
 *   `/Users/rich/Clients/Acme/notes.txt` becomes `~/Clients/Acme/notes.txt` and
 *   the client's name is still on a public issue. Inside the project it is
 *   worse — in the v2 project format the file path *is* the component name.
 * - **Under those two roots the match is greedy across spaces**, even where a
 *   separator does not follow. `~/Clients/Acme Legal/notes.md` would otherwise
 *   match up to `Acme` and leave ` Legal` behind as loose text — a leak
 *   assembled out of the very characters we just redacted. The cost is that a
 *   trailing unpunctuated word (`… /x/y.json failed`) is swallowed with the
 *   path. Losing a word of prose is the right side of that trade.
 */
export function redactPaths(text: string, options: RedactorOptions = {}): string {
  const rules = rootRules(options);

  const sources = [URL_SOURCE];
  for (const rule of rules) {
    const remainder = rule.keepRemainder ? `(?:[\\\\/]${WORD})*` : `(?:[\\\\/]${SPACED})*`;
    sources.push(`(?<${rule.group}>${rootSource(rule.dir)})(?<${rule.group}_rest>${remainder})`);
  }
  sources.push(GENERIC_PATH_SOURCE);

  const pattern = new RegExp(sources.join('|'), 'gi');

  return text.replace(pattern, (...args: unknown[]) => {
    const match = args[0] as string;
    const last = args[args.length - 1];
    const groups = (typeof last === 'object' && last !== null ? last : {}) as Record<string, string | undefined>;

    if (groups.scheme && groups.host) {
      // Strip any `user:pass@` before the lookup, so credentials in the
      // authority cannot smuggle an unknown host past the list.
      const bare = groups.host.replace(/^[^@]*@/, '').toLowerCase();
      const withoutPort = bare.replace(/:\d+$/, '');
      return KNOWN_HOSTS.indexOf(withoutPort) !== -1 ? `${groups.scheme}://${bare}/...` : REDACTED_URL;
    }

    for (const rule of rules) {
      if (groups[rule.group] !== undefined) return rule.render(groups[`${rule.group}_rest`] || '');
    }

    return match ? REDACTED_PATH : match;
  });
}

/** Replace every credential-shaped run in `text`. */
export function redactCredentials(text: string): string {
  let out = text;
  for (const rule of CREDENTIAL_RULES) {
    // A fresh instance per call: the rules are `g`-flagged, `lastIndex` is
    // stateful, and a shared instance skips matches on the second string.
    out = out.replace(new RegExp(rule.pattern.source, rule.pattern.flags), rule.replace);
  }
  return out;
}

/**
 * The whole treatment, in the order that makes each step safe.
 *
 * Credentials first: a token often sits inside a URL that the URL pass would
 * otherwise collapse — which would be safe, but the credential rules also cover
 * bare tokens, and running them on the original text is what makes the two
 * independent. URLs and paths next. Emails last, because no earlier pass can
 * create one.
 */
export function redact(text: string, options: RedactorOptions = {}): string {
  if (!text) return '';
  let out = redactCredentials(text);
  out = redactPaths(out, options);
  out = out.replace(EMAIL, REDACTED_EMAIL);
  return out;
}

/** A redactor bound to one machine's directories, for repeated use. */
export function createRedactor(options: RedactorOptions = {}): (text: string) => string {
  return (text: string) => redact(text, options);
}
