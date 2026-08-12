/**
 * LGC-009 — put a hat on the Logic Builder programs saved in a project.
 *
 * ```
 * npx ts-node -P ./scripts/lgc009/tsconfig.json -r tsconfig-paths/register \
 *   ./scripts/lgc009/migrate-hat-fixtures.ts --check <project.json> [...]   # says what it would do
 * npx ts-node -P ./scripts/lgc009/tsconfig.json -r tsconfig-paths/register \
 *   ./scripts/lgc009/migrate-hat-fixtures.ts <project.json> [...]           # writes
 * ```
 *
 * ⚠️ **Its own tsconfig, and `tsconfig-paths/register` is not optional.** The repo's root
 * tsconfig resolves `@noodl/runtime/src/*` to generated declarations in `dist-types`, which is a
 * gitignored build artefact — and, in a git worktree, a symlink into the primary checkout. A
 * runtime change made in the same commit as this script is therefore invisible to the default
 * config. See `scripts/lgc009/tsconfig.json`.
 *
 * Reads each `project.json`, rewrites the `workspace` parameter of every `Logic Builder` node
 * through {@link ensureHatsInJson}, and writes the file back. `--check` reports what it would do
 * and writes nothing.
 *
 * ## What it deliberately does not touch
 *
 * `generatedCode`. The hat generates the empty string, so a migrated program compiles to exactly
 * the JavaScript it compiled to before — that is acceptance criterion 1, and it is proved by
 * `tests-unit/lgc-009/hat-block.spec.ts` generating both and diffing. A migration that also
 * rewrote the code would be claiming to know something the editor is the only thing that knows.
 *
 * ## Why it is a script and not something the editor does on save
 *
 * The editor already migrates on open (`CanvasTabsContext`), which is enough for correctness: a
 * program acquires its hat the first time anyone looks at it, and is written back on the first
 * edit. This exists so a fixture can be migrated **without opening it**, which is what a QA
 * project that a drive is about to assert against needs.
 *
 * ⚠️ Writes in place. Take a copy first — the two fixtures this was written for are hand-authored
 * and not reproducible.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ensureHatsInJson } from '../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/hatMigration';

const LOGIC_BUILDER_TYPE = 'Logic Builder';

interface NodeJson {
  type?: string;
  parameters?: Record<string, unknown>;
  children?: NodeJson[];
}

interface ProjectJson {
  components?: { name?: string; graph?: { roots?: NodeJson[] } }[];
}

function walk(nodes: NodeJson[] | undefined, visit: (node: NodeJson) => void): void {
  for (const node of nodes || []) {
    visit(node);
    walk(node.children, visit);
  }
}

function migrateProject(file: string, check: boolean): number {
  const raw = fs.readFileSync(file, 'utf8');
  const project = JSON.parse(raw) as ProjectJson;

  let changed = 0;

  for (const component of project.components || []) {
    walk(component.graph && component.graph.roots, (node) => {
      if (node.type !== LOGIC_BUILDER_TYPE || !node.parameters) return;

      const before = node.parameters.workspace;
      if (typeof before !== 'string') return;

      const after = ensureHatsInJson(before);
      if (after === before) {
        console.log(`  · ${component.name} — already hatted (or nothing to hat)`);
        return;
      }

      node.parameters.workspace = after;
      changed++;
      console.log(`  ✎ ${component.name} — hat added`);
    });
  }

  if (changed === 0) return 0;

  // Two spaces and **no trailing newline**, which is byte-for-byte what the editor writes.
  // Measured on `lgc59-drive` and `lgc59-cycle`: with the newline the round trip differs by
  // exactly one character, and the reviewer of the migration diff would have to take the whole
  // file on trust rather than reading the one line that moved.
  const serialised = JSON.stringify(project, null, 2);

  /**
   * ⚠️ **Say so if this reformats the file.** Re-serialising a whole `project.json` is a change
   * to every line of it, and a reviewer looking at a 2000-line diff cannot see the one workspace
   * string that actually moved. So the round trip is measured rather than assumed: with the
   * migration undone, does the file come back byte-identical?
   */
  const reformatOnly = JSON.stringify(JSON.parse(raw), null, 2);
  if (reformatOnly !== raw) {
    console.warn(
      '  ⚠️ this file is not `JSON.stringify(…, null, 2)`-formatted, so the write will reformat it as well as migrate it'
    );
  }

  if (!check) fs.writeFileSync(file, serialised, 'utf8');

  return changed;
}

function main(): void {
  const args = process.argv.slice(2);
  const check = args.indexOf('--check') !== -1;
  const files = args.filter((a) => a !== '--check');

  if (files.length === 0) {
    console.error('usage: migrate-hat-fixtures.ts [--check] <project.json> [...]');
    process.exit(2);
  }

  let total = 0;
  for (const file of files) {
    const resolved = path.resolve(file);
    console.log(`${resolved}`);
    total += migrateProject(resolved, check);
  }

  console.log(check ? `\n${total} workspace(s) would change.` : `\n${total} workspace(s) changed.`);
}

main();
