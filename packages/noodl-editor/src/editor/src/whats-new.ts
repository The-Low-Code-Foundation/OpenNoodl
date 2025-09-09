import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { LocalStorageKey } from '@noodl-constants/LocalStorageKey';
import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';

import { NewsModal } from './views/NewsModal';
import PopupLayer from './views/popuplayer';

/**
 * Display latest whats-new-post if the user hasn't seen one after it was last published
 * @returns
 */
export async function whatsnewRender() {
  const newEditorVersionAvailable = JSON.parse(localStorage.getItem(LocalStorageKey.hasNewEditorVersionAvailable));

  // if user runs an older version the changelog will be irrelevant
  if (newEditorVersionAvailable) return;

  const latestChangelogPost = await fetch(`${getDocsEndpoint()}/whats-new/feed.json`)
    .then((data) => data.json())
    .then((json) => json.items[0]);

  const lastSeenChangelogDate = new Date(
    JSON.parse(localStorage.getItem(LocalStorageKey.lastSeenChangelogDate))
  ).getTime();
  const latestChangelogDate = new Date(latestChangelogPost.date_modified).getTime();

  if (lastSeenChangelogDate >= latestChangelogDate) return;

  ipcRenderer.send('viewer-hide');

  const modalContainer = document.createElement('div');
  modalContainer.classList.add('popup-layer-react-modal');
  PopupLayer.instance.el.find('.popup-layer-modal').before(modalContainer);

  createRoot(modalContainer).render(
    React.createElement(NewsModal, {
      content: latestChangelogPost.content_html,
      onFinished: () => ipcRenderer.send('viewer-show')
    })
  );

  localStorage.setItem(LocalStorageKey.lastSeenChangelogDate, latestChangelogDate.toString());
}
