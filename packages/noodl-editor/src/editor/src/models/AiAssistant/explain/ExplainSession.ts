/**
 * AIX-004 — Explain Mode: session
 *
 * One session is one explanation and its follow-ups. It owns the assembled
 * context, the conversation, and the in-flight request; the panel owns none of
 * that and only renders what the session reports.
 *
 * **Read-only by construction.** A session holds an `ExplainGraph` — plain data
 * produced by ./graph — not a `ProjectModel`, a `ComponentModel`, or a
 * `NodeGraphNode`. There is no reference here through which the project could be
 * written to even by accident, which is what lets the panel state the guarantee
 * to the user rather than merely intending it.
 *
 * FIX-001 §1c widened *what* that graph covers — the panel now adapts the whole
 * project, so a selected component instance can be resolved to the component it
 * instantiates — and changed nothing about the guarantee: a wider snapshot of
 * plain data is still plain data, and assembly still renders one component's
 * slice plus the interiors it was asked for.
 *
 * @module AiAssistant/explain/ExplainSession
 */

import { AiClient } from '@noodl-models/AiAssistant/client';
import type {
  AiChatRequest,
  AiChatResponse,
  AiMessage,
  AiStreamCallbacks
} from '@noodl-models/AiAssistant/client/types';

import { assembleContext, ExplainRequest } from './assemble';
import { stripUnresolvedCitations } from './citations';
import { findComponent } from './graph';
import { followUpMessage, initialUserMessage, systemPrompt, type ExplainDetail } from './prompts';
import { renderContext } from './render';
import { portsToResolve, renderRuntime, type RuntimePortRef, type RuntimeSnapshot } from './runtime';
import type { ExplainContext, ExplainContextOptions, ExplainGraph } from './types';

export type ExplainTurnRole = 'question' | 'answer';

export interface ExplainTurn {
  role: ExplainTurnRole;
  /** For an answer, the markdown as it currently stands (grows while streaming). */
  text: string;
  /** Set on an answer while its response is still arriving. */
  streaming?: boolean;
  /** Set on an answer that failed; `text` then holds the message shown to the user. */
  error?: boolean;
}

export interface ExplainSessionOptions extends ExplainContextOptions {
  detail?: ExplainDetail;
  /**
   * Injection seam; defaults to the configured AiClient, streaming. Every other
   * session in this module (`AuthoringSession`, `PlanningSession`,
   * `ScopingSession`, `ReviewDocSession`, `DocSession`) takes one — this was
   * the only one that reached the client directly, which put Explain Mode out
   * of reach of the headless measurement harness.
   */
  chat?: ExplainChatFn;
  /**
   * FIX-001 §1a — how the session reads the running app, if it can at all.
   *
   * The same injection shape as `chat`, for the same reason and one more: this
   * is the *only* thing in Explain Mode that touches a socket and a singleton,
   * so keeping it behind a function is what lets the rest of the module stay
   * pure and lets a spec render a runtime layer with no preview in sight. Absent
   * — the MCP assembler, the measurement harness, every existing caller — the
   * session behaves exactly as it did before, with no Runtime section and no
   * prompt claiming one.
   */
  resolveRuntime?: ExplainRuntimeFn;
}

export type ExplainChatFn = (request: AiChatRequest, callbacks?: AiStreamCallbacks) => Promise<AiChatResponse>;

export type ExplainRuntimeFn = (ports: RuntimePortRef[]) => Promise<RuntimeSnapshot>;

/** Everything the panel renders, recomputed and published on every change. */
export interface ExplainSessionState {
  context: ExplainContext;
  turns: ExplainTurn[];
  busy: boolean;
}

type Listener = (state: ExplainSessionState) => void;

export class ExplainSession {
  private readonly messages: AiMessage[] = [];
  private readonly turns: ExplainTurn[] = [];
  private readonly listeners = new Set<Listener>();
  private abortController: AbortController | undefined;

  readonly context: ExplainContext;
  /** The authored graph, rendered. The runtime layer is added per turn, not here. */
  readonly renderedContext: string;
  /** The ports this context would ask a running preview about. Computed once; the values are not. */
  readonly runtimePorts: readonly RuntimePortRef[];

  private constructor(
    context: ExplainContext,
    renderedContext: string,
    runtimePorts: readonly RuntimePortRef[],
    private readonly options: ExplainSessionOptions
  ) {
    this.context = context;
    this.renderedContext = renderedContext;
    this.runtimePorts = runtimePorts;
  }

