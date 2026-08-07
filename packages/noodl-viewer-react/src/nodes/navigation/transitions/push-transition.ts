import BezierEasing from 'bezier-easing';

import type { ReactNodeInstance } from '../../../react-component-node';
import Transition, { TransitionParams, TransitionStartArgs } from './transition';

class PushTransition extends Transition {
  from: ReactNodeInstance;
  to: ReactNodeInstance;
  distance: { value: number; unit: string };
  direction: string;
  ease: (t: number) => number;
  crossfade: boolean;
  /**
   * Starts life as the `tr-darkoverlay` boolean, then — when truthy — is replaced in the
   * constructor by the overlay Group node itself. Every later use is inside an
   * `if (this.darkOverlay)`, so the boolean `false` never reaches a node call.
   */
  darkOverlay: boolean | ReactNodeInstance;
  darkOverlayAmount: number;
  zoom: { value: number; unit: string };

  constructor(from: ReactNodeInstance, to: ReactNodeInstance, params: TransitionParams) {
    super();

    this.from = from;
    this.to = to;

    this.timing = params.timing || { curve: [0.0, 0.0, 0.58, 1.0], dur: 300, delay: 0 };
    const distance = params.shift || { value: 25, unit: '%' };
    this.distance = typeof distance === 'number' ? { value: distance, unit: '%' } : distance;
    this.direction = params.direction || 'Left';

    this.timing.curve[0] = Math.min(1, Math.max(0, this.timing.curve[0]));
    this.timing.curve[2] = Math.min(1, Math.max(0, this.timing.curve[2]));
    this.ease = BezierEasing(...this.timing.curve).get;

    this.crossfade = params.crossfade === undefined ? false : params.crossfade;
    this.darkOverlay = params.darkoverlay === undefined ? true : params.darkoverlay;
    this.darkOverlayAmount = params.darkoverlayamount === undefined ? 0.5 : params.darkoverlayamount;

    const zoom = params.zoom || { value: 25, unit: '%' };
    this.zoom = typeof zoom === 'number' ? { value: zoom, unit: '%' } : zoom;

    if (this.darkOverlay) {
      this.darkOverlay = from.nodeScope.createPrimitiveNode('Group') as ReactNodeInstance;
      this.darkOverlay.setInputValue('position', 'absolute');
      this.darkOverlay.setInputValue('sizeMode', 'explicit');
      this.darkOverlay.setInputValue('width', { value: 100, unit: '%' });
      this.darkOverlay.setInputValue('height', { value: 100, unit: '%' });
      this.darkOverlay.setInputValue('backgroundColor', '#000000');
      this.darkOverlay.setInputValue('opacity', 0);
    }
  }

  update(t: number) {
    if (this.direction === 'In' || this.direction === 'Out') {
      let zoom = this.zoom.value / 100;

      zoom = this.direction === 'Out' ? -zoom : zoom;

      this.from.setStyle({
        transform: 'scale(' + (1 + zoom * t) + ')',
        opacity: this.crossfade ? 1 - t : 1
      });

      this.to.setStyle({
        transform: 'scale(' + (1 - zoom * (1 - t)) + ')',
        opacity: this.crossfade ? t : 1
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

      const from = {
        x: targets[this.direction].x * dist,
        y: targets[this.direction].y * dist
      };

      const target = {
        x: targets[this.direction].x * 100,
        y: targets[this.direction].y * 100
      };

      this.from.setStyle({
        transform: 'translate(' + from.x * t + unit + ',' + from.y * t + unit + ')',
        opacity: this.crossfade ? 1 - t : 1
      });

      this.to.setStyle({
        transform: 'translate(' + target.x * (t - 1) + unit + ',' + target.y * (t - 1) + '%)',
        opacity: this.crossfade ? t : 1
      });
    }

    if (this.darkOverlay) {
      (this.darkOverlay as ReactNodeInstance).setStyle({
        opacity: t * this.darkOverlayAmount
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

  start(args: TransitionStartArgs) {
    super.start(args);
    if (this.darkOverlay) {
      this.from.addChild(this.darkOverlay as ReactNodeInstance);
    }
  }

  end() {
    if (this.darkOverlay) {
      this.from.removeChild(this.darkOverlay as ReactNodeInstance);
    }
    super.end();
  }

  static ports(parameters: Record<string, unknown>) {
    const ports = [];

    ports.push({
      name: 'tr-direction',
      displayName: 'Direction',
      group: 'Transition',
      type: { name: 'enum', enums: ['Right', 'Left', 'Up', 'Down', 'In', 'Out'] },
      default: 'Left',
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
      name: 'tr-crossfade',
      displayName: 'Crossfade',
      group: 'Transition',
      type: 'boolean',
      default: false,
      plug: 'input'
    });

    ports.push({
      name: 'tr-darkoverlay',
      displayName: 'Dark Overlay',
      group: 'Transition',
      type: 'boolean',
      default: true,
      plug: 'input'
    });

    ports.push({
      name: 'tr-darkoverlayamount',
      displayName: 'Dark Overlay Amount',
      group: 'Transition',
      type: 'number',
      default: 0.5,
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

export default PushTransition;
