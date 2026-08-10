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
 * @module AiAssistant/authoring/referenceSources
 */

import { ProjectModel } from '../../projectmodel';
import { buildComponentV2Files, legacyNameToPath } from '../../../io/ProjectExporter';
import { currentProjectDocsModel } from '../../ProjectDocs/install';
import {
  capReferenceText,
  defaultPinned,
  REFERENCE_CAPS,
  type AttachedReference,
  type ReferenceKind
} from '../thread/references';

/** What a picker offers: one attachable thing, already labelled. */
export interface ReferenceCandidate {
  kind: ReferenceKind;
  /** What the chip and the prompt heading say. */
  label: string;
  /** How the resolver finds it again — a legacy name, or a doc path. */
  target: string;
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
  return project
    .getComponents()
    .map((component) => component.name as string)
    .filter((name) => typeof name === 'string' && name.length > 0)
    .map((name) => ({ kind: 'component' as const, label: legacyNameToPath(name), target: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Every file in the project's `docs/` folder, as attachable candidates. */
export async function docCandidates(): Promise<ReferenceCandidate[]> {
  const model = currentProjectDocsModel();
  if (!model) return [];
  const entries = await model.list();
  return entries
    // Seed docs are listed whether or not they exist; only a real file is attachable.
    .filter((entry) => entry.exists)
    .map((entry) => ({ kind: 'doc' as const, label: entry.path, target: entry.path }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
  project: ProjectModel | null
): Promise<AttachedReference> {
  const base = {
    id: nextId(candidate.kind, candidate.target),
    kind: candidate.kind,
    label: candidate.label,
    target: candidate.target,
    pinned: defaultPinned(candidate.kind)
  };

  try {
    const text =
      candidate.kind === 'component'
        ? readComponent(candidate.target, project)
        : await readDoc(candidate.target);
    return {
      ...base,
      status: 'ready',
      resolution: capReferenceText(text, candidate.label, REFERENCE_CAPS[candidate.kind])
    };
  } catch (e) {
    return { ...base, status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
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
