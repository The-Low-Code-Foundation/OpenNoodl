/**
 * AIX-004 — Explain Mode: context serialisation
 *
 * Turns an assembled context into the text block the model reads. Two properties
 * matter more than prettiness:
 *
 *  - **Node ids are everywhere.** Every node is introduced with its id, and the
 *    prompt requires citations to use them. That is what makes an explanation
 *    clickable rather than merely readable.
 *  - **Connections read as sentences**, not as a table of four columns. "Text
 *    Input `n1`.Text → `n7`.Value" is a data-flow statement the model can
 *    paraphrase directly; a CSV of ids is something it has to decode first.
 *
 * @module AiAssistant/explain/render
 */

import { renderRuntime, runtimeIndex, type RuntimePortValue, type RuntimeSnapshot } from './runtime';
import type { ContextNode, ContextNodeType, ExplainContext } from './types';

/** Current values for the nodes being rendered, keyed as `node|port|direction`. */
type RuntimeValues = Map<string, RuntimePortValue>;

function nodeHeading(node: ContextNode): string {
  const parts = [`- \`${node.id}\` — ${node.displayName}`];
  if (node.label) parts.push(`labelled "${node.label}"`);
  if (node.isComponentInstance) parts.push(`(instance of component ${node.type})`);
  if (node.role !== 'selected' && node.role !== 'peer') parts.push(`[${node.role}]`);
  return parts.join(' ');
}

/**
 * FIX-001 §1a — the current value of an authored input, written beside it.
 *
 * Beside rather than instead of, and never in place of: the two disagree
 * constantly and legitimately (an input the graph sets to `"Loading…"` is
 * `"Ready"` a moment after the fetch returns), and *which* of them a question is
 * about is the thing the reader most often cannot tell. Omitted when they agree,
 * because a `now =` that only ever echoes the line above it teaches the model to
 * stop reading it.
 */
function nowSuffix(values: RuntimeValues | undefined, node: ContextNode, port: string, authored: string): string {
  const entry = values?.get(node.id + '|' + port + '|input');
  if (!entry || agrees(entry.value, authored)) return '';
  return `    [now = ${entry.value}${entry.truncated ? ' (cut short)' : ''}]`;
}

/**
 * Whether a current value and an authored one say the same thing *as far as
 * either was shown*.
 *
 * Not `===`, because both sides arrive pre-cut and by different caps — assembly
 * allows 400 characters of an authored parameter at node scope, the runtime
 * layer allows 200 of a value. A script body identical on both sides therefore
 * fails an equality test every time, and would print a `[now = …]` announcing a
 * change that did not happen. That is the same class of confident-wrong answer
 * the whole runtime layer exists to remove, so a prefix match on the visible
 * part counts as agreement: the honest claim is "nothing I can see differs".
 */
function agrees(current: string, authored: string): boolean {
  if (current === authored) return true;
  const a = current.replace(/…$/, '');
  const b = authored.replace(/…$/, '');
  return a.length && b.length ? a.startsWith(b) || b.startsWith(a) : false;
}

function renderNode(node: ContextNode, values?: RuntimeValues): string {
  const lines = [nodeHeading(node)];
  if (node.comment) lines.push(`    note from the author: ${node.comment}`);
  for (const p of node.parameters) {
    const now = nowSuffix(values, node, p.name, p.value);
    // Multi-line values (script bodies, text content) get a fenced block so the
    // structure survives; short ones stay inline to keep the block scannable.
    if (p.value.includes('\n')) {
      lines.push(`    ${p.name}:`);
      for (const line of p.value.split('\n')) lines.push(`      ${line}`);
      if (now) lines.push(`    ${now.trim()}`);
    } else {
      lines.push(`    ${p.name}: ${p.value}${now}`);
    }
  }
  if (node.parametersOmitted) lines.push(`    (${node.parametersOmitted} further parameter(s) not shown)`);
  return lines.join('\n');
}

