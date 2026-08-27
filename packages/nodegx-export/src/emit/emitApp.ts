/**
 * Whole-app emission: the scaffold, then the visual generator's component/page files replacing
 * the scaffold's placeholders, then the typed api stubs the pages consume. The dependency list
 * stays computed from the output (TARGET-OUTPUT §3): nothing here adds @nodegx/core, because
 * nothing generated imports it.
 */

import { Catalog, CatalogIndex } from '../catalog';
import { planProject, ProjectPlan, QueryPlan } from '../analyze/plan';
import { ExportIR } from '../ir/types';
import { emitComponent } from './component';
import { emitScaffold } from './scaffold';

const GENERATED_TS = '// @nodegx:generated (api stub — provenance markers complete in EXP-007)\n';

export interface EmittedApp {
  /** Path → content, sorted by path (D-rules). */
  files: Record<string, string>;
  /** EXP-004's feed: everything analysis or emission dropped or deferred, per component. */
  notes: string[];
}

export function emitApp(ir: ExportIR, catalog: Catalog): EmittedApp {
  const index = new CatalogIndex(catalog);
  const project = planProject(ir, index);
  const files = emitScaffold(ir);
  const notes: string[] = [];

  for (const plan of project.plans) {
    if (plan.skipReason) {
      if (plan.rootId === null && !plan.file) notes.push(`${plan.path}: ${plan.skipReason}`);
      continue;
    }
    const emitted = emitComponent(plan, project, ir, index);
    if (!emitted) continue;
    Object.assign(files, emitted.files);
    notes.push(...emitted.notes);
    notes.push(...plan.notes.map((note) => `${plan.path}: ${note}`));
  }

  for (const [path, content] of apiStubs(ir, project)) {
    files[path] = content;
  }

  return {
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
    notes
  };
}

/**
 * One typed stub module per collection the generated pages consume. The type comes from the
 * project's collection schema; the stub returns an empty array so the export builds and runs
 * before the inheritor wires a backend, and every stub is a line item in the report.
 */
function apiStubs(ir: ExportIR, project: ProjectPlan): Array<[string, string]> {
  const byCollection = new Map<string, Array<{ componentPath: string; query: QueryPlan }>>();
  for (const plan of project.plans) {
    for (const query of plan.queries) {
      const sites = byCollection.get(query.collectionName) ?? [];
      sites.push({ componentPath: plan.path, query });
      byCollection.set(query.collectionName, sites);
    }
  }

  const stubs: Array<[string, string]> = [];
  for (const [collectionName, sites] of byCollection) {
    const schema = ir.project.collections.find((c) => c.name === collectionName);
    const { typeName, fetchName, moduleBase } = sites[0].query;

    const fields = (schema?.columns ?? []).map((col) => `  ${col.name}?: ${tsColumnType(col.type)};`);
    const siteLines = sites.map(({ componentPath, query }) => {
      const node = ir.components
        .find((c) => c.path === componentPath)
        ?.nodes.find((n) => n.id === query.nodeId);
      const label = node?.authoredLabel ? `"${node.authoredLabel}" ` : '';
      return ` * TODO(export): ${label}(DbCollection2 \`${query.nodeId}\` on /${componentPath})`;
    });

    stubs.push([
      `src/api/${moduleBase}.ts`,
      GENERATED_TS +
        `export interface ${typeName} {\n  id: string;\n${fields.join('\n')}${fields.length > 0 ? '\n' : ''}}\n\n` +
        `/**\n${siteLines.join('\n')}\n` +
        ` * fetched the \`${collectionName}\` collection from the project's NodeGX backend. Connect this to your\n` +
        ` * own data source; the export report lists every call site.\n */\n` +
        `export async function ${fetchName}(): Promise<${typeName}[]> {\n  return [];\n}\n`
    ]);
  }
  return stubs;
}

function tsColumnType(columnType: string): string {
  switch (columnType) {
    case 'Boolean':
      return 'boolean';
    case 'Number':
      return 'number';
    default:
      return 'string';
  }
}
