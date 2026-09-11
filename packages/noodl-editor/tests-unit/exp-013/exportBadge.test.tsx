/**
 * EXP-013 AC1 — "Not exportable yet", said where the node is placed.
 *
 * ## What is graded, and against what
 *
 * The decision (`exportBadgeFor`) is graded over the **real ledger**, not a fixture of it: every
 * placeable type the ledger marks `deferred` gets a badge, every `translated` type gets none, and
 * the two badge kinds are read off the exemption's opening phrase — the same phrase
 * `export-ledger:check` enforces. A `translated` control sits beside each positive row, because a
 * decision that badges everything passes the positive rows on its own.
 *
 * The component is evaluated as an element tree (`support/renderElements`), one badge of each
 * status and one control, which is the "one card of each status" the task file asks for at the
 * only altitude this runner can reach: `NodePickerCard` and `NodeLabel` both import `Icon`, which
 * ts-jest cannot load (memory `this-jest-can-grade-a-react-component`). That the two surfaces
 * place the badge is the source-level assertion at the end — and it is deliberately the weakest
 * claim in the file, since source text is blind to a rename.
 */

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';

import { exportBadgeFor, exportBadgeTitle } from '../../src/editor/src/utils/codeExport/exportBadge';
import { ExportBadge } from '../../src/editor/src/views/common/ExportBadge/ExportBadge';
import { render, text } from '../support/renderElements';

const ROOT = path.join(__dirname, '..', '..', '..');
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'nodegx-export', 'coverage-ledger.json'), 'utf8')) as {
  entries: Array<{ typeName: string; status: string; exemption?: string }>;
};
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'noodl-types', 'src', 'node-catalog.json'), 'utf8')) as {
  nodes: Array<{ typeName: string; inNodePicker?: boolean; isDeprecated?: boolean }>;
};

const placeable = new Set(catalog.nodes.filter((n) => n.inNodePicker && !n.isDeprecated).map((n) => n.typeName));
const deferred = ledger.entries.filter((e) => e.status === 'deferred' && placeable.has(e.typeName));
const translated = ledger.entries.filter((e) => e.status === 'translated' && placeable.has(e.typeName));

describe('the decision, over the real ledger', () => {
  test('the populations are not empty, so the rows below grade something', () => {
    // 10 since EXP-011 §66 (session 90) translated the last scheduled row; every one left is a §50 out-of-scope ruling.
    expect(deferred.length).toBeGreaterThanOrEqual(1);
    expect(translated.length).toBeGreaterThan(50);
  });

  test.each(deferred.map((e) => [e.typeName, e.exemption ?? '']))('%s (deferred) carries a badge', (typeName, exemption) => {
    const badge = exportBadgeFor(typeName);
    expect(badge).toBeDefined();
    // The kind is the checker's phrase, read off the ledger — never a second list.
    if (exemption.startsWith('deliberately out of scope')) {
      expect(badge).toMatchObject({ kind: 'out-of-scope', label: 'Not exportable' });
    } else {
      expect(exemption.startsWith('scheduled')).toBe(true);
      expect(badge).toMatchObject({ kind: 'scheduled', label: 'Not exportable yet' });
    }
    // The reason is the ledger's sentence minus its phrase, and it is not empty.
    expect(badge?.reason.length).toBeGreaterThan(10);
    expect(badge?.reason.startsWith('scheduled')).toBe(false);
    expect(badge?.reason.startsWith('deliberately')).toBe(false);
  });

  test.each(translated.map((e) => [e.typeName]))('%s (translated) carries none — the control', (typeName) => {
    expect(exportBadgeFor(typeName)).toBeUndefined();
  });

  test('every deferred row is now a decision: the out-of-scope kind is what the ledger holds, and no scheduled row remains (EXP-011 §66 translated the last one)', () => {
    // Both kinds existed here until session 90; `SubscribeToChanges` was the last `scheduled` row. The scheduled branch is
    // graded below on a literal badge (the drawing rows) and on the reader's own phrase test in @nodegx/export, so this
    // row pins the population rather than pretending a kind the ledger no longer carries.
    const kinds = new Set(deferred.map((e) => exportBadgeFor(e.typeName)?.kind));
    expect(kinds).toEqual(new Set(['out-of-scope']));
    expect(deferred.length).toBeGreaterThan(0);
  });

  test('the nodes Richard named (EXP-011 §50) read as scheduled, and Sign In With as out of scope', () => {
    // `RunTasks` and `On App Error` stood here until sessions 81 and 82 translated them (§53, §54), `Drag` until
    // session 86 (§63), `Server-Sent Events` until session 88 (§64), `WebSocket` until session 89 (§65) and
    // `Subscribe To Changes` until session 90 (§66, the last scheduled node): every node Richard named reads as
    // nothing now, and the control is `Sign In With`, the out-of-scope decision.
    expect(exportBadgeFor('SubscribeToChanges')).toBeUndefined();
    expect(exportBadgeFor('net.noodl.WebSocket')).toBeUndefined();
    expect(exportBadgeFor('RunTasks')).toBeUndefined();
    expect(exportBadgeFor('On App Error')).toBeUndefined();
    expect(exportBadgeFor('net.noodl.user.SignInWith')).toMatchObject({ kind: 'out-of-scope' });
  });

  test('what is not the ledger’s to say reads as nothing: a component instance, a kit node, the stubbed query, an empty name', () => {
    expect(exportBadgeFor('/Pages/Home')).toBeUndefined();
    expect(exportBadgeFor('acme.kit.Widget')).toBeUndefined();
    // `Query Records` is emitted (a client call or a typed stub) — an export, not a refusal.
    expect(exportBadgeFor('DbCollection2')).toBeUndefined();
    expect(exportBadgeFor(undefined)).toBeUndefined();
    expect(exportBadgeFor('')).toBeUndefined();
  });
});

