/**
 * HLS-006 — `nodegx serve`, the command.
 *
 * Kept out of `run.ts` because it is the one command that does not return. `runCli` is
 * synchronous and returns an exit code, which is what makes every other command gradeable as a
 * pure function; this one listens until it is stopped, so it is its own entry point and `main.ts`
 * dispatches to it.
 *
 * 🔴 **What it prints is part of what it does.** #31's report is not only that a port was open —
 * it is that nothing ever said so. A server that binds correctly and stays quiet has fixed the
 * exposure and kept the surprise.
 */
import type { Server } from 'node:http';

import { describeAccess, lanAddress, resolveAccess } from '../serve/access';
import { createStaticServer, describeTarget } from '../serve/staticServer';
import { EXIT, type ExitCode } from './exitCodes';
import type { CliIO } from './run';

/** The `serve` shape of {@link import('./args').ParsedArgs}. */
export interface ServeArgs {
  dir: string;
  port: number;
  share: boolean;
  host: string | null;
  token: string | null;
}

export interface ServeHandle {
  server: Server;
  /** Read off the listening socket, never off the option — which is what AC2 grades. */
  address: string;
  port: number;
  token: string;
}

/**
 * Start the server and resolve once it is listening, or reject with a sentence.
 *
 * Separated from {@link runServe} so a spec can start one, drive real requests at it and close
 * it, without a subprocess and without the process-lifetime handling.
 */
export function startServe(args: ServeArgs, io: CliIO): Promise<ServeHandle> {
  return new Promise((resolve, reject) => {
    const target = describeTarget(args.dir);
    if (target.ok === false) {
      reject(Object.assign(new Error(target.reason), { exitCode: EXIT.serve }));
      return;
    }

    const access = resolveAccess({
      share: args.share,
      host: args.host || undefined,
      token: args.token
    });

    const server = createStaticServer({ root: args.dir, port: args.port, access });

    server.once('error', (error: NodeJS.ErrnoException) => {
      const reason =
        error.code === 'EADDRINUSE'
          ? `Port ${args.port} is already in use. Pass --port with a free one, or stop what is on it.`
          : error.message;
      reject(Object.assign(new Error(reason), { exitCode: EXIT.serve }));
    });

    server.listen(args.port, access.host, () => {
      const bound = server.address();
      if (bound === null || typeof bound === 'string') {
        reject(Object.assign(new Error('The server started but reported no address.'), { exitCode: EXIT.serve }));
        return;
      }
      // ⚠️ The port is read back rather than echoed: `--port 0` is a real request (take any free
      // port) and the number the caller passed is then not the number anybody can connect to.
      io.err(describeAccess(access, bound.port, lanAddress() || undefined) + '\n');
      resolve({ server, address: bound.address, port: bound.port, token: access.token });
    });
  });
}

/** The command: start, say what is listening, and stay up until the process is stopped. */
export async function runServe(args: ServeArgs, io: CliIO): Promise<ExitCode> {
  try {
    const handle = await startServe(args, io);
    io.err(`Serving ${args.dir}. Press Ctrl+C to stop.\n`);
    await new Promise<void>((resolve) => {
      const stop = () => {
        handle.server.close(() => resolve());
        // A kept-alive browser connection never ends on its own, so waiting for `close` alone
        // hangs on Ctrl+C — the same wall `web-server.js` hits when it rebinds.
        handle.server.closeAllConnections?.();
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    return EXIT.ok;
  } catch (error) {
    io.err(String(error instanceof Error ? error.message : error) + '\n');
    const code = (error as { exitCode?: ExitCode }).exitCode;
    return code ?? EXIT.serve;
  }
}
