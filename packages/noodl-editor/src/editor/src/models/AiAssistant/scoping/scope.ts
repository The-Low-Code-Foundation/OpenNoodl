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

import type {
  AuthoringPlan,
  PlanOperation,
  PlanProvisionCollection,
  PlanProvisionColumn,
  PlanProvisionSpec
} from '../authoring/plan';
import { orderPlanOperations } from '../authoring/plan';
import { DOC_ARCHITECTURE, DOC_BRIEF, DOC_CONVENTIONS, DOC_DECISIONS_DIR } from '../../ProjectDocs/docsText';
import { DOC_TEMPLATES } from '../../ProjectDocs/templates';

/** Where the scoping transcript lands. The one decision doc every AI-scoped project has. */
export const DOC_INITIAL_SCOPE = `${DOC_DECISIONS_DIR}/000-initial-scope.md`;

/**
 * AIB-003 — the info string that marks the machine-readable plan block.
 *
 * A tag rather than a bare ```json fence, because the record is a document a
 * person edits and may well paste other JSON into. The parser looks for this
 * exact tag, so a user's own example can never be mistaken for the plan.
 */
export const PLAN_FENCE_TAG = 'nodegx-plan';

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

/**
 * AIB-007 — what the conversation settled about storing data.
 *
 * `description` is the field that was here before, unchanged in meaning and
 * still the only thing any document renders: ARCHITECTURE.md's `## Backend
 * contracts` section is prose the conversation wrote, and turning it into a
 * generated table would lose the sentence that says *why* — which is the part
 * with the shelf life. The structure beside it exists so that something other
 * than a reader can act on it.
 *
 * ⚠️ `kind: 'nodegx'` is the only value that provisions. `'external'` records
 * that the app talks to a backend somebody else runs — the scope knows about it,
 * nothing here creates it, and the AIB-007 diagnostic stays a warning rather than
 * an error because the user is expected to point the project at it themselves.
 */
export interface ScopeBackend {
  /**
   * ⚠️ **Four values, where AIB-007's task doc named three.** The fourth,
   * `'unspecified'`, is what a conversation that only produced *prose* becomes —
   * and that is not a hypothetical legacy case: this field was a bare `string`
   * until this task, `noodl-mcp`'s `create_project` accepts one, and a model
   * given a schema does not always fill it in.
   *
   * The alternative was to classify prose as `'external'`, which reads as "the
   * conversation agreed there is a backend somewhere else". Nobody said that.
   * `'unspecified'` provisions nothing (like `'external'`) and diagnoses as a
   * warning rather than an error (like `'external'`), so it costs one union
   * member and no behaviour — and it is the difference between recording an
   * agreement and inventing one, which is the rule this whole module is built
   * around.
   */
  kind: 'none' | 'nodegx' | 'external' | 'unspecified';
  /** What the conversation actually said. Written to ARCHITECTURE.md verbatim. */
  description: string;
  /** Collections the conversation named, with the fields it named. */
  collections?: ScopeCollection[];
  /** Set when the conversation agreed users log in. */
  needsAuth?: boolean;
}

export interface ScopeCollection {
  name: string;
  fields?: Array<{ name: string; type?: string }>;
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
  /**
   * What the app stores data in. AIB-007 made this structured; a bare string is
   * still accepted by {@link mergeScope} and normalised, because the model writes
   * this field and a schema change does not retroactively change what a model
   * that has already been asked will send.
   */
  backend?: ScopeBackend;
  /** Checkable rules the conversation established — seeds CONVENTIONS.md. */
  conventions: string[];
  rejected: ScopeRejection[];
  /** Things raised and left open. Rendered as `> TODO:` lines, never guessed at. */
  openQuestions: string[];
  /** AAQ-003 — how this app scrolls. Absent means page-like, the safe default. */
  scroll?: ScopeScroll;
  /** Set when both parties have agreed the scope is done. */
  agreed: boolean;
}

/**
 * AAQ-003 — the two shapes an app has, and the one project setting that decides
 * which one it is.
 *
 * `'page'`: the browser scrolls, as on any web page. Marketing sites, listings,
 * docs. `bodyScroll` on.
 *
 * `'app'`: a fixed shell with its own scrolling regions — a dashboard with a
 * sidebar, a chat. `bodyScroll` off, and each scrolling region is a Group with
 * `scrollEnabled`.
 *
 * The default (`bodyScroll` unset, which is falsy) is `'app'`, and **nothing in
 * the AI path ever chose it** — so every AI-built page was born clipped at the
 * viewport with no scrollbar, in this app and the one before it. Richard:
 * *"any page created by AI isn't scrollable"*. It was never a preview bug; the
 * deployed app clipped identically.
 */
