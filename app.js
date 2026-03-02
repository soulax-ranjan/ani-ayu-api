import serverless from 'serverless-http';
import { fastify } from './src/server.js';

export const handler = serverless(fastify);
