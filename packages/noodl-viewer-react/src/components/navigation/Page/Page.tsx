import React from 'react';

import type { TSFixme } from '../../../../typings/global';
import Layout from '../../../layout';
import { Noodl, Slot } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';

type MetaTag = {
  isProperty: boolean;
  key: string;
  displayName: string;
  editorName?: string;
  group: string;
  type?: string;
  popout?: TSFixme;
  /** NDA-012 (Visual), check C1. Forwarded onto the port by `page.ts`'s `inputProps` reduce. */
  description?: string;
};

const ogPopout = {
  group: 'seo-og',
  label: 'Open Graph',
  parentGroup: 'Experimental SEO'
};

const twitterPopout = {
  group: 'seo-twitter',
  label: 'Twitter',
  parentGroup: 'Experimental SEO'
};

export const META_TAGS: MetaTag[] = [
  {
    isProperty: true,
    key: 'description',
    description: 'Summary search engines show under the page title in results, usually kept under about 160 characters',
    displayName: 'Description',
    group: 'Experimental SEO'
  },
  {
    isProperty: true,
    key: 'robots',
    description: 'Instructions for search-engine crawlers, e.g. \"noindex, nofollow\" to keep this page out of results',
    displayName: 'Robots',
    group: 'Experimental SEO'
  },
  {
    isProperty: true,
    key: 'og:title',
    description: 'Title shown when this page is shared on Facebook, LinkedIn and most chat apps; falls back to the page title',
    displayName: 'Title',
    editorName: 'OG Title',
    group: 'General',
    popout: ogPopout
  },
  {
    isProperty: true,
    key: 'og:description',
    description: 'Summary shown beneath the title when this page is shared',
    displayName: 'Description',
    editorName: 'OG Description',
    group: 'General',
    popout: ogPopout
  },
  {
    isProperty: true,
    key: 'og:url',
    description: 'Canonical address of this page, so shares of different URLs are counted as the same page',
    displayName: 'Url',
    editorName: 'OG Url',
    group: 'General',
    popout: ogPopout
  },
  {
    isProperty: true,
    key: 'og:type',
    description: 'What kind of thing this page is, e.g. website or article, which changes how the preview is laid out',
    displayName: 'Type',
    editorName: 'OG Type',
    group: 'General',
    popout: ogPopout
  },
  {
    isProperty: true,
    key: 'og:image',
    description: 'Image shown in the share preview; it must be an absolute URL, not a project path',
    displayName: 'Image',
    editorName: 'OG Image',
    group: 'Image',
    popout: ogPopout
  },
  {
    isProperty: true,
    key: 'og:image:width',
    description: 'Width of the share image in pixels, which lets a preview reserve space before the image loads',
    displayName: 'Image Width',
    editorName: 'OG Image Width',
    group: 'Image',
    popout: ogPopout
  },
  {
    isProperty: true,
    key: 'og:image:height',
    description: 'Height of the share image in pixels',
    displayName: 'Image Height',
    editorName: 'OG Image Height',
    group: 'Image',
    popout: ogPopout
  },
  {
    isProperty: false,
    key: 'twitter:card',
    description: 'Shape of the preview on X/Twitter, e.g. summary or summary_large_image',
    displayName: 'Card',
    editorName: 'Twitter Card',
    group: 'General',
    popout: twitterPopout
  },
  {
    isProperty: false,
    key: 'twitter:title',
    description: 'Title shown when this page is shared on X/Twitter; falls back to the Open Graph title',
    displayName: 'Title',
    editorName: 'Twitter Title',
    group: 'General',
    popout: twitterPopout
  },
  {
    isProperty: false,
    key: 'twitter:description',
    description: 'Summary shown when this page is shared on X/Twitter',
    displayName: 'Description',
    editorName: 'Twitter Description',
    group: 'General',
    popout: twitterPopout
  },
  {
    isProperty: false,
    key: 'twitter:image',
    description: 'Image shown in the X/Twitter preview; it must be an absolute URL',
    displayName: 'Image',
    editorName: 'Twitter Image',
    group: 'General',
    popout: twitterPopout
  }
];

type MetaTagKey = typeof META_TAGS[number]['key'];

export interface PageProps extends Noodl.ReactProps {
  metatags?: Record<MetaTagKey, string>;

  children: Slot;
}

export function Page(props: PageProps) {
  const { style, children } = props;

  Layout.size(style, props);
  Layout.align(style, props);

  // Allow changing the metatags from inputs
  META_TAGS.forEach((item) => {
    const value = props.metatags && props.metatags[item.key];
    Noodl.SEO.setMeta(item.key, value);
  });

  return (
    <div ref={noodlRootRef((props as TSFixme).noodlNode)} style={style} className={props.className}>
      {children}
    </div>
  );
}