export type ScopeScroll = 'page' | 'app';

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
export function mergeScope(
  previous: ProjectScope,
  // AIB-007: `backend` widened to accept the prose a pre-AIB-007 caller sends.
  // `Partial<ProjectScope>` alone would reject it at the type level and the
  // *callers that send it are the ones we do not control* — a model's tool call,
  // and `noodl-mcp`'s `create_project` args.
  patch: Partial<Omit<ProjectScope, 'backend'>> & { backend?: ScopeBackendInput }
): ProjectScope {
  const next: ProjectScope = { ...previous };
  if (typeof patch.summary === 'string') next.summary = patch.summary.trim() || undefined;
  if (typeof patch.audience === 'string') next.audience = patch.audience.trim() || undefined;
  if (patch.backend !== undefined) next.backend = normalizeScopeBackend(patch.backend);
  if (Array.isArray(patch.objects)) next.objects = patch.objects.filter((o) => o && o.name?.trim());
  if (Array.isArray(patch.pages)) next.pages = patch.pages.filter((p) => p && p.name?.trim() && p.purpose?.trim());
  if (Array.isArray(patch.outOfScope)) next.outOfScope = patch.outOfScope.filter((s) => s?.trim());
  if (Array.isArray(patch.conventions)) next.conventions = patch.conventions.filter((s) => s?.trim());
  if (Array.isArray(patch.rejected)) {
    next.rejected = patch.rejected.filter((r) => r && r.option?.trim() && r.reason?.trim());
  }
  if (Array.isArray(patch.openQuestions)) next.openQuestions = patch.openQuestions.filter((s) => s?.trim());
  // AAQ-003. Validated against the union rather than cast: it arrives from a
  // model, and an unrecognised value quietly becoming 'app' would ship the
  // clipped page this field exists to stop.
  if (patch.scroll === 'page' || patch.scroll === 'app') next.scroll = patch.scroll;
  if (typeof patch.agreed === 'boolean') next.agreed = patch.agreed;
  if (typeof patch.request === 'string' && patch.request.trim() && !previous.request.trim()) {
    next.request = patch.request.trim();
  }
  return next;
}

/**
 * What may arrive claiming to be a backend.
 *
 * Deliberately looser than {@link ScopeBackend}: `kind` is optional and
 * `description` may be missing, because the two callers are a model's tool call
 * and `noodl-mcp`'s zod-inferred args, neither of which the type system can make
 * honest. The looseness is the *point* — a required `kind` here would be a cast
 * at every call site, which is a type that lies rather than a type that checks.
 */
export type ScopeBackendInput = string | (Partial<Omit<ScopeBackend, 'collections'>> & { collections?: unknown });

/** Prose a person writes to mean "there isn't one". Matched whole, never as a substring. */
const NO_BACKEND_PROSE = new Set(['none', 'no', 'no backend', 'none.', 'n/a', 'na', 'nothing', 'local only']);

/**
 * AIB-007 — whatever arrived, as a {@link ScopeBackend}, or `undefined`.
 *
 * Two shapes reach this: the object the tool schema now asks for, and the bare
 * string it asked for before (still what `noodl-mcp`'s `create_project` accepts,
 * and still what a model may send). Neither is trusted: `kind` is validated
 * against the union rather than cast, because it arrives from a model and an
 * unrecognised value silently satisfying `'nodegx'` would provision a backend
 * nobody agreed to.
 */
export function normalizeScopeBackend(value: ScopeBackendInput | undefined | null): ScopeBackend | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    const description = value.trim();
    if (!description) return undefined;
    // Prose only. `'unspecified'` unless it plainly says there is none — see the
    // note on `ScopeBackend.kind` for why this does not guess any harder.
    return {
      kind: NO_BACKEND_PROSE.has(description.toLowerCase()) ? 'none' : 'unspecified',
      description
    };
  }

  if (typeof value !== 'object') return undefined;

  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const kind: ScopeBackend['kind'] =
    value.kind === 'none' || value.kind === 'nodegx' || value.kind === 'external'
      ? value.kind
      : // An absent or unrecognised kind is not an error and not a guess. If the
        // prose plainly says there is none, take that; otherwise say we do not
        // know. Note the asymmetry: we will conclude "no backend" from prose, and
        // never "provision one" — the two mistakes do not cost the same.
        NO_BACKEND_PROSE.has(description.toLowerCase())
        ? 'none'
        : 'unspecified';

  const collections = Array.isArray(value.collections)
    ? (value.collections as unknown[])
        .filter((c): c is ScopeCollection => {
          const entry = c as ScopeCollection | undefined;
          return Boolean(entry && typeof entry.name === 'string' && entry.name.trim());
        })
        .map((c) => ({
          name: c.name.trim(),
          ...(Array.isArray(c.fields)
            ? {
                fields: c.fields
                  .filter((f) => f && typeof f.name === 'string' && f.name.trim())
                  .map((f) => ({
                    name: f.name.trim(),
                    ...(typeof f.type === 'string' && f.type.trim() ? { type: f.type.trim() } : {})
                  }))
              }
            : {})
        }))
    : undefined;

  if (!description && !collections?.length && kind === 'unspecified') return undefined;

  return {
    kind,
    description,
    ...(collections && collections.length > 0 ? { collections } : {}),
    ...(value.needsAuth === true ? { needsAuth: true } : {})
  };
}

