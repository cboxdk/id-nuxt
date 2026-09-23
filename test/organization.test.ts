import { AuthenticationError } from '@cboxdk/id-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-level tests for the sign-in family (plain, switch, picker, create) and the
 * callback's organization handling. h3 and the id-js client are stubbed; the session stub
 * merges `update()` the way h3 does, so what a route leaves behind is what the next
 * request sees.
 */

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  session: { data: {} as Record<string, unknown> },
  redirects: [] as string[],
  createAuthorizationRequest: vi.fn(),
  authenticate: vi.fn(),
}));

vi.mock('#imports', () => ({ useRuntimeConfig: () => ({ cboxId: {} }) }));

vi.mock('h3', () => ({
  defineEventHandler: <T>(handler: T): T => handler,
  getQuery: () => state.query,
  createError: (input: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(input.statusMessage), input),
  sendRedirect: async (_event: unknown, url: string) => {
    state.redirects.push(url);
    return url;
  },
  useSession: async () => ({
    get data() {
      return state.session.data;
    },
    update: async (patch: Record<string, unknown>) => {
      state.session.data = { ...state.session.data, ...patch };
    },
  }),
}));

vi.mock('../src/runtime/server/utils/client', () => ({
  getCboxClient: () => ({
    createAuthorizationRequest: state.createAuthorizationRequest,
    authenticate: state.authenticate,
  }),
  cboxSessionConfig: () => ({ password: 'x'.repeat(32), name: 'cbox_id' }),
}));

type Handler = (event: unknown) => Promise<unknown>;
const signIn = (await import('../src/runtime/server/routes/sign-in.get')).default as Handler;
const switchOrganization = (await import('../src/runtime/server/routes/switch-organization.get')).default as Handler;
const selectOrganization = (await import('../src/runtime/server/routes/select-organization.get')).default as Handler;
const createOrganization = (await import('../src/runtime/server/routes/create-organization.get')).default as Handler;
const callback = (await import('../src/runtime/server/routes/callback.get')).default as Handler;

const acme = { id: 'usr_1', email: 'ada@acme.test', name: 'Ada', organizationId: 'org-acme' };

beforeEach(() => {
  state.query = {};
  state.session = { data: {} };
  state.redirects = [];
  state.createAuthorizationRequest = vi.fn(async (options: { organization?: string } = {}) => ({
    url: 'https://id.test/oauth/authorize?…',
    state: 'st',
    codeVerifier: 'cv',
    nonce: 'nn',
    ...(options.organization !== undefined ? { organization: options.organization } : {}),
  }));
  state.authenticate = vi.fn();
});

describe('starting a sign-in', () => {
  it('stashes PKCE, state and nonce, and redirects to Cbox ID', async () => {
    await signIn({});

    expect(state.session.data).toMatchObject({ state: 'st', codeVerifier: 'cv', nonce: 'nn', redirectTo: '/' });
    expect(state.redirects).toEqual(['https://id.test/oauth/authorize?…']);
  });

  it('keeps a same-site redirect', async () => {
    state.query = { redirect: '/billing?tab=invoices' };
    await signIn({});

    expect(state.session.data.redirectTo).toBe('/billing?tab=invoices');
  });

  it.each(['https://evil.test/', '//evil.test/', '/\\evil.test', 'javascript:alert(1)', ''])(
    'refuses %j as a post-sign-in destination (open redirect)',
    async (redirect) => {
      state.query = { redirect };
      await signIn({});

      expect(state.session.data.redirectTo).toBe('/');
    },
  );

  it('clears a binding an abandoned switch left behind', async () => {
    state.session.data = { user: acme, organization: 'org-globex' };
    await signIn({});

    expect(state.createAuthorizationRequest).toHaveBeenCalledWith({});
    expect(state.session.data.organization).toBeUndefined();
  });
});

describe('switching organization', () => {
  it('starts a sign-in bound to ?org and remembers the binding for the callback', async () => {
    state.query = { org: 'org-globex', redirect: '/dashboard' };
    await switchOrganization({});

    expect(state.createAuthorizationRequest).toHaveBeenCalledWith({ organization: 'org-globex' });
    expect(state.session.data).toMatchObject({ organization: 'org-globex', redirectTo: '/dashboard' });
  });

  it('refuses a switch without an organization', async () => {
    await expect(switchOrganization({})).rejects.toMatchObject({
      statusCode: 400,
      message: 'Missing ?org=<organization id> to switch to.',
    });
    expect(state.createAuthorizationRequest).not.toHaveBeenCalled();
  });

  it('opens the hosted picker with the current organization preselected', async () => {
    state.session.data = { user: { ...acme, organization: { id: 'org-acme', name: 'Acme', role: 'owner' } } };
    await selectOrganization({});

    expect(state.createAuthorizationRequest).toHaveBeenCalledWith({
      prompt: 'select_organization',
      organizationHint: 'org-acme',
    });
  });

  it('opens the hosted picker without a hint when signed out', async () => {
    await selectOrganization({});

    expect(state.createAuthorizationRequest).toHaveBeenCalledWith({ prompt: 'select_organization' });
  });

  it('starts the hosted create step', async () => {
    await createOrganization({});

    expect(state.createAuthorizationRequest).toHaveBeenCalledWith({ prompt: 'create_organization' });
  });
});

