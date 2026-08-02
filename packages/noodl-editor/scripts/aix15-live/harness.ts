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
 * This is one harness with several modes rather than one harness each, because they
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
 *   --mode=update|agentic|plan|scope|review|explain|plan-docs|changeset  (required)
 *       `review` is AIX-010's project-docs review; `changeset` is AIX-003's
 *       graph-native review of a change. Different features, same English word.
 *   --provider=anthropic|openai|openai-compatible|ollama  (default anthropic)
 *   --model=<id>            NOT optional in practice: the registry default reads
 *                           EditorSettings, which this bundle stubs
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

import { docLint } from '../../src/editor/src/models/AiAssistant/authoring/docLint';

import {
  AGENTIC_PROMPTS,
  AGENTIC_TYPES,
  EXPLAIN_PROMPTS,
  PLAN_DOC_PROMPTS,
  PLAN_PROMPTS,
  SCOPE_PROMPTS,
  UPDATE_PROMPTS
} from './corpus';
import {
  buildChangeSet,
  excludedWith,
  requiredWith,
  type AuthoringChangeSet,
  type ReviewChange
} from '../../src/editor/src/models/AiAssistant/authoring/ChangeSet';
import { materializeSelection } from '../../src/editor/src/models/AiAssistant/authoring/applyChangeSet';
import { buildReviewComponent } from '../../src/editor/src/models/AiAssistant/authoring/reviewComponent';
import { validateCandidateComponent } from '../../src/editor/src/models/AiAssistant/authoring/validate';
import type { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { diffGraphs, fromV2Files, toLegacyComponent } from '../../src/editor/src/versioning';
import type { GraphChange, V2ComponentFiles } from '../../src/editor/src/versioning';
import {
  countCosmetic,
  createDisplayNameProvider,
  describeSide,
  presentChanges,
  summarizeChanges
} from '../../src/editor/src/views/panels/GraphDiffPanel/graphChangePresentation';
import { CHANGESET_PROMPTS } from './corpus';

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

const MODES = ['update', 'agentic', 'plan', 'scope', 'review', 'explain', 'plan-docs', 'changeset'] as const;
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
    case 'plan-docs':
      await runPlanDocs(run);
      break;
    case 'changeset':
      await runChangeset(run);
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

// ── Mode: plan-docs (AIX-011 criterion 7, live) ──────────────────────────────

/**
 * The plan path again, but against a project that HAS documents.
 *
 * A separate mode rather than a flag on `plan`, because it measures a different
 * thing and must not move the published `plan` numbers: `plan` measures plan
 * quality and per-component fan-out cost against a project with no docs, and
 * this measures what the doc-authoring turn writes.
 *
 * The residual it closes: neither live plan run contained a `doc` operation, so
 * `DocSession`'s output had never been read. The reason turned out to be
 * mechanical — the planning prompt permits a doc operation only "when the
 * project's docs are listed in the overview material", and nothing listed them
 * (`PlanningSession` built its context with no docs at all). With that fixed,
 * the question this mode answers is the editorial one: does the authored
 * document record intent, decisions and rejected alternatives, or does it
 * restate the graph — and does `docLint` fire on real output.
 */
async function runPlanDocs(run: Run): Promise<void> {
  const { graph, project } = loadGraph(CORPUS_PROJECT);
  const components = (project.components as { name: string }[]) ?? [];
  const byName = new Map(components.map((c) => [c.name, c]));

  for (const prompt of PLAN_DOC_PROMPTS) {
    if (!wants(run, prompt.slug)) continue;
    console.log(`\n▶ plan-docs ${prompt.slug}`);
    const startedAt = Date.now();

    // The project's docs, by the path a plan operation names them with.
    const docBaselines = new Map<string, string>();
    if (prompt.docs.architecture) docBaselines.set('docs/ARCHITECTURE.md', prompt.docs.architecture);
    if (prompt.docs.brief) docBaselines.set('docs/BRIEF.md', prompt.docs.brief);
    if (prompt.docs.conventions) docBaselines.set('docs/CONVENTIONS.md', prompt.docs.conventions);

    const planning = new PlanningSession(graph, prompt.request, {
      chat: run.chat,
      effort: run.effort,
      projectDocs: prompt.docs
    });
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), run.timeoutMs);
    const planned = await planning.run({ abortController });
    clearTimeout(timer);

    if (planned.status !== 'planned' || !planned.plan) {
      console.log(`  ${planned.status} — ${planned.note ?? '(no note)'}`);
      record({
        mode: 'plan-docs',
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
    const docOps = plan.operations.filter((op) => op.kind === 'doc');
    console.log(
      `  planned ${plan.operations.length} operation(s), ${docOps.length} doc — ${usd(planned.costUsd)}`
    );
    for (const op of plan.operations) console.log(`    ${op.kind.padEnd(6)} ${op.target}`);

    const planRun = new PlanRun(graph, plan, {
      baseFilesFor: (legacyName) => {
        const legacy = byName.get(legacyName) ?? byName.get(`/${legacyName}`);
        return legacy ? (buildComponentV2Files(legacy as never, '1970-01-01T00:00:00.000Z') as ComponentFiles) : undefined;
      },
      docBaselineFor: (relPath) => docBaselines.get(relPath),
      // The authoring sessions see the same docs the planner did, so
      // `get_project_doc` answers with the real file rather than with nothing.
      session: { chat: run.chat, effort: run.effort, projectDocs: prompt.docs },
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

    const artifacts: string[] = [
      writeArtifact(run, `plan-docs/${prompt.slug}.plan.json`, JSON.stringify(plan, null, 2))
    ];
    const docResults: Record<string, unknown>[] = [];
    for (const op of finalState.operations) {
      const files = planRun.filesFor(op.operation.id);
      if (files) {
        artifacts.push(
          writeArtifact(
            run,
            `plan-docs/${prompt.slug}/${op.operation.id}-${slugify(op.operation.target)}.json`,
            JSON.stringify(files, null, 2)
          )
        );
      }
      const doc = planRun.docFor(op.operation.id);
      if (!doc) continue;
      // Both halves of the document go to disk: a doc turn is judged as a diff
      // against what the human wrote, and only the proposed half was ever kept.
      artifacts.push(
        writeArtifact(run, `plan-docs/${prompt.slug}/${op.operation.id}-proposed.md`, doc.proposed),
        writeArtifact(run, `plan-docs/${prompt.slug}/${op.operation.id}-baseline.md`, doc.baseline ?? '(no file)')
      );
      // Re-lint the FINAL body here rather than trusting the session's record:
      // the loop's findings are the ones that survived its own advisory pass,
      // and "does the lint fire on real output" is a question about the lint.
      const relint = docLint(doc.proposed, { baseline: doc.baseline });
      docResults.push({
        path: doc.path,
        summary: doc.summary,
        chars: doc.proposed.length,
        baselineChars: doc.baseline?.length ?? 0,
        created: doc.baseline === null,
        lintFindingsFromSession: doc.lintFindings,
        lintFindingsOnFinalBody: relint.lines,
        // Cheap legibility signals a reader can check against the file itself.
        keptBaselineLines: doc.baseline
          ? doc.baseline
              .split('\n')
              .filter((l) => l.trim().length > 0 && doc.proposed.includes(l.trim())).length
          : 0,
        baselineLines: doc.baseline ? doc.baseline.split('\n').filter((l) => l.trim().length > 0).length : 0
      });
      console.log(
        `    doc ${doc.path} — ${doc.proposed.length} chars, ${relint.lines.length} lint finding(s)` +
          `${doc.summary ? ` · "${doc.summary}"` : ''}`
      );
      for (const line of relint.lines) console.log(`        lint: ${line}`);
    }

    const staged = finalState.operations.filter((o) => o.status === 'staged').length;
    console.log(`  staged ${staged}/${finalState.operations.length} — ${usd(finalState.costUsd)}`);

    record({
      mode: 'plan-docs',
      slug: prompt.slug,
      provider: run.providerId,
      model: [...run.served].pop() ?? '(unknown)',
      status: finalState.phase,
      durationMs: Date.now() - startedAt,
      costUsd:
        planned.costUsd === null || finalState.costUsd === null ? null : planned.costUsd + finalState.costUsd,
      detail: {
        request: prompt.request,
        planCostUsd: planned.costUsd,
        fanOutCostUsd: finalState.costUsd,
        docOperationsPlanned: docOps.length,
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
        docs: docResults
      },
      artifacts
    });
  }
}
// ── Mode: changeset (AIX-003 — author → review → partially accept, live) ─────

/**
 * The one AIX-003 residual a fixture cannot close.
 *
 * Every property this mode asserts is already spec-covered — all-accepted
 * reproduces the proposal, rejection closes over `requires`, a partial result
 * passes the SUB-006 gate. The specs assert them against proposals written by
 * the same hand as the assertions: explicit short ids, one change per intent,
 * nothing incidental. This runs the same chain on a diff a model produced
 * against a real component while thinking about the feature, not the review.
 *
 * The chain is: live authoring session → `buildChangeSet` → the closure
 * (`requiredWith` / `excludedWith`) → `materializeSelection` → the same
 * validation gate the Build panel runs before staging. Nothing is applied to a
 * project: `buildChangeSet` reads exactly one thing off the project — the
 * existing component of the same name — so the run supplies that and stops
 * where the panel stops before a human presses Accept.
 */

const EPOCH = '1970-01-01T00:00:00.000Z';

/** Fixed so a failing random subset can be reproduced from the record alone. */
const SUBSET_SEED = 0x0a1c0003;

/** The two rows the review UI refuses to make individually rejectable. */
function isExcludableChange(change: GraphChange): boolean {
  return change.kind !== 'component-renamed' && change.kind !== 'component-metadata-changed';
}

function asV2(files: ComponentFiles): V2ComponentFiles {
  return files as unknown as V2ComponentFiles;
}

/** Semantic equality through the diff engine itself — the specs' own measure. */
function graphDelta(a: ComponentFiles, b: ComponentFiles): GraphChange[] {
  return diffGraphs(fromV2Files(asV2(a)), fromV2Files(asV2(b))).changes;
}

/**
 * What a materialized graph would look like to the editor if the closure were
 * wrong: wires whose endpoints are gone, nodes whose parent is gone. The
 * SUB-006 gate is the real check; this says *how* a bad subset would be bad.
 */
function danglingRefs(files: ComponentFiles): { connections: number; parents: number } {
  const ids = new Set(files.nodes.nodes.map((node) => node.id));
  const connections = files.connections.connections.filter((c) => !ids.has(c.fromId) || !ids.has(c.toId)).length;
  const parents = files.nodes.nodes.filter((node) => {
    const parent = (node as { parent?: string }).parent;
    return parent !== undefined && !ids.has(parent);
  }).length;
  return { connections, parents };
}

/** Deterministic PRNG so a reported subset can be reproduced from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SelectionCheck {
  rejectedInput: string[];
  /** Size of the closure the materializer actually applied. */
  closureSize: number;
  valid: boolean;
  errorCount: number;
  /**
   * Errors this selection introduced — the proposal's own gate result subtracted.
   * The distinction is not pedantic: a proposal can be invalid on its own (a
   * catalog that moved under a saved artifact will do it), and counting those
   * against the closure would report a review defect that is nothing of the kind.
   */
  newErrors: string[];
  /** Ids kept while something they require was rejected — must always be empty. */
  brokenRequirements: string[];
  dangling: { connections: number; parents: number };
  nodes: number;
  connections: number;
  firstError?: string;
}

function errorMessages(validation: { errors: { message: string }[]; structural?: { errors: { message: string }[] }[] }) {
  return [
    ...(validation.structural ?? []).flatMap((f) => f.errors.map((e) => e.message)),
    ...validation.errors.map((e) => e.message)
  ];
}

function checkSelection(
  graph: ExplainGraph,
  changeSet: AuthoringChangeSet,
  files: ComponentFiles,
  rejectedInput: string[],
  baseline: Set<string>
): SelectionCheck {
  const materialized = materializeSelection(changeSet, files, rejectedInput);
  const validation = validateCandidateComponent(graph, changeSet.componentName, materialized.files);
  const messages = errorMessages(validation);
  const brokenRequirements = changeSet.changes
    .filter((entry) => !materialized.rejected.has(entry.id) && entry.requires.some((r) => materialized.rejected.has(r)))
    .map((entry) => entry.id);
  return {
    rejectedInput,
    closureSize: materialized.rejected.size,
    valid: validation.ok,
    errorCount: validation.errors.length,
    newErrors: [...new Set(messages.filter((message) => !baseline.has(message)))],
    brokenRequirements,
    dangling: danglingRefs(materialized.files),
    nodes: materialized.files.nodes.nodes.length,
    connections: materialized.files.connections.connections.length,
    firstError: messages[0]
  };
}

/**
 * The rendered review, in the product's own words. The sentences, grouping and
 * parameter detail come from `graphChangePresentation` — the module the change
 * rail renders from — rather than from a formatter written here, because a
 * harness that invents its own phrasing measures itself. This is the artifact a
 * human fresh reviewer reads.
 */
function renderReview(changeSet: AuthoringChangeSet): string {
  const displayName = createDisplayNameProvider();
  const all = changeSet.changes.map((entry) => entry.change);
  const groups = presentChanges(all, displayName, { includeCosmetic: false });
  const byChange = new Map<GraphChange, ReviewChange>(changeSet.changes.map((entry) => [entry.change, entry]));

  const lines: string[] = [
    `# Review — ${changeSet.componentName}`,
    '',
    `_${changeSet.isNewComponent ? 'New component' : 'Modification'} · ${summarizeChanges(all)} · ` +
      `${countCosmetic(all)} cosmetic change(s) not shown_`,
    '',
    'AIX-003 criterion: a reader who has not seen this change should be able to say what',
    'happened from this page alone. The request that produced it is deliberately in a',
    'separate file (`<slug>.request.md`) — a spoiler at the top of the page would answer',
    'the question the test is asking.',
    '',
    'The bracketed "rejecting this also rejects …" notes are the change set\'s dependency',
    'closure written out. The rail does not print them; it enforces them on click.',
    ''
  ];

  for (const group of groups) {
    lines.push(`## ${group.group} (${group.changes.length})`, '');
    for (const presented of group.changes) {
      const entry = byChange.get(presented.change);
      const closure = entry ? excludedWith(changeSet, [entry.id]).size : 1;
      const drag = closure > 1 ? ` _(rejecting this also rejects ${closure - 1} other change(s))_` : '';
      lines.push(`- ${presented.text}${drag}`);
      const change = presented.change as { params?: { name: string; base?: unknown; target?: unknown }[] };
      for (const param of change.params ?? []) {
        lines.push(`    - \`${param.name}\`: ${describeSide(param.base)} → ${describeSide(param.target)}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function runChangeset(run: Run): Promise<void> {
  const { graph, project } = loadGraph(CORPUS_PROJECT);
  const components = (project.components as { name: string }[]) ?? [];
  const byName = new Map(components.map((c) => [c.name, c]));

  for (const prompt of CHANGESET_PROMPTS) {
    if (!wants(run, prompt.slug)) continue;

    const legacy = prompt.legacyName ? byName.get(prompt.legacyName) : undefined;
    if (prompt.legacyName && !legacy) throw new Error(`${prompt.legacyName} is not in the corpus project.`);
    const baseFiles = legacy ? (buildComponentV2Files(legacy as never, EPOCH) as ComponentFiles) : undefined;

    console.log(
      `\n▶ changeset ${prompt.slug} → ${prompt.componentPath}` +
        (baseFiles ? ` (update, base ${baseFiles.nodes.nodes.length} nodes)` : ' (new component)')
    );

    // ── 1. Author, live ──────────────────────────────────────────────────────
    const request = { description: prompt.description, componentPath: prompt.componentPath };
    const session = baseFiles
      ? AuthoringSession.createUpdate(graph, request, baseFiles, { chat: run.chat, effort: run.effort })
      : AuthoringSession.create(graph, request, { chat: run.chat, effort: run.effort });
    narrate(session);

    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), run.timeoutMs);
    const startedAt = Date.now();
    const outcome = await session.run({ abortController });
    clearTimeout(timer);
    session.dispose();

    if (!outcome.files) {
      console.log(`  ${outcome.status} — no proposal, nothing to review. ${outcome.error ?? ''}`);
      record({
        mode: 'changeset',
        slug: prompt.slug,
        provider: run.providerId,
        model: [...run.served].pop() ?? '(unknown)',
        status: outcome.status,
        durationMs: Date.now() - startedAt,
        costUsd: outcome.metrics.costUsd,
        detail: { componentPath: prompt.componentPath, rounds: outcome.rounds },
        artifacts: [],
        error: outcome.error
      });
      continue;
    }

    const files = outcome.files;

    // ── 2. The change set, through the real adapter ──────────────────────────
    // `buildChangeSet` reads one thing off the project: the existing component
    // of the proposal's own name. A `ProjectModel` in a terminal process would
    // drag the whole editor in, so the run supplies that one lookup — the same
    // legacy JSON `ComponentModel.toJSON()` would hand back — and nothing else.
    const lookups: string[] = [];
    const shimProject = {
      getComponentWithName: (name: string) => {
        lookups.push(name);
        return legacy && name === prompt.legacyName ? { toJSON: () => legacy } : undefined;
      }
    };
    const changeSet = buildChangeSet(shimProject as unknown as ProjectModel, files);
    const all = changeSet.changes.map((entry) => entry.change);
    const excludable = changeSet.changes.filter((entry) => isExcludableChange(entry.change));

    console.log(
      `  change set: ${changeSet.changes.length} change(s) — ${summarizeChanges(all)}, ` +
        `${countCosmetic(all)} cosmetic · resolved as ${changeSet.componentName}` +
        `${changeSet.isNewComponent ? ' (new)' : ''}`
    );

    // ── 3. All-accepted must reproduce the proposal exactly ──────────────────
    const allAccepted = materializeSelection(changeSet, files, []);
    const residual = graphDelta(allAccepted.files, files);
    console.log(
      residual.length === 0
        ? '  ✓ all-accepted reproduces the proposal (0 residual changes)'
        : `  ✗ all-accepted differs from the proposal: ${residual.map((c) => c.kind).join(', ')}`
    );

    // The proposal's own gate result is the baseline every selection is judged
    // against: the session already accepted these files, so anything the gate
    // says about them is a statement about the proposal, not about the review.
    const proposalValidation = validateCandidateComponent(graph, changeSet.componentName, files);
    const baseline = new Set(errorMessages(proposalValidation));
    if (!proposalValidation.ok) {
      console.log(`  ! the proposal itself does not pass the gate: ${[...baseline].join(' / ')}`);
    }

    // ── 4. Every single-change rejection, closed and gated ───────────────────
    const perChange = excludable.map((entry) => ({
      id: entry.id,
      kind: entry.change.kind,
      requires: entry.requires,
      ...checkSelection(graph, changeSet, files, [entry.id], baseline)
    }));
    const failures = perChange.filter(
      (c) => c.newErrors.length > 0 || c.brokenRequirements.length > 0 || c.dangling.connections > 0
    );
    const maxClosure = perChange.reduce((max, c) => Math.max(max, c.closureSize), 0);
    const independent = perChange.filter((c) => c.closureSize === 1).length;
    console.log(
      `  single-change rejections: ${perChange.length} swept, ${failures.length} failing · ` +
        `closure 1..${maxClosure} · ${independent} independently rejectable`
    );

    // ── 5. Random subsets, seeded so a failure is reproducible ───────────────
    const random = mulberry32(SUBSET_SEED);
    const subsets: SelectionCheck[] = [];
    for (let i = 0; i < 40 && excludable.length > 0; i++) {
      const rejected = excludable.filter(() => random() < 0.3).map((entry) => entry.id);
      if (rejected.length === 0) continue;
      subsets.push(checkSelection(graph, changeSet, files, rejected, baseline));
    }
    const subsetFailures = subsets.filter((s) => s.newErrors.length > 0 || s.brokenRequirements.length > 0);
    console.log(`  random subsets: ${subsets.length} swept, ${subsetFailures.length} failing`);

    // ── 6. The falsifier: is the closure doing any work? ─────────────────────
    // Same rejection through a change set whose `requires` edges have been
    // stripped. If that produces the same graph, the closure proved nothing
    // here and the "invalid subsets are unrepresentable" claim is untested by
    // this diff — which is a result, not a pass.
    const widest = perChange.reduce<(typeof perChange)[number] | undefined>(
      (best, c) => (best === undefined || c.closureSize > best.closureSize ? c : best),
      undefined
    );
    let falsifier: Record<string, unknown> | undefined;
    if (widest && widest.closureSize > 1) {
      const unclosed: AuthoringChangeSet = {
        ...changeSet,
        changes: changeSet.changes.map((entry) => ({ ...entry, requires: [] }))
      };
      const without = checkSelection(graph, unclosed, files, [widest.id], baseline);
      falsifier = {
        changeId: widest.id,
        kind: widest.kind,
        closed: {
          closureSize: widest.closureSize,
          valid: widest.valid,
          newErrors: widest.newErrors,
          dangling: widest.dangling
        },
        unclosed: {
          closureSize: without.closureSize,
          valid: without.valid,
          newErrors: without.newErrors,
          dangling: without.dangling,
          firstError: without.firstError
        }
      };
      console.log(
        `  falsifier on ${widest.id}: closed ⇒ ${widest.valid ? 'valid' : 'INVALID'}, ` +
          `unclosed ⇒ ${without.valid ? 'valid' : 'invalid'} with ` +
          `${without.dangling.connections} dangling wire(s), ${without.dangling.parents} orphan(s)`
      );
    } else {
      console.log('  falsifier: no change in this set drags another — the closure is untested by this diff');
    }

    // ── 7. The headline partial acceptance ───────────────────────────────────
    const headlineReject = widest && widest.closureSize > 1 ? [widest.id] : perChange.slice(0, 2).map((c) => c.id);
    const headline =
      headlineReject.length > 0 ? checkSelection(graph, changeSet, files, headlineReject, baseline) : undefined;
    const headlineFiles =
      headlineReject.length > 0 ? materializeSelection(changeSet, files, headlineReject).files : undefined;

    // ── 8. A relabel probe — no API cost, and it exercises a kind the corpus
    //      has none of. Base and target are the same proposal apart from one
    //      wire's label, so the whole diff should be that one change. ─────────
    let relabel: Record<string, unknown> | undefined;
    if (files.connections.connections.length > 0) {
      const asLegacy = toLegacyComponent(fromV2Files(asV2(files)));
      const probeProject = { getComponentWithName: () => ({ toJSON: () => asLegacy }) };
      const idempotent = buildChangeSet(probeProject as unknown as ProjectModel, files);
      const labelled: ComponentFiles = JSON.parse(JSON.stringify(files));
      (labelled.connections.connections[0] as { label?: string }).label = 'live relabel probe';
      const relabelSet = buildChangeSet(probeProject as unknown as ProjectModel, labelled);
      const relabelAccepted = materializeSelection(relabelSet, labelled, []);
      const relabelResidual = graphDelta(relabelAccepted.files, labelled);
      relabel = {
        roundTripChanges: idempotent.changes.map((entry) => entry.change.kind),
        kinds: relabelSet.changes.map((entry) => entry.change.kind),
        changeIds: relabelSet.changes.map((entry) => entry.id),
        residualAfterAllAccepted: relabelResidual.map((c) => c.kind)
      };
      console.log(
        `  relabel probe: base round trip ${idempotent.changes.length} change(s); ` +
          `relabel diff [${relabelSet.changes.map((e) => e.change.kind).join(', ')}] with ids ` +
          `[${relabelSet.changes.map((e) => String(e.id)).join(', ')}]; ` +
          `all-accepted residual ${relabelResidual.length}`
      );
    }

    // ── 9. Artifacts ─────────────────────────────────────────────────────────
    const artifacts: string[] = [
      writeArtifact(run, `changeset/${prompt.slug}.candidate.json`, JSON.stringify(files, null, 2)),
      writeArtifact(
        run,
        `changeset/${prompt.slug}.changes.json`,
        JSON.stringify(
          {
            componentName: changeSet.componentName,
            isNewComponent: changeSet.isNewComponent,
            changes: changeSet.changes.map((entry) => ({
              id: entry.id,
              kind: entry.change.kind,
              category: entry.change.category,
              requires: entry.requires,
              excludedWith: [...excludedWith(changeSet, [entry.id])].filter((id) => id !== entry.id),
              requiredWith: [...requiredWith(changeSet, [entry.id])].filter((id) => id !== entry.id)
            }))
          },
          null,
          2
        )
      ),
      writeArtifact(run, `changeset/${prompt.slug}.review.md`, renderReview(changeSet)),
      writeArtifact(
        run,
        `changeset/${prompt.slug}.request.md`,
        `# What was asked for — ${changeSet.componentName}\n\n> ${prompt.description}\n`
      ),
      writeArtifact(
        run,
        `changeset/${prompt.slug}.review-component.json`,
        JSON.stringify(buildReviewComponent(changeSet), null, 2)
      )
    ];
    if (baseFiles) {
      artifacts.push(writeArtifact(run, `changeset/${prompt.slug}.base.json`, JSON.stringify(baseFiles, null, 2)));
    }
    if (headlineFiles) {
      artifacts.push(
        writeArtifact(run, `changeset/${prompt.slug}.partial.json`, JSON.stringify(headlineFiles, null, 2))
      );
    }

    const kindCounts: Record<string, number> = {};
    for (const change of all) kindCounts[change.kind] = (kindCounts[change.kind] ?? 0) + 1;

    record({
      mode: 'changeset',
      slug: prompt.slug,
      provider: run.providerId,
      model: [...run.served].pop() ?? '(unknown)',
      status: outcome.status,
      durationMs: Date.now() - startedAt,
      costUsd: outcome.metrics.costUsd,
      detail: {
        componentPath: prompt.componentPath,
        description: prompt.description,
        legacyName: prompt.legacyName,
        freshReviewer: prompt.freshReviewer === true,
        firstAttemptValid: outcome.rounds.length > 0 ? outcome.rounds[0].ok : null,
        baseNodes: baseFiles ? baseFiles.nodes.nodes.length : 0,
        proposedNodes: files.nodes.nodes.length,
        proposedConnections: files.connections.connections.length,
        resolvedComponentName: changeSet.componentName,
        componentLookups: lookups,
        isNewComponent: changeSet.isNewComponent,
        changeCount: changeSet.changes.length,
        excludableCount: excludable.length,
        cosmeticCount: countCosmetic(all),
        summary: summarizeChanges(all),
        kindCounts,
        // The criterion the notes state: all-accepted reproduces the proposal,
        // asserted through the diff engine's own equality.
        allAcceptedResidual: residual.map((c) => c.kind),
        allAcceptedReproducesProposal: residual.length === 0,
        proposalPassesGate: proposalValidation.ok,
        proposalGateErrors: [...baseline],
        singleRejectionSweep: {
          swept: perChange.length,
          failing: failures.length,
          maxClosure,
          independentlyRejectable: independent,
          failures: failures.map((f) => ({
            id: f.id,
            kind: f.kind,
            valid: f.valid,
            newErrors: f.newErrors,
            brokenRequirements: f.brokenRequirements,
            dangling: f.dangling,
            firstError: f.firstError
          }))
        },
        randomSubsetSweep: {
          swept: subsets.length,
          failing: subsetFailures.length,
          failures: subsetFailures
        },
        falsifier,
        headline: headline
          ? { rejectedInput: headlineReject, ...headline }
          : undefined,
        relabelProbe: relabel,
        changes: changeSet.changes.map((entry) => ({
          id: entry.id,
          kind: entry.change.kind,
          category: entry.change.category,
          requires: entry.requires
        })),
        rounds: outcome.rounds
      },
      artifacts,
      error: outcome.error
    });
  }
}
