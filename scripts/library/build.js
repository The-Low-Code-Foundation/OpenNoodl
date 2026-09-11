#!/usr/bin/env node
/**
 * LIB-001 — npm run library:build
 *
 * Reads library/{prefabs,modules}/<slug>/{library.json,project/,icon.*} and
 * produces library-dist/, a tree that mirrors the docs repo's `library/` path
 * 1:1 (publishing is copying library-dist/* over it — see library/README.md):
 *
 *   library-dist/<type>/index.json          — the editor-facing index
 *   library-dist/<type>/<slug>-<version>.zip — the project, zipped
 *   library-dist/<type>/<slug>-<version>.<ext> — the icon, if any
 *
 * Both the zip and the icon filenames carry the entry's content version, so a
 * version bump changes the URL — which is what makes the editor's
 * "never re-download a non-empty cache folder" behaviour correct instead of a
 * trap (see modulelibrarymodel.ts:getModuleTemplateRoot).
 *
 * Usage: node scripts/library/build.js [--out <dir>]
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const Ajv = require('ajv');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

const outArgIdx = process.argv.indexOf('--out');
const OUT_DIR = outArgIdx !== -1 ? path.resolve(process.argv[outArgIdx + 1]) : path.join(REPO_ROOT, 'library-dist');

const TYPES = ['prefabs', 'modules'];

function listEntries(type) {
  const dir = path.join(LIBRARY_DIR, type);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/**
 * LBR-007 — every entry on disk, keyed "<type>/<slug>", so `dependencies` can be
 * resolved across the prefab/module boundary before either index is written.
 *
 * Read in one pass rather than per type because a module may depend on a prefab
 * and vice versa, and `buildType` only ever sees one type's directory.
 */
function loadAllEntries() {
  const all = new Map();
  for (const type of TYPES) {
    for (const slug of listEntries(type)) {
      const metaPath = path.join(LIBRARY_DIR, type, slug, 'library.json');
      if (!fs.existsSync(metaPath)) continue; // buildType raises the real error
      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch (err) {
        throw new Error(`${type}/${slug}: library.json is not valid JSON: ${err.message}`);
      }
      all.set(`${type}/${slug}`, { type, slug, meta });
    }
  }
  return all;
}

/**
 * LBR-007 — the flat, dependency-first install list published for one entry.
 *
 * The authored field is a list of `"<type-dir>/<slug>"` strings naming DIRECT
 * dependencies. This flattens the transitive closure into the order an
 * installer should walk (a dependency always precedes everything that needs
 * it), deduplicates, and resolves each to the descriptor the editor installs
 * from — `project` is the same versioned zip path the entry's own index row
 * carries, because the whole index is rebuilt in one run and cannot disagree
 * with itself.
 *
 * 🔴 **Resolution is a build-time job on purpose.** The alternative — shipping
 * the slugs and resolving in the editor — would make the installer derive a
 * slug back out of `library/modules/custom-html-1.0.2.zip`, require the OTHER
 * tab's index to have been fetched before a cross-type dependency could be
 * installed, and put graph-walking in the click path. Here, an unknown slug or
 * a cycle fails `library:build` loudly, before anything is published.
 */
function resolveDependencies(key, all, stack = []) {
  const entry = all.get(key);
  const declared = (entry.meta.dependencies || []).slice();
  const out = [];
  const seen = new Set();

  for (const dep of declared) {
    if (dep === key) {
      throw new Error(`${key}: library.json lists itself in "dependencies"`);
    }
    if (stack.includes(dep)) {
      throw new Error(`dependency cycle: ${[...stack, key, dep].join(' -> ')}`);
    }
    const target = all.get(dep);
    if (!target) {
      throw new Error(
        `${key}: library.json depends on "${dep}", which is not an entry on disk ` +
          `(expected library/${dep}/library.json). Dependencies are written "<type-dir>/<slug>", e.g. "modules/custom-html".`
      );
    }
    // Post-order: the dependency's own dependencies come out before it does.
    for (const nested of resolveDependencies(dep, all, [...stack, key])) {
      if (!seen.has(nested.key)) {
        seen.add(nested.key);
        out.push(nested);
      }
    }
    if (!seen.has(dep)) {
      seen.add(dep);
      out.push({
        key: dep,
        label: target.meta.label,
        // Singular, matching the entry's own `type` field, which is what the
        // editor branches on to choose prefab vs module install semantics.
        type: target.meta.type,
        project: `library/${target.type}/${target.slug}-${target.meta.version}.zip`,
        version: target.meta.version,
        ...(target.meta.minEditorVersion ? { minEditorVersion: target.meta.minEditorVersion } : {})
      });
    }
  }

  return out;
}

