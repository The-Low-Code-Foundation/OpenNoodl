/**
 * FIX-001 §1a — the editor's answer to *"what does the running app hold right now?"*, in the
 * shape Explain Mode wants.
 *
 * All the model and socket glue lives here so `AiAssistant/explain/runtime` stays pure and
 * unit-testable. The same split as `walkEngine` / `ProvenancePanel` and `annotateWarnings` /
 * {@link editorDiagnoses}, for the same reason.
 *
 * ## Layer 1 only, and it does not join the trace session
 *
 * `getPortValues` reads the ports themselves, so this arms nothing, clears no buffer and cannot
 * disturb a recording somebody else is taking. It therefore borrows only `TraceSession`'s client
 * pick — which viewer is *the preview*, sandboxes excluded, a rule with a measured failure behind
 * it — and owns its own request and reply. That is the precedent `PortsTab/usePortValues` set and
 * the reason it exists: a one-shot surface has no business owning that session's cumulative
 * `portValues` map, which is never cleared between reads and would hand an explanation a value
 * from a preview that has since been closed.
 *
 * ## Three ways this could lie, and what stops each
 *
 *  - **Somebody else's runtime.** The relay broadcasts every viewer reply to every editor peer,
 *    so an unfiltered listener would fold the component bench's sandbox values into an answer
 *    about the app preview. An *unstamped* reply is refused outright: a viewer bundle old enough
 *    not to stamp its replies is also old enough not to answer `getPortValues` at all.
 *  - **Somebody else's request.** The Ports tab polls this same channel once a second while it is
 *    on screen, and its replies land here too. So a reply is only taken as the answer once it
 *    covers every ref that was asked for; a partial overlap accumulates instead of resolving.
 *  - **No answer at all.** A preview that never replies resolves as an `error`, never as "no
 *    preview is running" — the prompt gives opposite instructions for those two states.
 *
 * @module noodl-editor/utils/provenance/explainRuntime
 */

import type {
  ExplainRuntimeFn
} from '@noodl-models/AiAssistant/explain/ExplainSession';
import {
  truncateRuntimeValue,
  type RuntimePortRef,
  type RuntimePortValue,
  type RuntimeSnapshot
} from '@noodl-models/AiAssistant/explain/runtime';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../ViewerConnection';
import {
  isReportableValue,
  type PortValueReply
} from '../../views/panels/propertyeditor/components/PortsTab/portValues';
import { editorDiagnoses } from './editorDiagnoses';
import { TraceSession } from './TraceSession';

/**
 * How long the preview may go unanswered before the explanation goes ahead without it.
 *
 * Matched to `TraceSession`'s own request timeout. A person is waiting on a model response behind
 * this, so the failure mode that matters is not a slow answer — it is a question that never gets
 * asked because the read hung.
 */
const REQUEST_TIMEOUT = 2000;

function refKey(ref: { node: string; port: string; direction: string }): string {
  return ref.node + '|' + ref.port + '|' + ref.direction;
}

/**
 * A reading for one component, taken fresh on every turn.
 *
 * The component name is bound at session creation because the diagnoses are per-component and the
 * session's context cannot change under it — a different component is a different session.
 */
export function createExplainRuntime(componentName: string): ExplainRuntimeFn {
  return (ports: RuntimePortRef[]) => {
    // Warnings first, and unconditionally: `WarningsModel` is populated on a **cold** editor, so
    // acceptance criterion 3 holds with nothing running. This is why a snapshot with
    // `isPreviewRunning: false` is still worth taking.
    const diagnoses = editorDiagnoses(componentName);
    const clientId = TraceSession.instance.previewClientId;

    if (!clientId || ports.length === 0) {
      return Promise.resolve<RuntimeSnapshot>({
        isPreviewRunning: clientId !== undefined,
        values: [],
        liveNodeIds: [],
        diagnoses
      });
    }

    const wanted = new Set(ports.map(refKey));

    return new Promise<RuntimeSnapshot>((resolve) => {
      const eventGroup = {};
      const values = new Map<string, RuntimePortValue>();
      const liveNodeIds = new Set<string>();
      const answered = new Set<string>();
      let settled = false;

      const finish = (error?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        EventDispatcher.instance.off(eventGroup);
        resolve({
          isPreviewRunning: true,
          values: [...values.values()],
          liveNodeIds: [...liveNodeIds],
          diagnoses,
          ...(error ? { error } : {})
        });
      };

      EventDispatcher.instance.on(
        'TracePortValues',
        ({ clientId: replyId, values: replies }: TSFixme) => {
          // ⚠️ Unstamped is refused — see the module note.
          if (typeof replyId !== 'string' || replyId !== clientId) return;
          if (!Array.isArray(replies)) return;

          for (const entry of replies as PortValueReply[]) {
            if (!entry) continue;
            const key = refKey(entry);
            // Another surface's poll, riding the same broadcast. Not ours to read.
            if (!wanted.has(key)) continue;
            answered.add(key);
            if (!entry.exists) continue;
            // The port answered, so the runtime holds this node — whatever the value is.
            liveNodeIds.add(entry.node);
            if (!isReportableValue(entry)) continue;
            const capped = truncateRuntimeValue(entry.value as string);
            values.set(key, {
              node: entry.node,
              port: entry.port,
              direction: entry.direction,
              value: capped.value,
              ...(capped.truncated ? { truncated: true } : {})
            });
          }

          // Complete coverage means this was our reply, not an overlapping poll.
          if (answered.size >= wanted.size) finish();
        },
        eventGroup
      );

      const timer = setTimeout(
        // Partial coverage is still worth having and is reported as such; nothing at all is an
        // error. Either way the values kept are real ones the runtime sent.
        () => finish(answered.size === 0 ? 'the preview did not answer in time' : undefined),
        REQUEST_TIMEOUT
      );

      ViewerConnection.instance?.sendGetPortValues(clientId, ports);
    });
  };
}
