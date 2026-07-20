import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jsonwebtoken from "jsonwebtoken";
import type { Role } from "@lefax/shared";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export interface RefreshTokenPayload extends AccessTokenPayload {
  jti: string;
}

declare module "fastify" {
  interface FastifyInstance {
    refreshJwt: {
      sign(payload: AccessTokenPayload, jti: string): string;
      verify(token: string): RefreshTokenPayload;
    };
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

export const REFRESH_COOKIE_NAME = "lefax_refresh";

export default fp(async function jwtPlugin(fastify: FastifyInstance) {
  await fastify.register(cookie);

  // Access tokens: verified via fastify.authenticate on protected routes,
  // NEVER persisted client-side beyond in-memory JS (NFR-05).
  await fastify.register(jwt, {
    secret: fastify.config.JWT_ACCESS_SECRET,
    sign: { expiresIn: fastify.config.JWT_ACCESS_TTL },
  });

  // Refresh tokens: separate secret, delivered only as an httpOnly cookie.
  // Signed with `jsonwebtoken` directly (rather than a second @fastify/jwt
  // instance) to keep the two secrets unambiguously separate.
  const refreshSecret = fastify.config.JWT_REFRESH_SECRET;
  const refreshTtl = fastify.config.JWT_REFRESH_TTL;
  fastify.decorate("refreshJwt", {
    sign(payload: AccessTokenPayload, jti: string) {
      return jsonwebtoken.sign(payload, refreshSecret, {
        expiresIn: refreshTtl as jsonwebtoken.SignOptions["expiresIn"],
        jwtid: jti,
      });
    },
    verify(token: string) {
      return jsonwebtoken.verify(token, refreshSecret) as RefreshTokenPayload;
    },
  });

  fastify.decorate("authenticate", async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "Token invalide ou expiré." });
    }
  });
});
