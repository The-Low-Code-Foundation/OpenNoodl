import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { App } from '@noodl-models/app';
import { KeyCode, KeyMod } from '@noodl-utils/keyboard/KeyCode';
import KeyboardHandler, { KeyboardCommand } from '@noodl-utils/keyboardhandler';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { LearningFolderModel } from '../models/learningfolder';
import { checkMyWork, liveCheckMyWorkDeps, summariseSubmission } from '../models/lessoncheck';
import { ProjectModel } from '../models/projectmodel';
import { liveLessonDatabaseSnapshot } from '../models/lessondatabase.live';
import { liveLessonEvalContext } from './lessons/lessonevalconditions.live';
import { databaseRefusal, evalConditionsWithContext, isCollectionCondition } from './lessons/lessonevalconditions';
import type { LessonDatabaseSnapshot } from './lessons/lessonevalconditions';
import LessonLayerView from './lessons/LessonLayerView';
import { isLessonFinished, stepFlowAction } from './lessons/lessonstepflow';
import PopupLayer from './popuplayer';
import { publishRunningLesson } from '../models/lessonprotection';
import { stashLessonReset } from '@noodl-utils/launcher/launcherHandoff';
import { leaveForLauncher } from '@noodl-utils/launcher/leaveForLauncher';
import { ToastLayer } from './ToastLayer/ToastLayer';

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

/**
 * FIX-027 §19/§20 — what the bottom bar shows once the lesson is over.
 *
 * ⚠️ `reset` is present whenever the lesson is one this editor could in principle start again —
 * i.e. it is installed in the Learning folder. Whether it can *actually* run is `available`, and
 * a refusal carries the register's own sentence rather than a second wording of it. A **hosted**
 * lesson has no register entry at all and gets no control, which is the same rule "check my
 * work" follows: absent when the concept does not apply, disabled-with-a-reason when it applies
 * and cannot run.
 */
interface ILessonCompletion {
  /** The lesson's title, when there is a register entry to read one from. */
  title?: string;
  reset?: {
    available: boolean;
    /** Why not. Only set when `available` is false. */
    reason?: string;
    onReset: () => void;
  };
  onExit: () => void;
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

/**
 * How often a data step re-reads the built-in database while it is on screen.
 *
 * Four seconds is a compromise with one number on each side: a learner who has just created a
 * record should not have to wonder whether the tick is broken, and a localhost round trip per
 * collection several times a minute is the most this may cost. Nothing else in the editor polls,
 * and this one stops the moment the active step no longer grades the database.
 */
const DATABASE_POLL_MS = 4000;

export class LessonLayer {
  /** FIX-025 — withdraws this lesson's steps from the delete guard. */
  private unpublishLesson?: () => void;

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
  /**
   * TUT-002 — the built-in database as of the last read, for the three collection verbs.
   *
   * 🔴 Held here rather than read inside `refresh()` because `refresh()` is **synchronous and
   * runs on every `Model.*` event** — reading a database from it is impossible and polling one
   * from it would be an HTTP request per keystroke. Absent means nobody has looked yet, which
   * every collection verb treats as unproven; it is never confused with an empty database.
   */
  database: LessonDatabaseSnapshot | undefined;
  /** The poll that keeps {@link database} fresh, running only while a data step is active. */
  databaseTimer: NodeJS.Timeout | undefined;
  /** FIX-027 §19 — whether this run of the lesson has already reached its completion moment. */
  private completionAnnounced = false;
  databaseReading = false;

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
    // A layer instance is reused across lessons; a flag left set would swallow the popout-close
    // on the next lesson's completion moment.
    this.completionAnnounced = false;

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
      // FIX-027 §19/§20 — absent until the lesson is over, so the bar is unchanged until then.
      completion: this.steps ? this._completion() : undefined,
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
      if (outcome.result === 'graded') {
        /*
         * 🔴 UNI-006 — the hand-in sentence is APPENDED to the grade's, never substituted for
         * it. A learner whose school could not be reached has still been graded, by two local
         * engines, on the project in front of them: replacing that with a network message
         * would throw away the answer they asked for. And the reverse is the more dangerous
         * one — a lesson that graded cleanly while the submit was refused must not read as
         * "all done", because a pupil who believes they handed in stops trying.
         *
         * ⚠️ Only the summary carries it. `recordGrade` already stored the grading sentence
         * as the card's feedback, and a card still reading "could not reach your school" six
         * weeks later would be describing a moment rather than the work.
         */
        const handIn = summariseSubmission(outcome.submission);
        next = {
          busy: false,
          summary: handIn ? `${outcome.summary} ${handIn}` : outcome.summary,
          complete: outcome.evidence.complete
        };
      } else {
        next = { busy: false, summary: outcome.reason, unavailable: true };
      }
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

