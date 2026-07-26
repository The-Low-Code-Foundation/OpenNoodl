import classNames from 'classnames';
import React, { useState } from 'react';

import { ProjectLibraryModel } from '@noodl-models/projectlibrarymodel';
import { ProjectItem } from '@noodl-utils/LocalProjectsModel';
import { timeSince } from '@noodl-utils/utils';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { TextType } from '@noodl-core-ui/components/typography/Text/Text';
import { Title } from '@noodl-core-ui/components/typography/Title';
import { TitleVariant } from '@noodl-core-ui/components/typography/Title/Title';
import {
  hasUsableCapture,
  isBlankCapture,
  placeholderBucket,
  projectInitial
} from '@noodl-core-ui/utils/projectThumbnail';

import { useNodePickerContext } from '../../NodePicker.context';
import css from './ProjectCard.module.scss';

enum CardState {
  Idle = 'is-idle',
  Downloading = 'is-downloading',
  Finished = 'is-finished',
  Cancelled = 'is-cancelled'
}
export interface ProjectCardProps {
  project: ProjectItem;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const context = useNodePickerContext();

  const [cardState, setCardState] = useState(CardState.Idle);
  const [cancelMessage, setCancelMessage] = useState('');
  // Same contract as the launcher grid: start from whether the stored capture is
  // usable at all, and let a load error or a blank decode flip it off. Without
  // this, projects whose thumbURI is a valid-but-solid-white PNG render as blank
  // rectangles — which is what this grid did before.
  const [showCapture, setShowCapture] = useState(() => hasUsableCapture(project.thumbURI));

  function handleDownload() {
    setCardState(CardState.Downloading);
    ProjectLibraryModel.instance
      .importProject(project, context.doBlockPicker, context.doUnblockPicker)
      .then(() => setCardState(CardState.Finished))
      .catch((error) => {
        setCardState(CardState.Cancelled);
        setCancelMessage(error.message);
      })
      .finally(() => setTimeout(() => setCardState(CardState.Idle), 3000));
  }

  return (
    <article className={classNames(css['Root'], css[cardState])}>
      <div
        className={classNames(css['ImageContainer'], !showCapture && css[`hue-${placeholderBucket(project.name)}`])}
      >
        {showCapture ? (
          <img
            className={css['Image']}
            src={project.thumbURI}
            alt=""
            onError={() => setShowCapture(false)}
            onLoad={(e) => {
              if (isBlankCapture(e.currentTarget)) setShowCapture(false);
            }}
          />
        ) : (
          <span className={css['Ghost']} aria-hidden="true">
            {projectInitial(project.name)}
          </span>
        )}
      </div>

      <div className={css['Content']}>
        <div>
          <header>
            <Title hasBottomSpacing>{project.name}</Title>

            {project.latestAccessed && (
              <Text textType={TextType.Shy}>Last accessed {timeSince(project.latestAccessed)} ago</Text>
            )}
          </header>
        </div>

        <div className={css['HoverOverlay']}>
          <div className={css['CtaContainer']}>
            <PrimaryButton label="Import" onClick={() => handleDownload()} />
          </div>
        </div>

        <div className={css['ImportIndicator']}>
          <Title isCentered hasBottomSpacing>
            Importing module
          </Title>
          <ActivityIndicator />
        </div>

        <div className={css['SuccessToast']}>
          <Title variant={TitleVariant.Success} isCentered hasBottomSpacing>
            Successfully imported
          </Title>
          <Text>{project.name}</Text>
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
