/**
 * FB-005 T3 — the shelf the create wizard's template picker draws.
 *
 * ## 🔴 The hook owns the STATE. The registry owns the ROWS.
 *
 * `useTutorialInstall` states the split this follows, and there is a second reason here: this is
 * the **first caller `templateRegistry.list()` has ever had**. FB-005's sweep found the registry,
 * the interface and four providers all reachable by nobody — so the value of this file is mostly
 * that it exists, and everything it does beyond fetching is deliberately small.
 *
 * ## ⚠️ A short shelf is not a broken shelf, and the picker has to be told which it is looking at
 *
 * `TemplateRegistry.listing` reports the providers that could not answer *alongside* the rows
 * that arrived. That is the whole reason it exists: the community provider throwing leaves the
 * embedded templates on the shelf, which is right, and it also leaves a picker that would
 * otherwise present a one-row list as the complete set.
 *
 * @module noodl-editor/hooks/useProjectTemplates
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TemplateChoice, TemplateGalleryState } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard';
import { templateRegistry } from '@noodl-utils/forge';
import type { TemplateListing } from '@noodl-utils/forge/template/template-registry';

/**
 * What a provider is called on screen.
 *
 * ⚠️ A provider's `name` is an identifier used when reporting which provider refused — it is
 * `'embedded-templates'`, which is not a sentence. Unknown names fall through to the raw value
 * rather than to nothing: a badge naming a provider we have not labelled is a bug somebody can
 * see, and a missing badge is one nobody can.
 */
const ORIGIN_LABELS: Record<string, string> = {
  'embedded-templates': 'Built in',
  'community-templates': 'Community'
};

/**
 * The listing, as rows a picker can draw.
 *
 * Exported and pure so the mapping is graded without a React renderer or a network — the fetch
 * is the part that needs the hook, and it is the part with no decisions in it.
 */
export function galleryFromListing(listing: TemplateListing): {
  items: TemplateChoice[];
  partial?: string;
} {
  const items = listing.items.map(({ provider, item }): TemplateChoice => ({
    url: item.projectURL,
    title: item.title,
    description: item.desc,
    category: item.category,
    origin: ORIGIN_LABELS[provider] ?? provider
  }));

  if (listing.failures.length === 0) return { items };

  // 🔴 Names what is MISSING, not what failed technically. "community-templates threw" is a
  // sentence about our code; "some community templates could not be loaded" is one the person
  // in front of the wizard can act on — by retrying, or by carrying on with what is there.
  const labels = listing.failures.map((f) => ORIGIN_LABELS[f.provider] ?? f.provider);
  return {
    items,
    partial: `Some templates could not be loaded (${labels.join(', ')}), so this list may be short.`
  };
}

/**
 * @param enabled Whether the shelf is being looked at.
 *
 * 🔴 **The launcher must not make a community request on startup.** The picker is reachable only
 * from inside the create wizard, and a hook that fetched on mount would put a network read on
 * every cold start of the launcher for a screen most sessions never open. Gating on the wizard's
 * visibility also buys the freshness anybody would expect: re-opening the wizard re-reads the
 * shelf rather than showing whatever was there when the app started.
 */
export function useProjectTemplates(enabled: boolean): TemplateGalleryState {
  const [listing, setListing] = useState<TemplateListing | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setListing(null);
    templateRegistry
      .listing({})
      .then((next) => {
        if (live) setListing(next);
      })
      .catch((error: unknown) => {
        // `listing` is written not to throw — it collects every provider's failure. If it does
        // anyway, the picker must still stop saying "Looking for templates…" forever.
        if (!live) return;
        setListing({
          items: [],
          failures: [{ provider: 'templates', reason: error instanceof Error ? error.message : String(error) }]
        });
      });
    return () => {
      live = false;
    };
  }, [enabled, nonce]);

  const onRetry = useCallback(() => setNonce((n) => n + 1), []);

  return useMemo(() => {
    if (!listing) return { items: [], isLoading: true, onRetry };
    const { items, partial } = galleryFromListing(listing);
    return { items, isLoading: false, partial, onRetry };
  }, [listing, onRetry]);
}
