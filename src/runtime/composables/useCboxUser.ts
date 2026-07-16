import { useState } from '#imports';
import type { CboxSessionUser } from '../types';

/**
 * The signed-in Cbox ID user (reactive), or null when signed out. Hydrated by the
 * module's plugin from the server session.
 */
export function useCboxUser() {
  return useState<CboxSessionUser | null>('cbox-id-user', () => null);
}
