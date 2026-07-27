/**
 * AIX-012 — AI project creation: the agreed scope, and everything derived from it.
 *
 * This module is the whole of what a scoping conversation is *allowed* to
 * produce. A `ProjectScope` is prose: a summary, an audience, the objects and
 * their relationships, the pages and what each is for, what the app
 * deliberately will not do, whether there is a backend, the rules the
 * conversation actually established, and — the part with the longest shelf life
 * — what was considered and rejected.
 *
 * There is no field here that can hold a node, a connection, a port or a
 * parameter. That is the point, and it is the reason the "the scoping agent is
 * not allowed to build" rule is structural rather than a line in a prompt: the
 * only tool the conversation has writes into this shape, and this shape cannot
 * express a graph. `planFromScope` then derives the AIX-011 plan *from the
 * agreed pages*, so an operation for a page nobody agreed to is likewise not
 * expressible.
 *
 * Deliberately pure — no `filesystem`, no `ProjectModel`, no Electron, no
 * `AiClient` — for the same reason `authoring/plan.ts` is: `noodl-mcp` imports
 * it verbatim through `editor-deps`, so the editor's on-ramp and Claude Code's
 * write the same documents from the same vocabulary. Two front doors, one
 * format.
 *
 * @module AiAssistant/scoping/scope
 */

import type { AuthoringPlan, PlanOperation } from '../authoring/plan';
import { orderPlanOperations } from '../authoring/plan';
import { DOC_ARCHITECTURE, DOC_BRIEF, DOC_CONVENTIONS, DOC_DECISIONS_DIR } from '../../ProjectDocs/docsText';
import { DOC_TEMPLATES } from '../../ProjectDocs/templates';

/** Where the scoping transcript lands. The one decision doc every AI-scoped project has. */
export const DOC_INITIAL_SCOPE = `${DOC_DECISIONS_DIR}/000-initial-scope.md`;

/**
 * The marker AIX-010 established for "this was not actually agreed". Every
 * renderer below uses it instead of inventing a plausible sentence — confident
 * invented scope is this feature's failure mode, and a reader who cannot tell
 * an agreement from a guess has documentation that is worse than none.
 */
export const TODO_MARKER = '> TODO:';

export interface ScopeObject {
  /** Singular, as a person would say it: "Book", not "books_table". */
  name: string;
  /** What one of these represents in the real world. */
  purpose?: string;
  /** Field descriptions in prose — "title (text)", "finished (yes/no)". */
  fields?: string[];
  /** "belongs to one Shelf", "has many Notes". */
  relationships?: string[];
}

export interface ScopePage {
  /** Display name: "Library", "Book detail". */
  name: string;
  /** What this page is authoritative for — where a record is created vs shown. */
  purpose: string;
}

/**
 * Something the conversation considered and did not do. This is the highest
 * value line in the whole document set: it is the only record that stops the
 * next reader — human or assistant — helpfully rebuilding a thing that was
 * deliberately rejected.
 */
export interface ScopeRejection {
  option: string;
  reason: string;
}

export interface ProjectScope {
  /** The user's opening description, verbatim. Never paraphrased. */
  request: string;
  /** One or two sentences: what this app is. */
  summary?: string;
  /** Who actually opens it and what they are trying to get done. */
  audience?: string;
  objects: ScopeObject[];
  pages: ScopePage[];
  /** What the app deliberately will not do. */
  outOfScope: string[];
  /** A description of the backend, or an explicit "none". */
  backend?: string;
  /** Checkable rules the conversation established — seeds CONVENTIONS.md. */
  conventions: string[];
  rejected: ScopeRejection[];
  /** Things raised and left open. Rendered as `> TODO:` lines, never guessed at. */
  openQuestions: string[];
  /** Set when both parties have agreed the scope is done. */
  agreed: boolean;
}

export function emptyScope(request = ''): ProjectScope {
  return {
    request,
    objects: [],
    pages: [],
    outOfScope: [],
    conventions: [],
    rejected: [],
    openQuestions: [],
    agreed: false
  };
}

/**
 * Whole-field replacement, the same contract every other candidate in this
 * phase uses: a field the model resubmits replaces what was there, a field it
 * omits is left alone. Merging arrays element-wise would make "we dropped the
 * Shelves page" inexpressible, and dropping things is precisely what a scoping
 * conversation must be able to do.
 */
