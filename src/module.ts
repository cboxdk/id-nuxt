import {
  addImportsDir,
  addPlugin,
  addServerHandler,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit';
import { defu } from 'defu';

export interface ModuleOptions {
  /** Base URL of the Cbox ID instance (or set CBOX_ID_ISSUER). */
  issuer?: string;
  /** Your OAuth client id (or set CBOX_ID_CLIENT_ID). */
  clientId?: string;
  /** Your client secret (or set CBOX_ID_CLIENT_SECRET). */
  clientSecret?: string;
  /** Your callback URL, registered on the client (or set CBOX_ID_REDIRECT_URI). */
  redirectUri?: string;
  /** The instance's hosted account path. Defaults to /settings. */
  accountPath?: string;
  /** Scopes requested at login. */
  scopes?: string[];
  /** Route that starts login. Defaults to /auth/sign-in. */
  loginPath?: string;
  /** Route that handles the callback. Defaults to /auth/callback. */
  callbackPath?: string;
  /** Route that signs out. Defaults to /auth/sign-out. */
  logoutPath?: string;
}

/**
 * Nuxt module for Cbox ID. Registers the sign-in / callback / sign-out routes and a
 * `useCboxUser()` composable, all backed by @cboxdk/id-js. Configure it under the
 * `cboxId` key or via environment variables.
 */
export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@cboxdk/id-nuxt',
    configKey: 'cboxId',
    compatibility: { nuxt: '>=3.0.0' },
  },
  defaults: {
    accountPath: '/settings',
    loginPath: '/auth/sign-in',
    callbackPath: '/auth/callback',
    logoutPath: '/auth/sign-out',
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
        accountPath: options.accountPath,
      },
    );

    nuxt.options.build.transpile.push(resolver.resolve('./runtime'));

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
      route: '/api/_cbox/user',
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/user.get'),
    });

    addImportsDir(resolver.resolve('./runtime/composables'));
    addPlugin(resolver.resolve('./runtime/plugin'));
  },
});
