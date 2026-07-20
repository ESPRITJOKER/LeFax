import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "../../components/PhoneFrame";
import { Icon } from "../../lib/icons";
import { useI18n } from "../../lib/i18n";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { Button } from "../../components/ui";

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitLogin() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError(t("backend_banner"));
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ phone, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate("/dashboard");
  }

  return (
    <PhoneFrame nav={false}>
      <div className="flex-1 flex flex-col px-[22px] pb-6">
        <div className="flex items-center gap-2.5 my-2 mb-5">
          <Icon name="cap" size={22} className="text-ink-700" />
          <div className="font-serif font-semibold text-[19px] text-ink-900">{t("appName")}</div>
        </div>
        <div className="font-serif font-bold text-2xl text-ink-950 mb-1">{t("login_title")}</div>
        <div className="text-[13.5px] text-muted mb-6">{t("login_sub")}</div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink-800">{t("reg_phone")}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6XX XXX XXX" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink-800">{t("reg_password")}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </label>
        </div>

        <div className="text-right mt-2">
          <a href="#" className="text-xs font-semibold text-ink-700">
            {t("login_forgot")}
          </a>
        </div>

        {error && <div className="mt-3 text-xs font-semibold text-danger-700">{error}</div>}

        <Button onClick={submitLogin} disabled={submitting} className="mt-6 w-full">
          {t("login_cta")}
        </Button>
        <div className="text-center mt-4 text-[13px] text-muted">
          {t("login_noaccount")}{" "}
          <a href="#" onClick={(e) => (e.preventDefault(), navigate("/register"))} className="font-semibold">
            {t("login_signup")}
          </a>
        </div>
      </div>
    </PhoneFrame>
  );
}

const inputClass =
  "px-3.5 py-3 rounded-xl border-[1.5px] border-border text-[14.5px] outline-none text-ink-950 bg-white w-full";
