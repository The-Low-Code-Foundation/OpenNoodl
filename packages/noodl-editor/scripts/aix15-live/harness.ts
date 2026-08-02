/**
 * Phase 15 close-out — the live-provider harness for everything the AIX-002
 * harness does not drive.
 *
 * At the end of phase 15 every task was built and ten of twelve criteria sets
 * were closed, but the phase carried one shared gap: **nothing outside the
 * AIX-002 authoring loop had ever been run against a real provider**. Update
 * mode, project-scope planning, the scoping conversation, the docs retrofit and
 * Explain Mode were all verified with injected chat functions returning
 * fixtures — which proves the plumbing and says nothing about what a model
 * actually does.
 *
 * This is one harness with six modes rather than six harnesses because they
 * differ only in which session they drive; the provider construction, the `.env`
 * read, the JSONL record and the artifact dump are identical, and duplicating
 * them five times would have produced five places for the cost accounting to
 * drift.
 *
 * **Artifacts are written to disk, not just scored.** What these runs produce is
 * prose, plans and documents a human has to read to judge — a pass/fail number
 * would be measuring the harness's opinion rather than the model's output.
 *
 * Build + run (from the repo root):
 *
 *   node packages/noodl-editor/scripts/aix15-live/build.mjs
 *   node packages/noodl-editor/scripts/aix15-live/dist/aix15-harness.cjs --mode=plan
 *
 * Flags:
 *   --mode=update|agentic|plan|scope|review|explain|sandbox   (required)
 *   --provider=anthropic|openai|openai-compatible|ollama  (default anthropic)
 *   --model=<id>            omit to use the provider's registry default
 *   --only=slug1,slug2      run a subset of the mode's corpus
 *   --project=<path>        project.json to run against (each mode has a default)
 *   --outdir=<path>         artifacts + JSONL (default dev-docs/.../measurements/live)
 *   --timeout=<seconds>     per-session wall clock (default 600)
 *   --effort=low|medium|high|xhigh|max
 */

import * as fs from 'fs';
import * as path from 'path';

import { AuthoringSession } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import type { AuthoringChatFn } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { PlanningSession } from '../../src/editor/src/models/AiAssistant/authoring/PlanningSession';
import { PlanRun } from '../../src/editor/src/models/AiAssistant/authoring/PlanRun';
import type { ComponentFiles } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { ScopingSession } from '../../src/editor/src/models/AiAssistant/scoping/ScopingSession';
import { planFromScope, scopeDocuments, scopeOutline } from '../../src/editor/src/models/AiAssistant/scoping/scope';
import { ProjectReviewRun } from '../../src/editor/src/models/AiAssistant/review/ProjectReviewRun';
import { ExplainSession } from '../../src/editor/src/models/AiAssistant/explain/ExplainSession';
import { resolveCitations } from '../../src/editor/src/models/AiAssistant/explain/citations';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import type { ExplainGraph } from '../../src/editor/src/models/AiAssistant/explain/types';
import { buildComponentV2Files } from '../../src/editor/src/io/ProjectExporter';
import { createProvider } from '../../src/editor/src/models/AiAssistant/client/AiClient';
import type { AiEffort, AiProvider, AiProviderId } from '../../src/editor/src/models/AiAssistant/client/types';
import { AI_EFFORT_LEVELS, AI_PROVIDER_IDS } from '../../src/editor/src/models/AiAssistant/client/types';

import {
  AGENTIC_PROMPTS,
  AGENTIC_TYPES,
  EXPLAIN_PROMPTS,
  PLAN_PROMPTS,
  SCOPE_PROMPTS,
  UPDATE_PROMPTS
} from './corpus';

// ── Plumbing (shared with the AIX-002 harness by convention, not by import:
//    that harness's flags and JSONL shape are a published measurement artifact
//    and must not move when this file changes) ──────────────────────────────

function findRepoRoot(from: string): string {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'packages', 'noodl-editor'))) return dir;
    if (path.dirname(dir) === dir) throw new Error(`Could not find the repo root above ${from}`);
  }
}

const REPO_ROOT = findRepoRoot(__dirname);
const CORPUS_PROJECT = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8/project.json');
const AGENT_CHAT_PROJECT = path.join(REPO_ROOT, 'project-examples/agent-chat/project.json');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'dev-docs/tasks/phase-15-ai-collaboration/measurements/live');

const MODES = ['update', 'agentic', 'plan', 'scope', 'review', 'explain', 'sandbox'] as const;
type Mode = (typeof MODES)[number];

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

interface Run {
  mode: Mode;
  provider: AiProvider;
  providerId: AiProviderId;
  model?: string;
  chat: AuthoringChatFn;
  effort: AiEffort;
  timeoutMs: number;
  only: Set<string> | null;
  outDir: string;
  /** Every served model name the provider reported, for the record. */
  served: Set<string>;
}

function wants(run: Run, slug: string): boolean {
  return run.only === null || run.only.has(slug);
}

function loadGraph(file: string): { graph: ExplainGraph; project: Record<string, unknown> } {
  const project = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { graph: fromSerialisedProject(project), project };
}

function writeArtifact(run: Run, name: string, body: string): string {
  const file = path.join(run.outDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, 'utf8');
  return path.relative(REPO_ROOT, file);
}

function usd(value: number | null | undefined): string {
  return value === null || value === undefined ? 'unknown' : `$${value.toFixed(4)}`;
}

/** One JSONL line per session, whatever the mode. */
interface LiveRecord {
  mode: Mode;
  slug: string;
  provider: AiProviderId;
  model: string;
  status: string;
  durationMs: number;
  costUsd: number | null;
  /** Mode-specific evidence — what a reader needs to judge the criterion. */
  detail: Record<string, unknown>;
  artifacts: string[];
  error?: string;
}

const records: LiveRecord[] = [];

function record(entry: LiveRecord): void {
  records.push(entry);
}

// ── Mode: update (AIX-002 spec step 6, live) ─────────────────────────────────

/**
 * The residual this closes is narrow and worth stating: update mode's *logic*
 * is spec-covered, including id-keeping and field carryover. What no fixture can
 * tell you is whether a model handed a whole existing component resubmits a
 * recognisable revision of it or quietly rewrites it from scratch — which is the
 * difference between a legible diff and an unreviewable one.
 */
