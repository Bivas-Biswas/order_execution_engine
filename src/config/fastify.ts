import cors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastifyWebsocket from '@fastify/websocket';
import Fastify from 'fastify';

export function buildFastify() {
  const fastify = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();
  fastify.register(fastifyWebsocket);
  fastify.register(cors, {
    origin: '*',
  });
  return fastify;
}
