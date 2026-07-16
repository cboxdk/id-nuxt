import { defineEventHandler, getRequestURL, sendRedirect, useSession } from 'h3';
import type { CboxSessionData } from '../../types';
import { cboxSessionConfig, getCboxClient } from '../utils/client';

/** Clear the session and redirect to RP-initiated logout (or home). */
export default defineEventHandler(async (event) => {
  const client = getCboxClient(event);
  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));
  await session.clear();

  const origin = getRequestURL(event).origin;
  const logoutUrl = await client.logoutUrl(origin);
  return sendRedirect(event, logoutUrl ?? '/');
});
