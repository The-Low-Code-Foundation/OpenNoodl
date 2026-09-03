import React from 'react';

import { alphaNotice, plainReason } from '@nodegx/export';
import type { CascadeRoot, PreflightSummary, RefusedNode } from '@nodegx/export';

/**
 * EXP-012 — the pre-flight, shown before the author picks a folder.
 *
 * Everything here is read off `PreflightSummary`, which is itself read off the export that has
 * already been generated in memory — the numbers are exact, not estimated (P18 §21.2), and this
 * is the same set of facts `EXPORT-REPORT.md` will print once the files are written. The modal
 * decides nothing of its own: it does not re-count, re-classify or re-word the exporter's verdict.
 *
 * EXP-013 — it names nodes, not counts. Richard's ruling (EXP-011 §50): *"we need to be super
 * clear when someone is doing code export which nodes can't be exported and what will happen"*.
 * So the modal leads with the verdict when a cascade costs a pathway, splits the refused nodes into
 * the ones the export has no rule for and the ones only silenced by them, and lists every refused
 * node by label and type under its component — all from `summary.cascade` and
 * `summary.attention[].nodes`, which are the rows the report prints.
 *
 * 🔴 **No hooks**, so `tests-unit/exp-013` can evaluate it as an element tree on both fixtures'
 * summaries (memory `this-jest-can-grade-a-react-component`). Markup and classes follow
 * `ConfirmModal` so the popup layer's existing styles apply.
 */
export interface CodeExportModalProps {
  summary: PreflightSummary;
  onConfirm: () => void;
  onCancel: () => void;
}

function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A refused node the way a person names it — the report's `describeNode`, without the code span. */
export function nodeName(node: Pick<RefusedNode, 'displayName' | 'label' | 'nodeId'>): string {
  return node.label !== undefined && node.label !== '' ? `"${node.label}" (${node.displayName})` : `${node.displayName} ${node.nodeId}`;
}

/** The button's label is part of the verdict: "anyway" says a pathway is known to be missing. */
export function confirmLabel(summary: Pick<PreflightSummary, 'verdict'>): string {
  return summary.verdict !== null ? 'Export anyway — choose folder…' : 'Choose folder and export…';
}

function backendLine(summary: PreflightSummary): string {
  switch (summary.backend) {
    case 'connected':
      return `Talks to the project's backend at ${summary.backendEndpoint} — its database, cloud functions and sign-in.`;
    case 'stubbed':
      return 'Uses a backend, but none is deployed for this project yet — the data calls are generated against a placeholder address you set in one place.';
    default:
      return 'Uses no backend.';
  }
}

function RootRow({ root }: { root: CascadeRoot }) {
  return (
    <span style={{ display: 'block', marginBottom: 4 }} data-test="code-export-root">
      <strong>{nodeName(root.node)}</strong> in <code>{root.path}</code> — {plainReason(root.node)}
      {root.silences.length > 0 && (
        <span style={{ display: 'block', paddingLeft: 12 }}>
          …and {root.silences.length === 1 ? 'one node is' : `${root.silences.length} nodes are`} left out only because this one fires{' '}
          {root.silences.length === 1 ? 'it' : 'them'}: {root.silences.map((s) => nodeName(s.node)).join(', ')}
        </span>
      )}
    </span>
  );
}

/** The refused nodes of one component, roots first with their cascades, then the rest. */
function NodeRows({ nodes }: { nodes: RefusedNode[] }) {
  const ids = new Set(nodes.map((n) => n.nodeId));
  const roots = nodes.filter((n) => n.causedBy === undefined);
  const orphans = nodes.filter((n) => n.causedBy !== undefined && !n.causedBy.some((id) => ids.has(id)));
  return (
    <>
      {roots.map((node) => {
        const silenced = nodes.filter((n) => n.causedBy?.includes(node.nodeId));
        return (
          <span key={node.nodeId} style={{ display: 'block', paddingLeft: 12 }} data-test="code-export-node">
            {nodeName(node)} — {plainReason(node)}
            {silenced.length > 0 ? ` (silences ${silenced.map((s) => nodeName(s)).join(', ')})` : ''}
          </span>
        );
      })}
      {orphans.map((node) => (
        <span key={node.nodeId} style={{ display: 'block', paddingLeft: 12 }} data-test="code-export-node">
          {nodeName(node)} — {plainReason(node)} (fired only by {node.causedBy?.join(', ')})
        </span>
      ))}
    </>
  );
}

