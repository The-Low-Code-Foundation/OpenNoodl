/**
 * AIX-011 — Project-scope authoring: the planning session
 *
 * One bounded conversation that turns a project-scope request into an
 * `AuthoringPlan` — operations and intents, no graph content. Deliberately
 * tiny next to `AuthoringSession`: a couple of turns, one tool, and the plan
 * validator as its gate. Rejecting the produced plan costs nothing further:
 * a plan is plain data, and no authoring session exists until `PlanRun`
 * executes it (criterion 2 is structural, not promised).
 *
 * The chat function is the same injection seam as the authoring loop: the
 * editor binds `AiClient.chatStream`, specs bind a script.
 *
 * @module AiAssistant/authoring/PlanningSession
 */

import { AiClient } from '../client';
import type { AiEffort, AiMessage, AiToolCall } from '../client/types';
import type { ExplainGraph } from '../explain/types';
// Pure ProjectDocs submodules only, for the same reason `AuthoringSession`
// imports them this way: the barrel would drag ProjectModel and the platform
// filesystem into the headless measurement bundle.
import { currentProjectDocs } from '../../ProjectDocs/currentDocs';
import type { ProjectDocsContent } from '../../ProjectDocs/docsText';
import type { AuthoringChatFn } from './AuthoringSession';
import { AUTHORING_EFFORT, AuthoringSetupError } from './AuthoringSession';
import { AuthoringContextBuilder } from './ContextBuilder';
import type {
  AuthoringPlan,
  PlanAdvisory,
  PlanOperation,
  PlanOperationKind,
  PlanPortDeclaration,
  PlanRepeatSpec
} from './plan';
import { PLAN_REPEAT_SOURCES, planAdvisories, validatePlan, orderPlanOperations } from './plan';
import {
  PLANNING_TOOLS,
  planAdvisoryMessage,
  planningSystemPrompt,
  planningUserMessage,
  planRepairMessage,
  SUBMIT_PLAN
} from './prompts/planning';
import type { ContextBudget } from './types';

const DEFAULT_MAX_TURNS = 6;
const DEFAULT_MAX_SUBMITS = 3;

export interface PlanningOptions {
  chat?: AuthoringChatFn;
  budget?: Partial<ContextBudget>;
  maxTurns?: number;
  maxSubmits?: number;
  effort?: AiEffort;
  /**
   * AIX-011 criterion 7: the open project's `docs/` bodies, so the plan can
   * contain a `doc` operation. Defaults to the installed provider's snapshot —
   * the same default `AuthoringSession` takes, and for the same reason: a panel
   * should not have to remember to wire this up. Pass `{}` to plan as if the
   * project had no docs.
   */
  projectDocs?: ProjectDocsContent;
}

export type PlanningStatus = 'planned' | 'declined' | 'exhausted' | 'cancelled' | 'error';

export interface PlanningOutcome {
  status: PlanningStatus;
  /** Present when status is 'planned'. Ordered, validated, ids assigned. */
  plan?: AuthoringPlan;
  /**
   * LAS-006 — what was worth saying about an accepted plan: unstated interfaces,
   * a plan that is one page. Present on 'planned' outcomes, empty when the plan
   * had nothing to answer for. The session has already put these to the model
   * once; these are for whatever shows the plan to a human.
   */
  advisories?: PlanAdvisory[];
  /** The model's prose when it declined to plan, or the error message. */
  note?: string;
  costUsd: number | null;
  turns: number;
}

/**
 * LAS-006 — narrow one declared port list. A model that sends a bare string
 * where an object was asked for has still named the port, which is the half that
 * binds, so it is accepted rather than turned into a repair round.
 */
