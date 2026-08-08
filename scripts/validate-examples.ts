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
  checkComponentPortDirection,
  checkInstanceInterfaces,
  checkInstancePorts,
  componentInterfaces,
  formatDiagnosticLine,
  NormProject,
  SemanticValidator,
  buildComponentRefs,
  formatReport,
  type Diagnostic
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
      /**
       * LAS-007 — `plug` is declared here because leaving it out is what let the
       * defect below live in three shipped recipes. See {@link interfaceDiagnostics}.
       */
      ports?: Array<{ name: string; plug?: string; type?: string }>;
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

/**
 * LAS-007 — the interface family, which the semantic validator structurally
 * cannot see.
 *
 * ## What this gate missed, and why it could not have caught it
 *
 * The three composition recipes phase 54 added — `ui-card-grid-repeater`,
 * `ui-icon-feature-strip`, `ui-stat-tile-row` — declared all **11** of their
 * `Component Inputs` ports with `plug: "input"`. That is backwards: a component
 * *input* is a port on a Component Inputs node whose own plug contains
 * `"output"` (`componentmodel.getPorts()` republishes the output side as the
 * component's inputs — LAS-001 documents the inversion). Plugged `input` the
 * ports join no interface, the 12 connections drawn out of them are dropped by
 * the exporter as unhealthy, and every instance renders placeholder chrome.
 * It is F8 verbatim — the defect that makes `ecommerce-example` broken — sitting
 * in the recipes an agent is told to imitate.
 *
 * This gate reported `57/57 clean` throughout, and could not have done otherwise:
 * it ran the `rules/` validator only (the same shape as F14) and its
 * `toNormProject` mapped every port to `instancePorts: [name]`, discarding
 * `plug` before any check could read it. Its `ExampleFile` type did not even
 * declare the field. A gate cannot find what its own model deletes.
 *
 * ## Scope, chosen from a measurement rather than from ambition
 *
 * Running the *whole* precondition set here would also surface 7
 * `inactive-conditional-parameter`, 2 `invalid-parameter-value`, 1
 * `unsized-absolute-box` and 1 `raw-color-literal` across seven other examples —
 * real, pre-existing, and a different task's blast radius (the F14 argument).
 * So this runs the three checks that decide whether a recipe teaches a *working
 * interface*, which is exactly what LAS-007 attaches to interface rejections.
 * The others are filed, with those numbers, in LAS-007's register.
 */
function interfaceDiagnostics(example: ExampleFile): Diagnostic[] {
  const views = example.components.map((c) => ({ name: c.name, nodes: c.nodes ?? [] }));
  const interfaces = componentInterfaces(views);
  const diagnostics: Diagnostic[] = [];
  for (const c of example.components) {
    const nodes = (c.nodes ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      parameters: n.parameters,
      ports: n.ports
    }));
    diagnostics.push(
      ...checkInstancePorts(nodes, { component: c.name }),
      ...checkComponentPortDirection(nodes, { component: c.name }),
      ...checkInstanceInterfaces(nodes, { component: c.name, interfaces })
    );
  }
  return diagnostics;
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
    const interfaceFindings = interfaceDiagnostics(example);
    const dirty = report.summary.errors > 0 || report.summary.warnings > 0 || interfaceFindings.length > 0;
    if (dirty) {
      failed++;
      if (!json) {
        if (report.summary.errors > 0 || report.summary.warnings > 0) {
          console.log(formatReport(report, `example: ${example.id}`));
        }
        for (const d of interfaceFindings) console.log(`example: ${example.id}  ${formatDiagnosticLine(d)}`);
      }
    }
    if (json) {
      results.push({
        id: example.id,
        errors: report.summary.errors,
        warnings: report.summary.warnings,
        diagnostics: [...report.diagnostics, ...interfaceFindings]
      });
    }
  }

  if (json) console.log(JSON.stringify({ results }, null, 2));
  console.log(`${files.length - failed}/${files.length} examples validate clean (strict, warnings-as-errors).`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
