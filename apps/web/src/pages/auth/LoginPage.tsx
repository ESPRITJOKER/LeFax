import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AuthUser } from "@lefax/shared";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";
import { api, ApiError } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";
import { PhoneOtpForm } from "./PhoneOtpForm";

/**
 * Ported from stitch_lefax_course_exam_prep/log_in (screen.png). The mockup
 * shows a single phone+password form, which conflicts with the real auth
 * model (students: phone+OTP, no password; staff: email+password, no
 * phone) — confirmed with the user to keep the existing Étudiant/Enseignant
 * tabs and restyle to match the mockup's visual language (card layout,
 * icons, copy tone) rather than porting the password field literally.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);

  const [mode, setMode] = useState<"student" | "staff">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState(false);

  function afterAuth(user: AuthUser, accessToken: string) {
    setSession(accessToken, user);
    if (user.role === "student") {
      navigate(user.onboardingCompleted ? "/app" : "/onboarding/track");
    } else if (user.role === "teacher") {
      navigate("/teacher");
    } else {
      navigate("/admin");
    }
  }

  async function submitStaffLogin(e: FormEvent) {
    e.preventDefault();
    setStaffError(null);
    setStaffLoading(true);
    try {
      const res = await api.staffLogin(email, password);
      afterAuth(res.user, res.accessToken);
    } catch (err) {
      setStaffError(
        err instanceof ApiError
          ? t(`auth.errors.${err.code}`, { defaultValue: t("auth.errors.INTERNAL") })
          : t("auth.errors.INTERNAL")
      );
    } finally {
      setStaffLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-margin-mobile py-xl bg-background relative">
      <LanguageSwitcher className="absolute top-lg right-lg" />
      <div className="mb-xl text-center">
        <div className="w-16 h-16 bg-excellence-blue rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-md">
          <MaterialIcon name="school" filled className="text-[32px]" />
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue">{t("common.appName")}</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">{t("auth.tagline")}</p>
      </div>

      <div className="w-full max-w-[440px] bg-white rounded-2xl p-lg md:p-xl shadow-sm border border-outline-variant">
        <div className="flex mb-lg rounded-lg bg-surface-container-low p-1">
          <button
            type="button"
            className={`flex-1 py-sm rounded-lg font-label-lg text-label-lg transition-all ${
              mode === "student" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"
            }`}
            onClick={() => setMode("student")}
          >
            {t("auth.studentTab")}
          </button>
          <button
            type="button"
            className={`flex-1 py-sm rounded-lg font-label-lg text-label-lg transition-all ${
              mode === "staff" ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"
            }`}
            onClick={() => setMode("staff")}
          >
            {t("auth.staffTab")}
          </button>
        </div>

        {mode === "student" ? (
          <>
            <PhoneOtpForm
              title={t("auth.loginTitle")}
              subtitle={t("auth.loginSubtitle")}
              submitLabel={t("auth.verify")}
              onVerified={(res) => afterAuth(res.user, res.accessToken)}
              phoneStepSubmitContent={
                <>
                  {t("auth.sendCode")}
                  <MaterialIcon name="arrow_forward" className="text-[18px]" />
                </>
              }
            />
            <div className="mt-xl pt-lg border-t border-outline-variant text-center">
              <p className="font-body-md text-body-md text-text-secondary">
                {t("auth.noAccount")}
                <Link to="/signup" className="font-label-lg text-label-lg text-excellence-blue hover:underline ml-xs">
                  {t("auth.signupLink")}
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            <header className="mb-lg">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-text-primary mb-xs">
                {t("auth.loginTitle")}
              </h2>
              <p className="font-body-md text-body-md text-text-secondary">{t("auth.loginSubtitle")}</p>
            </header>
            <form className="space-y-lg" onSubmit={submitStaffLogin}>
              <TextField
                label={t("auth.emailLabel")}
                type="email"
                icon="mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField
                label={t("auth.passwordLabel")}
                type={showPassword ? "text" : "password"}
                icon="lock"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={staffError ?? undefined}
                required
                labelSuffix={
                  <button
                    type="button"
                    onClick={() => setForgotNotice(true)}
                    className="font-label-md text-label-md text-excellence-blue hover:underline"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                }
                trailingAction={
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="text-on-surface-variant hover:text-excellence-blue transition-colors"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    <MaterialIcon name={showPassword ? "visibility_off" : "visibility"} className="text-[20px]" />
                  </button>
                }
              />
              {forgotNotice && (
                <p className="font-label-md text-label-md text-text-secondary -mt-sm">{t("onboarding.comingSoon")}</p>
              )}
              <Button type="submit" className="w-full flex items-center justify-center gap-xs" disabled={staffLoading}>
                {staffLoading ? (
                  t("common.loading")
                ) : (
                  <>
                    {t("landing.login")}
                    <MaterialIcon name="arrow_forward" className="text-[18px]" />
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </div>

      <div className="mt-xl opacity-40">
        <div className="flex gap-lg justify-center items-center">
          <div className="h-px w-12 bg-outline-variant" />
          <div className="flex gap-sm">
            <div className="w-2 h-2 rounded-full bg-excellence-blue" />
            <div className="w-2 h-2 rounded-full bg-achievement-gold" />
            <div className="w-2 h-2 rounded-full bg-excellence-blue" />
          </div>
          <div className="h-px w-12 bg-outline-variant" />
        </div>
      </div>
    </div>
  );
}
