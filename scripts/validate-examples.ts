#!/usr/bin/env ts-node
/**
 * SUB-005 — Catalog example gate
 *
 * Runs every authored example fragment (docs/node-catalog/examples/*.json)
 * through the SUB-006 semantic validator in strict mode. Examples must be
 * error- AND warning-free: an example that does not validate is worse than no
 * example, because it teaches an authoring AI a wiring the editor rejects.
 *
 * Usage:
 *   npm run catalog:examples
 *   ts-node -P ./scripts/tsconfig.json ./scripts/validate-examples.ts [--json] [--dir <path>]
 *
 * --dir validates example-format files from an arbitrary directory instead of
 * docs/node-catalog/examples — used by the acceptance harness to score
 * candidate graphs.
 *
 * Exit codes: 0 = all examples clean, 1 = diagnostics found, 2 = IO error.
 *
 * @module scripts/validate-examples
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  NormProject,
  SemanticValidator,
  buildComponentRefs,
  formatReport
} from '../packages/noodl-editor/src/editor/src/validation';

const REPO_ROOT = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(REPO_ROOT, 'docs/node-catalog/examples');

interface ExampleFile {
  id: string;
  title: string;
  demonstrates: string[];
  components: Array<{
    name: string;
    nodes: Array<{
      id: string;
      type: string;
      label?: string;
      parent?: string;
      children?: string[];
      parameters?: Record<string, unknown>;
      ports?: Array<{ name: string }>;
    }>;
    connections: Array<{ fromId: string; fromProperty: string; toId: string; toProperty: string }>;
  }>;
}

function toNormProject(example: ExampleFile): NormProject {
  const components = example.components.map((c) => ({
    name: c.name,
    nodes: (c.nodes ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      parent: n.parent,
      children: Array.isArray(n.children) ? n.children : [],
      instancePorts: (n.ports ?? []).map((p) => p.name)
    })),
    connections: c.connections ?? []
  }));
  return { components, componentRefs: buildComponentRefs(components.map((c) => c.name)) };
}

function main(): void {
  const json = process.argv.includes('--json');
  const dirFlag = process.argv.indexOf('--dir');
  const examplesDir = dirFlag !== -1 ? path.resolve(process.argv[dirFlag + 1]) : EXAMPLES_DIR;

  if (!fs.existsSync(examplesDir)) {
    console.error(`No examples directory at ${examplesDir}`);
    process.exit(2);
  }
  const files = fs
    .readdirSync(examplesDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    console.error('No example files found.');
    process.exit(2);
  }

  const validator = new SemanticValidator();
  const results: unknown[] = [];
  let failed = 0;

  for (const file of files) {
    const full = path.join(examplesDir, file);
    let example: ExampleFile;
    try {
      example = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (err) {
      console.error(`${file}: unreadable JSON — ${err instanceof Error ? err.message : err}`);
      failed++;
      continue;
    }

    const report = validator.validate(toNormProject(example), { strict: true });
    const dirty = report.summary.errors > 0 || report.summary.warnings > 0;
    if (dirty) {
      failed++;
      if (!json) console.log(formatReport(report, `example: ${example.id}`));
    }
    if (json) {
      results.push({
        id: example.id,
        errors: report.summary.errors,
        warnings: report.summary.warnings,
        diagnostics: report.diagnostics
      });
    }
  }

  if (json) console.log(JSON.stringify({ results }, null, 2));
  console.log(`${files.length - failed}/${files.length} examples validate clean (strict, warnings-as-errors).`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
