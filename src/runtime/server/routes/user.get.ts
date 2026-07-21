import { defineEventHandler } from 'h3';
import type { CboxSessionUser } from '../../types';
import { resolveCboxUser } from '../utils/session';

/** The signed-in user, transparently refreshing the access token when it is near expiry. */
export default defineEventHandler((event): Promise<CboxSessionUser | null> => resolveCboxUser(event));
