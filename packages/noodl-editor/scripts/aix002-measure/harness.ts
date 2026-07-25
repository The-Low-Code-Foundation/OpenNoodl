/**
 * AIX-002 — spec step 2: the terminal measurement harness.
 *
 * Runs the real authoring loop (AuthoringSession, the real context builder,
 * the real validation gate) against a real serialised project, with a
 * directly-constructed AIX-001 provider bound to keys from the repo-root
 * `.env`. No Electron, no safeStorage, no UI — this is the "prototype the
 * loop headlessly first" harness the spec asks for, measuring what the spec
 * says matters: validity rate before and after validator-driven repair,
 * iteration count, and context size.
 *
 * Build + run (from the repo root):
 *
 *   node packages/noodl-editor/scripts/aix002-measure/build.mjs
 *   node packages/noodl-editor/scripts/aix002-measure/dist/aix002-harness.cjs \
 *     --provider=anthropic --model=claude-sonnet-5
 *
 * Flags:
 *   --provider=anthropic|openai|openai-compatible|ollama   (default anthropic)
 *   --model=<id>            omit to use the provider's registry default
 *   --only=slug1,slug2      run a subset of the corpus
 *   --project=<path>        project.json to author against (default: git-repo-utf8 corpus)
 *   --out=<path>            JSONL destination (default: dev-docs/.../measurements/)
 *   --timeout=<seconds>     per-session wall clock (default 480)
 *
 * Every session appends one JSON line — outcome, metrics, and the full
 * transcript — so prompt iteration has the raw material, not just the
 * aggregates printed at the end.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AuthoringChatFn } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { AuthoringSession } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import type { AuthoringOutcome } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { createProvider } from '../../src/editor/src/models/AiAssistant/client/AiClient';
import type { AiProvider, AiProviderId } from '../../src/editor/src/models/AiAssistant/client/types';
import { AI_PROVIDER_IDS } from '../../src/editor/src/models/AiAssistant/client/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import type { MeasurePrompt } from './prompts';
import { PROMPTS } from './prompts';

/**
 * The bundle runs from dist/ one level below this source file, so the root is
 * found by marker, not by counting `..`.
 */
function findRepoRoot(from: string): string {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'packages', 'noodl-editor'))) return dir;
    if (path.dirname(dir) === dir) throw new Error(`Could not find the repo root above ${from}`);
  }
}

const REPO_ROOT = findRepoRoot(__dirname);
const DEFAULT_PROJECT = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8/project.json');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'dev-docs/tasks/phase-15-ai-collaboration/measurements');

// ── Plumbing ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) throw new Error(`Unrecognised argument: ${arg} (flags are --name=value)`);
    args[match[1]] = match[2];
  }
  return args;
}

/** Minimal .env reader — the harness must not add a dotenv dependency. */
function loadEnv(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && match[2]) env[match[1]] = match[2];
  }
  return env;
}

function buildProvider(providerId: AiProviderId, env: Record<string, string>): AiProvider {
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

// ── Measurement ──────────────────────────────────────────────────────────────

interface SessionRecord {
  slug: string;
  provider: AiProviderId;
  /** The model that actually served the requests, as the provider reported it. */
  model: string;
  request: { componentPath: string; description: string };
  status: AuthoringOutcome['status'];
  durationMs: number;
  firstAttemptValid: boolean | null;
  rounds: AuthoringOutcome['rounds'];
  metrics: AuthoringOutcome['metrics'];
  transcript: AuthoringOutcome['transcript'];
  error?: string;
}

async function measureOne(
  prompt: MeasurePrompt,
  graph: ReturnType<typeof fromSerialisedProject>,
  provider: AiProvider,
  providerId: AiProviderId,
  model: string | undefined,
  timeoutMs: number
): Promise<SessionRecord> {
  let servedModel = model ?? '(provider default)';
  const chat: AuthoringChatFn = async (request, callbacks) => {
    const response = await provider.chatStream({ ...request, ...(model ? { model } : {}) }, callbacks ?? {});
    servedModel = response.model;
    return response;
  };

  const session = AuthoringSession.create(
    graph,
    { description: prompt.description, componentPath: prompt.componentPath },
    { chat }
  );

  // Narrate the loop so a live run is watchable from the terminal. Seen-ness
  // is tracked per activity object, not by index — the session splices empty
  // assistant bubbles out of the feed, so indices shift under a diff cursor.
  const narrated = new WeakSet<object>();
  session.onChange((state) => {
    for (const activity of state.activities) {
      if (narrated.has(activity)) continue;
      narrated.add(activity);
      if (activity.kind === 'tool') console.log(`    · ${activity.label}`);
      if (activity.kind === 'submit') {
        console.log(
          activity.ok ? '    ✓ submit accepted' : `    ✗ submit rejected (${activity.errorLines.length} problem(s))`
        );
        for (const line of activity.errorLines.slice(0, 4)) console.log(`        ${line}`);
        if (activity.errorLines.length > 4) console.log(`        … and ${activity.errorLines.length - 4} more`);
      }
    }
  });

  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);
  const startedAt = Date.now();
  const outcome = await session.run({ abortController });
  const durationMs = Date.now() - startedAt;
  clearTimeout(timer);
  session.dispose();

  return {
    slug: prompt.slug,
    provider: providerId,
    model: servedModel,
    request: { componentPath: prompt.componentPath, description: prompt.description },
    status: outcome.status,
    durationMs,
    firstAttemptValid: outcome.rounds.length > 0 ? outcome.rounds[0].ok : null,
    rounds: outcome.rounds,
    metrics: outcome.metrics,
    transcript: outcome.transcript,
    error: outcome.error
  };
}

