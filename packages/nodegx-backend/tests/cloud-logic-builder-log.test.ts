/**
 * FIX-004 acceptance 2, the cloud half: a `noodl_log` block prints from inside a real cloud
 * function.
 *
 * The browser half was driven in session 35 — a `noodl_log` under a hat printed in the live
 * viewer's own renderer, and the on-screen counter moved, so the program ran end to end. The
 * cloud half was left as a **source read**: `noodl-viewer-cloud/src/sandbox.isolate.js` installs
 * `global.console`, therefore a log block "should" work server-side. That is a claim about a file,
 * not a measurement, and this suite replaces it with one.
 *
 * ## 🔴 The mechanism the task file named is not on any path this repo can execute
 *
 * FIX-004 said to expect `_noodl_api_call('log', …)` rather than stdout, because
 * `sandbox.isolate.js:26` installs a `global.console` that forwards there. **That is a description
 * of dead code.** `webpack.prod.js:1-6` records the retirement in its own words — *"That server and
 * its cloudruntime sandbox are deleted — cloud functions now run inside nodegx-backend, which
 * esbuilds this package's `src/` directly via the `@cloud-runtime` alias"* — and the shim cannot
 * work here regardless: `_noodl_api_call` has **no implementation anywhere in this repo**, only the
 * four call sites inside `sandbox.isolate.js` itself. It was the external `noodl-cloudservice`'s
 * host global. Nothing in `noodl-editor/src` or `nodegx-backend/src` loads the isolate bundle; the
 * only references left are three doc comments.
 *
 * ⚠️ **So this file is not one of two paths, it is the path.** `nodegx-backend` imports the real
 * `CloudRunner` out of `noodl-viewer-cloud` (`@cloud-runtime`, `WorkflowRunner.ts:38`)
 * **in-process**, `console` is Node's own, and a line goes to real stdout. The isolate bundle is
 * still *built* as the published `@noodl/cloud-runtime` artefact, so an external consumer outside
 * this repo could still supply those globals — that is the one residual, and it is not something a
 * spec here can reach.
 *
 * 🔴 `NoodlBlocks.ts`'s own comment on `noodl_log` is where the task file's error came from: it
 * cites `sandbox.isolate.js:26` as the reason the block works server-side. The *conclusion* is
 * right and the *reason* is stale — it works because the runner is in-process, which is why this
 * suite can see the line at all.
 *
 * ✅ **The `Logic Builder` node reaches the cloud runtime at all** — it is in the *shared* list
 * (`noodl-runtime.ts:190`), and the `type !== 'cloud'` subtraction at `:323` does not name it.
 * Independently confirmed by the generated cloud picker snapshot
 * (`noodl-editor/src/editor/src/models/nodelibrary/cloud-node-library.json`, which lists
 * `'Logic Builder'` under `CustomCode`).
 *
 * ## The control, because "the probe appeared in stdout" has a boring explanation
 *
 * A single arm cannot tell *the block logged it* from *something else printed the function's
 * source, its inputs, or its execution record*. Both graphs below therefore carry a **unique probe
 * string inside their generated code**, and differ only in whether that string sits inside the
 * `console.log(…)` the block generates:
 *
 *   - treatment: `console.log('<PROBE_LOGGED>');`
 *   - control:   `'<PROBE_UNLOGGED>';`   — a bare expression statement; runs, prints nothing
 *
 * Both are invoked, both answer 200, and only the treatment probe appears. That isolates the
 * generated `console.log` rather than "code ran".
 *
 * ⚠️ The generated form asserted here (`console.log('…');`) is the real generator's output, pinned
 * in `noodl-editor/tests-unit/fix-004/blocks.spec.ts` — "generates console.log, which both
 * runtimes provide", which builds a `noodl_log` with a `text` literal in headless Blockly. The two
 * files are coupled by that literal and each is in a gate, so a generator change goes red in the
 * editor suite; nothing imports across the package boundary.
 *
 * ## 🔴 The finding this suite exists to record as well as the pass
 *
 * `net.noodl.Log` — the node — writes through the service's structured logger and is therefore
 * levelled, carries the request id, lands in the execution record, and is **redacted both by key
 * and by value** (`cloud-log-node.test.ts`, CWF-013). A `noodl_log` **block** compiles to a bare
 * `console.log`, which is none of those things. The secret case is measured below rather than
 * reasoned about, because the two mechanisms are independent and the answer decides whether
 * FIX-004 shipped a way to leak a provisioned secret into stdout.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { logger } from '../src/ops/logger';
import { REDACTED } from '../src/ops/redact';
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

/** Appears inside `console.log(…)`. Must reach stdout. */
const PROBE_LOGGED = 'FIX004-CLOUD-PROBE-LOGGED-7391';
/** Appears in the control's code as a bare statement. Must NOT reach stdout. */
const PROBE_UNLOGGED = 'FIX004-CLOUD-PROBE-UNLOGGED-6142';
/** Provisioned in `secrets.json`, then logged from a block program. */
const STORED_SECRET = 'sk_live_block_logged_4d7e19b0';
/** Logged on the statement BEFORE a deliberate throw. Must reach stdout. */
const PROBE_BEFORE_THROW = 'FIX004-CLOUD-PROBE-BEFORE-2208';
/** Logged on the statement AFTER it. Must not. */
const PROBE_AFTER_THROW = 'FIX004-CLOUD-PROBE-AFTER-9954';