describe('the badge, as drawn', () => {
  // §66 translated the last scheduled row, so the scheduled variant is drawn from a literal badge — the shape exportBadgeOf
  // answers for a `scheduled —` exemption (its phrase test lives in @nodegx/export's own spec).
  const scheduled: ReturnType<typeof exportBadgeFor> = { kind: 'scheduled', label: 'Not exportable yet', reason: 'a tier will translate it' };
  const outOfScope = exportBadgeFor('net.noodl.user.SignInWith');

  test('one of each status, and the translated control draws nothing', () => {
    const drawnScheduled = render(<ExportBadge badge={scheduled} variant="card" />);
    const drawnOut = render(<ExportBadge badge={outOfScope} variant="header" />);
    const control = render(<ExportBadge badge={exportBadgeFor('Group')} variant="card" />);

    expect(text(drawnScheduled)).toBe('Not exportable yet');
    expect(drawnScheduled?.props['data-export-status']).toBe('scheduled');
    expect(text(drawnOut)).toBe('Not exportable');
    expect(drawnOut?.props['data-export-status']).toBe('out-of-scope');
    // 🔴 `null` is also what a component that never ran would produce — which is why the two
    // drawn arms sit beside it in the same test.
    expect(control).toBeNull();
  });

  test('the dot variant draws no words — they ride on title and aria-label', () => {
    const dot = render(<ExportBadge badge={scheduled} variant="dot" />);
    expect(text(dot)).toBe('');
    expect(dot?.props['aria-label']).toBe(exportBadgeTitle(scheduled!));
    expect(dot?.props.title).toBe(exportBadgeTitle(scheduled!));
    expect(dot?.props['data-export-status']).toBe('scheduled');
  });

  test('the reason travels as the hover, in full', () => {
    const drawn = render(<ExportBadge badge={scheduled} variant="card" />);
    expect(drawn?.props.title).toBe(exportBadgeTitle(scheduled!));
    expect(drawn?.props.title).toContain(scheduled!.reason);
  });
});

describe('the two surfaces place it (source-level, the weakest claim here)', () => {
  const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'editor', 'src', rel), 'utf8');

  test('the picker card renders the item’s badge beside the name', () => {
    const card = src('views/NodePicker/components/NodePickerCard/NodePickerCard.tsx');
    expect(card).toContain("from '../../../common/ExportBadge'");
    expect(card).toContain('<ExportBadge badge={item.exportBadge} variant="dot" />');
  });

  test('the picker item carries the decision, from the same function', () => {
    const search = src('views/NodePicker/NodePicker.search.ts');
    expect(search).toContain('exportBadge: exportBadgeFor(node.type.name)');
  });

  test('the property-panel header renders it for the placed node’s type', () => {
    const label = src('views/panels/propertyeditor/components/NodeLabel/NodeLabel.tsx');
    expect(label).toContain('<ExportBadge badge={exportBadgeFor(model.type?.name)}');
  });

  test('the preview pane prints the reason in full', () => {
    const preview = src('views/NodePicker/components/NodePickerPreview/NodePickerPreview.tsx');
    expect(preview).toContain('{item.exportBadge.reason}');
  });
});
