import React from 'react';

import { alphaNotice } from '@nodegx/export';

import { exportProjectAsReactCode } from '@noodl-utils/codeExport/exportReactCode';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Section } from '@noodl-core-ui/components/sidebar/Section';
import { Text } from '@noodl-core-ui/components/typography/Text';

/**
 * EXP-012 — where the code export lives in the editor: beside the deploy settings, because
 * "take this app somewhere else" is the question both answer.
 */
export function CodeExportSection() {
  return (
    <Section title="Export as code" hasGutter hasVisibleOverflow>
      <Box hasBottomSpacing>
        <Text>
          Generate a React project from this app that builds and runs on its own, talking to the same backend. You
          see exactly what will and will not translate before anything is written.
        </Text>
      </Box>
      <Box hasBottomSpacing>
        <Text>{alphaNotice()}</Text>
      </Box>
      <PrimaryButton
        icon={IconName.Code}
        size={PrimaryButtonSize.Small}
        label="Export as React code…"
        variant={PrimaryButtonVariant.MutedOnLowBg}
        onClick={() => void exportProjectAsReactCode()}
        isGrowing
      />
    </Section>
  );
}
