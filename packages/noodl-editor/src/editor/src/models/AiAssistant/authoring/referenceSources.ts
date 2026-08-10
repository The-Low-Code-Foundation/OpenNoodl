/**
 * BLD-011 — the two resolvers that need the open project.
 *
 * `thread/references.ts` is the mechanism and is pure; this is the half that
 * reads a `ProjectModel` and a `docs/` folder, kept apart for the reason the
 * turn model is kept apart — the arithmetic is what a spec can grade, and it
 * cannot grade anything that needs an Electron renderer to construct.
 *
 * **Each later task adds a function here and a member to `ReferenceKind`, and
 * touches nothing else.** BLD-013 resolves a dropped file, BLD-014 a capture,
 * BLD-015 a search, BLD-016 adds the `@` keyboard path to the pickers these
 * two already back. That is the whole point of the task: the chip row, the
 * caps, the cost meter, the carry-over rule and the persistence format are
 * written once, here and next door, rather than four more times.
 *
 * BLD-016 held that promise and charged one thing for it: it added three
 * readers (`page`, `collection`, and the always-sent doc pointer) and one
 * constant, and touched no chip, no meter and no persisted field. What it did
 * *not* get for free was the claim above about caps — `REFERENCE_CAPS.page` was
 * declared beside `doc` and had to be raised to `component`'s, because a page's
 * payload is a component's. **A member declared ahead of its task is a default
 * nobody measured.**
 *
 * @module AiAssistant/authoring/referenceSources
 */

import { ProjectModel } from '../../projectmodel';
import { buildComponentV2Files, legacyNameToPath } from '../../../io/ProjectExporter';
import { currentProjectDocsModel } from '../../ProjectDocs/install';
import { resolveInjection } from '../../ProjectDocs/docsText';
import { projectSchemaCollections } from '../../BackendServices/projectCollections';
import {
  capReferenceText,
  defaultPinned,
  REFERENCE_CAPS,
  type AttachedReference,
  type ReferenceKind
} from '../thread/references';
import { isSamePage } from './pageRegistration';
import { findProjectRouters } from './staging';

/** What a picker offers: one attachable thing, already labelled. */
export interface ReferenceCandidate {
  kind: ReferenceKind;
  /** What the chip and the prompt heading say. */
  label: string;
  /** How the resolver finds it again — a legacy name, or a doc path. */
  target: string;
  /**
   * BLD-016 — the one fact that decides whether to pick this row.
   *
   * A menu of five kinds is a menu of names unless each row says the thing you
   * would otherwise have to open it to find out: how big a component is, how
   * many columns a collection has, and — the one that saves real money —
   * whether a doc is **already sent on every turn**, so that mentioning it pays
   * for `CONVENTIONS.md` twice.
   */
  note?: string;
  /**
   * BLD-016 — this doc is in the always-block, so its body is already in every
   * authoring turn. Carried separately from {@link note} because
   * {@link resolveCandidate} acts on it: an always-sent doc resolves to a
   * pointer rather than a second copy of itself.
   */
  alwaysSent?: boolean;
}

/**
 * The order the two menus show their groups in, and the heading each gets.
 *
 * Shared by `ReferencePicker` (BLD-011's button) and `MentionMenu` (BLD-016's
 * `@`), because they are two doors onto one list. Two hand-maintained orderings
 * would be two lists that disagree about what this project contains, which is
 * the failure `componentDisplayLabel` already documents in the small.
 */
export const CANDIDATE_GROUPS: ReadonlyArray<{ kind: ReferenceKind; title: string }> = [
  { kind: 'component', title: 'Components' },
  { kind: 'page', title: 'Pages' },
  { kind: 'doc', title: 'Documents' },
  { kind: 'collection', title: 'Collections' },
  { kind: 'file', title: 'Attachments' }
];

