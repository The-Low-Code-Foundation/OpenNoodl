/**
 * LEG-001 — the flat `comment` an agent writes, and the metadata bag it lands in.
 *
 * The spec's warning is the reason this file exists at all: the bag is shared.
 * It holds `merge.soureCodePorts` for the SUB-007 merge driver, the AI prompt
 * history, and — in projects saved before CED-001 — `codeHistory_*` keys that
 * `stripCodeHistoryMetadata` removes on the way in. "Adding a key beside `merge`
 * must not disturb it" is asserted here, not assumed, and so is the direction
 * nobody thinks about: an agent that says nothing about a comment must not
 * delete the one that is already there.
 *
 * What this runner cannot reach, and where it is instead: the model layer
 * (`NodeGraphNode.setComment`, the undo entry, the canvas stripe) needs the
 * Jasmine/Electron renderer — `NodeGraphNode` imports `NodeLibrary`,
 * `ComponentModel` and the undo queue. The one thing that must hold across that
 * boundary is the *key name*, and the last case below pins it against the source
 * rather than trusting two files to keep agreeing by luck.
 *
 * @see dev-docs/tasks/phase-50-legibility/LEG-001-THE-ONLY-FIELD-STILL-EMPTY.md
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import type {
  AuthoringRequest,
  ComponentFiles,
  SubmitPayload
} from '../../src/editor/src/models/AiAssistant/authoring/types';
import { stripCodeHistoryMetadata } from '../../src/editor/src/models/CodeHistory/codeHistoryMetadata';
import {
  AUTHORED_NODE_FIELDS,
  foldNodeComment,
  metadataWithComment,
  unfoldNodeComment
} from '../../src/editor/src/validation/authoringVocabulary';
import { ProjectExporter, legacyNameToPath } from '../../src/editor/src/io/ProjectExporter';
import { ProjectImporter } from '../../src/editor/src/io/ProjectImporter';
import type { ImportInput } from '../../src/editor/src/io/ProjectImporter';
import type { NodesV2File, ProjectV2File, RegistryV2File } from '../../src/editor/src/schemas';

/** A sentence of the kind §4 says earns its place: a decision with an alternative. */
const WHY = 'Deliberately not a Repeater — the three cards differ in more than data.';

const REQUEST: AuthoringRequest = { description: 'a probe', componentPath: 'Components/Probe' };

function payload(nodes: SubmitPayload['nodes']): SubmitPayload {
  return { nodes };
}

/** The candidate's nodes, or a failure naming the shape errors instead. */
function nodesOf(result: ReturnType<typeof buildCandidate>) {
  if (!result.files) throw new Error(`buildCandidate refused: ${result.errors.join('; ')}`);
  return result.files.nodes.nodes;
}

/** A base component whose one node already carries a shared metadata bag. */
function baseWith(metadata: Record<string, unknown>): ComponentFiles {
  return {
    component: {
      $schema: 'https://opennoodl.dev/schemas/component-v2.json',
      id: 'c1',
      name: 'Probe',
      path: '/Components/Probe',
      type: 'visual',
      created: '2026-08-01T00:00:00.000Z',
      modified: '2026-08-01T00:00:00.000Z'
    },
    nodes: {
      $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
      componentId: 'c1',
      version: 1,
      nodes: [{ id: 'n1', type: 'Function', metadata }]
    },
    connections: {
      $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
      componentId: 'c1',
      version: 1,
      connections: []
    }
  };
}

describe('LEG-001 — the field is in the vocabulary', () => {
  it('declares comment on a node, optional, stored in the metadata bag', () => {
    const field = AUTHORED_NODE_FIELDS.find((f) => f.name === 'comment');
    expect(field).toBeDefined();
    expect(field!.kind).toBe('string');
    // Optional deliberately: the 89.3% arm of the experiment was optional, and
    // requiring it in MCP would hard-reject calls that are valid today.
    expect(field!.requiredIn).toBeUndefined();
    // Shared: a field only one door offers would rebuild the gap this closes.
    expect(field!.exposedTo).toBeUndefined();
    expect(field!.storedAs).toBe('metadata.comment');
  });
});

