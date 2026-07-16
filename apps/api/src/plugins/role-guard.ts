import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@lefax/shared";

declare module "fastify" {
  interface FastifyInstance {
    requireRole(...roles: Role[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Every protected route composes [fastify.authenticate, fastify.requireRole(...)]
 * as onRequest hooks — CDC NFR/S-03: "Toutes les routes API vérifient le JWT
 * et le rôle côté serveur." Frontend role checks are UX-only, never trusted.
 */
export default fp(async function roleGuardPlugin(fastify: FastifyInstance) {
  fastify.decorate("requireRole", (...roles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user;
      if (!user || !roles.includes(user.role)) {
        reply.code(403).send({ error: "FORBIDDEN", message: "Accès refusé pour ce rôle." });
      }
    };
  });
});
