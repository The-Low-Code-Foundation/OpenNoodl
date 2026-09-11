const { ipcRenderer } = require('electron');
const { useEffect, useRef, useState } = require('react');
const React = require('react');
const { default: useOnUnmount } = require('../../hooks/useOnUnmount');
const PopupLayer = require('../popuplayer').default;
const {
  INITIAL_INSTRUCTION_STATE,
  instructionDismissed,
  instructionOpenDecision
} = require('./lessoninstructionopen');

function LessonItem({
  itemContent,
  popupContent,
  hasNextButton,
  isComplete,
  isSelected,
  stepWidth,
  performActions,
  lessonFinished
}) {
  const ref = useRef();
  const popoutRef = useRef();

  const [showPopup, setShowPopup] = useState(false);

  /**
   * FIX-027 §17 — whether this step has already shown its own instructions, and whether the
   * learner has put them away. A ref, not state: the decision is read during an effect and must
   * not itself cause a render, and it has to survive the re-renders `refresh()` fires on every
   * `Model.*` event. See `lessoninstructionopen.ts` for why the trigger is the *transition* into
   * a step rather than the render.
   */
  const instructionState = useRef(INITIAL_INSTRUCTION_STATE);

  useEffect(() => {
    const decision = instructionOpenDecision(instructionState.current, {
      isSelected,
      hasPopupContent: Boolean(popupContent),
      lessonFinished
    });
    instructionState.current = decision.next;

    //scroll into view when selected, and check if popup should be shown
    const scrollIntoView = async () => {
      await scrollToElement(ref.current);
      decision.open && setShowPopup(true);
    };

    if (isSelected) {
      scrollIntoView();
      performActions();
    }
  }, [isSelected, popupContent, lessonFinished]);

  //check if popup should be shown
  useEffect(() => {
    if (!showPopup || !popupContent) {
      return;
    }

    const container = document.createElement('div');
    container.className = 'lesson-item-popup';
    container.appendChild(popupContent);

    PopupLayer.instance.hidePopouts(); //hide all other popouts that might be showing

    popoutRef.current = PopupLayer.instance.showPopout({
      content: { el: container },
      attachTo: ref.current,
      position: 'top',
      arrowColor: 'var(--theme-color-secondary)',
      animate: true,
      offsetY: -8,
      manualClose: hasNextButton,
      /*
       * 🔴 P79 J2 — the instructions and the controls they describe are ONE surface.
       *
       * `showPopout` used to raise a full-screen blocker (`.popup-layer` is fixed,
       * 100vw x 100vh, z-index 10; the lesson bar carries no z-index at all), so
       * while the instructions were open every control in the bar sat UNDER it.
       * Pressing CHECK MY WORK therefore landed on the blocker: the press dismissed
       * the popout and the button never received it, so no grading pass ran. The
       * learner lost their instructions and got no answer — and the recorded symptom,
       * "the check removes the instructions and says nothing new", is exactly what a
       * check that never ran looks like from the outside.
       *
       * Two facts have to hold together, which is why this is two options:
       *   - `blockOutsideClicks: false` — the press reaches the button.
       *   - `keepOpenWithin` — and pressing it does not throw the instructions away,
       *     because the bar belongs to the same surface. Dismissing on it is also
       *     REMEMBERED (`instructionDismissed` in `onClose`), so without this the
       *     instructions would not come back on the next render either.
       *
       * Everything outside the bar still dismisses, exactly as before.
       */
      blockOutsideClicks: false,
      keepOpenWithin: '.lesson-bottombar',
      onClose: () => {
        // FIX-027 §17: closing has to be REMEMBERED. Without this the next re-render — and
        // `refresh()` fires one on every `Model.*` event — reads as a fresh entry and re-opens
        // what the learner just dismissed.
        instructionState.current = instructionDismissed(instructionState.current);
        setShowPopup(false);
        ipcRenderer.send('viewer-show');
      }
    });

    ipcRenderer.send('viewer-hide');

    //make sure any videos start playing
    const videos = container.querySelectorAll('video');
    videos.forEach((video) => {
      video.play();
    });

    return () => {
      //pause videos, otherwise they run in the background and consume resources
      videos.forEach((video) => {
        video.pause();
      });
      PopupLayer.instance.hidePopout(popoutRef.current);
    };
  }, [showPopup, popupContent]);

  //This solves an issue where popups aren't closed when using the debug keyboard shortcut to skip steps
  useEffect(() => {
    if (showPopup && popoutRef.current.manualClose && hasNextButton === false) {
      setShowPopup(false);
    }
  }, [showPopup, hasNextButton]);

  useOnUnmount(() => {
    /**
     * an ugly fix for an ugly edge case
     * where the popuplayer renders a step
     * with a "next" button on the projectspage
     * if you close the popout and exit the project
     *
     * right now it will show for a split second, and then
     * it will be removed. not the cleanest solution, but this
     * will probably happen pretty rarely, and the popuplayer
     * is scheduled to be replaced by the react dialoglayer
     * sometime in the near future anyways
     */
    setTimeout(() => {
      PopupLayer.instance.hidePopouts();
    }, 10);
  });

  const style = {};
  if (stepWidth) {
    style.width = stepWidth;
  }

  return (
    <div
      ref={ref}
      style={style}
      className={`lesson-item ${isSelected ? 'selected' : ''} ${isComplete ? 'completed' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setShowPopup(true);
      }}
      dangerouslySetInnerHTML={{ __html: itemContent.innerHTML }}
    />
  );
}

//Scroll to this element
// - assumes the parent is the scroll container
// - leaves a margin of one item (left sibling)
// Returns a promise that resolves once the scrolling animation is done
async function scrollToElement(element) {
  const parent = element.parentElement;
  const parentPos = parent.getBoundingClientRect();

  const itemPosition = element.getBoundingClientRect();

  const scrollPos = itemPosition.left - parentPos.left + parent.scrollLeft;

  let scrollMargin = 0;
  if (element.previousElementSibling) {
    const siblingSize = element.previousElementSibling.getBoundingClientRect();
    scrollMargin = siblingSize.width;
  }

  const newScrollPos = scrollPos - scrollMargin;

  if (element.parentElement.scrollLeft !== newScrollPos) {
    element.parentElement.scrollTo({
      left: newScrollPos,
      behavior: 'smooth'
    });

    await asyncTimeout(500);
  }
}

function asyncTimeout(dur) {
  return new Promise((resolve) => {
    setTimeout(resolve, dur);
  });
}

module.exports = LessonItem;
