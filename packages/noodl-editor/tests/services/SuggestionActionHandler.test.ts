/**
 * PLAT-005: specs for accepting a style suggestion.
 *
 * These cover the bug this task was really about: `applyVariantAction` claimed
 * in its doc comment to save a node's overrides as a named variant, and in fact
 * only wrote `_variant` — a marker parameter belonging to the compile-time
 * ElementConfigRegistry — so no variant was ever created and nothing survived a
 * restart. There were no specs on this file at all before now.
 */

import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';
import {
  executeSuggestionAction,
  uniqueVariantName
} from '../../src/editor/src/services/StyleAnalyzer/SuggestionActionHandler';
import type { StyleSuggestion } from '../../src/editor/src/services/StyleAnalyzer/types';

// ─── Fakes ────────────────────────────────────────────────────────────────────

/** Stands in for a VariantModel — only name/typename matter to the handler. */
type FakeVariant = { name: string; typename: string; parameters: Record<string, unknown> };

/**
 * Stands in for NodeGraphNode. `createNewVariant` reproduces the real
 * semantics: copy the node's parameters onto a new variant, register it on the
 * project, then CLEAR them from the node so the node inherits from the variant.
 */
function makeFakeNode(id: string, typename: string, parameters: Record<string, unknown>, project: FakeProject) {
  return {
    id,
    typename,
    parameters,
    variantName: undefined as string | undefined,
    type: { localName: typename, name: typename },

    getParameter(name: string) {
      return this.parameters[name];
    },
    setParameter(name: string, value: unknown, args?: { undo?: { push(a: unknown): void } }) {
      const oldValue = this.parameters[name];
      this.parameters[name] = value;
      if (args?.undo && typeof args.undo === 'object') {
        args.undo.push({
          do: () => {
            this.parameters[name] = value;
          },
          undo: () => {
            this.parameters[name] = oldValue;
          }
        });
      }
    },
    createNewVariant(variantName: string, args?: { undo?: boolean }) {
      if (project.variants.some((v) => v.name === variantName && v.typename === typename)) return;

      const variant: FakeVariant = { name: variantName, typename, parameters: { ...this.parameters } };
      const oldParameters = this.parameters;

      project.variants.push(variant);
      this.variantName = variantName;
      this.parameters = {};

      if (args?.undo) {
        UndoQueue.instance.push({
          label: 'Create new variant',
          do: () => {
            project.variants.push(variant);
            this.variantName = variantName;
            this.parameters = {};
          },
          undo: () => {
            project.variants = project.variants.filter((v) => v !== variant);
            this.variantName = undefined;
            this.parameters = oldParameters;
          }
        } as never);
      }
    }
  };
}

type FakeNode = ReturnType<typeof makeFakeNode>;

class FakeProject {
  nodes: FakeNode[] = [];
  variants: FakeVariant[] = [];

  findNodeWithId(id: string) {
    return this.nodes.find((n) => n.id === id);
  }
  findVariant(name: string, nodetype: { localName: string }) {
    return this.variants.find((v) => v.name === name && v.typename === nodetype.localName);
  }
  findVariantsForNodeType(nodetype: { localName: string }) {
    return this.variants.filter((v) => v.typename === nodetype.localName);
  }
}

function makeFakeTokenModel() {
  const tokens = new Map<string, { name: string; value: string }>();
  return {
    tokens,
    getToken: (name: string) => tokens.get(name),
    setToken: (name: string, value: string) => {
      tokens.set(name, { name, value });
    },
    deleteCustomToken: (name: string) => {
      tokens.delete(name);
    }
  };
}

function variantSuggestion(nodeId: string, nodeType: string, suggestedVariantName: string): StyleSuggestion {
  return {
    id: `variant-candidate:${nodeId}`,
    type: 'variant-candidate',
    message: 'x',
    acceptLabel: 'Save as Variant',
    variantCandidate: {
      nodeId,
      nodeLabel: 'Sign up',
      nodeType,
      overrideCount: 3,
      overrides: { backgroundColor: '#22c55e', color: '#ffffff', borderRadius: '9999px' },
      suggestedVariantName
    }
  };
}

