import type { AuthorizationRequestOptions } from '@cboxdk/id-js';
import { getQuery, sendRedirect, useSession, type H3Event } from 'h3';
import type { CboxSessionData } from '../../types';
import { cboxSessionConfig, getCboxClient } from './client';

/**
 * Start an authorization: build the request, stash PKCE / state / nonce and the
 * organization it is bound to in the sealed session, and redirect to Cbox ID.
 *
 * Every sign-in route goes through here — plain, switch, picker, create — so each one
 * resets the binding. A plain sign-in writes `organization: undefined`, which is the point:
 * a switch the person abandoned must not bind the next, unrelated sign-in.
 */
export async function startAuthorization(event: H3Event, options: AuthorizationRequestOptions = {}) {
  const client = getCboxClient(event);
  const request = await client.createAuthorizationRequest(options);

  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));
  await session.update({
    state: request.state,
    codeVerifier: request.codeVerifier,
    nonce: request.nonce,
    organization: request.organization,
    redirectTo: safeRedirect(getQuery(event).redirect),
  });

  return sendRedirect(event, request.url);
}

/**
 * The post-sign-in destination, when it is a path on this site; `/` otherwise.
 *
 * `?redirect=` arrives from a link anybody can craft. Followed as given, the app's own
 * sign-in route bounced a freshly signed-in person to any site at all — an open redirect
 * with a genuine login in front of it. `//evil.test` and `/\evil.test` are absolute URLs
 * to a browser, so a leading slash alone is not enough.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }

  return value;
}
