#!/usr/bin/env node
/*
 * SIG-003 — the port-group gate.
 *
 * Reads the generated node catalog and holds every port in the library to three
 * rules. It is a **gate**, not a sweep: `--check` exits non-zero, and the whole
 * point of SIG-003 is that `Other` was never a category anyone chose — it is the
 * absence of a `group:` line rendered by `ConnectionBar.tsx` as if it were a
 * decision. Nothing stops that absence coming back except something that fails.
 *
 * ⚠️ It reads `packages/noodl-types/src/node-catalog.json`, which is generated.
 * A `group` added to a node file and not folded into the catalog is invisible
 * here — run `npm run catalog:check` alongside this, and run both against a
 * committed tree, because the catalog generator reads the working tree.
 *
 * ⚠️ Dynamic ports do not appear in the catalog's static port lists. The nodes
 * that build their own ports are listed in `dynamicPorts`; see DYNAMIC_SEAMS
 * below for the ones checked by hand and what was found.
 *
 * Usage:
 *   node scripts/node-audit/port-groups.js            # report
 *   node scripts/node-audit/port-groups.js --check    # gate: non-zero on any violation
 *   node scripts/node-audit/port-groups.js --census   # the group census, by count
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '../..');
const CATALOG = path.join(REPO, 'packages/noodl-types/src/node-catalog.json');

/*
 * ⚠️ `groupPriority` is read from **source**, not from the catalog.
 *
 * The first version of this gate read `node.connectionPanel.groupPriority` off
 * the catalog and reported a confident `0`. The catalog does not carry
 * `connectionPanel` at all — not one of its 175 node entries has the field — so
 * that rule was a check that could never go red, on the one rule whose failure
 * mode is silent. It would have missed the four cloud nodes that really did list
 * the retired `'Value'` while their ports had already been renamed to `'Values'`:
 * exactly the defect recorded at `text-input.ts:45`, where a group not named in
 * the priority list keeps whatever order it was built in and nothing says so.
 */
const PRIORITY_SOURCE_ROOTS = [
  'packages/noodl-runtime/src',
  'packages/noodl-viewer-react/src',
  'packages/noodl-viewer-cloud/src'
];

/*
 * The vocabulary, settled by Richard on 2026-08-11 (SIG-003 §2, "teaching end").
 *
 * A heading either names a **kind** of port or names a **subject**. Kind headings
 * are the three below and they are exclusive: the popup's heading is then the
 * answer to "what sort of thing is this", which is the distinction phase 60 is
 * named for and the one no heading carried before.
 *
 * Subject headings — `Style`, `Pointer Events`, `Scroll`, `Snap To Position X`,
 * `Bounding Box`, … — group by what the ports are *about*, and legitimately hold
 * more than one kind. `Snap To Position X` is `Do` + `Duration` + `Value`: a task
 * and its parameters, and splitting the trigger from the parameters by kind would
 * be strictly worse. See the Register in SIG-003 for why the acceptance criterion
 * as originally written ("no node files a signal port and a value port under the
 * same heading") is wrong for these.
 */
const KIND_GROUPS = {
  Values: 'value',
  Actions: 'signal-input',
  Events: 'signal-output'
};

/*
 * Names retired by §2, kept here so the gate fails rather than letting the old
 * vocabulary drift back in one node at a time.
 *
 * ⚠️ `group` strings are matched by literal equality against `groupPriority`
 * arrays. Renaming one side and not the other silently demotes the group to
 * unordered — the exact defect recorded at `text-input.ts:45`. `--check` sweeps
 * `groupPriority` for these too.
 */
const RETIRED_GROUPS = {
  Value: 'Values',
  Signals: 'Actions (signal inputs) or Events (signal outputs)',
  'Changed Events': 'Events'
};

/*
 * ⚠️ `Change` is deliberately **not** retired, and SIG-003's own census was wrong
 * about it. The task pairs "`Change` (6) beside `Changed Events` (5)" as an
 * outright duplicate. Read port by port they are not the same idea: every port
 * under `Changed Events` is a signal output, and every port under `Change` — on
 * Array Changed and Object Changed — is a *value* describing what changed
 * (`index`, `item`, `key`, `previousValue`, `value`). `Changed Events` is a
 * fifth name for `Events` and is gone; `Change` is a subject heading, and
 * folding it into `Values` would merge "what the array is" with "what changed
 * about it" on the two nodes whose whole job is the difference.
 */

/*
 * ⚠️ Dynamic-port seams, checked by hand on 2026-08-11 because a static read of
 * the catalog cannot see them. Each entry is a file that registers ports at
 * runtime and the group those ports carry.
 */
const DYNAMIC_SEAMS = [
  'noodl-runtime/src/nodes/std-library/data/record-ports.ts',
  'noodl-runtime/src/nodes/std-library/data/modelnode2.ts',
  'noodl-runtime/src/nodes/std-library/user/user-ports.ts',
  'noodl-runtime/src/nodes/std-library/componentutils/componentobject.ts',
  'noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts'
];

