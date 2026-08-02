/**
 * AIX-011 live-pass residual — an update session must be judged against the
 * component it is revising, not against a standard that component does not meet.
 *
 * Both defects here were found by running the live harness and then reproducing
 * the failure deterministically: what does the gate say about a PERFECT
 * resubmission — the candidate a model produces when it copies the current
 * component back verbatim? If that cannot pass, no model can, and the repair
 * loop is not a repair loop but a treadmill.
 *
 *  1. `/App` in the corpus project is the one component of 44 whose project.json
 *     entry has no `id`. Every candidate came back "SCHEMA component.json /:
 *     must have required property 'id'" — a field `submit_component` cannot
 *     express — so the session exhausted its submission budget, every time.
 *  2. `/Visual Components/Article/Article` holds four module-provided nodes
 *     (`Markdown`, `module.inlineHtml`) the catalog does not carry. Their
 *     unknown-type errors were charged to the agent's candidate, and the agent —
 *     told to take diagnostics literally — retyped all four to `Text` under the
 *     same ids. Both live plan runs did it.
 */

import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { validateCandidateComponent } from '../../src/editor/src/models/AiAssistant/authoring/validate';
import type {
  ComponentFiles,
  SubmitPayload
} from '../../src/editor/src/models/AiAssistant/authoring/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { buildComponentV2Files } from '../../src/editor/src/io/ProjectExporter';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const GRAPH = fromSerialisedProject(gitRepoUtf8);

function baseFilesOf(legacyName: string): ComponentFiles {
  const legacy = (gitRepoUtf8.components as { name: string }[]).find((c) => c.name === legacyName);
  expect(legacy).toBeDefined();
  return buildComponentV2Files(legacy as never, '1970-01-01T00:00:00.000Z') as ComponentFiles;
}

/** What the model submits when it keeps the component exactly as it found it. */
function perfectResubmission(base: ComponentFiles): SubmitPayload {
  return {
    nodes: base.nodes.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      ...(n.parent !== undefined ? { parent: n.parent } : {}),
      ...(n.parameters ? { parameters: n.parameters } : {}),
      ...(n.ports ? { ports: n.ports } : {})
    })),
    connections: base.connections.connections.map((c) => ({
      fromId: c.fromId,
      fromProperty: c.fromProperty,
      toId: c.toId,
      toProperty: c.toProperty
    })),
    ...(base.nodes.visualRoots ? { visualRoots: base.nodes.visualRoots } : {})
  } as SubmitPayload;
}

function candidateFor(componentPath: string, base: ComponentFiles): ComponentFiles {
  const candidate = buildCandidate(
    { description: 'revise', componentPath },
    perfectResubmission(base),
    '1970-01-01T00:00:00.000Z',
    base
  );
  expect(candidate.errors).toEqual([]);
  return candidate.files!;
}

describe('AIX-011 — update mode is judged against its own base', () => {
  it('gives the candidate a component id even when the base has none', () => {
    const base = baseFilesOf('/App');
    // The premise of the whole failure: the exporter carries an id it does not have.
    expect(base.component.id).toBeUndefined();

    const files = candidateFor('App', base);
    expect(typeof files.component.id).toBe('string');
    expect(files.component.id).toBe(files.nodes.componentId);

    const result = validateCandidateComponent(GRAPH, '/App', files, { baseline: base });
    expect(result.structural).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('fails structurally without that id — the error the agent could not act on', () => {
    const base = baseFilesOf('/App');
    const files = candidateFor('App', base);
    const idless: ComponentFiles = { ...files, component: { ...files.component } };
    delete (idless.component as { id?: string }).id;

    const result = validateCandidateComponent(GRAPH, '/App', idless, { baseline: base });
    expect(result.ok).toBe(false);
    expect(result.structural!.some((f) => f.file === 'component.json')).toBe(true);
  });

  it('does not charge the agent for unknown node types the component already had', () => {
    const legacyName = '/Visual Components/Article/Article';
    const base = baseFilesOf(legacyName);
    const files = candidateFor('Visual Components/Article/Article', base);

    // Without a baseline this is exactly the pressure that produced the retype.
    const unbaselined = validateCandidateComponent(GRAPH, legacyName, files);
    expect(unbaselined.ok).toBe(false);
    expect(unbaselined.errors.every((d) => d.code === 'unknown-node-type')).toBe(true);

    const baselined = validateCandidateComponent(GRAPH, legacyName, files, { baseline: base });
    expect(baselined.ok).toBe(true);
    expect(baselined.errors).toEqual([]);
    // Reported, not hidden: a reviewer still sees them.
    expect(baselined.preExisting!.length).toBe(unbaselined.errors.length);
    expect(baselined.diagnostics.length).toBeGreaterThan(0);
  });

  it('still blocks a NEW unknown type in a component that already had some', () => {
    const legacyName = '/Visual Components/Article/Article';
    const base = baseFilesOf(legacyName);
    const files = candidateFor('Visual Components/Article/Article', base);
    files.nodes.nodes.push({ id: 'brand-new', type: 'module.notAThing' });

    const result = validateCandidateComponent(GRAPH, legacyName, files, { baseline: base });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].location.nodeId).toBe('brand-new');
  });

  it('suppresses nothing without a baseline — create mode is unchanged', () => {
    const legacyName = '/Visual Components/Article/Article';
    const files = candidateFor('Visual Components/Article/Article', baseFilesOf(legacyName));
    const result = validateCandidateComponent(GRAPH, legacyName, files);
    expect(result.preExisting).toBeUndefined();
    expect(result.ok).toBe(false);
  });
});