/** The prose half, for every renderer that used to read `scope.backend` directly. */
export function scopeBackendDescription(scope: ProjectScope): string | undefined {
  const description = scope.backend?.description?.trim();
  return description || undefined;
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
  const backend = scopeBackendDescription(scope);
  if (backend) lines.push(`Backend: ${backend}`);
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
  /**
   * AIB-007 — set when the project already has a backend configured.
   *
   * A plan does not offer to provision a second one. This is passed rather than
   * read because this module is pure and shared with `noodl-mcp`; the editor
   * binds it from `cloudservices`, the MCP server from the project it just wrote
   * (which has none).
   */
  hasBackend?: boolean;
  /**
   * Display name for a provisioned backend.
   *
   * ⚠️ Had **no production caller** for two phases, so every provision was named
   * by the fallback below — and since `findReusableBackend` matched on name, one
   * constant name meant one shared backend for every AI project on the machine
   * (AAQ-002/F4). Pass {@link backendNameForProject}; the fallback is for callers
   * that genuinely have no project yet.
   */
  backendName?: string;
}

/** What a backend gets called when nobody named one. */
export const DEFAULT_PROVISIONED_BACKEND_NAME = 'App backend';

/**
 * What to call the backend a project provisions for itself — AAQ-002/F4.
 *
 * The list in Backend Services is machine-wide, so the name is the only thing
 * telling a human which app a backend belongs to. "App backend" told them
 * nothing, three times over.
 *
 * A project already ending in "backend" is left alone rather than becoming
 * "Puppy backend backend", and a project with no usable name falls back rather
 * than producing a bare " backend".
 */
export function backendNameForProject(projectName: string | undefined): string {
  const name = (projectName ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return DEFAULT_PROVISIONED_BACKEND_NAME;
  return /backend$/i.test(name) ? name : `${name} backend`;
}

/**
 * AIB-007 — the `PlanProvisionSpec` this scope implies, or `undefined`.
 *
 * Only `kind: 'nodegx'` provisions. `'external'` and `'unspecified'` describe a
 * backend this editor does not run and must not create, and `'none'` is an
 * agreement that there isn't one — which is a decision to respect, not a gap to
 * fill.
 *
 * Collections come from `backend.collections` when the conversation named them,
 * and otherwise from `scope.objects` — which is the same list said a different
 * way, and is the field the scoping prompt has always pushed hardest on. A
 * scope with three objects and no explicit collections is the common case, not
 * the degenerate one.
 */
export function provisionFromScope(scope: ProjectScope, options: PlanFromScopeOptions = {}): PlanProvisionSpec | undefined {
  const backend = scope.backend;
  if (!backend || backend.kind !== 'nodegx') return undefined;
  if (options.hasBackend) return undefined;

  const named = backend.collections?.length
    ? backend.collections.map((c) => ({ name: c.name, fields: c.fields }))
    : scope.objects.map((o) => ({ name: o.name, fields: undefined }));

  const collections: PlanProvisionCollection[] = [];
  const seen = new Set<string>();
  for (const entry of named) {
    const name = collectionName(entry.name);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    collections.push({ name, columns: (entry.fields ?? []).map(toColumn).filter((c): c is PlanProvisionColumn => Boolean(c)) });
  }

  return {
    name: options.backendName?.trim() || DEFAULT_PROVISIONED_BACKEND_NAME,
    collections,
    needsAuth: backend.needsAuth === true
  };
}

/**
 * A scope object name as a collection name.
 *
 * Deliberately conservative: spaces and punctuation out, the rest left exactly
 * as the conversation said it. Pluralising "Book" to "Books" was considered and
 * rejected — the collection name appears in every Query Records node the plan
 * authors, and the authoring turns are told the object names from
 * ARCHITECTURE.md. A collection called something the docs never mention is a
 * plan whose nodes point at nothing.
 */
function collectionName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]+/g, '').trim();
}

