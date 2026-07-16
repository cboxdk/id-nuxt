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

```bash
npm install @cboxdk/id-nuxt
```

## Configure

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@cboxdk/id-nuxt'],
  cboxId: {
    // or set CBOX_ID_ISSUER / CBOX_ID_CLIENT_ID / CBOX_ID_CLIENT_SECRET / CBOX_ID_REDIRECT_URI
    issuer: 'https://id.acme.com',
    clientId: process.env.CBOX_ID_CLIENT_ID,
    clientSecret: process.env.CBOX_ID_CLIENT_SECRET,
    redirectUri: 'https://app.acme.com/auth/callback',
  },
});
```

Set a session secret so the session cookie is sealed:

```dotenv
CBOX_ID_SESSION_PASSWORD=at-least-32-characters-of-random
```

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
