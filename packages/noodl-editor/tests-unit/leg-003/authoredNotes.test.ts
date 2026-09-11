/**
 * LEG-003 §2 — the Explain panel's authored half.
 *
 * Two fields in a project are written by a person: a component's `description`
 * and a node's `metadata.comment`. This file covers the whole path they travel
 * — adapter → assembly → the text the model reads → the notes the panel renders
 * — and the one rule that matters more than any of it: **nothing shortens,
 * rewrites or paraphrases them**.
 *
 * The panel component itself is not rendered here (no React in this runner);
 * `collectAuthoredNotes` is the seam it renders, and it is pure on purpose.
 */

// Imported per module, not through `explain/index.ts`: the barrel re-exports
// `ExplainSession`, which reaches `AiClient` and the editor's settings store,
// and this runner deliberately has neither.
import { assembleContext } from '../../src/editor/src/models/AiAssistant/explain/assemble';
import {
  collectAuthoredNotes,
  MAX_COMPONENT_SCOPE_NOTES
} from '../../src/editor/src/models/AiAssistant/explain/authoredNotes';
import type { NoteNodeLike } from '../../src/editor/src/models/AiAssistant/explain/authoredNotes';
import { fromComponentModel, fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { systemPrompt } from '../../src/editor/src/models/AiAssistant/explain/prompts';
import { renderContext } from '../../src/editor/src/models/AiAssistant/explain/render';
import type { ExplainGraph } from '../../src/editor/src/models/AiAssistant/explain/types';

/** The node shape a serialised `project.json` carries. */
interface FixtureNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  children?: FixtureNode[];
  metadata?: Record<string, unknown>;
}

const DESCRIPTION =
  'The checkout page. Totals are computed server-side because the discount rules changed twice in 2024 and we stopped trusting the client.';

const COMMENT =
  'Retry twice, not three times.\nThe payment provider treats a third attempt inside 60s as fraud (ticket PSP-4412).';

/** A serialised project of the shape `ProjectModel.toJSON()` produces. */
function project(options: { description?: string; comment?: string; extraComments?: number } = {}): ExplainGraph {
  const roots: FixtureNode[] = [
    {
      id: 'grp-page',
      type: 'Group',
      label: 'Checkout page',
      parameters: { flexDirection: 'column' },
      children: [
        {
          id: 'btn-submit',
          type: 'net.noodl.controls.button',
          label: 'Submit Order',
          parameters: { label: 'Submit order' },
          ...(options.comment ? { metadata: { comment: options.comment } } : {})
        },
        { id: 'txt-total', type: 'Text', label: 'Order total', parameters: { text: 'Total: £0.00' } }
      ]
    },
    { id: 'nav-confirm', type: 'RouterNavigate', label: 'Checkout', parameters: { target: '/Pages/Confirmation' } }
  ];

  for (let i = 0; i < (options.extraComments ?? 0); i++) {
    roots.push({
      id: `extra-${i}`,
      type: 'Text',
      label: `Filler ${i}`,
      parameters: {},
      metadata: { comment: `note ${i}` }
    });
  }

  return fromSerialisedProject({
    components: [
      {
        name: '/Pages/Checkout',
        ...(options.description ? { description: options.description } : {}),
        graph: {
          roots,
          connections: [{ fromId: 'btn-submit', fromProperty: 'onClick', toId: 'nav-confirm', toProperty: 'navigate' }]
        }
      }
    ]
  });
}

describe('LEG-003 §2 — a component description reaches the explanation', () => {
  it('carries the description from a serialised project into the assembled context', () => {
    const context = assembleContext(project({ description: DESCRIPTION }), {
      scope: 'component',
      componentName: '/Pages/Checkout'
    });

    expect(context.component.description).toBe(DESCRIPTION);
  });

  it('puts it in the text the model reads, attributed to the author', () => {
    const context = assembleContext(project({ description: DESCRIPTION }), {
      scope: 'component',
      componentName: '/Pages/Checkout'
    });

    expect(renderContext(context)).toContain(`description, written by the author: ${DESCRIPTION}`);
  });

  it('adds no key and no line when nobody wrote one', () => {
    const context = assembleContext(project(), { scope: 'component', componentName: '/Pages/Checkout' });

    expect('description' in context.component).toBe(false);
    expect(renderContext(context)).not.toContain('written by the author');
  });

  it('treats an empty or whitespace description as absent, not as an empty quotation', () => {
    expect(fromComponentModel({ name: 'A', description: '   ' }).description).toBeUndefined();
    expect(fromComponentModel({ name: 'A', description: '' }).description).toBeUndefined();
  });

  it('reads a live component whether the field sits beside metadata or inside it', () => {
    // LEG-006 has not landed, and it may restore `description` either way.
    expect(fromComponentModel({ name: 'A', description: DESCRIPTION }).description).toBe(DESCRIPTION);
    expect(fromComponentModel({ name: 'A', metadata: { description: DESCRIPTION } }).description).toBe(DESCRIPTION);
  });
});

