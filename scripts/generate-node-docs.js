/**
 * ALPHA-006 §3 — the generated node reference.
 *
 * One page per node in `node-catalog-enriched.json`, grouped by the picker's own
 * `category` field (not the old `opennoodl-docs` site's tree, which disagreed
 * with the picker — e.g. `Button` was `ui-controls` there and `Visual` here).
 * Reads the same artifact `nodeDocs.ts` reads for the in-editor help panel, so
 * the site and the editor render two views of one document and cannot drift
 * apart the way the old fetched-markdown pages could.
 *
 * `docs-site/docs/nodes/` is entirely generated output: this script deletes and
 * rewrites it from scratch every run rather than diffing in place, so a node
 * that's renamed or removed can't leave an orphaned page behind.
 *
 *   node scripts/generate-node-docs.js          # regenerate docs-site/docs/nodes
 *   node scripts/generate-node-docs.js --check   # fail if the committed pages are stale
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'packages/noodl-types/src/node-catalog-enriched.json');
const STRUCTURAL_CATALOG_PATH = path.join(ROOT, 'packages/noodl-types/src/node-catalog.json');
const OUT_DIR = path.join(ROOT, 'docs-site/docs/nodes');

/**
 * 🔴 FB-025 lane, 2026-08-27 — **this script grades an input it does not produce, and nothing
 * here used to notice when that input was stale.**
 *
 * The pipeline is two steps: `catalog:generate` writes `node-catalog.json` from the live
 * registries, and `catalog:merge` folds the authored enrichment into
 * `node-catalog-enriched.json`. This script reads only the **second** file. So a sweep that ran
 * `catalog:generate` and not `catalog:merge` left the enriched catalog describing the *previous*
 * registries, and `docs:nodes:check` compared pages generated from that stale artifact against
 * pages generated from the same stale artifact and reported **clean** — a green tick on a
 * question it had not asked.
 *
 * ⚠️ Measured rather than argued, 2026-08-27: mutating a `docs` field of one node in
 * `node-catalog.json` and re-running `docs:nodes:check` printed *"clean. 194 generated files
 * match 175 catalog nodes"*. `catalog:merge:check` caught the same mutation — so the sweep as a
 * whole was not blind — but a docs gate that cannot see its own input is stale is one that only
 * works while somebody remembers to run a different one beside it.
 *
 * The comparison below is exact rather than a heuristic, because `merge.js` copies the
 * structural nodes through verbatim: `nodes: catalog.nodes.map((n) => ({ ...n, enrichment }))`.
 * Stripping `enrichment` therefore has to give back `node-catalog.json` exactly, and any
 * difference at all means the merge has not been run since the catalog moved.
 *
 * ⚠️ A missing `node-catalog.json` is an **error, not a skip**. A guard that quietly stands down
 * when it cannot run reinstates precisely the green-on-an-unasked-question this exists to stop.
 */
class StaleCatalogError extends Error {}

