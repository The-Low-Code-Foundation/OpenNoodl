#!/usr/bin/env node
/**
 * Drive an arbitrary chat model through the **real `noodl-mcp` surface** — the
 * third cold-replay rig (LAS-010 §2).
 *
 * ## Why this exists
 *
 * Phase 55's bar requires a mid-tier *open-weight* model to build the storefront
 * brief, and no such replay had ever run. The two baselines (haiku, sonnet) went
 * through the `claude` CLI, which cannot drive anything but Claude. The editor's
 * own provider layer speaks ollama and any OpenAI-compatible gateway, but that
 * is the *in-editor* authoring loop — a different surface, so a run through it
 * would not be comparable with the baselines it is supposed to be scored beside.
 *
 * This bridges the two halves that already exist and never met: an
 * OpenAI-compatible `/chat/completions` endpoint on one side, a `noodl-mcp`
 * stdio server child on the other. Tools are advertised from the server's own
 * schemas, `tool_calls` are executed against it, results are fed back, and the
 * whole conversation lands in a JSONL transcript so a failure can be classified
 * from evidence rather than from the artefact alone.
 *
 * ## Plain JS on purpose
 *
 * Same reason as `render-report.js`: this is repo infrastructure that must run
 * from a fresh checkout with no build step of its own, and it depends on repo
 * layout anyway. The MCP client is ~90 lines of newline-delimited JSON-RPC
 * rather than the SDK, so the rig has no dependency that a `lerna clean` can
 * take away.
 *
 * ## Usage
 *
 *   node scripts/devtools/mcp-model-driver.js \
 *     --project "<project-dir>" \
 *     --base-url https://api.deepinfra.com/v1/openai \
 *     --model Qwen/Qwen2.5-Coder-32B-Instruct \
 *     --api-key-env DEEPINFRA_API_KEY \
 *     --prompt-file dev-docs/.../brief.txt \
 *     --out measurements/openweight-transcript.jsonl
 *
 *   node scripts/devtools/mcp-model-driver.js --project <dir> --list-tools
 *
 * The API key is read from the environment, never from a flag and never written
 * to the transcript.
 *
 * @module scripts/devtools/mcp-model-driver
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const MCP_BIN = path.join(REPO, 'packages/noodl-mcp/bin/noodl-mcp.js');

// ---------------------------------------------------------------------------
// MCP stdio client
// ---------------------------------------------------------------------------

/**
 * A `noodl-mcp` server running as a child process, spoken to over stdio.
 *
 * stdout is the protocol channel (newline-delimited JSON-RPC); stderr is the
 * server's human-facing output and is mirrored to the transcript, because the
 * backend reaper and provisioning both report there and a run that lost a
 * backend needs that line to explain itself.
 */
class McpStdioClient {
  constructor({ projectDir, allowWrites, onStderr }) {
    this.projectDir = projectDir;
    this.allowWrites = allowWrites;
    this.onStderr = onStderr || (() => {});
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.child = null;
    this.exited = null;
    /** AWP-006 — set by `notifications/tools/list_changed`, cleared on re-list. */
    this.toolsChanged = false;
  }

  async start() {
    const args = [MCP_BIN, this.projectDir];
    if (this.allowWrites) args.push('--allow-writes');
    this.child = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    this.exited = new Promise((resolve) => {
      this.child.on('exit', (code, signal) => {
        const err = new Error(`noodl-mcp exited (code=${code} signal=${signal})`);
        for (const { reject } of this.pending.values()) reject(err);
        this.pending.clear();
        resolve({ code, signal });
      });
    });

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this._onStdout(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk) => this.onStderr(String(chunk)));

