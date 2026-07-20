import {
  sendOtpRequestSchema,
  staffLoginRequestSchema,
  verifyOtpRequestSchema,
  type AuthErrorCode,
} from "@lefax/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { REFRESH_COOKIE_NAME } from "../../plugins/jwt.js";
import { createSmsProvider } from "../../providers/sms.js";
import { AccountDisabledError, AuthService } from "./auth.service.js";
import { OtpRateLimitError, OtpService, OtpVerifyError } from "./otp.service.js";

const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days, matches JWT_REFRESH_TTL default

function setRefreshCookie(reply: FastifyReply, refreshToken: string, secure: boolean) {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
}

function errorStatus(code: AuthErrorCode): number {
  switch (code) {
    case "RATE_LIMITED":
    case "OTP_RESEND_COOLDOWN":
    case "OTP_LOCKED":
      return 429;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    default:
      return 400;
  }
}

export default async function authRoutes(fastify: FastifyInstance) {
  const sms = createSmsProvider(fastify.config);
  const otpService = new OtpService(fastify.supabase, sms);
  const authService = new AuthService(fastify, fastify.supabase);
  const isProd = fastify.config.NODE_ENV === "production";

  fastify.post("/auth/send-otp", async (request, reply) => {
    const body = sendOtpRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "OTP_INVALID", message: body.error.issues[0]?.message });
    }
    try {
      const result = await otpService.sendOtp(body.data.phone);
      return reply.send(result);
    } catch (err) {
      if (err instanceof OtpRateLimitError) {
        return reply.code(errorStatus(err.code)).send({ error: err.code, message: "Trop de tentatives, réessayez plus tard." });
      }
      request.log.error(err);
      return reply.code(500).send({ error: "INTERNAL", message: "Erreur serveur." });
    }
  });

  fastify.post("/auth/verify-otp", async (request, reply) => {
    const body = verifyOtpRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "OTP_INVALID", message: body.error.issues[0]?.message });
    }
    try {
      await otpService.verifyOtp(body.data.phone, body.data.code);
      const { user, isNewUser } = await authService.findOrCreateStudentByPhone(body.data.phone, body.data.firstName);
      const { accessToken, refreshToken } = await authService.issueTokens(user);
      setRefreshCookie(reply, refreshToken, isProd);
      return reply.send({ accessToken, user, isNewUser });
    } catch (err) {
      if (err instanceof OtpVerifyError || err instanceof OtpRateLimitError) {
        return reply.code(errorStatus(err.code)).send({ error: err.code, message: "Code invalide ou expiré." });
      }
      if (err instanceof AccountDisabledError) {
        return reply.code(403).send({ error: "ACCOUNT_DISABLED", message: "Votre compte a été désactivé." });
      }
      request.log.error(err);
      return reply.code(500).send({ error: "INTERNAL", message: "Erreur serveur." });
    }
  });

  fastify.post("/auth/staff-login", async (request, reply) => {
    const body = staffLoginRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "INVALID_CREDENTIALS", message: "Email ou mot de passe invalide." });
    }
    try {
      const user = await authService.findStaffByEmail(body.data.email, body.data.password);
      if (!user) {
        return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Email ou mot de passe invalide." });
      }
      const { accessToken, refreshToken } = await authService.issueTokens(user);
      setRefreshCookie(reply, refreshToken, isProd);
      return reply.send({ accessToken, user });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "INTERNAL", message: "Erreur serveur." });
    }
  });

  fastify.post("/auth/refresh", async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Session expirée." });

    try {
      const { accessToken, refreshToken } = await authService.rotateRefreshToken(token);
      setRefreshCookie(reply, refreshToken, isProd);
      return reply.send({ accessToken });
    } catch {
      reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth" });
      return reply.code(401).send({ error: "UNAUTHORIZED", message: "Session expirée." });
    }
  });

  fastify.get("/auth/me", { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const user = await authService.getUserById(request.user.sub);
    if (!user) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Session invalide." });
    return reply.send({ user });
  });

  fastify.post("/auth/logout", { onRequest: [fastify.authenticate] }, async (request, reply) => {
    await authService.revokeRefreshToken(request.user.sub);
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth" });
    return reply.send({ success: true });
  });
}
