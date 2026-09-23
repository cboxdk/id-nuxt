# Changelog

All notable changes to `@cboxdk/id-nuxt` are recorded here. Earlier releases are described
in their [GitHub releases](https://github.com/cboxdk/id-nuxt/releases).

## Unreleased

Organization selection and support sessions. **Depends on `@cboxdk/id-js` ^0.17.0 and
`@cboxdk/id-vue` ^0.3.0** — release those first — and needs a Cbox ID instance that
supports organization selection (laravel-id 1.19).

### Added

- Routes `GET /auth/switch-organization?org=<id>` (a sign-in bound to that organization),
  `GET /auth/select-organization` (the hosted picker, the current organization
  preselected) and `GET /auth/create-organization` (the hosted "create a team" step), with
  the options `switchOrganizationPath`, `selectOrganizationPath` and
  `createOrganizationPath`.
- The widgets' `urls.switchOrganization`, `urls.selectOrganization` and
  `urls.createOrganization` are wired to those routes app-wide.
- `<CboxOrganizationSwitcher>` and `<CboxSupportSessionBanner>` registered globally, and
  `useOrganization()` / `useSupportSession()` auto-imported, from `@cboxdk/id-vue`.
- `useCboxUser()` carries `organization` (`{ id, name, role }` from `org`, `org_name`,
  `org_role`) and `actor` (`{ sub }` in a support session, from `act`).
- A refused switch (`access_denied` on a sign-in bound to an organization, while already
  signed in) returns to the page it started from with the old session intact and
  `?cbox_id_error=organization_access_denied`, instead of an error page.

### Changed

- The callback hands id-js the organization the sign-in was bound to, so tokens for any
  other organization are refused. Every sign-in route resets that binding, so an abandoned
  switch cannot bind the next plain sign-in.
- `@cboxdk/id-js` `^0.7.0` → `^0.17.0` and `@cboxdk/id-vue` `^0.2.0` → `^0.3.0`.
- The module does not keep a person's `organizations` list in the session: the cookie
  already carries the tokens, a browser drops one over 4 kB without a word, and the list
  has no upper bound. The switcher links to the hosted picker instead.

### Fixed

- `?redirect=` on the sign-in route was followed as given, so
  `/auth/sign-in?redirect=https://evil.test` sent a freshly signed-in person to another
  site. Only a path on the same site is kept now (`//host` and `/\host` included in what is
  refused); anything else goes to `/`.
- The README and the `accountPath` option's doc comment said the default was `/settings`;
  it has been `/account` since the organization-admin redirect was found to drop
  `return_to`.
