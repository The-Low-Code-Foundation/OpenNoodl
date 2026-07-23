/**
 * SUB-006 — v2 directory loader
 *
 * Proves the on-disk loader normalises a v2 decomposed project (flat nodes with
 * parent/children ids, per-component connections, registry-driven component
 * discovery) into the same model the rules run over — and that a clean v2
 * project validates clean, with component references resolving across files.
 */

import * as path from 'path';

import { loadProject, loadV2Directory } from '../../src/editor/src/validation/loadV2Project';
import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';

const V2_CLEAN = path.join(__dirname, 'fixtures', 'v2-clean');

describe('SUB-006 v2 directory loader', () => {
  it('loads a v2 directory into the normalized model', () => {
    const project = loadV2Directory(V2_CLEAN);
    const names = project.components.map((c) => c.name).sort();
    expect(names).toEqual(['/#App', '/#Card']);

    const app = project.components.find((c) => c.name === '/#App')!;
    // Flat nodes with parent/children ids preserved.
    expect(app.nodes.length).toBe(3);
    const root = app.nodes.find((n) => n.id === 'app_root')!;
    expect(root.children).toContain('app_text');
    expect(app.nodes.find((n) => n.id === 'app_text')!.parent).toBe('app_root');
  });

  it('detects the format via loadProject and resolves cross-file component refs', () => {
    const project = loadProject(V2_CLEAN);
    // The App/#Card instance must resolve against the Card component.
    expect(project.componentRefs.has('/#Card')).toBe(true);
    expect(project.componentRefs.has('Card')).toBe(true);
  });

  it('validates the clean v2 fixture with zero diagnostics', () => {
    const report = new SemanticValidator().validate(loadV2Directory(V2_CLEAN));
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.nodesChecked).toBe(5);
  });
});