describe('LEG-001 — submit_component writes into the bag without disturbing it', () => {
  it('puts an authored comment at metadata.comment, not at the top level', () => {
    const nodes = nodesOf(buildCandidate(REQUEST, payload([{ id: 'n1', type: 'Group', comment: WHY }])));

    expect(nodes[0].metadata).toEqual({ comment: WHY });
    expect('comment' in nodes[0]).toBe(false);
  });

  it('leaves merge.soureCodePorts standing when a comment is written beside it', () => {
    // The whole warning in one case. `merge` is the SUB-007 driver's, written by
    // `toJSON` for every node with a source-code port; a comment that rebuilt the
    // bag instead of copying it would take the merge info with it and nothing
    // would say so until a three-way merge went wrong.
    const base = baseWith({ merge: { soureCodePorts: ['functionScript'] } });
    const nodes = nodesOf(
      buildCandidate(REQUEST, payload([{ id: 'n1', type: 'Function', comment: WHY }]), undefined, base)
    );

    expect(nodes[0].metadata).toEqual({ merge: { soureCodePorts: ['functionScript'] }, comment: WHY });
  });

  it('keeps an existing comment when the agent says nothing about it', () => {
    // `metadata` is one of `CARRIED_NODE_FIELDS`, and the fold runs after the
    // carry. An AI revision must not eat a sentence a person wrote.
    const base = baseWith({ merge: { soureCodePorts: ['functionScript'] }, comment: WHY });
    const nodes = nodesOf(buildCandidate(REQUEST, payload([{ id: 'n1', type: 'Function' }]), undefined, base));

    expect(nodes[0].metadata).toEqual({ merge: { soureCodePorts: ['functionScript'] }, comment: WHY });
  });

  it('clears the comment on an empty string, and only the comment', () => {
    const base = baseWith({ merge: { soureCodePorts: ['functionScript'] }, comment: WHY });
    const nodes = nodesOf(
      buildCandidate(REQUEST, payload([{ id: 'n1', type: 'Function', comment: '   ' }]), undefined, base)
    );

    expect(nodes[0].metadata).toEqual({ merge: { soureCodePorts: ['functionScript'] } });
  });

  it('leaves no empty metadata object behind when the comment was all there was', () => {
    // A `"metadata": {}` where there was no key before is a diff on every save
    // for no content — F46, and the same rule `stripCodeHistoryMetadata` follows.
    const base = baseWith({ comment: WHY });
    const nodes = nodesOf(
      buildCandidate(REQUEST, payload([{ id: 'n1', type: 'Function', comment: '' }]), undefined, base)
    );

    expect('metadata' in nodes[0]).toBe(false);
  });

  it('does not touch the base component it was handed', () => {
    const base = baseWith({ merge: { soureCodePorts: ['functionScript'] } });
    buildCandidate(REQUEST, payload([{ id: 'n1', type: 'Function', comment: WHY }]), undefined, base);

    expect(base.nodes.nodes[0].metadata).toEqual({ merge: { soureCodePorts: ['functionScript'] } });
  });

  it('adds nothing at all to a node with no comment', () => {
    const nodes = nodesOf(buildCandidate(REQUEST, payload([{ id: 'n1', type: 'Group', label: 'Root' }])));

    expect(nodes[0]).toEqual({ id: 'n1', type: 'Group', label: 'Root' });
  });
});

describe('LEG-001 — the mapping, both directions', () => {
  it('folds a flat comment in and leaves every other key alone', () => {
    const node = { id: 'n1', type: 'Function', comment: WHY, metadata: { merge: { soureCodePorts: ['x'] } } };
    expect(foldNodeComment(node)).toEqual({
      id: 'n1',
      type: 'Function',
      metadata: { merge: { soureCodePorts: ['x'] }, comment: WHY }
    });
  });

  it('returns the same object when there is no comment key — no allocation, no diff', () => {
    const node = { id: 'n1', type: 'Group' };
    expect(foldNodeComment(node)).toBe(node);
    expect(unfoldNodeComment(node)).toBe(node);
  });

  it('never mutates what it was given', () => {
    // fc36d61a is why the bag is safe to write into at all: a shared reference
    // here would edit the caller's node, and the caller may be a base component.
    const metadata = { merge: { soureCodePorts: ['x'] } };
    const node = { id: 'n1', type: 'Function', comment: WHY, metadata };
    foldNodeComment(node);

    expect(node.metadata).toBe(metadata);
    expect(metadata).toEqual({ merge: { soureCodePorts: ['x'] } });
    expect(node.comment).toBe(WHY);
  });

  it('unfolds a stored comment out of the bag it hands back', () => {
    const stored = { id: 'n1', type: 'Function', metadata: { merge: { soureCodePorts: ['x'] }, comment: WHY } };
    expect(unfoldNodeComment(stored)).toEqual({
      id: 'n1',
      type: 'Function',
      comment: WHY,
      metadata: { merge: { soureCodePorts: ['x'] } }
    });
  });

  it('drops the bag entirely when the comment was its only key', () => {
    const stored = { id: 'n1', type: 'Function', metadata: { comment: WHY } };
    const out = unfoldNodeComment(stored);
    expect(out).toEqual({ id: 'n1', type: 'Function', comment: WHY });
    expect('metadata' in out).toBe(false);
  });

  it('is a fixed point: read, hand back unchanged, write', () => {
    // The round trip an external agent actually performs. Anything but equality
    // here is a graph that changes because it was looked at.
    const stored = { id: 'n1', type: 'Function', metadata: { merge: { soureCodePorts: ['x'] }, comment: WHY } };
    expect(foldNodeComment(unfoldNodeComment(stored))).toEqual(stored);
  });

  it('clears through metadataWithComment without disturbing the rest', () => {
    expect(metadataWithComment({ merge: { a: 1 }, comment: WHY }, '')).toEqual({ merge: { a: 1 } });
    expect(metadataWithComment({ comment: WHY }, '')).toBeUndefined();
    expect(metadataWithComment(undefined, `  ${WHY}  `)).toEqual({ comment: WHY });
  });
});

