/**
 * Plumbing shared by the two harnesses in this directory.
 *
 * `harness.ts` measures the AUTHORING loop (AIX-002/006/007, FIX-006 AC1/AC2);
 * `plan-harness.ts` measures the PLANNING loop (FIX-022). They ask different
 * questions of different sessions and grade different artefacts, but they find
 * the repo root, read `.env` and build a provider identically — and that last
 * one is not incidental plumbing. The provider/stub pairing is what session 39
 * had to repair after the harness sat broken for eight days; a second copy of it
 * would be a second thing to fix and a second thing to get subtly wrong.
 *
 * Nothing here reaches the editor's config store. Both harnesses construct a
 * provider from `.env` and inject their own chat function, which is why
 * `build.mjs` can stub `AiAssistantStore` as "AI is off".
 *
 * @module scripts/aix002-measure/shared
 */

import * as fs from 'fs';
import * as path from 'path';

import { createProvider } from '../../src/editor/src/models/AiAssistant/client/AiClient';
import type { AiProvider, AiProviderId } from '../../src/editor/src/models/AiAssistant/client/types';

/**
 * The bundles run from dist/ one level below this source file, so the root is
 * found by marker, not by counting `..`.
 */
export function findRepoRoot(from: string): string {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'packages', 'noodl-editor'))) return dir;
    if (path.dirname(dir) === dir) throw new Error(`Could not find the repo root above ${from}`);
  }
}

export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z0-9-]+)=(.*)$/.exec(arg);
    if (!match) throw new Error(`Unrecognised argument: ${arg} (flags are --name=value)`);
    args[match[1]] = match[2];
  }
  return args;
}

/** Minimal .env reader — the harnesses must not add a dotenv dependency. */
export function loadEnv(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && match[2]) env[match[1]] = match[2];
  }
  return env;
}

export function buildProvider(providerId: AiProviderId, env: Record<string, string>): AiProvider {
  const need = (key: string): string => {
    const value = env[key] ?? process.env[key];
    if (!value) throw new Error(`${key} is not set — fill it in the repo-root .env (see .env.example).`);
    return value;
  };
  switch (providerId) {
    case 'anthropic':
      return createProvider('anthropic', { apiKey: need('ANTHROPIC_API_KEY') });
    case 'openai':
      return createProvider('openai', { apiKey: need('OPENAI_API_KEY') });
    case 'openai-compatible':
      return createProvider('openai-compatible', {
        apiKey: env.OPENAI_COMPATIBLE_API_KEY ?? process.env.OPENAI_COMPATIBLE_API_KEY,
        baseUrl: need('OPENAI_COMPATIBLE_BASE_URL')
      });
    case 'ollama':
      return createProvider('ollama', {
        baseUrl: env.OLLAMA_BASE_URL ?? process.env.OLLAMA_BASE_URL ?? undefined
      });
  }
}

export function formatUsd(value: number | null): string {
  return value === null ? 'unknown' : `$${value.toFixed(4)}`;
}