/**
 * Request → Logic Builder → Response.
 *
 * `run` is the node's only way in — "the blocks never run on their own, so a value arriving at an
 * input changes nothing until this fires" (`logic-builder.ts:630`). `success` fires only after the
 * body ran through without throwing, so wiring it to the Response node makes a 200 evidence that
 * the program executed rather than that the function was merely reachable. A throw would route to
 * `failure`, which is wired nowhere — and CWF-018 records that `POST /functions/:name` then hangs
 * with no timeout, so a hang here is a red test, not a silent pass.
 */
function logicFunction(name: string, generatedCode: string) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      {
        id: 'req',
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true, params: 'note' },
        ports: [],
        children: []
      },
      {
        id: 'lb',
        type: 'Logic Builder',
        x: 0,
        y: 100,
        parameters: { generatedCode },
        ports: [],
        children: []
      },
      {
        id: 'res',
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'ok' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: 'req', sourcePort: 'receive', targetId: 'lb', targetPort: 'run' },
      { sourceId: 'req', sourcePort: 'pm-note', targetId: 'res', targetPort: 'pm-ok' },
      { sourceId: 'lb', sourcePort: 'success', targetId: 'res', targetPort: 'send' }
    ],
    roots: []
  };
}

/** The treatment: exactly what the block generator emits for a `noodl_log` holding a text literal. */
const loggedFunction = logicFunction('lbLogged', `console.log('${PROBE_LOGGED}');\n`);

/**
 * The control. Same node, same wiring, same run; the probe is in the code but not in a
 * `console.log`. A bare string expression statement is legal and does nothing.
 */
const unloggedFunction = logicFunction('lbUnlogged', `'${PROBE_UNLOGGED}';\n`);

/**
 * The arm that grades this suite's own oracle.
 *
 * Both arms above read a 200 as "the program body ran", because `success` is wired to `send`. That
 * reading is only worth anything if `success` is genuinely gated on the body — so here the body
 * logs, throws, and logs again, and `failure` is what carries the response. If the BEFORE probe
 * prints and the AFTER one does not, statements really are executing in order in a real cloud
 * function; and if this arm's 200 arrives with the thrown message in it, `failure` and `success`
 * are distinct outcomes rather than two names for "finished".
 *
 * `failure` is wired deliberately: CWF-018 records that an unwired failure path leaves
 * `POST /functions/:name` hanging with no timeout, which would turn this into a 40-second red.
 */
