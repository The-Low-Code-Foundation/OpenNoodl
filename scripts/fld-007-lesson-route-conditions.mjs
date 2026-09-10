/**
 * FLD-007 — the sweep: every `viewerpatheq` condition in the shipped lesson set, and whether the
 * step that carries it could ever have ticked.
 *
 * AC3 asks for a number, not an adjective. The task file guessed that the truncating expression in
 * `CanvasView.ts:58` broke "every `viewerpatheq` condition on a query-less route, which is most of
 * them". It does not. Run this to see why:
 *
 *   node scripts/fld-007-lesson-route-conditions.mjs
 *
 * Two populations, both shipped:
 *
 *   - the eight **hosted** lessons, fetched from the content CDN (`getContentEndpoint()` →
 *     `nodegx-content/static`), which is where the legacy hand-authored HTML lessons live;
 *   - the **in-repo** bundles under `project-examples/lessons/<slug>/lesson.json`, whose
 *     `previewRouteEquals` compiles to the same internal verb (`models/lessonformat.ts:290`).
 *
 * For each condition it prints the authored path and the task sentence the learner is given. The
 * sentence is what decides reachability, because before this fix the global had **two** writers
 * with two meanings (`CanvasView.ts` line 58 truncating, line 200 not), and which one applied
 * depended on whether the step asks you to pick a route in the editor or to click something in the
 * running app. `--json` prints the rows instead, for a diff against a later run.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDN = 'https://the-low-code-foundation.github.io/nodegx-content/static/lessons';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLES = join(REPO, 'project-examples', 'lessons');

/** Every `data-conditions` payload in a legacy lesson's HTML, with the task text before it. */
function conditionsFromHtml(html, lesson) {
  const rows = [];
  const re = /data-conditions\s*=\s*(['"])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    let parsed;
    try {
      parsed = JSON.parse(m[2]);
    } catch {
      rows.push({ lesson, verb: 'UNPARSEABLE', path: m[2].slice(0, 80), task: '' });
      continue;
    }
    const conds = Array.isArray(parsed) ? parsed : [parsed];
    for (const c of conds) {
      if (!('viewerpatheq' in c)) continue;
      // The step is the whole segment between the `<!-- # -->` splitters `LessonModel.fetch()`
      // uses — not the text before the match, which would cut the tag the attribute sits in.
      const before = html.slice(0, m.index).lastIndexOf('<!-- # -->');
      const after = html.indexOf('<!-- # -->', m.index);
      const seg = html.slice(before === -1 ? 0 : before, after === -1 ? html.length : after);
      const task = seg
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(-160);
      rows.push({ lesson, verb: 'viewerpatheq', path: c.viewerpatheq, task });
    }
  }
  return rows;
}

/** The same verb in the declarative format, where it is authored as `previewRouteEquals`. */
function conditionsFromBundles() {
  const rows = [];
  if (!existsSync(BUNDLES)) return rows;
  for (const slug of readdirSync(BUNDLES)) {
    const manifest = join(BUNDLES, slug, 'lesson.json');
    if (!existsSync(manifest)) continue;
    const text = readFileSync(manifest, 'utf8');
    for (const m of text.matchAll(/"previewRouteEquals"\s*:\s*"([^"]*)"/g)) {
      rows.push({ lesson: `${slug} (bundle)`, verb: 'previewRouteEquals', path: m[1], task: '' });
    }
  }
  return rows;
}

const index = await (await fetch(`${CDN}/index.json`)).json();
const rows = [];
for (const entry of index) {
  const res = await fetch(`${CDN}/${entry.url}/lesson.html`);
  if (!res.ok) {
    console.error(`! ${entry.url}: HTTP ${res.status}`);
    continue;
  }
  rows.push(...conditionsFromHtml(await res.text(), entry.url));
}
const bundleRows = conditionsFromBundles();
rows.push(...bundleRows);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(`${index.length} hosted lessons; ${readdirSync(BUNDLES).filter((s) => existsSync(join(BUNDLES, s, 'lesson.json'))).length} in-repo bundles`);
  console.log(`${rows.length} route conditions (${bundleRows.length} of them in bundles)\n`);
  for (const r of rows) {
    console.log(`${r.lesson.padEnd(28)} ${r.path}`);
    if (r.task) console.log(`${' '.repeat(28)} task: …${r.task}`);
  }
}
