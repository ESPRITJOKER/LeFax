// auth-otp — Authentification (CDC 6.1 / section 10 "Authentification")
//
// The primary signup/login/OTP-verify flow uses Supabase Auth's native phone
// provider directly from the client (supabase.auth.signUp / verifyOtp — see
// src/pages/student/Register.tsx), per CDC section 8 ("Authentification :
// Supabase Auth (téléphone + OTP)"). This function exists for the pieces
// that must NOT run on the client:
//   - enforcing the max-attempts cap (CDC risk: "coût SMS imprévisible ->
//     plafonner tentatives") before an OTP is (re)sent,
//   - the escape hatch to a commercial SMS/WhatsApp provider if the team
//     moves off Supabase's built-in phone provider (CDC risk mitigation:
//     "WhatsApp OTP en Phase 2"),
//   - action "signup": a TEMPORARY bypass (see below) used while no SMS
//     provider is configured.
//
// Not wired to a real SMS provider yet — SMS_PROVIDER_API_KEY is unset in
// this scaffold. The fetch() calls below show the intended shape (Twilio
// Verify API) and are safe to leave as-is until a provider is chosen.
//
// -- TEMPORARY no-SMS bypass ("signup" action) ------------------------------
// Supabase Auth's phone provider tries to *send* a verification SMS on every
// signUp() call, even with phone auto-confirm on — with no working SMS
// provider configured on the project, that call fails outright (500 "Unable
// to get SMS provider"), which would otherwise block registration entirely.
// Until a real provider is chosen and `SMS_PROVIDER`/`SMS_PROVIDER_API_KEY`
// are set (CDC section 8/13 budget item), the frontend calls this function's
// "signup" action instead of supabase.auth.signUp directly (gated by
// VITE_AUTH_OTP_ENABLED=false, see src/pages/student/Register.tsx). It
// creates the user via the Admin API with phone_confirm: true — which does
// not touch the SMS provider at all — then the client signs in normally
// with signInWithPassword (also SMS-independent). Once a real provider is
// wired, flip VITE_AUTH_OTP_ENABLED=true to go back to the native
// signUp/verifyOtp flow and delete this bypass action.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabaseAdmin.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const body = await req.json();
    const { phone, action } = body;
    if (!phone || !action) return jsonResponse({ error: "phone and action are required" }, 400);

    const admin = getServiceClient();

    if (action === "signup") {
      const { password, firstName, lastName, region, town } = body;
      if (!password) return jsonResponse({ error: "password is required" }, 400);

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        phone,
        password,
        phone_confirm: true, // bypasses SMS verification entirely — see note above
        user_metadata: { first_name: firstName, last_name: lastName, region, town },
      });
      if (createError) return jsonResponse({ error: createError.message }, 400);
      return jsonResponse({ ok: true, userId: created.user?.id });
    }

    // Enforce CDC's configurable attempt cap (public.settings.otp_max_attempts).
    const { data: setting } = await admin.from("settings").select("value").eq("key", "otp_max_attempts").maybeSingle();
    const maxAttempts = Number(setting?.value ?? 5);
    // TODO: track attempts per phone number (e.g. a dedicated otp_attempts
    // table with a rolling window) once volume makes this necessary; for the
    // MVP scaffold the cap is read but not yet enforced against real counts.
    void maxAttempts;

    if (action === "send" || action === "resend") {
      const smsProvider = Deno.env.get("SMS_PROVIDER");
      const smsApiKey = Deno.env.get("SMS_PROVIDER_API_KEY");

      if (!smsProvider || !smsApiKey) {
        // No commercial SMS provider configured -> defer entirely to
        // Supabase Auth's own phone provider (already invoked client-side).
        return jsonResponse({ ok: true, delegatedToSupabaseAuth: true });
      }

      // Real fetch-to-provider shape (Twilio Verify API), gated behind real
      // credentials that are intentionally not provided in this scaffold.
      const response = await fetch(`https://verify.twilio.com/v2/Services/${Deno.env.get("TWILIO_VERIFY_SERVICE_SID")}/Verifications`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${Deno.env.get("TWILIO_ACCOUNT_SID")}:${smsApiKey}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Channel: "sms" }),
      });
      const result = await response.json();
      return jsonResponse({ ok: response.ok, providerResult: result });
    }

    if (action === "verify") {
      const { code } = body;
      const smsProvider = Deno.env.get("SMS_PROVIDER");
      if (!smsProvider) return jsonResponse({ ok: true, delegatedToSupabaseAuth: true });

      const response = await fetch(`https://verify.twilio.com/v2/Services/${Deno.env.get("TWILIO_VERIFY_SERVICE_SID")}/VerificationCheck`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${Deno.env.get("TWILIO_ACCOUNT_SID")}:${Deno.env.get("SMS_PROVIDER_API_KEY")}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Code: code }),
      });
      const result = await response.json();
      return jsonResponse({ ok: response.ok, valid: result?.status === "approved" });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