const throwingFunction = {
  name: '/#__cloud__/lbThrows',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'note' },
      ports: [],
      children: []
    },
    {
      id: 'lb',
      type: 'Logic Builder',
      x: 0,
      y: 100,
      parameters: {
        generatedCode:
          `console.log('${PROBE_BEFORE_THROW}');\n` +
          `throw new Error('deliberate-fix004-stop');\n` +
          `console.log('${PROBE_AFTER_THROW}');\n`
      },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 200,
      parameters: { params: 'ok' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'receive', targetId: 'lb', targetPort: 'run' },
    // The node's own account of what went wrong, carried out in the body.
    { sourceId: 'lb', sourcePort: 'error', targetId: 'res', targetPort: 'pm-ok' },
    // Only `failure` — a 200 here therefore cannot have come from `success`.
    { sourceId: 'lb', sourcePort: 'failure', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

/**
 * The secret pair. Both fetch `STRIPE_KEY` through the real `Secret` node and hand it to a block
 * program; they differ only in whether the program logs it.
 *
 * 🔴 Without the non-logging arm, "the secret is in stdout" would be unattributed — the `Secret`
 * node, the runner, or the execution record could each have printed it, and the conclusion would
 * name the wrong mechanism. The non-logging arm runs first, so its assertion is about a stdout
 * buffer that the logging arm has not touched yet.
 */
function secretGraph(name: string, generatedCode: string) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      {
        id: 'req',
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true, params: 'note' },
        ports: [],
        children: []
      },
      {
        id: 'sec',
        type: 'noodl.cloud.secret',
        x: 0,
        y: 100,
        parameters: { name: 'STRIPE_KEY' },
        ports: [],
        children: []
      },
      { id: 'lb', type: 'Logic Builder', x: 0, y: 200, parameters: { generatedCode }, ports: [], children: [] },
      {
        id: 'res',
        type: 'noodl.cloud.response',
        x: 0,
        y: 300,
        parameters: { params: 'ok' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
      { sourceId: 'sec', sourcePort: 'value', targetId: 'lb', targetPort: 'secret' },
      { sourceId: 'sec', sourcePort: 'done', targetId: 'lb', targetPort: 'run' },
      { sourceId: 'req', sourcePort: 'pm-note', targetId: 'res', targetPort: 'pm-ok' },
      { sourceId: 'lb', sourcePort: 'success', targetId: 'res', targetPort: 'send' }
    ],
    roots: []
  };
}

/**
 * The control: the secret arrives and is logged *derived* — its length, never its text.
 *
 * Logging the length rather than nothing at all is what makes this a control rather than a second
 * unknown. It proves three things at once: `console.log` reaches stdout in this graph too, the
 * secret genuinely arrived at `Inputs["secret"]` (the assertion names the real length, 29; a dead
 * wire would print `SECRETLEN:9`, `String(undefined).length`), and the secret's own text is absent
 * from stdout while a value computed from it is present. So the leak in the next arm is
 * attributable to the block printing the value, not to anything else in the service printing it.
 */
const secretNoLogFunction = secretGraph(
  'lbSecretNoLog',
  `console.log('SECRETLEN:' + String(Inputs["secret"]).length);\n`
);

/** A block program logging a value that came out of the service's own secret store. */
const secretFunction = {
  name: '/#__cloud__/lbSecret',
  nodes: [
    {
      id: 'req',
      type: 'noodl.cloud.request',
      x: 0,
      y: 0,
      parameters: { allowNoAuth: true, params: 'note' },
      ports: [],
      children: []
    },
    { id: 'sec', type: 'noodl.cloud.secret', x: 0, y: 100, parameters: { name: 'STRIPE_KEY' }, ports: [], children: [] },
    {
      id: 'lb',
      type: 'Logic Builder',
      x: 0,
      y: 200,
      // What a `noodl_log` fed from a value socket generates: the value, not a literal.
      parameters: { generatedCode: 'console.log(Inputs["secret"]);\n' },
      ports: [],
      children: []
    },
    {
      id: 'res',
      type: 'noodl.cloud.response',
      x: 0,
      y: 300,
      parameters: { params: 'ok' },
      ports: [],
      children: []
    }
  ],
  connections: [
    { sourceId: 'req', sourcePort: 'receive', targetId: 'sec', targetPort: 'fetch' },
    { sourceId: 'sec', sourcePort: 'value', targetId: 'lb', targetPort: 'secret' },
    { sourceId: 'sec', sourcePort: 'done', targetId: 'lb', targetPort: 'run' },
    { sourceId: 'req', sourcePort: 'pm-note', targetId: 'res', targetPort: 'pm-ok' },
    { sourceId: 'lb', sourcePort: 'success', targetId: 'res', targetPort: 'send' }
  ],
  roots: []
};

