import { AuthenticationError } from '@cboxdk/id-js';
import { defineEventHandler, getQuery, sendRedirect, useSession } from 'h3';
import type { CboxSessionData } from '../../types';
import { safeRedirect } from '../utils/authorize';
import { cboxSessionConfig, getCboxClient } from '../utils/client';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Complete login: verify state, exchange the code, verify the id_token, store user. */
export default defineEventHandler(async (event) => {
  const client = getCboxClient(event);
  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));
  const query = getQuery(event);
  const redirectTo = safeRedirect(session.data.redirectTo);
  const boundTo = session.data.organization;

  let user;
  try {
    user = await client.authenticate({
      params: {
        code: asString(query.code),
        state: asString(query.state),
        error: asString(query.error),
        error_description: asString(query.error_description),
      },
      stored: {
        state: session.data.state ?? '',
        codeVerifier: session.data.codeVerifier ?? '',
        nonce: session.data.nonce ?? '',
        // id-js refuses tokens for any organization but this one — the check that a
        // switch really landed where it was asked to go.
        ...(boundTo ? { organization: boundTo } : {}),
      },
    });
  } catch (error) {
    // A REFUSED SWITCH IS NOT A FAILED SIGN-IN. `access_denied` on a sign-in bound to an
    // organization means "not (or no longer) an active member of it". The person is still
    // signed in to the organization they were in, so they go back there, with the old
    // session untouched, and the app is told why — rather than dropped on an error page
    // or signed out.
    if (
      boundTo &&
      session.data.user &&
      error instanceof AuthenticationError &&
      error.error === 'access_denied'
    ) {
      await session.update({ state: undefined, codeVerifier: undefined, nonce: undefined, organization: undefined, redirectTo: undefined });

      return sendRedirect(event, withQuery(redirectTo, 'cbox_id_error', 'organization_access_denied'));
    }

    throw error;
  }

  await session.update({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      organization: user.organization
        ? { id: user.organization.id, name: user.organization.name, role: user.organization.role }
        : null,
      // Only the subject; id-js also chains prior actors, which nothing here draws.
      actor: user.actor ? { sub: user.actor.sub } : null,
    },
    accessToken: user.accessToken,
    refreshToken: user.refreshToken ?? undefined,
    // Kept so /auth/sign-out can hand it back as `id_token_hint`.
    idToken: user.idToken ?? undefined,
    expiresAt: Math.floor(Date.now() / 1000) + user.expiresIn,
    state: undefined,
    codeVerifier: undefined,
    nonce: undefined,
    organization: undefined,
    redirectTo: undefined,
  });

  return sendRedirect(event, redirectTo);
});

/** Add one query parameter to a same-site path. */
function withQuery(path: string, key: string, value: string): string {
  const url = new URL(path, 'http://placeholder.invalid');
  url.searchParams.set(key, value);

  return `${url.pathname}${url.search}${url.hash}`;
}