async function runUpdate(run: Run): Promise<void> {
  const { graph, project } = loadGraph(CORPUS_PROJECT);
  const components = (project.components as { name: string }[]) ?? [];

  for (const prompt of UPDATE_PROMPTS) {
    if (!wants(run, prompt.slug)) continue;
    const legacy = components.find((c) => c.name === prompt.legacyName);
    if (!legacy) throw new Error(`${prompt.legacyName} is not in the corpus project.`);

    const baseFiles = buildComponentV2Files(legacy as never, '1970-01-01T00:00:00.000Z') as ComponentFiles;
    const baseNodeIds = new Set(baseFiles.nodes.nodes.map((n) => n.id));

    console.log(`\n▶ update ${prompt.slug} → ${prompt.componentPath}`);
    const session = AuthoringSession.createUpdate(
      graph,
      { description: prompt.description, componentPath: prompt.componentPath },
      baseFiles,
      { chat: run.chat, effort: run.effort }
    );
    narrate(session);

    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), run.timeoutMs);
    const startedAt = Date.now();
    const outcome = await session.run({ abortController });
    clearTimeout(timer);
    session.dispose();

    // The criterion update mode was built for: a revision the reviewer can read
    // as a diff. Ids kept from the base are what makes the diff a diff rather
    // than "everything removed, everything added".
    const proposedIds = outcome.files ? outcome.files.nodes.nodes.map((n) => n.id) : [];
    const kept = proposedIds.filter((id) => baseNodeIds.has(id)).length;
    const keptRate = baseNodeIds.size === 0 ? 0 : kept / baseNodeIds.size;

    const artifacts: string[] = [];
    if (outcome.files) {
      artifacts.push(
        writeArtifact(run, `update/${prompt.slug}.candidate.json`, JSON.stringify(outcome.files, null, 2)),
        writeArtifact(run, `update/${prompt.slug}.base.json`, JSON.stringify(baseFiles, null, 2))
      );
    }

    console.log(
      `  ${outcome.status} — ${outcome.metrics.turns} turns, ${kept}/${baseNodeIds.size} base node ids kept ` +
        `(${(keptRate * 100).toFixed(0)}%), ${usd(outcome.metrics.costUsd)}`
    );

    record({
      mode: 'update',
      slug: prompt.slug,
      provider: run.providerId,
      model: [...run.served].pop() ?? '(unknown)',
      status: outcome.status,
      durationMs: Date.now() - startedAt,
      costUsd: outcome.metrics.costUsd,
      detail: {
        componentPath: prompt.componentPath,
        description: prompt.description,
        firstAttemptValid: outcome.rounds.length > 0 ? outcome.rounds[0].ok : null,
        baseNodes: baseNodeIds.size,
        proposedNodes: proposedIds.length,
        keptNodeIds: kept,
        keptRate,
        rounds: outcome.rounds
      },
      artifacts,
      error: outcome.error
    });
  }
}

// ── Mode: agentic (AIX-005's last criterion) ─────────────────────────────────

/**
 * "AIX-002 can author with these nodes." The catalog half is gated already;
 * what is unproven is reach — whether a model asked for streaming behaviour in
 * plain English finds the streaming nodes. The prompts never name a node type,
 * so a pass here is the model choosing them, not being told.
 */
async function runAgentic(run: Run): Promise<void> {
  const { graph } = loadGraph(AGENT_CHAT_PROJECT);

  for (const prompt of AGENTIC_PROMPTS) {
    if (!wants(run, prompt.slug)) continue;
    console.log(`\n▶ agentic ${prompt.slug} → ${prompt.componentPath}`);

    const session = AuthoringSession.create(
      graph,
      { description: prompt.description, componentPath: prompt.componentPath },
      { chat: run.chat, effort: run.effort }
    );
    narrate(session);

    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), run.timeoutMs);
    const startedAt = Date.now();
    const outcome = await session.run({ abortController });
    clearTimeout(timer);
    session.dispose();

    const usedTypes = outcome.files ? outcome.files.nodes.nodes.map((n) => n.type) : [];
    const agenticTypes = [...new Set(usedTypes.filter((t) => (AGENTIC_TYPES as readonly string[]).includes(t)))];
    const hitWanted = prompt.wants.filter((w) => usedTypes.includes(w));

    const artifacts = outcome.files
      ? [writeArtifact(run, `agentic/${prompt.slug}.candidate.json`, JSON.stringify(outcome.files, null, 2))]
      : [];

    console.log(
      `  ${outcome.status} — agentic node types used: ${agenticTypes.join(', ') || '(none)'} ` +
        `· wanted hit ${hitWanted.length}/${prompt.wants.length} · ${usd(outcome.metrics.costUsd)}`
    );

    record({
      mode: 'agentic',
      slug: prompt.slug,
      provider: run.providerId,
      model: [...run.served].pop() ?? '(unknown)',
      status: outcome.status,
      durationMs: Date.now() - startedAt,
      costUsd: outcome.metrics.costUsd,
      detail: {
        componentPath: prompt.componentPath,
        description: prompt.description,
        firstAttemptValid: outcome.rounds.length > 0 ? outcome.rounds[0].ok : null,
        agenticTypesUsed: agenticTypes,
        wanted: prompt.wants,
        wantedHit: hitWanted,
        allTypes: [...new Set(usedTypes)],
        rounds: outcome.rounds
      },
      artifacts,
      error: outcome.error
    });
  }
}

// ── Mode: plan (AIX-011 criteria 1 and 6, plus criterion 7's prose) ──────────

/**
 * The full project-scope path end to end: plan, fan out every component
 * operation, then author the doc that records them. Nothing is applied — the
 * run stops at `acceptedOperations()`, which is exactly where the panel stops
 * before a human presses Apply, so this measures the plan and the candidates
 * without needing a `ProjectModel`.
 */
