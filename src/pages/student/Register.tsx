import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { LangSwitcher } from "../../components/LangSwitcher";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { REGIONS, TOWNS } from "../../lib/regions";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { Button } from "../../components/ui";

// Flip to true once a real SMS provider is configured (CDC section 8/13) —
// see supabase/functions/auth-otp for the bypass this currently uses instead.
const AUTH_OTP_ENABLED = import.meta.env.VITE_AUTH_OTP_ENABLED === "true";

export default function Register() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [town, setTown] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const townOptions = region ? TOWNS[region] ?? [] : [];

  async function submitRegister() {
    setError(null);
    if (password !== confirmPassword) {
      setError(lang === "fr" ? "Les mots de passe ne correspondent pas." : "Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError(lang === "fr" ? "Vous devez accepter les CGU." : "You must accept the Terms of Use.");
      return;
    }
    if (!isSupabaseConfigured) {
      setError(t("backend_banner"));
      return;
    }
    setSubmitting(true);

    if (!AUTH_OTP_ENABLED) {
      // No SMS provider is configured yet (CDC section 8/13 — paid, not
      // provisioned). supabase.auth.signUp always tries to send a real SMS
      // for phone sign-ups, which fails outright without one. Bypass it via
      // the auth-otp Edge Function (creates the user pre-confirmed through
      // the Admin API, no SMS involved), then sign in normally.
      const { data: fnData, error: fnError } = await supabase.functions.invoke("auth-otp", {
        body: { phone, action: "signup", password, firstName, lastName, region, town },
      });
      if (fnError || fnData?.error) {
        setSubmitting(false);
        setError(fnData?.error ?? fnError?.message ?? "Sign-up failed.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ phone, password });
      setSubmitting(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      navigate("/track");
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      phone,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, region, town },
      },
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setStep("otp");
  }

  async function verifyOtp() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError(t("backend_banner"));
      return;
    }
    setSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setSubmitting(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    navigate("/track");
  }

  async function resendOtp() {
    if (!isSupabaseConfigured) return;
    await supabase.auth.resend({ type: "sms", phone });
  }

  return (
    <PhoneFrame>
      <div className="flex items-center justify-end px-4 pt-3.5">
        <LangSwitcher />
      </div>

      {step === "form" && (
        <div className="flex-1 flex flex-col px-[22px] pb-6 overflow-y-auto">
          <div className="flex items-center gap-2.5 my-2 mb-5">
            <Icon name="cap" size={22} className="text-ink-700" />
            <div className="font-serif font-semibold text-[19px] text-ink-900">{t("appName")}</div>
          </div>
          <div className="font-serif font-bold text-2xl text-ink-950 mb-1">{t("reg_title")}</div>
          <div className="text-[13.5px] text-muted mb-6">{t("reg_sub")}</div>

          <div className="flex flex-col gap-4">
            <Field label={t("reg_firstname")}>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean Paul" className={inputClass} />
            </Field>
            <Field label={t("reg_lastname")}>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Abessolo" className={inputClass} />
            </Field>
            <Field label={t("reg_phone")}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6XX XXX XXX" className={inputClass} />
            </Field>
            <Field label={t("reg_region")}>
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setTown("");
                }}
                className={inputClass}
              >
                <option value="">{t("reg_selectPlaceholder")}</option>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {lang === "fr" ? r.fr : r.en}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("reg_town")}>
              <input
                value={town}
                onChange={(e) => setTown(e.target.value)}
                list="townList"
                placeholder={t("reg_selectPlaceholder")}
                className={inputClass}
              />
              <datalist id="townList">
                {townOptions.map((tw) => (
                  <option key={tw} value={tw} />
                ))}
              </datalist>
            </Field>
            <Field label={t("reg_password")}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
            </Field>
            <Field label={t("reg_confirmPassword")}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </Field>
            <label className="flex items-start gap-2 text-[12.5px] text-ink-900">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5" />
              <span>{t("reg_terms")}</span>
            </label>
          </div>

          {error && <div className="mt-3 text-xs font-semibold text-danger-700">{error}</div>}

          <Button onClick={submitRegister} disabled={submitting} className="mt-6 w-full">
            {t("reg_cta")}
          </Button>
          <div className="text-center mt-4 text-[13px] text-muted">
            {t("reg_haveaccount")}{" "}
            <a href="#" onClick={(e) => (e.preventDefault(), navigate("/login"))} className="font-semibold">
              {t("reg_login")}
            </a>
          </div>
        </div>
      )}

      {step === "otp" && (
        <div className="flex-1 flex flex-col px-[22px] pb-6">
          <div className="font-serif font-bold text-2xl text-ink-950 mb-1 mt-6">{t("reg_otp_title")}</div>
          <div className="text-[13.5px] text-muted mb-6">
            {t("reg_otp_sub")} {phone}
          </div>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            className={inputClass}
          />
          {error && <div className="mt-3 text-xs font-semibold text-danger-700">{error}</div>}
          <Button onClick={verifyOtp} disabled={submitting} className="mt-6 w-full">
            {t("reg_otp_cta")}
          </Button>
          <button onClick={resendOtp} className="mt-4 text-[13px] text-ink-700 font-semibold">
            {t("reg_otp_resend")}
          </button>
        </div>
      )}
    </PhoneFrame>
  );
}

const inputClass =
  "px-3.5 py-3 rounded-xl border-[1.5px] border-border text-[14.5px] outline-none text-ink-950 bg-white w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-ink-800">{label}</span>
      {children}
    </label>
  );
}
