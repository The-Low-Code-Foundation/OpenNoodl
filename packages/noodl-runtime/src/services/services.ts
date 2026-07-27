import type { UserServiceModule } from '@noodl/types';

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

  /**
   * The viewer's user service, hung here by `noodl-viewer-react`'s `userservice.ts` so
   * that `Noodl.Users`, the User nodes and the cloud runtime's Request node all reach one
   * instance.
   *
   * Only the entry point is named. The runtime does not own this class — it is defined in
   * `noodl-viewer-react`, which depends on this package and not the other way round — so
   * describing more of it here would be a second description of something this file
   * cannot see. `forScope` is what every consumer calls first.
   */
  UserService?: UserServiceModule;
}

const Services = function Services() {} as unknown as ServicesModule;

Services.events = new EventEmitter();

export = Services;
