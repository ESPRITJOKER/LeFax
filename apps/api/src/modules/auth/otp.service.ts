import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SmsProvider } from "../../providers/sms.js";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS_PER_CODE = 3;
const RESEND_COOLDOWN_SECONDS = 60;
const SEND_RATE_LIMIT_WINDOW_MINUTES = 10;
const SEND_RATE_LIMIT_MAX = 3;
const PHONE_LOCKOUT_MAX_FAILURES = 5;
const PHONE_LOCKOUT_WINDOW_MINUTES = 10;

type OtpRow = {
  id: string;
  phone: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
};

export class OtpRateLimitError extends Error {
  constructor(public code: "RATE_LIMITED" | "OTP_RESEND_COOLDOWN" | "OTP_LOCKED") {
    super(code);
  }
}

export class OtpVerifyError extends Error {
  constructor(public code: "OTP_EXPIRED" | "OTP_INVALID" | "OTP_MAX_ATTEMPTS") {
    super(code);
  }
}

export class OtpService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly sms: SmsProvider
  ) {}

  private async logEvent(phone: string, eventType: string, success: boolean) {
    await this.supabase.from("auth_events").insert({ phone, event_type: eventType, success });
  }

  async sendOtp(phone: string): Promise<{ cooldownSeconds: number }> {
    const windowStart = new Date(Date.now() - SEND_RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
    const { data: recent, error } = await this.supabase
      .from("otp_codes")
      .select("id, created_at")
      .eq("phone", phone)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (recent && recent.length > 0) {
      const lastSentAt = new Date(recent[0]!.created_at).getTime();
      const secondsSinceLast = (Date.now() - lastSentAt) / 1000;
      if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
        throw new OtpRateLimitError("OTP_RESEND_COOLDOWN");
      }
    }
    if (recent && recent.length >= SEND_RATE_LIMIT_MAX) {
      throw new OtpRateLimitError("RATE_LIMITED");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

    const { error: insertError } = await this.supabase
      .from("otp_codes")
      .insert({ phone, code_hash: codeHash, expires_at: expiresAt });
    if (insertError) throw insertError;

    await this.sms.sendOtp(phone, code);
    await this.logEvent(phone, "otp_sent", true);

    return { cooldownSeconds: RESEND_COOLDOWN_SECONDS };
  }

  async verifyOtp(phone: string, code: string): Promise<void> {
    const lockoutWindowStart = new Date(Date.now() - PHONE_LOCKOUT_WINDOW_MINUTES * 60_000).toISOString();
    const { count: recentFailures, error: countError } = await this.supabase
      .from("auth_events")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .eq("event_type", "otp_verify_failed")
      .gte("created_at", lockoutWindowStart);
    if (countError) throw countError;
    if ((recentFailures ?? 0) >= PHONE_LOCKOUT_MAX_FAILURES) {
      throw new OtpRateLimitError("OTP_LOCKED");
    }

    const { data: rows, error } = await this.supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;

    const row = (rows?.[0] as OtpRow | undefined) ?? undefined;
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      await this.logEvent(phone, "otp_verify_failed", false);
      throw new OtpVerifyError("OTP_EXPIRED");
    }

    if (row.attempts >= MAX_ATTEMPTS_PER_CODE) {
      await this.logEvent(phone, "otp_verify_failed", false);
      throw new OtpVerifyError("OTP_MAX_ATTEMPTS");
    }

    const isValid = await bcrypt.compare(code, row.code_hash);
    if (!isValid) {
      await this.supabase
        .from("otp_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      await this.logEvent(phone, "otp_verify_failed", false);
      throw new OtpVerifyError(row.attempts + 1 >= MAX_ATTEMPTS_PER_CODE ? "OTP_MAX_ATTEMPTS" : "OTP_INVALID");
    }

    await this.supabase.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    await this.logEvent(phone, "otp_verify_succeeded", true);
  }
}
