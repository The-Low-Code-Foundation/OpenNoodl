import EventEmitter = require('../events');

/**
 * A process-wide event bus, and nothing else.
 *
 * The constructor exists only because the module predates static-only classes — nothing in
 * the repo ever calls `new Services()`. Every consumer reaches for `Services.events`, which
 * `noodl-runtime.js` uses to announce service availability to nodes already running.
 */
interface ServicesModule {
  (): void;
  events: typeof EventEmitter.prototype;
  /**
   * Read by `editorconnection.ts`'s `'publish'` branch — and assigned by nothing in the
   * repository, so that branch throws a `TypeError` if a publish message ever arrives.
   * Declared optional to describe the read honestly; see the DEFECT register in
   * PLAT-003 NOTES §31.
   */
  pubsub?: { routeMessage(message: unknown): void };
}

const Services = function Services() {} as unknown as ServicesModule;

Services.events = new EventEmitter();

export = Services;
