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
}

const Services = function Services() {} as unknown as ServicesModule;

Services.events = new EventEmitter();

export = Services;