describe('a noodl_log block inside a real cloud function (FIX-004 acceptance 2)', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let previousLevel: string | undefined;
  let stdoutSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;
  const captured: string[] = [];

  const client = httpClient(() => base);

  /** Everything the function printed, by either door. A bare `console.log` is not JSON. */
  const everything = () => captured.join('\n');

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-lb-log-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'workflows', 'lb.workflow.json'),
      JSON.stringify({
        components: [loggedFunction, unloggedFunction, throwingFunction, secretNoLogFunction, secretFunction],
        settings: {},
        metadata: {}
      })
    );
    fs.writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify({ functions: { STRIPE_KEY: STORED_SECRET } }, null, 2), {
      mode: 0o600
    });

    /**
     * 🔴 **This suite used to leave the logger silent, and that premise EXPIRED.**
     *
     * The sentence that was here read: *"a `console.log` from generated code does not go through
     * the logger, and leaving it silent means anything this suite sees on stdout came from the
     * block program."* Both halves were true when it was written and the first half is now false —
     * FIX-004's redaction ruling (b) routes a block program's `console` through the run's log sink,
     * which is the structured logger's door (`noodl-runtime/nodes/std-library/logic-builder-console.ts`).
     *
     * ⚠️ Left silent, every presence assertion below fails — and fails for a reason that has
     * nothing to do with whether the block printed. That is the shape of a suite that would have
     * reported a working feature as broken, so the level is opened deliberately rather than the
     * assertions being weakened.
     *
     * 🔴 **`NODEGX_LOG_LEVEL` beats the `configure` option** — `ops/logger.ts:78` reads
     * `envLogLevel() || options.level`, so `configure({ level: 'info' })` alone is a no-op while
     * `setup-logging.js`'s `silent` is still in the environment. The env var goes first. Getting
     * this backwards produces a green-looking call and a silent logger.
     */
    previousLevel = process.env.NODEGX_LOG_LEVEL;
    delete process.env.NODEGX_LOG_LEVEL;
    logger.configure({ level: 'info' });

    /**
     * 🔴 Both doors are captured, and the reason is a trap this suite walked into.
     *
     * Spying `process.stdout.write` alone — which is what `cloud-log-node.test.ts` does — passes
     * when this file runs on its own and **fails all four presence assertions in the full suite
     * run**. Jest executes a lone test file in band, where its `Console` ends up writing to this
     * process's stdout; in a worker it buffers output and ships it to the parent over IPC, so
     * `process.stdout.write` is never called. `cloud-log-node.test.ts` is immune because the
     * structured logger calls `process.stdout.write` **directly** (`src/ops/logger.ts:61`), going
     * around jest's console entirely — and a bare `console.log` from generated code cannot.
     *
     * ⚠️ So a `process.stdout.write` spy is the wrong instrument for this claim, and it is wrong in
     * the direction that looks fine locally. Spying `console.log` catches the call wherever jest
     * routes it afterwards; the stdout spy is kept beside it so neither routing can hide a line.
     */
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      captured.push(String(chunk));
      return true;
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(' '));
    });

    service = new BackendService({ dataDir, port: 0, backendId: 'lb_log', backendName: 'Logic Builder log' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    consoleSpy.mockRestore();
    stdoutSpy.mockRestore();
    if (previousLevel === undefined) delete process.env.NODEGX_LOG_LEVEL;
    else process.env.NODEGX_LOG_LEVEL = previousLevel;
    logger.configure({ level: 'silent' });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('prints nothing before the function is called, so loading a graph does not log its own source', () => {
    // Without this, "the probe is in stdout" would also be satisfied by the runner printing the
    // code it loaded — and the treatment assertion below would prove nothing about running it.
    expect(everything()).not.toContain(PROBE_LOGGED);
    expect(everything()).not.toContain(PROBE_UNLOGGED);
  });

  it('reaches stdout from a cloud function, which is the half acceptance 2 had only read about', async () => {
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/lbLogged', {
      body: { note: 'go' }
    });

    // 200 by way of `success` → `send`: the body ran through without throwing.
    expect(res.status).toBe(200);
    expect(res.json.result.ok).toBe('go');
    expect(everything()).toContain(PROBE_LOGGED);
  });

  it('does NOT print the control probe, though the control ran and its code contains it', async () => {
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/lbUnlogged', {
      body: { note: 'go' }
    });

    // The known-firing signal beside the absence: this arm demonstrably executed.
    expect(res.status).toBe(200);
    expect(res.json.result.ok).toBe('go');

    // ...and its probe is nowhere, so the treatment's probe came out of `console.log` and not out
    // of the runner echoing generated code, inputs, or an execution record.
    expect(everything()).not.toContain(PROBE_UNLOGGED);
  });

  /**
   * The instrument check. See `throwingFunction` — this is what entitles the two arms above to
   * read a 200 as "the body ran".
   */
  it('executes statements in order and stops at a throw, so `success` is not a synonym for finished', async () => {
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/lbThrows', {
      body: { note: 'go' }
    });

    // The response came out of `failure`, which is the only outcome wired to `send` here.
    expect(res.status).toBe(200);
    expect(res.json.result.ok).toContain('deliberate-fix004-stop');

    // The block printed before the throw...
    expect(everything()).toContain(PROBE_BEFORE_THROW);
    // ...and never reached the statement after it.
    expect(everything()).not.toContain(PROBE_AFTER_THROW);
  });

  /**
   * The control for the arm below. Runs FIRST, on a stdout buffer no secret text has reached.
   */
  it('leaks nothing when the block logs a value DERIVED from a secret, though the secret did arrive', async () => {
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/lbSecretNoLog', {
      body: { note: 'go' }
    });
    expect(res.status).toBe(200);

    // The wire is live: the length printed is the real secret's, not `"undefined"`.length.
    expect(everything()).toContain(`SECRETLEN:${STORED_SECRET.length}`);
    // And nothing in the service printed the secret itself up to this point.
    expect(everything()).not.toContain(STORED_SECRET);
  });

  /**
   * ✅ **CLOSED by FIX-004's redaction ruling (b).** This row used to record a leak.
   *
   * `net.noodl.Log` value-redacts a provisioned secret out of its message (CWF-013), and the
   * scrubber lives on the structured logger's door. A block's `console.log` did not use that door
   * — so this assertion read `…in the clear: true` and was the measurement the ruling was made on.
   * The block program's `console` is now the run's sink, so it uses the same door and gets the same
   * value-based pass.
   *
   * ✅ **The expected string is still the full sentence rather than `toBe(false)`**, for the reason
   * the original gave: a change of answer should show the answer. If this ever flips back it says
   * so in words.
   */
  it('scrubs a PROVISIONED SECRET logged from a block program, as the Log node already did', async () => {
    const res = await client.request<{ result: { ok?: string } }>('POST', '/functions/lbSecret', {
      body: { note: 'go' }
    });
    expect(res.status).toBe(200);

    const leaked = everything().includes(STORED_SECRET);
    expect(`a block-logged secret reaches stdout in the clear: ${leaked}`).toBe(
      'a block-logged secret reaches stdout in the clear: false'
    );

    /**
     * 🔴 The absence above needs a firing signal beside it, or it also passes when the block
     * printed nothing at all — which is precisely how a broken `console` would look. `REDACTED` is
     * the scrubber's replacement text, so its presence proves the line was written, reached the
     * sink, and was scrubbed there rather than never having been emitted.
     */
    expect(everything()).toContain(REDACTED);
  });
});
