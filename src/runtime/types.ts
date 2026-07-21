/** The signed-in user we keep in the session and expose via useCboxUser(). */
export interface CboxSessionUser {
  id: string;
  email: string | null;
  name: string | null;
  organizationId: string | null;
}

/** The shape of our sealed session. */
export interface CboxSessionData {
  state?: string;
  codeVerifier?: string;
  nonce?: string;
  redirectTo?: string;
  user?: CboxSessionUser;
  /** The current access token, and the refresh token used to renew it. */
  accessToken?: string;
  refreshToken?: string;
  /** Absolute epoch-seconds expiry of the access token, for the refresh-on-read check. */
  expiresAt?: number;
}

/** The private runtime config this module reads server-side. */
export interface CboxRuntimeConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountPath?: string;
  scopes?: string[];
  sessionPassword: string;
}