describe('the callback', () => {
  const signedIn = {
    id: 'usr_1',
    email: 'ada@acme.test',
    name: 'Ada',
    organizationId: 'org-globex',
    organization: { id: 'org-globex', name: 'Globex', role: 'admin' },
    actor: null,
    accessToken: 'at',
    refreshToken: 'rt',
    idToken: 'it',
    expiresIn: 3600,
  };

  it('hands id-js the organization the sign-in was bound to', async () => {
    state.session.data = { state: 'st', codeVerifier: 'cv', nonce: 'nn', organization: 'org-globex', redirectTo: '/' };
    state.query = { code: 'c', state: 'st' };
    state.authenticate = vi.fn(async () => signedIn);

    await callback({});

    expect(state.authenticate.mock.calls[0][0].stored).toEqual({
      state: 'st',
      codeVerifier: 'cv',
      nonce: 'nn',
      organization: 'org-globex',
    });
  });

  it('stores the organization, its role and no actor, and clears the binding', async () => {
    state.session.data = { state: 'st', codeVerifier: 'cv', nonce: 'nn', organization: 'org-globex', redirectTo: '/app' };
    state.query = { code: 'c', state: 'st' };
    state.authenticate = vi.fn(async () => signedIn);

    await callback({});

    expect(state.session.data.user).toEqual({
      id: 'usr_1',
      email: 'ada@acme.test',
      name: 'Ada',
      organizationId: 'org-globex',
      organization: { id: 'org-globex', name: 'Globex', role: 'admin' },
      actor: null,
    });
    expect(state.session.data.organization).toBeUndefined();
    expect(state.redirects).toEqual(['/app']);
  });

  it('stores only the actor subject of a support session, unreadable ones included', async () => {
    state.session.data = { state: 'st', codeVerifier: 'cv', nonce: 'nn' };
    state.authenticate = vi.fn(async () => ({
      ...signedIn,
      actor: { sub: null, actor: { sub: 'svc-1', actor: null } },
    }));

    await callback({});

    expect((state.session.data.user as { actor: unknown }).actor).toEqual({ sub: null });
  });

  it('sends a refused switch back where it came from, still signed in to the old organization', async () => {
    const old = { ...acme, organization: { id: 'org-acme', name: 'Acme', role: 'owner' } };
    state.session.data = {
      user: old,
      accessToken: 'old-at',
      state: 'st',
      codeVerifier: 'cv',
      nonce: 'nn',
      organization: 'org-globex',
      redirectTo: '/dashboard?tab=1',
    };
    state.query = { error: 'access_denied', state: 'st' };
    state.authenticate = vi.fn(async () => {
      throw new AuthenticationError('Cbox ID returned an error: access_denied', 'access_denied');
    });

    await callback({});

    expect(state.redirects).toEqual(['/dashboard?tab=1&cbox_id_error=organization_access_denied']);
    expect(state.session.data).toMatchObject({ user: old, accessToken: 'old-at' });
    expect(state.session.data.organization).toBeUndefined();
    expect(state.session.data.state).toBeUndefined();
  });

  it('does not swallow access_denied on a sign-in that was not a switch', async () => {
    // Signed in already, so only the missing binding tells this apart from a switch.
    state.session.data = { user: acme, state: 'st', codeVerifier: 'cv', nonce: 'nn' };
    state.authenticate = vi.fn(async () => {
      throw new AuthenticationError('Cbox ID returned an error: access_denied', 'access_denied');
    });

    await expect(callback({})).rejects.toThrow('Cbox ID returned an error: access_denied');
    expect(state.redirects).toEqual([]);
  });

  it('does not swallow a switch that landed in the wrong organization', async () => {
    state.session.data = { user: acme, state: 'st', codeVerifier: 'cv', nonce: 'nn', organization: 'org-globex' };
    state.authenticate = vi.fn(async () => {
      throw new AuthenticationError('The sign-in was bound to organization org-globex, but the tokens are for org-acme.');
    });

    await expect(callback({})).rejects.toThrow('The sign-in was bound to organization org-globex');
    expect(state.session.data.user).toEqual(acme);
  });

  it('never follows a stored redirect off the site', async () => {
    state.session.data = { state: 'st', codeVerifier: 'cv', nonce: 'nn', redirectTo: '//evil.test' };
    state.authenticate = vi.fn(async () => signedIn);

    await callback({});

    expect(state.redirects).toEqual(['/']);
  });
});
