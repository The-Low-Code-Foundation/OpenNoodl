/**
 * Build the WF-003 deploy artifact: the exact tree a container image (or a
 * plain `scp` to a VPS) is made of, plus a manifest that names every byte in
 * it.
 *
 *   node scripts/package-deploy.js [--app <dir>] [--out <dir>] [--build-id <id>]
 *                                  [--site-url <url>] [--skip-build] [--json]
 *
 * Output tree (`deploy/artifact` by default):
 *
 *   backend/cli.js      the self-contained service bundle (scripts/build.js)
 *   app/                the built NodeGX application frontend, if --app given
 *   MANIFEST.json       buildId, digest, and sha256 of every file above
 *
 * ## Why a packaging step at all, when `dist/cli.js` is already one file
 *
 * Three things this does that copying the bundle does not:
 *
 *   1. **It is deterministic and says so.** `artifactDigest` is a sha256 over
 *      the sorted `<sha256>  <path>` lines of the tree, and `buildId` is
 *      derived from it. Same sources in, same id out — so "which build is
 *      running in prod" is answerable, and a rollback target is a name rather
 *      than a date. Nothing time-varying enters the digest (`createdAt` is
 *      recorded beside it, never inside it).
 *   2. **It drops the sourcemap.** `dist/cli.js.map` is 2.7 MB of the monorepo's
 *      absolute paths and full original sources. Shipping it to a public server
 *      is a source disclosure nobody asked for, and it doubles the image.
 *   3. **It verifies the "no credentials in artifacts" success criterion
 *      instead of asserting it** — see `scanForSecrets` below. The scan runs on
 *      every package, and a hit is a hard failure, so the property is enforced
 *      by the build rather than by a reviewer remembering.
 *
 * @module nodegx-backend/scripts/package-deploy
 */
'use strict';

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pkgRoot = path.resolve(__dirname, '..');

// ============================================================================
// Secret scanning — the success criterion, enforced
// ============================================================================

/**
 * Files that must never appear in a deploy artifact, matched on basename or
 * extension. These are the machine-local credential/state files the backend
 * writes into its DATA DIRECTORY; the data dir is a volume at runtime and has
 * no business being baked into an image. `secrets.json` is the SecretsStore
 * file (admin credential, webhook secrets, SMTP password).
 */
const FORBIDDEN_BASENAMES = new Set(['secrets.json', '.env', '.env.local', '.npmrc', 'id_rsa', '.netrc']);
const FORBIDDEN_EXTENSIONS = new Set(['.db', '.sqlite', '.sqlite3', '.pem', '.key', '.p12', '.pfx', '.keystore']);

/**
 * Content patterns for credential material. Deliberately high-confidence: this
 * runs over a 1.5 MB bundle that legitimately contains an SMTP client, an
 * OAuth-ish vocabulary and a lot of the word "token", so a loose regex here
 * would cry wolf until someone turned the check off — which is the failure
 * mode that matters. Each pattern therefore matches a credential's *value*
 * shape, not its name.
 */
const SECRET_PATTERNS = [
  { name: 'PEM private key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'OpenAI-style API key', re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{24,}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Slack token', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'JSON web token', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./ },
  // The backend's own credential slots, serialised with a real-looking value.
  // The base64url alphabet and >=24 chars is what SecurityState mints; a
  // placeholder like "changeme" or "<your-token>" does not match.
  { name: 'serialised adminToken', re: /"admin(?:Readonly)?Token"\s*:\s*"[A-Za-z0-9_-]{24,}"/ },
  { name: 'connection string with password', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/"']+:[^\s:@/"']{6,}@/ }
];

/**
 * Scan one file. Binary-ish files are still scanned as latin1 — a secret
 * embedded in a bundle is text however the surrounding bytes look.
 * @returns {{file: string, finding: string, excerpt: string}[]}
 */
function scanFileForSecrets(absPath, relPath) {
  const findings = [];
  const base = path.basename(relPath);
  if (FORBIDDEN_BASENAMES.has(base)) {
    findings.push({ file: relPath, finding: `forbidden file "${base}" (machine-local credential/state)`, excerpt: '' });
  }
  if (FORBIDDEN_EXTENSIONS.has(path.extname(relPath).toLowerCase())) {
    findings.push({ file: relPath, finding: `forbidden extension "${path.extname(relPath)}"`, excerpt: '' });
  }
  const text = fs.readFileSync(absPath, 'latin1');
  for (const { name, re } of SECRET_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      // Never echo the secret. Report enough to find it: the pattern and where.
      const at = m.index;
      findings.push({
        file: relPath,
        finding: name,
        excerpt: `offset ${at}, ${m[0].length} chars (value withheld)`
      });
    }
  }
  return findings;
}

