#!/usr/bin/env ts-node
/**
 * SUB-006 — Semantic Validator CLI
 *
 * Validates a Noodl project (v2 decomposed directory OR legacy monolithic
 * project.json) against the node catalog, emitting actionable diagnostics for
 * unknown node types, nonexistent ports, dangling/incompatible connections,
 * orphaned nodes, and unresolved component references.
 *
 * Usage:
 *   ts-node scripts/validate-project.ts <target...> [options]
 *   npm run validate:project -- <target...> [options]
 *
 * Options:
 *   --json                 Machine-readable JSON output (for CI / MCP).
 *   --strict               Promote "unknown node type" warnings to errors.
 *   --info                 Emit info notes for runtime-determined ports skipped.
 *   --quiet                Print only diagnostics, no per-target headers.
 *   --warnings-as-errors   Exit non-zero if there are any warnings too.
 *   --no-kits              Ignore the project's own node kits (built-in types only).
 *   --only <codes>         Run only these rules (comma-separated codes).
 *   --disable <codes>      Skip these rules (comma-separated codes).
 *   --list-rules           Print the available rules and exit.
 *
 * Exit codes: 0 = clean (no errors), 1 = errors found, 2 = usage/IO error.
 *
 * @module scripts/validate-project
 */

import {
  SemanticValidator,
  DiagnosticCode,
  ValidatorOptions,
  ValidationReport,
  formatReport,
  toJSON,
  ALL_RULES
} from '../packages/noodl-editor/src/editor/src/validation';
import { CatalogIndex } from '../packages/noodl-editor/src/editor/src/validation/CatalogIndex';
import { defaultCatalog } from '../packages/noodl-editor/src/editor/src/validation/catalog';
import { loadProject } from '../packages/noodl-editor/src/editor/src/validation/loadV2Project';
import { extractProjectOverlay } from '../packages/noodl-mcp/src/kitExtract/extract';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mergeOverlay } = require('@nodegx/kit-catalog');

interface CliArgs {
  targets: string[];
  json: boolean;
  strict: boolean;
  info: boolean;
  quiet: boolean;
  warningsAsErrors: boolean;
  /** CN-003 — skip the project-kit overlay; validate against the built-ins only. */
  noKits: boolean;
  only?: Set<DiagnosticCode>;
  disabled?: Set<DiagnosticCode>;
  listRules: boolean;
}

const VALID_CODES = new Set<string>(Object.values(DiagnosticCode));

function parseCodes(value: string): Set<DiagnosticCode> {
  const set = new Set<DiagnosticCode>();
  for (const raw of value.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!VALID_CODES.has(raw)) {
      console.error(`Unknown rule code: "${raw}". Run --list-rules to see valid codes.`);
      process.exit(2);
    }
    set.add(raw as DiagnosticCode);
  }
  return set;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    targets: [],
    json: false,
    strict: false,
    info: false,
    quiet: false,
    warningsAsErrors: false,
    noKits: false,
    listRules: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--json': args.json = true; break;
      case '--strict': args.strict = true; break;
      case '--info': args.info = true; break;
      case '--quiet': args.quiet = true; break;
      case '--warnings-as-errors': args.warningsAsErrors = true; break;
      case '--no-kits': args.noKits = true; break;
      case '--list-rules': args.listRules = true; break;
      case '--only': args.only = parseCodes(argv[++i] ?? ''); break;
      case '--disable': args.disabled = parseCodes(argv[++i] ?? ''); break;
      default:
        if (a.startsWith('--')) {
          console.error(`Unknown option: ${a}`);
          process.exit(2);
        }
        args.targets.push(a);
    }
  }
  return args;
}

function printUsage(): void {
  console.error(
    'Usage: ts-node scripts/validate-project.ts <target...> [--json] [--strict] [--info]\n' +
      '       [--quiet] [--warnings-as-errors] [--no-kits] [--only <codes>] [--disable <codes>] [--list-rules]'
  );
}

function listRules(): void {
  for (const rule of ALL_RULES) {
    const flag = rule.defaultEnabled ? ' ' : '*'; // * = off by default
    console.log(`${flag} ${rule.code.padEnd(30)} ${rule.description}`);
  }
}

/**
 * CN-003 — a validator that knows *this* target's kit node types.
 *
 * 🔴 **Per target, never shared.** Each argument is a different project with a
 * different `noodl_modules`, and one validator carrying the first project's
 * overlay would answer about the wrong kit for every project after it — the same
 * leak CN-003's acceptance criterion 1 tests for, in a shape a CLI makes easy to
 * write by accident.
 *
 * ⚠️ **Why this pipeline needs its own wiring at all.** The MCP server installs
 * the overlay at bind (`noodl-mcp/src/kitOverlay.ts`) and refuses a legacy
 * monolithic `project.json` outright — so `cashflow-command-centre`, the project
 * CN-003's acceptance number was measured on, can only ever be validated here.
 * The two routes share the extractor and the mapping and differ only in which
 * catalog document they merge into.
 *
 * An extraction that could not run says so on stderr and validation continues
 * against the built-ins: a broken kit must not stop a project being checked, but
 * it must not be reported as a project with no kit either.
 */
function validatorFor(target: string, args: CliArgs): SemanticValidator {
  if (args.noKits) return new SemanticValidator();

  const overlay = extractProjectOverlay(target);
  if (overlay.unavailable) {
    console.error(`WARN kit node types for ${target} could not be read: ${overlay.unavailable.reason}`);
    console.error('     Nodes from this project\'s kits are validated as unknown types below.');
  }
  for (const failure of overlay.failures) {
    console.error(`WARN kit "${failure.kitModule}" (${failure.dirPath}) failed to load: ${failure.message}`);
  }
  for (const collision of overlay.collisions) {
    console.error(
      `WARN kit "${collision.kitModule}" declares "${collision.typeName}", which is a built-in type name. ` +
        'The built-in wins; the kit\'s node is not available.'
    );
  }
  if (overlay.nodes.length === 0) return new SemanticValidator();

  return new SemanticValidator(new CatalogIndex(mergeOverlay(defaultCatalog(), overlay.nodes)));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.listRules) {
    listRules();
    process.exit(0);
  }
  if (args.targets.length === 0) {
    printUsage();
    process.exit(2);
  }

  const options: ValidatorOptions = {
    strict: args.strict,
    emitDynamicPortInfo: args.info,
    only: args.only,
    disabled: args.disabled
  };
  const jsonResults: unknown[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const target of args.targets) {
    let report: ValidationReport;
    try {
      const project = loadProject(target);
      report = validatorFor(target, args).validate(project, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (args.json) {
        jsonResults.push({ target, error: message });
      } else {
        console.error(`ERROR loading ${target}: ${message}`);
      }
      totalErrors++;
      continue;
    }

    totalErrors += report.summary.errors;
    totalWarnings += report.summary.warnings;

    if (args.json) {
      jsonResults.push(toJSON(report, target));
    } else {
      console.log(formatReport(report, args.quiet ? undefined : target));
      console.log('');
    }
  }

  if (args.json) {
    console.log(JSON.stringify({ results: jsonResults }, null, 2));
  }

  const gate = totalErrors > 0 || (args.warningsAsErrors && totalWarnings > 0);
  process.exit(gate ? 1 : 0);
}

main();
