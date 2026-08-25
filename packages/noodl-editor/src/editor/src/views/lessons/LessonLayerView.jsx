const { ipcRenderer } = require('electron');
const { useEffect } = require('react');
const React = require('react');
const PopupLayer = require('../popuplayer').default;
const LessonItem = require('./LessonItem');
const { EventDispatcher } = require('../../../../shared/utils/EventDispatcher');
const { describeStepCheck } = require('./lessonconditioncopy');

require('./LessonLayerView.css');

function LessonLayerView({ steps, currentStepIndex, check }) {
  if (!steps) return null; //steps are probably still being fetched

  const currentStep = steps && steps[currentStepIndex];

  useEffect(() => {
    //the first step has no item in the bottom bar, it's just a popup. Show it when selected
    const showPopupStep = currentStep && !currentStep.itemContent && currentStep.popupContent;

    if (!showPopupStep) return;

    const popupContainer = document.createElement('div');
    popupContainer.className = 'lesson-item-popup';
    popupContainer.appendChild(currentStep.popupContent);

    let videos = [];

    PopupLayer.instance.showModal({
      content: { el: popupContainer },
      position: 'screen-center',
      onClose() {
        ipcRenderer.send('viewer-show');
        //pause videos, otherwise they run in the background and consume resources
        videos.forEach((video) => {
          video.stop();
        });
      }
    });

    //make sure any videos start playing
    videos = popupContainer.querySelectorAll('video');
    videos.forEach((video) => {
      video.play();
    });

    ipcRenderer.send('viewer-hide');
  }, [currentStep]);

  const errors = steps.filter((step) => step.error).map((step) => step.error);

  let errorMsg = null;
  if (errors.length) {
    errorMsg = (
      <div style={{ padding: '5px', backgroundColor: 'red', color: 'white', fontSize: '14px' }}>
        {errors.map((e, i) => (
          <div key={i} style={{ userSelect: 'text', cursor: 'text' }}>
            {e}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="lesson-bottombar">
      {errorMsg}
      <div className="lesson-steps-row">
        <div className="lesson-steps">
          {steps.map((step, i) => {
            if (!step.itemContent) return null;

            /*
              🔴 FIX-027 §17 — `showPopupWhenSelected={hasConditions === false}` used to live
              here, and it is why the steps that tell a learner what to do were the only ones
              that never said it: every *task* has conditions, so every task was excluded.

              The flag is gone rather than inverted. `LessonItem` now asks
              `instructionOpenDecision` instead, which opens on the *edge* into a step and
              remembers a dismissal — the two things a flag read on every render cannot express.
              See `lessoninstructionopen.ts` for why an unconditional flip is worse than the bug.
            */
            return (
              <LessonItem
                key={i}
                itemContent={step.itemContent}
                hasNextButton={step.hasNextButton}
                popupContent={step.popupContent}
                isSelected={currentStepIndex === i}
                isComplete={step.isComplete}
                stepWidth={step.width}
                performActions={() => performActions(step.actions)}
              />
            );
          })}
        </div>
        {/*
          🔴 FIX-025 — the control is drawn only for a step that HAS something to grade.

          Richard: *"'Check my work' doesn't make sense... it's not clear when or why you
          should actually click it."* A narrative step has no `completeWhen`, so pressing it
          there ran a grading pass that could only ever repeat itself — which is what taught
          him the button was arbitrary. `currentStep.conditions` is the same array the
          evaluator grades, so the control appears exactly when it can do something.
        */}
        {check && currentStep && currentStep.conditions && currentStep.conditions.length ? (
          <LessonCheckControl check={check} looking={describeStepCheck(currentStep.conditions)} />
        ) : null}
      </div>
      <div className="lesson-layer-progressbar">
        <div
          className="lesson-layer-progressbar-fill"
          style={{ width: calculateProgress(steps, currentStepIndex) * 100 + '%' }}
        />
      </div>
    </div>
  );
}

/*
 * UNI-007 slice 4 — "check my work", the grading runner's first caller.
 *
 * Rendered only for a lesson installed in the Learning folder, because only
 * those have a register entry to record a grade against; a hosted lesson has no
 * such surface and gets no control rather than a disabled one.
 *
 * 🔴 Three states, not two. `unavailable` — no browser to render in, a lesson
 * folder that has gone — is neither a pass nor a fail, and is styled as neither.
 * A learner whose machine could not run the check has not failed the lesson.
 * The sentence itself is composed in `models/lessoncheck.ts` (`summariseGrade`),
 * so this file decides nothing about grading; it shows a string and a class.
 */
function LessonCheckControl({ check, looking }) {
  const stateClass = check.unavailable ? ' unavailable' : check.complete ? ' complete' : '';

  return (
    <div className="lesson-check" data-test="lesson-check">
      <button
        className="lesson-check-button"
        data-test="lesson-check-run"
        disabled={check.busy}
        onClick={check.onCheck}
      >
        {check.busy ? 'CHECKING…' : 'CHECK MY WORK'}
      </button>
      {/*
        🔴 Before any run there is no summary, so without this the button stood alone with
        nothing anywhere saying what it was for. Replaced by the summary once a run has
        happened — the result of the check is a better answer than a restatement of it.
      */}
      {!check.summary && looking ? (
        <div className="lesson-check-looking" data-test="lesson-check-looking">
          {looking}
        </div>
      ) : null}
      {check.summary ? (
        <div className={'lesson-check-summary' + stateClass} data-test="lesson-check-summary">
          {check.summary}
        </div>
      ) : null}
    </div>
  );
}

//For the progress bar we're only concered with items in the bar, not steps that only show a popup and no item.
//Calculate progress by just excluding them
function calculateProgress(steps, currentStepIndex) {
  const progressTotalSteps = steps.filter((step) => (step.itemContent ? true : false)).length;
  let progressCurrentStep = currentStepIndex;

  for (let i = 0; i < currentStepIndex; i++) {
    if (!steps[i].itemContent) {
      progressCurrentStep--;
    }
  }

  return progressCurrentStep / (progressTotalSteps - 1); //Minus one so the last step will result in progress being 1
}

function performActions(actions) {
  if (!actions?.length) return;

  for (const action of actions) {
    performAction(action);
  }
}

function performAction(action) {
  switch (action.action) {
    case 'selectNode':
      EventDispatcher.instance.emit('inspectNodes', {
        nodeIds: [action.nodeId]
      });
      break;
    case 'navigatePreview':
      EventDispatcher.instance.emit('setPreviewRoute', {
        url: action.url
      });
      break;
    case 'selectComponent':
      EventDispatcher.instance.emit('selectComponent', {
        componentName: action.componentName
      });
      break;
  }
}

module.exports = LessonLayerView;