/**
 * Scan the whole staged tree. Exported so the test suite runs the same code
 * the packager does — a scan that only ever runs in CI is a scan that drifts.
 */
function scanForSecrets(root) {
  const findings = [];
  for (const rel of listFiles(root)) {
    findings.push(...scanFileForSecrets(path.join(root, rel), rel));
  }
  return findings;
}

// ============================================================================
// The baked-endpoint audit — the deploy failure that actually happens
// ============================================================================

/**
 * A NodeGX application does NOT discover its backend at runtime. The editor
 * bakes `metadata.cloudservices` into `window.projectData` inside the hashed
 * `index-<hash>.js` at "Deploy to folder" time (see
 * `noodl-editor/src/editor/src/utils/exporter/json.ts`), and there is no
 * post-deploy override. So the single most likely way a self-host deploy fails
 * is silent and late: the operator deploys a folder whose baked endpoint still
 * points at `http://localhost:8577` — their laptop — and the app loads
 * perfectly, renders its shell, and simply never gets any data. On their own
 * machine it even works, because their laptop backend is running.
 *
 * The compose stack in `deploy/` puts the app and the API on ONE origin
 * precisely so the right answer is a single value the operator already knows:
 * the site's own public URL. This function reads the value that was actually
 * baked and, given `--site-url`, refuses to package a mismatch.
 *
 * @returns {{found: boolean, endpoint?: string, appId?: string, type?: string, file?: string}}
 */
function readBakedEndpoint(appRoot) {
  if (!fs.existsSync(appRoot)) return { found: false };
  for (const rel of listFiles(appRoot)) {
    if (!rel.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(appRoot, rel), 'utf-8');
    // `cloudservices` is a flat object ({instanceId, endpoint, appId, type,
    // deployVersion}), so a brace-free body is a correct match, not a shortcut.
    const m = /"cloudservices"\s*:\s*(\{[^{}]*\})/.exec(text);
    if (!m) continue;
    let parsed;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    return {
      found: true,
      endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : undefined,
      appId: typeof parsed.appId === 'string' ? parsed.appId : undefined,
      type: typeof parsed.type === 'string' ? parsed.type : undefined,
      file: rel
    };
  }
  return { found: false };
}

const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?/i;

/** Normalise for comparison: scheme+host+port, no trailing slash, lowercased. */
function originOf(url) {
  const trimmed = String(url).trim().replace(/\/+$/, '');
  const m = /^(https?):\/\/([^/]+)/i.exec(trimmed);
  return m ? `${m[1].toLowerCase()}://${m[2].toLowerCase()}` : trimmed.toLowerCase();
}

/**
 * @returns {{level: 'ok'|'warn'|'error', message: string, endpoint?: string}}
 */