function assertEnrichedCatalogIsFresh(enriched, structuralPath = STRUCTURAL_CATALOG_PATH) {
  const rel = path.relative(ROOT, structuralPath);
  if (!fs.existsSync(structuralPath)) {
    throw new StaleCatalogError(
      `${rel} is missing, so the enriched catalog's freshness cannot be checked. ` +
        'Run `npm run catalog:generate`.'
    );
  }

  let structural;
  try {
    structural = JSON.parse(fs.readFileSync(structuralPath, 'utf8'));
  } catch (err) {
    throw new StaleCatalogError(
      `${rel} could not be parsed, so the enriched catalog's freshness cannot be checked: ${err.message}`
    );
  }

  // Key order differs harmlessly between the two files, so compare canonically by sorted keys.
  const canonical = (value) =>
    JSON.stringify(value, (_key, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
        : v
    );

  const enrichedByType = new Map((enriched.nodes || []).map((n) => [n.typeName, n]));
  const structuralByType = new Map((structural.nodes || []).map((n) => [n.typeName, n]));

  const missing = [...structuralByType.keys()].filter((t) => !enrichedByType.has(t));
  const extra = [...enrichedByType.keys()].filter((t) => !structuralByType.has(t));
  const changed = [];
  for (const [typeName, structuralNode] of structuralByType) {
    const enrichedNode = enrichedByType.get(typeName);
    if (!enrichedNode) continue;
    // eslint-disable-next-line no-unused-vars
    const { enrichment, ...withoutEnrichment } = enrichedNode;
    if (canonical(withoutEnrichment) !== canonical(structuralNode)) changed.push(typeName);
  }

  if (!missing.length && !extra.length && !changed.length) return;

  const detail = [
    missing.length ? `${missing.length} node(s) absent from it (${missing.slice(0, 5).join(', ')})` : null,
    extra.length ? `${extra.length} node(s) it still lists (${extra.slice(0, 5).join(', ')})` : null,
    changed.length ? `${changed.length} node(s) differing (${changed.slice(0, 5).join(', ')})` : null
  ]
    .filter(Boolean)
    .join('; ');

  throw new StaleCatalogError(
    `Stale enriched catalog: ${path.relative(ROOT, CATALOG_PATH)} does not match ${rel} — ${detail}. ` +
      'The docs are generated from the enriched catalog, so generating or checking them now would ' +
      'grade the previous registries. Run `npm run catalog:merge` and commit the result.'
  );
}

function slugify(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

function escapeMd(text) {
  return String(text ?? '').replace(/\|/g, '\\|');
}

function formatType(type) {
  if (!type) return '—';
  if (type.name === 'enum' && Array.isArray(type.enums)) {
    return `Enum (${type.enums.map((e) => `\`${e.value}\``).join(', ')})`;
  }
  if (type.name === 'signal') return 'Signal';
  const label = type.name.charAt(0).toUpperCase() + type.name.slice(1);
  if (type.identifierOf) return `${label} (${type.identifierOf} id)`;
  return label;
}

function formatDefault(port) {
  if (port.default === undefined) return '—';
  if (typeof port.default === 'object') return `\`${JSON.stringify(port.default)}\``;
  return `\`${port.default}\``;
}

function isFailurePort(port) {
  return port.group === 'Error' || /error|failure|fail\b/i.test(port.name);
}

function portTable(ports) {
  if (!ports.length) return '_None._\n';
  const rows = ports.map(
    (p) => `| \`${escapeMd(p.name)}\` | ${formatType(p.type)} | ${formatDefault(p)} | ${escapeMd(p.description || '—')} |`
  );
  return ['| Name | Type | Default | Description |', '|---|---|---|---|', ...rows].join('\n') + '\n';
}

function renderPortsSection(title, ports) {
  if (!ports.length) return '';
  const values = ports.filter((p) => !p.isSignal && !isFailurePort(p));
  const signals = ports.filter((p) => p.isSignal && !isFailurePort(p));
  const failures = ports.filter((p) => isFailurePort(p));

  const parts = [`## ${title}\n`];
  if (values.length) parts.push(`### Values\n\n${portTable(values)}`);
  if (signals.length) parts.push(`### Signals\n\n${portTable(signals)}`);
  if (failures.length) parts.push(`### Failure outputs\n\n${portTable(failures)}`);
  return parts.join('\n');
}

