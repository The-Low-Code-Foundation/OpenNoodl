import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { App } from '@noodl-models/app';
import { KeyCode, KeyMod } from '@noodl-utils/keyboard/KeyCode';
import KeyboardHandler, { KeyboardCommand } from '@noodl-utils/keyboardhandler';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { LearningFolderModel } from '../models/learningfolder';
import { checkMyWork, liveCheckMyWorkDeps } from '../models/lessoncheck';
import { ProjectModel } from '../models/projectmodel';
import evalConditions from './lessons/lessonevalconditions';
import LessonLayerView from './lessons/LessonLayerView';
import PopupLayer from './popuplayer';

/**
 * UNI-007 slice 4 — what the "check my work" control is showing.
 *
 * ⚠️ `unavailable` is a **third** state beside pass and fail, and it is the one
 * that matters most to get right: a learner on a machine with no browser to
 * render in has not failed the lesson, and a control that cannot tell "we could
 * not check" from "you are not there yet" will tell them they have.
 */
interface ILessonCheckState {
  busy: boolean;
  summary?: string;
  unavailable?: boolean;
  complete?: boolean;
}

interface ILessonStep {
  isComplete: boolean;
  conditions?: TSFixme[];

  width?: string;
  itemContent?: HTMLDivElement;
  popupContent: HTMLDivElement;

  error?: string;
  hasNextButton?: boolean;
}

export class LessonLayer {
  keyboardCommands: KeyboardCommand[];
  model: TSFixme;
  nextButton: HTMLDivElement;
  div: HTMLDivElement;
  steps: ILessonStep[];
  el: TSFixme;
  refreshTimeout: NodeJS.Timeout;
  root: Root | null = null;
  /** The Learning-folder entry id of the open lesson, or undefined for a hosted one. */
  learningLessonId: string | undefined;
  checkState: ILessonCheckState = { busy: false };

  constructor() {
    this.keyboardCommands = [
      {
        handler: () => this.reload(),
        keybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_R
      },
      {
        handler: () => this.restart(),
        keybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_T
      },
      {
        handler: () => this.model.next(),
        keybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_N
      }
    ];

    KeyboardHandler.instance.registerCommands(this.keyboardCommands);
  }

  startLesson(model) {
    if (this.model) {
      this.dispose();
    }

    this.model = model;
    this.learningLessonId = learningLessonId();

    this.model.on(
      'instructionsChanged',
      () => {
        this.refresh();
      },
      this
    );

    this.model.on(
      'instructionsFetched',
      () => {
        this.loadSteps();
        this.refresh();
      },
      this
    );

    EventDispatcher.instance.on(
      'activeComponentChanged',
      () => {
        this.refresh();
      },
      this
    );

    EventDispatcher.instance.on(
      'viewer-navigated',
      () => {
        this.refresh();
      },
      this
    );

    model.start();

    // When the model changes refresh the lesson popup
    EventDispatcher.instance.on(
      'Model.*',
      () => {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = setTimeout(() => {
          this.refresh();
        }, 1);
      },
      this
    );

    return this._render();
  }

  _renderReact() {
    const props = {
      steps: this.steps,
      currentStepIndex: this.model.index,
      onMoveToNextStep: () => {
        this.model.next();
      },
      // Absent for a hosted lesson, which has no register entry to grade
      // against and nowhere to record a grade — the control is not disabled
      // there, it does not exist.
      check: this.learningLessonId
        ? {
            busy: this.checkState.busy,
            summary: this.checkState.summary,
            unavailable: this.checkState.unavailable,
            complete: this.checkState.complete,
            onCheck: () => this.runCheck()
          }
        : undefined
    };

    if (!this.root) {
      this.root = createRoot(this.div);
    }
    this.root.render(React.createElement(LessonLayerView, props));
  }

  /**
   * Run the grading runner over this lesson and show what it said.
   *
   * 🔴 This is the runner's first caller anywhere. Until it existed,
   * `models/lessongrading.ts` was not in the renderer bundle at all — no editor
   * module imported it — so both engines, their tests and engine 2's adapter
   * were shipped code that nothing could reach.
   */
  async runCheck() {
    if (this.checkState.busy || !this.learningLessonId) return;

    this.checkState = { busy: true };
    this._renderReact();

    let next: ILessonCheckState;
    try {
      const outcome = await checkMyWork(this.learningLessonId, liveCheckMyWorkDeps());
      next =
        outcome.result === 'graded'
          ? { busy: false, summary: outcome.summary, complete: outcome.evidence.complete }
          : { busy: false, summary: outcome.reason, unavailable: true };
    } catch (e) {
      // `checkMyWork` does not throw; building its live ports can (no store, no
      // project). Either way the learner pressed a button and is owed a
      // sentence — and it must not read as a verdict on their work.
      console.error('lesson check failed', e);
      next = { busy: false, unavailable: true, summary: 'The check could not run. See the developer console.' };
    }

    this.checkState = next;
    // The layer may have been disposed while the render was running — engine 2
    // takes seconds, and closing the project mid-check is an ordinary thing to
    // do.
    if (this.div && this.root) this._renderReact();
  }

