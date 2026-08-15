/**
 * Finding and killing everything a NodeGX dev session starts.
 *
 * The dev stack is four levels deep and every level is a different tool:
 *
 *   dev-debug.js → ts-node start.ts → sh → npx → lerna → npm → webpack-dev-server
 *                                                                    └→ npm → electron → nodegx-backend
 *
 * `start.ts` spawns its three branches `detached`, which is what lets it kill a
 * whole subtree by process group — but detaching also means the children are NOT
 * killed when the launcher dies. Anything that takes the launcher out without
 * running its handlers (`kill -9`, `pkill -f node`, a crashed terminal, a laptop
 * that ran out of patience) therefore leaves the webpack watchers running
 * forever. They keep recompiling on file changes, so they are not idle — this is
 * the runaway-CPU leak.
 *
 * This module is the shared answer, used by three callers:
 *
 *   - scripts/start.ts       reaps leftovers at startup, before adding more
 *   - scripts/devtools/dev-watchdog.js  reaps when the launcher dies unexpectedly
 *   - scripts/devtools/stop-dev.js      `npm run dev:stop`, the manual escape hatch
 *
 * SAFETY. A sweep that guesses wrong kills the user's editor or the terminal it
 * is running in. Two rules keep it honest:
 *
 *   1. A process is only a *seed* if its command line contains this repo's
 *      absolute path AND names a known dev tool. Both, never either. That is
 *      what keeps a sibling git worktree's dev stack — same tool names, different
 *      path — out of the blast radius.
 *   2. The caller's own process and every one of its ancestors are excluded, so
 *      a sweep can never kill the shell, the terminal, or itself.
 *
 * Everything else killed is a *descendant* of a seed, discovered from the live
 * process table, so the `sh -c npx lerna ...` wrappers and the webpack-dev-server
 * that retitles itself to a bare "webpack" are both reached without having to
 * match their command lines at all.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Records the pids of a running session so a *later* run — or the watchdog — can
 * reap them if this one is hard-killed before its cleanup can fire.
 */
const PID_FILE = path.join(ROOT, 'node_modules', '.cache', 'noodl-dev-pids.json');

const WINDOWS = process.platform === 'win32';

/**
 * Tool names that identify a dev-stack process. Matched only in combination with
 * the repo path — `webpack` alone would match half the machine.
 *
 * `scripts/devtools/` is matched as a directory rather than by naming each helper,
 * so a helper added later is swept without anyone remembering to come back here.
 * The three that must survive a sweep — the watchdog, this module, `stop-dev` —
 * are excluded by name in `findDevProcesses` *before* this test runs.
 *
 * ⚠️ **Why the directory was added, 2026-08-12.** `render-from-disk.js` holds a
 * port and runs until killed. One was found alive after **22 hours**, invisible to
 * `dev:stop`, which reported "No NodeGX dev processes are running" while it ran:
 * its command line contains the repo path, so rule 1's first half passed, but no
 * name in this pattern matched it. Every long-running helper here had the same
 * hole.
 */
const DEV_TOOL = /webpack|lerna|electron[/\\]dist|nodegx-backend|start-electron-dev|scripts[/\\]start\.ts|dev-debug\.js|scripts[/\\]devtools[/\\]/;

/**
 * The per-checkout agent scratchpad, e.g.
 * `/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/`.
 *
 * Session helpers (`drive.mjs`, one-off probes) are launched from here with a
 * *project* path as their argument, so their command lines never contain the repo
 * path and rule 1 cannot see them at all. Two were found alive after **four
 * days**.
 *
 * The directory name encodes the checkout, so matching on it keeps the sweep
 * checkout-scoped exactly as rule 1 intends: `/` and `_` both become `-`.
 *
 * 🔴 **Never a seed by default.** A sibling agent session's live drive lives here
 * too, and killing it mid-run is silent and unattributable. Opt in with
 * `includeScratchpad`, and prefer `--stale` — an age floor reaps the four-day
 * corpse without touching the drive someone started ten minutes ago.
 */
const SESSION_SCRATCH = `${ROOT.replace(/[/\\_]/g, '-')}/`;

