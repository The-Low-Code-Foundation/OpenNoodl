import { NodeGraphNode, NodeGraphNodeSet } from '@noodl-models/nodegraphmodel';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ProjectModel } from '@noodl-models/projectmodel';

/**
 * LEG-007 — paste already carries labels and comments. This is what notices when it stops.
 *
 * There is no bug here today. `NodeGraphNodeSet.clone()` is a `toJSON`/`fromJSON` round trip
 * (`NodeGraphNodeSet.ts:33`), `toJSON` emits `label: this._label` and `metadata: this.metadata`
 * (`NodeGraphNode.ts:1577`, `:1590`), `fromJSON` restores both (`:165`, `:180`), and the only
 * field deliberately dropped for the clipboard is `dynamicports` in `strip()`. Reminting runs
 * *after* the round trip and touches only `node.id` and the connection endpoint map.
 *
 * The exposure is that nothing asserted it. `clone()` inherits every future change to either half
 * of that round trip, and LEG-001 is about to put a new key — `metadata.comment` — into the bag
 * that `stripCodeHistoryMetadata` already filters on the way in. The day someone adds a second
 * strip beside it, or narrows `toJSON` to an allowlist, paste starts producing anonymous copies
 * and no gate says a word. This file is that gate.
 *
 * Three paths carry a node from one place to another, and all three are covered below:
 *
 *  1. `clone()` — the in-memory duplicate, used by both halves of copy/paste.
 *  2. The OS clipboard — `EditorClipboard.copySelected()` writes `JSON.stringify(toJSON())` and
 *     `getNodeSetFromClipboard()` reads it back through `NodeGraphNodeSet.fromJSON`
 *     (`EditorClipboard.ts:59-61`, `:149`, `:169` at commit 80868946). This is the *same* path
 *     for a paste into another component and a paste into another project: the only channel is
 *     a JSON string, and `clipboard.writeText`/`readText` cannot lose a field a string carries.
 *     The steps are replayed here verbatim, minus the electron call itself.
 *  3. Duplicate component — `ProjectModel.duplicateComponent()` re-parses the whole graph
 *     (`projectmodel.ts:337`) and then `rekeyAllIds()`.
 *
 * `metadata.comment` is the node note this phase is about. It is *not* the canvas comment region
 * in `commentsmodel.ts`, which travels as `NodeGraphNodeSet.comments` and is a different thing.
 */
