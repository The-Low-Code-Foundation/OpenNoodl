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
 *   --mode=update|agentic|plan|scope|review|explain   (required)
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

const MODES = ['update', 'agentic', 'plan', 'scope', 'review', 'explain'] as const;
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
