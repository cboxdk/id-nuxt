import type { H3Event } from 'h3';
import { useSession } from 'h3';
import { useRuntimeConfig } from '#imports';
import type { CboxRuntimeConfig, CboxSessionData, CboxSessionUser } from '../../types';
import { cboxSessionConfig } from './client';

/** Refresh the access token once it is within this many seconds of expiry. */
const REFRESH_SKEW_SECONDS = 60;

/**
 * The signed-in user from the session, transparently refreshing the access token
 * when it is within a minute of expiry and a refresh token is held. Cbox ID rotates
 * refresh tokens, so the rotated token is stored back. On a failed refresh (the token
 * was revoked or already rotated) the session is cleared and `null` is returned, so
 * the app falls back to signed-out rather than carrying a dead session.
 */
export async function resolveCboxUser(event: H3Event): Promise<CboxSessionUser | null> {
  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));
  const data = session.data;

  if (!data.user) {
    return null;
  }

  const expiresAt = data.expiresAt ?? 0;
  const expiring = expiresAt > 0 && expiresAt - Math.floor(Date.now() / 1000) <= REFRESH_SKEW_SECONDS;

  if (expiring && data.refreshToken) {
    const refreshed = await refreshTokens(event, data.refreshToken);

    if (refreshed === null) {
      await session.clear();
      return null;
    }

    await session.update({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? data.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expiresIn,
    });
  }

  return data.user;
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

/** Exchange a refresh token at the discovered token endpoint (OAuth 2.0 refresh_token). */
async function refreshTokens(event: H3Event, refreshToken: string): Promise<RefreshResult | null> {
  const cfg = useRuntimeConfig(event).cboxId as CboxRuntimeConfig;
  const issuer = cfg.issuer.replace(/\/$/, '');

  try {
    const discovery = await $fetch<{ token_endpoint?: string }>(
      `${issuer}/.well-known/openid-configuration`,
    );
    const tokenEndpoint = discovery.token_endpoint;
    if (typeof tokenEndpoint !== 'string') {
      return null;
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cfg.clientId,
      refresh_token: refreshToken,
    });
    if (cfg.clientSecret) {
      body.set('client_secret', cfg.clientSecret);
    }

    const tokens = await $fetch<{ access_token?: string; refresh_token?: string; expires_in?: number }>(
      tokenEndpoint,
      { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() },
    );

    if (typeof tokens.access_token !== 'string') {
      return null;
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : null,
      expiresIn: typeof tokens.expires_in === 'number' ? tokens.expires_in : 0,
    };
  } catch {
    return null;
  }
}
