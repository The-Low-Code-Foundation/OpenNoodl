/**
 * HLS-002 — argument parsing, separated from the command so that the parse is a function of a
 * string array and nothing else.
 *
 * `scripts/emit-app.ts` decided its mode with `argv[0] === '--preflight'` and destructured the
 * rest positionally. That is fine for a script one person runs by hand and wrong for a binary:
 * `nodegx export --dry-run ./app` and `nodegx export ./app --dry-run` are the same request, and a
 * positional read gets the second one wrong silently — it would treat `--dry-run` as the output
 * directory and write an app into a folder called `--dry-run`.
 */

/** What the arguments asked for. Exactly one shape per outcome; no partially-filled results. */
export type ParsedArgs =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'usage'; problem: string }
  | {
      kind: 'export';
      projectDir: string;
      /** `null` in `--dry-run` mode, where there is no output folder by design. */
      outDir: string | null;
      dryRun: boolean;
      /** Write into a folder that already holds something. */
      force: boolean;
    }
  | {
      kind: 'serve';
      /** A folder of built files. Not a project — see `serve/staticServer.ts`. */
      dir: string;
      port: number;
      /**
       * 🔴 An explicit decision to leave loopback. `--host` sets this as well as the address,
       * because somebody who types an address has decided; `resolveAccess` refuses to infer the
       * same thing from a `host` that arrived any other way, which is the asymmetry that keeps a
       * forwarded option from re-opening the port by accident.
       */
      share: boolean;
      host: string | null;
      /** `null` mints one. A caller supplies it so a pipeline can know it before the server runs. */
      token: string | null;
    }
  | {
      kind: 'deploy';
      projectDir: string;
      /** A folder to write the site into. Never optional — a deploy with nowhere to go is nothing. */
      outDir: string;
      /** Write into a folder that already holds something. */
      force: boolean;
      /**
       * The path the site will be served from, spliced into `index.html`'s `<base>`. `null` means
       * `/`, which is right for a site at the root of a domain and wrong for one in a subfolder —
       * where every asset URL comes out absolute and 404s. The editor's dialog asks for it; this is
       * the same question with nobody to ask.
       */
      baseUrl: string | null;
    }
  | {
      kind: 'render';
      projectDir: string;
      /** `null` grades without keeping anything — a CI gate that wants no artefacts. */
      outDir: string | null;
      /**
       * Passed to the harness verbatim, deliberately. The vocabulary (`desktop,phone`,
       * `1280x900`) belongs to `parseViewports` in the harness, and restating it here would be a
       * second copy of a list that already has one reader — with the CLI's copy going stale the
       * first time a viewport is named.
       */
      viewports: string | null;
      scale: number | null;
    };

const FLAGS = new Set(['--dry-run', '--preflight', '--force', '--help', '-h', '--version', '-v']);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  if (argv.length === 0) return { kind: 'help' };
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };
  if (argv.includes('--version') || argv.includes('-v')) return { kind: 'version' };

  const [command, ...rest] = argv;
  if (command.startsWith('-')) {
    return { kind: 'usage', problem: `\`${command}\` is a flag, not a command.` };
  }
  if (command === 'serve') return parseServe(rest);
  if (command === 'render') return parseRender(rest);
  if (command === 'deploy') return parseDeploy(rest);
  if (command !== 'export') {
    return { kind: 'usage', problem: `There is no \`nodegx ${command}\` command.` };
  }

  const unknown = rest.filter((arg) => arg.startsWith('-') && !FLAGS.has(arg));
  if (unknown.length > 0) {
    return { kind: 'usage', problem: `Unknown option${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.` };
  }

  // `--preflight` is the name the in-repo script has always used and is kept working, because
  // somebody's notes say `--preflight` and a binary that answers "unknown option" to the name in
  // the documentation it grew out of is a small, avoidable cruelty.
  const dryRun = rest.includes('--dry-run') || rest.includes('--preflight');
  const force = rest.includes('--force');
  const positional = rest.filter((arg) => !arg.startsWith('-'));

  if (positional.length === 0) {
    return { kind: 'usage', problem: 'No project folder given.' };
  }
  if (dryRun && positional.length > 1) {
    // 🔴 Not ignored. `scripts/emit-app.ts` accepts and silently drops a second argument in this
    // mode, and its own spec pins that ("--preflight given an output directory still writes
    // nothing into it") — which is the right behaviour for a script whose contract is *writes
    // nothing*, and the wrong one for a binary, because the person who typed an output folder
    // believes they asked for an export and will not read the summary as a refusal to do one.
    return {
      kind: 'usage',
      problem: '`--dry-run` writes nothing, so it takes a project folder and no output folder.'
    };
  }
  if (!dryRun && positional.length < 2) {
    return { kind: 'usage', problem: 'No output folder given.' };
  }
  if (positional.length > 2) {
    return { kind: 'usage', problem: `Too many folders: ${positional.join(', ')}.` };
  }
  return {
    kind: 'export',
    projectDir: positional[0],
    outDir: dryRun ? null : positional[1],
    dryRun,
    force
  };
}

