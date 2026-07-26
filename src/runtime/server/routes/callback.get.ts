import { defineEventHandler, getQuery, sendRedirect, useSession } from 'h3';
import type { CboxSessionData } from '../../types';
import { cboxSessionConfig, getCboxClient } from '../utils/client';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Complete login: verify state, exchange the code, verify the id_token, store user. */
export default defineEventHandler(async (event) => {
  const client = getCboxClient(event);
  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));
  const query = getQuery(event);

  const user = await client.authenticate({
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
    },
  });

  const redirectTo = session.data.redirectTo ?? '/';
  await session.update({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
    },
    accessToken: user.accessToken,
    refreshToken: user.refreshToken ?? undefined,
    // Kept so /auth/sign-out can hand it back as `id_token_hint`.
    idToken: user.idToken ?? undefined,
    expiresAt: Math.floor(Date.now() / 1000) + user.expiresIn,
    state: undefined,
    codeVerifier: undefined,
    nonce: undefined,
    redirectTo: undefined,
  });

  return sendRedirect(event, redirectTo);
});
