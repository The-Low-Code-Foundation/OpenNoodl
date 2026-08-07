/** A unit of work: a thunk returning the promise to await. */
export type QueuedTask<T = unknown> = () => Promise<T>;

interface QueueEntry {
  promise: QueuedTask<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

/**
 * Runs thunks one at a time, in submission order, and resolves each caller's
 * promise with its own result. Used by the Router and the Component Stack to keep
 * overlapping navigations from interleaving.
 */
export default class ASyncQueue {
  queue: QueueEntry[];

  /**
   * True while a task is in flight.
   *
   * Note the constructor initialises a differently-named field, `pendingPromise`,
   * which nothing ever reads — see {@link pendingPromise}. This flag is therefore
   * `undefined` until the first `dequeue`, which happens to be falsy and so behaves
   * correctly; the naming mismatch is latent rather than active.
   */
  workingOnPromise?: boolean;

  /**
   * @deprecated Dead field. The constructor sets it, but every read and write in
   * `dequeue` uses {@link workingOnPromise}. Preserved because removing it is a
   * behavioural change to a public-ish field rather than a typing one.
   */
  pendingPromise: boolean;

  constructor() {
    this.queue = [];
    this.pendingPromise = false;
  }

  enqueue<T>(promise: QueuedTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        promise,
        resolve,
        reject
      });
      this.dequeue();
    });
  }

  dequeue(): boolean {
    if (this.workingOnPromise) {
      return false;
    }
    const item = this.queue.shift();
    if (!item) {
      return false;
    }
    try {
      this.workingOnPromise = true;
      item
        .promise()
        .then((value) => {
          this.workingOnPromise = false;
          item.resolve(value);
          this.dequeue();
        })
        .catch((err) => {
          this.workingOnPromise = false;
          item.reject(err);
          this.dequeue();
        });
    } catch (err) {
      this.workingOnPromise = false;
      item.reject(err);
      this.dequeue();
    }
    return true;
  }
}