async function runPlan(run: Run): Promise<void> {
  const { graph, project } = loadGraph(CORPUS_PROJECT);
  const components = (project.components as { name: string }[]) ?? [];
  const byName = new Map(components.map((c) => [c.name, c]));

  for (const prompt of PLAN_PROMPTS) {
    if (!wants(run, prompt.slug)) continue;
    console.log(`\n▶ plan ${prompt.slug}`);
    const startedAt = Date.now();

    const planning = new PlanningSession(graph, prompt.request, { chat: run.chat, effort: run.effort });
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), run.timeoutMs);
    const planned = await planning.run({ abortController });
    clearTimeout(timer);

    if (planned.status !== 'planned' || !planned.plan) {
      console.log(`  ${planned.status} — ${planned.note ?? '(no note)'}`);
      record({
        mode: 'plan',
        slug: prompt.slug,
        provider: run.providerId,
        model: [...run.served].pop() ?? '(unknown)',
        status: planned.status,
        durationMs: Date.now() - startedAt,
        costUsd: planned.costUsd,
        detail: { request: prompt.request, note: planned.note, turns: planned.turns },
        artifacts: []
      });
      continue;
    }

    const plan = planned.plan;
    console.log(`  planned ${plan.operations.length} operation(s) — ${usd(planned.costUsd)}`);
    for (const op of plan.operations) console.log(`    ${op.kind.padEnd(6)} ${op.target}`);

    // The doc operations are the point of criterion 7: give the run a baseline
    // reader so a doc turn authors against what the project actually has, and
    // an absent file reads as absent rather than as an imagined baseline.
    const docBaselines = new Map<string, string>();

    const planRun = new PlanRun(graph, plan, {
      baseFilesFor: (legacyName) => {
        const legacy = byName.get(legacyName) ?? byName.get(`/${legacyName}`);
        return legacy ? (buildComponentV2Files(legacy as never, '1970-01-01T00:00:00.000Z') as ComponentFiles) : undefined;
      },
      docBaselineFor: (relPath) => docBaselines.get(relPath),
      session: { chat: run.chat, effort: run.effort },
      doc: { chat: run.chat, effort: run.effort }
    });

    let lastOp: string | undefined;
    planRun.onChange((state) => {
      if (state.activeOperationId && state.activeOperationId !== lastOp) {
        lastOp = state.activeOperationId;
        const op = state.operations.find((o) => o.operation.id === lastOp);
        if (op) console.log(`    · ${op.operation.kind} ${op.operation.target}`);
      }
    });

    const finalState = await planRun.run();
    const accepted = planRun.acceptedOperations();

    const artifacts: string[] = [
      writeArtifact(run, `plan/${prompt.slug}.plan.json`, JSON.stringify(plan, null, 2))
    ];
    for (const op of finalState.operations) {
      const files = planRun.filesFor(op.operation.id);
      if (files) {
        artifacts.push(
          writeArtifact(
            run,
            `plan/${prompt.slug}/${op.operation.id}-${slugify(op.operation.target)}.json`,
            JSON.stringify(files, null, 2)
          )
        );
      }
      const doc = planRun.docFor(op.operation.id);
      if (doc) {
        artifacts.push(
          writeArtifact(run, `plan/${prompt.slug}/${op.operation.id}-${slugify(op.operation.target)}.md`, doc.proposed)
        );
      }
    }

    const staged = finalState.operations.filter((o) => o.status === 'staged').length;
    console.log(
      `  staged ${staged}/${finalState.operations.length}, accepted set ${accepted.operations.length} — ` +
        `${usd(finalState.costUsd)}`
    );

    record({
      mode: 'plan',
      slug: prompt.slug,
      provider: run.providerId,
      model: [...run.served].pop() ?? '(unknown)',
      status: finalState.phase,
      durationMs: Date.now() - startedAt,
      costUsd:
        planned.costUsd === null || finalState.costUsd === null ? null : planned.costUsd + finalState.costUsd,
      detail: {
        request: prompt.request,
        minOperations: prompt.minOperations,
        planCostUsd: planned.costUsd,
        fanOutCostUsd: finalState.costUsd,
        operations: plan.operations.map((o) => ({ id: o.id, kind: o.kind, target: o.target, intent: o.intent })),
        outcome: finalState.operations.map((o) => ({
          id: o.operation.id,
          kind: o.operation.kind,
          target: o.operation.target,
          status: o.status,
          error: o.error,
          staged: o.staged,
          stagedDoc: o.stagedDoc
        })),
        acceptedCount: accepted.operations.length,
        meetsMinOperations: plan.operations.length >= prompt.minOperations
      },
      artifacts
    });
  }
}

// ── Mode: scope (AIX-012 criteria 1, 2 and 5) ────────────────────────────────

/**
 * A scripted conversation, then the documents and plan it produces. The
 * assertions worth making here are structural rather than editorial: that the
 * scope accumulates rather than resets, that the plan derives from the pages
 * actually agreed, and that unagreed things render as TODO rather than as a
 * plausible sentence.
 */
async function runScope(run: Run): Promise<void> {
  for (const prompt of SCOPE_PROMPTS) {
    if (!wants(run, prompt.slug)) continue;
    console.log(`\n▶ scope ${prompt.slug}`);
    const startedAt = Date.now();

    const session = new ScopingSession({ chat: run.chat, effort: run.effort });
    const perTurn: { user: string; reply: string; status: string; pages: number; objects: number }[] = [];

    for (const text of prompt.turns) {
      console.log(`\n  user: ${text}`);
      const turn = await session.send(text);
      const reply = turn.reply.replace(/\n/g, '\n        ');
      console.log(`  ai:   ${reply}`);
      perTurn.push({
        user: text,
        reply: turn.reply,
        status: turn.status,
        pages: turn.scope.pages.length,
        objects: turn.scope.objects.length
      });
    }

    const scope = session.scope;
    const plan = planFromScope(scope, { existingComponents: new Set(['/App', '/#__page__/Home']) });
    const docs = scopeDocuments({ scope, transcript: session.transcript, plan, at: '1970-01-01T00:00:00.000Z' });

    const artifacts = docs.map((doc) =>
      writeArtifact(run, `scope/${prompt.slug}/${doc.path.replace(/\//g, '_')}`, doc.content)
    );
    artifacts.push(writeArtifact(run, `scope/${prompt.slug}/plan.json`, JSON.stringify(plan, null, 2)));

    const todoCount = docs.reduce((n, d) => n + (d.content.match(/> TODO:/g)?.length ?? 0), 0);
    console.log('\n  outline:');
    for (const line of scopeOutline(scope)) console.log(`    ${line}`);
    console.log(
      `  plan: ${plan.operations.length} operation(s) from ${scope.pages.length} agreed page(s) · ` +
        `${todoCount} TODO marker(s) · ${usd(session.costUsd)}`
    );

    record({
      mode: 'scope',
      slug: prompt.slug,
      provider: run.providerId,
      model: [...run.served].pop() ?? '(unknown)',
      status: perTurn.every((t) => t.status === 'ok') ? 'ok' : 'partial',
      durationMs: Date.now() - startedAt,
      costUsd: session.costUsd,
      detail: {
        turns: perTurn,
        scope,
        outline: scopeOutline(scope),
        planOperations: plan.operations.map((o) => ({ kind: o.kind, target: o.target, intent: o.intent })),
        todoCount,
        // Criterion 2: the conversation must not be able to build. A tool call
        // that is not `record_scope` would be the falsifier; the session refuses
        // them, so what is recorded here is that nothing else was ever attempted.
        recordedAfterEveryTurn: perTurn.every((t, i) => i === 0 || t.pages >= perTurn[i - 1].pages)
      },
      artifacts
    });
  }
}

// ── Mode: review (AIX-010 criteria 1–4, and AIX-009's docs in anger) ─────────

