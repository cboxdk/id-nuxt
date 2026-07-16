import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit-test the module's wiring without booting a Nuxt server: mock `@nuxt/kit` so
 * `defineNuxtModule` returns the raw definition and the `addX` helpers record their
 * calls, then run `setup` against a minimal Nuxt stub and assert what got registered.
 */

interface ServerHandler {
  route?: string;
  method?: string;
  handler: string;
}
interface Component {
  name: string;
  export: string;
  filePath: string;
  mode?: string;
}

const calls = {
  serverHandlers: [] as ServerHandler[],
  plugins: [] as string[],
  importsDirs: [] as string[],
  components: [] as Component[],
};

vi.mock('@nuxt/kit', () => ({
  defineNuxtModule: <T>(definition: T): T => definition,
  createResolver: () => ({ resolve: (path: string) => path }),
  addServerHandler: (h: ServerHandler) => calls.serverHandlers.push(h),
  addPlugin: (p: string) => calls.plugins.push(p),
  addImportsDir: (d: string) => calls.importsDirs.push(d),
  addComponent: (c: Component) => calls.components.push(c),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mod = (await import('../src/module')).default as any;

function makeNuxtStub() {
  return {
    options: {
      runtimeConfig: { public: {} as Record<string, unknown> } as Record<string, unknown>,
      build: { transpile: [] as unknown[] },
    },
  };
}

function run(overrides: Record<string, unknown> = {}) {
  const options = { ...mod.defaults, ...overrides };
  const nuxt = makeNuxtStub();
  mod.setup(options, nuxt);
  return { options, nuxt };
}

beforeEach(() => {
  calls.serverHandlers = [];
  calls.plugins = [];
  calls.importsDirs = [];
  calls.components = [];
});

describe('module meta & defaults', () => {
  it('registers under the cboxId config key', () => {
    expect(mod.meta.configKey).toBe('cboxId');
    expect(mod.meta.name).toBe('@cboxdk/id-nuxt');
  });

  it('ships sensible route defaults', () => {
    expect(mod.defaults).toMatchObject({
      loginPath: '/auth/sign-in',
      callbackPath: '/auth/callback',
      logoutPath: '/auth/sign-out',
      profilePath: '/auth/account',
      components: true,
    });
  });
});

describe('setup wiring', () => {
  it('registers the auth server routes plus the user endpoint', () => {
    run();
    const routes = calls.serverHandlers.map((h) => h.route);
    expect(routes).toEqual(
      expect.arrayContaining([
        '/auth/sign-in',
        '/auth/callback',
        '/auth/sign-out',
        '/auth/account',
        '/api/_cbox/user',
      ]),
    );
    expect(calls.serverHandlers).toHaveLength(5);
  });

  it('adds the hydration plugin and the composables auto-import dir', () => {
    run();
    expect(calls.plugins).toHaveLength(1);
    expect(calls.importsDirs).toHaveLength(1);
  });

  it('registers the id-vue widget components from @cboxdk/id-vue', () => {
    run();
    expect(calls.components).toHaveLength(6);
    expect(calls.components.every((c) => c.filePath === '@cboxdk/id-vue')).toBe(true);
    expect(calls.components.map((c) => c.name)).toEqual(
      expect.arrayContaining(['CboxUserButton', 'CboxIdProvider', 'CboxSignInButton']),
    );
  });

  it('can opt out of component registration', () => {
    run({ components: false });
    expect(calls.components).toHaveLength(0);
    // Routes and plugin are still wired.
    expect(calls.serverHandlers).toHaveLength(5);
    expect(calls.plugins).toHaveLength(1);
  });

  it('exposes flow paths and appearance in public runtime config', () => {
    const { nuxt } = run({ appearance: { accent: '#0ea5e9' } });
    const pub = (nuxt.options.runtimeConfig.public as Record<string, unknown>).cboxId as Record<
      string,
      unknown
    >;
    expect(pub).toMatchObject({
      loginPath: '/auth/sign-in',
      logoutPath: '/auth/sign-out',
      profilePath: '/auth/account',
      appearance: { accent: '#0ea5e9' },
    });
  });

  it('keeps the client secret out of the public runtime config', () => {
    const { nuxt } = run({ clientSecret: 'super-secret' });
    const pub = JSON.stringify((nuxt.options.runtimeConfig.public as Record<string, unknown>).cboxId);
    expect(pub).not.toContain('super-secret');
    const priv = nuxt.options.runtimeConfig.cboxId as Record<string, unknown>;
    expect(priv.clientSecret).toBe('super-secret');
  });
});
