#!/usr/bin/env ts-node
/**
 * DEF-025 — `label-not-a-click-target` over the corpus that exists.
 *
 * Whether the rule's adjacency predicate separates labels from headings and
 * unrelated copy is a corpus measurement, not an argument. Prints every firing
 * (project, component, control, the words) so each can be read individually,
 * and the DENOMINATORS beside the count — how many toggle controls exist at
 * all, how many already own their label, how many sit beside a Text — because
 * a zero over a corpus with no checkboxes says nothing about the rule.
 *
 * Usage: npm run calibrate:labels -- "<dir-of-projects...>"
 *
 * @module scripts/def-025-corpus-labels
 */

import * as fs from 'fs';
import * as path from 'path';

import { CatalogIndex } from '../packages/noodl-editor/src/editor/src/validation/CatalogIndex';
import { defaultCatalog } from '../packages/noodl-editor/src/editor/src/validation/catalog';
import { loadProject } from '../packages/noodl-editor/src/editor/src/validation/loadV2Project';
import { labelNotAClickTarget } from '../packages/noodl-editor/src/editor/src/validation/rules/labelNotAClickTarget';
import type { NormProject } from '../packages/noodl-editor/src/editor/src/validation/model';
import type { RuleContext } from '../packages/noodl-editor/src/editor/src/validation/rules/types';

const TOGGLES = new Set(['net.noodl.controls.checkbox', 'net.noodl.controls.radiobutton']);

function isProject(dir: string): boolean {
  try {
    if (!fs.statSync(dir).isDirectory()) return false;
  } catch {
    return false;
  }
  return (
    fs.existsSync(path.join(dir, 'components', '_registry.json')) ||
    fs.existsSync(path.join(dir, 'nodegx.project.json')) ||
    fs.existsSync(path.join(dir, 'project.json'))
  );
}

function enumerate(args: string[]): string[] {
  const out: string[] = [];
  for (const arg of args) {
    if (isProject(arg)) out.push(arg);
    else if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) {
      for (const entry of fs.readdirSync(arg)) {
        const dir = path.join(arg, entry);
        if (isProject(dir)) out.push(dir);
      }
    }
  }
  return out;
}

const catalog = new CatalogIndex(defaultCatalog());
const projects = enumerate(process.argv.slice(2));

let unreadable = 0;
let toggles = 0;
let togglesOwnLabel = 0;
let togglesBesideText = 0;
const findings: string[] = [];

for (const dir of projects) {
  let project: NormProject;
  try {
    project = loadProject(dir);
  } catch (e) {
    unreadable++;
    continue;
  }

  const components = project.components.map((component) => ({
    component,
    nodeById: new Map(component.nodes.map((n) => [n.id, n]))
  }));

  for (const { component, nodeById } of components) {
    for (const n of component.nodes) {
      if (!TOGGLES.has(n.type)) continue;
      toggles++;
      const authored = n.parameters?.useLabel;
      if ((authored !== undefined ? authored : catalog.inputDefaults(n.type).useLabel) === true) togglesOwnLabel++;
      const parent = n.parent ? nodeById.get(n.parent) : undefined;
      if (parent) {
        const idx = parent.children.indexOf(n.id);
        if (
          [idx - 1, idx + 1].some((f) => {
            const sib = nodeById.get(parent.children[f]);
            return sib?.type === 'Text';
          })
        )
          togglesBesideText++;
      }
    }
  }

  const ctx = {
    project,
    catalog,
    options: {},
    components,
    counters: { nodesChecked: 0, endpointsChecked: 0 }
  } as unknown as RuleContext;

  for (const d of labelNotAClickTarget.run(ctx)) {
    findings.push(`${path.basename(dir)} · ${d.location.component} · ${d.location.nodeId}\n    ${d.message.split(' Put the words')[0]}`);
  }
}

console.log(`projects: ${projects.length} (${unreadable} unreadable)`);
console.log(`toggle controls: ${toggles} — ${togglesOwnLabel} own their label, ${togglesBesideText} sit beside a Text`);
console.log(`findings: ${findings.length}`);
for (const f of findings) console.log('  ' + f);
