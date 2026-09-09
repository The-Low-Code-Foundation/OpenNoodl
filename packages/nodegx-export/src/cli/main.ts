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
import { runCli } from './run';

process.exitCode = runCli(process.argv.slice(2), {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text)
});
