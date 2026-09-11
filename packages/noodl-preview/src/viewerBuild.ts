/**
 * EXP-017 — which build of the NodeGX viewer is this deploy about to publish?
 *
 * ## 🔴 The failure this file exists to refuse
 *
 * `nodegx deploy` copies `packages/noodl-editor/src/external/deploy/noodl.deploy.js` verbatim into
 * the folder a person uploads. That file is a build artifact and **two different commands write
 * it**:
 *
 * ```js
 * // webpack.deploy.prod.js   mode: "production"                                → 1.49 MB, 2 lines
 * // webpack.deploy.dev.js    mode: "development", devtool: "inline-source-map"  → 14.26 MB
 * ```
 *
 * On any checkout where `npm run dev` has ever run, the file on disk is the development one, and
 * **66% of it is a base64 source map of the entire NodeGX viewer source**, welded to the end as a
 * trailing comment. Before EXP-017 the deploy reported `39 entries` and exit 0 and said nothing at
 * all about which of the two it had picked up — so a contributor who ran `npm run dev:debug` in
 * the morning published the viewer's source to a public host in the afternoon without being told.
 *
 * ## 🔴 Why this reads the artefact and never the path that produced it
 *
 * EXP-017 AC3. The obvious classifier — *is there a `webpack.deploy.dev` watcher running*, *is the
 * mtime recent*, *which npm script ran last* — answers a question about **this machine's history**,
 * and the deploy's question is about **the bytes it is about to copy**. Those come apart in both
 * directions: a fresh clone that has never run `npm run dev` has a production bundle and no
 * history at all, and `NODEGX_DEPLOY_CLI` can point the whole command at another checkout's engine
 * whose history this process cannot see. So every reading below is taken from the file itself.
 *
 * Three readings, and they do not all carry the same weight — see {@link classifyViewerBuild}.
 *
 * @module noodl-preview/viewerBuild
 */
import * as fs from 'fs';

/**
 * The trailing comment webpack's `inline-source-map` devtool appends.
 *
 * ⚠️ **`//#`, and the tail, both matter.** The production bundle contains the string
 * `sourceMappingURL=data:` exactly once — inside css-loader's runtime, which *constructs* such a
 * URL at run time from a `/*#` prefix it builds by concatenation. A substring count finds it and
 * calls a clean production build a development one. The map that is actually welded on is a `//#`
 * line comment and it is the **last thing in the file**; both are checked.
 */
const SOURCE_MAP_MARKER = '//# sourceMappingURL=data:';

/**
 * Mean bytes per line above which a bundle is read as minified.
 *
 * Measured on the two real builds rather than chosen: the production bundle is **1,565,992 bytes
 * over 2 lines** — a `/*! For license information …` banner comment, then the whole program — and the
 * development one is 14,953,525 bytes over 110,716 lines, 135 bytes a line. Nearly four orders of
 * magnitude apart, so the threshold does not need to be delicate.
 *
 * ⚠️ **A mean, and not a line count, and the production bundle is why.** The obvious rule —
 * *minified means one line* — is already wrong about the file it was written for: webpack's
 * production build emits that banner above the code, so the artefact has two. A count would have
 * needed a fudge the day it was written; a mean does not care how many banner lines there are.
 */
const MINIFIED_MEAN_LINE_BYTES = 1000;

/** What the viewer bundle on disk turned out to be. */
export interface ViewerBuildReading {
  /** The file that was read. Absolute, and it is the file the deploy copies. */
  path: string;
  /** Its size on disk. */
  bytes: number;
  /** Lines, the way an editor numbers them: a trailing newline does not open another one. */
  lines: number;
  /**
   * Bytes of the **trailing** inline source map, or 0 when there is none.
   *
   * 🔴 This is the number EXP-017 AC2 requires a refusal to name. The size of the bundle is the
   * uninteresting half — somebody weighing "it is only bigger" overrides a size warning, and what
   * they would actually be overriding is publishing 9.88 MB of NodeGX source.
   */
  sourceMapBytes: number;
  /**
   * A `<bundle>.LICENSE.txt` beside it.
   *
   * webpack's production minifier extracts `/*!` banner comments into that sibling; a development
   * build leaves them inline and writes none. **Corroboration, never the verdict** — see
   * {@link classifyViewerBuild}.
   */
  licenseSibling: boolean;
  /** What the three readings add up to. */
  kind: 'production' | 'development';
  /** Every reading in the words a person is shown, most decisive first. */
  reasons: string[];
}

/** Human bytes, so a refusal and a summary say the same number the same way. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Turn three readings of one file into a verdict.
 *
 * 🔴 **Production is the conjunction, not the disjunction, and EXP-017 AC5 is why.** The mutant
 * that has to fail is *a development bundle with the map stripped off* — `node --check` passes on
 * it, it is 5 MB smaller, and it is still the unminified development build with every source
 * comment and identifier in it. A classifier that said "no map, therefore production" would pass
 * it. So a bundle is production only when it is **both** map-free **and** minified, and either
 * reading alone is enough to call it development.
 *
 * ⚠️ **`licenseSibling` decides nothing on its own**, in either direction. It is a real signal of
 * the production minifier having run, and it is also a file that survives on disk after a
 * development build overwrites the bundle beside it — this checkout had exactly that state. A
 * reading that can be stale is a reading that corroborates; it is reported, and it is not a vote.
 */