function toPorts(raw: unknown): PlanPortDeclaration[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ports: PlanPortDeclaration[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      if (entry.trim()) ports.push({ name: entry.trim() });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const port = entry as { name?: unknown; type?: unknown; description?: unknown };
    ports.push({
      // An empty name is kept, not dropped: `validatePlan` says "every port
      // needs a name", and a silently discarded port would make that message
      // impossible to reach.
      name: typeof port.name === 'string' ? port.name.trim() : '',
      ...(typeof port.type === 'string' && port.type.trim() ? { type: port.type.trim() } : {}),
      ...(typeof port.description === 'string' && port.description.trim()
        ? { description: port.description.trim() }
        : {})
    });
  }
  return ports.length > 0 ? ports : undefined;
}

function toRepeats(raw: unknown): PlanRepeatSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const spec = raw as { source?: unknown; rowFields?: unknown };
  const source = PLAN_REPEAT_SOURCES.find((s) => s === spec.source);
  if (!source) return undefined;
  const rowFields = Array.isArray(spec.rowFields)
    ? spec.rowFields.filter((f): f is string => typeof f === 'string' && f.trim().length > 0).map((f) => f.trim())
    : [];
  return { source, rowFields };
}

function toStrings(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim());
  return out.length > 0 ? out : undefined;
}

/** Narrow the model-supplied operations array; anything malformed is an error line. */
function toOperations(args: Record<string, unknown>): { operations: PlanOperation[]; errors: string[] } {
  const raw = args.operations;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { operations: [], errors: ['submit_plan needs a non-empty operations array.'] };
  }
  const operations: PlanOperation[] = [];
  const errors: string[] = [];
  raw.forEach((entry, index) => {
    const op = entry as {
      kind?: unknown;
      target?: unknown;
      intent?: unknown;
      inputs?: unknown;
      outputs?: unknown;
      repeats?: unknown;
      instantiates?: unknown;
    };
    const kind = op?.kind;
    if (kind !== 'create' && kind !== 'update' && kind !== 'doc') {
      errors.push(`Operation ${index + 1}: kind must be create, update or doc.`);
      return;
    }
    const inputs = toPorts(op.inputs);
    const outputs = toPorts(op.outputs);
    const repeats = toRepeats(op.repeats);
    const instantiates = toStrings(op.instantiates);
    operations.push({
      id: `op-${index + 1}`,
      kind: kind as PlanOperationKind,
      target: typeof op.target === 'string' ? op.target.trim() : '',
      intent: typeof op.intent === 'string' ? op.intent.trim() : '',
      ...(inputs ? { inputs } : {}),
      ...(outputs ? { outputs } : {}),
      ...(repeats ? { repeats } : {}),
      ...(instantiates ? { instantiates } : {})
    });
  });
  return { operations, errors };
}

export class PlanningSession {
  private readonly chat: AuthoringChatFn;
  private readonly maxTurns: number;
  private readonly maxSubmits: number;
  private readonly effort: AiEffort;
  readonly context: AuthoringContextBuilder;
  private readonly existingComponents: ReadonlySet<string>;

  constructor(graph: ExplainGraph, private readonly request: string, options: PlanningOptions = {}) {
    if (!request.trim()) throw new AuthoringSetupError('The request is empty — nothing to plan.');
    this.chat = options.chat ?? ((req, callbacks) => AiClient.chatStream(req, callbacks ?? {}));
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.maxSubmits = options.maxSubmits ?? DEFAULT_MAX_SUBMITS;
    this.effort = options.effort ?? AUTHORING_EFFORT;
    this.context = new AuthoringContextBuilder(
      graph,
      options.budget,
      undefined,
      undefined,
      options.projectDocs ?? currentProjectDocs()
    );
    this.existingComponents = new Set(graph.components.map((c) => c.name));
  }

