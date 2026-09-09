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

export const USAGE = `nodegx — the NodeGX command line

  nodegx export <project> <output>   Export a project as a React app
  nodegx export --dry-run <project>  Print what the export would produce, and write nothing

Options
  --dry-run, --preflight   Print the pre-flight summary and exit without writing anything.
                           Exits 4 if anything would be left out, so a pipeline can gate on it.
  --force                  Write into an output folder that already holds something. Files with
                           the same names are overwritten; nothing else is touched.
  --help, -h               This.
  --version, -v            The exporter version.

Exit codes
  0  the export ran (or --dry-run found nothing left out)
  1  the arguments do not name a command
  2  the project could not be read
  3  the output folder was refused
  4  --dry-run: something will not translate
  5  a write failed part-way

⚠️ This reads the project from disk. If the editor has it open with unsaved changes, save first.`;
