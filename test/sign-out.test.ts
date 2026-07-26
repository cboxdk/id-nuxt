import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-level tests for /auth/sign-out.
 *
 * The point of these is the ORDERING: the id_token has to be read out of the session
 * BEFORE the session is cleared, or every sign-out silently drops the `id_token_hint`
 * and the OP can no longer tell which subject/RP is signing out. A runtime-config
 * assertion cannot see that, so the session stub below models h3 faithfully —
 * `clear()` really does replace `session.data` — and reading after the clear yields
 * `undefined`. Swap the two lines in sign-out.get.ts and case (a) goes red.
 */

const state = vi.hoisted(() => ({
  runtimeConfig: {} as Record<string, unknown>,
  session: null as unknown as ReturnType<typeof makeSessionInner>,
  logoutUrl: vi.fn(),
  redirects: [] as string[],
  requestOrigin: 'https://app.test',
}));

function makeSessionInner(data: Record<string, unknown>) {
  const session = {
    data,
    // h3's clearSession replaces the data object outright — model that, so a
    // read-after-clear genuinely observes nothing.
    clear: vi.fn(async () => {
      session.data = {};
    }),
  };
  return session;
}

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ cboxId: state.runtimeConfig }),
}));

vi.mock('h3', () => ({
  defineEventHandler: <T>(handler: T): T => handler,
  getRequestURL: () => new URL(`${state.requestOrigin}/auth/sign-out`),
  sendRedirect: async (_event: unknown, url: string) => {
    state.redirects.push(url);
    return url;
  },
  useSession: async () => state.session,
}));

vi.mock('../src/runtime/server/utils/client', () => ({
  getCboxClient: () => ({ logoutUrl: state.logoutUrl }),
  cboxSessionConfig: () => ({ password: 'x'.repeat(32), name: 'cbox_id' }),
}));

const handler = (await import('../src/runtime/server/routes/sign-out.get')).default as (
  event: unknown,
) => Promise<unknown>;

function makeSession(data: Record<string, unknown>) {
  state.session = makeSessionInner(data);
  return state.session;
}

beforeEach(() => {
  state.runtimeConfig = {
    issuer: 'https://id.test',
    clientId: 'client_123',
    clientSecret: '',
    redirectUri: 'https://app.test/auth/callback',
    postLogoutRedirectUri: '',
    sessionPassword: 'x'.repeat(32),
  };
  state.requestOrigin = 'https://app.test';
  state.redirects = [];
  state.logoutUrl = vi.fn(async () => 'https://id.test/logout');
  makeSession({});
});

describe('/auth/sign-out', () => {
  it('sends the id_token read BEFORE the session was cleared as the hint', async () => {
    const session = makeSession({ idToken: 'id-token-abc', user: { id: 'usr_1' } });

    await handler({});

    expect(state.logoutUrl).toHaveBeenCalledTimes(1);
    expect(state.logoutUrl.mock.calls[0][1]).toBe('id-token-abc');
    // And the read really did have to come first: the session is empty afterwards.
    expect(session.data).toEqual({});
  });

  it('clears the session', async () => {
    const session = makeSession({ idToken: 'id-token-abc', user: { id: 'usr_1' } });

    await handler({});

    expect(session.clear).toHaveBeenCalledTimes(1);
  });

  it('passes no hint when the session never held an id_token', async () => {
    makeSession({ user: { id: 'usr_1' } });

    await handler({});

    expect(state.logoutUrl.mock.calls[0][1]).toBeUndefined();
  });

  it('prefers the configured postLogoutRedirectUri over the request origin', async () => {
    state.runtimeConfig.postLogoutRedirectUri = 'https://app.test/goodbye';
    makeSession({ idToken: 'id-token-abc' });

    await handler({});

    expect(state.logoutUrl.mock.calls[0][0]).toBe('https://app.test/goodbye');
  });

  it('falls back to the request origin when postLogoutRedirectUri is empty', async () => {
    state.runtimeConfig.postLogoutRedirectUri = '';
    state.requestOrigin = 'https://other.test';
    makeSession({ idToken: 'id-token-abc' });

    await handler({});

    expect(state.logoutUrl.mock.calls[0][0]).toBe('https://other.test');
  });

  it('redirects to the logout URL the client built', async () => {
    makeSession({ idToken: 'id-token-abc' });
    state.logoutUrl = vi.fn(async () => 'https://id.test/logout?id_token_hint=id-token-abc');

    await handler({});

    expect(state.redirects).toEqual(['https://id.test/logout?id_token_hint=id-token-abc']);
  });

  it('redirects home when the client cannot build a logout URL', async () => {
    makeSession({ idToken: 'id-token-abc' });
    state.logoutUrl = vi.fn(async () => null);

    await handler({});

    expect(state.redirects).toEqual(['/']);
  });
});
