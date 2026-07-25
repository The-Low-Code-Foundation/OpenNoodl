import { JSONStorage } from '@noodl/platform';

/**
 * WF-007: one-time migration for the retired Cloud Services management panel.
 *
 * The deleted `CloudServicePanel` / `models/CloudServices` stored a list of
 * external Parse environments — each with a master key — in local
 * `JSONStorage('externalBrokers')`. That storage was never per-project: a
 * project's own connection was (and still is) `cloudservices` metadata on the
 * project itself (`getCloudServices`/`setCloudServices`), which already only
 * ever held `{id, endpoint, appId}` — no master key. So no project data
 * needs migrating; `externalBrokers` was purely the management UI's local
 * address book, now unused.
 *
 * What does need to happen: any master keys sitting in that local storage
 * should be scrubbed, since nothing will read or write them again. This runs
 * once (guarded by a flag in the same local storage) and logs what it found.
 */
export async function migrateExternalBrokersStorage(): Promise<void> {
  try {
    const migration = await JSONStorage.get('wf007ExternalBrokersMigration');
    if (migration && migration.done) return;

    const local = await JSONStorage.get('externalBrokers');
    const brokers = (local && local.brokers) || [];

    if (brokers.length > 0) {
      console.log(
        `[WF-007] Retiring the Cloud Services management panel: dropping ${brokers.length} locally stored ` +
          'external Parse environment(s), including their master keys, from local storage. Projects that already ' +
          'point at an external server keep working unchanged (their cloudservices project metadata never stored ' +
          'a master key) — set or edit the endpoint from the Backend Services panel.'
      );
    }

    await JSONStorage.set('externalBrokers', {});
    await JSONStorage.set('wf007ExternalBrokersMigration', { done: true, migratedCount: brokers.length });
  } catch (error) {
    console.error('[WF-007] Failed to migrate externalBrokers storage', error);
  }
}
