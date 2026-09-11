import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { LocalStorageKey } from '@noodl-constants/LocalStorageKey';
import getContentEndpoint from '@noodl-utils/getContentEndpoint';

import { NewsModal } from './views/NewsModal';
import PopupLayer from './views/popuplayer';

/**
 * Fetch the newest what's-new entry, or `null` if there is nothing to show.
 *
 * 🔴 This used to be three chained `.then()`s with no `res.ok` check, so on any
 * install whose content origin does not serve `whats-new/feed.json` the 404's
 * HTML body reached `.json()` and threw `Unexpected token '<', "<!DOCTYPE "`.
 * The caller floats the promise in a `useEffect`, so it surfaced as an
 * **unhandled rejection on every editor launch** — and since ALPHA-003 the
 * diagnostic log captures errors, which means it would also be the first thing
 * in every tester's bug report, pointing at nothing.
 *
 * A what's-new feed is decoration. Not having one is a normal state, not a
 * failure, so nothing here throws: every unreachable, non-JSON or empty
 * response resolves to `null` and the modal simply does not open.
 */
type ChangelogPost = { date_modified?: string; content_html?: string };

async function fetchLatestPost(): Promise<ChangelogPost | null> {
  try {
    const res = await fetch(`${getContentEndpoint()}/whats-new/feed.json`);
    // A 404 page is still a 200-shaped `Response` to `fetch`; only `ok` tells
    // the two apart before `.json()` gets a mouthful of HTML.
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.items) && json.items.length > 0 ? json.items[0] : null;
  } catch {
    return null;
  }
}

/**
 * Display latest whats-new-post if the user hasn't seen one after it was last published
 * @returns
 */
export async function whatsnewRender() {
  const newEditorVersionAvailable = JSON.parse(localStorage.getItem(LocalStorageKey.hasNewEditorVersionAvailable));

  // if user runs an older version the changelog will be irrelevant
  if (newEditorVersionAvailable) return;

  const latestChangelogPost = await fetchLatestPost();
  if (!latestChangelogPost) return;

  const lastSeenChangelogDate = new Date(
    JSON.parse(localStorage.getItem(LocalStorageKey.lastSeenChangelogDate))
  ).getTime();
  const latestChangelogDate = new Date(latestChangelogPost.date_modified).getTime();

  if (lastSeenChangelogDate >= latestChangelogDate) return;

  ipcRenderer.send('viewer-hide');

  const modalContainer = document.createElement('div');
  modalContainer.classList.add('popup-layer-react-modal');
  const modalEl = PopupLayer.instance.el.querySelector('.popup-layer-modal');
  PopupLayer.instance.el.insertBefore(modalContainer, modalEl);

  // Create root once and properly unmount when finished
  const modalRoot = createRoot(modalContainer);
  modalRoot.render(
    React.createElement(NewsModal, {
      content: latestChangelogPost.content_html,
      onFinished: () => {
        ipcRenderer.send('viewer-show');
        // Properly cleanup React root and DOM element
        modalRoot.unmount();
        modalContainer.remove();
      }
    })
  );

  localStorage.setItem(LocalStorageKey.lastSeenChangelogDate, latestChangelogDate.toString());
}
