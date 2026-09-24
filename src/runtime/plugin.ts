import { defineNuxtPlugin, useHead, useRequestFetch, useRuntimeConfig } from '#imports';
import { computed } from 'vue';
import { CSS, CboxIdKey, STYLE_ID, type CboxWidgetAppearance } from '@cboxdk/id-vue';
import { useCboxUser } from './composables/useCboxUser';
import type { CboxSessionUser } from './types';

interface PublicCboxConfig {
  loginPath: string;
  logoutPath: string;
  profilePath: string;
  switchOrganizationPath: string;
  selectOrganizationPath: string;
  createOrganizationPath: string;
  appearance?: CboxWidgetAppearance;
}

/**
 * Hydrate the current user from the server session, then provide the widget context
 * app-wide so `@cboxdk/id-vue` components work anywhere without a `<CboxIdProvider>`.
 * Runs on both server and client (so SSR renders the signed-in state), and injects
 * the widget stylesheet via `useHead` — SSR-safe, no `document` access at import time.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const user = useCboxUser();
  if (user.value === null) {
    try {
      user.value = await useRequestFetch()<CboxSessionUser | null>('/api/_cbox/user');
    } catch {
      user.value = null;
    }
  }

  const config = useRuntimeConfig().public.cboxId as PublicCboxConfig;
  const appearance = config.appearance ?? {};
  const urls = {
    signIn: config.loginPath,
    signOut: config.logoutPath,
    profile: config.profilePath,
    switchOrganization: (id: string) => `${config.switchOrganizationPath}?org=${encodeURIComponent(id)}`,
    selectOrganization: config.selectOrganizationPath,
    createOrganization: config.createOrganizationPath,
  };

  nuxtApp.vueApp.provide(
    CboxIdKey,
    computed(() => ({ user: user.value, urls, appearance })),
  );

  useHead({ style: [{ id: STYLE_ID, key: STYLE_ID, innerHTML: CSS }] });
});
