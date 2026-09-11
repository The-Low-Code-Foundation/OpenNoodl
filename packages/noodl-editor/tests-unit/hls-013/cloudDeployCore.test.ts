/**
 * HLS-013 — the deploy decision, graded where both doors can be held to it.
 *
 * `cloudDeployCore` is the module the editor's Deploy button and the headless
 * `deploy_cloud_functions` tool BOTH run. It imports nothing, which is what lets
 * it be graded here in plain Node rather than only through a renderer or a live
 * backend — and what lets the MCP server import it at all (`ProjectModel`'s
 * import chain costs that package 201 type errors and drags a renderer view
 * module into a server bundle).
 *
 * 🔴 **This file is the AC4 lever.** A mutant in any decision below reddens this
 * suite AND `noodl-mcp`'s live-backend drive AND the renderer's editor-door
 * spec, because all three run this code. That is the whole reason the decision
 * was pulled out of `CloudFunctionDeployer` instead of being reimplemented for
 * the headless path — SB-017 is this repo's record of what two implementations
 * of one export cost.
 */

import {
  cloudBundleNameFrom,
  deployCloudBundle,
  hashCloudExport,
  namedFailure,
  type CloudBundleParts,
  type CloudDeployTransport
} from '../../src/editor/src/utils/exporter/cloudDeployCore';

/** A transport that records what it was asked to push. */
function recordingTransport(options: { serving?: string | null; failWith?: string } = {}) {
  const pushed: { name: string; bundle: Record<string, unknown> }[] = [];
  const transport: CloudDeployTransport = {
    putBundle: async (name, bundle) => {
      if (options.failWith) throw new Error(options.failWith);
      pushed.push({ name, bundle });
    },
    readServingHash: async () => options.serving ?? null
  };
  return { transport, pushed };
}

function parts(shipped: string[], failures: { name: string; reason: string }[] = []): CloudBundleParts {
  return {
    bundle: shipped.length ? { components: shipped.map((name) => ({ name })), settings: {}, metadata: {} } : null,
    shipped,
    failures
  };
}

describe('HLS-013 AC2 — a failure is a NAME, beside the ones that shipped', () => {
  it('names the function that failed and still deploys the rest, in the same run', async () => {
    const { transport, pushed } = recordingTransport();

    const result = await deployCloudBundle(
      parts(['/#__cloud__/saveOrder', '/#__cloud__/refund'], [{ name: '/#__cloud__/charge', reason: 'boom' }]),
      'proj-abc',
      transport
    );

    // 🔴 The two halves in one answer. This is the whole acceptance criterion:
    // a failure that is about THAT FUNCTION, sitting next to a success, so it
    // cannot be read as "the deploy is down".
    expect(result.functions).toEqual([
      { name: '/#__cloud__/saveOrder', status: 'deployed' },
      { name: '/#__cloud__/refund', status: 'deployed' },
      { name: '/#__cloud__/charge', status: 'failed', reason: 'boom' }
    ]);

    // The two that built really were pushed.
    expect(pushed).toHaveLength(1);
    expect((pushed[0].bundle.components as unknown[])).toHaveLength(2);

    // 🔴 And `ok` is FALSE. Three of four functions on the backend is not a
    // successful deploy: an agent that reads `ok` and moves on would ship an app
    // with a missing endpoint. The distinction between "pushed" and "complete"
    // is the one this field exists to carry.
    expect(result.ok).toBe(false);
    expect(namedFailure(result)).toBe('1 cloud function(s) did not deploy: "/#__cloud__/charge" (boom)');
  });

  it('a total build failure pushes NOTHING — an empty bundle would delete what is serving', async () => {
    const { transport, pushed } = recordingTransport();

    const result = await deployCloudBundle(
      { bundle: null, shipped: [], failures: [{ name: '/#__cloud__/charge', reason: 'boom' }] },
      'proj-abc',
      transport
    );

    expect(result.ok).toBe(false);
    expect(result.functions).toEqual([{ name: '/#__cloud__/charge', status: 'failed', reason: 'boom' }]);
    // `WorkflowRunner` replaces a bundle wholesale, so pushing an empty one here
    // would take down every function that was working.
    expect(pushed).toHaveLength(0);
  });

  it('a failed PUSH fails every function, including the ones that built cleanly', async () => {
    const { transport } = recordingTransport({ failWith: 'the backend said no' });

    const result = await deployCloudBundle(parts(['/#__cloud__/saveOrder']), 'proj-abc', transport);

    // The backend load is all-or-nothing (`loadWorkflow` swaps a candidate
    // runner in only on complete success), so reporting `saveOrder` as deployed
    // here would be the "deploy returned true" lie this task removes.
    expect(result.ok).toBe(false);
    expect(result.functions).toEqual([
      { name: '/#__cloud__/saveOrder', status: 'failed', reason: 'the backend said no' }
    ]);
    expect(result.error).toBe('the backend said no');
  });
});

