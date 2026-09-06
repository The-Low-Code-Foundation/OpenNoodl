const { ipcRenderer } = require('electron');
const { useEffect } = require('react');
const React = require('react');
const PopupLayer = require('../popuplayer').default;
const LessonItem = require('./LessonItem');
const { EventDispatcher } = require('../../../../shared/utils/EventDispatcher');
const { describeStepCheck } = require('./lessonconditioncopy');
const { NodeLibrary } = require('../../models/nodelibrary');
const { getItemLabel } = require('../NodePicker/NodePicker.search');

/*
 * P79 D2 — the name the learner reads is the name on the node.
 *
 * A lesson grades `hasType`, which is an internal id: `poke-it` step 1 asked for a
 * `net.noodl.controls.button`, and that is what the "Looking for..." line said. This routes the
 * id through the node picker's OWN label function, so the sentence and the picker can never
 * disagree about what a node is called. `getNodeTypeWithName` returns undefined before the
 * library has loaded, and the copy module falls back rather than throwing.
 */
function resolveTypeName(typeName) {
  const type = NodeLibrary.instance && NodeLibrary.instance.getNodeTypeWithName(typeName);
  return type ? getItemLabel(type) : undefined;
}

/*
 * P79 L4 — and the name the learner reads for a PORT is the name on the panel.
 *
 * `snacks` step 2 asked for `csv set on “Pantry”`; the property panel says **CSV**. Same
 * authority as above — the node library's own port list — and the same fallback: a port the
 * library does not declare (one minted at runtime, or by what the learner typed) keeps its name.
 */
function resolvePortLabel(typeName, portName) {
  const type = NodeLibrary.instance && NodeLibrary.instance.getNodeTypeWithName(typeName);
  const ports = type && Array.isArray(type.ports) ? type.ports : [];
  const port = ports.find((p) => p && p.name === portName);
  return port && port.displayName ? port.displayName : undefined;
}

require('./LessonLayerView.css');

function LessonLayerView({ steps, currentStepIndex, check, completion }) {
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
      {completion ? <LessonCompletion completion={completion} /> : null}
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
                lessonFinished={Boolean(completion)}
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
          <LessonCheckControl
            check={check}
            looking={describeStepCheck(currentStep.conditions, resolveTypeName, resolvePortLabel)}
          />
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

/*
 * FIX-027 §19 and §20 — the completion moment.
 *
 * 🔴 **§19: it was a property of how the last step was authored.** `loadSteps` gives a step a
 * popup button only when it grades nothing, so a lesson ending on a narrative step got an
 * `EXIT LESSON` and a lesson ending on a graded card — *State on a page* — got nothing at all.
 * The learner satisfied the final condition and the bar simply stopped changing. This banner is
 * drawn from `isLessonFinished`, which knows both shapes, so the moment no longer depends on
 * what the author happened to put last.
 *
 * 🔴 **§20: exit was the only thing offered.** Reset existed — on the launcher card — and was
 * unreachable from the one place a learner has just proved they might want another go.
 *
 * ⚠️ **The refusal is TEXT, not a `title` attribute.** A disabled button suppresses pointer
 * events, so a native tooltip on one is a message that may never be delivered; and the whole
 * point of §20's warning is that this control must not fail silently in front of someone who
 * has just finished. The reason is rendered beside the button where it cannot be missed.
 *
 * ⚠️ **The steps stay on screen underneath.** Finishing is not leaving, and a learner who wants
 * to re-read step 3 before deciding should not have to choose between that and the banner.
 */
function LessonCompletion({ completion }) {
  const { title, reset, onExit } = completion;
  const canReset = reset && reset.available;

  return (
    <div className="lesson-complete" data-test="lesson-complete">
      <div className="lesson-complete-said">
        <div className="lesson-complete-headline" data-test="lesson-complete-headline">
          {title ? `Nice work — you've finished "${title}".` : "Nice work — you've finished this lesson."}
        </div>
        {reset && !reset.available && reset.reason ? (
          <div className="lesson-complete-reason" data-test="lesson-complete-reason">
            {reset.reason}
          </div>
        ) : null}
      </div>
      <div className="lesson-complete-actions">
        {reset ? (
          <button
            className="lesson-complete-button"
            data-test="lesson-complete-reset"
            disabled={!canReset}
            onClick={canReset ? reset.onReset : undefined}
          >
            START AGAIN
          </button>
        ) : null}
        <button className="lesson-complete-button primary" data-test="lesson-complete-exit" onClick={onExit}>
          EXIT LESSON
        </button>
      </div>
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
