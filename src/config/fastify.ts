import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

export function buildFastify() {
  const fastify = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();
  fastify.register(fastifyWebsocket);
  return fastify;
}
