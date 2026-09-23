import { createError, defineEventHandler, getQuery } from 'h3';
import { startAuthorization } from '../utils/authorize';

/**
 * Switch the signed-in person to another organization: `?org=<id>` starts a new sign-in
 * bound to it (`organization=<id>`). Cbox ID already holds the person's session, so this is
 * normally a redirect there and straight back. The callback replaces the session with the
 * new organization's tokens, role and permissions.
 */
export default defineEventHandler(async (event) => {
  const org = getQuery(event).org;

  if (typeof org !== 'string' || org === '') {
    throw createError({ statusCode: 400, statusMessage: 'Missing ?org=<organization id> to switch to.' });
  }

  return startAuthorization(event, { organization: org });
});
