/**
 * A raw MCP stdio client, in plain Node with no dependencies.
 *
 * Deliberately dependency-free: this runs inside a container that has node and nothing else, and
 * an `npm i @modelcontextprotocol/sdk` before the drive would be a second thing that can fail for
 * reasons the drive is not about. MCP's stdio transport is newline-delimited JSON-RPC 2.0.
 */
import { spawn } from 'node:child_process';

export function open(command, args, opts = {}) {
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], ...opts });
  let buffer = '';
  let stderr = '';
  const pending = new Map();
  let nextId = 1;

  child.stderr.on('data', (d) => (stderr += d.toString()));
  // 🔴 A server that refuses at startup exits without answering, and a client that only has a
  // timeout turns a one-line refusal into three minutes of silence. Fail on the exit, and carry
  // what it said.
  const die = (why) => {
    for (const [, { reject }] of pending) reject(new Error(`${why}\n--- server said ---\n${stderr.trim().slice(-4000)}`));
    pending.clear();
  };
  child.on('exit', (code, signal) => die(`the MCP server exited (code ${code}, signal ${signal}) before answering`));
  child.on('error', (e) => die(`the MCP server could not be spawned: ${e.message}`));
  child.stdout.on('data', (d) => {
    buffer += d.toString();
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // a server that logs to stdout would otherwise kill the transport
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      }
    }
  });

  const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ jsonrpc: '2.0', id, method, params });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`timeout on ${method}\n--- server stderr ---\n${stderr.slice(-4000)}`));
        }
      }, 180000);
    });

  return {
    child,
    stderrText: () => stderr,
    async initialize() {
      const res = await request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'hls011-drive', version: '0.0.0' }
      });
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      return res;
    },
    listTools: () => request('tools/list', {}),
    /** Returns the parsed JSON payload the tool wrote, plus `isError`. */
    async call(name, args) {
      const res = await request('tools/call', { name, arguments: args });
      const text = (res.content || []).map((c) => c.text || '').join('\n');
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      return { isError: !!res.isError, text, data };
    },
    close() {
      child.stdin.end();
      child.kill();
    }
  };
}
