import BezierEasing from 'bezier-easing';

import type { ReactNodeInstance } from '../../../react-component-node';
import Transition, { TransitionParams } from './transition';

class PopupTransition extends Transition {
  from: ReactNodeInstance;
  to: ReactNodeInstance;
  distance: { value: number; unit: string };
  direction: string;
  ease: (t: number) => number;
  fadein: boolean;
  zoom: { value: number; unit: string };
  constructor(from: ReactNodeInstance, to: ReactNodeInstance, params: TransitionParams) {
    super();

    this.from = from;
    this.to = to;

    this.timing = params.timing || { curve: [0.0, 0.0, 0.58, 1.0], dur: 300, delay: 0 };
    const distance = params.shift || { value: 25, unit: '%' };
    this.distance = typeof distance === 'number' ? { value: distance, unit: '%' } : distance;
    this.direction = params.direction || 'Right';

    this.timing.curve[0] = Math.min(1, Math.max(0, this.timing.curve[0]));
    this.timing.curve[2] = Math.min(1, Math.max(0, this.timing.curve[2]));
    this.ease = BezierEasing(...this.timing.curve).get;

    this.fadein = params.fadein === undefined ? false : params.fadein;

    const zoom = params.zoom || { value: 25, unit: '%' };
    this.zoom = typeof zoom === 'number' ? { value: zoom, unit: '%' } : zoom;
  }

  update(t: number) {
    if (this.direction === 'In' || this.direction === 'Out') {
      let zoom = this.zoom.value / 100;

      zoom = this.direction === 'Out' ? -zoom : zoom;

      this.to.setStyle({
        transform: 'scale(' + (1 - zoom * (1 - t)) + ')',
        // DEBT-006: this branch used to read `this.crossfade`, PushTransition's
        // parameter, which nothing here ever assigned — so In/Out popups never
        // faded and the node's own `tr-fadein` parameter was only honoured by
        // the translate branch (PLAT-003 NOTES §19.4 #3). `fadein` now applies
        // to both branches; it defaults to false, so untouched projects render
        // exactly as before.
        opacity: this.fadein ? t : 1
      });
    } else {
      const dist = this.distance.value;
      const unit = this.distance.unit;

      const targets = {
        Up: { x: 0, y: -1 },
        Down: { x: 0, y: 1 },
        Left: { x: -1, y: 0 },
        Right: { x: 1, y: 0 }
      };
      const target = {
        x: targets[this.direction].x * dist,
        y: targets[this.direction].y * dist
      };

      this.to.setStyle({
        transform: 'translate(' + target.x * (t - 1) + unit + ',' + target.y * (t - 1) + unit + ')',
        opacity: this.fadein ? t : 1
      });
    }
  }

  forward(t: number) {
    const _t = this.ease(t);
    this.update(_t);
  }

  back(t: number) {
    const _t = this.ease(t);
    this.update(1 - _t);
  }

  static ports(parameters: Record<string, unknown>) {
    const ports = [];

    ports.push({
      name: 'tr-direction',
      displayName: 'Direction',
      group: 'Transition',
      type: { name: 'enum', enums: ['Right', 'Left', 'Up', 'Down', 'In', 'Out'] },
      default: 'Right',
      plug: 'input'
    });

    if (parameters['tr-direction'] === 'In' || parameters['tr-direction'] === 'Out') {
      ports.push({
        name: 'tr-zoom',
        displayName: 'Zoom',
        group: 'Transition',
        type: { name: 'number', units: ['%'] },
        default: { value: 25, unit: '%' },
        plug: 'input'
      });
    } else {
      ports.push({
        name: 'tr-shift',
        displayName: 'Shift Distance',
        group: 'Transition',
        type: { name: 'number', units: ['%', 'px'] },
        default: { value: 25, unit: '%' },
        plug: 'input'
      });
    }

    ports.push({
      name: 'tr-fadein',
      displayName: 'Fade In',
      group: 'Transition',
      type: 'boolean',
      default: false,
      plug: 'input'
    });

    ports.push({
      name: 'tr-timing',
      displayName: 'Timing',
      group: 'Transition',
      type: 'curve',
      plug: 'input'
    });

    return ports;
  }
}

export default PopupTransition;