describe('HLS-013 AC3 — the second run says so', () => {
  it('reports `unchanged` and pushes nothing when the backend already serves this fingerprint', async () => {
    const built = parts(['/#__cloud__/saveOrder']);
    const hash = hashCloudExport({ ...built.bundle } as Record<string, unknown>);
    const { transport, pushed } = recordingTransport({ serving: hash });

    const result = await deployCloudBundle(built, 'proj-abc', transport);

    expect(result.changed).toBe(false);
    expect(result.functions).toEqual([{ name: '/#__cloud__/saveOrder', status: 'unchanged' }]);
    expect(pushed).toHaveLength(0);
    // "Already deployed" is a success. Reporting it as a failure would make an
    // idempotent pipeline look broken on every run after the first.
    expect(result.ok).toBe(true);
  });

  it('🔴 KNOWN-FIRING CONTROL — a DIFFERENT fingerprint pushes', async () => {
    // Without this, every assertion above is equally satisfied by a deploy that
    // never pushes at all. The control is what makes `changed: false` an
    // idempotency claim rather than a broken-push claim.
    const { transport, pushed } = recordingTransport({ serving: 'something-else' });

    const result = await deployCloudBundle(parts(['/#__cloud__/saveOrder']), 'proj-abc', transport);

    expect(result.changed).toBe(true);
    expect(result.functions).toEqual([{ name: '/#__cloud__/saveOrder', status: 'deployed' }]);
    expect(pushed).toHaveLength(1);
  });

  it('`force` pushes even when the fingerprint matches', async () => {
    const built = parts(['/#__cloud__/saveOrder']);
    const hash = hashCloudExport({ ...built.bundle } as Record<string, unknown>);
    const { transport, pushed } = recordingTransport({ serving: hash });

    const result = await deployCloudBundle(built, 'proj-abc', transport, { force: true });

    expect(result.changed).toBe(true);
    expect(pushed).toHaveLength(1);
  });

  it('🔴 a transport that CANNOT say what is serving pushes — silence is not "unchanged"', async () => {
    // The trap this rules out: a `readServingHash` that throws, or a backend too
    // old to answer, reading as "already deployed" and skipping a real deploy
    // forever. "I did not ask" and "nothing changed" must not share an answer.
    const pushed: string[] = [];
    const transport: CloudDeployTransport = {
      putBundle: async (name) => {
        pushed.push(name);
      },
      readServingHash: async () => {
        throw new Error('this backend does not report bundles');
      }
    };

    const result = await deployCloudBundle(parts(['/#__cloud__/saveOrder']), 'proj-abc', transport);

    expect(result.changed).toBe(true);
    expect(pushed).toEqual(['proj-abc']);
  });

  it('the pushed bundle carries the fingerprint the backend will echo back', async () => {
    const built = parts(['/#__cloud__/saveOrder']);
    const { transport, pushed } = recordingTransport();

    const result = await deployCloudBundle(built, 'proj-abc', transport);

    // 🔴 The fingerprint is of the bundle WITHOUT the fingerprint in it. A hash
    // of an object containing its own hash could never be recomputed by the next
    // run, and every deploy would look changed forever.
    expect(pushed[0].bundle.deployFingerprint).toBe(result.hash);
    expect(hashCloudExport(built.bundle)).toBe(result.hash);
    expect(result.hash).not.toBe(hashCloudExport(pushed[0].bundle));
  });
});

describe('HLS-013 — deleting the last cloud function', () => {
  const empty: CloudBundleParts = { bundle: null, shipped: [], failures: [] };

  it('pushes an empty bundle when the backend has served this project before', async () => {
    const { transport, pushed } = recordingTransport();

    const result = await deployCloudBundle(empty, 'proj-abc', transport, { deleteWhenEmpty: true });

    // There is no delete call: `WorkflowRunner` keys by file name and replaces
    // wholesale, so an empty bundle IS the deletion.
    expect(pushed).toEqual([{ name: 'proj-abc', bundle: { components: [], settings: {}, metadata: {} } }]);
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
  });

  it('🔴 pushes NOTHING to a backend that has never served this project', async () => {
    const { transport, pushed } = recordingTransport();

    const result = await deployCloudBundle(empty, 'proj-abc', transport);

    // A project with no cloud functions is a success with nothing to do. Pushing
    // here would create a bundle file advertising nothing on a backend that was
    // fine.
    expect(pushed).toHaveLength(0);
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.functions).toEqual([]);
  });
});

describe('HLS-013 — the bundle name is one rule, not two', () => {
  it('is keyed on the DIRECTORY, so two projects on one backend cannot clobber each other', () => {
    const a = cloudBundleNameFrom('Site', '/Users/x/projects/site-a');
    const b = cloudBundleNameFrom('Site', '/Users/x/projects/site-b');

    expect(a).not.toBe(b);
    expect(a.startsWith('Site-')).toBe(true);

    // Same project, same name — this is what lets a second deploy REPLACE the
    // first rather than sit beside it.
    expect(cloudBundleNameFrom('Site', '/Users/x/projects/site-a')).toBe(a);
  });

  it('survives a name that is not a legal file name', () => {
    // The trailing separators are stripped BEFORE the hash is appended, so
    // there is exactly one dash between the name and the fingerprint.
    expect(cloudBundleNameFrom('My App / v2!', '/tmp/p')).toMatch(/^My-App---v2-[0-9a-f]{8}$/);
    expect(cloudBundleNameFrom('', '/tmp/p')).toMatch(/^project-[0-9a-f]{8}$/);
  });

  it('a project with no directory keeps a bare name', () => {
    expect(cloudBundleNameFrom('Site', undefined)).toBe('Site');
  });
});
