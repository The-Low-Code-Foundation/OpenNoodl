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
 *   --effort=low|medium|high|xhigh|max   reasoning depth (default: the loop's own)
 *   --styles=on|off         AIX-006 A/B control arm
 *
 * AIX-007 note: sessions run back-to-back on purpose. The cached prefix is
 * shared across the corpus, so a sequential run measures the traffic shape the
 * editor actually produces — one project, several components in a sitting.
 *
 * Every session appends one JSON line — outcome, metrics, and the full
 * transcript — so prompt iteration has the raw material, not just the
 * aggregates printed at the end.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AuthoringChatFn } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { AuthoringSession } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { countStyleValues } from '../../src/editor/src/models/AiAssistant/authoring/styleLint';
import type { AuthoringOutcome } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { buildEffectiveTokens, readStoredTokens } from '../../src/editor/src/models/StyleTokensModel/ProjectTokenCss';
import { buildStyleVocabulary } from '../../src/editor/src/models/StyleTokensModel/StyleVocabulary';
import type { StyleVocabulary } from '../../src/editor/src/models/StyleTokensModel/StyleVocabulary';
import type { StyleTokenRecord } from '../../src/editor/src/models/StyleTokensModel/TokenCategories';
import { createProvider } from '../../src/editor/src/models/AiAssistant/client/AiClient';
import type { AiEffort, AiProvider, AiProviderId } from '../../src/editor/src/models/AiAssistant/client/types';
import { AI_EFFORT_LEVELS, AI_PROVIDER_IDS } from '../../src/editor/src/models/AiAssistant/client/types';
import { AUTHORING_EFFORT } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
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
  /** AIX-006: whether the style vocabulary was injected + linted this run. */
  styleGuidance: boolean;
  /** AIX-006: raw vs token-referenced style values in the authored component. */
  styleStats: { rawValues: number; tokenReferences: number; total: number };
  /** AIX-007: the reasoning depth this session ran at. */
  effort: AiEffort;
  /** AIX-007: what caching actually did, per session. */
  cacheStats: CacheStats;
  transcript: AuthoringOutcome['transcript'];
  error?: string;
}

/**
 * AIX-007 — the cache evidence for one session.
 *
 * `hitRate` is the share of input tokens served from cache, so it is directly
 * comparable across runs of different sizes. `readOnLaterTurns` is the one
 * that proves caching is on at all: a cost drop can come from anywhere, a
 * non-zero cache read on turn 2+ cannot.
 */
interface CacheStats {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Every input token the session carried, cached or not. */
  totalPromptTokens: number;
  hitRate: number;
  /** Cache tokens read on any turn after the first. */
  readOnLaterTurns: number;
  /** False when a multi-turn session never re-read its own prefix. */
  cacheVerified: boolean;
}

function cacheStatsFor(metrics: AuthoringOutcome['metrics']): CacheStats {
  const totalPromptTokens = metrics.promptTokens + metrics.cacheReadTokens + metrics.cacheWriteTokens;
  const later = metrics.usageByTurn.filter((t) => t.turn > 1);
  const readOnLaterTurns = later.reduce((sum, t) => sum + t.cacheReadTokens, 0);
  return {
    cacheReadTokens: metrics.cacheReadTokens,
    cacheWriteTokens: metrics.cacheWriteTokens,
    totalPromptTokens,
    hitRate: totalPromptTokens === 0 ? 0 : metrics.cacheReadTokens / totalPromptTokens,
    readOnLaterTurns,
    // A single-turn session has nothing to re-read, so it cannot fail this.
    cacheVerified: later.length === 0 || readOnLaterTurns > 0
  };
}