/**
 * Is this process *running a script from* the session scratchpad, as opposed to
 * merely mentioning the path?
 *
 * 🔴 **The distinction is not pedantry, and it was found by running the sweep.**
 * A plain substring test matched the shell of a live `test:ci` — whose only
 * connection to the scratchpad was `> …/testci-39386.log` in a redirect. `--all`
 * would have killed the run it was reporting on. So the token carrying the
 * scratchpad path must be the *script*: it has to end in a JS extension, which a
 * `.log`, a `.fifo` or an output directory never does.
 */
function runsScriptFromScratchpad(command) {
  if (!command.includes(SESSION_SCRATCH)) return false;
  return command
    .split(/\s+/)
    .some((token) => token.includes(SESSION_SCRATCH) && /\.(mjs|cjs|js)$/.test(token));
}

/**
 * The launcher wrappers, which sit *above* the seeds rather than below them.
 *
 * They are invoked with relative paths — `npm exec ts-node -P ./scripts/tsconfig.json
 * ./scripts/start.ts`, `node ./scripts/devtools/dev-debug.js` — so their command
 * lines never contain the repo path and the seed rule cannot see them. They are
 * identified instead by being an *ancestor of a confirmed seed*, which is a
 * stronger signal than any name match: a process cannot be the parent of this
 * checkout's webpack by coincidence.
 */
const DEV_LAUNCHER = /scripts[/\\]start\.ts|devtools[/\\]dev-debug\.js|run dev(:debug)?\b|lerna exec --scope/;

// ---------------------------------------------------------------------------
// Process table
// ---------------------------------------------------------------------------

/**
 * `ps` elapsed time — `[[dd-]hh:]mm:ss` — as seconds.
 *
 * Returns 0 for anything unparseable, which is the safe direction: an unknown age
 * reads as *brand new*, so a `--stale` floor skips it rather than killing it.
 */
function parseEtime(etime) {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(String(etime).trim());
  if (!m) return 0;
  const [, days, hours, minutes, seconds] = m;
  return Number(days || 0) * 86400 + Number(hours || 0) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * The live process table as a Map<pid, {pid, ppid, ageSeconds, command}>.
 *
 * Taken in one `ps` call rather than one per pid: a sweep walks it several times
 * (seeds, then descendants, then survivors after SIGTERM) and a stale table
 * between those passes would miss processes that were only just spawned.
 *
 * `etime` is requested ahead of `command` because `command` is the only field that
 * can contain spaces, so it must stay last for the line to be splittable at all.
 */
function snapshot() {
  const table = new Map();
  if (WINDOWS) return table;

  let out;
  try {
    out = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,etime=,command='], {
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString();
  } catch {
    return table;
  }

  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    table.set(Number(m[1]), {
      pid: Number(m[1]),
      ppid: Number(m[2]),
      ageSeconds: parseEtime(m[3]),
      command: m[4]
    });
  }
  return table;
}

/**
 * The pids a sweep must never touch: always this process, and — for callers that
 * are running *inside* a terminal — everything above it too.
 *
 * `includeAncestors` is not a formality. `stop-dev.js` and `start.ts` both run as
 * descendants of the user's shell, so without it a sweep would kill the terminal
 * it was typed into. The watchdog is the opposite case: its parent IS the dead
 * launcher whose stack it was started to clean up, so protecting its ancestry
 * would spare the very processes it exists to kill.
 */
function selfAndAncestors(table, includeAncestors = true) {
  const protectedPids = new Set([0, 1, process.pid]);
  if (!includeAncestors) return protectedPids;

  let pid = process.pid;
  // Bounded: a pid can only be visited once, and the table is finite.
  const seen = new Set();
  while (pid && !seen.has(pid)) {
    seen.add(pid);
    const proc = table.get(pid);
    if (!proc) break;
    protectedPids.add(proc.ppid);
    pid = proc.ppid;
  }
  return protectedPids;
}

/**
 * Climbs from each seed towards init, collecting the launcher wrappers above it.
 *
 * Stops at the first ancestor that does not look like a launcher, so the climb
 * can never escape the dev stack into the shell or the terminal — and `protected`
 * (this process and its own ancestors) is an absolute floor on top of that.
 */
