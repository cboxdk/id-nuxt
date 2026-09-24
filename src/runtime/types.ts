/**
 * The signed-in user we keep in the session and expose via useCboxUser().
 *
 * Deliberately small: it lives in the sealed session cookie next to the tokens, and a
 * browser drops a cookie over 4 kB without a word — the next request then has no session
 * at all. So no `organizations` list (unbounded) and no claim set; the organization
 * switcher links to the hosted picker instead of drawing a list.
 */
export interface CboxSessionUser {
  id: string;
  email: string | null;
  name: string | null;
  organizationId: string | null;
  /**
   * The organization the session is bound to: `org`, `org_name` and the person's
   * membership tier there (`org_role`). Null when bound to none. Optional only because a
   * session sealed by an earlier version of this module does not have it.
   */
  organization?: CboxSessionOrganization | null;
  /**
   * Set when a member of staff is signed in as this person — a support session (the RFC
   * 8693 `act` claim). `sub` is null when the actor could not be read; it is still a
   * support session.
   */
  actor?: { sub: string | null } | null;
}

/** The organization a session is bound to. */
export interface CboxSessionOrganization {
  id: string;
  name: string | null;
  /** `owner`, `admin`, `developer`, `member` or `viewer`; null when unknown. */
  role: string | null;
}

/** The shape of our sealed session. */
export interface CboxSessionData {
  state?: string;
  codeVerifier?: string;
  nonce?: string;
  redirectTo?: string;
  /**
   * The organization an in-flight sign-in was bound to (`organization=<id>`), handed to
   * id-js at the callback so it refuses tokens for any other organization. Cleared by a
   * plain sign-in, so an abandoned switch cannot leak its binding into the next one.
   */
  organization?: string;
  user?: CboxSessionUser;
  /** The current access token, and the refresh token used to renew it. */
  accessToken?: string;
  refreshToken?: string;
  /** The id_token, kept so sign-out can send it as `id_token_hint`. */
  idToken?: string;
  /** Absolute epoch-seconds expiry of the access token, for the refresh-on-read check. */
  expiresAt?: number;
}

/** The private runtime config this module reads server-side. */
export interface CboxRuntimeConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Where Cbox ID returns people after sign-out. Must be registered on the client. */
  postLogoutRedirectUri?: string;
  accountPath?: string;
  scopes?: string[];
  sessionPassword: string;
}
