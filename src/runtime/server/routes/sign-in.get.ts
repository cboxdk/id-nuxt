import { defineEventHandler } from 'h3';
import { startAuthorization } from '../utils/authorize';

/** Start login: create the authorization request, stash PKCE/state/nonce, redirect. */
export default defineEventHandler((event) => startAuthorization(event));