function launcherAncestors(seeds, table, protectedPids) {
  const found = new Set();
  for (const seed of seeds) {
    let pid = table.get(seed)?.ppid;
    const visited = new Set();
    while (pid && pid > 1 && !visited.has(pid) && !protectedPids.has(pid)) {
      visited.add(pid);
      const proc = table.get(pid);
      if (!proc || !DEV_LAUNCHER.test(proc.command)) break;
      found.add(pid);
      pid = proc.ppid;
    }
  }
  return found;
}

/** Every descendant of `roots`, plus the roots themselves. */
function withDescendants(roots, table) {
  const children = new Map();
  for (const proc of table.values()) {
    if (!children.has(proc.ppid)) children.set(proc.ppid, []);
    children.get(proc.ppid).push(proc.pid);
  }

  const collected = new Set();
  const queue = [...roots];
  while (queue.length) {
    const pid = queue.pop();
    if (collected.has(pid) || !table.has(pid)) continue;
    collected.add(pid);
    for (const child of children.get(pid) || []) queue.push(child);
  }
  return collected;
}

/**
 * Work that a sweep must never touch, however dev-stack-shaped it looks.
 *
 * 🔴 Skipping these in the seed loop is NOT enough, and that mistake shipped
 * twice. A `continue` there only stops a process being *chosen* as a seed; it
 * cannot stop it being *inherited*, because `withDescendants` re-adds every
 * child of every seed afterwards and only `offLimits` is subtracted. A running
 * `test:ci` is a grandchild of `npm exec lerna exec --scope noodl-editor`,
 * which contains ROOT and matches DEV_TOOL — so the wrapper seeds and the whole
 * suite came back in underneath it.
 *
 * Measured 2026-08-15 21:11 with a suite genuinely live: `dev:stop -- --list`
 * (a dry run — `stop-dev.js` exits before `sweep()`) listed all ten suite
 * processes as targets, `Electron test.js --ci` among them, while the seed-loop
 * skip was doing its job correctly. A guard can pass its own test and still be
 * inert.
 *
 * ⚠️ The MCP skip had the identical hole and looked fine only by topology: an
 * MCP server hangs off the Claude session pid, so it is never below a dev seed.
 * Nothing about the old guard protected it. Spawn one under a wrapper and it
 * would have been swept too.
 */
const NEVER_SWEEP = /noodl-mcp\.cjs|test\.js --ci|run-electron-tests\.js|webpack\.test-ci|run test:(ci|main)\b/;

/**
 * Every protected process, plus the whole tree each one needs to survive in.
 *
 * Sparing the guarded pid alone is not enough in either direction:
 *
 * - **Downwards** — an Electron suite host owns renderer and GPU helpers, and
 *   killing those ends the run just as surely as killing the host, but more
 *   confusingly.
 * - **Upwards** — the run also dies if its npm/lerna wrapper is killed, and the
 *   wrapper is precisely what `launcherAncestors` seeds. The climb reuses
 *   `launcherAncestors` so the shield stops exactly where the seeding stops and
 *   can never escape into the shell.
 *
 * ⚠️ Deliberately absolute: no age floor applies. A genuinely dead suite is
 * therefore not reapable by `dev:stop` and must be killed by pid — the same
 * bargain the MCP servers have always had, and the safe direction for a tool
 * whose failure mode is destroying someone's fifteen-minute gate run.
 */
function protectedProcesses(table, offLimits) {
  const matched = [];
  for (const proc of table.values()) {
    if (NEVER_SWEEP.test(proc.command)) matched.push(proc.pid);
  }
  if (matched.length === 0) return new Set();

  const shielded = withDescendants(matched, table);
  for (const pid of launcherAncestors(matched, table, offLimits)) shielded.add(pid);
  return shielded;
}

// ---------------------------------------------------------------------------
// Pid file
// ---------------------------------------------------------------------------

/**
 * Reads the pid file, tolerating the bare-array format earlier versions wrote so
 * an in-flight session from before this change is still reapable.
 */
