import React from 'react';

import type { SchemaFieldNotice } from '@noodl-utils/schemaFieldNotice';

/**
 * DEF-036 AC1 — the panel-level note a data node shows in place of a field list it cannot build.
 *
 * 🔴 Panel-level rather than per-row, and that is the whole point. `portGate.ts` and
 * `portHint.ts` both attach a sentence *to a row*, which works because the row is there to
 * attach it to. This defect is the opposite shape: there are **no rows**, and the emptiness is
 * what has to be explained. A note attached to nothing has nowhere to live but the top of the
 * panel.
 *
 * ⚠️ No `Icon`, no core-ui input, no `Text` — deliberately. `PropertyFilterInput.tsx` records
 * why in full: `Icon` is one of the imports that makes a spec in this repo's `tests-unit` runner
 * fail *to run* rather than fail, and the panel already has plain divs on global classes for
 * every other explanatory surface it draws.
 *
 * The copy is not here. It comes from `schemaFieldNotice.ts`, which reaches nothing and is
 * graded in `tests-unit/def-036/` — a message that only exists as a literal inside a view no
 * spec can mount is graded by reading the file.
 */
export function SchemaFieldNoticeView({ notice }: { notice: SchemaFieldNotice }) {
  return (
    <div
      className="property-schema-notice"
      data-test={`schema-notice-${notice.cause}`}
      /*
       * `status`, not `alert`. The node was selected by the author, so this is the answer to a
       * question they just asked rather than an interruption — and `alert` would re-announce it
       * on every click along a row of data nodes.
       */
      role="status"
    >
      <div className="property-schema-notice-title">{notice.title}</div>
      <div className="property-schema-notice-message">{notice.message}</div>
    </div>
  );
}
