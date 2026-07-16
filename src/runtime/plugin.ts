import { defineNuxtPlugin, useRequestFetch } from '#imports';
import { useCboxUser } from './composables/useCboxUser';
import type { CboxSessionUser } from './types';

/** Hydrate the current user from the server session once, on app start. */
export default defineNuxtPlugin(async () => {
  const user = useCboxUser();
  if (user.value !== null) {
    return;
  }
  try {
    user.value = await useRequestFetch()<CboxSessionUser | null>('/api/_cbox/user');
  } catch {
    user.value = null;
  }
});
