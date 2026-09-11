/**
 * The fixture a behavioural drive needs: one library entry, instantiated on a
 * real page, with your own probe nodes wired to its outputs.
 *
 * ## Why these exist beside `render-check.js`
 *
 * A render proves an entry *draws*. It cannot prove it *works*. Every prefab
 * added on 2026-09-05 rendered correctly on its first try and failed its first
 * drive:
 *
 * - the Search Bar's debounce emitted once per keystroke (`Timer`'s `Duration`
 *   is a plain number of ms; the `{value, unit}` shape measures as zero),
 * - the Accordion needed **two** clicks per header (a Function with no input
 *   that ever arrives never runs at load, so the first click was consumed as
 *   the missing boot run),
 * - the Stepper was one ticked checkbox away from walking to the end on a
 *   single click (`Advance` reads the Counter it increments).
 *
 * None of those is visible in a screenshot or in the graph. Each drive below
 * therefore asserts a **sequence** — steps per click, signals per keystroke —
 * rather than a final state, because the final state was right in every case.
 *
 * ## The two things the fixture has to get right
 *
 * `ports` from `dynamicports`, or every signal output is missing and correct
 * scripts throw `Outputs.X is not a function` (see `render-check.js`'s header —
 * this is the export contract, not a nicety). And the starter `noodl_modules`,
 * or every icon fails. Both are why this is shared code and not copied.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const STARTER_MODULES = path.join(
  REPO_ROOT,
  'packages/noodl-editor/src/assets/starter-project/noodl_modules'
);

/** Nested legacy roots → the flat v2 shape, carrying dynamic ports as `ports`. */
function flatten(roots) {
  const flat = [];
  const walk = (nodes, parent) => {
    for (const node of nodes || []) {
      const { children, ...rest } = node;
      const out = { ...rest };
      if (Array.isArray(node.dynamicports) && node.dynamicports.length) out.ports = node.dynamicports;
      if (parent !== undefined) out.parent = parent;
      if (children && children.length) out.children = children.map((c) => c.id);
      flat.push(out);
      if (children && children.length) walk(children, node.id);
    }
  };
  walk(roots, undefined);
  return flat;
}

/**
 * Build a scratch project holding `library/prefabs/<slug>` plus a `/Drive` page.
 *
 * @param {string} slug          entry under `library/prefabs/`
 * @param {object} drive         `{ nodes, connections }` for the `/Drive` page. The entry is
 *                               already placed as node id `subject`; add your probes and wire
 *                               them to its outputs.
 * @param {(node: object) => void} [stamp]  called on every node of the entry before it is
 *                               written — for splicing a counter into a script, say.
 * @returns {string} the project directory
 */
function buildDriveProject(slug, drive, stamp) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), `drive-${slug}-`)), 'p');
  const comps = path.join(dir, 'components');
  fs.mkdirSync(comps, { recursive: true });
  const registry = { version: 1, components: {} };

  const write = (name, nodes, connections, id) => {
    const key = name.replace(/^\/+/, '');
    const d = path.join(comps, key);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(
      path.join(d, 'component.json'),
      JSON.stringify({ id, name: key.split('/').pop(), path: name, type: 'visual' }, null, 2)
    );
    fs.writeFileSync(path.join(d, 'nodes.json'), JSON.stringify({ componentId: id, version: 1, nodes }, null, 2));
    fs.writeFileSync(
      path.join(d, 'connections.json'),
      JSON.stringify({ componentId: id, version: 1, connections }, null, 2)
    );
    registry.components[key] = {
      path: key,
      type: 'visual',
      nodeCount: nodes.length,
      connectionCount: connections.length
    };
  };

  const entryDir = path.join(REPO_ROOT, 'library/prefabs', slug);
  const project = JSON.parse(fs.readFileSync(path.join(entryDir, 'project/project.json'), 'utf8'));
  const rootName = project.components[0].name;
  for (const c of project.components) {
    if (stamp) {
      const walk = (n) => {
        stamp(n);
        (n.children || []).forEach(walk);
      };
      (c.graph.roots || []).forEach(walk);
    }
    write(
      c.name,
      flatten(c.graph.roots),
      (c.graph.connections || []).map((x) => ({
        sourceId: x.fromId,
        sourcePort: x.fromProperty,
        targetId: x.toId,
        targetPort: x.toProperty
      })),
      c.id
    );
  }

  write(
    '/App',
    [
      {
        id: 'app-root',
        type: 'Group',
        children: ['router'],
        parameters: { sizeMode: 'explicit', width: { value: 100, unit: '%' }, height: { value: 100, unit: '%' } }
      },
      {
        id: 'router',
        type: 'Router',
        parent: 'app-root',
        parameters: { name: 'Main', pages: { startPage: '/Drive', routes: ['/Drive'] } }
      }
    ],
    [],
    'd0000000-0000-4000-8000-000000000001'
  );

  const probes = drive.nodes || [];
  // A probe carrying `parent` is placed inside that node — which is how a drive
  // gives the subject the content a user would drop into it. The tree is written
  // BOTH ways, `children` on the parent and `parent` on the child, because the
  // loader builds from `children` and a probe that only names its parent renders
  // nowhere: the first version of the advanced-columns drive put six tiles inside
  // the prefab and measured an empty page.
  const childrenOf = (id) => {
    const kids = probes.filter((n) => (n.onPage ? 'page' : n.parent) === id).map((n) => n.id);
    return kids.length ? { children: kids } : {};
  };
  write(
    '/Drive',
    [
      {
        id: 'page',
        type: 'Page',
        children: ['subject', ...probes.filter((n) => n.onPage).map((n) => n.id)],
        parameters: { title: 'Drive', urlPath: '' }
      },
      {
        id: 'subject',
        type: rootName,
        parent: 'page',
        parameters: drive.subjectParameters || {},
        ...childrenOf('subject')
      },
      ...probes.map(({ onPage, ...n }) => ({
        ...n,
        ...(onPage ? { parent: 'page' } : {}),
        ...childrenOf(n.id)
      }))
    ],
    drive.connections || [],
    'd0000000-0000-4000-8000-000000000002'
  );

  fs.writeFileSync(path.join(comps, '_registry.json'), JSON.stringify(registry, null, 2));
  // A project made by this editor is not empty — without this every icon fails.
  fs.cpSync(STARTER_MODULES, path.join(dir, 'noodl_modules'), { recursive: true });
  // The entry's own assets win over the starter set.
  for (const name of fs.readdirSync(path.join(entryDir, 'project'))) {
    if (name === 'project.json') continue;
    fs.cpSync(path.join(entryDir, 'project', name), path.join(dir, name), { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, 'nodegx.project.json'),
    JSON.stringify(
      {
        name: `${slug} drive`,
        version: '4',
        settings: {},
        structure: { componentsDir: 'components', assetsDir: 'assets' },
        metadata: {},
        rootNodeId: 'app-root'
      },
      null,
      2
    )
  );
  return dir;
}

/** Print a row and remember whether everything held. */
function makeReporter() {
  let ok = true;
  return {
    check(label, passed, detail) {
      ok = ok && passed;
      console.log(`  ${passed ? 'pass' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
    },
    finish(session) {
      if (session && session.consoleErrors.length) {
        console.log('\nconsole errors:');
        for (const e of session.consoleErrors.slice(0, 4)) console.log('  ' + e.slice(0, 200));
      }
      process.exit(ok ? 0 : 1);
    }
  };
}

module.exports = { buildDriveProject, makeReporter, REPO_ROOT };
