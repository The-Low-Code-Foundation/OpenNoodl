/**
 * Rule: a signal output does not arrive at a value input.
 *
 * DEF-002 §3, from phase 77's D10.
 *
 * ## What actually happens, read from the runtime rather than relayed
 *
 * ⚠️ **Phase 77's D10 describes this as "the two writes coalesce and the
 * consumer runs once, with `false`". That is not what HEAD does**, and the
 * difference matters because it is what the diagnostic tells a person.
 * `Node.prototype._setPulseFromConnection` queues **one** entry —
 * `SIGNAL_PULSE` — and the drain loop plays it as `setInputValue(name, true)`
 * followed by `setInputValue(name, false)` **in the same pass**
 * (`node.ts`, "Both halves in the same pass"). So a value input's setter runs
 * **twice**, and the port **settles at `false`** — every time the signal fires.
 *
 * The graph reads as "when this fires, use that". The runtime does "set it, then
 * set it back". For a boolean the visible result is permanent `false`; for a
 * string or number it is whatever the port coerces `false` to.
 *
 * 🔴 The distinction is not pedantry: "runs once with false" and "settles at
 * false" predict different things for a port with a side-effecting setter, and a
 * diagnostic that states the wrong mechanism teaches the wrong repair.
 *
 * 🔴 **The recorded case is the sharpest possible one: it bit an instrument
 * built to measure a different defect.** Phase 78 D4's first twin wired a
 * query's `failure` into `unknownNotice.visible`, and the notice painted for the
 * person whose query **succeeded** and stayed hidden for the one who was
 * refused. Exactly inverted, on a graph somebody wrote while concentrating on
 * this very area.
 *
 * ## Why no existing rule covers it, checked rather than assumed
 *
 * - `typeIncompatibleConnection` reaches this pair and **passes it**: its
 *   compatibility test names *"a signal is involved"* as sufficient. That is
 *   right for a signal into a signal, and it is what makes this rule's question
 *   — *which direction* — the one nobody was asking.
 * - `signalDrivenStaleInput` is `defaultEnabled: false` and asks whether a
 *   control signal waits for an async value. Different question, different shape.
 * - `nonexistentPort` asks whether the ports exist. Both of these do.
 *
 * ## Severity: `warning`, and in `AUTHORED_BLOCKING_WARNINGS`
 *
 * 🔴 **`error` was tried first and the corpus gate refused it — correctly.** One
 * firing across the whole 96-project corpus:
 * `big-merge-test-mine`'s `/SessionData/Setup session` wires `Switch.switchedToOn`
 * into `Script Downloader.startLoad`.
 *
 * ⚠️ **That firing is a TRUE positive, checked rather than assumed.**
 * `startLoad` is declared `type: 'boolean', default: true, displayName: 'Load on
 * start'` — *"whether the scripts are fetched as soon as the node appears,
 * rather than waiting for Load"* — and `load` is the signal input beside it that
 * the author meant. The pulse settles `startLoad` at `false`, so the project's
 * scripts never auto-load and nothing else triggers them.
 *
 * So the rule is right and the corpus project is broken — and a rule that breaks
 * CI over one real hand-authored defect in a nine-year-old import is still a rule
 * people switch off. `warning` plus membership of `AUTHORED_BLOCKING_WARNINGS` is
 * the seam that already exists for exactly this split: advisory on a project
 * somebody imported, **blocking on a graph an agent just wrote**. The set's own
 * charter is *"output that is broken — a value the runtime discards"*, and a
 * value input that receives a pulse discards the value in the most literal way
 * available.
 *
 * ## Why it can be decisive where its neighbours hedge
 *
 * It fires only when **both** ports are statically known in the catalog. A
 * runtime-created port on either end takes the same skip every rule in this
 * directory takes, and for the same reason: reporting on a port we cannot see
 * floods real projects and destroys trust. What is left is a pair the catalog
 * fully describes, where one end is declared `isSignal` and the other is
 * declared not — and no correct graph is written that way.
 *
 * ⚠️ **Component instances are skipped.** A component's ports are not in the
 * catalog and their signal-ness is not derivable from the interface index, which
 * records names and directions only. `connectionTargets.ts` owns that node class.
 *
 * @module noodl-editor/validation/rules/signalIntoValuePort
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { isComponentRef } from '../model';
import { Rule, RuleContext } from './types';

export const signalIntoValuePort: Rule = {
  code: DiagnosticCode.SignalIntoValuePort,
  description: 'A signal output is not wired into a value input.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const { catalog } = ctx;

    for (const { component, nodeById } of ctx.components) {
      for (const conn of component.connections) {
        const from = nodeById.get(conn.fromId);
        const to = nodeById.get(conn.toId);
        if (!from || !to) continue; // `danglingConnection` owns a missing end.
        if (isComponentRef(from.type) || isComponentRef(to.type)) continue;

        const source = catalog.getPort(from.type, 'output', conn.fromProperty);
        const target = catalog.getPort(to.type, 'input', conn.toProperty);
        // Either port unknown to the catalog — runtime-created, or an unknown
        // node type. `nonexistentPort` and `unknownNodeType` own those, and
        // guessing here is how a rule earns its way onto everyone's ignore list.
        if (!source || !target) continue;

        if (source.isSignal !== true) continue;
        if (target.isSignal === true) continue;

        const targetLabel = to.label ? `"${to.label}"` : to.type;
        const sourceLabel = from.label ? `"${from.label}"` : from.type;
        const signalInputs = catalog.signalInputNames(to.type);

        out.push({
          code: DiagnosticCode.SignalIntoValuePort,
          severity: 'warning',
          message:
            `"${conn.fromProperty}" is a signal output on ${sourceLabel}, and "${conn.toProperty}" is a ` +
            `value input on ${targetLabel}. A signal is delivered as one pulse that the runtime plays as ` +
            `true and then false in the same pass, so "${conn.toProperty}" ends up holding **false** every ` +
            `time the signal fires — which is the opposite of what the wire looks like it says.`,
          location: {
            component: component.name,
            nodeId: to.id,
            nodeType: to.type,
            nodeLabel: to.label,
            port: conn.toProperty,
            plug: 'input',
            connection: {
              fromId: conn.fromId,
              fromProperty: conn.fromProperty,
              toId: conn.toId,
              toProperty: conn.toProperty
            }
          },
          suggestion: signalInputs.length
            ? `To make "${conn.fromProperty}" trigger ${targetLabel}, wire it to a signal input: ` +
              `${signalInputs.slice(0, 8).join(', ')}. To make it supply a VALUE, take the value from a ` +
              'value output instead — a signal carries no data.'
            : `${to.type} has no signal inputs, so "${conn.fromProperty}" cannot trigger it. A signal ` +
              'carries no data either, so it cannot supply this port. Something else is meant to.',
          alternatives: signalInputs.slice(0, 24)
        });
      }
    }

    return out;
  }
};
