# @cboxdk/id-nuxt

Nuxt module for [Cbox ID](https://github.com/cboxdk/laravel-id). It wires the
[`@cboxdk/id-js`](https://github.com/cboxdk/id-js) OIDC client to your Nuxt app:
drop-in **sign-in / callback / sign-out** routes, a sealed session, and a
`useCboxUser()` composable — add authentication with one module entry.

Pair it with [`@cboxdk/id-vue`](https://github.com/cboxdk/id-vue) for the
`<CboxUserButton>` and other widgets.

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
| `GET /api/_cbox/user` | the current user as JSON (used internally) |

Link to them and read the user reactively anywhere:

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
| `accountPath` | `/settings` | hosted profile page path |
| `loginPath` / `callbackPath` / `logoutPath` | `/auth/*` | override the route paths |

## Scope

This module handles login, session and sign-out against a Cbox ID instance. Profile
management (password, MFA, passkeys) is hosted by the instance — link users to
`accountPath` there. SSO/SCIM/org administration are platform capabilities of
[`cboxdk/laravel-id`](https://github.com/cboxdk/laravel-id), not this module.

## License

MIT © Cbox.