function auditEndpoint(baked, siteUrl) {
  if (!baked.found) {
    return {
      level: 'warn',
      message:
        'no baked backend endpoint found in the app bundle — the app either uses no backend, ' +
        'or was exported before a backend was configured in Backend Services.'
    };
  }
  const endpoint = baked.endpoint || '';
  if (endpoint === '') {
    return {
      level: 'ok',
      endpoint,
      message: 'baked endpoint is empty (same-origin relative requests) — correct for this single-origin stack.'
    };
  }
  const endpointIsLocal = LOCAL_HOST_RE.test(endpoint);

  // When the operator has told us where this stack will live, that is the whole
  // answer: the app must call the origin it is served from. Note that this
  // subsumes the localhost case — and does it better, because deploying to
  // `http://127.0.0.1:8080` for a smoke test on your own machine is a perfectly
  // good thing to do, and a blanket "loopback is wrong" rule would refuse it.
  if (siteUrl) {
    if (originOf(endpoint) !== originOf(siteUrl)) {
      const why = endpointIsLocal
        ? 'On a server, a loopback address is the SERVER\'s own loopback, not the browser\'s — the app ' +
          'would load fine and never get any data, for everyone but you.'
        : 'The app would call a different backend than the one you are deploying.';
      return {
        level: 'error',
        endpoint,
        message:
          `the app bundle's baked backend endpoint is "${endpoint}", but this stack is being packaged for ` +
          `"${siteUrl}". ${why}\n` +
          '  Fix: in the editor, Backend Services -> endpoint, set the URL this stack is reached at (one ' +
          'origin serves both the app and the API), then re-run Deploy -> Self Hosting -> Deploy to folder.'
      };
    }
    return {
      level: 'ok',
      endpoint,
      message:
        `baked endpoint "${endpoint}" matches the deploy target` +
        (endpointIsLocal ? ' (loopback — this deploy is only reachable from the machine it runs on).' : '.')
    };
  }

  // No declared site URL: we cannot know what is correct, but a loopback
  // endpoint is worth saying out loud, because it is right on a laptop and
  // wrong on every server.
  if (endpointIsLocal) {
    return {
      level: 'warn',
      endpoint,
      message:
        `the app bundle has "${endpoint}" baked in as its backend endpoint. That is the SERVER's own ` +
        'loopback once deployed, so the app will render and never load data.\n' +
        '  Pass --site-url <url> to check this properly (and to make a mismatch a hard failure).'
    };
  }
  return { level: 'ok', endpoint, message: `baked endpoint "${endpoint}" (no --site-url given, so not verified).` };
}

// ============================================================================
// Tree helpers
// ============================================================================