async function runReview(run: Run): Promise<void> {
  const projectFile = AGENT_CHAT_PROJECT;
  const { graph, project } = loadGraph(projectFile);
  const slug = 'agent-chat';
  if (!wants(run, slug)) return;

  console.log(`\n▶ review ${slug} — ${graph.components.length} components`);
  const startedAt = Date.now();

  const reviewRun = new ProjectReviewRun(
    graph,
    {
      projectName: (project.name as string) ?? 'agent-chat',
      description: (project.metadata as { description?: string } | undefined)?.description,
      // The retrofit's whole point: this project has no docs/ on disk.
      docs: undefined,
      rootComponent: 'App'
    },
    { chat: run.chat, effort: run.effort }
  );

  let lastPhase = '';
  reviewRun.onChange((state) => {
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      console.log(`  · ${state.phase}${state.current ? ` (${state.current})` : ''}`);
    }
  });

  const state = await reviewRun.run();
  reviewRun.dispose();

  const artifacts: string[] = [];
  for (const draft of state.drafts) {
    if (draft.content) {
      artifacts.push(writeArtifact(run, `review/${slug}/${path.basename(draft.path)}`, draft.content));
    }
  }
  if (state.context) {
    artifacts.push(
      writeArtifact(run, `review/${slug}/coverage.json`, JSON.stringify(state.context.coverage, null, 2))
    );
  }

  const coverage = state.context?.coverage;
  console.log(
    `  ${state.phase} — read ${coverage?.read.length ?? 0}/${coverage?.componentsTotal ?? 0} components, ` +
      `${state.drafts.filter((d) => d.status === 'authored').length}/${state.drafts.length} authored, ` +
      `${usd(state.costUsd)}`
  );
  for (const draft of state.drafts) {
    console.log(
      `    ${draft.path.padEnd(28)} ${draft.status.padEnd(9)} ${draft.todoCount} TODO · ` +
        `${draft.lintFindings.length} lint · ${usd(draft.costUsd)}`
    );
  }

  record({
    mode: 'review',
    slug,
    provider: run.providerId,
    model: [...run.served].pop() ?? '(unknown)',
    status: state.phase,
    durationMs: Date.now() - startedAt,
    costUsd: state.costUsd,
    detail: {
      project: path.relative(REPO_ROOT, projectFile),
      components: graph.components.length,
      coverage: coverage
        ? {
            componentsTotal: coverage.componentsTotal,
            nodesTotal: coverage.nodesTotal,
            read: coverage.read.length,
            notRead: coverage.notRead.length,
            firstSkipReason: coverage.notRead[0]?.reason,
            charsUsed: coverage.charsUsed,
            charsBudget: coverage.charsBudget
          }
        : undefined,
      drafts: state.drafts.map((d) => ({
        path: d.path,
        status: d.status,
        chars: d.content?.length ?? 0,
        todoCount: d.todoCount,
        lintFindings: d.lintFindings,
        summary: d.summary,
        costUsd: d.costUsd,
        turns: d.turns
      }))
    },
    artifacts,
    error: state.error
  });
}

// ── Mode: explain (AIX-004 register and accuracy) ────────────────────────────

async function runExplain(run: Run): Promise<void> {
  const { graph } = loadGraph(AGENT_CHAT_PROJECT);

  for (const prompt of EXPLAIN_PROMPTS) {
    if (!wants(run, prompt.slug)) continue;
    console.log(`\n▶ explain ${prompt.slug} — ${prompt.componentName}`);
    const startedAt = Date.now();

    const session = ExplainSession.create(
      graph,
      { scope: 'component', componentName: prompt.componentName },
      { chat: run.chat }
    );
    await session.explain();
    if (prompt.question) await session.ask(prompt.question);

    const answers = session.state.turns.filter((t) => t.role === 'answer');
    const answer = answers[answers.length - 1]?.text ?? '';
    const lower = answer.toLowerCase();
    const hit = prompt.wants.filter((w) => lower.includes(w));
    // Counted through the product's own parser rather than a regex written
    // here — a harness that invents its own citation format measures itself.
    const { resolved, unresolved } = resolveCitations(answer, session.context);
    // Node ids the model wrote as bare text instead of as a clickable citation.
    // Counted on the answer with every citation removed, so an id that appears
    // both ways still registers the occurrence the reader cannot navigate from.
    const withoutCitations = answer.replace(/\[[^\]\n]+\]\(noodl-node:[^)\s]+\)/g, '');
    const bareIds = (withoutCitations.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g) ?? []).length;
    session.dispose();

    const artifacts = [writeArtifact(run, `explain/${prompt.slug}.md`, answer)];

    console.log(
      `  ${answer.length} chars · citations ${resolved.length} resolved / ${unresolved.length} unresolved · ` +
        `${bareIds} bare id(s) · grounded terms ${hit.length}/${prompt.wants.length} (${hit.join(', ') || 'none'})`
    );

    record({
      mode: 'explain',
      slug: prompt.slug,
      provider: run.providerId,
      model: [...run.served].pop() ?? '(unknown)',
      status: answers.some((a) => a.error) ? 'error' : 'ok',
      durationMs: Date.now() - startedAt,
      costUsd: null,
      detail: {
        componentName: prompt.componentName,
        question: prompt.question,
        contextNodes: session.context.stats.nodeCount,
        contextChars: session.context.stats.renderedChars,
        answerChars: answer.length,
        citationsResolved: resolved.length,
        citationsUnresolved: unresolved.map((c) => c.nodeId),
        bareNodeIds: bareIds,
        wanted: prompt.wants,
        wantedHit: hit
      },
      artifacts
    });
  }
}

// ── Shared narration ─────────────────────────────────────────────────────────

function narrate(session: AuthoringSession): void {
  const seen = new WeakSet<object>();
  session.onChange((state) => {
    for (const activity of state.activities) {
      if (seen.has(activity)) continue;
      seen.add(activity);
      if (activity.kind === 'tool') console.log(`    · ${activity.label}`);
      if (activity.kind === 'submit') {
        console.log(
          activity.ok ? '    ✓ submit accepted' : `    ✗ submit rejected (${activity.errorLines.length} problem(s))`
        );
        for (const line of activity.errorLines.slice(0, 4)) console.log(`        ${line}`);
      }
    }
  });
}