export function mergeScope(previous: ProjectScope, patch: Partial<ProjectScope>): ProjectScope {
  const next: ProjectScope = { ...previous };
  if (typeof patch.summary === 'string') next.summary = patch.summary.trim() || undefined;
  if (typeof patch.audience === 'string') next.audience = patch.audience.trim() || undefined;
  if (typeof patch.backend === 'string') next.backend = patch.backend.trim() || undefined;
  if (Array.isArray(patch.objects)) next.objects = patch.objects.filter((o) => o && o.name?.trim());
  if (Array.isArray(patch.pages)) next.pages = patch.pages.filter((p) => p && p.name?.trim() && p.purpose?.trim());
  if (Array.isArray(patch.outOfScope)) next.outOfScope = patch.outOfScope.filter((s) => s?.trim());
  if (Array.isArray(patch.conventions)) next.conventions = patch.conventions.filter((s) => s?.trim());
  if (Array.isArray(patch.rejected)) {
    next.rejected = patch.rejected.filter((r) => r && r.option?.trim() && r.reason?.trim());
  }
  if (Array.isArray(patch.openQuestions)) next.openQuestions = patch.openQuestions.filter((s) => s?.trim());
  if (typeof patch.agreed === 'boolean') next.agreed = patch.agreed;
  if (typeof patch.request === 'string' && patch.request.trim() && !previous.request.trim()) {
    next.request = patch.request.trim();
  }
  return next;
}

/** True once the conversation has established anything worth writing down. */
export function scopeHasContent(scope: ProjectScope): boolean {
  return Boolean(
    scope.summary ||
      scope.audience ||
      scope.backend ||
      scope.objects.length ||
      scope.pages.length ||
      scope.outOfScope.length ||
      scope.conventions.length ||
      scope.rejected.length
  );
}

/** A short, human-readable outline for the wizard's review step. */
export function scopeOutline(scope: ProjectScope): string[] {
  const lines: string[] = [];
  if (scope.summary) lines.push(scope.summary);
  if (scope.pages.length) {
    lines.push(
      `${scope.pages.length} page${scope.pages.length === 1 ? '' : 's'}: ${scope.pages.map((p) => p.name).join(', ')}`
    );
  }
  if (scope.objects.length) lines.push(`Data: ${scope.objects.map((o) => o.name).join(', ')}`);
  if (scope.backend) lines.push(`Backend: ${scope.backend}`);
  if (scope.outOfScope.length) lines.push(`Out of scope: ${scope.outOfScope.length} item(s)`);
  if (scope.rejected.length) lines.push(`Considered and rejected: ${scope.rejected.length}`);
  if (scope.openQuestions.length) lines.push(`Open questions: ${scope.openQuestions.length}`);
  return lines;
}

// ── Component naming ──────────────────────────────────────────────────────────

/**
 * A page name as a component path. Slashes are stripped rather than escaped:
 * a page called "Books/Detail" is a naming mistake, not a request for a nested
 * folder, and inventing a folder structure the user never asked for is exactly
 * the kind of confident invention this task is supposed to avoid.
 */
