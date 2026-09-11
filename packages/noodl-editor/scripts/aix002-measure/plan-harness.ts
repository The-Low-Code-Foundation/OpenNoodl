/**
 * FIX-022 — does the planner over-decompose?
 *
 * The user-test report's first complaint was a Script node *inside a component
 * that should not have existed*. FIX-006 measured the node choice and the code
 * style and closed on both — but explicitly could not reach that half, because
 * `AuthoringSession` is handed its `componentPath` and never decides whether a
 * component should exist. That decision belongs to `PlanningSession` and to
 * `DECOMPOSITION_PLANNING`, and this harness is the instrument for it.
 *
 * Runs the real `PlanningSession` — the real system prompt, the real context
 * builder, the real plan validator — against the real 44-component corpus
 * project, with a directly-constructed provider bound to keys from the repo-root
 * `.env`. No Electron, no UI. The artefact graded is the plan itself, which is
 * structured data, so the grade is a count and a list of names rather than a
 * reading of prose.
 *
 * Build + run (from the repo root):
 *
 *   node packages/noodl-editor/scripts/aix002-measure/build.mjs
 *   node packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs \
 *     --model=claude-sonnet-5 --doctrine=on --repeats=3
 *
 * Flags:
 *   --provider=anthropic|openai|openai-compatible|ollama   (default anthropic)
 *   --model=<id>            ⚠️ effectively required — see harness.ts's note
 *   --only=slug1,slug2      run a subset of the corpus
 *   --project=<path>        project.json to plan against (default: git-repo-utf8)
 *   --repeats=<n>           sessions per prompt (default 1)
 *   --out=<path>            JSONL destination
 *   --timeout=<seconds>     per-session wall clock (default 300)
 *   --effort=low|…|max      reasoning depth (default: the loop's own)
 *   --doctrine=on|off       the A/B arm. `off` reverts the system prompt on the
 *                           wire to exactly what it was before AAQ-008.
 *   --dump=<path>           write this arm's system prompt and exit, before any
 *                           provider is built and before a single token is spent.
 *                           ✅ This is how the control arm is checked: dump both
 *                           arms and diff them. The difference must be AAQ-008
 *                           and nothing else, and no API key is needed to see it.
 *
 * @module scripts/aix002-measure/plan-harness
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AuthoringChatFn } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { AUTHORING_EFFORT } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import { PlanningSession } from '../../src/editor/src/models/AiAssistant/authoring/PlanningSession';
import type { PlanningOutcome } from '../../src/editor/src/models/AiAssistant/authoring/PlanningSession';
import type { PlanOperation } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { planningSystemPrompt } from '../../src/editor/src/models/AiAssistant/authoring/prompts/planning';
import { assertDoctrinePresent, revertToPreDoctrine } from './plan-doctrine-arm';
import type { PlanGrade } from './plan-grade';
import { gradePlan } from './plan-grade';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import type { AiChatRequest, AiEffort, AiProvider, AiProviderId } from '../../src/editor/src/models/AiAssistant/client/types';
import { AI_EFFORT_LEVELS, AI_PROVIDER_IDS } from '../../src/editor/src/models/AiAssistant/client/types';
import { buildProvider, findRepoRoot, formatUsd, loadEnv, parseArgs } from './shared';
import type { PlanPrompt } from './plan-prompts';
import { PLAN_PROMPTS } from './plan-prompts';

const REPO_ROOT = findRepoRoot(__dirname);
const DEFAULT_PROJECT = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8/project.json');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'dev-docs/tasks/phase-66-0.1.7-bug-fixes/measurements');

// ── The control arm ──────────────────────────────────────────────────────────
//
// The transform itself lives in `plan-doctrine-arm.ts` so that `test:main` can
// hold it — see that module's header. What is left here is only the request
// plumbing around it.

function withoutDoctrine(request: AiChatRequest): { request: AiChatRequest; systemChars: number } {
  let systemsSeen = 0;
  let systemChars = 0;

  const messages = request.messages.map((message) => {
    if (message.role !== 'system') return message;
    systemsSeen += 1;
    if (typeof message.content !== 'string') {
      throw new Error('control arm: the system message is not a plain string — the revert cannot be verified');
    }
    const content = revertToPreDoctrine(message.content);
    systemChars = content.length;
    return { ...message, content };
  });

  if (systemsSeen !== 1) throw new Error(`control arm: expected exactly one system message, saw ${systemsSeen}`);
  return { request: { ...request, messages }, systemChars };
}

function withDoctrine(request: AiChatRequest): number {
  const system = request.messages.find((m) => m.role === 'system');
  if (typeof system?.content !== 'string') throw new Error('treatment arm: no plain-string system message');
  return assertDoctrinePresent(system.content).length;
}

// ── Grading ──────────────────────────────────────────────────────────────────
//
// The grader lives in `plan-grade.ts` for the same reason the arm transform
// lives in `plan-doctrine-arm.ts`: this file calls `main()` at import time, so
// nothing in it can be held by a spec. `tests-unit/phase-66/planGrade.test.ts`
// holds it in `test:main`.

interface PlanRecord {
  slug: string;
  run: number;
  provider: AiProviderId;
  model: string;
  request: string;
  doctrine: boolean;
  systemPromptChars: number;
  effort: AiEffort;
  status: PlanningOutcome['status'];
  note?: string;
  durationMs: number;
  turns: number;
  costUsd: number | null;
  expect: PlanPrompt['expect'];
  grade: PlanGrade;
  operations: PlanOperation[];
  advisories: PlanningOutcome['advisories'];
}

async function measureOne(
  prompt: PlanPrompt,
  run: number,
  graph: ReturnType<typeof fromSerialisedProject>,
  provider: AiProvider,
  providerId: AiProviderId,
  model: string | undefined,
  timeoutMs: number,
  effort: AiEffort,
  doctrine: boolean
): Promise<PlanRecord> {
  let servedModel = model ?? '(provider default)';
  let systemPromptChars = 0;

  const chat: AuthoringChatFn = async (request, callbacks) => {
    let outbound = request;
    if (doctrine) {
      systemPromptChars = withDoctrine(request);
    } else {
      const reverted = withoutDoctrine(request);
      outbound = reverted.request;
      systemPromptChars = reverted.systemChars;
    }
    const response = await provider.chatStream({ ...outbound, ...(model ? { model } : {}) }, callbacks ?? {});
    servedModel = response.model;
    return response;
  };

  const session = new PlanningSession(graph, prompt.request, {
    chat,
    effort,
    // Deterministic across arms and across machines. `currentProjectDocs()`
    // returns {} headlessly anyway (no provider is installed outside the
    // editor), so this states the harness's real condition rather than relying
    // on it — and it keeps `doc` operations out of the decomposition grade.
    projectDocs: {}
  });

  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);
  const startedAt = Date.now();
  const outcome = await session.run({ abortController });
  const durationMs = Date.now() - startedAt;
  clearTimeout(timer);

  const operations = outcome.plan?.operations ?? [];
  return {
    slug: prompt.slug,
    run,
    provider: providerId,
    model: servedModel,
    request: prompt.request,
    doctrine,
    systemPromptChars,
    effort,
    status: outcome.status,
    note: outcome.note,
    durationMs,
    turns: outcome.turns,
    costUsd: outcome.costUsd,
    expect: prompt.expect,
    grade: gradePlan(operations, prompt.expect),
    operations,
    advisories: outcome.advisories
  };
}

function summarise(records: PlanRecord[]): void {
  const planned = records.filter((r) => r.status === 'planned');
  const total = records.reduce<number | null>(
    (sum, r) => (sum === null || r.costUsd === null ? null : sum + r.costUsd),
    0
  );

  console.log('\n── Summary ─────────────────────────────────────────────');
  console.log(`doctrine:          ${records[0]?.doctrine ? 'ON (shipped)' : 'OFF (pre-AAQ-008)'}`);
  console.log(`system prompt:     ${records[0]?.systemPromptChars ?? 0} chars on the wire`);
  console.log(`effort:            ${records[0]?.effort ?? '-'}`);
  console.log(`sessions:          ${records.length}   planned ${planned.length}`);
  console.log(`total cost:        ${formatUsd(total)}`);

  const slugs = [...new Set(records.map((r) => r.slug))];
  console.log('\nper prompt (creates — the metric the doctrine moves):');
  for (const slug of slugs) {
    // 🔴 The oracle is graded over PLANNED sessions only. A session that never
    // got a plan — a provider timeout, an exhausted credit balance — grades as
    // 0 creates and fails `withinExpectation`, which is correct for the record
    // and a lie in a summary: it reads as "the planner created nothing", the
    // exact failure `reuse-available` exists to detect. Session 53 lost three
    // sessions to a billing error mid-grid and would have reported them as
    // three plans that refused to factor.
    const allRows = records.filter((r) => r.slug === slug);
    const rows = allRows.filter((r) => r.status === 'planned');
    if (allRows.length !== rows.length) {
      console.log(
        `  ${slug.padEnd(14)} ⚠️  ${allRows.length - rows.length} of ${allRows.length} session(s) never planned — ` +
          `excluded from the grades below. First note: ${allRows.find((r) => r.status !== 'planned')?.note ?? '(none)'}`
      );
    }
    if (rows.length === 0) continue;
    const counts = rows.map((r) => r.grade.creates);
    const mean = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
    const ok = rows.filter((r) => r.grade.withinExpectation).length;
    const e = rows[0].expect;
    console.log(
      `  ${slug.padEnd(14)} creates [${counts.join(',')}]  mean ${mean.toFixed(1)}  ` +
        `expect ${e.createsMin}-${e.createsMax}  within ${ok}/${rows.length}`
    );
    // The reuse axis. Reported for every prompt, not only the ones that ask for
    // reuse: on `small-logic` a single-use count IS the defect rate (s43), and
    // on `reuse-available` a single-use count is the instrument disagreeing
    // with the request. Same number, opposite meaning — so it is always shown
    // with the oracle beside it.
    const created = rows.filter((r) => r.grade.creates > 0);
    if (created.length) {
      const single = rows.reduce((n, r) => n + r.grade.singleUseCreates.length, 0);
      const reused = rows.reduce((n, r) => n + r.grade.reusedCreates.length, 0);
      const unplaced = rows.reduce((n, r) => n + r.grade.unplacedCreates.length, 0);
      console.log(
        `      reuse: ${reused} component(s) placed 2+ sites, ${single} placed once` +
          `${unplaced ? `, ${unplaced} with no placement detected ⚠️` : ''}` +
          `${e.minPlacementSites ? `  (this prompt expects ≥${e.minPlacementSites} sites)` : ''}`
      );
    }

    for (const r of rows) {
      const logic = r.grade.logicCreates.length ? `  🔴 logic: ${r.grade.logicCreates.join(', ')}` : '';
      console.log(
        `      run ${r.run}: ${r.status}  ${r.grade.creates}c/${r.grade.updates}u  ` +
          `app-update ${r.grade.registersPages ? 'yes' : 'no'}${logic}`
      );
      for (const p of r.grade.placements) {
        // The evidence split is printed rather than summarised away: a site
        // seen only in prose is a weaker claim than one named in
        // `instantiates`, and the reader should not have to open the JSONL to
        // find out which they are looking at.
        console.log(
          `          + ${p.target}  → ${p.sites} site(s) ` +
            `[${p.structuralSites} structural, ${p.proseOnlySites} prose]` +
            `${p.siteTargets.length ? `: ${p.siteTargets.join(', ')}` : ''}`
        );
      }
    }
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
  const timeoutMs = (args.timeout ? Number(args.timeout) : 300) * 1000;
  const projectPath = args.project ?? DEFAULT_PROJECT;
  const only = args.only ? args.only.split(',').map((s) => s.trim()) : null;
  const repeats = args.repeats ? Number(args.repeats) : 1;
  if (!Number.isInteger(repeats) || repeats < 1) throw new Error(`--repeats must be a positive integer`);
  const doctrine = (args.doctrine ?? 'on').toLowerCase() !== 'off';
  const effort = (args.effort ?? AUTHORING_EFFORT) as AiEffort;
  if (!AI_EFFORT_LEVELS.includes(effort)) {
    throw new Error(`Unknown effort "${effort}" — one of: ${AI_EFFORT_LEVELS.join(', ')}`);
  }

  // --dump: the arm transform, applied to the real shipped prompt, written out
  // and nothing else. Deliberately before the provider is built, so it runs with
  // no key — the arms are checkable by anyone, not only by whoever paid for the
  // run that produced the numbers.
  if (args.dump) {
    const system = planningSystemPrompt();
    const content = doctrine ? assertDoctrinePresent(system) : revertToPreDoctrine(system);
    fs.writeFileSync(args.dump, content);
    console.log(`doctrine ${doctrine ? 'ON' : 'OFF'} — ${content.length} chars → ${args.dump}`);
    return;
  }

  const prompts = only ? PLAN_PROMPTS.filter((p) => only.includes(p.slug)) : PLAN_PROMPTS;
  if (prompts.length === 0) {
    throw new Error(`No prompts matched --only=${args.only}. Known: ${PLAN_PROMPTS.map((p) => p.slug).join(', ')}`);
  }

  const env = loadEnv(path.join(REPO_ROOT, '.env'));
  const provider = buildProvider(providerId, env);
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  const graph = fromSerialisedProject(project);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile =
    args.out ??
    path.join(
      DEFAULT_OUT_DIR,
      `${stamp}-fix022-plan-${model ?? 'default'}-doctrine-${doctrine ? 'on' : 'off'}-effort-${effort}.jsonl`
    );
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  console.log(`FIX-022 planning measurement — ${providerId} / ${model ?? 'registry default'} — ` +
    `doctrine ${doctrine ? 'ON' : 'OFF'} — effort ${effort} — ${repeats} run(s) each`);
  console.log(`project: ${path.relative(REPO_ROOT, projectPath)} (${graph.components.length} components)`);
  console.log(`record:  ${path.relative(REPO_ROOT, outFile)}\n`);

  const records: PlanRecord[] = [];
  for (const prompt of prompts) {
    for (let run = 1; run <= repeats; run++) {
      console.log(`▶ ${prompt.slug} (run ${run}/${repeats})`);
      const record = await measureOne(
        prompt,
        run,
        graph,
        provider,
        providerId,
        model,
        timeoutMs,
        effort,
        doctrine
      );
      records.push(record);
      fs.appendFileSync(outFile, JSON.stringify(record) + '\n');
      console.log(
        `  ${record.status} — ${record.grade.creates} create(s), ${record.grade.updates} update(s), ` +
          `${record.turns} turn(s), ${formatUsd(record.costUsd)}`
      );
      for (const t of record.grade.createTargets) console.log(`      + ${t}`);
      console.log('');
    }
  }

  summarise(records);
}

main().catch((error) => {
  console.error(`\nharness failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