    const init = await this.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'nodegx-mcp-model-driver', version: '1.0.0' }
    });
    this._notify('notifications/initialized', {});
    return init;
  }

  _onStdout(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // not protocol traffic; the server keeps stdout clean, but be forgiving
      }
      // AWP-006 — the server now hides the backend, docs, explore, project and
      // theme groups until `find_tools` asks for them, and announces the change
      // this way. A client that drops this notification never sees a revealed
      // tool, which turns a cost saving into a missing capability; this rig is
      // the one that measures whether that happened, so it must not be that
      // client. Flag only — the re-list happens between turns, not mid-parse.
      if (msg.id === undefined) {
        if (msg.method === 'notifications/tools/list_changed') this.toolsChanged = true;
        continue;
      }
      if (!this.pending.has(msg.id)) continue;
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.code}: ${msg.error.message}`));
      else resolve(msg.result);
    }
  }

  _write(obj) {
    this.child.stdin.write(JSON.stringify(obj) + '\n');
  }

  _notify(method, params) {
    this._write({ jsonrpc: '2.0', method, params });
  }

  request(method, params, timeoutMs = 180000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        }
      });
      this._write({ jsonrpc: '2.0', id, method, params });
    });
  }

  /** Every tool the server advertises, following `nextCursor` to the end. */
  async listTools() {
    const tools = [];
    let cursor;
    do {
      const page = await this.request('tools/list', cursor ? { cursor } : {});
      tools.push(...(page.tools || []));
      cursor = page.nextCursor;
    } while (cursor);
    return tools;
  }

  callTool(name, args) {
    return this.request('tools/call', { name, arguments: args || {} });
  }

  async stop() {
    if (!this.child) return;
    try {
      this.child.stdin.end();
    } catch {
      /* already gone */
    }
    const closed = await Promise.race([this.exited, new Promise((r) => setTimeout(() => r(null), 5000))]);
    if (!closed) this.child.kill('SIGTERM');
  }
}

// ---------------------------------------------------------------------------
// Wire-shape translation
// ---------------------------------------------------------------------------

/**
 * MCP tool → OpenAI function tool.
 *
 * The only real work is the schema: MCP tools carry `inputSchema` as plain JSON
 * Schema, which is what the OpenAI shape wants, but a tool with no properties
 * must still present an object schema or strict gateways reject the request.
 */
function toOpenAiTool(tool) {
  const schema = tool.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : {};
  const parameters = schema.type ? schema : { type: 'object', properties: {} };
  if (!parameters.properties) parameters.properties = {};
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: (tool.description || '').slice(0, 4096),
      parameters
    }
  };
}

/**
 * Flatten an MCP tool result into text the model can read.
 *
 * Image blocks are dropped and replaced by a one-line note. `render_report`
 * returns full-page screenshots as base64 and a non-multimodal model would
 * receive megabytes of noise it cannot see — but it must still be told the
 * screenshots exist, because otherwise the transcript would suggest the tool
 * returned nothing and the failure would be misclassified.
 */
function flattenToolResult(result, maxChars) {
  const parts = [];
  let images = 0;
  for (const block of (result && result.content) || []) {
    if (block.type === 'text') parts.push(block.text);
    else if (block.type === 'image') images++;
    else parts.push(`[${block.type} content]`);
  }
  if (images) parts.push(`[${images} screenshot image(s) returned — not shown to this model]`);
  let text = parts.join('\n').trim() || '(no content)';
  let truncated = false;
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + `\n… [truncated at ${maxChars} chars]`;
    truncated = true;
  }
  return { text, isError: Boolean(result && result.isError), images, truncated };
}

// ---------------------------------------------------------------------------
// The chat endpoint
// ---------------------------------------------------------------------------

async function chatCompletion({ baseUrl, apiKey, model, messages, tools, temperature, maxTokens, timeoutMs }) {
  const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
  const body = {
    model,
    messages,
    tool_choice: 'auto',
    temperature
  };
  if (tools && tools.length) body.tools = tools;
  if (maxTokens) body.max_tokens = maxTokens;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`chat/completions ${res.status}: ${text.slice(0, 2000)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`chat/completions returned non-JSON: ${text.slice(0, 2000)}`);
  }
  return json;
}

/**
 * Normalise the assistant message across gateways.
 *
 * Two divergences are common enough to be worth absorbing here rather than
 * discovering mid-run: `arguments` arriving as an object instead of a JSON
 * string (ollama's shim does this), and a missing `id` on a tool call (some
 * gateways omit it, and the follow-up `tool` message needs one to match).
 */