describe('LEG-001 — the code-history strip is unaffected', () => {
  it('keeps the comment and removes only the codeHistory_ keys', () => {
    // CED-001's strip runs on every `NodeGraphNode.fromJSON`, so a comment that
    // did not survive it would vanish on the first load after it was written.
    const bag = {
      comment: WHY,
      merge: { soureCodePorts: ['functionScript'] },
      codeHistory_functionScript: ['v1', 'v2']
    };

    expect(stripCodeHistoryMetadata(bag)).toEqual({ comment: WHY, merge: { soureCodePorts: ['functionScript'] } });
  });

  it('leaves a bag that is only a comment untouched, allocating nothing', () => {
    const bag = { comment: WHY };
    expect(stripCodeHistoryMetadata(bag)).toBe(bag);
  });
});

describe('LEG-001 — the comment survives the file round trip', () => {
  // v2 → legacy → v2, which is the half of save → load → save that runs without
  // a renderer. `ComponentModel` and `NodeGraphNode` sit in the middle of the
  // full sequence and need Electron; what they do to `metadata` is CAN-004's and
  // fc36d61a's, and LEG-007's Jasmine spec covers the paste path.
  const LEGACY_NAME = '/Components/Probe';
  const COMPONENT_PATH = 'Components/Probe';
  const METADATA = { merge: { soureCodePorts: ['functionScript'] }, comment: WHY };

  function nodesFile(): NodesV2File {
    return {
      $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
      componentId: 'c1',
      version: 1,
      nodes: [
        { id: 'root', type: 'Group', children: ['fn'] },
        { id: 'fn', type: 'Function', parent: 'root', metadata: JSON.parse(JSON.stringify(METADATA)) }
      ],
      visualRoots: ['root']
    };
  }

  function importInput(): ImportInput {
    return {
      project: {
        $schema: 'https://opennoodl.dev/schemas/project-v2.json',
        name: 'LEG-001 probe project',
        id: 'leg001-project',
        version: '4',
        nodegxVersion: '1.1.0',
        structure: { componentsDir: 'components', assetsDir: 'assets' }
      } as ProjectV2File,
      registry: {
        $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
        version: 1,
        components: {
          [COMPONENT_PATH]: { path: COMPONENT_PATH, type: 'visual', nodeCount: 2, connectionCount: 0 }
        }
      } as RegistryV2File,
      components: {
        [COMPONENT_PATH]: {
          component: {
            $schema: 'https://opennoodl.dev/schemas/component-v2.json',
            id: 'c1',
            name: 'Probe',
            path: LEGACY_NAME,
            type: 'visual',
            created: '2026-08-01T00:00:00.000Z',
            modified: '2026-08-01T00:00:00.000Z'
          },
          nodes: nodesFile(),
          connections: {
            $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
            componentId: 'c1',
            version: 1,
            connections: []
          }
        }
      }
    };
  }

  it('imports the bag onto the legacy node and exports it back unchanged', () => {
    const legacy = new ProjectImporter().import(importInput()).project;
    const component = legacy.components!.find((c) => c.name === LEGACY_NAME)!;
    const fn = component.graph.roots[0].children![0] as { id: string; metadata?: unknown };
    expect(fn.metadata).toEqual(METADATA);

    const exported = new ProjectExporter().export(legacy);
    const file = exported.files.find(
      (f) => f.relativePath === `components/${legacyNameToPath(LEGACY_NAME)}/nodes.json`
    );
    const written = (file!.content as NodesV2File).nodes.find((n) => n.id === 'fn')!;
    expect(written.metadata).toEqual(METADATA);
  });
});

describe('LEG-001 — the reading side is CAN-004s, and nothing had to change there', () => {
  it('reads the key this task writes', () => {
    // A source read, deliberately. `NodeGraphNode` cannot be imported here (it
    // pulls NodeLibrary, ComponentModel and the undo queue, none of which exist
    // outside the renderer), and the one fact that must hold across that
    // boundary is that both halves name the same key. Two files agreeing by
    // luck is how a comment gets written where the tooltip does not look.
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/editor/src/models/nodegraphmodel/NodeGraphNode.ts'),
      'utf8'
    );
    expect(source).toContain('getComment(): string | undefined {\n    return this.metadata?.comment;');
  });
});