function readPidFile() {
  try {
    const raw = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
    if (Array.isArray(raw)) return { groups: raw.filter((n) => typeof n === 'number'), launchers: [], watchdog: null };
    return {
      groups: Array.isArray(raw.groups) ? raw.groups.filter((n) => typeof n === 'number') : [],
      launchers: Array.isArray(raw.launchers) ? raw.launchers.filter((n) => typeof n === 'number') : [],
      watchdog: typeof raw.watchdog === 'number' ? raw.watchdog : null
    };
  } catch {
    return { groups: [], launchers: [], watchdog: null };
  }
}

function writePidFile(record) {
  try {
    fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
    fs.writeFileSync(PID_FILE, JSON.stringify({ ...readPidFile(), ...record }));
  } catch {
    // Non-fatal: we only lose cross-session reaping for this run.
  }
}

function removePidFile() {
  try {
    fs.rmSync(PID_FILE, { force: true });
  } catch {
    // Ignore.
  }
}

// ---------------------------------------------------------------------------
// Killing
// ---------------------------------------------------------------------------

/**
 * Signals a whole process group. `start.ts` spawns each branch `detached`, so
 * each is a group leader (pgid === pid) and the negative-pid form reaches every
 * descendant in one call — including processes that have already been reparented
 * to launchd and so are no longer findable by walking down from the launcher.
 */
function killGroup(pgid, signal) {
  try {
    process.kill(-pgid, signal);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means it exists but belongs to someone else — still alive.
    return err.code === 'EPERM';
  }
}