function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const mode = args.mode as Mode;
  if (!MODES.includes(mode)) {
    throw new Error(`--mode must be one of ${MODES.join(', ')}`);
  }

  const providerId = (args.provider ?? 'anthropic') as AiProviderId;
  if (!AI_PROVIDER_IDS.includes(providerId)) {
    throw new Error(`--provider must be one of ${AI_PROVIDER_IDS.join(', ')}`);
  }
  const effort = (args.effort ?? 'low') as AiEffort;
  if (!AI_EFFORT_LEVELS.includes(effort)) {
    throw new Error(`--effort must be one of ${AI_EFFORT_LEVELS.join(', ')}`);
  }

  const env = loadEnv(path.join(REPO_ROOT, '.env'));
  const provider = buildProvider(providerId, env);
  const model = args.model || undefined;
  const outDir = args.outdir ? path.resolve(args.outdir) : DEFAULT_OUT_DIR;
  fs.mkdirSync(outDir, { recursive: true });

  const served = new Set<string>();
  const chat: AuthoringChatFn = async (request, callbacks) => {
    const response = await provider.chatStream({ ...request, ...(model ? { model } : {}) }, callbacks ?? {});
    served.add(response.model);
    return response;
  };

  const run: Run = {
    mode,
    provider,
    providerId,
    model,
    chat,
    effort,
    timeoutMs: Number(args.timeout ?? 600) * 1000,
    only: args.only ? new Set(args.only.split(',').map((s) => s.trim())) : null,
    outDir,
    served
  };

  console.log(`phase-15 live — mode ${mode} — ${providerId}/${model ?? '(registry default)'} — effort ${effort}`);
  console.log(`artifacts: ${path.relative(REPO_ROOT, outDir)}`);

  switch (mode) {
    case 'update':
      await runUpdate(run);
      break;
    case 'agentic':
      await runAgentic(run);
      break;
    case 'plan':
      await runPlan(run);
      break;
    case 'scope':
      await runScope(run);
      break;
    case 'review':
      await runReview(run);
      break;
    case 'explain':
      await runExplain(run);
      break;
    case 'sandbox':
      await runSandbox(run);
      break;
  }

  const jsonl = path.join(outDir, `${mode}.jsonl`);
  fs.appendFileSync(jsonl, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

  const total = records.reduce<number | null>(
    (sum, r) => (sum === null || r.costUsd === null ? null : sum + r.costUsd),
    0
  );
  console.log(`\n── ${mode}: ${records.length} session(s), ${usd(total)} ──`);
  console.log(`record: ${path.relative(REPO_ROOT, jsonl)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});

// ── Mode: sandbox (AIX-008's live-provider residual) ─────────────────────────
//
// Imports for this mode sit here rather than in the header block on purpose:
// this file is appended to by several sessions at once, and an append that
// touches only the tail is an append that merges. TypeScript permits import
// declarations anywhere at a module's top level.

import { installSandbox } from '@noodl/runtime/src/sandbox/install';
import type { SandboxDataset, SandboxRecord } from '@noodl/runtime/src/sandbox/types';
import { SANDBOX_METADATA_KEY } from '@noodl/runtime/src/sandbox/types';

import {
  buildSandboxExport,
  candidateComponent,
  componentClosure
} from '../../src/editor/src/models/AiAssistant/authoring/sandboxExport';
import { buildSandboxDataset, discoverDataShape } from '../../src/editor/src/models/AiAssistant/authoring/sandboxData';
import { SUBMIT_COMPONENT } from '../../src/editor/src/models/AiAssistant/authoring/tools';
import type { AgentSampleData } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { buildEffectiveTokens, readStoredTokens } from '../../src/editor/src/models/StyleTokensModel/ProjectTokenCss';
import { buildStyleVocabulary } from '../../src/editor/src/models/StyleTokensModel/StyleVocabulary';
import type { AiChatRequest } from '../../src/editor/src/models/AiAssistant/client/types';
import { totalPromptTokens } from '../../src/editor/src/models/AiAssistant/client/types';
import { SANDBOX_PROMPTS } from './corpus';

/**
 * The system-prompt paragraph that asks for `sample_data`. Matched on its
 * heading and removed up to the next blank line — the ablation arm has to send
 * a prompt that never mentions the field, or the "what does it cost" arm is
 * measuring the schema alone.
 */
const SAMPLE_DATA_HEADING = '\n\nSAMPLE DATA FOR THE PREVIEW';

function stripSampleDataGuidance(content: string): string {
  const start = content.indexOf(SAMPLE_DATA_HEADING);
  if (start === -1) {
    throw new Error('The system prompt no longer contains the SAMPLE DATA block — the ablation would be a no-op.');
  }
  const end = content.indexOf('\n\n', start + SAMPLE_DATA_HEADING.length);
  return end === -1 ? content.slice(0, start) : content.slice(0, start) + content.slice(end);
}

/**
 * The control arm: the same loop with every trace of `sample_data` removed
 * from what the model is sent — the tool property and the prompt paragraph.
 *
 * Done here rather than behind a source flag deliberately. The measured thing
 * is what the *shipping* configuration costs, so the treatment arm must be the
 * unmodified product; it is the control that is synthetic.
 */
function ablateSampleData(request: AiChatRequest): AiChatRequest {
  let removedProperty = false;
  const tools = request.tools?.map((tool) => {
    if (tool.name !== SUBMIT_COMPONENT) return tool;
    const parameters = JSON.parse(JSON.stringify(tool.parameters)) as {
      properties?: Record<string, unknown>;
    };
    if (parameters.properties && 'sample_data' in parameters.properties) {
      delete parameters.properties.sample_data;
      removedProperty = true;
    }
    return { ...tool, parameters: parameters as Record<string, unknown> };
  });

  const messages = request.messages.map((message) =>
    message.role === 'system' ? { ...message, content: stripSampleDataGuidance(message.content) } : message
  );

  if (request.tools && !removedProperty) {
    throw new Error('submit_component no longer declares sample_data — the ablation would be a no-op.');
  }

  return { ...request, tools, messages };
}

/** Values that read as a placeholder rather than as something a person wrote. */
const PLACEHOLDER_VALUE = /^(lorem|ipsum|foo|bar|baz|test|sample|example|string|value|item|todo|tbd|n\/a)\b/i;
/** `Title 1`, `Name 2` — the shape the editor's own heuristics produce. */
const ENUMERATED_VALUE = /^[A-Z][a-z]+(?: [a-z]+)* \d+$/;

interface FieldJudgement {
  /** Fields the graph reads off this class (attributed plus pooled). */
  graphFields: string[];
  /** Field names the model supplied on at least one record. */
  suppliedFields: string[];
  /** Graph fields the model actually filled. */
  covered: string[];
  /** Graph fields left to the heuristics because the model never named them. */
  uncovered: string[];
  coverage: number;
}

interface SampleJudgement {
  supplied: boolean;
  suppliedClasses: string[];
  recordsPerClass: Record<string, number>;
  /** Classes the graph queries, read back off the candidate the model submitted. */
  graphClasses: string[];
  /** `prop-<field>` endpoints on nodes with no class — read on some record, unknown which. */
  pooledFields: string[];
  /** Supplied ∩ queried: the only sample data that can reach the screen. */
  classesMatched: string[];
  /** Supplied but never queried: records the runtime holds and nothing reads. */
  classesUnmatched: string[];
  /** Queried but not supplied: falls back to heuristic synthesis. */
  classesMissed: string[];
  fields: Record<string, FieldJudgement>;
  /** Supplied values that look like placeholders rather than like content. */
  placeholderValues: string[];
  /** Fields whose supplied values are all identical across records. */
  repeatedFields: string[];
  namedClassesHonoured: boolean;
}

function judgeSampleData(
  sampleData: AgentSampleData | undefined,
  discovery: ReturnType<typeof discoverDataShape>,
  namedClasses: string[]
): SampleJudgement {
  const graphClasses = [...discovery.byClass.keys()];
  const pooledFields = [...discovery.pooled];
  const suppliedClasses = Object.keys(sampleData ?? {});

  const fields: Record<string, FieldJudgement> = {};
  const placeholderValues: string[] = [];
  const repeatedFields: string[] = [];

  for (const [className, records] of Object.entries(sampleData ?? {})) {
    const suppliedFields = [...new Set(records.flatMap((record) => Object.keys(record)))];
    const attributed = discovery.byClass.get(className);
    // A class the graph named gets its own fields; one it did not is judged
    // against the pooled reads, which is the only evidence available.
    const graphFields = [...new Set([...(attributed ?? []), ...pooledFields])];
    const covered = graphFields.filter((field) => suppliedFields.includes(field));

    fields[className] = {
      graphFields,
      suppliedFields,
      covered,
      uncovered: graphFields.filter((field) => !suppliedFields.includes(field)),
      coverage: graphFields.length === 0 ? 1 : covered.length / graphFields.length
    };

    for (const field of suppliedFields) {
      const values = records.map((record) => record[field]).filter((value) => value !== undefined);
      for (const value of values) {
        if (typeof value !== 'string') continue;
        if (value.trim() === '' || PLACEHOLDER_VALUE.test(value) || ENUMERATED_VALUE.test(value)) {
          placeholderValues.push(`${className}.${field} = ${JSON.stringify(value)}`);
        }
      }
      if (values.length > 1 && new Set(values.map((v) => JSON.stringify(v))).size === 1) {
        repeatedFields.push(`${className}.${field}`);
      }
    }
  }

  return {
    supplied: suppliedClasses.length > 0,
    suppliedClasses,
    recordsPerClass: Object.fromEntries(Object.entries(sampleData ?? {}).map(([k, v]) => [k, v.length])),
    graphClasses,
    pooledFields,
    classesMatched: suppliedClasses.filter((c) => graphClasses.includes(c)),
    classesUnmatched: suppliedClasses.filter((c) => !graphClasses.includes(c)),
    classesMissed: graphClasses.filter((c) => !suppliedClasses.includes(c)),
    fields,
    placeholderValues,
    repeatedFields,
    namedClassesHonoured: namedClasses.every((c) => suppliedClasses.includes(c))
  };
}

/**
 * A minimal `XMLHttpRequest` so `installSandbox` can patch a prototype that
 * exists. Only the half the shim touches is real; `send` records the fact that
 * a request escaped rather than performing one, because an escape is the
 * failure this whole file is checking for.
 */
class HarnessXhr extends EventTarget {
  readyState = 0;
  status = 0;
  statusText = '';
  response: unknown = '';
  responseText = '';
  responseURL = '';
  escaped = false;
  private method = 'GET';
  private url = '';

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  send(_body?: unknown): void {
    this.escaped = true;
    this.dispatchEvent(new Event('load'));
  }
}

interface Probe {
  name: string;
  /** What the probe is evidence of, in one line. */
  about: string;
  transport: 'fetch' | 'xhr';
  method: string;
  url: string;
  body?: unknown;
}

interface ProbeResult extends Probe {
  status: number;
  /** True when the shim let the request reach the (fake) network. */
  escaped: boolean;
  ok: boolean;
  why: string;
  sample?: unknown;
}

/**
 * Drive the *installed* shim rather than the responder directly.
 *
 * `respond` is a pure function and a spec already covers it. What has never
 * been exercised outside a browser is `installSandbox` — the fetch replacement,
 * the XHR prototype patch, and the store cache that decides when a refined
 * candidate rebuilds the data. A fake `window` is enough to run all three.
 */
async function runProbes(dataset: SandboxDataset, probes: Probe[]): Promise<ProbeResult[]> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const priorWindow = globals.window;
  const priorXhr = globals.XMLHttpRequest;

  const escapedUrls: string[] = [];
  const fakeWindow = {
    fetch: (input: unknown) => {
      escapedUrls.push(String(input));
      return Promise.resolve(new Response('{"escaped":true}', { status: 599 }));
    }
  };
  globals.window = fakeWindow;
  globals.XMLHttpRequest = HarnessXhr;

  const uninstall = installSandbox(() => dataset);
  const results: ProbeResult[] = [];

  try {
    for (const probe of probes) {
      const before = escapedUrls.length;
      let status = 0;
      let payload: unknown;
      let escaped = false;

      if (probe.transport === 'fetch') {
        const response = await (fakeWindow.fetch as (u: string, i?: unknown) => Promise<Response>)(probe.url, {
          method: probe.method,
          body: probe.body === undefined ? undefined : JSON.stringify(probe.body)
        } as RequestInit);
        status = response.status;
        payload = await response.json().catch(() => undefined);
        escaped = escapedUrls.length > before;
      } else {
        const xhr = new (globals.XMLHttpRequest as typeof HarnessXhr)();
        xhr.open(probe.method, probe.url);
        await new Promise<void>((resolve) => {
          xhr.addEventListener('load', () => resolve());
          setTimeout(resolve, 2000);
          xhr.send(probe.body === undefined ? undefined : JSON.stringify(probe.body));
        });
        status = xhr.status;
        escaped = xhr.escaped;
        try {
          payload = JSON.parse(xhr.responseText || 'null');
        } catch {
          payload = xhr.responseText;
        }
      }

      results.push({ ...probe, status, escaped, ok: false, why: '', sample: payload });
    }
  } finally {
    uninstall();
    globals.window = priorWindow;
    globals.XMLHttpRequest = priorXhr;
  }

  return results;
}

function rows(payload: unknown): SandboxRecord[] {
  const body = (payload ?? {}) as { results?: unknown; data?: unknown };
  if (Array.isArray(body.results)) return body.results as SandboxRecord[];
  if (Array.isArray(body.data)) return body.data as SandboxRecord[];
  return [];
}

/**
 * The probe set, keyed to whatever class this candidate actually queries.
 *
 * The Parse probes deliberately use a *mount path* (`/parse/classes/…`) and the
 * literal string `undefined/classes/…`, because those are the two shapes a real
 * project produces — one with a backend configured, one without — and the
 * second is exactly the case the success criterion names.
 */
function probesFor(className: string): Probe[] {
  const encoded = encodeURIComponent(className);
  return [
    {
      name: 'parse-query-mounted',
      about: 'A configured endpoint carries a mount path; the query must still be answered.',
      transport: 'fetch',
      method: 'POST',
      url: `https://backend.example.com/parse/classes/${encoded}`,
      body: { _method: 'GET', limit: 10 }
    },
    {
      name: 'parse-query-no-endpoint',
      about: 'No backend configured — the Parse client emits the literal string "undefined" as its host.',
      transport: 'xhr',
      method: 'POST',
      url: `undefined/classes/${encoded}`,
      body: { _method: 'GET', limit: 10 }
    },
    {
      name: 'parse-aggregate-count',
      about: 'The "how many are there" line at the top of a list.',
      transport: 'fetch',
      method: 'GET',
      url: `https://backend.example.com/parse/aggregate/${encoded}?%24group=${encodeURIComponent(
        JSON.stringify({ objectId: null, total: { $sum: '$total' } })
      )}`
    },
    {
      name: 'byob-query',
      about: 'The BYOB/Directus shape, which is fetch rather than XHR.',
      transport: 'fetch',
      method: 'GET',
      url: `https://backend.example.com/items/${encoded}?limit=3`
    },
    {
      name: 'session-me',
      about: 'An auth-gated component asks who is signed in before rendering anything.',
      transport: 'xhr',
      method: 'GET',
      url: 'https://backend.example.com/parse/users/me'
    },
    {
      name: 'login',
      about: 'A sign-in form must succeed, whatever it is given.',
      transport: 'fetch',
      method: 'POST',
      url: 'https://backend.example.com/parse/login',
      body: { username: 'someone@example.com', password: 'hunter2' }
    },
    {
      name: 'cloud-function',
      about: 'Project code the sandbox cannot run: an empty success, not an error branch.',
      transport: 'fetch',
      method: 'POST',
      url: 'https://backend.example.com/parse/functions/recalculate',
      body: {}
    },
    {
      name: 'third-party-rest',
      about: 'A REST node pointed anywhere at all. Nothing may leave the machine.',
      transport: 'fetch',
      method: 'GET',
      url: 'https://api.stripe.com/v1/charges'
    },
    {
      name: 'static-asset',
      about: 'The viewer’s own assets must pass through untouched, or the preview cannot boot.',
      transport: 'fetch',
      method: 'GET',
      url: '/noodl_modules/some-module/index.js'
    }
  ];
}

