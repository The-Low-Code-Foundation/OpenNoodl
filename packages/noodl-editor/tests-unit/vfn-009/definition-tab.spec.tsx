/**
 * VFN-009 §2 — a definition tab is the same window with a different **subject**.
 *
 * > 🔴 *"Do not widen `Tab.nodeId` to mean 'either a node id or a definition id'. That is one
 * > field carrying two kinds of identity, and every consumer — `BlockTraceClient`, `attachDoIt`,
 * > `attachBlockValues`, `onWorkspaceChange` — would have to learn the difference or silently do
 * > the wrong thing to one of them."*
 *
 * Every assertion here is an absence — no node id reaches the overlays, no hat reaches the shelf,
 * no navigation is attempted, no edit reaches `onWorkspaceChange` — so each block carries the
 * **widened** version as its negative control and shows it doing the wrong thing over the same
 * input.
 */

import React from 'react';

import {
  DEFINITION_TAB_PREFIX,
  NODE_TAB_PREFIX,
  definitionIdOf,
  definitionTabLabel,
  definitionTabTooltip,
  editTargetFor,
  isDefinitionTab,
  liveNodeIdOf,
  subjectOf,
  tabIdFor,
  tabTravels,
  wantsProgramHat,
  type SubjectTab
} from '../../src/editor/src/contexts/tabSubject';
import { tabsClosedByNodeRemoval } from '../../src/editor/src/contexts/canvasTabsNodeRemoval';
import { ensureHatsInJson } from '../../src/editor/src/views/BlocklyEditor/hatMigration';
import { STATUS_COPY, benchHintApplies, stripReasonFor } from '../../src/editor/src/views/BlocklyEditor/BlockValueTrace';
import { buildTabWorkspaces } from '../../src/editor/src/views/CanvasTabs/tabWorkspaces';
import { tabActivation } from '../../src/editor/src/views/CanvasTabs/tabLocation';

import type { Tab } from '../../src/editor/src/contexts/CanvasTabsContext';

const nodeTab: Tab = {
  id: 'logic-builder-node-a',
  type: 'logic-builder',
  subject: { kind: 'node', nodeId: 'node-a' },
  nodeId: 'node-a',
  nodeName: 'Order total',
  componentId: 'c1',
  workspace: '{"blocks":{"blocks":[]}}'
};

const definitionTab: Tab = {
  id: 'saved-block-d1',
  type: 'saved-block',
  subject: { kind: 'definition', definitionId: 'd1' },
  nodeName: 'Discount',
  workspace: '{"blocks":{"blocks":[]}}'
};

/** A tab from before this task: a `nodeId` and no `subject`. */
const legacyTab: Tab = { id: 'logic-builder-old', type: 'logic-builder', nodeId: 'node-old', nodeName: 'Old' };

/**
 * 🔴 **The widening §2 forbids**, written out so it can be convicted.
 *
 * This is the shape the task was told not to build: one field, read with a fallback, meaning
 * either identity. Every control below runs it over the same tab the real function is run over.
 */
function widenedNodeId(tab: SubjectTab & { definitionId?: string }): string | undefined {
  return tab.nodeId ?? tab.definitionId;
}

describe('VFN-009 §2 — the subject, and the field that was not widened', () => {
  it('reads a tab from before this task as what it is: a node tab', () => {
    expect(subjectOf(legacyTab)).toEqual({ kind: 'node', nodeId: 'node-old' });
    expect(liveNodeIdOf(legacyTab)).toBe('node-old');
    expect(isDefinitionTab(legacyTab)).toBe(false);
  });

  it('a tab that knows nothing has no subject, rather than a guessed one', () => {
    expect(subjectOf({} as Tab)).toBeUndefined();
    expect(subjectOf(undefined)).toBeUndefined();
    expect(editTargetFor({} as Tab)).toEqual({ kind: 'none' });
  });

  it('🔴 a definition tab has NO live node — even when a nodeId is on it', () => {
    // The property the widening loses. `nodeId` reaches `attachDoIt`, `attachBlockValues` and
    // `BlockTraceClient`; handing any of them a definition id does not throw, it arms a socket for
    // a node that does not exist and waits forever.
    const confused = { ...definitionTab, nodeId: 'd1' } as Tab;

    expect(liveNodeIdOf(confused)).toBeUndefined();
    expect(definitionIdOf(confused)).toBe('d1');

    // 🔴 NEGATIVE CONTROL — the forbidden read, over the same tab, answers with the definition id.
    expect(widenedNodeId({ ...confused, definitionId: 'd1' })).toBe('d1');
  });

  it('routes a settled edit by the subject, not by whichever field is filled in', () => {
    expect(editTargetFor(nodeTab)).toEqual({ kind: 'node', nodeId: 'node-a' });
    expect(editTargetFor(definitionTab)).toEqual({ kind: 'definition', definitionId: 'd1' });
  });

  it('🔴 NEGATIVE CONTROL — the widened router sends a definition edit to the node writer', () => {
    // What `CanvasTabs.handleWorkspaceEdit` used to do, applied to a definition tab: it calls
    // `onWorkspaceChange(definitionId, …)`, which finds no node, logs a warning nobody reads, and
    // drops the builder's edit. Silently — which is why this control exists at all.
    const writes: { where: string; id: string }[] = [];
    const widenedRouter = (tab: SubjectTab & { definitionId?: string }) => {
      const id = widenedNodeId(tab);
      if (id) writes.push({ where: 'onWorkspaceChange', id });
    };

    widenedRouter({ ...definitionTab, definitionId: 'd1' });
    expect(writes).toEqual([{ where: 'onWorkspaceChange', id: 'd1' }]);

    // The real router puts it where it belongs.
    expect(editTargetFor(definitionTab).kind).toBe('definition');
  });
});