  _render() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    this.div = document.createElement('div');
    this.div.className = 'lessonlayerview';

    this._renderReact();

    this.el = this.div;
    return this.el;
  }

  refresh() {
    if (!this.steps) {
      //still waiting for the model to fetch the steps
      return;
    }

    // if (this.nextButton.parentElement) {
    //   this.nextButton.parentElement.removeChild(this.nextButton);
    // }

    this.steps.forEach((step, stepIndex) => {
      if (stepIndex < this.model.index) {
        step.isComplete = true;

        const nextButton = step.popupContent.querySelector('.popup-button-container');
        if (nextButton) nextButton.parentElement.removeChild(nextButton);
        step.hasNextButton = false;
      } else if (stepIndex === this.model.index) {
        if (step.conditions && step.conditions.length) {
          try {
            step.isComplete = evalConditions(step.conditions);
          } catch (e) {
            console.error('error in lesson condition', step.conditions, e.message);
            step.error = `Step ${stepIndex}: ${e.message}. Invalid condition: ${JSON.stringify(step.conditions)}.`;
          }
        } else {
          step.isComplete = false;
          //add the next or done button if this isn't an popup only step, since they already have one added
          if (step.itemContent && step.popupContent) {
            // if (stepIndex < this.steps.length - 1) {
            //   step.popupContent.appendChild(this.nextButton);
            //   step.hasNextButton = true;
            // }
          }
        }
      } else {
        step.isComplete = false;
      }
    });

    const currentStep = this.steps[this.model.index];

    if (currentStep && currentStep.conditions && currentStep.isComplete) {
      //jump to the next step if all conditions are completed.
      //This will tigger the "instrcuctionsChanged" event on the model wich re-renders the lessons
      this.model.next();
    } else {
      this.div && this._renderReact();
    }
  }

  _onNextClick() {
    PopupLayer.instance.hideModal();
    PopupLayer.instance.hidePopouts(true);
    this.model.next();
  }

  loadSteps() {
    const steps = this.model.lessons.map((instructionsHTML, stepIndex) => {
      const stepElement = document.createElement('div');
      stepElement.innerHTML = instructionsHTML;

      const itemContent: HTMLDivElement = stepElement.querySelector('div[data-template="item"]');
      const popupContent: HTMLDivElement = stepElement.querySelector('div[data-template="popup"]');

      //look for buttons in the lesson that can trigger special actions
      const buttons = stepElement.querySelectorAll('[data-click]') as NodeListOf<HTMLElement>;
      for (const button of Array.from(buttons)) {
        const clickAction = button.getAttribute('data-click');
        if (clickAction === 'exitEditor') {
          button.parentElement.removeChild(button);
        }
      }

      const step: any = {
        hasNextButton: false
      };

      if (itemContent) {
        this._loadImages(itemContent);
        this._loadVideos(itemContent);

        let conditions = stepElement.firstElementChild.getAttribute('data-conditions');
        if (conditions) {
          try {
            conditions = JSON.parse(conditions);
          } catch (e) {
            console.error('error in lesson condition', conditions, e.message);
            step.error = `Step ${stepIndex}: Invalid condition: ${conditions}. ${e.message}`;
          }
        }
        step.conditions = conditions && conditions.length ? conditions : undefined;
        if (itemContent.style.width) {
          step.width = itemContent.style.width;
          itemContent.style.width = '';
        }
        step.itemContent = itemContent;

        const actions = stepElement.firstElementChild.getAttribute('data-actions');
        if (actions) {
          try {
            step.actions = JSON.parse(actions);
          } catch (e) {
            console.error('error in lesson actions', actions, e.message);
            step.error = `Step ${stepIndex}: Invalid actions: ${actions}. ${e.message}`;
          }
        }
      }

      if (popupContent) {
        // New rendering for 2.8.1 and above is a hot mess
        // It works though. Feel free to hit me in the head
        // if you are ever forced to work on this code.
        //
        // xoxo, Kotte
        const root = popupContent.cloneNode() as HTMLDivElement;
        root.innerHTML = '';

        const mediaContainer = document.createElement('div');
        mediaContainer.classList.add('popup-media');
        root.appendChild(mediaContainer);
        const mediaRenderContainer = root.querySelector<HTMLElement>('.popup-media');

        this._loadImages(popupContent, mediaRenderContainer);
        this._loadVideos(popupContent, mediaRenderContainer);

        const legacyStyleTag = popupContent.querySelector('style');
        if (legacyStyleTag) popupContent.removeChild(legacyStyleTag);

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('popup-content-wrapper');
        const contentContainer = document.createElement('div');
        contentContainer.classList.add('popup-content');
        contentContainer.innerHTML = popupContent.innerHTML;
        popupContent.innerHTML = '';

        const shouldButtonRender = !step.conditions;
        const isLastStep = this.model.lessons.length - 1 === stepIndex;

        // empty content containers still take up space
        if (shouldButtonRender || contentContainer.innerHTML.trim().length) {
          contentWrapper.prepend(contentContainer);
          root.prepend(contentWrapper);
        }

        if (shouldButtonRender) {
          //this is a step with only a popup. Add a next button.
          const buttonContainer = root.querySelector('.popup-content-wrapper');

          const buttonToAppend = !isLastStep
            ? createPopupButton('NEXT', () => {
                this._onNextClick();
              })
            : createPopupButton('EXIT LESSON', () => {
                App.instance.exitProject();
              });
          buttonContainer.appendChild(buttonToAppend);

          step.hasNextButton = !isLastStep;
        }

        step.popupContent = root;
      }

      return step;
    });

    this.steps = steps.filter((step) => step.itemContent || step.popupContent); //remove any steps with incorrect HTML
  }

  reload() {
    dataurls = {}; // Reload images, reset cache
    this.model.start();
  }

  restart() {
    this.model.index = 0;
    this.model.start();
  }

  dispose() {
    clearTimeout(this.refreshTimeout);
    KeyboardHandler.instance.deregisterCommands(this.keyboardCommands);

    this.model.off(this);
    EventDispatcher.instance.off(this);

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  resize() {}

  _loadImages(el: HTMLElement, renderContainer: HTMLElement = undefined) {
    // Iterate over all images and load the src as a dataurl
    el.querySelectorAll('img').forEach((img) => {
      const url = img.getAttribute('src');

      loadSrcAsset(img, this.model.baseURL + url, 'image/*', renderContainer);
    });
  }

  _loadVideos(el: HTMLElement, renderContainer: HTMLElement = undefined) {
    // Iterate over all videos and load the src as a dataurl
    el.querySelectorAll('video').forEach((video) => {
      const url = video.getAttribute('src');

      //having autoplay here will make the video run in the background, which can cause performance issues, so remove it if it's there
      video.removeAttribute('autoplay');
      video.setAttribute('loop', '');
      video.setAttribute('muted', '');

      loadSrcAsset(video, this.model.baseURL + url, 'video/*', renderContainer);
    });
  }
}

