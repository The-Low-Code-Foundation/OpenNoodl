import classNames from 'classnames';
import React, { useMemo, useState } from 'react';

import { IModule, isModuleCompatible, ModuleLibraryModel } from '@noodl-models/modulelibrarymodel';
import getContentEndpoint from '@noodl-utils/getContentEndpoint';
import { tracker } from '@noodl-utils/tracker';

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { TextType } from '@noodl-core-ui/components/typography/Text/Text';
import { Title, TitleVariant } from '@noodl-core-ui/components/typography/Title';

import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import { useNodePickerContext } from '../../NodePicker.context';
import css from './ModuleCard.module.scss';

enum CardState {
  Idle = 'is-idle',
  Downloading = 'is-downloading',
  Finished = 'is-finished',
  Cancelled = 'is-cancelled'
}

export type ModuleCardProps = IModule;

const endpoint = getContentEndpoint();

export function ModuleCard(module: ModuleCardProps) {
  const { label, desc, icon, project, docs, tags, minEditorVersion } = module;
  const context = useNodePickerContext();

  const [cardState, setCardState] = useState(CardState.Idle);
  const [cancelMessage, setCancelMessage] = useState('');

  // LIB-001: an explicit `type` field replaces the `/prefab` substring check
  // on the project zip URL. The substring check remains as a fallback for
  // index entries published before `type` existed (old editors reading a new
  // index, or a new editor reading a not-yet-republished old index).
  const isPrefab = useMemo(
    () => (module.type ? module.type === 'prefab' : project.includes('/prefab')),
    [module.type, project]
  );

  // LIB-001: entries that declare a `minEditorVersion` newer than this
  // running editor render as incompatible instead of being offered for
  // install (installModule/installPrefab also guard this server-side of the
  // click, so this is belt-and-braces against a stale/cached card).
  const isCompatible = useMemo(() => isModuleCompatible(module), [module]);

  function handleDownload(url: string) {
    setCardState(CardState.Downloading);

    const fullUrl = url.startsWith('http') ? url : endpoint + '/' + url;

    const installFunc = isPrefab
      ? ModuleLibraryModel.instance.installPrefab.bind(ModuleLibraryModel.instance)
      : ModuleLibraryModel.instance.installModule.bind(ModuleLibraryModel.instance);

    installFunc(fullUrl, context.doBlockPicker, context.doUnblockPicker, module)
      .then(() => setCardState(CardState.Finished))
      .then(() => {
        tracker.track(isPrefab ? 'Prefab imported' : 'Module Imported', {
          label: label,
          url: url
        });
        ToastLayer.showSuccess(isPrefab ? `Prefab ${label} cloned` : `Module ${label} installed`);
      })
      .catch((error) => {
        setCardState(CardState.Cancelled);
        setCancelMessage(error.message);
      })
      .finally(() =>
        setTimeout(() => {
          setCardState(CardState.Idle);
        }, 3000)
      );
  }

  return (
    <article className={classNames(css['Root'], css[cardState], !isCompatible && css['is-incompatible'])}>
      <div className={css['ImageContainer']}>
        <div
          className={css['Image']}
          style={{ backgroundImage: icon.startsWith('http') ? `url(${icon})` : `url(${endpoint}/${icon})` }}
        />
      </div>

      <div className={css['Content']}>
        <div>
          <header className={css['Header']}>
            <Title hasBottomSpacing isInline>
              {label}
            </Title>
          </header>
          <Text textType={TextType.Shy}>{desc}</Text>
          {!isCompatible && (
            <Text textType={FeedbackType.Danger}>{`Requires editor v${minEditorVersion} or newer`}</Text>
          )}
        </div>

        <div className={css['TagContainer']}>{Boolean(tags?.length) && tags.join(', ')}</div>

        <div className={css['HoverOverlay']}>
          <div className={css['CtaContainer']}>
            <PrimaryButton
              label={isPrefab ? 'Clone' : 'Install'}
              onClick={() => handleDownload(project)}
              isDisabled={!isCompatible}
              hasRightSpacing
            />
            <PrimaryButton variant={PrimaryButtonVariant.Ghost} label="Read docs" href={endpoint + docs} />
          </div>
        </div>

        <div className={css['ImportIndicator']}>
          <Title isCentered hasBottomSpacing>
            {isPrefab ? 'Cloning prefab' : 'Installing module'}
          </Title>
          <ActivityIndicator />
        </div>

        <div className={css['SuccessToast']}>
          <Title variant={TitleVariant.Success} isCentered hasBottomSpacing>
            Successfully {isPrefab ? 'cloned' : 'installed'}
          </Title>
          <Text>{label}</Text>
        </div>

        <div className={css['CancelToast']}>
          <Title variant={TitleVariant.Danger} isCentered>
            {cancelMessage}
          </Title>
        </div>
      </div>
    </article>
  );
}
