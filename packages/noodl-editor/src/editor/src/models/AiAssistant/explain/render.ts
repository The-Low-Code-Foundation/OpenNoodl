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

import type { ContextNode, ContextNodeType, ExplainContext } from './types';

function nodeHeading(node: ContextNode): string {
  const parts = [`- \`${node.id}\` — ${node.displayName}`];
  if (node.label) parts.push(`labelled "${node.label}"`);
  if (node.isComponentInstance) parts.push(`(instance of component ${node.type})`);
  if (node.role !== 'selected' && node.role !== 'peer') parts.push(`[${node.role}]`);
  return parts.join(' ');
}

function renderNode(node: ContextNode): string {
  const lines = [nodeHeading(node)];
  if (node.comment) lines.push(`    note from the author: ${node.comment}`);
  for (const p of node.parameters) {
    // Multi-line values (script bodies, text content) get a fenced block so the
    // structure survives; short ones stay inline to keep the block scannable.
    if (p.value.includes('\n')) {
      lines.push(`    ${p.name}:`);
      for (const line of p.value.split('\n')) lines.push(`      ${line}`);
    } else {
      lines.push(`    ${p.name}: ${p.value}`);
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

/** Serialise the assembled context and record its size on `context.stats`. */
export function renderContext(context: ExplainContext): string {
  const sections: string[] = [];

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
      '',
      context.nodes.map(renderNode).join('\n')
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
