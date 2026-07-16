import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export default fp(async function securityPlugin(fastify: FastifyInstance) {
  await fastify.register(helmet);

  await fastify.register(cors, {
    origin: fastify.config.CORS_ORIGINS,
    credentials: true,
  });

  // Per-route limits (e.g. OTP send: 3/10min/phone) are set with `config.rateLimit`
  // on individual routes; this is just the global fallback (NFR / S-11).
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
});