export function classifyViewerBuild(
  reading: Omit<ViewerBuildReading, 'kind' | 'reasons'>
): Pick<ViewerBuildReading, 'kind' | 'reasons'> {
  const meanLineBytes = reading.lines > 0 ? reading.bytes / reading.lines : reading.bytes;
  const minified = meanLineBytes >= MINIFIED_MEAN_LINE_BYTES;
  const reasons: string[] = [];

  if (reading.sourceMapBytes > 0) {
    reasons.push(
      `it ends with a ${formatBytes(reading.sourceMapBytes)} inline source map ` +
        `(${Math.round((reading.sourceMapBytes / reading.bytes) * 100)}% of the file), which is the ` +
        'NodeGX viewer source, base64-encoded'
    );
  } else {
    reasons.push('it carries no inline source map');
  }

  reasons.push(
    minified
      ? `it is minified — ${reading.lines.toLocaleString('en-US')} line(s) for ${formatBytes(reading.bytes)}`
      : `it is not minified — ${reading.lines.toLocaleString('en-US')} lines, ` +
          `${Math.round(meanLineBytes)} bytes a line, so the source is readable as it ships`
  );

  reasons.push(
    reading.licenseSibling
      ? 'a .LICENSE.txt sits beside it, which the production minifier writes'
      : 'there is no .LICENSE.txt beside it'
  );

  return { kind: reading.sourceMapBytes === 0 && minified ? 'production' : 'development', reasons };
}

/**
 * Read one viewer bundle and say what it is.
 *
 * Reads the whole file as a `Buffer` and scans it as bytes. A 15 MB `readFileSync` is the cheap
 * part of a command whose next act is to copy that same file, and scanning bytes rather than
 * decoding 15 MB of UTF-8 into a string keeps it under a few milliseconds.
 *
 * @throws if the bundle is not there. The caller already knows what a missing runtime means —
 *   `assertDeployRuntime` says it in a sentence a person can act on — so this does not restate it.
 */
export function readViewerBuild(bundlePath: string): ViewerBuildReading {
  const buffer = fs.readFileSync(bundlePath);
  const bytes = buffer.length;

  let newlines = 0;
  for (let index = 0; index < buffer.length; index++) {
    if (buffer[index] === 0x0a) newlines++;
  }
  // A file ending in `\n` has as many lines as it has newlines; one that does not has one more.
  const endsWithNewline = bytes > 0 && buffer[bytes - 1] === 0x0a;
  const lines = Math.max(1, endsWithNewline ? newlines : newlines + 1);

  // The LAST occurrence, and only when nothing but an optional final newline follows it. That is
  // what "welded to the end" means, and it is what separates the real map from a string literal.
  let sourceMapBytes = 0;
  const marker = buffer.lastIndexOf(SOURCE_MAP_MARKER);
  if (marker !== -1) {
    const end = endsWithNewline ? bytes - 1 : bytes;
    const newlineAfter = buffer.indexOf(0x0a, marker);
    if (newlineAfter === -1 || newlineAfter >= end) sourceMapBytes = Math.max(0, end - marker);
  }

  const reading = {
    path: bundlePath,
    bytes,
    lines,
    sourceMapBytes,
    licenseSibling: fs.existsSync(`${bundlePath}.LICENSE.txt`)
  };
  return { ...reading, ...classifyViewerBuild(reading) };
}

/** The one-line summary every run prints — EXP-017 AC1. */
export function summariseViewerBuild(reading: ViewerBuildReading): string {
  const map = reading.sourceMapBytes > 0 ? `, including a ${formatBytes(reading.sourceMapBytes)} inline source map` : '';
  return `${reading.kind} build of the NodeGX viewer, ${formatBytes(reading.bytes)}${map} — ${reading.path}`;
}

/**
 * The refusal — EXP-017 AC2.
 *
 * 🔴 **It leads with the source map and not with the size**, because those are two different
 * arguments and only one of them survives contact with somebody in a hurry. "Your site will be
 * 13 MB bigger" is a cost a person accepts; "you are about to publish the NodeGX viewer's source
 * code to a public host" is not a cost, it is a different act.
 */
export function describeDevelopmentEngine(reading: ViewerBuildReading, flag: string): string {
  const lines = [
    'This deploy would publish a DEVELOPMENT build of the NodeGX viewer, so nothing was written.',
    ''
  ];

  if (reading.sourceMapBytes > 0) {
    lines.push(
      `${reading.path} ends with a ${formatBytes(reading.sourceMapBytes)} inline source map — ` +
        `${Math.round((reading.sourceMapBytes / reading.bytes) * 100)}% of the file. That map is the ` +
        'NodeGX viewer source, base64-encoded, and a deploy copies this file verbatim: uploading the',
      'folder puts that source on your host, readable by anyone who opens it.'
    );
  } else {
    lines.push(
      `${reading.path} is the unminified development build — ` +
        `${reading.lines.toLocaleString('en-US')} lines, ${formatBytes(reading.bytes)}. Its source is ` +
        'readable as it ships, and a deploy copies this file verbatim.'
    );
  }

  lines.push(
    '',
    'What was read:',
    ...reading.reasons.map((reason) => `  - ${reason}`),
    '',
    'Build the production viewer and deploy again:',
    '  npm run build:editor:_viewer',
    '',
    `Or ship it anyway, knowingly, with ${flag}.`
  );
  return lines.join('\n');
}
