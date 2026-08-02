#!/usr/bin/env node
/**
 * LIB-001 — one-time seed of library/ from the live docs-site library.
 *
 * Downloads today's prefabs/modules index.json + every referenced project zip
 * + icon from the docs GitHub Pages endpoint, and unpacks each into
 * library/{prefabs,modules}/<slug>/ as tracked source:
 *   library/<type>/<slug>/project/    — unpacked project (project.json + assets)
 *   library/<type>/<slug>/icon.<ext>  — card icon, if the entry had one
 *   library/<type>/<slug>/library.json — metadata (see scripts/library/schema.json)
 *
 * Content is committed AS-IS — no repair, no restyling (that is LIB-002/003).
 * Each library.json carries a `provenance` block (source URL + import date) so
 * the seeding is auditable.
 *
 * This is a one-shot import script, not part of the regular build; re-running
 * it will overwrite existing seeded entries (an entry directory is deleted and
 * re-unpacked each time) but leaves entries with no matching live-index label
 * untouched. It is not wired into any npm script on purpose — running it again
 * is a deliberate, occasional action, not a build step.
 *
 * Usage: node scripts/library/seed-from-live.js [--type=prefabs|modules]
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');
const DOCS_ENDPOINT = 'https://the-low-code-foundation.github.io/opennoodl-docs';
const IMPORTED_AT = '2026-07-25';
// Best-known-good compatibility defaults for content seeded from the live
// (already-working-with-current-editor) library. LIB-002/003 may tighten
// these per-entry once each one is actually re-verified.
const DEFAULT_MIN_EDITOR_VERSION = '0.1.0';
const DEFAULT_RUNTIME_VERSION = '2.7.0';

function slugify(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

/**
 * Best-effort semver inference from the trailing version tail of a zip filename.
 *
 * Upstream uses both shapes: dash-separated (`chartjs-module-1-4-3`) and
 * dot-separated (`pdf-viewer-1.0.0`). The original pattern accepted only dashes
 * *and* did not require a separator before the tail, so it silently mis-read two
 * whole classes of name (found by the LIB-003 module audit):
 *
 *   pdf-viewer-1.0.0     → matched the bare trailing "0"   → 0.0.0  (want 1.0.0)
 *   shake-detector-1.0.2 → matched the bare trailing "2"   → 2.0.0  (want 1.0.2)
 *   oauth2-0-2           → matched "2-0-2", eating the "2" → 2.0.2  (want 0.2.0)
 *                          out of the *slug*
 *
 * Requiring a separator before the tail and accepting either separator inside it
 * fixes all three; every other seeded entry infers exactly as before.
 */
function inferVersion(projectUrl) {
  const base = path.basename(projectUrl, '.zip');
  const m = base.match(/[-._]v?(\d+(?:[-.]\d+){0,3})$/i) || base.match(/^v?(\d+(?:[-.]\d+){0,3})$/i);
  if (!m) return '0.0.0';
  const parts = m[1].split(/[-.]/).map((n) => parseInt(n, 10));
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3).join('.');
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function resolveUrl(maybeRelative) {
  return maybeRelative.startsWith('http') ? maybeRelative : `${DOCS_ENDPOINT}/${maybeRelative}`;
}

/** Zip junk that some of the live zips carry from being packed on macOS Finder. */
function isJunkZipEntry(relPath) {
  const base = path.basename(relPath);
  return relPath.startsWith('__MACOSX/') || relPath.includes('/__MACOSX/') || base === '.DS_Store' || base.startsWith('._');
}

async function unzipInto(zipBuf, destDir) {
  const zip = await JSZip.loadAsync(zipBuf);
  const entries = Object.entries(zip.files);
  for (const [relPath, file] of entries) {
    if (file.dir) continue;
    if (isJunkZipEntry(relPath)) continue;
    const dest = path.join(destDir, relPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const content = await file.async('nodebuffer');
    fs.writeFileSync(dest, content);
  }

  // Some zips wrap their content in a single top-level folder instead of
  // putting project.json at the archive root. Flatten that one level so
  // loadProject() (which expects project.json directly under the target
  // directory) works uniformly. (__MACOSX is stripped above, so a real
  // single-folder wrapper is detectable even when the archive also carried
  // Finder junk alongside it.)
  if (!fs.existsSync(path.join(destDir, 'project.json'))) {
    const topEntries = fs.readdirSync(destDir);
    if (topEntries.length === 1) {
      const onlyDir = path.join(destDir, topEntries[0]);
      if (fs.statSync(onlyDir).isDirectory() && fs.existsSync(path.join(onlyDir, 'project.json'))) {
        for (const inner of fs.readdirSync(onlyDir)) {
          fs.renameSync(path.join(onlyDir, inner), path.join(destDir, inner));
        }
        fs.rmdirSync(onlyDir);
      }
    }
  }
}

async function seedType(type) {
  const indexUrl = `${DOCS_ENDPOINT}/library/${type}/index.json`;
  console.log(`Fetching ${indexUrl}`);
  const res = await fetch(indexUrl);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${indexUrl}`);
  const entries = await res.json();

  const entryType = type === 'prefabs' ? 'prefab' : 'module';
  const seen = new Set();

  for (const entry of entries) {
    let slug = slugify(entry.label);
    if (seen.has(slug)) {
      let i = 2;
      while (seen.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    seen.add(slug);

    const entryDir = path.join(LIBRARY_DIR, type, slug);
    const projectDir = path.join(entryDir, 'project');
    fs.rmSync(entryDir, { recursive: true, force: true });
    fs.mkdirSync(projectDir, { recursive: true });

    const projectUrl = resolveUrl(entry.project);
    console.log(`[${type}] ${entry.label} <- ${projectUrl}`);
    const zipBuf = await downloadBuffer(projectUrl);
    await unzipInto(zipBuf, projectDir);

    let iconFile;
    if (entry.icon) {
      const iconUrl = resolveUrl(entry.icon);
      try {
        const iconBuf = await downloadBuffer(iconUrl);
        iconFile = 'icon' + (path.extname(entry.icon) || '.png');
        fs.writeFileSync(path.join(entryDir, iconFile), iconBuf);
      } catch (e) {
        console.warn(`  ! icon download failed (${iconUrl}): ${e.message}`);
      }
    }

    const meta = {
      label: entry.label,
      description: entry.desc || '',
      type: entryType,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      ...(iconFile ? { icon: iconFile } : {}),
      ...(entry.docs ? { docsPath: entry.docs } : {}),
      version: inferVersion(entry.project),
      minEditorVersion: DEFAULT_MIN_EDITOR_VERSION,
      runtimeVersion: DEFAULT_RUNTIME_VERSION,
      provenance: {
        sourceUrl: projectUrl,
        importedAt: IMPORTED_AT
      }
    };
    fs.writeFileSync(path.join(entryDir, 'library.json'), JSON.stringify(meta, null, 2) + '\n');
  }

  console.log(`${type}: seeded ${entries.length} entries.`);
}

async function main() {
  const typeArg = process.argv.find((a) => a.startsWith('--type='));
  const types = typeArg ? [typeArg.slice('--type='.length)] : ['prefabs', 'modules'];
  for (const type of types) {
    if (type !== 'prefabs' && type !== 'modules') {
      console.error(`Unknown --type value: ${type} (expected prefabs|modules)`);
      process.exit(2);
    }
    await seedType(type);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
