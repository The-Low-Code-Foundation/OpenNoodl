/**
 * TUT-004 AC1 — the tutorials you can install, with no browser opening at any point.
 *
 * ## 🔴 The row IS the action
 *
 * `CommunityRow` is already a button, so clicking a tutorial that has a bundle installs it —
 * that is AC1's *"one action"*, and it is why there is no second Install control beside the
 * title. A row with no bundle is drawn with no action word and does nothing when clicked, which
 * is `0011`'s nullable-column-and-no-button rule arriving in the editor: a disabled button would
 * be this panel advertising something it does not have.
 *
 * ## ⚠️ ITS OWN FILE SO A RUNNER CAN GRADE IT, AND THAT IS NOT AN ARBITRARY SPLIT
 *
 * `CommunityPanel.tsx` imports `common/Icon`, which uses webpack's `require.context` and **cannot
 * be loaded by this repo's jest at all** (`tests-unit/support/renderElements.ts` records the
 * constraint, and NAT-005 removed an icon from the shared row over it). A component in that file
 * is a component no test can call. This one takes props, calls no hooks, and imports nothing
 * that reaches `Icon` — so `renderElements` can walk it and answer *"what did this draw"*, which
 * is what AC1 and D15 are claims about.
 *
 * 🔴 **Every string comes from `tutorialsview`.** The states this surface must keep apart —
 * loading, empty, unreachable, and per-row installed / refused / offline — differ only in
 * wording, and a decision that lives in JSX is one only a rendered DOM can grade.
 *
 * @module noodl-editor/views/panels/CommunityPanel/Tutorials
 */

import React from 'react';

import {
  CommunityDensity,
  CommunityRow,
  CommunitySectionBody,
  metaLine
} from '@noodl-core-ui/components/community';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import type { TutorialsPane } from '@noodl-hooks/useTutorialInstall';
import { actionLabel } from '@noodl-models/community/tutorialsview';

export function Tutorials({ pane }: { pane: TutorialsPane }) {
  // 🔴 D15 said this surface does not exist for this viewer: draw NOTHING — not an empty state,
  // not a message. A panel saying "unavailable" narrates the door in the act of closing it.
  if (pane.view.surface === 'hidden') return null;

  return (
    <Section title="Tutorials" variant={SectionVariant.Panel} hasGutter>
      <CommunitySectionBody
        state={pane.view.section}
        // ⚠️ Says what the section is FOR, per `CommunitySectionBody`'s required-and-no-default
        // rule. Not "nothing here".
        emptyLine="Tutorials published with a project you can open in the editor appear here."
        onRetry={pane.onRetry}
        density={CommunityDensity.Panel}
      >
        {(rows) =>
          rows.map((row) => {
            const label = actionLabel(row.action);
            return (
              <React.Fragment key={row.slug}>
                <CommunityRow
                  density={CommunityDensity.Panel}
                  title={row.title}
                  // The action word rides the meta line rather than a second control: the row is
                  // the button, and two clickable things in one row is two answers to one question.
                  meta={metaLine([row.meta, label])}
                  detail={row.detail}
                  ariaLabel={label ? `${row.title} — ${label}` : row.title}
                  // 🔴 `undefined`, not a no-op handler: `CommunityRow` is a real button and a
                  // handler that does nothing is a button that looks live and is not.
                  onClick={row.action === 'install' ? () => pane.onInstall(row.slug) : undefined}
                />
                {row.note && (
                  <Box hasXSpacing>
                    <Text textType={TextType.Shy}>{row.note}</Text>
                  </Box>
                )}
              </React.Fragment>
            );
          })
        }
      </CommunitySectionBody>
    </Section>
  );
}