/**
 * The Learning-folder id of the open project, when it is one.
 *
 * ⚠️ Read from the **register**, not from a flag on the project. `project.id` is
 * set to the entry id by the launcher's open path, so this is a lookup rather
 * than a claim: a project asserting it is a lesson proves nothing, and the
 * register is the thing that has to have an entry for `recordGrade` to write to
 * anyway.
 */
function learningLessonId(): string | undefined {
  try {
    const id = ProjectModel.instance?.id;
    return id && LearningFolderModel.instance.get(id) ? id : undefined;
  } catch (e) {
    // The register reaches electron-store; a failure there must not take the
    // lesson layer down with it — a hosted lesson does not need it at all.
    console.error('could not read the Learning register', e);
    return undefined;
  }
}

//download the asset and show a load indicator while fetching it
let dataurls = {};

function loadSrcAsset(el: HTMLElement, url: string, acceptType: string, renderContainer: HTMLElement) {
  el.classList.add('unselectable');

  const _hash = url;
  if (dataurls[_hash]) {
    // This image has been loaded
    el.setAttribute('src', dataurls[_hash]);

    if (renderContainer) {
      renderContainer.append(el);
    }
  } else {
    // Request image and show spinner
    el.setAttribute('src', '');

    const spinner = document.createElement('div');
    spinner.className = 'spinner lesson-spinner';
    spinner.innerHTML = '<div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div>';

    if (renderContainer) {
      el.remove();
      renderContainer.appendChild(spinner);
    } else {
      el.replaceWith(spinner);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', acceptType);
    xhr.responseType = 'blob';
    xhr.onload = function () {
      const dataurl = window.URL.createObjectURL(this.response);
      dataurls[_hash] = dataurl;
      el.setAttribute('src', dataurl);
      if (renderContainer) {
        const spinners = Array.from(renderContainer.querySelectorAll('.lesson-spinner'));
        spinners.forEach((spinner) => {
          renderContainer.removeChild(spinner);
        });
        renderContainer.append(el);
      } else {
        spinner.replaceWith(el);
      }
    };
    xhr.send();
  }
}

function createPopupButton(label, onClick) {
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.justifyContent = 'flex-end';
  div.classList.add('popup-button-container');

  const button = document.createElement('button');
  button.className = 'lesson-next-button';
  button.innerText = label;

  button.onclick = onClick;

  div.appendChild(button);

  return div;
}