/** Every file under `root`, as posix-style relative paths, sorted. */
function listFiles(root, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(root, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

function sha256File(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
    // Symlinks are skipped deliberately: an artifact that depends on a link
    // target outside itself is not self-contained.
  }
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

// ============================================================================
// Packaging
// ============================================================================

/**
 * @param {object} opts
 * @param {string} [opts.appDir]   built frontend to include at `app/`
 * @param {string} [opts.outDir]   staging directory (default deploy/artifact)
 * @param {string} [opts.buildId]  override the derived id
 * @param {string} [opts.siteUrl]  public URL this stack will serve on; turns the
 *                                 baked-endpoint audit from a warning into a gate
 * @param {boolean} [opts.skipBuild] reuse an existing dist/cli.js
 */
function packageDeploy(opts = {}) {
  const outDir = opts.outDir || path.join(pkgRoot, 'deploy', 'artifact');
  const distCli = path.join(pkgRoot, 'dist', 'cli.js');

  if (!opts.skipBuild) {
    // Same build the package's own `npm run build` runs — one build path, not
    // two. Spawned rather than `require`d: build.js kicks off an async esbuild
    // and returns immediately, so requiring it packages whatever `dist/cli.js`
    // happened to be lying around from the previous run. (Observed, not
    // theorised — the first run of this script shipped a stale bundle.)
    execFileSync(process.execPath, [path.join(pkgRoot, 'scripts', 'build.js')], {
      cwd: pkgRoot,
      stdio: 'inherit'
    });
  }
  if (!fs.existsSync(distCli)) {
    throw new Error(`No service bundle at ${distCli}. Run \`npm run build\` in packages/nodegx-backend first.`);
  }

  rmrf(outDir);
  fs.mkdirSync(path.join(outDir, 'backend'), { recursive: true });
  // Always present, even when empty: the web image COPYs it unconditionally, and
  // a backend-only deploy (API + /_admin, no app) is a supported outcome rather
  // than a build error. `.keep` exists because `COPY emptydir/ dest/` is an
  // error in Docker, not a no-op.
  fs.mkdirSync(path.join(outDir, 'app'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'app', '.keep'), '');
  fs.copyFileSync(distCli, path.join(outDir, 'backend', 'cli.js'));
  // NB: cli.js.map is deliberately NOT copied (see the module doc).

  let appFiles = 0;
  if (opts.appDir) {
    const appSrc = path.resolve(opts.appDir);
    if (!fs.existsSync(appSrc)) throw new Error(`--app directory does not exist: ${appSrc}`);
    if (!fs.existsSync(path.join(appSrc, 'index.html'))) {
      throw new Error(
        `--app directory has no index.html: ${appSrc}\n` +
          `  Expected the output of the editor's "Deploy to folder" / static export.`
      );
    }
    copyTree(appSrc, path.join(outDir, 'app'));
    appFiles = listFiles(path.join(outDir, 'app')).length;
  }

  // --- baked-endpoint audit -------------------------------------------------
  const baked = opts.appDir ? readBakedEndpoint(path.join(outDir, 'app')) : { found: false };
  const endpointAudit = opts.appDir
    ? auditEndpoint(baked, opts.siteUrl)
    : { level: 'ok', message: 'backend-only artifact; no app bundle to audit.' };
  if (endpointAudit.level === 'error') {
    throw new Error('Refusing to package: ' + endpointAudit.message);
  }

  // --- digest ---------------------------------------------------------------
  const files = listFiles(outDir).map((rel) => ({
    path: rel,
    bytes: fs.statSync(path.join(outDir, rel)).size,
    sha256: sha256File(path.join(outDir, rel))
  }));
  const artifactDigest = crypto
    .createHash('sha256')
    .update(files.map((f) => `${f.sha256}  ${f.path}`).join('\n'))
    .digest('hex');
  const buildId = opts.buildId || artifactDigest.slice(0, 12);

  // --- the scan, before anything is declared shippable -----------------------
  const findings = scanForSecrets(outDir);
  if (findings.length > 0) {
    const lines = findings.map((f) => `  - ${f.file}: ${f.finding}${f.excerpt ? ` (${f.excerpt})` : ''}`);
    throw new Error(
      'Refusing to package: credential material found in the deploy artifact.\n' +
        lines.join('\n') +
        '\nA deploy artifact is a public object — secrets belong in the data volume ' +
        '(secrets.json, mode 0600) or the runtime environment, never in the image.'
    );
  }

  const manifest = {
    artifact: 'nodegx-deploy',
    manifestVersion: 1,
    buildId,
    artifactDigest,
    // Recorded, never hashed — the digest must not move because the clock did.
    createdAt: new Date().toISOString(),
    backendVersion: require(path.join(pkgRoot, 'package.json')).version,
    includesApp: Boolean(opts.appDir),
    appFileCount: appFiles,
    siteUrl: opts.siteUrl || null,
    backendEndpoint: baked.found ? { endpoint: baked.endpoint, appId: baked.appId, type: baked.type } : null,
    endpointAudit: { level: endpointAudit.level, message: endpointAudit.message },
    secretScan: { patterns: SECRET_PATTERNS.length, findings: 0 },
    files
  };
  fs.writeFileSync(path.join(outDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { outDir, manifest };
}

// ============================================================================
// CLI
// ============================================================================

function parse(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--app':
        o.appDir = argv[++i];
        break;
      case '--out':
        o.outDir = path.resolve(argv[++i]);
        break;
      case '--build-id':
        o.buildId = argv[++i];
        break;
      case '--site-url':
        o.siteUrl = argv[++i];
        break;
      case '--skip-build':
        o.skipBuild = true;
        break;
      case '--json':
        o.json = true;
        break;
      default:
        throw new Error(`Unknown flag: ${argv[i]}`);
    }
  }
  return o;
}

if (require.main === module) {
  try {
    const opts = parse(process.argv.slice(2));
    const { outDir, manifest } = packageDeploy(opts);
    if (opts.json) {
      process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
    } else {
      const total = manifest.files.reduce((n, f) => n + f.bytes, 0);
      process.stdout.write(`[package-deploy] artifact: ${outDir}\n`);
      process.stdout.write(`[package-deploy] build id: ${manifest.buildId}  (digest ${manifest.artifactDigest})\n`);
      process.stdout.write(
        `[package-deploy] ${manifest.files.length} file(s), ${(total / 1024).toFixed(0)} KiB` +
          (manifest.includesApp ? `, app included (${manifest.appFileCount} files)` : ', no app bundled (backend only)') +
          '\n'
      );
      process.stdout.write(`[package-deploy] secret scan: clean (${SECRET_PATTERNS.length} patterns, 0 findings)\n`);
      const audit = manifest.endpointAudit;
      process.stdout.write(
        `[package-deploy] backend endpoint: ${audit.level === 'ok' ? 'OK' : 'WARNING'} — ${audit.message}\n`
      );
    }
  } catch (e) {
    process.stderr.write(`[package-deploy] FAILED: ${e && e.message ? e.message : e}\n`);
    process.exit(1);
  }
}

module.exports = {
  packageDeploy,
  scanForSecrets,
  scanFileForSecrets,
  listFiles,
  readBakedEndpoint,
  auditEndpoint,
  SECRET_PATTERNS
};