function gradeProbe(result: ProbeResult, className: string, expectFirst: SandboxRecord | undefined): ProbeResult {
  const returned = rows(result.sample);
  const body = (result.sample ?? {}) as Record<string, unknown>;

  const verdict = (ok: boolean, why: string) => ({ ...result, ok, why });

  if (result.name === 'static-asset') {
    return verdict(result.escaped, result.escaped ? 'passed through' : 'intercepted — the viewer would not load');
  }
  if (result.escaped) return verdict(false, 'ESCAPED to the network');
  if (result.name === 'parse-query-mounted' || result.name === 'parse-query-no-endpoint' || result.name === 'byob-query') {
    if (result.status !== 200) return verdict(false, `status ${result.status}`);
    if (returned.length === 0) return verdict(false, `no ${className} records returned — the list renders empty`);
    if (expectFirst) {
      const mismatched = Object.entries(expectFirst).filter(([key, value]) =>
        key === '__sandbox' ? false : JSON.stringify(returned[0][key]) !== JSON.stringify(value)
      );
      if (mismatched.length > 0) {
        return verdict(false, `served record differs on ${mismatched.map(([k]) => k).join(', ')}`);
      }
    }
    return verdict(true, `${returned.length} record(s)`);
  }
  if (result.name === 'parse-aggregate-count') {
    return verdict(result.status === 200 && returned.length > 0, `status ${result.status}, ${returned.length} row(s)`);
  }
  if (result.name === 'session-me' || result.name === 'login') {
    const email = String(body.email ?? body.username ?? '');
    return verdict(result.status === 200 && email.length > 0, `status ${result.status}, signed in as ${email || '(nobody)'}`);
  }
  if (result.name === 'cloud-function') {
    return verdict(result.status === 200 && 'result' in body, `status ${result.status}`);
  }
  if (result.name === 'third-party-rest') {
    return verdict(result.status === 200, `status ${result.status}, answered locally`);
  }
  return verdict(result.status === 200, `status ${result.status}`);
}

