import { CboxIdClient, type CboxIdConfig } from '@cboxdk/id-js';
import type { H3Event, SessionConfig } from 'h3';
import { useRuntimeConfig } from '#imports';
import type { CboxRuntimeConfig } from '../../types';

/** Build a CboxIdClient from the module's server runtime config. */
export function getCboxClient(event: H3Event): CboxIdClient {
  const cfg = useRuntimeConfig(event).cboxId as CboxRuntimeConfig;
  const config: CboxIdConfig = {
    issuer: cfg.issuer,
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
  };
  if (cfg.clientSecret) {
    config.clientSecret = cfg.clientSecret;
  }
  if (cfg.accountPath) {
    config.accountPath = cfg.accountPath;
  }
  if (cfg.scopes && cfg.scopes.length > 0) {
    config.scopes = cfg.scopes;
  }
  return new CboxIdClient(config);
}

/** The sealed-cookie session config (h3 useSession). */
export function cboxSessionConfig(event: H3Event): SessionConfig {
  const cfg = useRuntimeConfig(event).cboxId as CboxRuntimeConfig;
  return { password: cfg.sessionPassword, name: 'cbox_id' };
}