// ─── uniqueVariantName ────────────────────────────────────────────────────────

describe('PLAT-005 uniqueVariantName', () => {
  it('returns the base name when it is free', () => {
    expect(uniqueVariantName([], 'button-custom')).toBe('button-custom');
  });

  it('suffixes when taken — createNewVariant returns silently on a clash', () => {
    expect(uniqueVariantName(['button-custom'], 'button-custom')).toBe('button-custom-2');
  });

  it('keeps counting past an existing suffix', () => {
    expect(uniqueVariantName(['button-custom', 'button-custom-2'], 'button-custom')).toBe('button-custom-3');
  });
});

// ─── applyVariantAction ───────────────────────────────────────────────────────

describe('PLAT-005 executeSuggestionAction — variant-candidate', () => {
  let project: FakeProject;

  beforeEach(() => {
    UndoQueue.instance.clear();
    project = new FakeProject();
    spyOnProperty(ProjectModel, 'instance', 'get').and.returnValue(project as never);
  });

  afterEach(() => UndoQueue.instance.clear());

  function addButton(id = 'btn-1') {
    const node = makeFakeNode(
      id,
      'net.noodl.controls.button',
      { backgroundColor: '#22c55e', color: '#ffffff', borderRadius: '9999px' },
      project
    );
    project.nodes.push(node);
    return node;
  }

  it('ACTUALLY creates a persisted variant — the bug this task exists for', () => {
    const node = addButton();
    const applied = executeSuggestionAction(variantSuggestion('btn-1', node.typename, 'button-custom'), {
      tokenModel: makeFakeTokenModel() as never
    });

    expect(applied).toBe(true);
    expect(project.variants.length).toBe(1);
    expect(project.variants[0].name).toBe('button-custom');
    expect(project.variants[0].typename).toBe('net.noodl.controls.button');
  });

  it('moves the overrides onto the variant and clears them from the node', () => {
    const node = addButton();
    executeSuggestionAction(variantSuggestion('btn-1', node.typename, 'button-custom'), {
      tokenModel: makeFakeTokenModel() as never
    });

    expect(project.variants[0].parameters.backgroundColor).toBe('#22c55e');
    expect(node.parameters.backgroundColor).toBeUndefined();
    expect(node.variantName).toBe('button-custom');
  });

  it('no longer writes the ElementConfigRegistry _variant marker', () => {
    // The old implementation's ONLY effect. `_variant` is read by
    // propertyeditor.renderElementStyleSection against a hardcoded, non-
    // persisted registry, so writing a name into it produced a picker showing
    // an option that did not exist.
    const node = addButton();
    executeSuggestionAction(variantSuggestion('btn-1', node.typename, 'button-custom'), {
      tokenModel: makeFakeTokenModel() as never
    });
    expect(node.parameters._variant).toBeUndefined();
  });

  it('is undoable in a single step', () => {
    const node = addButton();
    executeSuggestionAction(variantSuggestion('btn-1', node.typename, 'button-custom'), {
      tokenModel: makeFakeTokenModel() as never
    });
    expect(project.variants.length).toBe(1);

    UndoQueue.instance.undo();

    expect(project.variants.length).toBe(0);
    expect(node.parameters.backgroundColor).toBe('#22c55e');
    expect(node.variantName).toBeUndefined();
  });

  it('uniquifies rather than silently no-opping on a second, identically-named candidate', () => {
    const a = addButton('btn-1');
    const b = addButton('btn-2');

    executeSuggestionAction(variantSuggestion('btn-1', a.typename, 'button-custom'), {
      tokenModel: makeFakeTokenModel() as never
    });
    const second = executeSuggestionAction(variantSuggestion('btn-2', b.typename, 'button-custom'), {
      tokenModel: makeFakeTokenModel() as never
    });

    expect(second).toBe(true);
    expect(project.variants.map((v) => v.name)).toEqual(['button-custom', 'button-custom-2']);
  });

  it('reports failure when the node is gone rather than claiming success', () => {
    const applied = executeSuggestionAction(variantSuggestion('missing', 'Group', 'group-custom'), {
      tokenModel: makeFakeTokenModel() as never
    });
    expect(applied).toBe(false);
  });

  it('reports failure when the node cannot hold a variant', () => {
    // e.g. a node not attached to any project — createNewVariant bails silently.
    project.nodes.push({ id: 'plain', typename: 'Group', parameters: {} } as never);
    const applied = executeSuggestionAction(variantSuggestion('plain', 'Group', 'group-custom'), {
      tokenModel: makeFakeTokenModel() as never
    });
    expect(applied).toBe(false);
  });
});

