/** Which bounding-box field changed, and the rect it changed to. */
export type BoundingBoxCallback = (property: 'x' | 'y' | 'width' | 'height', rect: DOMRect) => void;

/**
 * Polls an element's bounding box and reports each field that changes.
 *
 * There is no `ResizeObserver` here on purpose: this has to catch *position*
 * changes too (an ancestor moving), which no observer API reports. Hence the
 * rAF loop, and hence `pollDelay` for nodes that can afford to be lazier.
 *
 * The observer is reference-counted — `addObserver`/`removeObserver` — because
 * several outputs on one node can want the box, but only one loop should run.
 */
export default class DOMBoundingBoxObserver {
  isRunning: boolean;
  numBoundingBoxObservers: number;
  callback: BoundingBoxCallback;
  /** Milliseconds between samples. Falsy means poll every animation frame. */
  pollDelay?: number;
  target?: Element;

  constructor(callback: BoundingBoxCallback, pollDelay?: number) {
    this.isRunning = false;
    this.numBoundingBoxObservers = 0;
    this.callback = callback;
    this.pollDelay = pollDelay;
  }

  addObserver(): void {
    this.numBoundingBoxObservers++;

    if (!this.isRunning) {
      this._startObserver();
    }
  }

  removeObserver(): void {
    this.numBoundingBoxObservers--;
    if (this.numBoundingBoxObservers === 0) {
      this._stopObserver();
    }
  }

  setTarget(target: Element): void {
    this.target = target;
    if (this.numBoundingBoxObservers > 0 && !this.isRunning) {
      this._startObserver();
    }
  }

  _startObserver(): void {
    if (this.isRunning) return;
    if (!this.target) return;

    this.isRunning = true;

    // Starts as `{}` rather than a DOMRect, so the first sample reports every
    // field as changed — which is what gives outputs their initial values.
    let boundingRect: Partial<DOMRect> = {};
    const observer = () => {
      if (!this.target) {
        this.isRunning = false;
        return;
      }

      const bb = this.target.getBoundingClientRect();
      if (boundingRect.x !== bb.x) {
        this.callback('x', bb);
      }
      if (boundingRect.y !== bb.y) {
        this.callback('y', bb);
      }
      if (boundingRect.width !== bb.width) {
        this.callback('width', bb);
      }
      if (boundingRect.height !== bb.height) {
        this.callback('height', bb);
      }
      boundingRect = bb;

      if (this.isRunning) {
        if (this.pollDelay) {
          setTimeout(observer, this.pollDelay);
        } else {
          //poll as quickly as possible
          window.requestAnimationFrame(observer);
        }
      }
    };

    window.requestAnimationFrame(observer);
  }

  _stopObserver(): void {
    this.isRunning = false;
  }
}
