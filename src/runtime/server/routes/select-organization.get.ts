import { defineEventHandler, useSession } from 'h3';
import type { CboxSessionData } from '../../types';
import { cboxSessionConfig } from '../utils/client';
import { startAuthorization } from '../utils/authorize';

/**
 * Cbox ID's hosted organization picker (`prompt=select_organization`), with the current
 * organization preselected. What the switcher links to: it knows every membership, where
 * this module keeps none in the session cookie.
 */
export default defineEventHandler(async (event) => {
  const session = await useSession<CboxSessionData>(event, cboxSessionConfig(event));
  const current = session.data.user?.organization?.id ?? session.data.user?.organizationId ?? undefined;

  return startAuthorization(event, {
    prompt: 'select_organization',
    ...(current ? { organizationHint: current } : {}),
  });
});
