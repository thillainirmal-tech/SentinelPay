/**
 * server.js — MSW Node server for Jest tests
 *
 * Sets up the MSW request-interception server.
 * Import and use in setupTests.js.
 *
 * Each test can override handlers for specific scenarios:
 *   server.use(errorHandlers.loginUnauthorized)
 */

import { setupServer } from 'msw/node';
import { handlers }    from './handlers';

export const server = setupServer(...handlers);
