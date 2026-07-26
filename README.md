# @cboxdk/id-nuxt

Nuxt module for [Cbox ID](https://github.com/cboxdk/laravel-id). It wires the
[`@cboxdk/id-js`](https://github.com/cboxdk/id-js) OIDC client to your Nuxt app:
drop-in **sign-in / callback / sign-out** routes, a sealed session, and a
`useCboxUser()` composable — add authentication with one module entry.

It also bundles the [`@cboxdk/id-vue`](https://github.com/cboxdk/id-vue) widgets
(`<CboxUserButton>` and friends) as **auto-imported, globally-provided** components:
no import, no `<CboxIdProvider>` wrapper. The module provides their context app-wide
from the session and injects the stylesheet through `useHead`, so they render
correctly during SSR.

## Install

> **Where do `issuer`, `clientId` and `redirectUri` come from?**
> Register an application in your environment console — see
> [Integrate your app](https://github.com/cboxdk/cbox-id/blob/main/docs/getting-started/integrate-your-app.md).

```bash
npm install @cboxdk/id-nuxt
```

## Configure

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@cboxdk/id-nuxt'],
  cboxId: {
    // or set CBOX_ID_ISSUER / CBOX_ID_CLIENT_ID / CBOX_ID_CLIENT_SECRET /
    // CBOX_ID_REDIRECT_URI / CBOX_ID_POST_LOGOUT_REDIRECT_URI
    issuer: 'https://id.acme.com',
    clientId: process.env.CBOX_ID_CLIENT_ID,
    clientSecret: process.env.CBOX_ID_CLIENT_SECRET,
    redirectUri: 'https://app.acme.com/auth/callback',
    postLogoutRedirectUri: 'https://app.acme.com/',
  },
});
```

Set a session secret so the session cookie is sealed:

```dotenv
CBOX_ID_SESSION_PASSWORD=at-least-32-characters-of-random
```

### Where sign-out returns people

`postLogoutRedirectUri` (env: `CBOX_ID_POST_LOGOUT_REDIRECT_URI`) is where Cbox ID
sends people after `GET /auth/sign-out`. **Set it.** Cbox ID matches the value against
the **Sign-out URIs** allow-list on the application in your environment console
**character for character** — scheme, host, port, path, and trailing slash all count,
and `https://app.acme.com` and `https://app.acme.com/` are two different entries. A
value that is not on the list is dropped and the user lands on a bare "you are signed
out" page on the instance.

Leave it unset and the module falls back to the bare request origin, which is almost
never the string an admin typed into the console — so the return trip silently stops
working. Configure the exact registered string instead.

Setting it also means sign-out no longer has to rely on the `id_token_hint`, the other
way OIDC lets a logout request identify the relying party. To send that hint the module
must keep the `id_token` in the sealed session cookie, and that costs room: a session
that is ~1.9 kB without it grows to ~3.5 kB with a typical 800-character `id_token`,
against a 4 kB per-cookie browser limit that h3's `useSession` does not chunk around.
Today's Cbox ID tokens fit, but the headroom is thin — a configured
`postLogoutRedirectUri` is the durable answer.

## Use

The module registers these routes for you:

| Route | Does |
|---|---|
| `GET /auth/sign-in` | starts login (accepts `?redirect=/where/next`) |
| `GET /auth/callback` | verifies the login and stores the session |
| `GET /auth/sign-out` | clears the session and logs out |
| `GET /auth/account` | redirects to the hosted profile page (accepts `?return_to=`) |
| `GET /api/_cbox/user` | the current user as JSON (used internally) |

### Widgets

Drop the widgets in anywhere — they're auto-imported and already wired to the
session, so this is the whole integration:

```vue
<template>
  <header>
    <!-- avatar + account menu when signed in, a sign-in button when not -->
    <CboxUserButton />
  </header>
</template>
```

Also available: `<CboxSignInButton>`, `<CboxSignOutButton>`, `<CboxUserProfileCard>`,
`<CboxOrganizationBadge>`, and `<CboxIdProvider>` (for a scoped override). Their
"Manage account" links point at `GET /auth/account`; "Sign out" at `logoutPath`.
Theme them with the `appearance` option (below). Set `components: false` to opt out
and wire `@cboxdk/id-vue` yourself.

### Composable

Or read the user reactively and build your own UI:

```vue
<script setup lang="ts">
const user = useCboxUser();
</script>

<template>
  <div v-if="user">
    Hi {{ user.name }} — <a href="/auth/sign-out">Sign out</a>
  </div>
  <a v-else href="/auth/sign-in">Sign in</a>
</template>
```

Protect a route with middleware:

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware(() => {
  const user = useCboxUser();
  if (!user.value) {
    return navigateTo('/auth/sign-in?redirect=' + encodeURIComponent(useRoute().fullPath));
  }
});
```

## Options

| Option | Default | Notes |
|---|---|---|
| `issuer` / `clientId` / `clientSecret` / `redirectUri` | from env | the Cbox ID connection |
| `postLogoutRedirectUri` | request origin | where sign-out returns people; must match a **Sign-out URI** registered on the application character for character ([details](#where-sign-out-returns-people)) |
| `scopes` | `openid profile email` | requested at login |
| `accountPath` | `/settings` | hosted profile page path on the instance |
| `loginPath` / `callbackPath` / `logoutPath` | `/auth/*` | override the route paths |
| `profilePath` | `/auth/account` | app route that redirects to the hosted profile |
| `appearance` | `{}` | widget theming (`accent`, `accentForeground`, `radius`, `fontFamily`) |
| `components` | `true` | auto-register the `@cboxdk/id-vue` widgets globally |

## Scope

This module handles login, session and sign-out against a Cbox ID instance. Profile
management (password, MFA, passkeys) is hosted by the instance — link users to
`accountPath` there. SSO/SCIM/org administration are platform capabilities of
[`cboxdk/laravel-id`](https://github.com/cboxdk/laravel-id), not this module.

## License

MIT © Cbox.
