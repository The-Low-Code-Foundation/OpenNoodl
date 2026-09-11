/**
 * HLS-014 — `nodegx live <url>`, the answer to "is the app that is being served the app I built?"
 *
 * ## 🔴 Why this is not a field in the deploy's own report
 *
 * The task's third acceptance criterion says the check is read from the **served artefact**, not
 * from a local record of what was sent, and that is not a stylistic preference. Everything the
 * deploy knows it learned from the folder on this machine. Between that folder and the app a
 * person loads there is an upload, a CDN, a cache, a host that may still be serving last week's
 * `index.html`, and a `--base-url` that may not match where the site ended up — none of which the
 * deploying process can observe, and all of which are the reason "did the command exit 0" stopped
 * being the same question as "is the live app the app I built".
 *
 * So this command asks the server. It fetches the page, reads the hashed export **out of the HTML
 * that was served**, and fetches that export to confirm the server actually holds it. The
 * comparison against a local folder is optional and secondary: without `--against` this still
 * answers the useful half, which is *what is live right now*.
 *
 * ## What the identity is
 *
 * `index-<hash>.js`, where the hash is a content hash of the project export spliced into it. Two
 * sites serving the same `index-*.js` are serving the same app; a site serving a different one is
 * serving a different app, whatever anybody's release notes say. It is already in the artefact and
 * already in the HTML, so there is nothing to add to the deploy to make this readable — which is
 * the reason this shape was chosen over stamping a build id of our own into the page.
 *
 * ## The trap this file is written around
 *
 * A redirect. `nodegx live https://example.com/app` that lands on `https://example.com/app/` — or
 * on a hosting provider's placeholder — reads a page that is not the one that was asked for, and a
 * reading reported under the name that was asked for is a lie about which URL was measured
 * (register row C74, filed against `render_report` for the same mistake). The final URL is
 * followed, recorded, and stated whenever it differs.
 */
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { URL } from 'url';

import { MANIFEST_NAME, readManifest, type DeployManifest, type FsLike } from './deployManifest';
import { EXIT, type ExitCode } from './exitCodes';

/** The `live` shape of {@link import('./args').ParsedArgs}. */
export interface LiveArgs {
  url: string;
  /** A deploy folder to compare what is live against. */
  against: string | null;
}

/** What one HTTP GET came back with. */
export interface Fetched {
  status: number;
  /** Where the request finished, after redirects. */
  finalUrl: string;
  body: string;
}

/** What the served site says about itself. */
export interface LiveReading {
  askedUrl: string;
  finalUrl: string;
  status: number;
  /** The hashed export `index.html` names, or `null` when it names none. */
  entry: string | null;
  /** The status the server gave that export. `null` when there was no entry to ask for. */
  entryStatus: number | null;
}

/**
 * Pull the hashed export out of a served page.
 *
 * Deliberately a regex over the HTML rather than a DOM parse: the input is a page this project
 * generated from a template it ships, the shape is `<script src="/index-<hash>.js">`, and a
 * dependency that has to be installed to read one attribute is a dependency the published package
 * carries for every command.
 */
export function entryFromHtml(html: string): string | null {
  const match = /<script[^>]+src="([^"]*\/)?(index-[^"/]+\.js)"/.exec(html);
  return match ? match[2] : null;
}

/** One GET, following up to five redirects, resolving the body as text. */
export function fetchUrl(target: string, redirectsLeft = 5): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      reject(new Error(`${target} is not a URL. Give a full one, including http:// or https://.`));
      return;
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.get(target, { headers: { 'user-agent': 'nodegx-live' } }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (redirectsLeft <= 0) {
          reject(new Error(`${target} redirects more than five times.`));
          return;
        }
        resolve(fetchUrl(new URL(location, target).toString(), redirectsLeft - 1));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => resolve({ status, finalUrl: target, body }));
    });
    request.on('error', (error) => reject(new Error(`${target} did not answer: ${error.message}`)));
    request.setTimeout(20000, () => {
      request.destroy(new Error('timed out after 20s'));
    });
  });
}

export interface Grade {
  code: ExitCode;
  lines: string[];
}

/**
 * Turn a reading — and optionally the local record it is being compared against — into a verdict.
 *
 * Pure, and every branch below is a branch a pipeline behaves differently on. `expected` being
 * `undefined` is the *no comparison was asked for* case, not a failed one: the command still
 * answered "what is live", which is the half of the question that has no local half.
 */
