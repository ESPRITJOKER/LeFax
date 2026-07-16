import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser } from "@lefax/shared";
import type { FastifyInstance } from "fastify";
import type { AccessTokenPayload } from "../../plugins/jwt.js";

type ProfileRow = {
  id: string;
  role: "student" | "teacher" | "admin";
  phone: string | null;
  email: string | null;
  password_hash: string | null;
  first_name: string | null;
  branch_preferences: string[];
  onboarding_completed: boolean;
  is_active: boolean;
};

function toAuthUser(row: ProfileRow): AuthUser {
  return {
    id: row.id,
    role: row.role,
    phone: row.phone,
    email: row.email,
    firstName: row.first_name,
    branchPreferences: row.branch_preferences as AuthUser["branchPreferences"],
    onboardingCompleted: row.onboarding_completed,
  };
}

export class AuthService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly supabase: SupabaseClient
  ) {}

  async findOrCreateStudentByPhone(
    phone: string,
    firstName?: string
  ): Promise<{ user: AuthUser; isNewUser: boolean }> {
    const { data: existing, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("phone", phone)
      .maybeSingle<ProfileRow>();
    if (error) throw error;

    if (existing) {
      if (!existing.is_active) throw new Error("ACCOUNT_DISABLED");
      return { user: toAuthUser(existing), isNewUser: false };
    }

    const { data: created, error: insertError } = await this.supabase
      .from("profiles")
      .insert({ role: "student", phone, first_name: firstName ?? null })
      .select("*")
      .single<ProfileRow>();
    if (insertError) throw insertError;

    return { user: toAuthUser(created), isNewUser: true };
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .eq("is_active", true)
      .maybeSingle<ProfileRow>();
    if (error) throw error;
    return data ? toAuthUser(data) : null;
  }

  async findStaffByEmail(email: string, password: string): Promise<AuthUser | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .in("role", ["teacher", "admin"])
      .maybeSingle<ProfileRow>();
    if (error) throw error;
    if (!data || !data.password_hash || !data.is_active) return null;

    const isValid = await bcrypt.compare(password, data.password_hash);
    if (!isValid) return null;

    return toAuthUser(data);
  }

  async issueTokens(user: AuthUser) {
    const accessPayload: AccessTokenPayload = { sub: user.id, role: user.role };
    const accessToken = this.fastify.jwt.sign(accessPayload);

    const jti = randomUUID();
    const refreshToken = this.fastify.refreshJwt.sign(accessPayload, jti);
    await this.supabase.from("profiles").update({ current_refresh_jti: jti }).eq("id", user.id);

    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(refreshToken: string) {
    const decoded = this.fastify.refreshJwt.verify(refreshToken);
    const { data: profile, error } = await this.supabase
      .from("profiles")
      .select("*, current_refresh_jti")
      .eq("id", decoded.sub)
      .maybeSingle<ProfileRow & { current_refresh_jti: string | null }>();
    if (error) throw error;
    if (!profile || !profile.is_active) throw new Error("UNAUTHORIZED");

    // decoded.jti is compared against the row set by issueTokens; a token
    // that was logged out or already rotated once will not match.
    if (decoded.jti !== profile.current_refresh_jti) throw new Error("UNAUTHORIZED");

    return this.issueTokens(toAuthUser(profile));
  }

  async revokeRefreshToken(userId: string) {
    await this.supabase.from("profiles").update({ current_refresh_jti: null }).eq("id", userId);
  }

  async completeOnboarding(userId: string, branchSlugs: string[]) {
    const { data, error } = await this.supabase
      .from("profiles")
      .update({ branch_preferences: branchSlugs, onboarding_completed: true })
      .eq("id", userId)
      .select("*")
      .single<ProfileRow>();
    if (error) throw error;
    return toAuthUser(data);
  }
}