async function measureOne(
  prompt: MeasurePrompt,
  graph: ReturnType<typeof fromSerialisedProject>,
  provider: AiProvider,
  providerId: AiProviderId,
  model: string | undefined,
  timeoutMs: number,
  style: { guidance: boolean; vocabulary: StyleVocabulary; tokenRecords: StyleTokenRecord[] },
  effort: AiEffort
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
    {
      chat,
      // AIX-007: swept from the command line, so the level in the source is a
      // measured decision rather than the one nobody re-checked.
      effort,
      // AIX-006 A/B: the control arm (--styles=off) gets no vocabulary and no lint.
      styleGuidance: style.guidance,
      styleVocabulary: style.vocabulary,
      styleTokenRecords: style.tokenRecords
    }
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

  const styleStats = outcome.files
    ? countStyleValues(outcome.files)
    : { rawValues: 0, tokenReferences: 0, total: 0 };

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
    styleGuidance: style.guidance,
    styleStats,
    effort,
    cacheStats: cacheStatsFor(outcome.metrics),
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

  // AIX-007: cost per component is the headline metric this task moves, so it
  // is reported as a mean rather than left to be divided out of the total.
  const meanCost = totalCost === null || done === 0 ? null : totalCost / done;
  const cacheRead = records.reduce((n, r) => n + r.cacheStats.cacheReadTokens, 0);
  const cacheWrite = records.reduce((n, r) => n + r.cacheStats.cacheWriteTokens, 0);
  const promptTotal = records.reduce((n, r) => n + r.cacheStats.totalPromptTokens, 0);
  const hitRate = promptTotal === 0 ? 0 : cacheRead / promptTotal;
  const multiTurn = records.filter((r) => r.metrics.turns > 1);
  const verified = multiTurn.filter((r) => r.cacheStats.cacheVerified);

  const rawTotal = records.reduce((n, r) => n + r.styleStats.rawValues, 0);
  const tokenTotal = records.reduce((n, r) => n + r.styleStats.tokenReferences, 0);
  const styleTotal = rawTotal + tokenTotal;
  const tokenRate = styleTotal === 0 ? '—' : `${((tokenTotal / styleTotal) * 100).toFixed(0)}%`;

  console.log('\n── Summary ─────────────────────────────────────────────');
  console.log(`style guidance:         ${records[0]?.styleGuidance ? 'ON' : 'OFF'}`);
  console.log(`effort:                 ${records[0]?.effort ?? '-'}`);
  console.log(`sessions:               ${done}`);
  console.log(`valid on first attempt: ${firstTry.length}/${done}`);
  console.log(`valid after repair:     ${authored.length}/${done}`);
  console.log(`mean turns:             ${meanOf((r) => r.metrics.turns)}`);
  console.log(`mean submits:           ${meanOf((r) => r.metrics.submits)}`);
  console.log(`mean context chars:     ${meanOf((r) => r.metrics.totalContextChars)}`);
  console.log(`mean transcript chars:  ${meanOf((r) => r.metrics.transcriptChars)}`);
  console.log(`style values (raw/tok): ${rawTotal}/${tokenTotal}  → token-reference rate ${tokenRate}`);
  console.log(`cache read/write tok:   ${cacheRead}/${cacheWrite}  of ${promptTotal} input`);
  console.log(`cache hit rate:         ${(hitRate * 100).toFixed(1)}%`);
  console.log(
    `cache verified (turn 2+): ${verified.length}/${multiTurn.length} multi-turn session(s)` +
      (multiTurn.length > 0 && verified.length < multiTurn.length ? '   ← CACHING IS NOT WORKING' : '')
  );
  console.log(`total cost:             ${formatUsd(totalCost)}`);
  console.log(`mean cost / component:  ${formatUsd(meanCost)}`);
  console.log('\nper prompt:');
  for (const r of records) {
    const submits = r.rounds.map((round) => (round.ok ? '✓' : '✗')).join('') || '-';
    console.log(
      `  ${r.slug.padEnd(16)} ${r.status.padEnd(10)} submits ${submits.padEnd(5)} ` +
        `turns ${String(r.metrics.turns).padStart(2)}  in ${String(r.cacheStats.totalPromptTokens).padStart(6)}  ` +
        `cache ${(r.cacheStats.hitRate * 100).toFixed(0).padStart(3)}%  ` +
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
  // AIX-006 A/B: --styles=off is the control arm (no vocabulary, no lint).
  const styleGuidance = (args.styles ?? 'on').toLowerCase() !== 'off';
  // AIX-007: sweep reasoning depth. Unset runs whatever the loop ships with.
  const effort = (args.effort ?? AUTHORING_EFFORT) as AiEffort;
  if (!AI_EFFORT_LEVELS.includes(effort)) {
    throw new Error(`Unknown effort "${effort}" — one of: ${AI_EFFORT_LEVELS.join(', ')}`);
  }

  const prompts = only ? PROMPTS.filter((p) => only.includes(p.slug)) : PROMPTS;
  if (prompts.length === 0) {
    throw new Error(`No prompts matched --only=${args.only}. Known: ${PROMPTS.map((p) => p.slug).join(', ')}`);
  }

  const env = loadEnv(path.join(REPO_ROOT, '.env'));
  const provider = buildProvider(providerId, env);
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  const graph = fromSerialisedProject(project);

  // The project's own style vocabulary (defaults + any token overrides in its
  // metadata). Both A/B arms build it; only the treatment arm injects it.
  const metaSource = { getMetaData: (key: string) => (project.metadata ?? {})[key] };
  const styleVocabulary = buildStyleVocabulary(metaSource);
  const styleTokenRecords = Array.from(buildEffectiveTokens(readStoredTokens(metaSource)).values());
  const style = { guidance: styleGuidance, vocabulary: styleVocabulary, tokenRecords: styleTokenRecords };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const styleTag = styleGuidance ? 'styles-on' : 'styles-off';
  const outFile =
    args.out ??
    path.join(DEFAULT_OUT_DIR, `${stamp}-${providerId}-${model ?? 'default'}-${styleTag}-effort-${effort}.jsonl`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  console.log(
    `AIX-002/006/007 measurement — ${providerId} / ${model ?? 'registry default'} — ${styleTag} — effort ${effort}`
  );
  console.log(`project: ${path.relative(REPO_ROOT, projectPath)} (${graph.components.length} components)`);
  console.log(`prompts: ${prompts.map((p) => p.slug).join(', ')}`);
  console.log(`record:  ${path.relative(REPO_ROOT, outFile)}\n`);

  const records: SessionRecord[] = [];
  for (const prompt of prompts) {
    console.log(`▶ ${prompt.slug} → ${prompt.componentPath}`);
    try {
      const record = await measureOne(prompt, graph, provider, providerId, model, timeoutMs, style, effort);
      records.push(record);
      fs.appendFileSync(outFile, JSON.stringify(record) + '\n');
      console.log(
        `  ${record.status} — ${record.metrics.turns} turns, ${record.metrics.submits} submit(s), ` +
          `${record.cacheStats.totalPromptTokens} input tok ` +
          `(${(record.cacheStats.hitRate * 100).toFixed(0)}% cached), ${formatUsd(record.metrics.costUsd)}\n`
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