/** Which of the fields the graph reads would render a model-authored value. */
function renderedFields(dataset: SandboxDataset, className: string, sampleData: AgentSampleData | undefined) {
  const klass = dataset.classes[className];
  const first = klass?.records[0];
  const supplied = new Set(Object.keys(sampleData?.[className]?.[0] ?? {}));
  const filled = (klass?.fields ?? []).filter((field) => {
    const value = first?.[field];
    return value !== undefined && value !== null && value !== '';
  });
  return {
    fields: klass?.fields ?? [],
    filled,
    fromModel: filled.filter((field) => supplied.has(field)),
    fromHeuristic: filled.filter((field) => !supplied.has(field))
  };
}

interface ArmTotals {
  sessions: number;
  authored: number;
  costUsd: number | null;
  firstTurnPromptTokens: Record<string, number>;
  completionTokens: number;
  promptTokensTotal: number;
}

/**
 * AIX-008's live-provider residual, and the one risk the spec left unmeasured.
 *
 * Two halves that have to run together. The first is the question no fixture
 * can answer: handed a component that reads a backend, does a real model fill
 * `sample_data`, and is what it fills usable — right collection names, right
 * field names, values a person would recognise. The second is the cost of
 * having asked, measured against AIX-007's $0.0352/component by running the
 * same corpus twice, once with every mention of the field removed.
 *
 * Everything downstream of the model then runs on the *real* candidate: the
 * spliced export, the dataset, and the installed network shim answering the
 * request shapes a preview actually makes.
 */
