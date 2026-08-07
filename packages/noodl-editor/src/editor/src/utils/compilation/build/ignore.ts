/**
 * DEP-008 — the deploy ignore mechanism.
 *
 * Replaces the five-name hardcoded list plus two unanchored `indexOf` substring
 * checks that `copyProjectFilesToFolder` used to filter the project folder with:
 * a gitignore-syntax matcher, a named default rule set, and a report of what
 * was excluded and by which rule.
 *
 * Two properties this module exists to guarantee:
 *
 *  1. **Path-anchored matching.** The old `f.fullPath.indexOf('.git') !== -1`
 *     dropped `pre.gitlab-assets/` from every deploy, silently. Matching here is
 *     by path segment, never by accidental substring.
 *  2. **Defaults are not overridable by accident.** The user's `.noodlignore` is
 *     appended *after* the defaults and gitignore's last-match-wins applies, so
 *     a short user file extends the defaults; un-ignoring a default needs an
 *     explicit `!` negation.
 *
 * The dialect is gitignore's, deliberately not a variant of it — including the
 * rule that a negation cannot re-include a path underneath an excluded
 * directory (`!docs/notes.md` does nothing while `docs/` is excluded; `!docs/`
 * is what re-includes it). `ignore.conformance.test.ts` pins that against real
 * `git check-ignore` output rather than against this file's own reading of the
 * manual.
 *
 * @module noodl-editor/utils/compilation/build/ignore
 */

import { V2_FILES } from '../../../services/ProjectStructure/types';

/** Where a rule came from — used in the deploy report so a user can act on it. */
export type IgnoreRuleSource = 'default' | '.noodlignore';

export interface IgnoreRule {
  /** The pattern exactly as written, for reporting. */
  pattern: string;
  source: IgnoreRuleSource;
  /** 1-based line number, when the rule came from a `.noodlignore`. */
  line?: number;
  /** A `!` rule — re-includes rather than excludes. */
  negated: boolean;
  /** A trailing-slash rule — only matches directories. */
  directoryOnly: boolean;
  regex: RegExp;
}

