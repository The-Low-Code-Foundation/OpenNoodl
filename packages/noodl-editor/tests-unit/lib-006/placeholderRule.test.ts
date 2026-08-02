/**
 * LIB-006 — the `legacy-import-placeholder` rule.
 *
 * The validator's rule engine is pure (a `CatalogIndex` is built from a plain
 * object), so this runs headlessly alongside the rest of LIB-006 rather than in
 * the Electron jasmine suite.
 */

import { CatalogIndex } from '../../src/editor/src/validation/CatalogIndex';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { fromLegacyProject } from '../../src/editor/src/validation/normalize';
import { ALL_RULES } from '../../src/editor/src/validation/rules';
import {
  LEGACY_IMPORT_METADATA_KEY,
  legacyImportPlaceholder
} from '../../src/editor/src/validation/rules/legacyImportPlaceholder';
import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';
import { LEGACY_IMPORT_METADATA_KEY as ENGINE_KEY } from '../../src/editor/src/utils/import-engine/legacy/types';

// A catalog with one real type, so `hasType` means something.
const catalog = new CatalogIndex({
  catalogFormatVersion: '1.1.0',
  packages: {},
  portTypeNames: [],
  typecasts: [],
  nodes: [
    {
      typeName: 'Group',
      displayName: 'Group',
      category: 'Visual',
      isVisual: true,
      isDeprecated: false,
      inNodePicker: true,
      availableIn: ['browser'],
      providedBy: 'noodl-viewer-react',
      inputs: [],
      outputs: []
    }
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

function projectWith(nodes: unknown[]) {
  return fromLegacyProject({
    components: [{ name: '/App', graph: { roots: nodes as never[], connections: [] } }]
  });
}

const marker = (over: Record<string, unknown> = {}) => ({
  [LEGACY_IMPORT_METADATA_KEY]: {
    findingId: 'node:/App:n1:noodl.byob.QueryData',
    originalType: 'noodl.byob.QueryData',
    reason: 'type-removed',
    importedAt: '2026-08-02T12:00:00.000Z',
    ...over
  }
});

function validate(nodes: unknown[], options = {}) {
  return new SemanticValidator(catalog, ALL_RULES).validate(projectWith(nodes), options);
}

describe('legacy-import-placeholder', () => {
  it('shares its metadata key with the import engine', () => {
    // The rule duplicates the constant so the validator does not depend on the
    // import engine. This is the assertion that keeps the duplicate honest.
    expect(LEGACY_IMPORT_METADATA_KEY).toBe(ENGINE_KEY);
  });

  it('is an ERROR, not a warning', () => {
    const report = validate([{ id: 'n1', type: 'noodl.byob.QueryData', metadata: marker() }]);
    const diagnostic = report.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder);

    expect(diagnostic).toBeDefined();
    expect(diagnostic?.severity).toBe('error');
    expect(report.summary.errors).toBeGreaterThan(0);
  });

  it('stays an error in non-strict mode — a placeholder is not a matter of taste', () => {
    const lenient = validate([{ id: 'n1', type: 'noodl.byob.QueryData', metadata: marker() }], { strict: false });
    expect(lenient.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder)?.severity).toBe('error');
  });

  it('points at the report entry by id', () => {
    const report = validate([{ id: 'n1', type: 'noodl.byob.QueryData', metadata: marker() }]);
    const diagnostic = report.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder);
    expect(diagnostic?.message).toContain('node:/App:n1:noodl.byob.QueryData');
    expect(diagnostic?.message).toContain('import report');
  });

  it('names the original type even if the node type were later rewritten', () => {
    const report = validate([
      { id: 'n1', type: 'Group', metadata: marker({ originalType: 'noodl.byob.QueryData' }) }
    ]);
    expect(report.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder)?.message).toContain(
      'noodl.byob.QueryData'
    );
  });

  it('supersedes the unknown-node-type warning on the same node', () => {
    const report = validate([{ id: 'n1', type: 'noodl.byob.QueryData', metadata: marker() }]);
    expect(report.diagnostics.filter((d) => d.code === DiagnosticCode.UnknownNodeType)).toHaveLength(0);
    expect(report.diagnostics.filter((d) => d.code === DiagnosticCode.LegacyImportPlaceholder)).toHaveLength(1);
  });

  it('leaves an UNMARKED unknown type as a warning — the weaker claim keeps its severity', () => {
    const report = validate([{ id: 'n1', type: 'SomeModuleNode' }]);
    const unknown = report.diagnostics.find((d) => d.code === DiagnosticCode.UnknownNodeType);
    expect(unknown?.severity).toBe('warning');
    expect(report.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder)).toBeUndefined();
  });

  it('says nothing about a clean project', () => {
    const report = validate([{ id: 'n1', type: 'Group' }]);
    expect(report.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder)).toBeUndefined();
  });

  it('ignores a metadata value that is not an object', () => {
    const report = validate([
      { id: 'n1', type: 'Group', metadata: { [LEGACY_IMPORT_METADATA_KEY]: 'yes' } },
      { id: 'n2', type: 'Group', metadata: { [LEGACY_IMPORT_METADATA_KEY]: null } }
    ]);
    expect(report.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder)).toBeUndefined();
  });

  it('degrades gracefully when the marker is missing its fields', () => {
    const report = validate([{ id: 'n1', type: 'noodl.byob.QueryData', metadata: { [LEGACY_IMPORT_METADATA_KEY]: {} } }]);
    const diagnostic = report.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder);
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.message).toContain('noodl.byob.QueryData');
  });

  it('finds a marked node nested inside a hierarchy', () => {
    const report = validate([
      { id: 'root', type: 'Group', children: [{ id: 'n1', type: 'noodl.byob.QueryData', metadata: marker() }] }
    ]);
    const diagnostic = report.diagnostics.find((d) => d.code === DiagnosticCode.LegacyImportPlaceholder);
    expect(diagnostic?.location.nodeId).toBe('n1');
  });

  it('is registered and enabled by default', () => {
    expect(ALL_RULES).toContain(legacyImportPlaceholder);
    expect(legacyImportPlaceholder.defaultEnabled).toBe(true);
    expect(new SemanticValidator(catalog, ALL_RULES).activeRules({})).toContain(legacyImportPlaceholder);
  });
});
