import { defineEventHandler, useSession } from 'h3';
import type { CboxSessionData, CboxSessionUser } from '../../types';
import { cboxSessionConfig } from '../utils/client';

/** Return the signed-in user from the session, or null. */
export default defineEventHandler(async (event): Promise<CboxSessionUser | null> => {
  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));
  return session.data.user ?? null;
});
