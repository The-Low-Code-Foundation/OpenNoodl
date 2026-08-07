import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';

import { PanelRow, PanelRowVariant } from './PanelRow';

const meta: Meta<typeof PanelRow> = {
  title: 'Sidebar/Panel Row',
  component: PanelRow,
  argTypes: {}
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A `PanelRow` reads its width from the nearest `panel-body` container, which
 * `BasePanel` declares. Storybook has no panel, so every story supplies its own
 * — that is also the recipe for a card that wants its rows to follow the card's
 * width rather than the panel's.
 */
function PanelBody({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width,
        padding: 12,
        background: 'var(--theme-color-bg-2)',
        border: '1px solid var(--theme-color-border-subtle)',
        borderRadius: 6,
        containerType: 'inline-size',
        containerName: 'panel-body'
      }}
    >
      <div style={{ fontSize: 11, marginBottom: 10, color: 'var(--theme-color-fg-default-shy)' }}>
        panel-body {width}px
      </div>
      {children}
    </div>
  );
}

const noop = () => undefined;

function SampleRows() {
  return (
    <>
      <PanelRow label="Provider">
        <PropertyPanelSelectInput
          value="anthropic"
          properties={{ options: [{ label: 'Anthropic', value: 'anthropic' }] }}
          onChange={noop}
        />
      </PanelRow>

      {/* The reported case: a label long enough to wrap beside a roomy field. */}
      <PanelRow label="API Key (saved)" helpText="Leave blank if your endpoint does not require one.">
        <PropertyPanelTextInput value="" onChange={noop} />
      </PanelRow>

      <PanelRow label="Endpoint (optional)">
        <PropertyPanelTextInput value="https://api.example.com/v1" onChange={noop} />
      </PanelRow>

      <PanelRow label="Snap nodes to grid" variant={PanelRowVariant.Toggle}>
        <PropertyPanelCheckbox value onChange={noop} />
      </PanelRow>

      <PanelRow label="Backend actions" variant={PanelRowVariant.Actions}>
        <PrimaryButton label="Data" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
        <PrimaryButton label="Schema" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
        <PrimaryButton label="Permissions" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
      </PanelRow>
    </>
  );
}

/** All three bands side by side — the mock's "one panel, any width" triptych. */
export const ThreeBands = () => (
  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
    <PanelBody width={268}>
      <SampleRows />
    </PanelBody>
    <PanelBody width={380}>
      <SampleRows />
    </PanelBody>
    <PanelBody width={600}>
      <SampleRows />
    </PanelBody>
  </div>
);

export const Common: Story = {
  render: (args) => (
    <PanelBody width={380}>
      <PanelRow {...args}>
        <PropertyPanelTextInput value="" onChange={noop} />
      </PanelRow>
    </PanelBody>
  ),
  args: {
    label: 'Label'
  }
};

/**
 * A label long enough that it cannot share a line with anything. It wraps
 * inside its column rather than clipping, and the control keeps its width.
 */
export const LongLabel = () => (
  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
    <PanelBody width={268}>
      <PanelRow label="Custom base URL for the deployed backend">
        <PropertyPanelTextInput value="" onChange={noop} />
      </PanelRow>
    </PanelBody>
    <PanelBody width={380}>
      <PanelRow label="Custom base URL for the deployed backend">
        <PropertyPanelTextInput value="" onChange={noop} />
      </PanelRow>
    </PanelBody>
  </div>
);

/** The control slot is a row of buttons, not one input. They wrap; nothing scrolls. */
export const ButtonRowControl = () => (
  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
    <PanelBody width={240}>
      <PanelRow label="Inspect" variant={PanelRowVariant.Actions}>
        <PrimaryButton label="Data" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
        <PrimaryButton label="Schema" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
        <PrimaryButton label="Permissions" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
        <PrimaryButton label="Triggers" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
      </PanelRow>
    </PanelBody>
    <PanelBody width={600}>
      <PanelRow label="Inspect" variant={PanelRowVariant.Actions}>
        <PrimaryButton label="Data" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
        <PrimaryButton label="Schema" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
        <PrimaryButton label="Permissions" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
        <PrimaryButton label="Triggers" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
      </PanelRow>
    </PanelBody>
  </div>
);

/**
 * The label is present for screen readers and absent from the layout. The row
 * becomes `role="group"` with the label as its accessible name, so a hidden
 * label is still an announced one.
 */
export const HiddenLabel = () => (
  <PanelBody width={380}>
    <PanelRow label="Search components" isLabelHidden>
      <PropertyPanelTextInput value="" onChange={noop} />
    </PanelRow>
    <PanelRow label="Filter" isLabelHidden variant={PanelRowVariant.Actions}>
      <PrimaryButton label="All" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
      <PrimaryButton label="Visual" size={PrimaryButtonSize.Small} variant={PrimaryButtonVariant.Muted} />
    </PanelRow>
  </PanelBody>
);

/** Help text sits in the control column, and takes the full row when compact. */
export const WithHelpText = () => (
  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
    <PanelBody width={268}>
      <PanelRow label="React version" helpText="Already-deployed apps keep the React they were deployed with.">
        <PropertyPanelSelectInput
          value="default"
          properties={{ options: [{ label: 'React 18.3 (default)', value: 'default' }] }}
          onChange={noop}
        />
      </PanelRow>
    </PanelBody>
    <PanelBody width={600}>
      <PanelRow label="React version" helpText="Already-deployed apps keep the React they were deployed with.">
        <PropertyPanelSelectInput
          value="default"
          properties={{ options: [{ label: 'React 18.3 (default)', value: 'default' }] }}
          onChange={noop}
        />
      </PanelRow>
    </PanelBody>
  </div>
);

/** A trailing affordance that must not wrap away from its control. */
export const WithFxSlot = () => (
  <PanelBody width={380}>
    <PanelRow
      label="Cover image"
      fxSlot={<IconButton icon={IconName.FolderOpen} size={IconSize.Small} onClick={noop} />}
    >
      <PropertyPanelTextInput value="assets/cover.png" onChange={noop} />
    </PanelRow>
  </PanelBody>
);

/** Changed from its default: accented label plus a reset dot. */
export const Changed = () => (
  <PanelBody width={380}>
    <PanelRow label="Custom base url" isChanged onReset={noop}>
      <PropertyPanelTextInput value="https://example.com" onChange={noop} />
    </PanelRow>
  </PanelBody>
);

/** A control that wants the whole row at every width. */
export const Stacked = () => (
  <PanelBody width={600}>
    <PanelRow label="Description" isStacked helpText="Shown on the project card and in search results.">
      <PropertyPanelTextInput value="" onChange={noop} />
    </PanelRow>
  </PanelBody>
);
