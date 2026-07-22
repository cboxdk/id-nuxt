import type { H3Event } from 'h3';
import { useSession } from 'h3';
import { useRuntimeConfig } from '#imports';
import type { CboxRuntimeConfig, CboxSessionData, CboxSessionUser } from '../../types';
import { cboxSessionConfig } from './client';

/** Refresh the access token once it is within this many seconds of expiry. */
const REFRESH_SKEW_SECONDS = 60;

/** issuer → token_endpoint, so a refresh doesn't re-fetch discovery every time. */
const tokenEndpointCache = new Map<string, string>();

/**
 * In-process single-flight: concurrent reads that all see the token expiring share
 * ONE refresh rather than each presenting the same refresh token. Across processes
 * (serverless), the IdP's short reuse grace window tolerates the parallel presentation.
 */
const inFlight = new Map<string, Promise<RefreshOutcome>>();

/**
 * The signed-in user from the session, transparently refreshing the access token when
 * it is within a minute of expiry and a refresh token is held. Cbox ID rotates refresh
 * tokens, so the rotated token is stored back. A GENUINE rejection (invalid_grant) clears
 * the session; a transient IdP hiccup keeps it (the near-expiry token is still valid and
 * the next request retries) — a network blip must not log everyone out.
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
    const outcome = await refreshOnce(event, data.refreshToken);

    if (outcome.status === 'refreshed') {
      await session.update({
        accessToken: outcome.tokens.accessToken,
        refreshToken: outcome.tokens.refreshToken ?? data.refreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + outcome.tokens.expiresIn,
      });
    } else if (outcome.status === 'revoked') {
      await session.clear();
      return null;
    }
    // 'transient' → keep the session and the current token; do not log out.
  }

  return data.user;
}

interface RefreshTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

type RefreshOutcome =
  | { status: 'refreshed'; tokens: RefreshTokens }
  | { status: 'revoked' }
  | { status: 'transient' };

/** Coalesce concurrent refreshes of the same token in this process. */
function refreshOnce(event: H3Event, refreshToken: string): Promise<RefreshOutcome> {
  const existing = inFlight.get(refreshToken);
  if (existing) {
    return existing;
  }
  const promise = refreshTokens(event, refreshToken).finally(() => inFlight.delete(refreshToken));
  inFlight.set(refreshToken, promise);
  return promise;
}

async function tokenEndpoint(issuer: string): Promise<string | null> {
  const cached = tokenEndpointCache.get(issuer);
  if (cached) {
    return cached;
  }
  const discovery = await $fetch<{ token_endpoint?: string }>(`${issuer}/.well-known/openid-configuration`);
  if (typeof discovery.token_endpoint !== 'string') {
    return null;
  }
  tokenEndpointCache.set(issuer, discovery.token_endpoint);
  return discovery.token_endpoint;
}

async function refreshTokens(event: H3Event, refreshToken: string): Promise<RefreshOutcome> {
  const cfg = useRuntimeConfig(event).cboxId as CboxRuntimeConfig;
  const issuer = cfg.issuer.replace(/\/$/, '');

  let endpoint: string | null;
  try {
    endpoint = await tokenEndpoint(issuer);
  } catch {
    return { status: 'transient' };
  }
  if (endpoint === null) {
    return { status: 'transient' };
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: cfg.clientId,
    refresh_token: refreshToken,
  });
  if (cfg.clientSecret) {
    body.set('client_secret', cfg.clientSecret);
  }

  try {
    const tokens = await $fetch<{ access_token?: string; refresh_token?: string; expires_in?: number }>(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (typeof tokens.access_token !== 'string') {
      return { status: 'transient' };
    }

    return {
      status: 'refreshed',
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : null,
        expiresIn: typeof tokens.expires_in === 'number' ? tokens.expires_in : 0,
      },
    };
  } catch (error) {
    // A 400 (invalid_grant) means the token was revoked or rotated away → session dead.
    // Anything else (5xx, timeout, DNS) is transient → keep the session for a retry.
    const status = (error as { response?: { status?: number }; statusCode?: number }).response?.status
      ?? (error as { statusCode?: number }).statusCode;

    return status === 400 ? { status: 'revoked' } : { status: 'transient' };
  }
}