function zipDirectory(srcDir, destZipPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destZipPath), { recursive: true });
    const output = fs.createWriteStream(destZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

async function buildType(type, ajv, all) {
  const validate = ajv.compile(SCHEMA);
  const entries = listEntries(type);
  const index = [];
  const outTypeDir = path.join(OUT_DIR, type);
  fs.rmSync(outTypeDir, { recursive: true, force: true });

  for (const slug of entries) {
    const entryDir = path.join(LIBRARY_DIR, type, slug);
    const metaPath = path.join(entryDir, 'library.json');
    if (!fs.existsSync(metaPath)) {
      throw new Error(`${type}/${slug}: missing library.json`);
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!validate(meta)) {
      const msgs = validate.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('; ');
      throw new Error(`${type}/${slug}: library.json failed schema validation: ${msgs}`);
    }

    const projectDir = path.join(entryDir, 'project');
    if (!fs.existsSync(path.join(projectDir, 'project.json')) && !fs.existsSync(path.join(projectDir, 'components'))) {
      throw new Error(`${type}/${slug}: project/ has no project.json and no v2 components/ directory`);
    }

    // LBR-007 — resolved BEFORE the zip is written so an unresolvable
    // dependency fails the build rather than half-populating library-dist.
    const dependencies = resolveDependencies(`${type}/${slug}`, all);

    const zipName = `${slug}-${meta.version}.zip`;
    await zipDirectory(projectDir, path.join(outTypeDir, zipName));

    let iconOut;
    if (meta.icon) {
      const iconSrc = path.join(entryDir, meta.icon);
      if (!fs.existsSync(iconSrc)) {
        throw new Error(`${type}/${slug}: library.json references icon "${meta.icon}" which does not exist`);
      }
      const ext = path.extname(meta.icon) || '.png';
      iconOut = `${slug}-${meta.version}${ext}`;
      fs.mkdirSync(outTypeDir, { recursive: true });
      fs.copyFileSync(iconSrc, path.join(outTypeDir, iconOut));
    }

    index.push({
      label: meta.label,
      desc: meta.description,
      project: `library/${type}/${zipName}`,
      ...(iconOut ? { icon: `library/${type}/${iconOut}` } : {}),
      docs: meta.docsPath || `/library/${type}/${slug}/`,
      tags: meta.tags || [],
      type: meta.type,
      version: meta.version,
      ...(meta.minEditorVersion ? { minEditorVersion: meta.minEditorVersion } : {}),
      ...(meta.runtimeVersion ? { runtimeVersion: meta.runtimeVersion } : {}),
      // LBR-007. Omitted entirely when there are none, so an entry without
      // dependencies publishes byte-identical rows to before this existed.
      ...(dependencies.length ? { dependencies } : {})
    });
  }

  fs.mkdirSync(outTypeDir, { recursive: true });
  fs.writeFileSync(path.join(outTypeDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`${type}: built ${index.length} entries -> ${path.relative(REPO_ROOT, outTypeDir)}/`);
}

async function main() {
  const ajv = new Ajv({ allErrors: true });
  const all = loadAllEntries();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const type of TYPES) {
    await buildType(type, ajv, all);
  }
  console.log(`\nBuilt library-dist at ${path.relative(REPO_ROOT, OUT_DIR)}/`);
  console.log('Publish: copy its contents over the docs repo\'s library/ path (see library/README.md).');
}

// LBR-007: guarded so `resolveDependencies` can be exercised from a plain-Node
// harness without building (and deleting) library-dist as a side effect of the
// require. `npm run library:build` runs this file directly, so it is unchanged.
if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { loadAllEntries, resolveDependencies };
