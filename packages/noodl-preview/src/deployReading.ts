/**
 * HLS-015 — reading a written deploy folder, and deciding whether it is an app.
 *
 * 🔴 **This module imports `fs` and `path` and nothing else, and that is the point.** Everything
 * else in the deploy engine drags in `ProjectModel`, `NodeLibrary` and the browser runtime's node
 * register — a graph that needs four esbuild shims to load at all and cannot be required from a
 * plain ts-jest runner. The decision that decides whether a deploy is refused must be gradeable
 * without any of that, so it lives here on its own, the way HLS-013 put the cloud deploy's
 * decision in `cloudDeployCore.ts` for the same measured reason.
 *
 * What it decides is register row **C67**: an export made with an unpopulated node library keeps
 * every component, every node and **93 of 93 connections**, and empties every `roots` array —
 * after which `ComponentInstanceNode.render()` returns `null` and the page is blank, while the
 * deploy reports success. `tests/hls015-drive.mjs` performs both arms in a real Chrome and reads
 * 1,881 characters against 0; `tests/deploy.test.ts` grades the rows here in milliseconds.
 *
 * @module noodl-preview/deployReading
 */
import * as fs from 'fs';
import * as path from 'path';

/** What one component contributed to the deployed export. */
export interface RootsReading {
  /** Components found across `window.projectData` and every lazily-fetched bundle. */
  components: number;
  /** Components carrying at least one entry in `roots`. */
  withRoots: number;
  /** The names of the ones that do not, so a refusal can name them rather than count them. */
  withoutRoots: string[];
  /** `json.rootComponent` — the component the runtime starts at. */
  rootComponent: string | null;
  /** Whether that component is one of the ones with a root. */
  rootComponentRenders: boolean;
  /** The hashed export file the reading was taken from. */
  indexJs: string;
  /**
   * HLS-014 — bundle files present in `noodl_bundles/` that the served export does not name.
   *
   * A redeploy writes a new hashed bundle beside the old one and deletes neither, so on the
   * second deploy of a project this is the previous deploy's copy of every page that changed.
   * The runtime never fetches them; a reading that walks the directory does, and counts the same
   * component twice.
   */
  staleBundles: string[];
}

/**
 * Which `index-*.js` is the one the site actually serves?
 *
 * 🔴 **HLS-014.** This used to be `readdirSync(outDir).find(/^index-.*\.js$/)`, and a folder that
 * has only ever been deployed into once holds exactly one, so that read was right every time
 * anybody looked. A **second** deploy writes a second hashed export beside the first and deletes
 * nothing, and `find` returns whichever entry the directory happens to hand back first — measured
 * on a real redeploy: `index.html` pointed at `index-b529d76…js` and the reading took
 * `index-842da82…js`, **the previous deploy's**. Every reading built on it — including the
 * blank-site refusal HLS-015 exists for — was then a statement about an app that is no longer
 * being served.
 *
 * So the entry is resolved the way a browser resolves it: from `index.html`. `--base-url` puts a
 * prefix on that src, so only the basename is taken.
 */
function resolveEntry(outDir: string): string {
  const indexHtml = path.join(outDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    const html = fs.readFileSync(indexHtml, 'utf8');
    const match = /<script[^>]+src="([^"]*\/)?(index-[^"/]+\.js)"/.exec(html);
    if (match) return match[2];
    throw new Error(`${outDir}/index.html names no index-*.js — the deploy wrote no export.`);
  }

  // No index.html. One candidate is unambiguous and several are not, and guessing between several
  // is exactly the thing above. A folder with two exports and no page naming one of them is not a
  // site, and saying so is cheaper than being right by luck.
  const candidates = fs.readdirSync(outDir).filter((file) => /^index-.*\.js$/.test(file));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    throw new Error(`${outDir} holds no index-*.js — the deploy wrote no export.`);
  }
  throw new Error(
    `${outDir} holds ${candidates.length} index-*.js files and no index.html to say which one is ` +
      `served (${candidates.sort().join(', ')}). Deploy again into this folder to rewrite it.`
  );
}

/**
 * Pulls `window.projectData` back out of the hashed export file.
 *
 * The export is spliced into a JavaScript file as a literal, so there is nothing to `require` and
 * nothing to parse as JSON without first finding where the object ends. A brace walk that
 * understands string escapes is the whole of it.
 */
