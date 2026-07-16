import { defineEventHandler, getQuery, sendRedirect, useSession } from 'h3';
import type { CboxSessionData } from '../../types';
import { cboxSessionConfig, getCboxClient } from '../utils/client';

/** Start login: create the authorization request, stash PKCE/state/nonce, redirect. */
export default defineEventHandler(async (event) => {
  const client = getCboxClient(event);
  const request = await client.createAuthorizationRequest();

  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));
  const redirect = getQuery(event).redirect;
  await session.update({
    state: request.state,
    codeVerifier: request.codeVerifier,
    nonce: request.nonce,
    redirectTo: typeof redirect === 'string' ? redirect : '/',
  });

  return sendRedirect(event, request.url);
});
