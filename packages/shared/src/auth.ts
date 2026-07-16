import { z } from "zod";
import { BRANCH_SLUGS } from "./branches.js";
import { ROLES } from "./roles.js";

/** +237 followed by exactly 9 digits (MTN or Orange), per CDC WEB-E01. */
export const cameroonPhoneSchema = z
  .string()
  .regex(/^\+237\d{9}$/, "Numéro invalide — format attendu : +237XXXXXXXXX");

export const sendOtpRequestSchema = z.object({
  phone: cameroonPhoneSchema,
});
export type SendOtpRequest = z.infer<typeof sendOtpRequestSchema>;

export const sendOtpResponseSchema = z.object({
  cooldownSeconds: z.number().int().positive(),
});
export type SendOtpResponse = z.infer<typeof sendOtpResponseSchema>;

export const verifyOtpRequestSchema = z.object({
  phone: cameroonPhoneSchema,
  code: z.string().length(6),
  // Only applied when this call creates a brand-new account (signup) — an
  // existing student's name is never overwritten on a plain login.
  firstName: z.string().trim().min(1).max(120).optional(),
});
export type VerifyOtpRequest = z.infer<typeof verifyOtpRequestSchema>;

export const staffLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type StaffLoginRequest = z.infer<typeof staffLoginRequestSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(ROLES),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  branchPreferences: z.array(z.enum(BRANCH_SLUGS)),
  onboardingCompleted: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

/** Error codes returned as `{ error: AuthErrorCode, message: string }` bodies. */
export const AUTH_ERROR_CODES = [
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_LOCKED",
  "OTP_MAX_ATTEMPTS",
  "OTP_RESEND_COOLDOWN",
  "RATE_LIMITED",
  "INVALID_CREDENTIALS",
  "UNAUTHORIZED",
  "FORBIDDEN",
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