function projectData(outDir: string): { indexJs: string; data: TSFixme } {
  const indexJs = resolveEntry(outDir);
  const source = fs.readFileSync(path.join(outDir, indexJs), 'utf8');
  const marker = source.indexOf('window.projectData');
  if (marker === -1) throw new Error(`${indexJs} carries no window.projectData.`);

  const start = source.indexOf('{', marker);
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const character = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') depth++;
    else if (character === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`${indexJs}'s window.projectData never closes.`);
  return { indexJs, data: JSON.parse(source.slice(start, end)) };
}

/**
 * Reads a written deploy folder and says how much of it can render.
 *
 * 🔴 This reads **the folder**, not the model that produced it. Everything upstream of the write
 * agreed the deploy succeeded in the arm that produced C67.
 */
export function readDeployedRoots(outDir: string): RootsReading {
  const { indexJs, data } = projectData(outDir);
  const reading: RootsReading = {
    components: 0,
    withRoots: 0,
    withoutRoots: [],
    rootComponent: data.rootComponent ?? null,
    rootComponentRenders: false,
    indexJs,
    staleBundles: []
  };

  const add = (components: TSFixme[]) => {
    for (const component of components ?? []) {
      reading.components++;
      if ((component.roots ?? []).length > 0) {
        reading.withRoots++;
        if (component.name === reading.rootComponent) reading.rootComponentRenders = true;
      } else {
        reading.withoutRoots.push(component.name ?? '(unnamed)');
      }
    }
  };

  add(data.components);

  // The bundled half. A project whose root component is lazily fetched keeps every root out of
  // `window.projectData`, so a reading that stopped here would report a blank app for a good one.
  //
  // 🔴 **HLS-014 — the bundles the EXPORT names, not the files in the directory.** `componentIndex`
  // is how the runtime decides what to fetch, so it is the only list that describes the app being
  // served. Walking the directory instead was right for exactly as long as no folder was ever
  // deployed into twice: measured on a real redeploy, `noodl_bundles/` held both
  // `b2-378e4cd…json` and `b2-6ac1955…json` — the same component `/Pages/Business` before and
  // after a one-word edit — and the reading reported **22 of 22** components for a 21-component
  // project. A count that grows with the number of times you have deployed is not a reading of
  // the app.
  const bundleDir = path.join(outDir, 'noodl_bundles');
  const named = Object.keys(data.componentIndex ?? {}).filter((id) => id !== 'root');
  for (const id of named) {
    const file = path.join(bundleDir, `${id}.json`);
    // A bundle the export names and the folder does not hold is a broken deploy, not a stale one —
    // the runtime will ask for it and get a 404. It has no roots to contribute, so the components
    // it carries go missing from the reading, which is the direction that refuses rather than the
    // direction that reassures.
    if (fs.existsSync(file)) {
      add(JSON.parse(fs.readFileSync(file, 'utf8')));
      continue;
    }
    for (const name of data.componentIndex[id]?.components ?? [id]) {
      reading.components++;
      reading.withoutRoots.push(`${name} (its bundle ${id}.json is not in the folder)`);
    }
  }
  if (fs.existsSync(bundleDir)) {
    const live = new Set(named.map((id) => `${id}.json`));
    reading.staleBundles = fs
      .readdirSync(bundleDir)
      .filter((file) => file.endsWith('.json') && !live.has(file))
      .sort();
  }
  return reading;
}

/**
 * Is the folder that was written an app?
 *
 * 🔴 **Not "does every component have a root".** A component with no root is a normal thing for a
 * project to contain — a logic-only helper, a component whose visual half is conditional — and a
 * gate on "no rootless component" would refuse correct answers. What C67 produces is categorical:
 * *nothing* renders. So the rule is the two statements that are actually equivalent to a blank
 * page: no component at all carries a root, or the component the runtime starts at does not.
 */
export function gradeRoots(reading: RootsReading): string | null {
  if (reading.components === 0) {
    return `The deployed export names no components at all (${reading.indexJs}).`;
  }
  if (reading.withRoots === 0) {
    return (
      `Not one of the ${reading.components} deployed components carries a root node, so every ` +
      'one of them renders nothing. This is what an export made with an unpopulated node library ' +
      'looks like: every file is written, every connection survives, and the page is blank.'
    );
  }
  if (reading.rootComponent && !reading.rootComponentRenders) {
    return (
      `The app starts at "${reading.rootComponent}" and that component carries no root node, so ` +
      `the first page is blank. ${reading.withRoots} of ${reading.components} other components do ` +
      'render.'
    );
  }
  return null;
}
