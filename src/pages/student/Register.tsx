import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { useI18n } from "../../lib/i18n";
import { REGIONS, TOWNS } from "../../lib/regions";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

// Flip to true once a real SMS provider is configured (CDC section 8/13) —
// see supabase/functions/auth-otp for the bypass this currently uses instead.
const AUTH_OTP_ENABLED = import.meta.env.VITE_AUTH_OTP_ENABLED === "true";

const inputClass =
  "w-full box-border border border-[#e2e8f0] rounded-[8px] px-3.5 py-[13px] text-[14px] outline-none focus:border-brand-500 mb-3";

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
      options: { data: { first_name: firstName, last_name: lastName, region, town } },
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
      <div className="bg-white flex-1 min-h-0 flex flex-col pb-[30px]">
        <div className="flex items-center justify-between px-5 py-[18px]">
          <span className="font-serif font-extrabold text-[20px] text-ink-900">LeFax</span>
        </div>

        {step === "form" && (
          <div className="flex-1 min-h-0 overflow-y-auto px-[26px] text-center">
            <div className="w-[110px] h-[110px] mx-auto mb-2.5 rounded-[14px] bg-brand-50 flex items-center justify-center text-[48px]">
              🎓
            </div>
            <h2 className="font-serif font-bold text-[19px] text-ink-900 mb-5">
              {lang === "fr" ? "Commence ta préparation" : "Start your prep"}
            </h2>

            <div className="text-left">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("reg_firstname")} className={inputClass} />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("reg_lastname")} className={inputClass} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6XX XXX XXX" className={inputClass} />
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setTown("");
                }}
                className={`${inputClass} appearance-none bg-white`}
              >
                <option value="">{t("reg_region")}</option>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {lang === "fr" ? r.fr : r.en}
                  </option>
                ))}
              </select>
              <input value={town} onChange={(e) => setTown(e.target.value)} list="townList" placeholder={t("reg_town")} className={inputClass} />
              <datalist id="townList">
                {townOptions.map((tw) => (
                  <option key={tw} value={tw} />
                ))}
              </datalist>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("reg_password")} className={inputClass} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("reg_confirmPassword")}
                className={inputClass}
              />
              <label className="flex items-start gap-2 text-[12.5px] text-ink-900 mb-3.5">
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5" />
                <span>{t("reg_terms")}</span>
              </label>
            </div>

            {error && <div className="mb-3 text-xs font-semibold text-danger-600">{error}</div>}

            <button
              onClick={submitRegister}
              disabled={submitting}
              className="w-full bg-brand-500 text-white rounded-[8px] py-[15px] font-bold text-[14px] tracking-[0.5px] disabled:opacity-50"
            >
              {submitting ? "..." : lang === "fr" ? "INSCRIPTION" : "SIGN UP"}
            </button>
            <div className="mt-4 text-[13px] text-[#647084]">
              {t("reg_haveaccount")}{" "}
              <a onClick={() => navigate("/login")} className="cursor-pointer font-semibold">
                {t("reg_login")}
              </a>
            </div>
          </div>
        )}

        {step === "otp" && (
          <div className="px-[26px]">
            <div className="font-serif font-bold text-[22px] text-ink-900 mb-1 mt-6">{t("reg_otp_title")}</div>
            <div className="text-[13.5px] text-muted mb-6">
              {t("reg_otp_sub")} {phone}
            </div>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" inputMode="numeric" className={inputClass} />
            {error && <div className="mb-3 text-xs font-semibold text-danger-600">{error}</div>}
            <button
              onClick={verifyOtp}
              disabled={submitting}
              className="w-full bg-brand-500 text-white rounded-[8px] py-[15px] font-bold text-[14px] tracking-[0.5px] disabled:opacity-50"
            >
              {t("reg_otp_cta")}
            </button>
            <button onClick={resendOtp} className="mt-4 text-[13px] text-brand-600 font-semibold">
              {t("reg_otp_resend")}
            </button>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
