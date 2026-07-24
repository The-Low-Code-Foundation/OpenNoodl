import NoneTransition from './transitions/none-transition';
import PopupTransition from './transitions/popup-transition';
import PushTransition from './transitions/push-transition';
import type { TransitionConstructor } from './transitions/transition';

/**
 * Keyed by the value of the Push Component To Stack node's `transition` enum, and
 * indexed with it at runtime — hence the string index rather than a closed object.
 */
const Transitions: Record<string, TransitionConstructor> = {
  None: NoneTransition,
  Push: PushTransition,
  Popup: PopupTransition
};

export default Transitions;
