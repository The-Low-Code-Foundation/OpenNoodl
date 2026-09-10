/**
 * HLS-015 — the deploy engine's process boundary.
 *
 * `nodegx deploy` spawns this and reads one JSON object off stdout. It is a separate process from
 * the `nodegx` binary for the same reason `nodegx render` spawns its harness: everything below
 * this file drags in `ProjectModel`, `NodeLibrary` and the browser runtime's node register, and
 * HLS-013 measured what that costs a package that pulls it into its own type program — 201 type
 * errors and a renderer view module in a server bundle.
 *
 * 🔴 **The contract is the JSON, not the exit code.** The caller decides the exit code, because
 * the caller is the thing a pipeline gates on and the mapping from *what happened* to *which
 * number* is `nodegx`'s to own — see `cli/exitCodes.ts`. This process exits 0 whenever it managed
 * to say something and 1 when it did not, and `stage` says which room it stopped in.
 *
 * ⚠️ Everything human goes to **stderr**. A single stray `console.log` from anything below would
 * land in the middle of the report and turn a good run into "the engine produced no report" —
 * which is not hypothetical: `deployToFolder` logs its copy report with `console.log`, so stdout
 * is captured and redirected for the duration of the run.
 */
import { deployProject, type DeployOutcome } from './deploy';

/** What the caller reads. One object, one line, nothing else on stdout. */
export type EngineResult =
  | ({ ok: true } & DeployOutcome)
  | {
      ok: false;
      /**
       * Where it stopped. The caller maps this to an exit code, so the vocabulary is small and
       * each word means one fixable thing:
       *
       * - `usage`   — the arguments are wrong.
       * - `runtime` — this installation has no deployable viewer runtime.
       * - `project` — the project could not be read, validated, or has no root.
       * - `target`  — the output folder was refused (a project folder, most often).
       * - `write`   — it failed part-way through writing.
       */
      stage: 'usage' | 'runtime' | 'project' | 'target' | 'write';
      message: string;
    };

const RUNTIME_MARKER = 'The deployed viewer runtime is missing';

/**
 * Which room did it stop in?
 *
 * 🔴 A sentence classified by matching its own text is a fragile thing, and it is used here for
 * exactly two cases that have no other signal: the runtime-missing refusal this module raises
 * itself (matched on a constant it also owns), and `deployToFolder`'s one plain-object rejection.
 * Everything else is `write`, which is the honest answer for "it threw somewhere inside the
 * writing" and is the loud one — the folder now holds part of an app.
 */
function classify(message: string): Exclude<EngineResult, { ok: true }>['stage'] {
  if (message.startsWith(RUNTIME_MARKER)) return 'runtime';
  if (message.includes('Cannot deploy to a project folder')) return 'target';
  if (
    message.includes('validation error') ||
    message.includes('No renderable root node') ||
    message.includes('is not a Noodl project') ||
    message.includes('No such file or directory')
  ) {
    return 'project';
  }
  return 'write';
}

function emit(result: EngineResult): void {
  process.stdout.write(JSON.stringify(result) + '\n');
}

async function main(): Promise<void> {
  const [projectDir, outDir, ...rest] = process.argv.slice(2);
  let baseUrl: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--base-url' && rest[i + 1] !== undefined) {
      baseUrl = rest[++i];
      continue;
    }
    emit({ ok: false, stage: 'usage', message: `nodegx-deploy: unexpected argument ${rest[i]}` });
    process.exitCode = 1;
    return;
  }
  if (!projectDir || !outDir) {
    emit({
      ok: false,
      stage: 'usage',
      message: 'Usage: nodegx-deploy <project-dir> <out-dir> [--base-url /path]'
    });
    process.exitCode = 1;
    return;
  }

  // ⚠️ stdout is the report channel and `deployToFolder` writes its copy report to `console.log`.
  // Redirecting for the duration is cheaper than auditing every module below for a stray write,
  // and it keeps the copy report visible — on stderr, where a person reading the terminal sees it
  // and a caller parsing JSON does not.
  const realWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) =>
    (process.stderr.write as TSFixme)(chunk, ...args)) as typeof process.stdout.write;

  let result: EngineResult;
  try {
    const outcome = await deployProject({ projectDir, outDir, baseUrl });
    result = { ok: true, ...outcome };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = { ok: false, stage: classify(message), message };
  } finally {
    process.stdout.write = realWrite;
  }

  emit(result);
  process.exitCode = 0;
}

main().catch((error) => {
  // A throw that escaped `main` means the report was never written, so the caller would see an
  // empty stdout and say "the engine produced no report". Say what actually happened instead.
  process.stdout.write(
    JSON.stringify({
      ok: false,
      stage: 'write',
      message: error && error.stack ? error.stack : String(error)
    }) + '\n'
  );
  process.exit(1);
});
