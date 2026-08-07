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
import { loadProject } from '../packages/noodl-editor/src/editor/src/validation/loadV2Project';

interface CliArgs {
  targets: string[];
  json: boolean;
  strict: boolean;
  info: boolean;
  quiet: boolean;
  warningsAsErrors: boolean;
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
      '       [--quiet] [--warnings-as-errors] [--only <codes>] [--disable <codes>] [--list-rules]'
  );
}

function listRules(): void {
  for (const rule of ALL_RULES) {
    const flag = rule.defaultEnabled ? ' ' : '*'; // * = off by default
    console.log(`${flag} ${rule.code.padEnd(30)} ${rule.description}`);
  }
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
  const validator = new SemanticValidator();

  const jsonResults: unknown[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const target of args.targets) {
    let report: ValidationReport;
    try {
      const project = loadProject(target);
      report = validator.validate(project, options);
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