function formatUsd(value: number | null): string {
  return value === null ? 'unknown' : `$${value.toFixed(4)}`;
}

function summarise(records: SessionRecord[]): void {
  const done = records.length;
  const authored = records.filter((r) => r.status === 'authored');
  const firstTry = records.filter((r) => r.firstAttemptValid === true);
  const meanOf = (pick: (r: SessionRecord) => number): string =>
    done === 0 ? '-' : (records.reduce((sum, r) => sum + pick(r), 0) / done).toFixed(1);
  const totalCost = records.reduce<number | null>(
    (sum, r) => (sum === null || r.metrics.costUsd === null ? null : sum + r.metrics.costUsd),
    0
  );

  console.log('\n── Summary ─────────────────────────────────────────────');
  console.log(`sessions:               ${done}`);
  console.log(`valid on first attempt: ${firstTry.length}/${done}`);
  console.log(`valid after repair:     ${authored.length}/${done}`);
  console.log(`mean turns:             ${meanOf((r) => r.metrics.turns)}`);
  console.log(`mean submits:           ${meanOf((r) => r.metrics.submits)}`);
  console.log(`mean context chars:     ${meanOf((r) => r.metrics.totalContextChars)}`);
  console.log(`mean transcript chars:  ${meanOf((r) => r.metrics.transcriptChars)}`);
  console.log(`total cost:             ${formatUsd(totalCost)}`);
  console.log('\nper prompt:');
  for (const r of records) {
    const submits = r.rounds.map((round) => (round.ok ? '✓' : '✗')).join('') || '-';
    console.log(
      `  ${r.slug.padEnd(16)} ${r.status.padEnd(10)} submits ${submits.padEnd(5)} ` +
        `turns ${String(r.metrics.turns).padStart(2)}  context ${String(r.metrics.totalContextChars).padStart(6)}  ` +
        `${(r.durationMs / 1000).toFixed(0)}s  ${formatUsd(r.metrics.costUsd)}`
    );
  }
}

// ── Entry ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const providerId = (args.provider ?? 'anthropic') as AiProviderId;
  if (!AI_PROVIDER_IDS.includes(providerId)) {
    throw new Error(`Unknown provider "${providerId}" — one of: ${AI_PROVIDER_IDS.join(', ')}`);
  }
  const model = args.model || undefined;
  const timeoutMs = (args.timeout ? Number(args.timeout) : 480) * 1000;
  const projectPath = args.project ?? DEFAULT_PROJECT;
  const only = args.only ? args.only.split(',').map((s) => s.trim()) : null;

  const prompts = only ? PROMPTS.filter((p) => only.includes(p.slug)) : PROMPTS;
  if (prompts.length === 0) {
    throw new Error(`No prompts matched --only=${args.only}. Known: ${PROMPTS.map((p) => p.slug).join(', ')}`);
  }

  const env = loadEnv(path.join(REPO_ROOT, '.env'));
  const provider = buildProvider(providerId, env);
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  const graph = fromSerialisedProject(project);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile =
    args.out ?? path.join(DEFAULT_OUT_DIR, `${stamp}-${providerId}-${model ?? 'default'}.jsonl`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  console.log(`AIX-002 measurement — ${providerId} / ${model ?? 'registry default'}`);
  console.log(`project: ${path.relative(REPO_ROOT, projectPath)} (${graph.components.length} components)`);
  console.log(`prompts: ${prompts.map((p) => p.slug).join(', ')}`);
  console.log(`record:  ${path.relative(REPO_ROOT, outFile)}\n`);

  const records: SessionRecord[] = [];
  for (const prompt of prompts) {
    console.log(`▶ ${prompt.slug} → ${prompt.componentPath}`);
    try {
      const record = await measureOne(prompt, graph, provider, providerId, model, timeoutMs);
      records.push(record);
      fs.appendFileSync(outFile, JSON.stringify(record) + '\n');
      console.log(
        `  ${record.status} — ${record.metrics.turns} turns, ${record.metrics.submits} submit(s), ` +
          `${record.metrics.totalContextChars} context chars, ${formatUsd(record.metrics.costUsd)}\n`
      );
    } catch (error) {
      // Setup errors (bad key, existing component) abort the run loudly;
      // loop-shaped failures never throw — they land in the outcome.
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  summarise(records);
}

main().catch((error) => {
  console.error(`\nharness failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
