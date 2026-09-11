/*
  🔴 NAT-005 (2026-08-19): `@storybook/addons` has not existed since Storybook 7, and this file
  had been importing it — the second of two reasons Storybook could not start in this checkout.
  The manager API moved to `@storybook/manager-api`; the theme import was already correct.
  See `main.ts` for the first reason and for what it cost.
*/
import { addons } from '@storybook/manager-api';
import { themes } from '@storybook/theming';

addons.setConfig({
  theme: themes.dark
});