export function gradeLive(
  reading: LiveReading,
  expected?: { manifest: DeployManifest | null; folder: string; problem?: string }
): Grade {
  const lines: string[] = [];
  if (reading.finalUrl !== reading.askedUrl) {
    // C74. The reading belongs to the URL it was taken from, and saying so here is what stops a
    // redirect to a host's parking page from being reported under the name of a deploy.
    lines.push(`${reading.askedUrl} redirected to ${reading.finalUrl}; everything below is that page.`);
  }

  if (reading.status !== 200) {
    lines.push(`${reading.finalUrl} answered ${reading.status}. There is no site there to read.`);
    return { code: EXIT.serve, lines };
  }

  if (!reading.entry) {
    lines.push(
      `${reading.finalUrl} answered, and the page it served names no index-*.js. That is not a ` +
        'site this command deployed — check the URL, and whether the host is serving a placeholder.'
    );
    return { code: EXIT.stale, lines };
  }

  if (reading.entryStatus !== 200) {
    // 🔴 The case a cache produces, and the reason the export is fetched rather than trusted: the
    // page is real, it names its app, and the app is not there. A person loading it gets a blank
    // screen, and every check that stopped at the HTML says the site is fine.
    lines.push(
      `${reading.finalUrl} serves a page naming ${reading.entry}, and the server answered ` +
        `${reading.entryStatus} for it. The page is live and the app it asks for is not — anyone ` +
        'loading this URL gets a blank screen.'
    );
    return { code: EXIT.stale, lines };
  }

  lines.push(`${reading.finalUrl} is serving ${reading.entry}.`);

  if (!expected) return { code: EXIT.ok, lines };

  if (expected.problem || !expected.manifest) {
    lines.push(
      expected.problem ??
        `${expected.folder} holds no ${MANIFEST_NAME}, so there is nothing here to compare that ` +
          'against. Deploy into it with this version of nodegx first.'
    );
    return { code: EXIT.target, lines };
  }

  const manifest = expected.manifest;
  if (manifest.state !== 'complete' || !manifest.buildId) {
    lines.push(
      `The deploy into ${expected.folder} never finished (started ${manifest.startedAt}), so that ` +
        'folder is not a build to compare anything against. Deploy again, then ask.'
    );
    return { code: EXIT.target, lines };
  }

  if (manifest.buildId === reading.entry) {
    lines.push(`That is the build in ${expected.folder} (${manifest.projectName}, ${manifest.finishedAt}).`);
    return { code: EXIT.ok, lines };
  }

  lines.push(
    `${expected.folder} holds ${manifest.buildId} (${manifest.projectName}, ${manifest.finishedAt}). ` +
      'The live site is a different build. Either it has not been uploaded, or something is ' +
      'serving a cached page.'
  );
  return { code: EXIT.stale, lines };
}

/** The command. */
export async function runLive(
  args: LiveArgs,
  io: { out(text: string): void; err(text: string): void },
  fs: FsLike
): Promise<ExitCode> {
  let page: Fetched;
  try {
    page = await fetchUrl(args.url);
  } catch (error) {
    io.err(`${(error as Error).message}\n`);
    return EXIT.serve;
  }

  const entry = page.status === 200 ? entryFromHtml(page.body) : null;
  let entryStatus: number | null = null;
  if (entry) {
    // Resolved against the page's own URL, so a site served from a subfolder is asked for its
    // export at the place its own HTML points at rather than at the host root.
    const source = /<script[^>]+src="([^"]*\/)?index-[^"/]+\.js"/.exec(page.body);
    const prefix = source?.[1] ?? '';
    try {
      const target = new URL(`${prefix}${entry}`, page.finalUrl).toString();
      entryStatus = (await fetchUrl(target)).status;
    } catch {
      entryStatus = 0;
    }
  }

  const reading: LiveReading = {
    askedUrl: args.url,
    finalUrl: page.finalUrl,
    status: page.status,
    entry,
    entryStatus
  };

  let expected: { manifest: DeployManifest | null; folder: string; problem?: string } | undefined;
  if (args.against !== null) {
    const folder = path.resolve(args.against);
    const record = readManifest(folder, fs);
    expected = {
      folder,
      manifest: record.kind === 'manifest' ? record.manifest : null,
      problem: record.kind === 'unreadable' ? `${folder}: ${record.reason}` : undefined
    };
  }

  const grade = gradeLive(reading, expected);
  for (const line of grade.lines) (grade.code === EXIT.ok ? io.out : io.err)(`${line}\n`);
  return grade.code;
}
