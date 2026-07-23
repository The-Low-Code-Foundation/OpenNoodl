#!/usr/bin/env node
/**
 * Minimal example MCP client: call one noodl-mcp tool from the command line.
 *
 *   node examples/call-tool.mjs <project-dir> <tool> ['<json-args>'] [--read-only]
 *
 * Examples:
 *   node examples/call-tool.mjs ./my-project get_project_info
 *   node examples/call-tool.mjs ./my-project get_component '{"path":"Pages/Home"}'
 *
 * Set NOODL_MCP_TRANSCRIPT=/path/to/file.jsonl to append every call and result
 * (used to record the Gate G1 demonstration).
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const [, , projectDir, tool, argsJson] = process.argv;
if (!projectDir || !tool) {
  console.error('usage: call-tool.mjs <project-dir> <tool> [json-args] [--read-only]');
  process.exit(2);
}
const args = argsJson && !argsJson.startsWith('--') ? JSON.parse(argsJson) : {};
const readOnly = process.argv.includes('--read-only');

const serverBundle = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'noodl-mcp.cjs');
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverBundle, projectDir, ...(readOnly ? [] : ['--allow-writes'])],
  stderr: 'ignore'
});
const client = new Client({ name: 'call-tool-example', version: '0.1.0' });
await client.connect(transport);

const result = await client.callTool({ name: tool, arguments: args });
const text = result.content?.[0]?.text ?? '';
if (process.env.NOODL_MCP_TRANSCRIPT) {
  fs.appendFileSync(
    process.env.NOODL_MCP_TRANSCRIPT,
    JSON.stringify({ tool, args, isError: !!result.isError, result: text }) + '\n'
  );
}
console.log(text);
await client.close();
process.exit(result.isError ? 1 : 0);
