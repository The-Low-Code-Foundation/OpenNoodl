#!/usr/bin/env node
/**
 * HLS-002 — the `nodegx` binary's entry point, and nothing else.
 *
 * Everything this file could get wrong is in `run.ts`, which returns an exit code instead of
 * calling `process.exit` and writes through an injected pair of writers instead of touching
 * `process.stdout` — so the command is gradeable as a function, and this file is the six lines
 * that cannot be. The specs still drive the real binary as a subprocess (`hls002-cli.test.ts`)
 * and the *packed* binary from an install outside the repo (`hls002-pack-and-run.test.ts`),
 * because HLS-001 found three defects that every in-repo gate read green on.
 */
import { parseArgs } from './args';
import { runCli } from './run';
import { runRender } from './render';
import { runServe } from './serve';

const argv = process.argv.slice(2);
const io = {
  out: (text: string) => process.stdout.write(text),
  err: (text: string) => process.stderr.write(text)
};

// HLS-006 — `serve` is the one command that does not return, so it is dispatched here rather
// than inside `runCli`, which stays synchronous precisely so every command it owns is gradeable
// as a function of its arguments.
const parsed = parseArgs(argv);
if (parsed.kind === 'serve') {
  runServe(parsed, io).then((code) => {
    process.exitCode = code;
  });
} else if (parsed.kind === 'render') {
  // HLS-007 — the second async command, and dispatched here for the same reason `serve` is:
  // `runCli` stays synchronous, which is what keeps every command it owns gradeable as a function
  // of its arguments. This one waits on a browser it started in another process.
  runRender(parsed, io).then((code) => {
    process.exitCode = code;
  });
} else {
  process.exitCode = runCli(argv, io);
}
