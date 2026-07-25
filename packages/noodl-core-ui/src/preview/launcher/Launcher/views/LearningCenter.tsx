/**
 * LearningCenter View — the Learn tab.
 *
 * LEARN-001 Slice 4: the entry/discovery UI that was the lessons system's only
 * fully-orphaned piece (the runtime existed but nothing let a user find or start
 * a lesson). Lists the available lessons with their saved progress and lets the
 * learner start, continue, or restart one. Lesson data and the start/restart
 * actions are supplied by the editor through LauncherContext; this component is
 * presentational so it stays Storybook-friendly and free of editor deps.
 */

import React from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';
import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';
import { LauncherLessonData, useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

export interface LearningCenterViewProps {}

export function LearningCenter({}: LearningCenterViewProps) {
  const { lessons, onStartLesson, onRestartLesson } = useLauncherContext();

  const hasLessons = lessons && lessons.length > 0;

  return (
    <LauncherPage title="Learning Center">
      <Box hasXSpacing hasYSpacing>
        <Box hasBottomSpacing>
          <Text textType={TextType.Shy}>
            Guided, hands-on lessons that run right inside the editor. Each one sets tasks and checks your work as you
            build.
          </Text>
        </Box>

        {!hasLessons ? (
          <div style={{ color: 'var(--theme-color-fg-default-shy)' }}>
            No lessons are available right now. Check your connection and try again.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}
          >
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                onStart={() => onStartLesson?.(lesson.id)}
                onRestart={onRestartLesson ? () => onRestartLesson(lesson.id) : undefined}
              />
            ))}
          </div>
        )}
      </Box>
    </LauncherPage>
  );
}

interface LessonCardProps {
  lesson: LauncherLessonData;
  onStart: () => void;
  onRestart?: () => void;
}

function LessonCard({ lesson, onStart, onRestart }: LessonCardProps) {
  const isCompleted = lesson.state === 'completed';
  const isInProgress = lesson.state === 'in-progress';
  const showProgress = isCompleted || isInProgress;

  const primaryLabel = isInProgress ? 'Continue' : isCompleted ? 'Review' : 'Start lesson';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--theme-color-bg-3)',
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: 'var(--theme-color-bg-2)'
      }}
    >
      <div
        style={{
          position: 'relative',
          height: '140px',
          backgroundColor: 'var(--theme-color-bg-3)',
          backgroundImage: lesson.imageSrc ? `url(${lesson.imageSrc})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {!lesson.imageSrc && <Icon icon={IconName.Rocket} size={IconSize.Large} />}
        {isCompleted && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'var(--theme-color-secondary)',
              color: 'var(--theme-color-on-secondary, #fff)',
              fontSize: '11px'
            }}
          >
            <Icon icon={IconName.Check} size={IconSize.Tiny} />
            Completed
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>
        <div style={{ flex: 1 }}>
          <Title size={TitleSize.Medium}>{lesson.title}</Title>
          {lesson.description && (
            <Box hasTopSpacing={1}>
              <Text textType={TextType.Shy}>{lesson.description}</Text>
            </Box>
          )}
        </div>

        {showProgress && <ProgressBar percent={lesson.progressPercent} />}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <PrimaryButton
            label={primaryLabel}
            variant={PrimaryButtonVariant.Cta}
            size={PrimaryButtonSize.Small}
            icon={showProgress ? undefined : IconName.Play}
            onClick={onStart}
          />
          {onRestart && showProgress && (
            <PrimaryButton
              label="Restart"
              variant={PrimaryButtonVariant.Muted}
              size={PrimaryButtonSize.Small}
              onClick={onRestart}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div style={{ marginTop: '10px' }}>
      <div
        style={{
          height: '4px',
          borderRadius: '2px',
          backgroundColor: 'var(--theme-color-bg-3)',
          overflow: 'hidden'
        }}
      >
        <div style={{ width: `${clamped}%`, height: '100%', backgroundColor: 'var(--theme-color-secondary)' }} />
      </div>
      <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--theme-color-fg-default-shy)' }}>
        {clamped}% complete
      </div>
    </div>
  );
}