describe('LEG-003 §2 — a node comment reaches the explanation', () => {
  it('is in the context the model reads, marked as the author speaking', () => {
    const context = assembleContext(project({ comment: COMMENT }), {
      scope: 'node',
      componentName: '/Pages/Checkout',
      nodeIds: ['btn-submit']
    });

    const node = context.nodes.find((n) => n.id === 'btn-submit');
    expect(node?.comment).toBe(COMMENT);
    expect(renderContext(context)).toContain('note from the author:');
  });

  it('is offered to the panel verbatim — every character, including the line break', () => {
    const context = assembleContext(project({ comment: COMMENT }), {
      scope: 'node',
      componentName: '/Pages/Checkout',
      nodeIds: ['btn-submit']
    });

    const { notes } = collectAuthoredNotes({
      scope: context.scope,
      component: { name: context.component.name, description: context.component.description },
      selectedIds: context.selectedIds,
      nodes: context.nodes
    });

    expect(notes).toEqual([
      { kind: 'node-comment', text: COMMENT, subject: "Button 'Submit Order'", nodeId: 'btn-submit' }
    ]);
    // The verbatim rule, stated as an assertion rather than as a comment.
    expect(notes[0].text).toBe(COMMENT);
    expect(notes[0].text).toContain('\n');
    expect(notes[0].text.length).toBe(COMMENT.length);
  });

  it('shows the comments of the nodes that were selected, and not a neighbour’s', () => {
    const graph = project({ comment: COMMENT });
    const component = graph.components[0];
    component.nodes.find((n) => n.id === 'nav-confirm')!.comment = 'the navigate node has its own note';

    const { notes } = collectAuthoredNotes({
      scope: 'node',
      component: { name: component.name },
      selectedIds: ['btn-submit'],
      nodes: component.nodes
    });

    expect(notes.map((n) => n.nodeId)).toEqual(['btn-submit']);
  });
});

describe('LEG-003 §2 — which notes lead which scope', () => {
  it('leads a component explanation with the description, then the notes inside it', () => {
    const graph = project({ description: DESCRIPTION, comment: COMMENT });
    const component = graph.components[0];

    const { notes, omitted } = collectAuthoredNotes({
      scope: 'component',
      component: { name: component.name, description: component.description },
      nodes: component.nodes
    });

    expect(notes.map((n) => n.kind)).toEqual(['component-description', 'node-comment']);
    expect(notes[0]).toEqual({ kind: 'component-description', text: DESCRIPTION, subject: '/Pages/Checkout' });
    expect(omitted).toBe(0);
  });

  it('counts the notes a crowded component does not have room for rather than dropping them', () => {
    const graph = project({ comment: COMMENT, extraComments: MAX_COMPONENT_SCOPE_NOTES + 3 });
    const component = graph.components[0];

    const { notes, omitted } = collectAuthoredNotes({
      scope: 'component',
      component: { name: component.name },
      nodes: component.nodes
    });

    expect(notes.length).toBe(MAX_COMPONENT_SCOPE_NOTES);
    expect(omitted).toBe(4);
  });

  it('never caps a node-scope selection — the selection is the question', () => {
    const graph = project({ comment: COMMENT, extraComments: MAX_COMPONENT_SCOPE_NOTES + 3 });
    const component = graph.components[0];
    const ids = component.nodes.filter((n) => n.comment).map((n) => n.id);

    const { notes, omitted } = collectAuthoredNotes({
      scope: 'subgraph',
      component: { name: component.name },
      selectedIds: ids,
      nodes: component.nodes
    });

    expect(notes.length).toBe(ids.length);
    expect(omitted).toBe(0);
  });

  it('returns nothing at all when nobody wrote anything', () => {
    const component = project().components[0];

    expect(
      collectAuthoredNotes({ scope: 'component', component: { name: component.name }, nodes: component.nodes })
    ).toEqual({ notes: [], omitted: 0 });
  });
});

describe('LEG-003 §2 — how a note is attributed', () => {
  const note = (node: Omit<NoteNodeLike, 'id' | 'comment'>) =>
    collectAuthoredNotes({
      scope: 'node',
      component: { name: '/Pages/Checkout' },
      selectedIds: ['n'],
      nodes: [{ id: 'n', comment: 'why', ...node }]
    }).notes[0].subject;

  it('pairs the catalog display name with the label the author gave', () => {
    expect(note({ type: 'net.noodl.controls.button', displayName: 'Button', label: 'Submit Order' })).toBe(
      "Button 'Submit Order'"
    );
  });

  it('does not say Button ‘Button’ when the label is the type name again', () => {
    expect(note({ type: 'net.noodl.controls.button', displayName: 'Button', label: 'Button' })).toBe('Button');
  });

  it('prefers the label to a raw type when the caller has no catalog in hand', () => {
    // The panel's pre-session read has no display names, and
    // `NodeGraphNode.label` always returns something, so the naive pairing
    // would read `net.noodl.controls.button 'Button'`.
    expect(note({ type: 'net.noodl.controls.button', label: 'Submit Order' })).toBe('Submit Order');
    expect(note({ type: 'net.noodl.controls.button' })).toBe('net.noodl.controls.button');
  });
});

describe('LEG-003 §2 — the model is told not to speak over the author', () => {
  it('carries the do-not-paraphrase rule in the system prompt', () => {
    const prompt = systemPrompt();

    expect(prompt).toContain('Do not paraphrase, summarise or restate them');
    expect(prompt).toContain('note from the author');
    expect(prompt).toContain('description, written by the author');
  });
});
