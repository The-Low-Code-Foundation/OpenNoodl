#!/usr/bin/env node
/**
 * LAS-004 §2 — the corpus census that picks the oversized-page threshold.
 *
 * The doctrine says ~25 nodes. LAS-004 says the corpus wins if it disagrees, and
 * that the count must be the page's OWN nodes (a component instance counts as 1,
 * because a page of six instances is the ideal shape, not the offence).
 *
 * A "page" is a component holding a `Page` node — the runtime's own definition
 * (`exporter/router.ts::_getPageInfo` builds the page index exclusively from
 * them), and the same one `checkPageShape` uses.
 *
 * Usage: node .../scan-page-size.js [--list]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../../..');
const EXTRA_ROOTS = [path.resolve(REPO, '../NodeGX test projects')];
const LIST = process.argv.includes('--list');
const PAGE_NODE_TYPE = 'Page';

function walk(dir, out, depth = 0) {
  if (depth > 12) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (e.name === 'project.json' || e.name === 'nodegx.project.json') out.push(p);
  }
  return out;
}

const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function componentsOf(file) {
  if (path.basename(file) === 'nodegx.project.json') {
    const root = path.dirname(file);
    const project = readJSON(file);
    const dir = path.join(root, (project.structure && project.structure.componentsDir) || 'components');
    let registry;
    try {
      registry = readJSON(path.join(dir, '_registry.json'));
    } catch {
      return [];
    }
    const out = [];
    for (const key of Object.keys(registry.components || {})) {
      const cdir = path.join(dir, registry.components[key].path);
      try {
        const meta = readJSON(path.join(cdir, 'component.json'));
        out.push({ name: meta.path || '/' + key, nodes: readJSON(path.join(cdir, 'nodes.json')).nodes || [] });
      } catch {
        /* one fewer component */
      }
    }
    return out;
  }
  const data = readJSON(file);
  if (!Array.isArray(data.components)) return [];
  return data.components.map((c) => {
    const flat = [];
    const visit = (n) => {
      flat.push(n);
      for (const k of n.children || []) visit(k);
    };
    for (const r of (c.graph && c.graph.roots) || []) visit(r);
    return { name: c.name, nodes: flat };
  });
}

const files = [];
walk(REPO, files);
for (const extra of EXTRA_ROOTS) walk(extra, files);

const pages = [];
for (const file of files) {
  let components;
  try {
    components = componentsOf(file);
  } catch {
    continue;
  }
  const rel = path.relative(REPO, file);
  for (const c of components) {
    if (!c.nodes.some((n) => n.type === PAGE_NODE_TYPE)) continue;
    pages.push({ where: `${rel} :: ${c.name}`, count: c.nodes.length });
  }
}

pages.sort((a, b) => b.count - a.count);
const counts = pages.map((p) => p.count).sort((a, b) => a - b);
const at = (q) => counts[Math.min(counts.length - 1, Math.floor(q * counts.length))];

console.log(`page components: ${pages.length}`);
console.log(`min ${counts[0]} · median ${at(0.5)} · p75 ${at(0.75)} · p90 ${at(0.9)} · p95 ${at(0.95)} · max ${counts[counts.length - 1]}`);
for (const t of [20, 25, 30, 35, 40, 50, 66]) {
  const over = pages.filter((p) => p.count > t);
  console.log(`  > ${String(t).padStart(3)} nodes: ${String(over.length).padStart(3)} pages (${((100 * over.length) / pages.length).toFixed(1)}%)`);
}
if (LIST) {
  console.log('\n── largest pages ──');
  for (const p of pages.slice(0, 40)) console.log(`${String(p.count).padStart(4)}  ${p.where}`);
}
