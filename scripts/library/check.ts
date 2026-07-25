#!/usr/bin/env ts-node
/**
 * LIB-001 — npm run library:check
 *
 * Gate for every entry under library/{prefabs,modules}/<slug>/:
 *   1. library.json exists and validates against scripts/library/schema.json
 *   2. project/ loads as a Noodl project (v2 or legacy) via the same loader
 *      the SUB-006 CLI uses
 *   3. the SUB-006 semantic validator reports zero *errors* (see note below)
 *
 * Content here was seeded as-is from the live docs-site library (LIB-001
 * step 3) — repair and restyling is LIB-002/003's job, not this gate's. So
 * this only fails CI on errors (broken references — an unknown node type, a
 * nonexistent port), not on warnings (style/quality issues LIB-002/003 own).
 * A future entry authored directly in this repo is expected to be
 * warning-clean too; nothing here stops tightening that later.
 *
 * Usage:
 *   npm run library:check
 *   ts-node -P ./scripts/tsconfig.json ./scripts/library/check.ts [--json]
 *
 * Exit codes: 0 = clean, 1 = a schema or validator error was found, 2 = usage/IO error.
 */
import * as fs from 'fs';
import * as path from 'path';

import Ajv from 'ajv';

import { SemanticValidator, formatReport } from '../../packages/noodl-editor/src/editor/src/validation';
import { loadProject } from '../../packages/noodl-editor/src/editor/src/validation/loadV2Project';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

const TYPES = ['prefabs', 'modules'] as const;
const json = process.argv.includes('--json');

interface EntryResult {
  type: string;
  slug: string;
  ok: boolean;
  problems: string[];
  warnings: number;
}

function listEntries(type: string): string[] {
  const dir = path.join(LIBRARY_DIR, type);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function checkEntry(type: string, slug: string, ajv: InstanceType<typeof Ajv>, validator: SemanticValidator): EntryResult {
  const problems: string[] = [];
  const entryDir = path.join(LIBRARY_DIR, type, slug);
  const metaPath = path.join(entryDir, 'library.json');

  if (!fs.existsSync(metaPath)) {
    return { type, slug, ok: false, problems: ['missing library.json'], warnings: 0 };
  }

  let meta: any;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (err) {
    return { type, slug, ok: false, problems: [`unreadable library.json: ${(err as Error).message}`], warnings: 0 };
  }

  const validateSchema = ajv.compile(SCHEMA);
  if (!validateSchema(meta)) {
    for (const e of validateSchema.errors || []) {
      // Ajv's shipped .d.ts lags its runtime shape in this repo's toolchain
      // (see the identical TS2339 worked around in schemas/validator.ts).
      const err = e as unknown as { instancePath?: string; message?: string };
      problems.push(`schema: ${err.instancePath || '(root)'} ${err.message}`);
    }
  }

  if (meta.icon && !fs.existsSync(path.join(entryDir, meta.icon))) {
    problems.push(`schema: icon "${meta.icon}" does not exist in ${type}/${slug}/`);
  }

  const projectDir = path.join(entryDir, 'project');
  let warnings = 0;
  if (!fs.existsSync(projectDir)) {
    problems.push('project/ directory is missing');
  } else {
    try {
      const project = loadProject(projectDir);
      const report = validator.validate(project, {});
      warnings = report.summary.warnings;
      if (report.summary.errors > 0) {
        problems.push(`validator: ${report.summary.errors} error(s)\n${formatReport(report)}`);
      }
    } catch (err) {
      problems.push(`project failed to load: ${(err as Error).message}`);
    }
  }

  return { type, slug, ok: problems.length === 0, problems, warnings };
}

function main(): void {
  const ajv = new Ajv({ allErrors: true });
  const validator = new SemanticValidator();

  const results: EntryResult[] = [];
  for (const type of TYPES) {
    for (const slug of listEntries(type)) {
      results.push(checkEntry(type, slug, ajv, validator));
    }
  }

  if (results.length === 0) {
    console.error(`No library entries found under ${path.relative(REPO_ROOT, LIBRARY_DIR)}/{prefabs,modules}/`);
    process.exit(2);
  }

  const failed = results.filter((r) => !r.ok);
  const totalWarnings = results.reduce((n, r) => n + r.warnings, 0);

  if (json) {
    console.log(JSON.stringify({ results }, null, 2));
  } else {
    for (const r of results) {
      const status = r.ok ? 'OK  ' : 'FAIL';
      console.log(`${status} ${r.type}/${r.slug}${r.warnings ? ` (${r.warnings} warning(s))` : ''}`);
      for (const p of r.problems) console.log(`       ${p}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} entries clean ` +
        `(${totalWarnings} total warning(s) across all entries — LIB-002/003 territory, not gated here).`
    );
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