function renderType(type: ContextNodeType): string {
  if (type.unknown) {
    return `- ${type.typeName} — not in the node catalog (a module node, or from a newer/older Noodl version). Do not guess what it does.`;
  }

  const lines = [`- ${type.typeName}${type.category ? ` (${type.category})` : ''}`];
  if (type.summary) lines.push(`    ${type.summary}`);
  if (type.description && type.description !== type.summary) lines.push(`    ${type.description}`);
  if (type.whenToUse) lines.push(`    When to use: ${type.whenToUse}`);
  if (type.runtimeBehavior) lines.push(`    Ports at runtime: ${type.runtimeBehavior}`);
  for (const port of type.ports) {
    const bits = [`    port ${port.name}`];
    if (port.type) bits.push(`(${port.isSignal ? 'signal' : port.type})`);
    if (port.description) bits.push(`— ${port.description}`);
    lines.push(bits.join(' '));
  }
  return lines.join('\n');
}

/**
 * Serialise the assembled context and record its size on `context.stats`.
 *
 * `runtime` is optional and its absence is meaningful: no snapshot renders no
 * Runtime section at all, which is exactly the pre-FIX-001 output. A caller with
 * no way to reach a preview (the MCP assembler, the measurement harness) is
 * therefore unchanged, and no prompt claims a value it was never given.
 */
export function renderContext(context: ExplainContext, runtime?: RuntimeSnapshot): string {
  const sections: string[] = [];
  const values = runtime ? runtimeIndex(runtime) : undefined;

  const shape = context.component;
  const overview = [
    `## Component`,
    `name: ${shape.name}`,
    `${shape.nodeCount} nodes, ${shape.connectionCount} connections`
  ];
  // LEG-003 §2. The author's own sentence about their component, marked as
  // theirs so the model treats it as evidence rather than as something to
  // restate. The panel shows it verbatim above the answer either way.
  if (shape.description) overview.push(`description, written by the author: ${shape.description}`);
  if (shape.inputPorts.length) overview.push(`component inputs: ${shape.inputPorts.join(', ')}`);
  if (shape.outputPorts.length) overview.push(`component outputs: ${shape.outputPorts.join(', ')}`);
  if (context.scope === 'component' && shape.typeCounts.length) {
    overview.push(`node types present: ${shape.typeCounts.map((t) => `${t.type} ×${t.count}`).join(', ')}`);
  }
  sections.push(overview.join('\n'));

  if (context.selectedIds.length) {
    sections.push(`## Selection\nThe user selected: ${context.selectedIds.map((id) => `\`${id}\``).join(', ')}`);
  }

  sections.push(
    [
      `## Nodes`,
      `Every node below is identified by its id in backticks. Roles: [upstream] feeds the selection,`,
      `[downstream] is fed by it, [container] is a parent or child in the visual hierarchy.`,
      ...(values
        ? [
            `A line reading \`[now = …]\` is the value the running app holds for that input at this`,
            `moment; the value before it is what the user authored. They differ legitimately.`
          ]
        : []),
      '',
      context.nodes.map((node) => renderNode(node, values)).join('\n')
    ].join('\n')
  );

  if (context.connections.length) {
    const lines = context.connections.map((c) => {
      const arrow = c.isSignal ? '⇒ (signal)' : '→';
      return `- \`${c.fromId}\`.${c.fromProperty} ${arrow} \`${c.toId}\`.${c.toProperty}`;
    });
    sections.push(`## Connections\n${lines.join('\n')}`);
  } else {
    sections.push(`## Connections\n(none between the nodes shown)`);
  }

  if (context.nodeTypes.length) {
    sections.push(`## Node types in this context\n${context.nodeTypes.map(renderType).join('\n')}`);
  }

  // FIX-001 §1a. Last of the evidence sections and immediately before the bounds
  // note, so "here is what is true now" and "here is what you cannot see" are
  // read together — they are the two halves of the same honesty instruction.
  if (runtime) sections.push(renderRuntime(context, runtime));

  if (context.bounds.truncated) {
    sections.push(
      [
        `## What you cannot see`,
        `This context is a bounded slice of the project, not all of it.`,
        ...context.bounds.notes.map((n) => `- ${n}`),
        `Say so plainly if the answer depends on something outside this slice.`
      ].join('\n')
    );
  }

  const text = sections.join('\n\n');
  context.stats.renderedChars = text.length;
  return text;
}