function kindOf(port, side) {
  if (!port.isSignal) return 'value';
  return side === 'inputs' ? 'signal-input' : 'signal-output';
}

function collect() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const ports = [];
  for (const node of catalog.nodes) {
    for (const side of ['inputs', 'outputs']) {
      for (const port of node[side] || []) {
        ports.push({
          node: node.typeName,
          display: node.displayName,
          deprecated: !!node.isDeprecated,
          side,
          name: port.name,
          portDisplay: port.displayName,
          group: port.group,
          kind: kindOf(port, side)
        });
      }
    }
  }
  return { catalog, ports };
}

function audit() {
  const { catalog, ports } = collect();
  const violations = { ungrouped: [], wrongKind: [], retired: [], retiredPriority: [] };

  for (const p of ports) {
    if (!p.group) {
      violations.ungrouped.push(p);
      continue;
    }
    if (RETIRED_GROUPS[p.group]) {
      violations.retired.push(p);
      continue;
    }
    const expected = KIND_GROUPS[p.group];
    if (expected !== undefined && expected !== p.kind) violations.wrongKind.push(p);
  }

  violations.retiredPriority.push(...auditGroupPriority());

  return { catalog, ports, violations };
}

function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  for (const root of PRIORITY_SOURCE_ROOTS) walk(path.join(REPO, root));
  return out;
}

/**
 * Every `groupPriority: [...]` in the node sources, checked against the retired
 * names. Matched textually because these arrays are literals in files that are
 * not otherwise loadable outside the runtime's own bundle.
 */
function auditGroupPriority() {
  const found = [];
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    const re = /groupPriority:\s*\[([^\]]*)\]/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const line = text.slice(0, match.index).split('\n').length;
      for (const raw of match[1].split(',')) {
        const name = raw.trim().replace(/^['"]|['"]$/g, '');
        if (RETIRED_GROUPS[name]) found.push({ node: `${path.relative(REPO, file)}:${line}`, group: name });
      }
    }
  }
  return found;
}

function fmt(p) {
  return `${p.node} · ${p.side.slice(0, -1)} ${p.name} ("${p.portDisplay}") · ${p.kind}${
    p.group ? ` · group "${p.group}"` : ''
  }${p.deprecated ? ' · DEPRECATED' : ''}`;
}

function main() {
  const args = process.argv.slice(2);
  const { catalog, ports, violations } = audit();

  if (args.includes('--census')) {
    const groups = new Map();
    for (const p of ports) {
      const g = p.group || '(ungrouped)';
      if (!groups.has(g)) groups.set(g, { value: 0, 'signal-input': 0, 'signal-output': 0, nodes: new Set() });
      groups.get(g)[p.kind]++;
      groups.get(g).nodes.add(p.node);
    }
    console.log('count  value  action   event  nodes  group');
    [...groups]
      .map(([g, v]) => [g, v, v.value + v['signal-input'] + v['signal-output']])
      .sort((a, b) => b[2] - a[2])
      .forEach(([g, v, total]) => {
        console.log(
          `${String(total).padStart(5)}  ${String(v.value).padStart(5)}  ${String(v['signal-input']).padStart(
            6
          )}  ${String(v['signal-output']).padStart(6)}  ${String(v.nodes.size).padStart(5)}  ${g}`
        );
      });
    return;
  }

  const total = violations.ungrouped.length + violations.wrongKind.length + violations.retired.length + violations.retiredPriority.length;

  console.log(`Port groups — ${catalog.nodes.length} node types, ${ports.length} static ports.`);
  console.log(`Dynamic-port nodes not covered by this read: ${catalog.nodes.filter((n) => n.dynamicPorts).length}.`);
  console.log('');

  const section = (title, rows, render) => {
    console.log(`${rows.length === 0 ? '✓' : '✗'} ${title}: ${rows.length}`);
    rows.forEach((r) => console.log(`    ${render(r)}`));
    if (rows.length) console.log('');
  };

  section('Ports with no group (they render under "Other")', violations.ungrouped, fmt);
  section('Ports in a kind heading that do not match its kind', violations.wrongKind, (p) => `${fmt(p)} — "${p.group}" is for ${KIND_GROUPS[p.group]}`);
  section('Ports in a retired group', violations.retired, (p) => `${fmt(p)} → ${RETIRED_GROUPS[p.group]}`);
  section('groupPriority entries naming a retired group', violations.retiredPriority, (r) => `${r.node} · "${r.group}" → ${RETIRED_GROUPS[r.group]}`);

  console.log(`Dynamic-port seams checked by hand: ${DYNAMIC_SEAMS.length} (see DYNAMIC_SEAMS in this file).`);

  if (args.includes('--check') && total > 0) {
    console.error(`\n✗ ${total} port-group violation(s). See SIG-003.`);
    process.exit(1);
  }
  if (total === 0) console.log('\n✓ No port-group violations.');
}

main();