/**
 * A prose field description as a typed column, or `undefined` when it is not
 * one.
 *
 * `ScopeCollection.fields[].type` is a hint from a model, not a `nodegx-backend`
 * column type, so it is *mapped* rather than passed through — an unmapped type
 * yields no column at all rather than a column the schema manager will refuse.
 * The backend infers the type from the first record written either way, so the
 * cost of dropping one is a column typed later instead of now.
 */
function toColumn(field: { name: string; type?: string }): PlanProvisionColumn | undefined {
  const name = field.name.replace(/[^A-Za-z0-9_]+/g, '').trim();
  // `objectId`, `createdAt` and `updatedAt` are the backend's own; a column of
  // that name is refused by the schema manager, not merged.
  if (!name || ['objectId', 'createdAt', 'updatedAt', 'ACL', 'id'].includes(name)) return undefined;
  const type = columnType(field.type);
  return type ? { name, type } : undefined;
}

function columnType(hint: string | undefined): string | undefined {
  if (!hint) return undefined;
  const h = hint.toLowerCase();
  if (/\b(number|int|integer|float|decimal|count|amount)\b/.test(h)) return 'Number';
  if (/\b(bool|boolean|yes\/no|yes or no|flag|true\/false)\b/.test(h)) return 'Boolean';
  if (/\b(date|datetime|timestamp|time)\b/.test(h)) return 'Date';
  if (/\b(text|string|str|name|title|email|url)\b/.test(h)) return 'String';
  return undefined;
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

  // AIB-007. First in the list because `orderPlanOperations` puts it first
  // anyway, and because the id sequence reads better when it matches the order
  // the user sees.
  const provision = provisionFromScope(scope, options);
  if (provision) {
    operations.push({
      id: `op-${operations.length + 1}`,
      kind: 'provision',
      target: provision.name,
      intent: provisionIntent(scope, provision),
      provision
    });
  }

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

  return {
    request: scope.request,
    operations: orderPlanOperations(operations),
    // AAQ-003: only when this plan builds pages. A scope with no pages has no
    // opinion about how the app scrolls, and a plan that states one anyway would
    // change a project setting nobody discussed.
    ...(scope.pages.length > 0 ? { scroll: scope.scroll ?? 'page' } : {})
  };
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

/**
 * What the provision row says it will do — the sentence the user reads before
 * approving it, and the only description of a side effect this plan has outside
 * the project folder.
 *
 * It says where the backend lives on purpose. "A backend appears" is the version
 * of this that produces the next AIB-007: a user who does not know the backend
 * is a process on their own machine cannot reason about what happens when they
 * deploy, or when they open the project somewhere else.
 */
function provisionIntent(scope: ProjectScope, provision: PlanProvisionSpec): string {
  const parts = ['Give this project a built-in backend that runs on this computer.'];
  if (provision.collections.length > 0) {
    parts.push(`Collections: ${provision.collections.map((c) => c.name).join(', ')}.`);
  }
  if (provision.needsAuth) parts.push('People sign in, so it keeps user accounts.');
  const said = scopeBackendDescription(scope);
  if (said) parts.push(`The conversation said: ${said}`);
  return parts.join(' ');
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

  // AIB-007 criterion 1: unchanged in character. The section is still the
  // conversation's own prose and nothing else — the structure the scope now
  // carries beside it drives the *plan*, and a generated collection table here
  // would displace the sentence that says why, which is the part with the shelf
  // life.
  lines.push('## Backend contracts', '');
  lines.push(scopeBackendDescription(scope) ?? todo('Whether this app has a backend was not settled.'));
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
  const backendProse = scopeBackendDescription(scope);
  if (backendProse) lines.push(`**Backend.** ${backendProse}`, '');
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
    // AIB-003 slice 3: the same plan, exactly, in a form the editor can read
    // back. This module's own note has always said the record makes the plan
    // "durable and readable without [the handover] seam" — and nothing read it,
    // so closing the launcher before opening the Build panel lost the plan for
    // good. A fenced block keeps the file one human-readable document, which is
    // its entire purpose, and gives the parser exactly one thing to look for.
    lines.push(
      '<!-- The same plan, for the editor to read back if it is offered again. Safe to delete. -->',
      '',
      '```json ' + PLAN_FENCE_TAG,
      JSON.stringify({ version: 1, plan: input.plan }, null, 2),
      '```',
      ''
    );
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
