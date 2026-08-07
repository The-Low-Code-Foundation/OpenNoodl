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
import type { AuthoringPlan, PlanOperation, PlanOperationKind } from './plan';
import { validatePlan, orderPlanOperations } from './plan';
import { PLANNING_TOOLS, planningSystemPrompt, planningUserMessage, planRepairMessage, SUBMIT_PLAN } from './prompts/planning';
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
  /** The model's prose when it declined to plan, or the error message. */
  note?: string;
  costUsd: number | null;
  turns: number;
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
    const op = entry as { kind?: unknown; target?: unknown; intent?: unknown };
    const kind = op?.kind;
    if (kind !== 'create' && kind !== 'update' && kind !== 'doc') {
      errors.push(`Operation ${index + 1}: kind must be create, update or doc.`);
      return;
    }
    operations.push({
      id: `op-${index + 1}`,
      kind: kind as PlanOperationKind,
      target: typeof op.target === 'string' ? op.target.trim() : '',
      intent: typeof op.intent === 'string' ? op.intent.trim() : ''
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
        messages.push({ role: 'tool', toolCallId: submitCall.id, name: submitCall.name, content: 'Plan accepted.' });
        return {
          status: 'planned',
          plan: { request: this.request, operations: orderPlanOperations(operations) },
          costUsd,
          turns
        };
      }
      if (submits >= this.maxSubmits) return { status: 'exhausted', note: errors.join(' · '), costUsd, turns };
      messages.push({
        role: 'tool',
        toolCallId: submitCall.id,
        name: submitCall.name,
        content: planRepairMessage(errors)
      });
    }
    return { status: 'exhausted', costUsd, turns };
  }
}