describe('LEG-007 — a pasted node keeps its label and its comment', () => {
  beforeAll(() => {
    // The same test library the rest of tests/nodegraph runs against. It is needed for the
    // source-code-port case below: `image` declares a `css` port with `codeeditor: 'css'`.
    (window as TSFixme).NodeLibraryData = require('./nodelibrary');
    NodeLibrary.instance.loadLibrary();
  });

  /**
   * Two labelled, commented groups nested two deep, plus an unlabelled node carrying a
   * source-code parameter and a legacy code-history key. The one connection runs from the
   * *deepest* child, because id reminting walks children through `forEach` and a parent-only
   * fixture passes with the recursion broken.
   */
  function graphJSON() {
    return {
      roots: [
        {
          id: 'shell',
          type: 'group',
          x: 0,
          y: 0,
          label: 'Card shell',
          metadata: { comment: 'The whole card. One row per piece.' },
          children: [
            {
              id: 'body',
              type: 'group',
              x: 10,
              y: 10,
              label: 'Body',
              metadata: { comment: 'Nested one deep.' },
              children: [
                {
                  id: 'count',
                  type: 'image',
                  x: 20,
                  y: 20,
                  label: 'Piece count',
                  metadata: { comment: 'Nested two deep. If the recursion breaks, this is what goes quiet.' }
                }
              ]
            }
          ]
        },
        {
          // No label and no comment: the control. A clone must not invent either.
          id: 'styled',
          type: 'image',
          x: 100,
          y: 0,
          parameters: { css: '.a { color: red; }' },
          metadata: {
            merge: { soureCodePorts: ['css'] },
            // CED-001 (B2): the legacy key `fromJSON` strips on the way in, on purpose.
            codeHistory_css: [{ code: '.a { color: blue; }' }]
          }
        }
      ],
      connections: [{ fromId: 'count', fromProperty: 'screenX', toId: 'styled', toProperty: 'x' }]
    };
  }

  function sourceSet(): NodeGraphNodeSet {
    const json = graphJSON();
    return new NodeGraphNodeSet({
      nodes: json.roots.map((root) => NodeGraphNode.fromJSON(root as TSFixme)),
      connections: json.connections
    });
  }

  /** Every node in the set, roots and children alike, in depth-first order. */
  function allNodes(set: NodeGraphNodeSet): NodeGraphNode[] {
    const out: NodeGraphNode[] = [];
    set.nodes.forEach((root) => root.forEach((node) => void out.push(node)));
    return out;
  }

  /**
   * Copy → paste, exactly as `EditorClipboard` does it, with `clipboard.writeText` /
   * `clipboard.readText` collapsed into the string they hand each other. This is the
   * cross-component and cross-project path.
   */
  function throughTheClipboard(set: NodeGraphNodeSet): NodeGraphNodeSet {
    const copied = set.clone(); // EditorClipboard.ts:59
    copied.strip(); // :60 — drops `dynamicports`, and nothing else
    const onTheClipboard = JSON.stringify(copied.toJSON()); // :61
    const read = NodeGraphNodeSet.fromJSON(JSON.parse(onTheClipboard)); // :149
    return read.clone(); // :169, inside insertNodeSet
  }

  describe('clone() — the in-memory duplicate behind copy, paste and node-set insert', () => {
    it('carries every label, including on a child two levels down', () => {
      const clones = allNodes(sourceSet().clone());

      expect(clones.map((n) => n.toJSON().label)).toEqual([
        'Card shell',
        'Body',
        'Piece count',
        undefined // the unlabelled control stays unlabelled
      ]);
    });

    it('carries every comment, including on a child two levels down', () => {
      const clones = allNodes(sourceSet().clone());

      expect(clones.map((n) => n.metadata && n.metadata.comment)).toEqual([
        'The whole card. One row per piece.',
        'Nested one deep.',
        'Nested two deep. If the recursion breaks, this is what goes quiet.',
        undefined // the uncommented control gains no comment
      ]);
    });

    it('remints every id, collides with no original, and repoints the connection at the clones', () => {
      const source = sourceSet();
      const originalIds = allNodes(source).map((n) => n.id);
      const clone = source.clone();
      const clones = allNodes(clone);

      expect(originalIds).toEqual(['shell', 'body', 'count', 'styled']);
      expect(clones.length).toBe(4);

      for (const node of clones) {
        expect(typeof node.id).toBe('string');
        expect(originalIds.indexOf(node.id)).toBe(-1);
      }
      expect(new Set(clones.map((n) => n.id)).size).toBe(4);

      // The endpoint is the grandchild, so this fails if reminting stops recursing.
      const clonedCount = clones.find((n) => n.toJSON().label === 'Piece count');
      const clonedStyled = clones.find((n) => n.toJSON().label === undefined);

      expect(clone.connections.length).toBe(1);
      expect(clone.connections[0].fromId).toBe(clonedCount.id);
      expect(clone.connections[0].toId).toBe(clonedStyled.id);
      expect(clone.connections[0].fromProperty).toBe('screenX');
      expect(clone.connections[0].toProperty).toBe('x');

      // The source is untouched — a clone that renamed its original would be worse than one
      // that lost a label.
      expect(allNodes(source).map((n) => n.id)).toEqual(originalIds);
    });

    it('carries metadata.merge and drops code history', () => {
      const styled = allNodes(sourceSet().clone())[3];

      expect(styled.metadata.merge.soureCodePorts).toEqual(['css']);
      // Deliberate, `NodeGraphNode.fromJSON:180`. Pinned so that "restoring" it is a red test
      // rather than twenty code blobs per node coming back into project.json.
      expect(styled.metadata.codeHistory_css).toBeUndefined();
    });

    it('derives metadata.merge for a source-code port that had none recorded', () => {
      // `toJSON` recomputes `merge.soureCodePorts` from the node's parameters via
      // `isSourceCodePort`, which needs the port to declare `codeeditor` — `image.css` does.
      // ⚠️ `isSourceCodePort` memoises on `typename-parameterName` in a module-level Map, so a
      // future spec that resolves `image-css` against a *different* node library before this one
      // runs would poison it. If this goes red on its own, look there first.
      const node = NodeGraphNode.fromJSON({
        id: 'bare',
        type: 'image',
        x: 0,
        y: 0,
        parameters: { css: '.b {}' }
      } as TSFixme);

      const clone = new NodeGraphNodeSet({ nodes: [node], connections: [] }).clone().nodes[0];

      expect(clone.metadata.merge.soureCodePorts).toEqual(['css']);
    });

    it('shares the metadata object with its source — a defect, recorded, not endorsed', () => {
      // `toJSON` emits `metadata: this.metadata` by reference (`:1590`) and
      // `stripCodeHistoryMetadata` returns its argument untouched when there is nothing to strip,
      // so a clone of a node whose metadata is clean holds the *same object*. Editing the copy's
      // comment therefore rewrites the original's — reachable through the in-memory clipboard
      // fallback (`EditorClipboard.paste()` when the OS clipboard holds unparseable text) and
      // through any direct `insertNodeSet` caller such as the AI assistant.
      //
      // Every other field is deep-copied; `metadata` is the exception. The fix is one line in
      // `NodeGraphNodeSet.clone()` — round-trip the JSON the way `duplicateComponent` already
      // does — and when it lands, this expectation flips to `not.toBe` plus an independence
      // assertion. It is pinned rather than fixed here because LEG-007's remit is a regression
      // spec, not a change to the paste path. See LEG-007 register L23.
      const source = sourceSet();
      const clone = source.clone();

      expect(clone.nodes[0].metadata).toBe(source.nodes[0].metadata);
    });
  });

  describe('the OS clipboard — copy in one component, paste in another, or in another project', () => {
    it('carries every label and comment across the JSON boundary', () => {
      const pasted = allNodes(throughTheClipboard(sourceSet()));

      expect(pasted.map((n) => n.toJSON().label)).toEqual(['Card shell', 'Body', 'Piece count', undefined]);
      expect(pasted.map((n) => n.metadata && n.metadata.comment)).toEqual([
        'The whole card. One row per piece.',
        'Nested one deep.',
        'Nested two deep. If the recursion breaks, this is what goes quiet.',
        undefined
      ]);
    });

    it('remints ids across the boundary and keeps the connection between the pasted nodes', () => {
      const source = sourceSet();
      const originalIds = allNodes(source).map((n) => n.id);
      const pastedSet = throughTheClipboard(source);
      const pasted = allNodes(pastedSet);

      for (const node of pasted) {
        expect(originalIds.indexOf(node.id)).toBe(-1);
      }

      const pastedIds = pasted.map((n) => n.id);
      expect(pastedIds.indexOf(pastedSet.connections[0].fromId)).not.toBe(-1);
      expect(pastedIds.indexOf(pastedSet.connections[0].toId)).not.toBe(-1);
    });

    it('drops only dynamicports on the way out', () => {
      // `strip()` is the one place the clipboard is allowed to lose a field. If a second
      // `delete` ever appears beside it, the assertions above say which field it cost.
      const source = sourceSet();
      source.nodes[0].dynamicports = [{ name: 'somethingDynamic', plug: 'input' }] as TSFixme;

      const copied = source.clone();
      copied.strip();
      const json = copied.toJSON();

      expect(json.nodes[0].dynamicports).toBeUndefined();
      expect(json.nodes[0].label).toBe('Card shell');
      expect(json.nodes[0].metadata.comment).toBe('The whole card. One row per piece.');
    });
  });

  describe('duplicate component', () => {
    let previousInstance: ProjectModel;

    beforeEach(() => {
      previousInstance = ProjectModel.instance;
    });

    afterEach(() => {
      ProjectModel.instance = previousInstance;
    });

    it('carries every label and comment into the duplicate, with fresh ids', () => {
      const project = ProjectModel.fromJSON({
        components: [{ name: 'Card', graph: graphJSON() }]
      });
      ProjectModel.instance = project;

      project.duplicateComponent(project.getComponentWithName('Card'), 'Card copy', {});

      const copy = project.getComponentWithName('Card copy');
      expect(copy).not.toBe(undefined);

      const nodes: NodeGraphNode[] = [];
      copy.graph.roots.forEach((root: NodeGraphNode) => root.forEach((node) => void nodes.push(node)));

      expect(nodes.map((n) => n.toJSON().label)).toEqual(['Card shell', 'Body', 'Piece count', undefined]);
      expect(nodes.map((n) => n.metadata && n.metadata.comment)).toEqual([
        'The whole card. One row per piece.',
        'Nested one deep.',
        'Nested two deep. If the recursion breaks, this is what goes quiet.',
        undefined
      ]);

      // `rekeyAllIds` runs over the duplicate only.
      for (const node of nodes) {
        expect(['shell', 'body', 'count', 'styled'].indexOf(node.id)).toBe(-1);
      }

      const original = project.getComponentWithName('Card');
      expect(original.graph.roots[0].id).toBe('shell');
      expect(original.graph.roots[0].metadata.comment).toBe('The whole card. One row per piece.');
    });

    it('gives the duplicate its own metadata objects', () => {
      // Unlike `clone()`, `duplicateComponent` re-parses the graph through
      // `JSON.parse(JSON.stringify(...))` (`projectmodel.ts:337`), so commenting the duplicate
      // does not write through to the original. This is the behaviour `clone()` should have.
      const project = ProjectModel.fromJSON({
        components: [{ name: 'Card', graph: graphJSON() }]
      });
      ProjectModel.instance = project;

      project.duplicateComponent(project.getComponentWithName('Card'), 'Card copy', {});

      const original = project.getComponentWithName('Card').graph.roots[0];
      const copy = project.getComponentWithName('Card copy').graph.roots[0];

      expect(copy.metadata).not.toBe(original.metadata);

      copy.setComment('Rewritten on the duplicate');
      expect(copy.metadata.comment).toBe('Rewritten on the duplicate');
      expect(original.metadata.comment).toBe('The whole card. One row per piece.');
    });
  });
});
