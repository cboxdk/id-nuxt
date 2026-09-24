import { defineEventHandler } from 'h3';
import { startAuthorization } from '../utils/authorize';

/**
 * Cbox ID's hosted "create a team" step (`prompt=create_organization`): the person creates
 * an organization, becomes its owner, and the sign-in comes back bound to it.
 */
export default defineEventHandler((event) => startAuthorization(event, { prompt: 'create_organization' }));