function renderDynamicPorts(dynamicPorts) {
  if (!dynamicPorts) return '';
  const parts = [
    '## Dynamic ports\n',
    `_This node's port list changes at runtime (${dynamicPorts.mechanisms.join(', ')}); the tables above may be incomplete for a given instance._\n`
  ];
  if (dynamicPorts.description) parts.push(`${dynamicPorts.description}\n`);
  if (Array.isArray(dynamicPorts.declaredPortGroups) && dynamicPorts.declaredPortGroups.length) {
    const rows = dynamicPorts.declaredPortGroups.map(
      (g) =>
        `| ${escapeMd(g.condition || '—')} | ${(g.inputs || []).map((n) => `\`${n}\``).join(', ') || '—'} | ${
          (g.outputs || []).map((n) => `\`${n}\``).join(', ') || '—'
        } |`
    );
    parts.push(
      ['| Condition | Inputs shown | Outputs shown |', '|---|---|---|', ...rows].join('\n') + '\n'
    );
  }
  return parts.join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

  // Both modes, deliberately: writing pages from a stale enriched catalog is the worse half of
  // the defect, because it bakes the staleness into the committed pages and `--check` then
  // agrees with them.
  assertEnrichedCatalogIsFresh(catalog);

  const nodesByTypeName = new Map(catalog.nodes.map((n) => [n.typeName, n]));
  const examplesById = new Map((catalog.examples || []).map((e) => [e.id, e]));

  // typeName -> { category, slug } so "related nodes" can link across categories.
  const linkIndex = new Map();
  for (const node of catalog.nodes) {
    linkIndex.set(node.typeName, { categorySlug: slugify(node.category || 'uncategorised'), slug: slugify(node.typeName) });
  }

  const categories = new Map(); // categorySlug -> { label, nodes: [] }
  for (const node of catalog.nodes) {
    const label = node.category || 'Uncategorised';
    const catSlug = slugify(label);
    if (!categories.has(catSlug)) categories.set(catSlug, { label, nodes: [] });
    categories.get(catSlug).nodes.push(node);
  }
  for (const cat of categories.values()) {
    cat.nodes.sort((a, b) => (a.displayName || a.typeName).localeCompare(b.displayName || b.typeName));
  }
  const sortedCategorySlugs = [...categories.keys()].sort((a, b) =>
    categories.get(a).label.localeCompare(categories.get(b).label)
  );

  /** @type {Map<string, string>} relative path (posix) -> file content */
  const files = new Map();

  const GENERATED_NOTE =
    '\n:::info Generated\nThis page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.\n:::\n';

  files.set('_category_.json', JSON.stringify({ label: 'Node reference', position: 3, link: { type: 'doc', id: 'index' } }, null, 2) + '\n');

  const indexLines = [
    '---',
    'title: Node reference',
    '---',
    '',
    `Every node in the catalog — ${catalog.nodes.length} in total — generated from the same`,
    'enriched catalog the editor reads for its own in-editor help. Grouped by picker category.',
    GENERATED_NOTE,
    ''
  ];
  for (const catSlug of sortedCategorySlugs) {
    const cat = categories.get(catSlug);
    indexLines.push(`## ${cat.label}\n`);
    for (const node of cat.nodes) {
      const deprecated = node.isDeprecated ? ' _(deprecated)_' : '';
      indexLines.push(`- [${node.displayName || node.typeName}](./${catSlug}/${slugify(node.typeName)}.md)${deprecated}`);
    }
    indexLines.push('');
  }
  files.set('index.md', indexLines.join('\n'));

  for (const catSlug of sortedCategorySlugs) {
    const cat = categories.get(catSlug);
    files.set(
      `${catSlug}/_category_.json`,
      JSON.stringify({ label: cat.label, position: sortedCategorySlugs.indexOf(catSlug) + 1 }, null, 2) + '\n'
    );

    for (const node of cat.nodes) {
      const e = node.enrichment || {};
      const slug = slugify(node.typeName);
      const parts = [];

      parts.push('---');
      parts.push(`title: ${JSON.stringify(node.displayName || node.typeName)}`);
      parts.push('---');
      parts.push('');

      if (node.isDeprecated) {
        parts.push(
          ':::warning Deprecated\nThis node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.\n:::\n'
        );
      } else if (!node.inNodePicker) {
        parts.push(':::note\nThis node is not offered directly in the node picker.\n:::\n');
      }

      if (e.summary) parts.push(`${e.summary}\n`);
      if (e.description) parts.push(`${e.description}\n`);
      if (e.whenToUse) parts.push(`## When to use it\n\n${e.whenToUse}\n`);

      const meta = [
        `| | |`,
        `|---|---|`,
        `| Category | ${escapeMd(cat.label)} |`,
        `| Type name | \`${node.typeName}\` |`,
        `| Available in | ${(node.availableIn || []).join(', ') || '—'} |`,
        `| SSR compatibility | ${node.ssr ? node.ssr.compat + (node.ssr.note ? ` — ${node.ssr.note}` : '') : '—'} |`,
        `| Provided by | \`${node.providedBy || '—'}\` |`
      ];
      parts.push(`## At a glance\n\n${meta.join('\n')}\n`);

      parts.push(renderPortsSection('Inputs', node.inputs || []));
      parts.push(renderPortsSection('Outputs', node.outputs || []));
      parts.push(renderDynamicPorts(node.dynamicPorts));

      if (e.runtimeBehavior) parts.push(`## Ports at runtime\n\n${e.runtimeBehavior}\n`);
      if (Array.isArray(e.patterns) && e.patterns.length) {
        parts.push(`## Patterns\n\n${e.patterns.map((p) => `- ${p}`).join('\n')}\n`);
      }
      if (Array.isArray(e.antiPatterns) && e.antiPatterns.length) {
        parts.push(`## Watch out for\n\n${e.antiPatterns.map((p) => `- ${p}`).join('\n')}\n`);
      }
      if (Array.isArray(e.examples) && e.examples.length) {
        const examples = e.examples.map((id) => examplesById.get(id)).filter(Boolean);
        if (examples.length) {
          parts.push(
            `## Examples\n\n${examples.map((ex) => `**${ex.title}**\n\n${ex.description}`).join('\n\n')}\n`
          );
        }
      }
      if (Array.isArray(e.relatedNodes) && e.relatedNodes.length) {
        const links = e.relatedNodes
          .map((typeName) => {
            const target = nodesByTypeName.get(typeName);
            const loc = linkIndex.get(typeName);
            if (!target || !loc) return null;
            const rel = loc.categorySlug === catSlug ? `./${loc.slug}.md` : `../${loc.categorySlug}/${loc.slug}.md`;
            return `[${target.displayName || typeName}](${rel})`;
          })
          .filter(Boolean);
        if (links.length) parts.push(`## Related nodes\n\n${links.join(', ')}\n`);
      }

      parts.push(GENERATED_NOTE);

      files.set(`${catSlug}/${slug}.md`, parts.filter((p) => p !== '').join('\n'));
    }
  }

  if (check) {
    const problems = [];
    const existing = listExistingFiles(OUT_DIR);
    for (const [rel, content] of files) {
      const onDisk = path.join(OUT_DIR, rel);
      if (!fs.existsSync(onDisk)) {
        problems.push(`missing: ${rel}`);
      } else if (fs.readFileSync(onDisk, 'utf8') !== content) {
        problems.push(`stale: ${rel}`);
      }
      existing.delete(rel);
    }
    for (const rel of existing) problems.push(`orphaned: ${rel}`);

    if (problems.length) {
      console.error(`docs:nodes:check — ${problems.length} problem(s). Run \`npm run docs:nodes\` and commit the result.`);
      for (const p of problems.slice(0, 50)) console.error(`  ${p}`);
      if (problems.length > 50) console.error(`  … and ${problems.length - 50} more`);
      process.exit(1);
    }
    console.log(`docs:nodes:check — clean. ${files.size} generated files match ${catalog.nodes.length} catalog nodes.`);
    return;
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  for (const [rel, content] of files) {
    const dest = path.join(OUT_DIR, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  console.log(`docs:nodes — wrote ${files.size} files for ${catalog.nodes.length} nodes across ${categories.size} categories.`);
}

function listExistingFiles(dir) {
  const out = new Set();
  if (!fs.existsSync(dir)) return out;
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), rel);
      else out.add(rel);
    }
  };
  walk(dir, '');
  return out;
}

if (require.main === module) {
  runCli();
}

module.exports = { assertEnrichedCatalogIsFresh, StaleCatalogError };

function runCli() {
  try {
    main();
  } catch (err) {
  // Only this one is reported as a message: anything else is a defect in this script and keeps
  // its stack trace.
    if (!(err instanceof StaleCatalogError)) throw err;
    console.error(err.message);
    process.exit(1);
  }
}