  async run(options: { abortController?: AbortController } = {}): Promise<PlanningOutcome> {
    const abortController = options.abortController ?? new AbortController();
    const messages: AiMessage[] = [
      { role: 'system', content: planningSystemPrompt() },
      {
        role: 'user',
        content: planningUserMessage(this.request, this.context.projectOverview(), this.context.docsOverview())
      }
    ];

    let turns = 0;
    let submits = 0;
    let costUsd: number | null = 0;
    let lastProse = '';
    // LAS-006 — the plan that already passed validation, held while the model is
    // given its one advisory turn. It is what gets returned however that turn
    // ends, including when the model answers in prose: an accepted plan must
    // never be lost to the "declined" branch just because we asked a question.
    let accepted: { plan: AuthoringPlan; advisories: PlanAdvisory[] } | undefined;
    let advised = false;

    while (turns < this.maxTurns) {
      turns++;
      let response;
      try {
        response = await this.chat({
          messages: [...messages],
          tools: PLANNING_TOOLS,
          toolChoice: 'auto',
          effort: this.effort,
          abortController
        });
      } catch (error) {
        if (abortController.signal.aborted) return { status: 'cancelled', costUsd, turns };
        return {
          status: 'error',
          note: error instanceof Error ? error.message : String(error),
          costUsd,
          turns
        };
      }

      costUsd = costUsd === null || response.usage.costUsd === null ? null : costUsd + response.usage.costUsd;
      messages.push({
        role: 'assistant',
        content: response.text ?? '',
        ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {})
      });
      if (response.text?.trim()) lastProse = response.text.trim();
      if (response.stopReason === 'aborted') return { status: 'cancelled', costUsd, turns };

      const submitCall = response.toolCalls.find((call: AiToolCall) => call.name === SUBMIT_PLAN);
      if (!submitCall) {
        if (response.toolCalls.length === 0) {
          // LAS-006 — prose after the advisory turn means "the plan stands", not
          // "there is no plan". Only an unadvised session can decline here.
          if (accepted) {
            return { status: 'planned', plan: accepted.plan, advisories: accepted.advisories, costUsd, turns };
          }
          // Prose without a plan is the model declining ("already satisfied",
          // "impossible") — a legitimate outcome, reported as such.
          return { status: 'declined', note: lastProse || undefined, costUsd, turns };
        }
        // An unknown tool: answer it and continue within the turn budget.
        for (const call of response.toolCalls) {
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            content: `Unknown tool "${call.name}". The only tool here is ${SUBMIT_PLAN}.`
          });
        }
        continue;
      }

      submits++;
      const { operations, errors: shapeIssues } = toOperations(submitCall.arguments);
      const plan: AuthoringPlan = { request: this.request, operations };
      const errors = [...shapeIssues, ...validatePlan(plan, { existingComponents: this.existingComponents })];
      if (errors.length === 0) {
        const ordered: AuthoringPlan = { request: this.request, operations: orderPlanOperations(operations) };
        const advisories = planAdvisories(ordered);
        // LAS-006 — one advisory turn, at most, and only while the turn budget
        // can still afford a resubmit. The plan is already accepted either way;
        // this only asks whether the model wants to state the interfaces while
        // doing so is still free.
        if (advisories.length > 0 && !advised && turns < this.maxTurns && submits < this.maxSubmits) {
          advised = true;
          accepted = { plan: ordered, advisories };
          messages.push({
            role: 'tool',
            toolCallId: submitCall.id,
            name: submitCall.name,
            content: planAdvisoryMessage(advisories)
          });
          continue;
        }
        messages.push({ role: 'tool', toolCallId: submitCall.id, name: submitCall.name, content: 'Plan accepted.' });
        return { status: 'planned', plan: ordered, advisories, costUsd, turns };
      }
      if (submits >= this.maxSubmits) {
        // LAS-006 — an amended plan that came back broken must not cost the
        // caller the valid one it was amending.
        if (accepted) {
          return { status: 'planned', plan: accepted.plan, advisories: accepted.advisories, costUsd, turns };
        }
        return { status: 'exhausted', note: errors.join(' · '), costUsd, turns };
      }
      messages.push({
        role: 'tool',
        toolCallId: submitCall.id,
        name: submitCall.name,
        content: planRepairMessage(errors)
      });
    }
    if (accepted) {
      return { status: 'planned', plan: accepted.plan, advisories: accepted.advisories, costUsd, turns };
    }
    return { status: 'exhausted', costUsd, turns };
  }
}
