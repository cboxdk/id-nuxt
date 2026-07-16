import { defineEventHandler, getQuery, getRequestURL, sendRedirect } from 'h3';
import { getCboxClient } from '../utils/client';

/**
 * Redirect to the instance's hosted account/profile page (self-service password,
 * MFA, passkeys, sessions). `return_to` is honoured so the page can link back; it
 * defaults to the app's origin.
 */
export default defineEventHandler((event) => {
  const client = getCboxClient(event);
  const returnTo = getQuery(event).return_to;
  const origin = getRequestURL(event).origin;
  return sendRedirect(event, client.profileUrl(typeof returnTo === 'string' ? returnTo : origin));
});
