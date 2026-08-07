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

async function buildType(type, ajv) {
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
      ...(meta.runtimeVersion ? { runtimeVersion: meta.runtimeVersion } : {})
    });
  }

  fs.mkdirSync(outTypeDir, { recursive: true });
  fs.writeFileSync(path.join(outTypeDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`${type}: built ${index.length} entries -> ${path.relative(REPO_ROOT, outTypeDir)}/`);
}

async function main() {
  const ajv = new Ajv({ allErrors: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const type of TYPES) {
    await buildType(type, ajv);
  }
  console.log(`\nBuilt library-dist at ${path.relative(REPO_ROOT, OUT_DIR)}/`);
  console.log('Publish: copy its contents over the docs repo\'s library/ path (see library/README.md).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
