/**
 * Reads a folder written by `deployToFolder` and reports what the runtime would get.
 *
 * Usage: node measure-deploy.js <deploy-dir> [<project-dir>]
 *
 * 🔴 `roots` is the field that matters, not `connections`. An export built with an
 * unpopulated NodeLibrary keeps every connection and empties every `roots` array —
 * and `ComponentInstanceNode.render()` returns null when `roots` is empty
 * (noodl-runtime/src/nodes/componentinstance.ts:322). A connection count cannot
 * see that failure; this does.
 */
const fs = require('fs');
const path = require('path');

function projectData(outDir) {
  const js = fs.readdirSync(outDir).find((f) => /^index-.*\.js$/.test(f));
  if (!js) throw new Error(`no index-*.js in ${outDir}`);
  const src = fs.readFileSync(path.join(outDir, js), 'utf8');
  const start = src.indexOf('{', src.indexOf('window.projectData'));
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return { js, data: JSON.parse(src.slice(start, end)) };
}

function measure(outDir) {
  const { js, data } = projectData(outDir);
  const stats = { indexJs: js, components: 0, connections: 0, nodes: 0, withRoots: 0, withoutRoots: 0 };
  const add = (list) => {
    for (const c of list || []) {
      stats.components++;
      stats.connections += (c.connections || []).length;
      const walk = (n) => { stats.nodes++; (n.children || []).forEach(walk); };
      (c.nodes || []).forEach(walk);
      if ((c.roots || []).length > 0) stats.withRoots++; else stats.withoutRoots++;
    }
  };
  add(data.components);
  const bdir = path.join(outDir, 'noodl_bundles');
  if (fs.existsSync(bdir)) for (const f of fs.readdirSync(bdir)) add(JSON.parse(fs.readFileSync(path.join(bdir, f), 'utf8')));
  return stats;
}

function onDisk(projectDir) {
  const reg = JSON.parse(fs.readFileSync(path.join(projectDir, 'components', '_registry.json'), 'utf8'));
  let connections = 0, components = 0;
  for (const e of Object.values(reg.components || {})) {
    components++;
    const f = path.join(projectDir, 'components', e.path, 'connections.json');
    if (fs.existsSync(f)) connections += (JSON.parse(fs.readFileSync(f, 'utf8')).connections || []).length;
  }
  return { components, connections };
}

const [outDir, projectDir] = process.argv.slice(2);
const s = measure(outDir);
if (projectDir) {
  const d = onDisk(projectDir);
  console.log(`on disk : ${d.components} components, ${d.connections} connections`);
}
console.log(`deployed: ${s.components} components, ${s.connections} connections, ${s.nodes} nodes`);
console.log(`roots   : ${s.withRoots} component(s) WITH a root, ${s.withoutRoots} WITHOUT`);
console.log(s.withoutRoots > 0 ? '🔴 components with no root render null — the page is blank' : '✅ every component has a root');