export interface IgnoreDecision {
  ignored: boolean;
  /** The rule that decided it. Undefined when no rule matched at all. */
  rule?: IgnoreRule;
  /**
   * The path the deciding rule matched. For a file excluded because an ancestor
   * directory is excluded this is the ancestor, which is what a user needs to
   * see — "docs/notes.md was excluded by `docs/`", not "by something".
   */
  matchedPath?: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * A default rule with the reason it is a default. The reason is not decoration:
 * criterion 5 of DEP-008 is that a creator can tell "my asset is missing" from
 * "my asset was ignored" without reading source, and the reason is what makes
 * the difference legible in the deploy report.
 */
export interface DefaultIgnoreEntry {
  pattern: string;
  reason: string;
}

/**
 * Applied to every deploy whether or not the project has a `.noodlignore`.
 *
 * Conservative and named individually — no wildcard sweep of dotfiles, because
 * `.well-known/` and `.htaccess` are things people deliberately deploy to a
 * static host. Anything not on this list still ships; the user opts in to more
 * with their own file.
 */
export const DEFAULT_IGNORE_ENTRIES: readonly DefaultIgnoreEntry[] = [
  // The ignore file itself.
  { pattern: '.noodlignore', reason: 'the deploy ignore file' },

  // Version control.
  { pattern: '.git/', reason: 'version control metadata' },
  { pattern: '.gitignore', reason: 'version control metadata' },
  { pattern: '.gitattributes', reason: 'version control metadata' },
  { pattern: '.gitmodules', reason: 'version control metadata' },
  { pattern: '.github/', reason: 'version control metadata' },
  { pattern: '.svn/', reason: 'version control metadata' },
  { pattern: '.hg/', reason: 'version control metadata' },

  // Editor & OS cruft.
  { pattern: '.DS_Store', reason: 'operating system metadata' },
  { pattern: 'Thumbs.db', reason: 'operating system metadata' },
  { pattern: 'desktop.ini', reason: 'operating system metadata' },
  { pattern: '.vscode/', reason: 'code editor settings' },
  { pattern: '.idea/', reason: 'code editor settings' },

  // NodeGX's own project-local state: build scripts, editor settings, caches.
  { pattern: '.noodl/', reason: "the editor's own project state" },
  { pattern: '.nodegx/', reason: "the editor's own project state" },

  // Dependencies and container build files. `node_modules/` is both a size and
  // a privacy problem, and the walk prunes it rather than descending.
  { pattern: 'node_modules/', reason: 'installed dependencies' },
  { pattern: 'Dockerfile', reason: 'container build files' },
  { pattern: '.dockerignore', reason: 'container build files' },
  { pattern: 'docker-compose.yml', reason: 'container build files' },
  { pattern: 'docker-compose.yaml', reason: 'container build files' },

  // Credentials. This is a named-file default, not the secret *scanning* that
  // WF-003 owns and DEP-008 explicitly does not duplicate — but a `.env` served
  // from the app's public origin is the single most expensive accident this
  // copy step can have, and it costs one line to not have it.
  { pattern: '.env', reason: 'environment / credential file' },
  { pattern: '.env.*', reason: 'environment / credential file' },
  { pattern: '.npmrc', reason: 'environment / credential file' },

  // Legacy project source. Already excluded before DEP-008, kept by name.
  { pattern: 'project.json', reason: 'project source' },

  // The creator's private working notes (AIX-009). Deliberately a *visible*
  // folder so people edit and commit it normally — which is exactly why the
  // copy step has to know about it.
  { pattern: 'docs/', reason: 'project documentation, not for publication' }
];

/**
 * v2 decomposed project source. Split out from the defaults above because
 * `components/` is a plausible name for an asset folder in a legacy project;
 * these rules apply only when the project directory actually is v2.
 *
 * See DEP-008-NOTES.md for why v2 source is excluded (scope item 4).
 */
export const V2_SOURCE_IGNORE_ENTRIES: readonly DefaultIgnoreEntry[] = [
  { pattern: V2_FILES.project, reason: 'project source (v2)' },
  { pattern: V2_FILES.routes, reason: 'project source (v2)' },
  { pattern: V2_FILES.styles, reason: 'project source (v2)' },
  { pattern: `${V2_FILES.componentsDir}/`, reason: 'project source (v2)' }
];

/** The default patterns, with the v2 source rules included only for a v2 project. */
export function getDefaultIgnoreEntries(options: { isV2Project: boolean }): DefaultIgnoreEntry[] {
  return options.isV2Project
    ? [...DEFAULT_IGNORE_ENTRIES, ...V2_SOURCE_IGNORE_ENTRIES]
    : [...DEFAULT_IGNORE_ENTRIES];
}

/** The reason text for a default pattern, for the deploy report. */
export function getDefaultReason(pattern: string): string | undefined {
  return [...DEFAULT_IGNORE_ENTRIES, ...V2_SOURCE_IGNORE_ENTRIES].find((e) => e.pattern === pattern)?.reason;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function escapeRegex(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips trailing whitespace that is not backslash-escaped — gitignore(5):
 * "Trailing spaces are ignored unless they are quoted with backslash".
 */
function stripUnescapedTrailingSpaces(line: string): string {
  let end = line.length;
  while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) {
    // Count the backslashes immediately before this whitespace run's character.
    let backslashes = 0;
    let i = end - 2;
    while (i >= 0 && line[i] === '\\') {
      backslashes++;
      i--;
    }
    if (backslashes % 2 === 1) break; // escaped — keep it and everything left of it
    end--;
  }
  return line.slice(0, end);
}

/**
 * Translates a gitignore pattern body (no leading `!`, no trailing `/`) into a
 * regex source that matches one complete path.
 */
function translatePattern(pattern: string): string {
  let out = '';
  let i = 0;

  while (i < pattern.length) {
    const c = pattern[i];

    if (c === '\\') {
      i++;
      if (i < pattern.length) {
        out += escapeRegex(pattern[i]);
        i++;
      } else {
        out += '\\\\';
      }
      continue;
    }

    if (c === '*') {
      let stars = 0;
      while (i < pattern.length && pattern[i] === '*') {
        stars++;
        i++;
      }
      const atSegmentStart = out === '' || out.endsWith('/');
      const atSegmentEnd = i >= pattern.length || pattern[i] === '/';

      if (stars >= 2 && atSegmentStart && atSegmentEnd) {
        if (i < pattern.length) {
          // `**/` — zero or more leading path segments.
          out += '(?:.*/)?';
          i++; // consume the '/'
        } else {
          // trailing `**` — everything below.
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
      continue;
    }

    if (c === '?') {
      out += '[^/]';
      i++;
      continue;
    }

    if (c === '[') {
      let j = i + 1;
      let cls = '';
      if (j < pattern.length && (pattern[j] === '!' || pattern[j] === '^')) {
        cls += '^';
        j++;
      }
      if (j < pattern.length && pattern[j] === ']') {
        cls += '\\]';
        j++;
      }
      while (j < pattern.length && pattern[j] !== ']') {
        if (pattern[j] === '\\') {
          cls += '\\' + (pattern[j + 1] ?? '\\');
          j += 2;
          continue;
        }
        if (pattern[j] === '[' || pattern[j] === '^') {
          cls += '\\' + pattern[j];
          j++;
          continue;
        }
        cls += pattern[j];
        j++;
      }
      if (j >= pattern.length) {
        // Unterminated class — git treats the '[' literally.
        out += '\\[';
        i++;
        continue;
      }
      out += '[' + cls + ']';
      i = j + 1;
      continue;
    }

    out += escapeRegex(c);
    i++;
  }

  return out;
}

/** Compiles one gitignore line. Returns null for blanks and comments. */
export function compileIgnoreRule(rawLine: string, source: IgnoreRuleSource, line?: number): IgnoreRule | null {
  let text = stripUnescapedTrailingSpaces(rawLine.replace(/\r$/, ''));
  if (text.length === 0) return null;
  if (text.startsWith('#')) return null;

  let negated = false;
  if (text.startsWith('!')) {
    negated = true;
    text = text.slice(1);
  } else if (text.startsWith('\\#') || text.startsWith('\\!')) {
    text = text.slice(1);
  }

  if (text.length === 0) return null;

  let directoryOnly = false;
  if (text.endsWith('/') && !text.endsWith('\\/')) {
    directoryOnly = true;
    text = text.slice(0, -1);
  }

  if (text.length === 0) return null;

  // A leading slash anchors to the project root and is not part of the pattern.
  let anchored = false;
  if (text.startsWith('/')) {
    anchored = true;
    text = text.slice(1);
  } else if (text.includes('/')) {
    // gitignore(5): a slash anywhere but the end anchors the pattern to the
    // directory holding the ignore file — for us, the project root.
    anchored = true;
  }

  if (text.length === 0) return null;

  const body = translatePattern(text);
  const prefix = anchored ? '^' : '^(?:.*/)?';

  return {
    pattern: rawLine.trim(),
    source,
    line,
    negated,
    directoryOnly,
    regex: new RegExp(prefix + body + '$')
  };
}

/** Compiles a `.noodlignore` file's contents. */
export function parseIgnoreFile(content: string, source: IgnoreRuleSource = '.noodlignore'): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  content.split('\n').forEach((rawLine, index) => {
    const rule = compileIgnoreRule(rawLine, source, index + 1);
    if (rule) rules.push(rule);
  });
  return rules;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * A compiled rule list. Evaluation is gitignore's: rules apply in order,
 * last match wins, and a path underneath an excluded directory is excluded
 * regardless of any later negation naming it.
 */
export class IgnoreMatcher {
  constructor(public readonly rules: readonly IgnoreRule[]) {}

  /** Evaluates one path against the rules — no ancestor walk. */
  private decideExact(path: string, isDirectory: boolean): IgnoreDecision {
    let decided: IgnoreRule | undefined;
    for (const rule of this.rules) {
      if (rule.directoryOnly && !isDirectory) continue;
      if (rule.regex.test(path)) decided = rule;
    }
    if (!decided) return { ignored: false };
    return { ignored: !decided.negated, rule: decided, matchedPath: path };
  }

  /**
   * Whether `relativePath` (project-root relative, `/` separated, no leading
   * slash) is excluded — checking each ancestor directory first, so that
   * excluding `docs/` excludes everything under it and reports `docs/` as the
   * reason.
   */
  match(relativePath: string, isDirectory = false): IgnoreDecision {
    const segments = relativePath.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) return { ignored: false };

    for (let i = 1; i <= segments.length; i++) {
      const prefix = segments.slice(0, i).join('/');
      const prefixIsDirectory = i < segments.length ? true : isDirectory;
      const decision = this.decideExact(prefix, prefixIsDirectory);
      if (decision.ignored) return decision;
    }

    return { ignored: false };
  }

  /**
   * Whether a directory may be descended into. False only when the directory
   * itself is excluded *and* no rule could re-include something beneath it —
   * i.e. there is no negated rule at all. Conservative on purpose: pruning a
   * directory that a later `!` line would have rescued would be the silent
   * under-copying DEP-008 exists to remove.
   */
  canPrune(relativePath: string): boolean {
    if (!this.match(relativePath, true).ignored) return false;
    return !this.rules.some((r) => r.negated);
  }
}

/**
 * Builds the matcher for a project: defaults first, then the user's file, so
 * last-match-wins makes the user's rules extend the defaults and a negation the
 * only way to override one.
 */
export function buildIgnoreMatcher(options: {
  isV2Project: boolean;
  /** Contents of `.noodlignore`, or null when the project has none. */
  ignoreFileContent: string | null;
}): IgnoreMatcher {
  const rules: IgnoreRule[] = [];

  for (const entry of getDefaultIgnoreEntries({ isV2Project: options.isV2Project })) {
    const rule = compileIgnoreRule(entry.pattern, 'default');
    if (rule) rules.push(rule);
  }

  if (options.ignoreFileContent !== null) {
    rules.push(...parseIgnoreFile(options.ignoreFileContent));
  }

  return new IgnoreMatcher(rules);
}