/** Blocking sleep. The sweep is deliberately synchronous; see sweep(). */
function sleepSync(seconds) {
  try {
    execFileSync('/bin/sleep', [String(seconds)], { stdio: 'ignore' });
  } catch {
    // Ignore — worst case we escalate to SIGKILL sooner than intended.
  }
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/**
 * Finds every process belonging to a NodeGX dev session in this checkout.
 *
 * Returns the processes, not just their pids, so callers can report what they
 * killed — a sweep that prints nothing is indistinguishable from a sweep that
 * silently did the wrong thing.
 */
function findDevProcesses({ protectAncestors = true, includeScratchpad = false, minAgeSeconds = 0 } = {}) {
  const table = snapshot();
  if (table.size === 0) return [];

  const offLimits = selfAndAncestors(table, protectAncestors);
  // Computed before seeding and honoured at every later step — see NEVER_SWEEP
  // for why the old seed-loop-only skips could not work.
  const shielded = protectedProcesses(table, offLimits);

  const seeds = [];
  for (const proc of table.values()) {
    if (offLimits.has(proc.pid)) continue;
    if (proc.command.includes('dev-watchdog.js')) continue;
    if (proc.command.includes('dev-processes.js') || proc.command.includes('stop-dev.js')) continue;

    // The user's MCP servers run this checkout's electron/dist binary with
    // packages/noodl-mcp/dist/noodl-mcp.cjs as argv — repo path AND a known tool,
    // so rule 1 alone reads them as a dev stack. They are a live connection to a
    // project, not a stack, and age is no tell (one has been seen minutes old).
    //
    // 🔴 A running `test:ci` is the same binary with `test.js --ci` as argv, and
    // is a **gate in progress**, not a leftover. Measured 2026-08-15: `npm run
    // dev:debug` at 12:51:55 → `start.ts:49` `reapPreviousSession()` → this
    // sweep → a suite that had been running seven minutes died at 12:52:01,
    // `test-results.json` was never written, and **npm still exited 0**. The
    // loss is silent in both directions: the launcher is told it reaped an
    // orphan, and the suite's owner is told the run passed.
    //
    // Both cases now live in NEVER_SWEEP, because skipping them *here* was the
    // bug — a seed-loop skip cannot survive the descendant expansion below.
    if (shielded.has(proc.pid)) continue;

    // Rule 1: repo path AND a known tool. The watchdog is excluded by name — it
    // is the one process that must outlive the sweep it is running.
    const isDevStack = proc.command.includes(ROOT) && DEV_TOOL.test(proc.command);

    // Rule 1b: a session helper launched from this checkout's agent scratchpad.
    // Same checkout-scoping, different evidence — the path is in the *scratchpad*
    // name rather than the command's arguments. Off by default; see SESSION_SCRATCH.
    const isSessionHelper = includeScratchpad && runsScriptFromScratchpad(proc.command);

    if (!isDevStack && !isSessionHelper) continue;

    // An age floor is what separates a four-day corpse from a sibling's live
    // drive. Applied to seeds only: a young child of an old seed still belongs to
    // the old stack and goes with it.
    if (minAgeSeconds > 0 && proc.ageSeconds < minAgeSeconds) continue;

    seeds.push(proc.pid);
  }

  // A recorded group leader is a seed even when its own command line gives
  // nothing away: `sh -c npx lerna exec --scope ...` names no path at all.
  for (const pid of readPidFile().groups) {
    if (offLimits.has(pid) || shielded.has(pid) || !table.has(pid)) continue;
    // The age floor applies here too. Without it a `--stale 24` sweep, whose whole
    // point is to spare live work, would kill a dev stack started a minute ago.
    if (minAgeSeconds > 0 && table.get(pid).ageSeconds < minAgeSeconds) continue;
    seeds.push(pid);
  }

  // Wrappers above the seeds, then everything below the two combined — so a
  // stack whose middle was pkilled is still swept from both ends. The climb is
  // floored by the shield as well as by `offLimits`, so it cannot ascend
  // *through* a live suite's wrapper and seed it from above.
  const climbFloor = new Set([...offLimits, ...shielded]);
  for (const pid of launcherAncestors(seeds, table, climbFloor)) seeds.push(pid);

  const all = withDescendants(seeds, table);
  for (const pid of offLimits) all.delete(pid);
  // 🔴 This subtraction is the one that makes the shield real. Everything above
  // only decides what *seeds*; `withDescendants` has just re-added every child
  // of every seed, so a protected process re-enters here unless removed now.
  for (const pid of shielded) all.delete(pid);

  return [...all].map((pid) => table.get(pid)).filter(Boolean);
}

/**
 * Kills every dev process from this checkout: SIGTERM, a grace period, then
 * SIGKILL for whatever ignored it.
 *
 * Synchronous on purpose. Two of the three callers run at a point where the
 * event loop cannot be relied on — `start.ts` sweeps during module evaluation,
 * and the watchdog sweeps on the way out — and an async sweep that loses its
 * timer to `process.exit()` is precisely the bug this file exists to fix.
 *
 * @returns {{killed: {pid: number, command: string}[], dryRun: boolean}}
 */
function sweep({ dryRun = false, onLog, protectAncestors = true, includeScratchpad = false, minAgeSeconds = 0 } = {}) {
  const log = onLog || (() => {});

  if (WINDOWS) {
    // The tree-kill path on Windows lives in start.ts (`taskkill /T /F`), which
    // has no orphan problem: taskkill reaches the whole tree in one call.
    return { killed: [], dryRun };
  }

  const targets = findDevProcesses({ protectAncestors, includeScratchpad, minAgeSeconds });
  const record = readPidFile();

  if (targets.length === 0 && record.groups.length === 0) {
    return { killed: [], dryRun };
  }

  if (dryRun) {
    for (const proc of targets) log(`  would kill ${proc.pid}  ${proc.command.slice(0, 120)}`);
    return { killed: targets, dryRun: true };
  }

  for (const proc of targets) log(`  killing ${proc.pid}  ${proc.command.slice(0, 120)}`);

  // Groups first: one signal reaches descendants that have already been
  // reparented, which the process-table walk cannot see.
  for (const pgid of record.groups) killGroup(pgid, 'SIGTERM');
  for (const proc of targets) killPid(proc.pid, 'SIGTERM');

  sleepSync(1.5);

  for (const pgid of record.groups) killGroup(pgid, 'SIGKILL');
  for (const proc of targets) {
    if (alive(proc.pid)) killPid(proc.pid, 'SIGKILL');
  }

  return { killed: targets, dryRun: false };
}

module.exports = {
  ROOT,
  PID_FILE,
  alive,
  findDevProcesses,
  killGroup,
  readPidFile,
  removePidFile,
  sweep,
  writePidFile
};
