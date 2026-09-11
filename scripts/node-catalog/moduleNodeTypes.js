/**
 * COM-003 AC3 — resolving an example's `requiresModules` declaration.
 *
 * ## Why this is a shared file and not a function in the gate that needed it first
 *
 * The question *"is this module-provided node type real?"* is asked by **two** pipelines that do
 * not share a line of code today:
 *
 *   `catalog:examples`  (scripts/validate-examples.ts)  — is the graph wired correctly?
 *   `catalog:merge`     (scripts/node-catalog/merge.js) — does `demonstrates` name real types?
 *
 * COM-003 taught the first one and the second one refused the same three examples ten minutes
 * later, with a different message, from a different file. Two implementations of one rule drift —
 * and the drift is invisible, because each gate stays green about its own half. So the rule lives
 * here once and both callers read it.
 *
 * ## What a declaration has to survive
 *
 * 🔴 **Checked, never believed.** `requiresModules: [{ module, nodes }]` is only honoured when the
 * module ships in `library/modules/<slug>/`, its `library.json` says `type: "module"`, and its own
 * `index.js` names each declared type in a `Noodl.defineReactNode({ name: "..." })`-shaped
 * registration. Registration is presence-on-disk — `library/modules/README.md` says there is no
 * install manifest — so the entry point is the only honest source for the node names.
 *
 * A declaration that fails any of those is an ERROR. If it were merely ignored, `requiresModules`
 * would be a way to spell "stop checking this node", which is the opposite of a gate.
 *
 * ⚠️ **It proves the type EXISTS and nothing else.** No ports, no parameters, no wiring. Callers
 * must keep emitting whatever "this node was not checked" notice they already emit. The durable
 * fix is the kit overlay (CN-003), which turns module types into real catalog entries; when that
 * reaches these gates, this file should shrink to nothing.
 *
 * @module scripts/node-catalog/moduleNodeTypes
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const MODULES_DIR = path.join(REPO_ROOT, 'library/modules');

/**
 * Resolve an example's module declaration.
 *
 * @param {{ id?: string, requiresModules?: Array<{module: string, nodes: string[]}>,
 *           components?: Array<{nodes?: Array<{type: string}>}> }} example
 * @returns {{ declaredTypes: Set<string>, problems: string[] }} `problems` is a list of
 *   human-readable reasons; an empty list means every declaration resolved.
 */
function resolveModuleNodeTypes(example) {
  const declaredTypes = new Set();
  const problems = [];

  for (const req of example.requiresModules || []) {
    const dir = path.join(MODULES_DIR, req.module);
    const card = path.join(dir, 'library.json');
    if (!fs.existsSync(card)) {
      problems.push(
        `requiresModules names "${req.module}", and there is no module at library/modules/${req.module}. ` +
          'A declaration that cannot be resolved must not silence anything.'
      );
      continue;
    }
    let type;
    try {
      type = JSON.parse(fs.readFileSync(card, 'utf8')).type;
    } catch (err) {
      problems.push(`library/modules/${req.module}/library.json is unreadable — ${err.message}`);
      continue;
    }
    if (type !== 'module') {
      problems.push(
        `library/modules/${req.module} is a "${type}" library entry, not a module, so it registers no node types.`
      );
      continue;
    }

    const modulesRoot = path.join(dir, 'project/noodl_modules');
    const sources = fs.existsSync(modulesRoot)
      ? fs
          .readdirSync(modulesRoot)
          .map((name) => path.join(modulesRoot, name, 'index.js'))
          .filter((p) => fs.existsSync(p))
      : [];
    const source = sources.map((p) => fs.readFileSync(p, 'utf8')).join('\n');

    for (const nodeType of req.nodes || []) {
      const escaped = nodeType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`name\\s*:\\s*['"]${escaped}['"]`).test(source)) {
        declaredTypes.add(nodeType);
      } else {
        problems.push(
          `requiresModules claims module "${req.module}" registers node type "${nodeType}", and its ` +
            'index.js does not name it. Either the type is misspelt or it comes from a different module.'
        );
      }
    }
  }

  // A type declared but never used is a stale declaration: it outlives the node being removed and
  // then silently covers the next unknown type that happens to share its name.
  const used = new Set((example.components || []).flatMap((c) => (c.nodes || []).map((n) => n.type)));
  for (const t of declaredTypes) {
    if (!used.has(t)) {
      problems.push(`requiresModules declares "${t}" and no node in this example uses it — remove the declaration.`);
    }
  }

  return { declaredTypes, problems };
}

module.exports = { resolveModuleNodeTypes };