/** Options that take a value, so a missing value is a usage error rather than a swallowed flag. */
const SERVE_VALUE_OPTIONS = new Set(['--port', '--host', '--token']);
const SERVE_FLAGS = new Set(['--share']);

/**
 * HLS-006 — `nodegx serve <dir> [--port n] [--share | --host addr] [--token t]`.
 *
 * 🔴 **There is no way to reach a non-loopback address by accident here.** `--share` and `--host`
 * are the only two spellings that set it, both are typed by a person, and everything else —
 * including the absence of any flag at all — is `127.0.0.1`. The default is the one #31 says the
 * editor should have had.
 */
function parseServe(rest: readonly string[]): ParsedArgs {
  let port = 8575;
  let share = false;
  let host: string | null = null;
  let token: string | null = null;
  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (SERVE_VALUE_OPTIONS.has(arg)) {
      const value = rest[i + 1];
      // ⚠️ A value that looks like the next option is a *missing* value, not a value. `--token
      // --share` would otherwise mint the token `--share`, and the person would be told sharing
      // is off while holding a credential that works.
      if (value === undefined || value.startsWith('-')) {
        return { kind: 'usage', problem: `\`${arg}\` needs a value.` };
      }
      i += 1;
      if (arg === '--port') {
        port = Number(value);
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
          return { kind: 'usage', problem: `\`--port ${value}\` is not a port number.` };
        }
      } else if (arg === '--host') {
        host = value;
        share = true;
      } else {
        token = value;
      }
      continue;
    }
    if (SERVE_FLAGS.has(arg)) {
      share = true;
      continue;
    }
    if (arg.startsWith('-')) return { kind: 'usage', problem: `Unknown option: ${arg}.` };
    positional.push(arg);
  }

  if (positional.length === 0) return { kind: 'usage', problem: 'No folder given to serve.' };
  if (positional.length > 1) return { kind: 'usage', problem: `Too many folders: ${positional.join(', ')}.` };

  return { kind: 'serve', dir: positional[0], port, share, host, token };
}

/** Options that take a value; a missing one is a usage error rather than a swallowed flag. */
const RENDER_VALUE_OPTIONS = new Set(['--out-dir', '--viewports', '--scale']);

/**
 * HLS-007 — `nodegx render <project> [--out-dir dir] [--viewports list] [--scale n]`.
 *
 * ⚠️ `--out-dir` is **optional**, and that is a product decision rather than an omission. Without
 * it the command renders every routed page, grades them and writes nothing — which is exactly the
 * shape a CI gate wants (*did every page of this app render?*) and is the cheapest way to ask,
 * because the harness is told not to capture at all. With it, the same run keeps the pictures.
 */
function parseRender(rest: readonly string[]): ParsedArgs {
  let outDir: string | null = null;
  let viewports: string | null = null;
  let scale: number | null = null;
  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (RENDER_VALUE_OPTIONS.has(arg)) {
      const value = rest[i + 1];
      // A value that looks like the next option is a *missing* value — see `parseServe`, where
      // the same read would have minted `--share` as a credential.
      if (value === undefined || value.startsWith('-')) {
        return { kind: 'usage', problem: `\`${arg}\` needs a value.` };
      }
      i += 1;
      if (arg === '--out-dir') {
        outDir = value;
      } else if (arg === '--viewports') {
        viewports = value;
      } else {
        scale = Number(value);
        if (!Number.isFinite(scale) || scale <= 0) {
          return { kind: 'usage', problem: `\`--scale ${value}\` is not a scale factor.` };
        }
      }
      continue;
    }
    if (arg.startsWith('-')) return { kind: 'usage', problem: `Unknown option: ${arg}.` };
    positional.push(arg);
  }

  if (positional.length === 0) return { kind: 'usage', problem: 'No project folder given.' };
  if (positional.length > 1) return { kind: 'usage', problem: `Too many folders: ${positional.join(', ')}.` };

  return { kind: 'render', projectDir: positional[0], outDir, viewports, scale };
}

/** Options that take a value; a missing one is a usage error rather than a swallowed flag. */
const DEPLOY_VALUE_OPTIONS = new Set(['--base-url']);
const DEPLOY_FLAGS = new Set(['--force']);

/**
 * HLS-015 — `nodegx deploy <project> <output> [--force] [--base-url /path]`.
 *
 * ⚠️ **Both folders are required, and there is no `--dry-run`.** `nodegx export --dry-run` answers
 * "will this translate", which is a question about a *format conversion* that can be answered
 * without writing. A deploy does no translation — it runs the graph's own interpreter — so the
 * question it would be asked instead is "will this render", and the only instrument that answers
 * that is `nodegx render`, which already exists and needs a browser this command does not have.
 */