// ─── applyTokenAction ─────────────────────────────────────────────────────────

describe('PLAT-005 executeSuggestionAction — repeated-color', () => {
  let project: FakeProject;

  beforeEach(() => {
    UndoQueue.instance.clear();
    project = new FakeProject();
    spyOnProperty(ProjectModel, 'instance', 'get').and.returnValue(project as never);
  });

  afterEach(() => UndoQueue.instance.clear());

  function colorSuggestion(): StyleSuggestion {
    return {
      id: 'repeated-color:#3b82f6',
      type: 'repeated-color',
      message: 'x',
      acceptLabel: 'Create Token',
      repeatedValue: {
        value: '#3b82f6',
        count: 3,
        occurrences: 3,
        suggestedTokenName: '--color-3b82f6',
        elements: ['n1', 'n2', 'n3'].map((nodeId) => ({
          nodeId,
          nodeLabel: 'Group',
          property: 'backgroundColor',
          value: '#3b82f6'
        }))
      }
    };
  }

  function seedNodes() {
    for (const id of ['n1', 'n2', 'n3']) {
      project.nodes.push(makeFakeNode(id, 'Group', { backgroundColor: '#3b82f6' }, project));
    }
  }

  it('creates the token and rewrites every occurrence', () => {
    seedNodes();
    const tokenModel = makeFakeTokenModel();

    const applied = executeSuggestionAction(colorSuggestion(), { tokenModel: tokenModel as never });

    expect(applied).toBe(true);
    expect(tokenModel.tokens.get('--color-3b82f6')?.value).toBe('#3b82f6');
    expect(project.nodes.map((n) => n.parameters.backgroundColor)).toEqual([
      'var(--color-3b82f6)',
      'var(--color-3b82f6)',
      'var(--color-3b82f6)'
    ]);
  });

  it('ONE undo reverses the token and all of the rewrites together', () => {
    // Neither half was undoable before PLAT-005: setToken was called without
    // { undo: true } and setParameter without any args at all.
    seedNodes();
    const tokenModel = makeFakeTokenModel();
    executeSuggestionAction(colorSuggestion(), { tokenModel: tokenModel as never });

    UndoQueue.instance.undo();

    expect(tokenModel.tokens.has('--color-3b82f6')).toBe(false);
    expect(project.nodes.map((n) => n.parameters.backgroundColor)).toEqual(['#3b82f6', '#3b82f6', '#3b82f6']);
  });

  it('switches to an existing token without creating a duplicate', () => {
    seedNodes();
    const tokenModel = makeFakeTokenModel();
    const suggestion = colorSuggestion();
    suggestion.repeatedValue!.matchingToken = '--brand-primary';

    executeSuggestionAction(suggestion, { tokenModel: tokenModel as never });

    expect(tokenModel.tokens.has('--color-3b82f6')).toBe(false);
    expect(project.nodes[0].parameters.backgroundColor).toBe('var(--brand-primary)');
  });

  it('does not leave an orphan token behind when nothing could be rewritten', () => {
    // Stale suggestion: the analysis ran, then the values changed underneath it.
    for (const id of ['n1', 'n2', 'n3']) {
      project.nodes.push(makeFakeNode(id, 'Group', { backgroundColor: '#ef4444' }, project));
    }
    const tokenModel = makeFakeTokenModel();

    const applied = executeSuggestionAction(colorSuggestion(), { tokenModel: tokenModel as never });

    expect(applied).toBe(false);
    expect(tokenModel.tokens.has('--color-3b82f6')).toBe(false);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });
});