/**
 * ⚠️ The graph's internal markers, mapped to the folders a person sees.
 *
 * Found by driving the picker: it listed `__page__/Home` and `__cloud__/test`.
 * `legacyNameToPath` strips the leading `/` and `#` but leaves these two
 * markers in — its docstring claims it strips `__cloud__/` and it does not,
 * which is a pre-existing mismatch and not this task's to fix. What *is* this
 * task's: a chip label is the user-facing name of the thing they attached, and
 * `__page__/Home` is a spelling that appears nowhere else in the product.
 *
 * Mapped rather than deleted. Stripping the marker outright would render a page
 * called `Home` and a component called `Home` as the same label, and the folder
 * names below are the ones the Components panel, the plan's `target` and the
 * MCP server all already use.
 *
 * ⚠️ **This maps folders, and it does not decide kinds.** BLD-011 noted here
 * that classifying by folder would quietly halve the cap on every page, since a
 * page's payload is a component's v2 serialization whatever folder it sits in.
 * BLD-016 kept that and answered it the other way round: a page is now its own
 * kind, decided by **router registration** rather than by a folder name — see
 * {@link pageCandidates} — and `REFERENCE_CAPS.page` was raised to equal
 * `component` so the finding still holds. A component in a folder called
 * `Pages` that no Router lists is a component, and reads as one here.
 */
function componentDisplayLabel(legacyName: string): string {
  const path = legacyNameToPath(legacyName);
  if (path.startsWith('__page__/')) return `Pages/${path.slice('__page__/'.length)}`;
  if (path.startsWith('__cloud__/')) return `Cloud/${path.slice('__cloud__/'.length)}`;
  return path;
}

/**
 * Every component in the open project, as attachable candidates.
 *
 * Labelled with the path form (`Pages/Home`) rather than the legacy name
 * (`/Pages/Home`), because the path form is what the rest of this panel shows
 * and what the plan's `target` uses — two spellings of one component in one
 * composer is how a user ends up attaching the same thing twice.
 */
