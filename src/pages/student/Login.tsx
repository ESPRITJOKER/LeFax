import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { useI18n } from "../../lib/i18n";
import { normalizePhone } from "../../lib/phone";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

const inputClass =
  "w-full box-border border border-[#e2e8f0] rounded-[8px] px-3.5 py-[13px] text-[14px] outline-none focus:border-brand-500";

export default function Login() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitLogin() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError(lang === "fr" ? "Backend non configuré." : "Backend not configured.");
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ phone: normalizePhone(phone), password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate("/dashboard");
  }

  return (
    <PhoneFrame>
      <div className="bg-white flex-1 min-h-0 overflow-y-auto flex flex-col px-[26px] pt-[60px] pb-[30px] text-center">
        <span className="font-serif font-extrabold text-[22px] text-ink-900">LeFax</span>
        <h2 className="font-serif font-bold text-[19px] text-ink-900 mt-[26px] mb-[22px]">
          {lang === "fr" ? "Content de te revoir" : "Welcome back"}
        </h2>
        <div className="flex items-stretch mb-3 text-left">
          <span className="flex items-center gap-1 px-3 rounded-l-[8px] border border-r-0 border-[#e2e8f0] bg-[#f8fafc] text-[14px] text-ink-900 font-semibold whitespace-nowrap">
            🇨🇲 +237
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder={lang === "fr" ? "6 XX XX XX XX" : "6 XX XX XX XX"}
            className="flex-1 min-w-0 box-border border border-[#e2e8f0] rounded-r-[8px] px-3.5 py-[13px] text-[14px] outline-none focus:border-brand-500"
          />
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={lang === "fr" ? "Mot de passe" : "Password"}
          className={`${inputClass} mb-2`}
        />
        <div className="text-right mb-[18px]">
          <a className="text-[12.5px] cursor-pointer">{lang === "fr" ? "Mot de passe oublié ?" : "Forgot password?"}</a>
        </div>
        {error && <div className="mb-3 text-xs font-semibold text-danger-600">{error}</div>}
        <button
          onClick={submitLogin}
          disabled={submitting}
          className="w-full bg-brand-500 text-white rounded-[8px] py-[15px] font-bold text-[14px] tracking-[0.5px] disabled:opacity-50"
        >
          {submitting ? "..." : lang === "fr" ? "CONNEXION" : "LOG IN"}
        </button>
        <div className="mt-4 text-[13px] text-[#647084]">
          {lang === "fr" ? "Pas encore de compte ?" : "No account yet?"}{" "}
          <a onClick={() => navigate("/register")} className="cursor-pointer font-semibold">
            {lang === "fr" ? "INSCRIPTION" : "SIGN UP"}
          </a>
        </div>
      </div>
    </PhoneFrame>
  );
}