describe('VFN-009 §2 — the three overlays decline cleanly', () => {
  it('the workspace element for a definition tab carries no node id', () => {
    const elements = buildTabWorkspaces({ tabs: [nodeTab, definitionTab], activeTabId: definitionTab.id, onEdit: () => {} });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workspaceIn = (container: React.ReactElement<Record<string, any>>) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((container.props.children as React.ReactElement<Record<string, any>>).props.children as React.ReactElement<
        Record<string, any>
      >);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = workspaceIn(elements[0] as React.ReactElement<Record<string, any>>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const definition = workspaceIn(elements[1] as React.ReactElement<Record<string, any>>);

    expect(node.props.nodeId).toBe('node-a');
    expect(node.props.subject).toBe('node');

    expect(definition.props.nodeId).toBeUndefined();
    expect(definition.props.subject).toBe('definition');
    // …and the definition's own blocks are what it opens with.
    expect(definition.props.initialWorkspace).toBe(definitionTab.workspace);
  });

  it('the strip says there is no node, rather than there is no connection', () => {
    // 🔴 Without its own reason, a tab with no `nodeId` falls to `no-connection`, whose sentence is
    // *"The editor has no connection to a running app."* True about a different problem, and it
    // sends a builder off to start the preview for nothing.
    const reason = stripReasonFor({ status: 'no-connection', runs: 0, hasBlocks: true, subject: 'definition' });
    expect(reason).toBe('no-node');
    expect(STATUS_COPY['no-node']).toContain('no node behind them');
    expect(STATUS_COPY['no-node']).toContain('place the block in a Visual Function');
    expect(STATUS_COPY['no-node']).not.toContain('connection');

    // It outranks every other reason, including the stale-code one — a definition is never
    // generated on its own, so "these blocks are stale" has no meaning here.
    for (const status of ['waiting', 'attached', 'no-preview', 'not-in-preview', 'no-connection'] as const) {
      expect(stripReasonFor({ status, runs: 3, hasBlocks: true, generatedCode: 'Outputs["x"] = 1;', subject: 'definition' })).toBe(
        'no-node'
      );
    }
  });

  it('🔴 NEGATIVE CONTROL — without the subject, the same input answers about a connection', () => {
    // The assertion above is an absence ("does not say connection"). This is the same call with
    // the one field removed, producing exactly the sentence the reason exists to replace.
    const reason = stripReasonFor({ status: 'no-connection', runs: 0, hasBlocks: true });
    expect(reason).toBe('no-connection');
    expect(STATUS_COPY[reason]).toContain('connection');
  });

  it('offers no Run hint for a definition tab', () => {
    // ⚠️ VFN-011's bench is what would make a definition tab genuinely runnable. Until it does,
    // the strip must not tell a builder to press a button that is not there.
    expect(benchHintApplies('no-node')).toBe(false);
    expect(benchHintApplies('attached')).toBe(false);
    expect(benchHintApplies('attached-idle')).toBe(true);
  });

  it('does not try to navigate anywhere when a saved block tab is clicked', () => {
    expect(tabTravels(nodeTab)).toBe(true);
    expect(tabTravels(definitionTab)).toBe(false);

    // 🔴 NEGATIVE CONTROL — what a click would have done had it travelled anyway. A definition has
    // no `componentId`, so `tabActivation` refuses, and `navigateToTabComponent` shows an error
    // toast: "This tab does not know which component … came from" — a refusal about a question
    // nobody asked, on an ordinary click.
    expect(tabActivation(definitionTab, { componentExists: false })).toBe('refuse-unknown');
  });
});

describe('VFN-009 — the hat belongs to programs, not to saved blocks', () => {
  const statementStack = JSON.stringify({
    blocks: { languageVersion: 0, blocks: [{ type: 'noodl_set_output', fields: { NAME: 'total' } }] }
  });

  it('a definition body is opened exactly as it was stored', () => {
    expect(wantsProgramHat(definitionTab)).toBe(false);
  });

  it('🔴 NEGATIVE CONTROL — hatting it would put a hat block into the shelf', () => {
    // The unconditional call, over a definition body. The first settled edit writes the result
    // back to the shelf, and every call site inlining it afterwards splices a hat into the middle
    // of somebody else's stack — a shape Blockly's grammar has no meaning for.
    const hatted = ensureHatsInJson(statementStack, { seedEmpty: true });
    expect(hatted).not.toBe(statementStack);
    // `noodl_when_signal` is the hat block. Named as a literal rather than imported, so this
    // control keeps convicting even if the constant moves.
    expect(hatted).toContain('noodl_when_signal');

    // And `seedEmpty` is worse again: a definition edited down to nothing acquires one out of thin
    // air and becomes a saved block that declares a signal handler.
    const fromNothing = ensureHatsInJson('', { seedEmpty: true });
    expect(fromNothing).toContain('noodl_when_signal');
  });

  it('a node tab still gets one, because that half is LGC-009 and is unchanged', () => {
    expect(wantsProgramHat(nodeTab)).toBe(true);
    expect(wantsProgramHat(legacyTab)).toBe(true);
    expect(wantsProgramHat({} as Tab)).toBe(true);
  });
});

describe('VFN-009 — tab identity and labels', () => {
  it('a node tab id is byte-identical to what it was before this task', () => {
    // `tests-unit/vfn-001` reads `logic-builder-a`, and every open tab in a running editor is
    // keyed by this string. A change here would silently reopen every tab as a second one.
    expect(tabIdFor({ kind: 'node', nodeId: 'a' })).toBe('logic-builder-a');
    expect(NODE_TAB_PREFIX).toBe('logic-builder');
  });

  it('a definition tab id is deterministic, so reopening switches rather than duplicates', () => {
    // 🔴 Two workspaces over one definition would each flush their own copy of the body 300 ms
    // after they settled, and the last to settle would win — silently — over the other's edits.
    expect(tabIdFor({ kind: 'definition', definitionId: 'd1' })).toBe(`${DEFINITION_TAB_PREFIX}-d1`);
    expect(tabIdFor({ kind: 'definition', definitionId: 'd1' })).toBe(tabIdFor({ kind: 'definition', definitionId: 'd1' }));
    // …and it cannot collide with a node tab whose node happens to be called `d1`.
    expect(tabIdFor({ kind: 'definition', definitionId: 'd1' })).not.toBe(tabIdFor({ kind: 'node', nodeId: 'd1' }));
  });

  it('says it is a saved block, and what editing it means', () => {
    expect(definitionTabLabel('Discount')).toBe('Discount');
    expect(definitionTabLabel('   ')).toBe('Saved block');
    expect(definitionTabTooltip('Discount')).toContain('saved block "Discount"');
    expect(definitionTabTooltip('Discount')).toContain('every place that uses it');
  });
});

describe('VFN-009 — VFN-001 is already correct under this design, and stays correct', () => {
  it('a node removal never closes a saved block tab', () => {
    // ⚠️ `tabsClosedByNodeRemoval` was already right: it never closes a tab without a `nodeId`.
    // This is here so that a later change to it has to face the definition tab explicitly, and so
    // the claim is measured rather than asserted in a comment.
    const tabs = [nodeTab, definitionTab];
    expect(tabsClosedByNodeRemoval(tabs, { id: 'node-a' })).toEqual(['logic-builder-node-a']);
    expect(tabsClosedByNodeRemoval(tabs, { id: 'd1' })).toEqual([]);

    // 🔴 NEGATIVE CONTROL — the widened read would have matched the definition tab on its own id
    // and closed the builder's saved-block editor while they were in it.
    const widenedClose = tabs
      .filter((tab) => widenedNodeId({ ...tab, definitionId: definitionIdOf(tab) }) === 'd1')
      .map((tab) => tab.id);
    expect(widenedClose).toEqual(['saved-block-d1']);
  });
});