function parseDeploy(rest: readonly string[]): ParsedArgs {
  let force = false;
  let baseUrl: string | null = null;
  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (DEPLOY_VALUE_OPTIONS.has(arg)) {
      const value = rest[i + 1];
      // A value that looks like the next option is a *missing* value — see `parseServe`, where the
      // same read would have minted `--share` as a credential.
      if (value === undefined || value.startsWith('-')) {
        return { kind: 'usage', problem: `\`${arg}\` needs a value.` };
      }
      i += 1;
      baseUrl = value;
      continue;
    }
    if (DEPLOY_FLAGS.has(arg)) {
      force = true;
      continue;
    }
    if (arg.startsWith('-')) return { kind: 'usage', problem: `Unknown option: ${arg}.` };
    positional.push(arg);
  }

  if (positional.length === 0) return { kind: 'usage', problem: 'No project folder given.' };
  if (positional.length === 1) {
    return {
      kind: 'usage',
      problem: 'No output folder given. `nodegx deploy` writes a site; it needs somewhere to write it.'
    };
  }
  if (positional.length > 2) return { kind: 'usage', problem: `Too many folders: ${positional.join(', ')}.` };

  return { kind: 'deploy', projectDir: positional[0], outDir: positional[1], force, baseUrl };
}

export const USAGE = `nodegx — the NodeGX command line

  nodegx export <project> <output>   Export a project as a React app
  nodegx export --dry-run <project>  Print what the export would produce, and write nothing
  nodegx deploy <project> <output>   Write a ready-to-host site you can upload as it is
  nodegx serve <folder>              Serve a built site over HTTP, on this machine only
  nodegx render <project>            Render every routed page and say which ones did not

export or deploy?
  export writes React SOURCE. You run npm install and npm run build, and you own the code.
  deploy writes a FINISHED SITE — index.html, your app, and the NodeGX runtime that runs it.
    Upload the folder and it works. Nothing to build, and no source to edit.

Options
  --dry-run, --preflight   Print the pre-flight summary and exit without writing anything.
                           Exits 4 if anything would be left out, so a pipeline can gate on it.
  --force                  Write into an output folder that already holds something. Files with
                           the same names are overwritten; nothing else is touched.
  --base-url <path>        deploy: the path the site is served from, when it is not the root of a
                           domain (\`--base-url /app/\`). Without it every asset URL is absolute.
  --port <n>               serve: the port to listen on (default 8575).
  --share                  serve: also accept connections from other machines on this network.
                           Prints a URL containing a token; without the token nothing is served.
  --host <addr>            serve: the address to bind when sharing. Implies --share.
  --token <t>              serve: use this token instead of minting one, so a pipeline can know
                           it in advance.
  --out-dir <dir>          render: keep the images, one per page per viewport, as
                           <page>-<viewport>.png. Without it nothing is written and nothing is
                           captured — the run still grades every page.
  --viewports <list>       render: "desktop,phone" or "1280x900,390x844" (default desktop,phone).
  --scale <n>              render: screenshot scale (default 0.5).
  --help, -h               This.
  --version, -v            The exporter version.

Exit codes
  0  the export ran (or --dry-run found nothing left out)
  1  the arguments do not name a command
  2  the project could not be read
  3  the output folder was refused
  4  --dry-run: something will not translate
  5  a write failed part-way
  6  serve: the folder is not a built site, or the port could not be bound
  7  render: a routed page did not render — it is named on stderr
  8  render/deploy: this installation has no render harness or deploy engine (see below)
  9  deploy: the site that was written would render nothing — it is not fit to upload

⚠️ \`nodegx serve\` listens on 127.0.0.1 unless you pass --share or --host. That is a decision, not
a default that something else can change: nothing but those two flags reaches another interface.

⚠️ \`nodegx deploy\` needs the NodeGX deploy engine — the editor's model engine and the ~15 MB
NodeGX interpreter — which is NOT part of this package. It works from a NodeGX checkout with the
engine built, or set NODEGX_DEPLOY_CLI to one. \`nodegx export\` needs none of it.

⚠️ \`nodegx deploy\` publishes your project folder as well as your app. Everything beside
nodegx.project.json ships unless a default rule or your .noodlignore excludes it — the run says
what it left out, and reading that line is how ".env was excluded" and "my logo went missing" stay
different things.

⚠️ \`nodegx render\` needs the NodeGX render harness — a browser and the viewer bundle — which is
NOT part of this package. It works from a NodeGX checkout, or set NODEGX_RENDER_CLI to one. Every
other command works without it.

⚠️ \`nodegx render\` photographs URLS, not components. A route that redirects — an admin page that
sends a logged-out visitor to a login page — is photographed as what that URL renders, which is the
login page. It is a true picture of the route and not of the component you named.

⚠️ \`nodegx render\` proves pixels, not reachability. It clicks nothing, so a page whose only button
sits under an invisible overlay photographs perfectly and exits 0.

⚠️ This reads the project from disk. If the editor has it open with unsaved changes, save first.`;
