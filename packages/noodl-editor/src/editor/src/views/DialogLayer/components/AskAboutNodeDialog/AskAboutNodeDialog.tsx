/**
 * UNI-011 AC2 — *"Ask about this node"*, the composer.
 *
 * > the composer opens prefilled with type, warning, version and OS; the graph excerpt is **off
 * > until enabled**, and what it will send is **shown before it sends**.
 *
 * ## Three things that are design rather than decoration
 *
 * 1. 🔴 **The preview is the payload.** The `<pre>` below renders `question.body`, and the button
 *    copies `question.body`. There is no second formatter and no "roughly what will be sent" —
 *    the failure this prevents is a user who reviewed one string and published another, and two
 *    code paths that agree today are exactly the arrangement that stops agreeing. The default
 *    for the excerpt lives in `composeNodeQuestion` for the same reason: a default held in a
 *    `useState` here is one refactor from being lost, and what would be lost is silent.
 *
 * 2. ⚠️ **It hands off to the browser; it does not post.** That is not a shortcut, it is D16:
 *    *"until then the entry point opens the browser"*, and the threshold cannot be met today
 *    because UNI-009's forum does not exist to have threads in. What is editor-only here is the
 *    **composition** — the prefill and the redacted excerpt, neither of which a browser can
 *    build — and that is the half D14 calls the reason to transition. When there is a forum and
 *    UNI-001 has an issuer, the copy-and-open becomes a `POST` through
 *    [`communityapi.ts`](../../../../models/community/communityapi.ts) and nothing above it
 *    changes.
 *
 * 3. **Nothing leaves the machine before the user acts**, which is the same promise AC3 makes
 *    about the capture. Composing is local; the clipboard write and the browser open are both on
 *    the button.
 *
 * @module views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog
 */

import React, { useMemo, useState } from 'react';

import { platform } from '@noodl/platform';

import { Checkbox, CheckboxVariant } from '@noodl-core-ui/components/inputs/Checkbox';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { GraphExcerpt } from '@noodl-models/community/nodeexcerpt';
import { LibraryPorts } from '@noodl-models/community/nodeexcerpt';
import { composeNodeQuestion } from '@noodl-models/community/nodequestion';
import { QuestionEnvironment } from '@noodl-models/community/nodequestion';
import { RedactorOptions } from '@noodl-utils/report/redact';

import css from './AskAboutNodeDialog.module.scss';

/**
 * Where the entry point goes while the mirror is gated.
 *
 * 🔴 `community.nodegx.dev` is **not registered** (UNI-001, and it is item 1 on every handover's
 * list for Richard). This constant is the one place that has to change when it is, and it is
 * deliberately not spread across the composer.
 */
export const COMMUNITY_URL = 'https://community.nodegx.dev';

export interface AskAboutNodeDialogProps {
  focus: { typename?: string };
  library: LibraryPorts | null;
  warning: string | null;
  environment: QuestionEnvironment;
  excerpt: GraphExcerpt | null;
  paths: RedactorOptions;
  onClose: () => void;
}

export function AskAboutNodeDialog({
  focus,
  library,
  warning,
  environment,
  excerpt,
  paths,
  onClose
}: AskAboutNodeDialogProps) {
  const [asked, setAsked] = useState('');
  // ⚠️ `false` here agrees with the composer's default rather than establishing it. If these two
  // ever disagree, the composer wins, and `tests-unit/uni-011/nodequestion.test.ts` is what says
  // which one that is.
  const [includeExcerpt, setIncludeExcerpt] = useState(false);
  const [handedOff, setHandedOff] = useState(false);

  const question = useMemo(
    () =>
      composeNodeQuestion({
        focus,
        library,
        warning,
        environment,
        excerpt,
        includeExcerpt,
        question: asked,
        paths
      }),
    [focus, library, warning, environment, excerpt, includeExcerpt, asked, paths]
  );

  function handOff() {
    // The exact value that was on screen. Not recomposed, not re-derived.
    void navigator.clipboard.writeText(`${question.title}\n\n${question.body}`);
    platform.openExternal(COMMUNITY_URL);
    setHandedOff(true);
  }

  return (
    <CoreBaseDialog isVisible hasArrow={false}>
      <Box hasXSpacing hasYSpacing UNSAFE_className={css['Root']}>
        <VStack hasSpacing={3}>
          <Text textType={TextType.DefaultContrast}>Ask the community about this node</Text>
          <Text textType={TextType.Shy}>
            The question is written for you from what the editor already knows. Read it before you post — it goes
            somewhere public.
          </Text>

          <TextArea
            label="What would you like to ask?"
            value={asked}
            onChange={(event) => setAsked(event.target.value)}
            placeholder="Why does this keep failing on the second call?"
          />

          <Checkbox
            variant={CheckboxVariant.Default}
            label="Include a graph excerpt (types and wiring only — no names, parameters or data)"
            isChecked={includeExcerpt}
            onChange={(event) => setIncludeExcerpt(event.target.checked)}
          />

          <VStack hasSpacing={1}>
            <Text textType={TextType.Shy}>This is exactly what will be posted:</Text>
            <pre className={css['Payload']}>
              {question.title}
              {'\n\n'}
              {question.body}
            </pre>
          </VStack>

          <HStack hasSpacing={2}>
            <PrimaryButton
              label={handedOff ? 'Copied — opened in your browser' : 'Copy and open the community'}
              size={PrimaryButtonSize.Small}
              onClick={handOff}
            />
            <PrimaryButton
              label="Cancel"
              variant={PrimaryButtonVariant.MutedOnLowBg}
              size={PrimaryButtonSize.Small}
              onClick={onClose}
            />
          </HStack>
        </VStack>
      </Box>
    </CoreBaseDialog>
  );
}
