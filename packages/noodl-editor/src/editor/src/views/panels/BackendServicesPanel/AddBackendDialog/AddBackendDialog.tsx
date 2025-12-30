/**
 * Add Backend Dialog
 *
 * Modal dialog for adding new backend configurations.
 * Supports preset selection (Directus, Supabase, Pocketbase) and custom REST APIs.
 *
 * @module BackendServicesPanel
 * @since 1.2.0
 */

import React, { useState, useCallback } from 'react';

import { BackendServices, BackendType, CreateBackendRequest } from '@noodl-models/BackendServices';
import { getPreset, getPresetOptions, BackendPreset } from '@noodl-models/BackendServices/presets';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Modal } from '@noodl-core-ui/components/layout/Modal';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import css from './AddBackendDialog.module.scss';

export interface AddBackendDialogProps {
  isVisible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface HelpPopupProps {
  content: string;
  onClose: () => void;
}

function HelpPopup({ content, onClose }: HelpPopupProps) {
  return (
    <div className={css.HelpPopupOverlay} onClick={onClose}>
      <div className={css.HelpPopup} onClick={(e) => e.stopPropagation()}>
        <div className={css.HelpPopupHeader}>
          <Text textType={TextType.DefaultContrast}>Setup Instructions</Text>
          <IconButton icon={IconName.Close} size={IconSize.Small} onClick={onClose} />
        </div>
        <div className={css.HelpPopupContent}>
          {content.split('\n').map((line, i) => {
            // Handle bold text with **text**
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <p key={i} className={line.startsWith('**') ? css.HelpHeading : undefined}>
                {parts.map((part, j) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j}>{part.slice(2, -2)}</strong>;
                  }
                  // Handle inline code with `text`
                  const codeParts = part.split(/(`[^`]+`)/g);
                  return codeParts.map((codePart, k) => {
                    if (codePart.startsWith('`') && codePart.endsWith('`')) {
                      return (
                        <code key={`${j}-${k}`} className={css.InlineCode}>
                          {codePart.slice(1, -1)}
                        </code>
                      );
                    }
                    return codePart;
                  });
                })}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AddBackendDialog({ isVisible, onClose, onCreated }: AddBackendDialogProps) {
  const [selectedType, setSelectedType] = useState<BackendType>('directus');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [publicToken, setPublicToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAdminHelp, setShowAdminHelp] = useState(false);
  const [showPublicHelp, setShowPublicHelp] = useState(false);

  const presetOptions = getPresetOptions();
  const selectedPreset = getPreset(selectedType);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (isVisible) {
      setSelectedType('directus');
      setName('');
      setUrl('');
      setAdminToken('');
      setPublicToken('');
      setTestResult(null);
      setShowAdminHelp(false);
      setShowPublicHelp(false);
    }
  }, [isVisible]);

  const handleSelectPreset = useCallback((preset: BackendPreset) => {
    setSelectedType(preset.type);
    setTestResult(null);
  }, []);

  const handleTestConnection = useCallback(async () => {
    if (!url) {
      setTestResult({ success: false, message: 'Please enter a URL' });
      return;
    }
    if (!adminToken) {
      setTestResult({ success: false, message: 'Please enter an Admin API Key to test connection' });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const request: CreateBackendRequest = {
        name: name || 'Test',
        type: selectedType,
        url,
        auth: {
          method: selectedPreset.defaultAuth.method,
          adminToken,
          publicToken,
          apiKeyHeader: selectedPreset.defaultAuth.apiKeyHeader
        }
      };

      const result = await BackendServices.instance.testConnection(request);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      });
    } finally {
      setIsLoading(false);
    }
  }, [url, name, selectedType, selectedPreset, adminToken, publicToken]);

  const handleCreate = useCallback(async () => {
    if (!name || !url) {
      ToastLayer.showError('Please fill in all required fields');
      return;
    }
    if (!adminToken) {
      ToastLayer.showError('Admin API Key is required for schema introspection');
      return;
    }

    setIsLoading(true);

    try {
      const request: CreateBackendRequest = {
        name,
        type: selectedType,
        url,
        auth: {
          method: selectedPreset.defaultAuth.method,
          adminToken,
          publicToken,
          apiKeyHeader: selectedPreset.defaultAuth.apiKeyHeader
        }
      };

      await BackendServices.instance.createBackend(request);
      ToastLayer.showSuccess(`Backend "${name}" created successfully`);
      onCreated();
    } catch (error) {
      ToastLayer.showError(error instanceof Error ? error.message : 'Failed to create backend');
    } finally {
      setIsLoading(false);
    }
  }, [name, url, selectedType, selectedPreset, adminToken, publicToken, onCreated]);

  const isFormValid = name.trim().length > 0 && url.trim().length > 0 && adminToken.trim().length > 0;

  return (
    <Modal isVisible={isVisible} onClose={onClose} title="Add Backend">
      <VStack hasSpacing>
        {/* Preset Selection */}
        <Box hasBottomSpacing>
          <Text textType={TextType.Shy} hasBottomSpacing>
            Select a backend type
          </Text>
          <div className={css.PresetGrid}>
            {presetOptions.map((preset) => (
              <button
                key={preset.type}
                type="button"
                className={`${css.PresetCard} ${selectedType === preset.type ? css.Selected : ''}`}
                onClick={() => handleSelectPreset(preset)}
              >
                <div className={css.PresetIcon}>{preset.displayName.charAt(0)}</div>
                <Text textType={TextType.DefaultContrast}>{preset.displayName}</Text>
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  {preset.description.substring(0, 50)}...
                </Text>
              </button>
            ))}
            <button
              type="button"
              className={`${css.PresetCard} ${selectedType === 'custom' ? css.Selected : ''}`}
              onClick={() => handleSelectPreset(getPreset('custom'))}
            >
              <div className={css.PresetIcon}>?</div>
              <Text textType={TextType.DefaultContrast}>Custom REST</Text>
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                Configure any REST API
              </Text>
            </button>
          </div>
        </Box>

        {/* Name */}
        <Box hasBottomSpacing>
          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`My ${selectedPreset.displayName} Backend`}
            hasBottomSpacing
          />
        </Box>

        {/* URL */}
        <Box hasBottomSpacing>
          <TextInput
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={selectedPreset.urlPlaceholder}
            hasBottomSpacing
          />
        </Box>

        {/* Admin API Key (Required) */}
        <Box hasBottomSpacing>
          <HStack UNSAFE_style={{ alignItems: 'center', marginBottom: '4px' }}>
            <Text textType={TextType.DefaultContrast} style={{ flex: 1 }}>
              Admin API Key (Required)
            </Text>
            <IconButton
              icon={IconName.Question}
              size={IconSize.Small}
              onClick={() => setShowAdminHelp(true)}
              testId="admin-key-help"
            />
          </HStack>
          <TextInput
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            type="password"
            placeholder="Enter your admin/service API key"
          />
          <div className={css.FieldNote}>
            <span className={css.LockIcon}>🔒</span>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              Editor only — not published to deployed app
            </Text>
          </div>
        </Box>

        {/* Public API Key (Optional) */}
        <Box hasBottomSpacing>
          <HStack UNSAFE_style={{ alignItems: 'center', marginBottom: '4px' }}>
            <Text textType={TextType.DefaultContrast} style={{ flex: 1 }}>
              Public API Key (Optional)
            </Text>
            <IconButton
              icon={IconName.Question}
              size={IconSize.Small}
              onClick={() => setShowPublicHelp(true)}
              testId="public-key-help"
            />
          </HStack>
          <TextInput
            value={publicToken}
            onChange={(e) => setPublicToken(e.target.value)}
            type="password"
            placeholder="Enter your public/anon API key"
          />
          <div className={css.FieldNote}>
            <span className={css.WarningIcon}>⚠️</span>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              Will be visible in deployed app — scope for public access only
            </Text>
          </div>
        </Box>

        {/* Test Result */}
        {testResult && (
          <Box hasBottomSpacing>
            <div
              className={css.TestResult}
              style={{
                backgroundColor: testResult.success ? 'var(--theme-color-success-bg)' : 'var(--theme-color-danger-bg)',
                borderColor: testResult.success ? 'var(--theme-color-success)' : 'var(--theme-color-danger)'
              }}
            >
              <Text
                textType={TextType.DefaultContrast}
                style={{
                  color: testResult.success ? 'var(--theme-color-success)' : 'var(--theme-color-danger)'
                }}
              >
                {testResult.success ? '✓ ' : '✗ '}
                {testResult.message}
              </Text>
            </div>
          </Box>
        )}

        {/* Actions */}
        <HStack hasSpacing UNSAFE_style={{ justifyContent: 'flex-end' }}>
          <PrimaryButton label="Cancel" variant={PrimaryButtonVariant.Muted} onClick={onClose} isDisabled={isLoading} />
          <PrimaryButton
            label="Test Connection"
            variant={PrimaryButtonVariant.Muted}
            onClick={handleTestConnection}
            isDisabled={isLoading || !url || !adminToken}
          />
          <PrimaryButton label="Create Backend" onClick={handleCreate} isDisabled={isLoading || !isFormValid} />
        </HStack>
      </VStack>

      {/* Help Popups */}
      {showAdminHelp && <HelpPopup content={selectedPreset.adminKeyHelp} onClose={() => setShowAdminHelp(false)} />}
      {showPublicHelp && <HelpPopup content={selectedPreset.publicKeyHelp} onClose={() => setShowPublicHelp(false)} />}
    </Modal>
  );
}