export function CodeExportModal({ summary, onConfirm, onCancel }: CodeExportModalProps) {
  const attention = summary.attention;
  const deferred = summary.noFile.filter((c) => c.kind === 'deferred');
  const cascade = summary.cascade;

  return (
    <div className="popup confirm-modal" style={{ minWidth: 560, maxWidth: 680 }}>
      <label>Export {summary.projectName} as React code</label>

      <p>
        <strong>Nothing has been written yet.</strong> This is what the export will produce.
      </p>

      {/* 0.2.2 — the alpha notice: the picker number from the ledger, the same sentence the README carries. */}
      <p data-test="code-export-alpha" style={{ color: 'var(--theme-color-warning)' }}>
        <strong>{alphaNotice()}</strong>
      </p>

      <p>
        <strong>{plural(summary.generatedFiles, 'file')}</strong> — {plural(summary.pages, 'page')},{' '}
        {plural(summary.components, 'component')}, plus the app shell, styles and build config
        {summary.copiedAssets > 0 ? `, and ${plural(summary.copiedAssets, 'asset')} copied as-is` : ''}.
        <br />
        {backendLine(summary)}
      </p>

      {summary.refusals === 0 ? (
        <p>
          <strong>Everything translates.</strong> No node, wire or parameter is left out.
        </p>
      ) : (
        <>
          {/* EXP-013 AC4 — the verdict leads. It is the sentence that changes the decision. */}
          {summary.verdict !== null && (
            <p data-test="code-export-verdict" style={{ color: 'var(--theme-color-warning)' }}>
              {/* The sentence is shared with the Markdown report, where the path is a code span. */}
              <strong>{summary.verdict.replace(/`/g, '')}</strong>
            </p>
          )}

          {/* EXP-013 AC3 — the two numbers, separated, and the roots named. */}
          {cascade.roots.length > 0 && (
            <p data-test="code-export-cascade">
              <strong>
                {plural(cascade.unsilenced, 'node')} the export has no rule for, and {cascade.silenced} more left out only because{' '}
                {cascade.unsilenced === 1 ? 'it fires' : 'they fire'} them.
              </strong>
              <span style={{ display: 'block', marginTop: 6 }}>
                {cascade.roots.map((root) => (
                  <RootRow key={`${root.path}:${root.node.nodeId}`} root={root} />
                ))}
              </span>
            </p>
          )}

          <p>
            <strong>{plural(summary.refusals, 'thing')} will not translate</strong>
            {cascade.roots.length > 0 ? ' in all' : ''}. Each is a node, wire, parameter — or a whole component — the export
            has no rule for. It is <em>left out</em>, never translated wrongly, and the reason for every one is written into the
            app as <code>EXPORT-REPORT.md</code>.
          </p>
          {(attention.length > 0 || deferred.length > 0) && (
            <p style={{ maxHeight: 220, overflowY: 'auto' }}>
              {attention.map((c) => (
                <span key={c.path} style={{ display: 'block', marginBottom: 4 }}>
                  <code>{c.path}</code> — {plural(c.refusals, 'refusal')}
                  {c.unreachable ? ' (no route reaches it)' : ''}
                  {/* EXP-013 AC2 — the nodes by name, under the component that holds them. */}
                  <NodeRows nodes={c.nodes} />
                </span>
              ))}
              {deferred.map((c) => (
                <span key={c.path} style={{ display: 'block', marginBottom: 4 }}>
                  <code>{c.path}</code> — no file: {c.reason}
                  <NodeRows nodes={c.nodes} />
                </span>
              ))}
            </p>
          )}
        </>
      )}

      <p>
        Every line is generated by rule and <strong>nothing is run</strong>. The export is one-way: the code will not
        sync back, and exporting again overwrites what you changed.
      </p>

      <div className="confirm-buttons">
        <button
          className="confirm-button"
          data-test="code-export-choose-folder"
          onFocus={(e) => e.currentTarget.blur()}
          onClick={(e) => {
            onConfirm();
            e.stopPropagation();
          }}
        >
          {confirmLabel(summary)}
        </button>
        <button
          className="cancel-button"
          onFocus={(e) => e.currentTarget.blur()}
          onClick={(e) => {
            onCancel();
            e.stopPropagation();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