async function runSandbox(run: Run): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const reps = Math.max(1, Number(args.reps ?? 1));
  const arms: Array<'with' | 'without'> =
    args.arms === 'with' ? ['with'] : args.arms === 'without' ? ['without'] : ['with', 'without'];

  const { graph, project: projectJson } = loadGraph(CORPUS_PROJECT);

  // The style vocabulary the AIX-002 harness injects, built the same way, so
  // the $/component printed here is comparable to AIX-007's baseline rather
  // than to a differently-shaped prompt.
  const metaSource = {
    getMetaData: (key: string) => ((projectJson.metadata ?? {}) as Record<string, unknown>)[key]
  };
  const styleVocabulary = buildStyleVocabulary(metaSource as never);
  const styleTokenRecords = Array.from(buildEffectiveTokens(readStoredTokens(metaSource as never)).values());

  const totals: Record<string, ArmTotals> = {};

  for (const arm of arms) {
    totals[arm] = {
      sessions: 0,
      authored: 0,
      costUsd: 0,
      firstTurnPromptTokens: {},
      completionTokens: 0,
      promptTokensTotal: 0
    };

    // Each arm sends a different cached prefix, so the arms run back to back
    // rather than interleaved: interleaving would make every session a cache
    // miss and price the experiment rather than the product.
    const chat: AuthoringChatFn = async (request, callbacks) => {
      const withModel = { ...request, ...(run.model ? { model: run.model } : {}) };
      const response = await run.provider.chatStream(
        arm === 'without' ? ablateSampleData(withModel) : withModel,
        callbacks ?? {}
      );
      run.served.add(response.model);
      return response;
    };

    for (let rep = 1; rep <= reps; rep++) {
      for (const prompt of SANDBOX_PROMPTS) {
        if (!wants(run, prompt.slug)) continue;
        const label = reps > 1 ? `${prompt.slug}#${rep}` : prompt.slug;
        console.log(`\n▶ sandbox [${arm}] ${label} → ${prompt.componentPath}`);

        const session = AuthoringSession.create(
          graph,
          { description: prompt.description, componentPath: prompt.componentPath },
          { chat, effort: run.effort, styleVocabulary, styleTokenRecords }
        );
        narrate(session);

        const abortController = new AbortController();
        const timer = setTimeout(() => abortController.abort(), run.timeoutMs);
        const startedAt = Date.now();
        const outcome = await session.run({ abortController });
        clearTimeout(timer);
        const sampleData = session.stagedSampleData;
        session.dispose();

        const totalsForArm = totals[arm];
        totalsForArm.sessions += 1;
        if (outcome.status === 'authored') totalsForArm.authored += 1;
        totalsForArm.costUsd =
          totalsForArm.costUsd === null || outcome.metrics.costUsd === null
            ? null
            : totalsForArm.costUsd + outcome.metrics.costUsd;
        totalsForArm.completionTokens += outcome.metrics.completionTokens;
        totalsForArm.promptTokensTotal +=
          outcome.metrics.promptTokens + outcome.metrics.cacheReadTokens + outcome.metrics.cacheWriteTokens;
        const firstTurn = outcome.metrics.usageByTurn[0];
        if (firstTurn && rep === 1) {
          totalsForArm.firstTurnPromptTokens[prompt.slug] = totalPromptTokens({ ...firstTurn, costUsd: null });
        }

        const artifacts: string[] = [];
        const detail: Record<string, unknown> = {
          arm,
          rep,
          componentPath: prompt.componentPath,
          namedClasses: prompt.namedClasses,
          authGated: Boolean(prompt.authGated),
          firstAttemptValid: outcome.rounds.length > 0 ? outcome.rounds[0].ok : null,
          turns: outcome.metrics.turns,
          submits: outcome.metrics.submits,
          rounds: outcome.rounds,
          firstTurnPromptTokens: firstTurn ? totalPromptTokens({ ...firstTurn, costUsd: null }) : null,
          completionTokens: outcome.metrics.completionTokens,
          sampleDataSupplied: Boolean(sampleData)
        };

        // The transcript is the artifact that answers "why did it do that" —
        // and the first run of this mode needed it immediately, because the
        // model built something other than what was asked for and the metrics
        // could only say that it had.
        artifacts.push(
          writeArtifact(run, `sandbox/${arm}/${label}.transcript.json`, JSON.stringify(outcome.transcript, null, 2))
        );
        if (outcome.files) {
          artifacts.push(
            writeArtifact(run, `sandbox/${arm}/${label}.candidate.json`, JSON.stringify(outcome.files, null, 2))
          );
        }
        if (sampleData) {
          artifacts.push(
            writeArtifact(run, `sandbox/${arm}/${label}.sample-data.json`, JSON.stringify(sampleData, null, 2))
          );
        }

        // Everything below runs the candidate through the sandbox path. Only
        // the treatment arm carries sample data, but the control arm's
        // candidates go through it too — a heuristic-only preview is the
        // fallback the whole feature promises, and it has to hold.
        if (outcome.files) {
          try {
            const project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(projectJson)));
            const before = JSON.stringify(project.toJSON());

            const { component } = candidateComponent(outcome.files);
            const closure = componentClosure(project, component);
            const discovery = discoverDataShape(closure);
            const judgement = judgeSampleData(sampleData, discovery, prompt.namedClasses);

            const result = buildSandboxExport({ project, files: outcome.files, sampleData });
            const heuristicOnly = buildSandboxDataset({ components: closure });
            const dataset = (result.json?.metadata?.[SANDBOX_METADATA_KEY] as SandboxDataset | undefined) ?? {
              classes: {},
              user: {} as SandboxRecord
            };

            const untouched = JSON.stringify(project.toJSON()) === before;
            const primary =
              judgement.classesMatched[0] ?? judgement.graphClasses[0] ?? Object.keys(dataset.classes)[0] ?? 'Items';

            const probes = result.json
              ? (await runProbes(dataset, probesFor(primary))).map((probe) =>
                  gradeProbe(probe, primary, dataset.classes[primary]?.records[0])
                )
              : [];

            artifacts.push(
              writeArtifact(run, `sandbox/${arm}/${label}.dataset.json`, JSON.stringify(dataset, null, 2)),
              writeArtifact(
                run,
                `sandbox/${arm}/${label}.dataset-heuristic.json`,
                JSON.stringify(heuristicOnly, null, 2)
              ),
              writeArtifact(run, `sandbox/${arm}/${label}.probes.json`, JSON.stringify(probes, null, 2))
            );

            detail.sandbox = {
              unrenderable: result.unrenderable,
              rootComponent: result.json?.rootComponent,
              summary: result.summary,
              projectUntouched: untouched,
              candidateSpliced: Boolean(
                result.json?.components.some((c) => c.name === `/${prompt.componentPath}`)
              ),
              primaryClass: primary,
              datasetClasses: Object.keys(dataset.classes),
              rendered: primary ? renderedFields(dataset, primary, sampleData) : undefined,
              renderedHeuristicOnly: primary ? renderedFields(heuristicOnly, primary, undefined) : undefined,
              probesPassed: probes.filter((p) => p.ok).length,
              probesTotal: probes.length,
              probeFailures: probes.filter((p) => !p.ok).map((p) => `${p.name}: ${p.why}`)
            };
            detail.sampleJudgement = judgement;

            const rendered = renderedFields(dataset, primary, sampleData);
            console.log(
              `  ${outcome.status} — ${outcome.metrics.turns} turns, ${usd(outcome.metrics.costUsd)}\n` +
                `    sample_data: ${
                  judgement.supplied
                    ? `${judgement.suppliedClasses.join(', ')} (${Object.values(judgement.recordsPerClass).join('/')} records)`
                    : 'NOT SUPPLIED'
                }\n` +
                `    classes matched ${judgement.classesMatched.length}/${judgement.suppliedClasses.length}` +
                `, queried-but-missed ${judgement.classesMissed.join(', ') || 'none'}\n` +
                `    ${primary}: ${rendered.fromModel.length} field(s) from the model, ` +
                `${rendered.fromHeuristic.length} from inference, of ${rendered.fields.length} read\n` +
                `    project untouched ${untouched} · probes ${probes.filter((p) => p.ok).length}/${probes.length}` +
                (probes.filter((p) => !p.ok).length > 0
                  ? ` — ${probes.filter((p) => !p.ok).map((p) => p.name).join(', ')}`
                  : '')
            );
          } catch (error) {
            // A candidate that breaks the sandbox path is a finding, not a
            // reason to lose the seven sessions behind it. Recorded loudly.
            const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
            detail.sandboxError = message;
            console.log(`  !! the sandbox path threw on this candidate:\n${message}`);
          }
        } else {
          console.log(`  ${outcome.status} — no candidate (${outcome.error ?? 'no error reported'})`);
        }

        record({
          mode: 'sandbox',
          slug: label,
          provider: run.providerId,
          model: [...run.served].pop() ?? '(unknown)',
          status: outcome.status,
          durationMs: Date.now() - startedAt,
          costUsd: outcome.metrics.costUsd,
          detail,
          artifacts,
          error: outcome.error
        });
      }
    }
  }

  console.log('\n── arms ──');
  for (const [arm, t] of Object.entries(totals)) {
    const mean = t.costUsd === null || t.sessions === 0 ? null : t.costUsd / t.sessions;
    console.log(
      `  ${arm.padEnd(8)} ${t.authored}/${t.sessions} authored · ${usd(t.costUsd)} total · ${usd(mean)}/component · ` +
        `${t.completionTokens} output tok · ${t.promptTokensTotal} input tok`
    );
  }
  if (totals.with && totals.without) {
    const slugs = Object.keys(totals.with.firstTurnPromptTokens);
    const deltas = slugs
      .filter((slug) => totals.without.firstTurnPromptTokens[slug] !== undefined)
      .map((slug) => totals.with.firstTurnPromptTokens[slug] - totals.without.firstTurnPromptTokens[slug]);
    if (deltas.length > 0) {
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      console.log(
        `  turn-1 input tokens: +${mean.toFixed(1)} with sample_data (${deltas.map((d) => `+${d}`).join(', ')})`
      );
    }
  }
}