export function pageComponentPath(name: string): string {
  const cleaned = name
    .replace(/[\\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `Pages/${cleaned}`;
}

/**
 * The two legacy names a page component can already be under. New projects come
 * from the embedded template, whose home page is `/#__page__/Home`, while
 * anything authored since is `/Pages/<Name>` — so "is there already a page
 * called this" has two answers to check, and getting it wrong produces either a
 * plan that fails validation or a second, orphaned Home.
 */
export function pageLegacyCandidates(name: string): string[] {
  const path = pageComponentPath(name);
  const bare = path.slice('Pages/'.length);
  return [`/${path}`, `/#__page__/${bare}`];
}

// ── The plan ──────────────────────────────────────────────────────────────────

export interface PlanFromScopeOptions {
  /**
   * Legacy names of the components the freshly created project already has
   * (`/App`, `/#__page__/Home` for the embedded template). A page that already
   * exists becomes an `update`, not a `create` — `validatePlan` rejects the
   * other way round, and this is the only place that knows which is which.
   */
  existingComponents?: ReadonlySet<string>;
}

/**
 * The AIX-011 plan this scope implies: one operation per agreed page, in the
 * order they were agreed, with an intent assembled from what the conversation
 * actually said.
 *
 * Two deliberate absences:
 *
 * - **No `doc` operations.** The documents are written by *this* task, at
 *   creation, from the transcript. A doc operation would send a second agent to
 *   re-author BRIEF.md minutes after a human agreed its contents, which is how
 *   a record of a conversation turns into a summary of a summary.
 * - **No operations for anything not in `scope.pages`.** The plan is a function
 *   of the agreed scope, so "the plan contains something we never discussed" is
 *   not a state this code can reach.
 */
export function planFromScope(scope: ProjectScope, options: PlanFromScopeOptions = {}): AuthoringPlan {
  const existing = options.existingComponents ?? new Set<string>();
  const seen = new Set<string>();
  const operations: PlanOperation[] = [];

  for (const page of scope.pages) {
    const candidates = pageLegacyCandidates(page.name);
    const already = candidates.find((c) => existing.has(c));
    // "Pages/Library" for a create; "#__page__/Home" when the template's own
    // home page is what this page is.
    const target = already ? already.replace(/^\//, '') : pageComponentPath(page.name);
    if (seen.has(target)) continue; // two agreed pages with one name — fold, never plan twice
    seen.add(target);

    operations.push({
      id: `op-${operations.length + 1}`,
      kind: already ? 'update' : 'create',
      target,
      intent: pageIntent(scope, page)
    });
  }

  return { request: scope.request, operations: orderPlanOperations(operations) };
}

/**
 * What one page operation is told. The sibling intents are the only contract
 * between operations (AIX-011 §2), so the shared vocabulary — the object names,
 * the other pages that exist — is stated here rather than left to be guessed
 * twice in two different sessions.
 */
function pageIntent(scope: ProjectScope, page: ScopePage): string {
  const parts = [page.purpose.trim().replace(/\s+/g, ' ')];

  const named = scope.objects
    .filter((o) => mentions(page.purpose, o.name) || mentions(page.name, o.name))
    .map((o) => o.name);
  if (named.length > 0) {
    parts.push(`Works with the ${named.join(' and ')} record${named.length > 1 ? 's' : ''} described in docs/ARCHITECTURE.md.`);
  }

  const siblings = scope.pages.filter((p) => p.name !== page.name).map((p) => p.name);
  if (siblings.length > 0) {
    parts.push(`Sibling pages in this app: ${siblings.join(', ')}.`);
  }

  parts.push(`Follow ${DOC_CONVENTIONS}; ${DOC_BRIEF} says what this app deliberately does not do.`);
  return parts.join(' ');
}

function mentions(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ── The documents ─────────────────────────────────────────────────────────────

function bullets(items: readonly string[]): string[] {
  return items.map((item) => `- ${item.trim()}`);
}

/** A heading whose content was never agreed says so, rather than being filled in. */
function todo(what: string): string {
  return `${TODO_MARKER} ${what}`;
}

/**
 * `docs/BRIEF.md` — what this app is, for whom, and what it deliberately is
 * not. Short on purpose: it is injected on every authoring turn, and the cap
 * (`DOC_CAPS.brief`, 1,500 chars) is not generous.
 */
export function renderBrief(scope: ProjectScope): string {
  const lines: string[] = ['# Brief', ''];

  lines.push('## What this app is', '');
  lines.push(scope.summary ?? todo('The scoping conversation did not settle a one-line description. Write one.'));
  lines.push('');

  lines.push('## Who uses it', '');
  lines.push(scope.audience ?? todo('Who actually opens this, and what do they already know?'));
  lines.push('');

  lines.push('## Deliberately out of scope', '');
  if (scope.outOfScope.length > 0) {
    lines.push(...bullets(scope.outOfScope));
  } else {
    lines.push(todo('Nothing was ruled out during scoping. Decide what this app will NOT do — it is the most useful section here.'));
  }
  lines.push('');

  lines.push(
    `_Agreed in the initial scoping conversation; the full record, including what was considered and rejected, is in \`${DOC_INITIAL_SCOPE}\`._`,
    ''
  );
  return lines.join('\n');
}

/**
 * `docs/ARCHITECTURE.md` — page map, data model, backend contracts, decisions.
 *
 * Note what is *not* here: no node inventories, no per-component walkthroughs.
 * At the moment this is written nothing has been built at all, which makes the
 * rule easy to keep — and the file is then the thing the build is measured
 * against rather than a description of it.
 */
export function renderArchitecture(scope: ProjectScope): string {
  const lines: string[] = ['# Architecture', ''];

  lines.push('## Page map', '');
  if (scope.pages.length > 0) {
    for (const page of scope.pages) {
      lines.push(`- **${page.name}** (\`${pageComponentPath(page.name)}\`) — ${page.purpose.trim()}`);
    }
  } else {
    lines.push(todo('No pages were agreed during scoping.'));
  }
  lines.push('');

  lines.push('## Data model', '');
  if (scope.objects.length > 0) {
    for (const object of scope.objects) {
      lines.push(`### ${object.name}`, '');
      if (object.purpose) lines.push(object.purpose.trim(), '');
      if (object.fields?.length) {
        lines.push('Fields:', ...bullets(object.fields), '');
      }
      if (object.relationships?.length) {
        lines.push('Relationships:', ...bullets(object.relationships), '');
      }
      if (!object.purpose && !object.fields?.length && !object.relationships?.length) {
        lines.push(todo(`${object.name} was named but never described. Fill in its shape.`), '');
      }
    }
  } else {
    lines.push(todo('No records were agreed during scoping.'), '');
  }

  lines.push('## Backend contracts', '');
  lines.push(scope.backend ?? todo('Whether this app has a backend was not settled.'));
  lines.push('');

  lines.push('## Decisions', '');
  if (scope.rejected.length > 0) {
    lines.push('Considered during scoping and deliberately not done:', '');
    for (const rejection of scope.rejected) {
      lines.push(`- **${rejection.option.trim()}** — ${rejection.reason.trim()}`);
    }
    lines.push('');
  }
  if (scope.openQuestions.length > 0) {
    lines.push('Left open:', '');
    for (const question of scope.openQuestions) {
      lines.push(todo(question.trim()));
    }
    lines.push('');
  }
  if (scope.rejected.length === 0 && scope.openQuestions.length === 0) {
    lines.push(todo('No alternatives were weighed during scoping. The next significant choice belongs here.'), '');
  }

  lines.push(`_Scoping record: \`${DOC_INITIAL_SCOPE}\`._`, '');
  return lines.join('\n');
}

/**
 * `docs/CONVENTIONS.md` — the seed template, plus what the conversation
 * actually established, and nothing else.
 *
 * The spec is explicit that this file "is not invented wholesale", and the
 * template's own `(example)` rules are what keeps that honest: they are
 * visibly examples. Agreed rules go in their own section, attributed, so a
 * reader can always tell a rule someone chose from a rule that shipped in a
 * starter file.
 */
export function renderConventions(scope: ProjectScope): string {
  const lines = [DOC_TEMPLATES.conventions.trimEnd(), '', '## Established during scoping', ''];
  if (scope.conventions.length > 0) {
    lines.push(...bullets(scope.conventions));
  } else {
    lines.push(
      todo(
        'The scoping conversation did not establish any project-specific rules. The rules above are examples — ' +
          'replace them with rules that are checkable, or delete them.'
      )
    );
  }
  lines.push('', `_Source: \`${DOC_INITIAL_SCOPE}\`._`, '');
  return lines.join('\n');
}

export interface ScopeTranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
}

export interface ScopeRecordInput {
  scope: ProjectScope;
  transcript: readonly ScopeTranscriptEntry[];
  /** The plan handed over at the end. Recorded so it survives the session. */
  plan?: AuthoringPlan;
  /** ISO timestamp; injectable so the spec can assert on exact bytes. */
  at?: string;
  /** Set when the user left the conversation before agreeing a scope. */
  abandoned?: boolean;
}

/**
 * `docs/decisions/000-initial-scope.md` — the reason this task exists.
 *
 * Ordering is deliberate: what was asked, what was decided, **what was
 * considered and rejected**, what is still open, the plan, and only then the
 * transcript. The rejected section is the part with the longest shelf life and
 * the part a summary would drop first, so it is above the fold rather than an
 * appendix, and the verbatim transcript is at the bottom where it can be long
 * without pushing the decisions off the screen.
 */
export function renderScopeRecord(input: ScopeRecordInput): string {
  const { scope, transcript } = input;
  const at = input.at ?? new Date().toISOString();
  const lines: string[] = ['# 000 — Initial scope', ''];

  lines.push(`_Recorded ${at}, from the scoping conversation held before this project was created._`, '');

  if (input.abandoned) {
    lines.push(
      '> This conversation was ended before a scope was agreed. What is written below is what had been',
      '> established at that point — nothing here was inferred to fill the gaps.',
      ''
    );
  }

  lines.push('## What was asked for', '', quote(scope.request || '(no description was given)'), '');

  lines.push('## What was decided', '');
  if (scope.summary) lines.push(`**The app.** ${scope.summary.trim()}`, '');
  if (scope.audience) lines.push(`**Who it is for.** ${scope.audience.trim()}`, '');
  if (scope.pages.length > 0) {
    lines.push('**Pages.**', '');
    for (const page of scope.pages) lines.push(`- ${page.name} — ${page.purpose.trim()}`);
    lines.push('');
  }
  if (scope.objects.length > 0) {
    lines.push('**Records.**', '');
    for (const object of scope.objects) {
      const detail = [object.purpose, object.fields?.join(', '), object.relationships?.join('; ')]
        .filter(Boolean)
        .join(' — ');
      lines.push(`- ${object.name}${detail ? ` — ${detail}` : ''}`);
    }
    lines.push('');
  }
  if (scope.backend) lines.push(`**Backend.** ${scope.backend.trim()}`, '');
  if (scope.conventions.length > 0) {
    lines.push('**Rules for this project.**', '', ...bullets(scope.conventions), '');
  }
  if (!scopeHasContent(scope)) {
    lines.push(todo('Nothing was agreed beyond the opening description.'), '');
  }

  lines.push('## What was considered and rejected', '');
  if (scope.rejected.length > 0) {
    lines.push(
      'This is the section with the longest shelf life. It is what stops the next reader — or the next',
      'assistant — helpfully rebuilding something that was deliberately left out.',
      ''
    );
    for (const rejection of scope.rejected) {
      lines.push(`- **${rejection.option.trim()}** — rejected: ${rejection.reason.trim()}`);
    }
    lines.push('');
  } else {
    lines.push(todo('No alternatives were weighed. If one was and it is missing here, add it.'), '');
  }

  lines.push('## Deliberately out of scope', '');
  if (scope.outOfScope.length > 0) lines.push(...bullets(scope.outOfScope), '');
  else lines.push(todo('Nothing was ruled out.'), '');

  lines.push('## Still open', '');
  if (scope.openQuestions.length > 0) {
    for (const question of scope.openQuestions) lines.push(todo(question.trim()));
    lines.push('');
  } else {
    lines.push('Nothing was left open in the conversation.', '');
  }

  lines.push('## Proposed build plan', '');
  if (input.plan && input.plan.operations.length > 0) {
    lines.push(
      'Produced from the scope above and handed over unexecuted — no components were authored during',
      'scoping. Review it before building.',
      ''
    );
    input.plan.operations.forEach((op, index) => {
      lines.push(`${index + 1}. **${op.kind} \`${op.target}\`** — ${op.intent}`);
    });
    lines.push('');
  } else {
    lines.push('No pages were agreed, so no plan was produced.', '');
  }

  lines.push('## Transcript', '');
  if (transcript.length > 0) {
    for (const entry of transcript) {
      lines.push(`**${entry.role === 'user' ? 'You' : 'Assistant'}:**`, '', quote(entry.text), '');
    }
  } else {
    lines.push('_(no transcript was captured)_', '');
  }

  return lines.join('\n');
}

/** Block-quote a multi-line chunk so a stray heading in it cannot restructure the doc. */
function quote(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

export interface ScopeDocument {
  path: string;
  content: string;
}

/**
 * Every document an agreed scope produces, in the order they should be written.
 * One function so the editor's on-ramp and the MCP server cannot drift into
 * writing different files from the same conversation.
 */
export function scopeDocuments(input: ScopeRecordInput): ScopeDocument[] {
  return [
    { path: DOC_BRIEF, content: renderBrief(input.scope) },
    { path: DOC_ARCHITECTURE, content: renderArchitecture(input.scope) },
    { path: DOC_CONVENTIONS, content: renderConventions(input.scope) },
    { path: DOC_INITIAL_SCOPE, content: renderScopeRecord(input) }
  ];
}
