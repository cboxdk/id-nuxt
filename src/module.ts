import {
  addComponent,
  addImports,
  addImportsDir,
  addPlugin,
  addServerHandler,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit';
import { defu } from 'defu';
import type { CboxWidgetAppearance } from '@cboxdk/id-vue';

export interface ModuleOptions {
  /** Base URL of the Cbox ID instance (or set CBOX_ID_ISSUER). */
  issuer?: string;
  /** Your OAuth client id (or set CBOX_ID_CLIENT_ID). */
  clientId?: string;
  /** Your client secret (or set CBOX_ID_CLIENT_SECRET). */
  clientSecret?: string;
  /** Your callback URL, registered on the client (or set CBOX_ID_REDIRECT_URI). */
  redirectUri?: string;
  /**
   * Where Cbox ID returns people after sign-out (or set CBOX_ID_POST_LOGOUT_REDIRECT_URI).
   * It must be registered on the client as a post-logout redirect URI and match it
   * exactly — otherwise Cbox ID drops it and the browser stops on its signed-out
   * page. Defaults to the request origin, which only works if that exact string is
   * the registered one.
   */
  postLogoutRedirectUri?: string;
  /** The instance's hosted account path. Defaults to /account. */
  accountPath?: string;
  /** Scopes requested at login. */
  scopes?: string[];
  /** Route that starts login. Defaults to /auth/sign-in. */
  loginPath?: string;
  /** Route that handles the callback. Defaults to /auth/callback. */
  callbackPath?: string;
  /** Route that signs out. Defaults to /auth/sign-out. */
  logoutPath?: string;
  /**
   * Route that redirects to the instance's hosted account/profile page (what the
   * widgets' "Manage account" links point at). Defaults to /auth/account.
   */
  profilePath?: string;
  /**
   * Route that switches organization: `?org=<id>` starts a sign-in bound to it
   * (`organization=<id>`). Powers the widgets' `urls.switchOrganization`. Defaults to
   * /auth/switch-organization.
   */
  switchOrganizationPath?: string;
  /**
   * Route that opens Cbox ID's hosted organization picker (`prompt=select_organization`),
   * the current organization preselected. Defaults to /auth/select-organization.
   */
  selectOrganizationPath?: string;
  /**
   * Route that starts Cbox ID's hosted "create a team" step (`prompt=create_organization`).
   * Defaults to /auth/create-organization.
   */
  createOrganizationPath?: string;
  /** Theming applied to the auto-provided widgets. */
  appearance?: CboxWidgetAppearance;
  /**
   * Auto-register the `@cboxdk/id-vue` widget components (`<CboxUserButton>` etc.)
   * as global components and wire their context app-wide. Defaults to `true`.
   */
  components?: boolean;
}

/** The `@cboxdk/id-vue` widget components this module registers globally. */
const WIDGET_COMPONENTS = [
  'CboxIdProvider',
  'CboxSignInButton',
  'CboxSignOutButton',
  'CboxUserButton',
  'CboxUserProfileCard',
  'CboxOrganizationBadge',
  'CboxOrganizationSwitcher',
  'CboxSupportSessionBanner',
] as const;

/** The `@cboxdk/id-vue` composables this module auto-imports alongside the components. */
const WIDGET_COMPOSABLES = ['useOrganization', 'useSupportSession'] as const;

/**
 * Nuxt module for Cbox ID. Wires the whole embeddable-identity story into a Nuxt app:
 *
 * - server routes for sign-in / callback / sign-out / hosted-profile redirect and for
 *   organization switching (switch, hosted picker, hosted create step), backed by
 *   `@cboxdk/id-js` and a sealed h3 session;
 * - a `useCboxUser()` composable, SSR-hydrated from that session;
 * - the `@cboxdk/id-vue` widgets (`<CboxUserButton>` and friends) as global,
 *   auto-imported components, provided their context app-wide so they work with no
 *   `<CboxIdProvider>` boilerplate — SSR-safe, stylesheet injected via `useHead`.
 *
 * Configure it under the `cboxId` key or via environment variables.
 */
export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@cboxdk/id-nuxt',
    configKey: 'cboxId',
    compatibility: { nuxt: '>=3.0.0' },
  },
  defaults: {
    // The self-service page. `/settings` is the organization-admin one: it redirects a
    // non-admin to `/account` and drops `return_to`, so the link worked for admins and
    // silently lost the return path for everyone else.
    accountPath: '/account',
    loginPath: '/auth/sign-in',
    callbackPath: '/auth/callback',
    logoutPath: '/auth/sign-out',
    profilePath: '/auth/account',
    switchOrganizationPath: '/auth/switch-organization',
    selectOrganizationPath: '/auth/select-organization',
    createOrganizationPath: '/auth/create-organization',
    components: true,
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    nuxt.options.runtimeConfig.cboxId = defu(
      nuxt.options.runtimeConfig.cboxId as Record<string, unknown>,
      {
        issuer: options.issuer ?? process.env.CBOX_ID_ISSUER ?? '',
        clientId: options.clientId ?? process.env.CBOX_ID_CLIENT_ID ?? '',
        clientSecret: options.clientSecret ?? process.env.CBOX_ID_CLIENT_SECRET ?? '',
        redirectUri: options.redirectUri ?? process.env.CBOX_ID_REDIRECT_URI ?? '',
        postLogoutRedirectUri:
          options.postLogoutRedirectUri ?? process.env.CBOX_ID_POST_LOGOUT_REDIRECT_URI ?? '',
        accountPath: options.accountPath,
        scopes: options.scopes,
        sessionPassword: process.env.CBOX_ID_SESSION_PASSWORD ?? '',
      },
    );

    nuxt.options.runtimeConfig.public.cboxId = defu(
      nuxt.options.runtimeConfig.public.cboxId as Record<string, unknown>,
      {
        loginPath: options.loginPath,
        logoutPath: options.logoutPath,
        profilePath: options.profilePath,
        switchOrganizationPath: options.switchOrganizationPath,
        selectOrganizationPath: options.selectOrganizationPath,
        createOrganizationPath: options.createOrganizationPath,
        appearance: options.appearance ?? {},
      },
    );

    nuxt.options.build.transpile.push(resolver.resolve('./runtime'), '@cboxdk/id-vue');

    addServerHandler({
      route: options.loginPath,
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/sign-in.get'),
    });
    addServerHandler({
      route: options.callbackPath,
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/callback.get'),
    });
    addServerHandler({
      route: options.logoutPath,
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/sign-out.get'),
    });
    addServerHandler({
      route: options.profilePath,
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/account.get'),
    });
    addServerHandler({
      route: options.switchOrganizationPath,
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/switch-organization.get'),
    });
    addServerHandler({
      route: options.selectOrganizationPath,
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/select-organization.get'),
    });
    addServerHandler({
      route: options.createOrganizationPath,
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/create-organization.get'),
    });
    addServerHandler({
      route: '/api/_cbox/user',
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/user.get'),
    });

    addImportsDir(resolver.resolve('./runtime/composables'));
    addPlugin(resolver.resolve('./runtime/plugin'));

    if (options.components) {
      for (const name of WIDGET_COMPONENTS) {
        addComponent({ name, export: name, filePath: '@cboxdk/id-vue', mode: 'all' });
      }
      addImports(WIDGET_COMPOSABLES.map((name) => ({ name, from: '@cboxdk/id-vue' })));
    }
  },
});
