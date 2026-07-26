import { defineEventHandler, getRequestURL, sendRedirect, useSession } from 'h3';
import { useRuntimeConfig } from '#imports';
import type { CboxRuntimeConfig, CboxSessionData } from '../../types';
import { cboxSessionConfig, getCboxClient } from '../utils/client';

/** Clear the session and redirect to RP-initiated logout (or home). */
export default defineEventHandler(async (event) => {
  const client = getCboxClient(event);
  const cfg = useRuntimeConfig(event).cboxId as CboxRuntimeConfig;
  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));

  // Read the hint BEFORE clearing — the id_token identifies both the subject
  // signing out and this relying party.
  const idTokenHint = session.data.idToken;
  await session.clear();

  // Cbox ID only honours a post-logout return URL that is registered on the
  // client, byte for byte. The bare request origin is almost never what an admin
  // typed into the console, so prefer the configured value and let `postLogoutRedirectUri`
  // be set to exactly the registered string.
  const returnTo = cfg.postLogoutRedirectUri || getRequestURL(event).origin;
  const logoutUrl = await client.logoutUrl(returnTo, idTokenHint);
  return sendRedirect(event, logoutUrl ?? '/');
});