function normaliseAssistant(message, turn) {
  const calls = (message.tool_calls || []).map((call, i) => {
    const fn = call.function || {};
    let args = fn.arguments;
    if (typeof args !== 'string') args = JSON.stringify(args == null ? {} : args);
    return {
      id: call.id || `call_${turn}_${i}`,
      type: 'function',
      function: { name: fn.name, arguments: args }
    };
  });
  return {
    role: 'assistant',
    content: message.content || '',
    ...(calls.length ? { tool_calls: calls } : {})
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    project: null,
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    model: null,
    apiKeyEnv: 'DEEPINFRA_API_KEY',
    prompt: null,
    promptFile: null,
    system: null,
    systemFile: null,
    out: null,
    maxTurns: 60,
    temperature: 0.2,
    maxTokens: 4096,
    maxResultChars: 24000,
    requestTimeoutMs: 300000,
    priceIn: 0,
    priceOut: 0,
    listTools: false,
    toolsAllow: null,
    readOnly: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--project': out.project = next(); break;
      case '--base-url': out.baseUrl = next(); break;
      case '--model': out.model = next(); break;
      case '--api-key-env': out.apiKeyEnv = next(); break;
      case '--prompt': out.prompt = next(); break;
      case '--prompt-file': out.promptFile = next(); break;
      case '--system': out.system = next(); break;
      case '--system-file': out.systemFile = next(); break;
      case '--out': out.out = next(); break;
      case '--max-turns': out.maxTurns = Number(next()); break;
      case '--temperature': out.temperature = Number(next()); break;
      case '--max-tokens': out.maxTokens = Number(next()); break;
      case '--max-result-chars': out.maxResultChars = Number(next()); break;
      case '--request-timeout-ms': out.requestTimeoutMs = Number(next()); break;
      case '--price-in': out.priceIn = Number(next()); break;
      case '--price-out': out.priceOut = Number(next()); break;
      case '--tools': out.toolsAllow = next().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--list-tools': out.listTools = true; break;
      case '--read-only': out.readOnly = true; break;
      case '--help':
      case '-h': out.help = true; break;
      default:
        throw new Error(`unknown argument: ${a}`);
    }
  }
  return out;
}

