#!/usr/bin/env ts-node
/**
 * DEF-004 §4c — the corpus calibration pass for `completed-commits-unchecked`.
 *
 * ## The question
 *
 * The rule refuses a `completed` edge that commits a result nothing checked. It
 * was calibrated on **four instances**, all in one template, and a predicate
 * measured on four graphs is a hypothesis about every other graph. Before it can
 * join `AUTHORED_BLOCKING_WARNINGS` — where it rejects a write an agent just made
 * — the question is how often it fires on projects nobody wrote it for, and
 * whether those firings are true.
 *
 * DEF-002's own history is the reason this exists rather than a judgement call:
 * that rule went **249 → 182 → 33** across the same corpus as two false
 * positives were found, and both were in the one graph written to honour its
 * task's trap.
 *
 * ## What it reports
 *
 * Per project: the components holding a `noodl.cloud.request` (the denominator —
 * a rule that fires nowhere because it looked nowhere is not a clean rule), the
 * `completed` wires seen at all, and every finding with its wire.
 *
 * 🔴 **The denominator is printed whether or not anything fires.** A zero over a
 * corpus with no cloud functions in it says nothing about the rule.
 *
 * ## Usage
 *
 *   ts-node -P ./scripts/tsconfig.json ./scripts/def-004-corpus-completed.ts <dir-of-projects...>
 *   npm run calibrate:completed -- "<dir>"
 *
 * @module scripts/def-004-corpus-completed
 */

import * as fs from 'fs';
import * as path from 'path';

import { SemanticValidator } from '../packages/noodl-editor/src/editor/src/validation';
import { DiagnosticCode } from '../packages/noodl-editor/src/editor/src/validation/diagnostics';
import { CatalogIndex } from '../packages/noodl-editor/src/editor/src/validation/CatalogIndex';
import { defaultCatalog } from '../packages/noodl-editor/src/editor/src/validation/catalog';
import { loadProject } from '../packages/noodl-editor/src/editor/src/validation/loadV2Project';
import { extractProjectOverlay } from '../packages/noodl-mcp/src/kitExtract/extract';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mergeOverlay } = require('@nodegx/kit-catalog');

const CLOUD_REQUEST_TYPE = 'noodl.cloud.request';

function isV2Directory(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'components', '_registry.json')) ||
    fs.existsSync(path.join(dir, 'nodegx.project.json'))
  );
}

function isProject(dir: string): boolean {
  try {
    if (!fs.statSync(dir).isDirectory()) return false;
  } catch {
    return false;
  }
  return isV2Directory(dir) || fs.existsSync(path.join(dir, 'project.json'));
}

function catalogFor(target: string): CatalogIndex {
  try {
    const overlay = extractProjectOverlay(target);
    if (!overlay.unavailable && overlay.nodes.length > 0) {
      return new CatalogIndex(mergeOverlay(defaultCatalog(), overlay.nodes));
    }
  } catch {
    /* a broken kit must not stop the measurement */
  }
  return new CatalogIndex(defaultCatalog());
}

function main(): void {
  const argv = process.argv.slice(2);
  const targets = argv.filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    console.error('usage: def-004-corpus-completed.ts <dir...>');
    process.exit(2);
  }

  const projects: string[] = [];
  for (const t of targets) {
    const resolved = path.resolve(t);
    if (isProject(resolved)) {
      projects.push(resolved);
      continue;
    }
    for (const entry of fs.readdirSync(resolved)) {
      const child = path.join(resolved, entry);
      if (isProject(child)) projects.push(child);
    }
  }
  // 🔴 An empty corpus exits 2, never 0 — the same reason DEF-002's script does.
  if (projects.length === 0) {
    console.error(`No projects found under: ${targets.join(', ')}`);
    process.exit(2);
  }

  let cloudComponents = 0;
  let completedWires = 0;
  let completedIntoCommits = 0;
  let findings = 0;
  let readFailures = 0;
  const hits: string[] = [];
  const projectsWithCloud: string[] = [];
  /**
   * 🔴 What the rule saw and ACCEPTED, keyed by component.
   *
   * A calibration that prints only refusals cannot be read: "20 findings out of
   * 34 wires" leaves the other 14 as an inference. These are the graphs the
   * discrimination is protecting, and they are the half most likely to be wrong.
   */
  const accepted = new Map<string, number>();

  for (const project of projects) {
    const label = path.basename(project);
    try {
      const catalog = catalogFor(project);
      const loaded = loadProject(project);

      let cloudHere = 0;
      for (const component of loaded.components) {
        if (!component.nodes.some((n) => n.type === CLOUD_REQUEST_TYPE)) continue;
        cloudHere++;
        const wires = component.connections.filter((c) => c.fromProperty === 'completed');
        completedWires += wires.length;
        // Counted separately so a zero can be read: a rule that never sees its
        // shape and a rule that sees it and accepts it are different results.
        completedIntoCommits += wires.filter((c) => c.toProperty === 'store' || c.toProperty === 'send').length;
      }
      cloudComponents += cloudHere;
      if (cloudHere > 0) projectsWithCloud.push(`${label} (${cloudHere})`);

      const validator = new SemanticValidator(catalog);
      const report = validator.validate(loaded, {
        strict: false,
        only: new Set([DiagnosticCode.CompletedCommitsUnchecked])
      });
      const refusedWires = new Set<string>();
      for (const d of report.diagnostics) {
        findings++;
        const c = d.location.connection;
        if (c) refusedWires.add(`${d.location.component}\0${c.fromId}\0${c.toId}\0${c.toProperty}`);
        hits.push(
          `  ${label} :: ${d.location.component}\n` +
            `      ${c ? `${c.fromId}.${c.fromProperty} -> ${c.toId}.${c.toProperty}` : d.location.nodeId}`
        );
      }

      for (const component of loaded.components) {
        if (!component.nodes.some((n) => n.type === CLOUD_REQUEST_TYPE)) continue;
        for (const c of component.connections) {
          if (c.fromProperty !== 'completed') continue;
          if (c.toProperty !== 'store' && c.toProperty !== 'send') continue;
          if (refusedWires.has(`${component.name}\0${c.fromId}\0${c.toId}\0${c.toProperty}`)) continue;
          const key = `${component.name} (-> ${c.toProperty})`;
          accepted.set(key, (accepted.get(key) ?? 0) + 1);
        }
      }
    } catch (err) {
      readFailures++;
      console.error(`SKIP ${label}: ${(err as Error).message}`);
    }
  }

  console.log(`\nprojects read            ${projects.length - readFailures} (${readFailures} unreadable)`);
  console.log(`cloud-function components ${cloudComponents}   ← the denominator`);
  console.log(`  in projects:            ${projectsWithCloud.join(', ') || 'none'}`);
  console.log(`\`completed\` wires in them ${completedWires}`);
  console.log(`  …landing on store/send  ${completedIntoCommits}`);
  console.log(`findings                  ${findings}`);
  console.log(`accepted (seen, allowed)  ${completedIntoCommits - findings}\n`);
  if (accepted.size > 0) {
    console.log('accepted, by component — the half the discrimination protects:');
    for (const [key, n] of [...accepted].sort()) console.log(`  ${n} x  ${key}`);
    console.log('');
  }
  if (hits.length > 0) {
    console.log('findings, by wire:');
    for (const h of hits) console.log(h);
    console.log('');
  }
}

main();