  /**
   * Build a session for one request. Throws `ExplainContextError` when the
   * request names a component or node the graph does not contain — assembly is
   * the only place that can tell, and failing here keeps a broken request from
   * reaching a provider (and costing money).
   */
  static create(graph: ExplainGraph, request: ExplainRequest, options: ExplainSessionOptions = {}): ExplainSession {
    const context = assembleContext(graph, request, options);
    const rendered = renderContext(context);
    // `assembleContext` above already threw if the component is missing, so this
    // always resolves; the branch below is there so it need not be asserted.
    const component = findComponent(graph, request.componentName);
    const runtimePorts = component ? portsToResolve(component, context) : [];
    const session = new ExplainSession(context, rendered, runtimePorts, options);

    console.debug(
      `[explain] ${request.scope} context — ${context.stats.nodeCount} nodes, ` +
        `${context.stats.connectionCount} connections, ${context.stats.nodeTypeCount} types, ` +
        `${context.stats.renderedChars} chars, ${runtimePorts.length} live port(s) to resolve` +
        (context.nested?.length
          ? `, inside ${context.nested.length} instance(s): ${context.nested
              .map((n) => `${n.name} (${n.nodes.length}/${n.nodeCount})`)
              .join(', ')}`
          : '') +
        (context.bounds.truncated ? ` (bounded: ${context.bounds.notes.join('; ')})` : '')
    );

    return session;
  }

  get state(): ExplainSessionState {
    return { context: this.context, turns: [...this.turns], busy: this.abortController !== undefined };
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(): void {
    const state = this.state;
    for (const listener of this.listeners) listener(state);
  }

  /** The opening explanation. Safe to call once per session. */
  async explain(): Promise<void> {
    if (this.messages.length > 0) return;
    this.messages.push({ role: 'system', content: systemPrompt() });
    await this.run(async () => {
      const runtime = await this.readRuntime();
      return initialUserMessage(this.context, renderContext(this.context, runtime), {
        detail: this.options.detail
      });
    });
  }

  /** A follow-up question in the same context. */
  async ask(question: string): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed || this.abortController) return;
    this.turns.push({ role: 'question', text: trimmed });
    await this.run(async () => {
      // Re-read rather than reuse: the opening turn's values are already history
      // by the time someone types a follow-up. See `followUpMessage`.
      const runtime = await this.readRuntime();
      return followUpMessage(trimmed, runtime ? renderRuntime(this.context, runtime) : undefined);
    });
  }

  /**
   * One reading of the running app, or `undefined` when this session has no way
   * to take one.
   *
   * A failed read is **not** reported as "no preview running". They are different
   * states — one is "you have not started it", the other is "the editor could not
   * ask" — and collapsing them would put a wrong instruction in the prompt for
   * whichever of the two it guessed wrong.
   */
  private async readRuntime(): Promise<RuntimeSnapshot | undefined> {
    const resolve = this.options.resolveRuntime;
    if (!resolve) return undefined;
    try {
      return await resolve([...this.runtimePorts]);
    } catch (error) {
      return {
        isPreviewRunning: false,
        values: [],
        liveNodeIds: [],
        diagnoses: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /** Cancel the in-flight request; the partial answer is kept. */
  cancel(): void {
    this.abortController?.abort();
  }

  dispose(): void {
    this.cancel();
    this.listeners.clear();
  }

  /**
   * `prepare` builds the user turn, and it is a callback rather than a value
   * because it is allowed to be slow: reading the running app is a socket round
   * trip, and it belongs *inside* the busy window so the panel shows a spinner
   * for it rather than sitting inert until the answer starts arriving.
   */
  private async run(prepare: () => Promise<string>): Promise<void> {
    const turn: ExplainTurn = { role: 'answer', text: '', streaming: true };
    this.turns.push(turn);

    const abortController = new AbortController();
    this.abortController = abortController;
    this.publish();

    try {
      this.messages.push({ role: 'user', content: await prepare() });
      const chat = this.options.chat ?? ((request, callbacks) => AiClient.chatStream(request, callbacks ?? {}));
      const response = await chat(
        { messages: [...this.messages], abortController },
        {
          onText: (fullText) => {
            turn.text = fullText;
            this.publish();
          }
        }
      );

      // Only strip on completion: doing it per-delta would flicker a citation
      // between link and plain text as its id streams in character by character.
      turn.text = stripUnresolvedCitations(response.text || turn.text, this.context);
      turn.streaming = false;
      this.messages.push({ role: 'assistant', content: response.text });
    } catch (error) {
      turn.streaming = false;
      if (abortController.signal.aborted) {
        // A cancelled answer keeps whatever arrived; it is still useful.
        turn.text = turn.text || 'Cancelled.';
      } else {
        turn.error = true;
        turn.text = error instanceof Error ? error.message : String(error);
      }
      // Drop the failed exchange so a retry does not resend a turn the model
      // never answered.
      if (this.messages[this.messages.length - 1]?.role === 'user' && turn.error) {
        // Keep the system + initial user turn; only a failed follow-up is removed.
        if (this.messages.length > 2) this.messages.pop();
      }
    } finally {
      this.abortController = undefined;
      this.publish();
    }
  }
}