const USAGE = `Usage: node scripts/devtools/mcp-model-driver.js --project <dir> [options]

Drives an OpenAI-compatible chat model through a noodl-mcp stdio server.

  --project <dir>            v2 project directory to serve (required)
  --base-url <url>           chat completions base (default DeepInfra's OpenAI shim)
  --model <id>               model id at that endpoint
  --api-key-env <NAME>       env var holding the key (default DEEPINFRA_API_KEY)
  --prompt <text> | --prompt-file <path>
  --system <text> | --system-file <path>
  --out <path.jsonl>         transcript (default stdout summary only)
  --max-turns <n>            default 60
  --tools <a,b,...>          advertise only these tool names (default: all)
  --price-in / --price-out   USD per million tokens, for the cost line
  --list-tools               print the served tool surface and exit
  --read-only                serve without --allow-writes
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.project) {
    process.stdout.write(USAGE);
    process.exitCode = opts.project ? 0 : 2;
    return;
  }

  const events = [];
  const outStream = opts.out ? fs.createWriteStream(opts.out, { flags: 'w' }) : null;
  const record = (event) => {
    const row = { t: new Date().toISOString(), ...event };
    events.push(row);
    if (outStream) outStream.write(JSON.stringify(row) + '\n');
  };

  const client = new McpStdioClient({
    projectDir: opts.project,
    allowWrites: !opts.readOnly,
    onStderr: (text) => {
      process.stderr.write(text);
      record({ kind: 'server-stderr', text: text.trim() });
    }
  });

  const init = await client.start();
  let tools = await client.listTools();
  client.toolsChanged = false;
  let served = opts.toolsAllow ? tools.filter((t) => opts.toolsAllow.includes(t.name)) : tools;
  let openAiTools = served.map(toOpenAiTool);

  /**
   * AWP-006 — re-read the advertised surface after the server said it changed.
   *
   * Called between turns rather than inside the tool loop: `openAiTools` is what
   * goes on the wire with the *next* request, and a mid-turn swap would rebuild
   * the payload for calls the model has already emitted.
   */
  const refreshTools = async (turn) => {
    if (!client.toolsChanged) return;
    client.toolsChanged = false;
    const before = served.length;
    tools = await client.listTools();
    served = opts.toolsAllow ? tools.filter((t) => opts.toolsAllow.includes(t.name)) : tools;
    openAiTools = served.map(toOpenAiTool);
    const schemaChars = JSON.stringify(openAiTools).length;
    record({
      kind: 'tools-changed',
      turn,
      toolCount: served.length,
      added: served.length - before,
      toolSchemaChars: schemaChars
    });
    process.stderr.write(
      `[driver] tools/list_changed: ${before} → ${served.length} tools ` +
        `(~${Math.round(schemaChars / 4)} tokens/turn from here)\n`
    );
  };

  if (opts.listTools) {
    const schemaChars = JSON.stringify(openAiTools).length;
    const instructionChars = (init.instructions || '').length;
    process.stdout.write(`server: ${init.serverInfo && init.serverInfo.name} ${init.serverInfo && init.serverInfo.version}\n`);
    process.stdout.write(`tools advertised: ${served.length} (of ${tools.length})\n`);
    process.stdout.write(`tool schema payload: ${schemaChars} chars (~${Math.round(schemaChars / 4)} tokens)\n`);
    process.stdout.write(`instructions: ${instructionChars} chars\n`);
    // AWP-006's acceptance is stated about this total, so it is printed rather
    // than left to be added up by hand from the two lines above it.
    process.stdout.write(
      `RESIDENT SURFACE: ${schemaChars + instructionChars} chars ` +
        `(~${Math.round((schemaChars + instructionChars) / 4)} tokens/turn)\n`
    );
    // What is *not* advertised, straight from the server rather than from a list
    // kept here — a second copy of the manifest in a devtool is how the two stop
    // agreeing.
    if (served.some((t) => t.name === 'find_tools')) {
      try {
        const inv = await client.callTool('find_tools', {});
        const payload = JSON.parse(inv.content[0].text);
        for (const g of payload.groups) {
          process.stdout.write(`  group ${g.group.padEnd(8)} ${String(g.tools).padStart(3)} tools  ${g.advertised ? 'advertised' : 'held'}\n`);
        }
      } catch {
        /* an older server without find_tools; the totals above still stand */
      }
    }
    process.stdout.write('\n');
    for (const t of served) {
      process.stdout.write(`${t.name}\t${JSON.stringify(t.inputSchema || {}).length}\n`);
    }
    await client.stop();
    if (outStream) outStream.end();
    return;
  }

  if (!opts.model) throw new Error('--model is required unless --list-tools');
  const apiKey = process.env[opts.apiKeyEnv];
  const localish = /localhost|127\.0\.0\.1/.test(opts.baseUrl);
  if (!apiKey && !localish) throw new Error(`no API key in $${opts.apiKeyEnv}`);

  const userPrompt = opts.promptFile ? fs.readFileSync(opts.promptFile, 'utf8') : opts.prompt;
  if (!userPrompt) throw new Error('--prompt or --prompt-file is required');
  const systemPrompt = opts.systemFile
    ? fs.readFileSync(opts.systemFile, 'utf8')
    : opts.system ||
      // The server's own `instructions` are what an MCP client is supposed to
      // surface; the claude CLI does, so the baselines had them. Passing them
      // through keeps this rig comparable rather than handicapped.
      (init.instructions || '');

  record({
    kind: 'run-start',
    project: opts.project,
    baseUrl: opts.baseUrl,
    model: opts.model,
    maxTurns: opts.maxTurns,
    temperature: opts.temperature,
    toolCount: served.length,
    toolSchemaChars: JSON.stringify(openAiTools).length,
    serverInstructionsChars: (init.instructions || '').length
  });

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const startedAt = Date.now();
  let promptTokens = 0;
  let completionTokens = 0;
  let turns = 0;
  let toolCalls = 0;
  let stop = 'max-turns';

  try {
    for (turns = 1; turns <= opts.maxTurns; turns++) {
      let response;
      try {
        response = await chatCompletion({
          baseUrl: opts.baseUrl,
          apiKey,
          model: opts.model,
          messages,
          tools: openAiTools,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          timeoutMs: opts.requestTimeoutMs
        });
      } catch (err) {
        record({ kind: 'error', turn: turns, message: String(err.message || err) });
        stop = 'endpoint-error';
        break;
      }

      const usage = response.usage || {};
      promptTokens += usage.prompt_tokens || 0;
      completionTokens += usage.completion_tokens || 0;

      const choice = (response.choices && response.choices[0]) || {};
      const assistant = normaliseAssistant(choice.message || {}, turns);
      messages.push(assistant);
      record({
        kind: 'assistant',
        turn: turns,
        finishReason: choice.finish_reason,
        content: assistant.content,
        toolCalls: (assistant.tool_calls || []).map((c) => ({ name: c.function.name, arguments: c.function.arguments })),
        usage: { prompt: usage.prompt_tokens || 0, completion: usage.completion_tokens || 0 }
      });

      if (!assistant.tool_calls || !assistant.tool_calls.length) {
        // A turn with no tool calls has two completely different meanings, and
        // reading them as one silently voids a run. `stop` means the model chose
        // to answer instead of calling a tool — it is done, or it has given up,
        // and either way that is data. `length` means the gateway cut the reply
        // off at `--max-tokens` mid-sentence: the model neither finished nor
        // gave up, it was interrupted, and the tool call it was about to make
        // never got emitted.
        //
        // Measured, not theorised: Kimi-K3 deliberates in `content` before it
        // acts, hit the 4096-token default on turn 34 while writing its build
        // plan, and the original code recorded `model-finished` — a run that
        // read as a voluntary stop after 53 read-only calls. A verbose model is
        // the normal case now, so this must be named rather than inferred.
        stop = choice.finish_reason === 'length' ? 'response-truncated' : 'model-finished';
        if (stop === 'response-truncated') {
          record({
            kind: 'warning',
            turn: turns,
            message:
              `assistant reply truncated at --max-tokens (${opts.maxTokens}) with no tool call — ` +
              `the model was interrupted, not finished. Re-run with a larger --max-tokens.`
          });
        }
        break;
      }

      for (const call of assistant.tool_calls) {
        toolCalls++;
        const name = call.function.name;
        let args;
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch (err) {
          const text = `Invalid JSON in tool arguments: ${String(err.message || err)}`;
          record({ kind: 'tool-result', turn: turns, name, isError: true, text });
          messages.push({ role: 'tool', tool_call_id: call.id, content: text });
          continue;
        }

        if (!served.some((t) => t.name === name)) {
          const text = `No such tool: ${name}. Available tools are the ones advertised to you.`;
          record({ kind: 'tool-result', turn: turns, name, isError: true, text });
          messages.push({ role: 'tool', tool_call_id: call.id, content: text });
          continue;
        }

        let flat;
        try {
          const result = await client.callTool(name, args);
          flat = flattenToolResult(result, opts.maxResultChars);
        } catch (err) {
          flat = { text: `Tool call failed: ${String(err.message || err)}`, isError: true, images: 0, truncated: false };
        }
        record({ kind: 'tool-result', turn: turns, name, isError: flat.isError, images: flat.images, truncated: flat.truncated, text: flat.text });
        messages.push({ role: 'tool', tool_call_id: call.id, content: flat.text });
      }

      // AWP-006 — after the turn's calls, before the next request.
      await refreshTools(turns);
    }
  } finally {
    await client.stop();
  }

  const durS = Math.round((Date.now() - startedAt) / 1000);
  const costUsd = (promptTokens / 1e6) * opts.priceIn + (completionTokens / 1e6) * opts.priceOut;
  const summary = {
    kind: 'run-end',
    stop,
    turns: Math.min(turns, opts.maxTurns),
    toolCalls,
    promptTokens,
    completionTokens,
    costUsd: Number(costUsd.toFixed(4)),
    durS
  };
  record(summary);
  if (outStream) await new Promise((r) => outStream.end(r));

  process.stdout.write(
    `\n# ${stop} turns=${summary.turns} toolCalls=${toolCalls} ` +
      `tokens=${promptTokens}in/${completionTokens}out costUsd=${summary.costUsd} durS=${durS}\n`
  );
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`\nmcp-model-driver: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
}

module.exports = { McpStdioClient, toOpenAiTool, flattenToolResult, normaliseAssistant };