    // TUT-002 — a step that grades the database keeps a poll alive while it is the active one,
    // and stops it the moment it is not. Decided here rather than inside the loop so that moving
    // *off* a data step stops the poll even when the next step carries no conditions at all.
    // 🔴 A learner adding a row in the Data Browser raises no editor model event, so without
    // this the step would tick only when something else happened to change.
    const active = this.steps[this.model.index];
    this._watchDatabase(!!active?.conditions?.some(isCollectionCondition));

    this.steps.forEach((step, stepIndex) => {
      if (stepIndex < this.model.index) {
        step.isComplete = true;

        const nextButton = step.popupContent.querySelector('.popup-button-container');
        if (nextButton) nextButton.parentElement.removeChild(nextButton);
        step.hasNextButton = false;
      } else if (stepIndex === this.model.index) {
        if (step.conditions && step.conditions.length) {
          try {
            // TUT-002 — one context, asked twice: whether these conditions could be graded at
            // all, and then whether they hold. A refusal is neither a pass nor a "not yet", and
            // saying so is the difference between a learner who starts their backend and one who
            // stares at a step that can never tick.
            const ctx = liveLessonEvalContext(this.database);
            const refusal = databaseRefusal(step.conditions, ctx);
            if (refusal) {
              step.isComplete = false;
              step.error = refusal;
            } else {
              step.error = undefined;
              step.isComplete = evalConditionsWithContext(step.conditions, ctx);
            }
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

    /**
     * 🔴 FIX-025 — COMPLETING THE LAST STEP USED TO BLANK THE LESSON BAR FOR GOOD.
     *
     * The choice is `stepFlowAction`'s, in `lessons/lessonstepflow.ts`, because the rule that
     * was wrong is arithmetic and nothing in this file is reachable from the jest runner. The
     * short version: `LessonModel.next()` does nothing on the final step, and advancing is the
     * branch that does not render, so the layer sat in it forever showing an empty div. Read
     * that module before changing this — including why the count comes from the model rather
     * than from `this.steps`.
     */
    const action = stepFlowAction(this._flowInput());

    if (action === 'advance') {
      //jump to the next step if all conditions are completed.
      //This will tigger the "instrcuctionsChanged" event on the model wich re-renders the lessons
      this.model.next();
    } else {
      this._clearTheWayForCompletion();
      this.div && this._renderReact();
    }
  }

  /**
   * FIX-027 §19 — get the finished step's own instructions out of the way, **once**.
   *
   * 🔴 **Found by driving, and it is not a cosmetic overlap.** An open popout puts
   * `PopupLayer`'s full-screen blocker over the editor (`popup-layer.has-popouts.dim`, z-index
   * 10). Measured on *State on a page*: with the last step's instructions open,
   * `document.elementFromPoint` at the middle of the completion banner returned
   * `popup-layer-blocker` — so the banner was **dimmed and its two buttons were behind a
   * blocker**, on the very screen §20 exists to make actionable. §17's edge rule opens those
   * instructions when the learner enters the step, so this is the ordinary path to the end of a
   * graded lesson, not a corner.
   *
   * ✅ The instructions are also simply *stale*: they say what to do on a step that is done.
   * `hidePopouts(true)` runs each popout's `onClose`, which is what `LessonItem` uses to record
   * a dismissal — so the step stays dismissed rather than reopening on the next render.
   *
   * ⚠️ **On the EDGE into completion, never on every refresh.** `refresh()` runs on every
   * `Model.*` event; closing popouts from all of them would shut instructions the learner had
   * deliberately re-opened to re-read, over and over. That is §17's own lesson pointed the other
   * way, and it is the failure a naive `if (finished) hidePopouts()` produces. The flag re-arms
   * when the lesson is no longer finished, so undoing work and finishing again works.
   */
  private _clearTheWayForCompletion(): void {
    const finished = isLessonFinished(this._flowInput());
    if (!finished) {
      this.completionAnnounced = false;
      return;
    }
    if (this.completionAnnounced) return;
    this.completionAnnounced = true;
    PopupLayer.instance.hidePopouts(true);
  }

  /**
   * The three facts both end-of-lesson answers are built from.
   *
   * 🔴 **One statement, two readers.** `stepFlowAction` decides whether to advance and
   * {@link isLessonFinished} decides whether to say "you have finished"; if they could disagree
   * about which step is last, the bar could advance past a step it had just congratulated the
   * learner for — or congratulate them on a step it was about to leave. The count comes from the
   * *model*, not from `this.steps`, for the reason `lessonstepflow.ts` records.
   */
  private _flowInput() {
    const currentStep = this.steps?.[this.model.index];
    return {
      hasCurrentStep: !!currentStep,
      hasConditions: !!(currentStep && currentStep.conditions && currentStep.conditions.length),
      isComplete: !!(currentStep && currentStep.isComplete),
      index: this.model.index,
      stepCount: this.model.numberOfLessons ?? 0
    };
  }

  /**
   * FIX-027 §19/§20 — the completion moment, or `undefined` while there is still lesson left.
   *
   * ⚠️ **Availability is read here, on every render, rather than cached when the lesson opened.**
   * A learner can finish a lesson an hour after starting it, and the `/tmp` bundle
   * *State on a page* was installed from can vanish inside that hour (FIX-026). A control drawn
   * from a stale answer is exactly the failure §20 exists to prevent.
   */
  private _completion(): ILessonCompletion | undefined {
    if (!isLessonFinished(this._flowInput())) return undefined;

    const onExit = () => {
      PopupLayer.instance.hideModal();
      PopupLayer.instance.hidePopouts(true);
      App.instance.exitProject();
    };

    const id = this.learningLessonId;
    // A hosted lesson has no register entry, so there is nothing to reset and no control —
    // the same rule "check my work" follows. It still gets a completion moment and a way out.
    const entry = id ? LearningFolderModel.instance.get(id) : undefined;
    if (!id || !entry) return { onExit };

    const availability = LearningFolderModel.instance.canReset(id);

    return {
      title: entry.title,
      reset: {
        available: availability.result === 'available',
        reason: availability.result === 'available' ? undefined : availability.reason,
        onReset: () => this._onStartAgain(id, entry.title)
      },
      onExit
    };
  }

  /**
   * The lesson *Start again* would restart, or `undefined` when there is nothing to offer.
   *
   * ⚠️ Used by the popup path, which must decide at parse time whether to draw a button at all.
   * The banner keeps its own live read instead, because it re-renders on every refresh and can
   * therefore afford the more honest answer; both go through {@link _onStartAgain}, which
   * re-asks before acting.
   */
  private _startAgainTarget(): { id: string; title: string } | undefined {
    const id = this.learningLessonId;
    if (!id) return undefined;
    const entry = LearningFolderModel.instance.get(id);
    if (!entry) return undefined;
    if (LearningFolderModel.instance.canReset(id).result !== 'available') return undefined;
    return { id, title: entry.title };
  }

  /**
   * *Start again*: throw this copy of the lesson away and come back to a fresh one.
   *
   * 🔴 **It closes the project, and it says so before it acts.** The reset cannot run while the
   * lesson is open — `Learning/<slug>/` *is* the open project — so the gesture is stash, leave,
   * and reset at the launcher. `launcherHandoff.ts` carries the argument. The obligation to say
   * "this closes the project" is `leaveForLauncher`'s and is discharged in this sentence.
   *
   * ⚠️ **Availability is re-asked here even though the button is only enabled when it holds.**
   * The bundle can go between the render and the press, and the learner would then be moved to
   * the launcher for a reset that refuses — a refusal delivered after the cost of it has already
   * been paid. This one is delivered before, in the lesson, with nothing changed.
   */
  private _onStartAgain(lessonId: string, title: string): void {
    const availability = LearningFolderModel.instance.canReset(lessonId);
    if (availability.result !== 'available') {
      ToastLayer.showError(availability.reason);
      return;
    }

    if (
      !confirm(
        `Start "${title}" again?\n\nThis closes the lesson and replaces your copy of it with a fresh one. ` +
          `Anything you built inside it is lost.`
      )
    ) {
      return;
    }

    stashLessonReset(lessonId);
    PopupLayer.instance.hideModal();
    PopupLayer.instance.hidePopouts(true);
    leaveForLauncher('learning');
  }

  _onNextClick() {
    PopupLayer.instance.hideModal();
    PopupLayer.instance.hidePopouts(true);
    this.model.next();
  }

  loadSteps() {
    /*
     * FIX-027 §20 — whether the last step's popup should carry a *Start again* beside its exit.
     * Absent for a hosted lesson (no register entry to reset) and for one this editor cannot
     * re-pull, which is the same absent-vs-disabled rule the banner follows.
     */
    const startAgain = this._startAgainTarget();

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

          /*
           * 🔴 FIX-027 §20 — `EXIT LESSON` USED TO BE THE ONLY THING OFFERED HERE.
           *
           * A lesson ending on a narrative step — *Log a thing* does — shows that step as a
           * screen-centre **modal**, so the completion banner in the bar below is behind its
           * dimmer. Measured while driving: `document.elementFromPoint` over the banner's
           * *Start again* returned `popup-layer dim`, and the modal's own buttons were exactly
           * `['EXIT LESSON']`. So the moment a learner has just finished offered them one door
           * and it led out of the lesson. The banner covers §19's shape, where there is no
           * popup at all; this covers §20's, where the popup **is** the completion moment.
           *
           * ⚠️ Availability is read here, at parse time, only to decide whether to draw the
           * control — `_onStartAgain` re-asks before it acts, because `loadSteps` runs on
           * `instructionsFetched` and a bundle can go in between.
           */
          if (isLastStep && startAgain) {
            buttonContainer.appendChild(
              createPopupButton('START AGAIN', () => this._onStartAgain(startAgain.id, startAgain.title))
            );
          }

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

    /**
     * FIX-025 — publish what this lesson is grading, so the delete path can ask before a
     * learner removes a node a step needs. Re-published on every parse because the steps are
     * rebuilt whenever the lesson reloads, and a stale list would protect the wrong nodes.
     * See `models/lessonprotection.ts` for why this is a registry rather than an import.
     */
    this.unpublishLesson?.();
    this.unpublishLesson = publishRunningLesson(
      this.steps.map((step) => ({
        // The step's own heading, which is what the learner sees on the card. `ILessonStep`
        // carries the compiled HTML rather than the authored fields, so this reads it back out
        // — the alternative is a dialog that says "Step 4", which names nothing they recognise.
        title: step.itemContent?.querySelector('h3')?.textContent?.trim() || undefined,
        conditions: step.conditions
      }))
    );
  }

  reload() {
    dataurls = {}; // Reload images, reset cache
    this.model.start();
  }

  restart() {
    this.model.index = 0;
    this.model.start();
  }

  /**
   * TUT-002 — keep the database snapshot fresh while a data step is on screen, and only then.
   *
   * 🔴 **The poll exists because nothing else fires.** Every other condition verb observes the
   * editor's own model, which raises `Model.*` when it changes; a row the learner adds in the
   * Data Browser, or from their own running app, changes nothing this layer is listening to. So
   * a data step either polls or never ticks until the learner happens to move a node.
   *
   * It is deliberately narrow: it runs only while the *active* step names a collection verb,
   * every {@link DATABASE_POLL_MS}, one read at a time (`databaseReading` guards a slow backend
   * from stacking requests), and it re-renders **only when the snapshot actually changed** —
   * otherwise the poll would repaint the timeline several times a minute for no reason.
   */
  _watchDatabase(wanted: boolean) {
    if (!wanted) {
      if (this.databaseTimer) {
        clearInterval(this.databaseTimer);
        this.databaseTimer = undefined;
      }
      return;
    }
    if (this.databaseTimer) return;

    void this._readDatabase();
    this.databaseTimer = setInterval(() => void this._readDatabase(), DATABASE_POLL_MS);
  }

  async _readDatabase() {
    if (this.databaseReading) return;
    this.databaseReading = true;
    try {
      const snapshot = await liveLessonDatabaseSnapshot();
      const changed = JSON.stringify(snapshot) !== JSON.stringify(this.database);
      this.database = snapshot;
      if (changed) this.refresh();
    } catch (e) {
      // `liveLessonDatabaseSnapshot` does not throw, so this is belt and braces — and it still
      // must not leave the last snapshot in place, which would grade against a database that may
      // be long gone. "Could not read" is the honest answer and ticks nothing.
      this.database = { status: 'unavailable', reason: e instanceof Error ? e.message : String(e) };
    } finally {
      this.databaseReading = false;
    }
  }

  dispose() {
    clearTimeout(this.refreshTimeout);
    // 🔴 Withdraw first: a lesson layer that is going away must stop the delete guard firing in
    // whatever project is opened next. See `models/lessonprotection.ts`.
    this.unpublishLesson?.();
    this.unpublishLesson = undefined;
    this._watchDatabase(false);
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
