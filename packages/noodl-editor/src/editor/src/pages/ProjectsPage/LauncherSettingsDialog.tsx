import React from 'react';

import { PrimaryButton, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AiSettingsSection } from '../../views/panels/AiSettings/AiSettingsSection';
import { ThemeSettingRow } from '../../views/panels/SettingsPanel/sections/ThemeSettingRow';

/** Which section to scroll into view when the dialog opens. */
export type LauncherSettingsSection = 'appearance' | 'ai';

/**
 * Sized so `AiSettingsSection` — a `CollapsableSection` built for a 380px side
 * panel — has room for its widest row (the provider select beside its label)
 * without the labels wrapping. The header and footer stay put while only the
 * sections scroll, so "Done" is reachable however long the AI section gets.
 */
const DIALOG_STYLE: React.CSSProperties = {
  width: '460px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const BODY_STYLE: React.CSSProperties = {
  overflowY: 'auto',
  // The flex child must be allowed to shrink below its content height or the
  // footer is pushed off the bottom of the dialog (the flex-children-squeeze
  // trap from the side-panel work).
  minHeight: 0,
  flex: '1 1 auto'
};

export interface LauncherSettingsDialogProps {
  onClose: () => void;
  /**
   * Section to bring into view. `ai` is what the "Start with AI" card's
   * setup action asks for; the gear in the header asks for nothing and gets
   * the top.
   */
  initialSection?: LauncherSettingsSection;
}

/**
 * The launcher's settings dialog.
 *
 * Both settings it hosts are **app-wide, not project-scoped** — the theme is
 * `ThemeManager`'s single mode in `EditorSettings`, and the AI provider, model
 * and key are `AiConfigStore` / `AiCredentials` (the key OS-encrypted via
 * `safeStorage`). Neither is stored in a project, so a key entered here at the
 * launcher is the key every project uses, and the editor's own settings panel
 * shows the same values.
 *
 * This is why both sections are the editor's own components rather than
 * launcher-local copies: a second credentials form would be a second source of
 * truth for a secret, and a second theme select would be a second source of
 * truth for a preference that is deliberately global. The launcher hosts them;
 * it does not reimplement them.
 */
export function LauncherSettingsDialog({ onClose, initialSection }: LauncherSettingsDialogProps) {
  const aiRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (initialSection === 'ai') aiRef.current?.scrollIntoView({ block: 'start' });
  }, [initialSection]);

  return (
    // `CoreBaseDialog` is what every other dialog in the editor uses: it owns
    // the centring and the backdrop, which the dialog layer deliberately does
    // not (`.Root` is a bare full-viewport container, so a dialog that styles
    // only itself renders in the top-left corner).
    <CoreBaseDialog title="Settings" isVisible hasBackdrop onClose={onClose}>
      <div style={DIALOG_STYLE}>
        <Box hasXSpacing hasTopSpacing hasBottomSpacing>
          <Text textType={TextType.Secondary}>
            These apply to NodeGX everywhere — the launcher and every project you open.
          </Text>
        </Box>

        <div style={BODY_STYLE}>
          <CollapsableSection title="Appearance">
            <Box hasXSpacing>
              <VStack>
                <ThemeSettingRow />
              </VStack>
            </Box>
          </CollapsableSection>

          <div ref={aiRef}>
            <AiSettingsSection />
          </div>
        </div>

        <Box hasXSpacing hasYSpacing UNSAFE_style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <PrimaryButton
            label="Done"
            size={PrimaryButtonSize.Small}
            isFitContent
            onClick={onClose}
            testId="launcher-settings-done"
          />
        </Box>
      </div>
    </CoreBaseDialog>
  );
}
