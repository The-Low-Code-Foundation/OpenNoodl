import type { ReactNodeInstance } from '../../../react-component-node';
import Transition from './transition';

class NoneTransition extends Transition {
  from: ReactNodeInstance;
  to: ReactNodeInstance;

  constructor(from: ReactNodeInstance, to: ReactNodeInstance) {
    super();

    this.from = from;
    this.to = to;

    this.timing = { dur: 0, delay: 0 };
  }

  update() {}

  forward() {}

  back() {}

  static ports() {
    return [];
  }
}

export default NoneTransition;
