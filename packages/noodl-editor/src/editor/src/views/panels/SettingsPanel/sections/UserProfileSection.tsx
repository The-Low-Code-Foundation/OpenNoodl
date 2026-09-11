import React, { useCallback, useEffect, useState } from 'react';

import {
  ensureUserProfileSeeded,
  PROFILE_CAP,
  refreshUserProfile,
  renderProfileForPrompt,
  userProfilePath,
  userProfileSnapshot
} from '@noodl-models/UserProfile';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { Text, TextSize } from '@noodl-core-ui/components/typography/Text';

/**
 * FIX-021 slice B — "About you": the front door to `<userData>/PREFERENCES.md`.
 *
 * **The document is the UI.** This section deliberately does not edit the file:
 * it is markdown the person owns, in every project on this machine, and the
 * moment a form owns it the file stops being something you can keep in VS Code
 * beside your notes. What a settings section can do that a text editor cannot is
 * answer the two questions the file itself cannot — *where is it* and *what is
 * actually being sent* — so that is all this does.
 *
 * ⚠️ **The cost line is the point, not decoration.** A global always-doc is a
 * charge on every turn of every project forever, which is exactly the objection
 * FIX-021's Q5 raises. The honest answer is to show the number, next to the
 * button that changes it, in the same spirit as the Docs panel's per-turn token
 * disclosure. A user who cannot see the cost cannot consent to it.
 *
 * The count is what `renderProfileForPrompt` would hand the model — comments
 * stripped, empty headings dropped — not the size of the file. Those differ by
 * design and a freshly seeded file reads **0**, which is the seeding promise
 * made checkable from the panel.
 */
export function UserProfileSection() {
  const [source, setSource] = useState(() => userProfileSnapshot());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // The installer already re-reads the file on its own timer, so this is a
  // state sync and not a second poll of the disk. It exists because sidebar
  // panels are hidden, never unmounted (the staleness McpSettingsSection warns
  // about) — without it, this section would keep showing a count from whenever
  // Settings was first opened.
  useEffect(() => {
    const timer = setInterval(() => setSource(userProfileSnapshot()), 2_000);
    return () => clearInterval(timer);
  }, []);

  const open = useCallback(() => {
    setBusy(true);
    setProblem(null);
    ensureUserProfileSeeded()
      .then(async ({ path }) => {
        await refreshUserProfile();
        setSource(userProfileSnapshot());
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const shell = require('@electron/remote').shell;
        // `openPath` hands the file to whatever the user edits markdown with,
        // which is the thing they were told to do. It resolves to a non-empty
        // string when there is no such application rather than throwing, and in
        // that case Finder is a worse answer than nothing but a much better one
        // than silence.
        const failure: string = await shell.openPath(path);
        if (failure) shell.showItemInFolder(path);
      })
      .catch((error: Error) => setProblem(error.message))
      .finally(() => setBusy(false));
  }, []);

  const path = userProfilePath();
  const exists = source.length > 0;
  const sent = renderProfileForPrompt(source);
  const full = renderProfileForPrompt(source, Number.MAX_SAFE_INTEGER);
  const isCapped = Boolean(sent && full && full.length > sent.length);

  return (
    <CollapsableSection title="About you" isClosed>
      <Box hasXSpacing hasTopSpacing={1} hasBottomSpacing={5}>
        <Text size={TextSize.Small} hasBottomSpacing>
          Standing preferences for how you like to be talked to and how you like things built. NodeGX
          reads them before it builds anything, in every project on this machine, so you never have to
          say the same thing twice. They rank above the AI&apos;s own habits and below a project&apos;s own
          conventions.
        </Text>

        <Text size={TextSize.Small} hasBottomSpacing>
          {!exists
            ? 'You have no preferences file yet. Nothing about you is being sent.'
            : sent
            ? `${sent.length} characters go out with every build, in every project.${
                isCapped ? ` Only the first ${PROFILE_CAP} are sent — the rest of the file is ignored.` : ''
              }`
            : 'The file exists but you have not written in it yet, so nothing is being sent.'}
        </Text>

        <PrimaryButton
          size={PrimaryButtonSize.Small}
          isGrowing
          isDisabled={busy}
          label={exists ? 'Open preferences' : 'Create and open preferences'}
          onClick={open}
        />

        {problem && (
          <Box hasTopSpacing={2}>
            <Text size={TextSize.Small}>{`Could not open it: ${problem}`}</Text>
          </Box>
        )}

        <Box hasTopSpacing={2}>
          <Text size={TextSize.Small}>{path}</Text>
        </Box>

        <Box hasTopSpacing={2}>
          <PrimaryButton
            variant={PrimaryButtonVariant.Ghost}
            size={PrimaryButtonSize.Small}
            label="Show in folder"
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              require('@electron/remote').shell.showItemInFolder(path);
            }}
          />
        </Box>
      </Box>
    </CollapsableSection>
  );
}