export function componentCandidates(project: ProjectModel | null): ReferenceCandidate[] {
  if (!project) return [];
  const pages = registeredPages(project);
  const candidates: ReferenceCandidate[] = [];
  for (const component of project.getComponents()) {
    const name = component.name as string;
    if (typeof name !== 'string' || name.length === 0) continue;
    // ⚠️ A registered page is listed **once**, under Pages. Listing it in both
    // groups would put two rows with the same label in one menu, and BLD-011
    // already paid for the milder version of that (`Pages/Home` vs
    // `/Pages/Home`): two spellings of one component in one composer is how a
    // user attaches the same thing twice and pays for it twice.
    if (pages.has(name)) continue;
    candidates.push({
      kind: 'component',
      label: componentDisplayLabel(name),
      target: name,
      note: nodeCountNote(component)
    });
  }
  return candidates.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * BLD-016 — the pages, which is a narrower claim than "components in a Pages
 * folder".
 *
 * A page is a component **a Router lists**, and the distinction is the whole
 * value of the row: an unregistered page component is unreachable in the running
 * app (`registeredPages` is the same fact the MCP server's page rule turns on),
 * so the note says which router lists it and which one the app opens on. That is
 * precisely what someone mentioning a page is about to ask a question about.
 */
export function pageCandidates(project: ProjectModel | null): ReferenceCandidate[] {
  if (!project) return [];
  const routers = findProjectRouters(project);
  const candidates: ReferenceCandidate[] = [];
  const seen = new Set<string>();

  for (const router of routers) {
    for (const route of router.pages.routes) {
      const component = project.getComponents().find((c) => isSamePage(c.name as string, route));
      if (!component) continue;
      const name = component.name as string;
      if (seen.has(name)) continue;
      seen.add(name);
      const isStart = router.pages.startPage !== undefined && isSamePage(router.pages.startPage, route);
      const routerName = router.name ?? componentDisplayLabel(router.component);
      candidates.push({
        kind: 'page',
        label: componentDisplayLabel(name),
        target: name,
        note: isStart ? `start page · ${routerName}` : routerName
      });
    }
  }
  return candidates.sort((a, b) => a.label.localeCompare(b.label));
}

/** The legacy names of every component a Router lists, for the split above. */
function registeredPages(project: ProjectModel): Set<string> {
  const registered = new Set<string>();
  for (const router of findProjectRouters(project)) {
    for (const route of router.pages.routes) {
      const component = project.getComponents().find((c) => isSamePage(c.name as string, route));
      if (component) registered.add(component.name as string);
    }
  }
  return registered;
}

/** How big a component is, in the one unit the picker can show in four characters. */
function nodeCountNote(component: { graph?: { forEachNode: (fn: (node: unknown) => void) => void } }): string {
  let count = 0;
  try {
    component.graph?.forEachNode(() => {
      count += 1;
    });
  } catch {
    /* a component whose graph will not walk still lists — it just says nothing */
    return '';
  }
  return count === 1 ? '1 node' : `${count} nodes`;
}

/**
 * BLD-016 — the project's collections, from what the editor actually knows
 * today.
 *
 * ⚠️ **An empty list here means "could not look", not "there is nothing"** —
 * `builtInSchemaCollections` says so in those words, because a stopped backend
 * and a backend with no tables write the same cache value. That is why there is
 * no "this project has no collections" row: the menu shows what it has and says
 * nothing about what it does not, which is the only claim it can support.
 */
export function collectionCandidates(project: ProjectModel | null): ReferenceCandidate[] {
  const collections = projectSchemaCollections(project ?? undefined);
  return collections
    .filter((collection) => Boolean(collection.name?.trim()))
    .map((collection) => ({
      kind: 'collection' as const,
      label: collection.name,
      target: collection.name,
      note: collection.fields.length === 1 ? '1 column' : `${collection.fields.length} columns`
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Every file in the project's `docs/` folder, as attachable candidates.
 *
 * BLD-016 — each row says **how the doc reaches the model**, and the
 * `always sent` case is the reason the column exists. `CONVENTIONS.md` and
 * `BRIEF.md` default to `inject: always`, so their bodies are already in the
 * cache-stable half of every authoring turn: mentioning one without knowing
 * that buys a second, uncached copy of the file the user is most likely to
 * mention. See {@link resolveCandidate} for what is sent instead.
 */
export async function docCandidates(): Promise<ReferenceCandidate[]> {
  const model = currentProjectDocsModel();
  if (!model) return [];
  const entries = await model.list();
  return entries
    // Seed docs are listed whether or not they exist; only a real file is attachable.
    .filter((entry) => entry.exists)
    .map((entry) => {
      const alwaysSent = resolveInjection(entry.path, entry.inject) === 'always';
      return {
        kind: 'doc' as const,
        label: entry.path,
        target: entry.path,
        note: alwaysSent ? 'always sent' : `${entry.chars} chars`,
        ...(alwaysSent ? { alwaysSent: true } : {})
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Everything in the open project that either menu can offer, in group order.
 *
 * One function so the `@` menu and the Add-context button cannot come to
 * different conclusions about what this project contains. Docs are a filesystem
 * read and arrive later; the caller decides whether to wait — `refreshCandidates`
 * shows the in-memory kinds first rather than blocking the whole list on a disk
 * read.
 */
/**
 * BLD-016's fifth kind — the files already on this thread's chip row.
 *
 * ⚠️ **Offered so they can be named, never so they can be attached again.** A
 * message that says "match the spacing in @mock.png" needs the words to point
 * at the picture; the bytes are already riding the turn. `reconcileMentions`
 * treats a token whose label is already on the row as satisfied, so picking one
 * of these inserts text and creates nothing — which is why these candidates
 * appear in the `@` menu and not in the Add-context list, where "attach the
 * thing you have attached" would be the only thing they could mean.
 */
export function attachmentCandidates(references: readonly AttachedReference[]): ReferenceCandidate[] {
  return references
    .filter((ref) => (ref.kind === 'file' || ref.kind === 'capture') && ref.status === 'ready')
    .map((ref) => ({
      kind: 'file' as const,
      label: ref.label,
      target: ref.target,
      note: ref.kind === 'capture' ? 'screenshot' : 'attached file'
    }));
}

export async function referenceCandidates(project: ProjectModel | null): Promise<ReferenceCandidate[]> {
  const docs = await docCandidates();
  return [...componentCandidates(project), ...pageCandidates(project), ...docs, ...collectionCandidates(project)];
}

/** A fresh id per attachment — two attachments of one component are distinct chips. */
let seq = 0;
function nextId(kind: ReferenceKind, target: string): string {
  seq += 1;
  return `${kind}:${target}:${seq}`;
}

/**
 * Attach a candidate, reading its source and capping it now.
 *
 * Resolution is eager and the failure is returned rather than thrown, because
 * build item 6 puts the failure **on the chip, before send**. A rejected
 * promise here would have to be caught by the composer and turned back into
 * this same shape, one call site at a time.
 */
export async function resolveCandidate(
  candidate: ReferenceCandidate,
  project: ProjectModel | null,
  /** BLD-016 — the `@` token that asked for this, when a mention did. */
  mention?: string
): Promise<AttachedReference> {
  const base = {
    id: nextId(candidate.kind, candidate.target),
    kind: candidate.kind,
    label: candidate.label,
    target: candidate.target,
    pinned: defaultPinned(candidate.kind),
    ...(mention ? { mention } : {})
  };

  try {
    const text = await readCandidate(candidate, project);
    return {
      ...base,
      status: 'ready',
      resolution: capReferenceText(text, candidate.label, REFERENCE_CAPS[candidate.kind])
    };
  } catch (e) {
    return { ...base, status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

/** One reader per kind. `file`, `capture` and `search` never reach here. */
async function readCandidate(candidate: ReferenceCandidate, project: ProjectModel | null): Promise<string> {
  switch (candidate.kind) {
    case 'component':
      return readComponent(candidate.target, project);
    case 'page':
      return readPage(candidate.target, project);
    case 'collection':
      return readCollection(candidate.target, project);
    case 'doc':
      return candidate.alwaysSent ? alwaysSentDocPointer(candidate.target) : readDoc(candidate.target);
    default:
      throw new Error(`${candidate.kind} references are not attached from the project.`);
  }
}

/**
 * 🔴 The acceptance criterion that is really a cost decision: **a doc already
 * in the always-block is not sent twice.**
 *
 * `CONVENTIONS.md` and `BRIEF.md` default to `inject: always`, so their bodies
 * are already in `promptDocs()` — the cache-stable half of every authoring turn.
 * Sending the body again as a reference would put the same file in the prompt
 * twice, and the second copy lands *after* the cache boundary (Rule 6), so it
 * is the expensive one: a 4k CONVENTIONS.md mentioned once is 4k of fresh input
 * on the planning turn and again on every component the plan authors, buying
 * nothing the model did not already have.
 *
 * ⚠️ The wording is careful because the two turns are not the same. The always
 * block is in the **authoring** prompt; the planning turn gets `docsOverview`,
 * a listing with character counts, and no bodies. So this sentence says the doc
 * is part of the project's standing context — which is true in both places —
 * rather than "it is above", which would be a lie on the planning turn.
 */
function alwaysSentDocPointer(path: string): string {
  return [
    `${path} is part of this project's standing context: it is declared inject: always, so its full text`,
    'is provided to the authoring turns already. It is named here because the user pointed at it — it is',
    'not repeated, and you are not missing anything by not seeing it in this block.'
  ].join('\n');
}

/**
 * A page: its component's graph, plus the two lines that make it a page.
 *
 * The routing facts lead, because they are what distinguishes this from a
 * component mention and they are three lines against twenty thousand
 * characters. The graph is the same v2 serialization {@link readComponent}
 * produces and is capped at the same 24k — see `REFERENCE_CAPS.page`.
 */
function readPage(legacyName: string, project: ProjectModel | null): string {
  const graph = readComponent(legacyName, project);
  if (!project) return graph;

  const lines: string[] = [];
  for (const router of findProjectRouters(project)) {
    if (!router.pages.routes.some((route) => isSamePage(route, legacyName))) continue;
    const routerName = router.name ?? componentDisplayLabel(router.component);
    const isStart = router.pages.startPage !== undefined && isSamePage(router.pages.startPage, legacyName);
    lines.push(
      `Registered as a page in the router "${routerName}" (in ${componentDisplayLabel(router.component)})` +
        `${isStart ? ', and it is that router\'s start page' : ''}. Navigate to it with target "${legacyName}".`
    );
  }
  return lines.length > 0 ? [...lines, '', graph].join('\n') : graph;
}

/**
 * A collection: its columns, as the agent must spell them.
 *
 * The same shape `renderBackendSchema` writes for the whole schema, for one
 * collection — and it repeats that block's warning about the parameter name,
 * because a mention of a collection is almost always a request to write a
 * Record node against it, and `checkParameterValues` skips dynamic-port nodes
 * entirely. A wrong field name here is caught by nothing.
 */
function readCollection(name: string, project: ProjectModel | null): string {
  const collection = projectSchemaCollections(project ?? undefined).find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (!collection) {
    throw new Error(`No collection called ${name} — the backend may have stopped, or its schema is not synced.`);
  }
  const fields = collection.fields ?? [];
  return [
    `Collection "${collection.name}" holds these columns. Use these names exactly — data nodes take the`,
    'collection through the `collectionName` parameter and each field through a `prop-<field>` port:',
    ...(fields.length > 0
      ? fields.map((field) => `- ${field.name} (${field.type})`)
      : ['(no columns are declared yet — a Record node against it would have no prop-* ports)'])
  ].join('\n');
}

/**
 * A component as the exporter serialises it — the same three v2 files an
 * authoring session gets as its base when it revises one.
 *
 * Deliberately not a summary. The reason to attach a component to a request is
 * to say *"like this one"* or *"the thing this one is missing"*, and both need
 * the ports, the nodes and the connections. `AuthoringSession.createUpdate`
 * already hands the model exactly this for the component being revised, so an
 * attached component reads in the same dialect as the one under construction
 * rather than in a second, prettier one the model has to learn.
 *
 * ⚠️ The timestamp is fixed rather than `now`. Two attachments of an unchanged
 * component must produce identical bytes — a wall-clock field would make every
 * re-attach a different reference to a cache that has no reason to care.
 */
function readComponent(legacyName: string, project: ProjectModel | null): string {
  const component = project?.getComponentWithName(legacyName);
  if (!component) throw new Error(`No component named ${legacyNameToPath(legacyName)} in this project.`);

  const files = buildComponentV2Files(component.toJSON(), FIXED_TIMESTAMP);
  return [
    JSON.stringify(files.component, null, 2),
    '',
    JSON.stringify(files.nodes, null, 2),
    '',
    JSON.stringify(files.connections, null, 2)
  ].join('\n');
}

/** See `readComponent` — an attach must be byte-stable, so the clock is not read. */
const FIXED_TIMESTAMP = '1970-01-01T00:00:00.000Z';

/** A project doc, verbatim. The cap and its notice are applied by the caller. */
async function readDoc(path: string): Promise<string> {
  const model = currentProjectDocsModel();
  if (!model) throw new Error('No project docs are available.');
  const source = await model.read(path);
  if (source === undefined) throw new Error(`${path} could not be read — it may have been deleted.`);
  return source;
}
