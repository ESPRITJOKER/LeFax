import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AuthUser } from "@lefax/shared";
import { MaterialIcon } from "../../components/ui/MaterialIcon";
import { TextField } from "../../components/ui/TextField";
import { LanguageSwitcher } from "../../components/ui/LanguageSwitcher";
import { api, ApiError } from "../../lib/api-client";
import { useSessionStore } from "../../stores/session.store";
import { PhoneOtpForm } from "./PhoneOtpForm";

// Exact brand marks from stitch_lefax_course_exam_prep/sign_up/code.html —
// official multi-color Google "G" and Facebook "f", not part of the app's
// own design-token palette (confirmed in the Step 1 token audit).
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

// Same decorative campus photo used in the original Stitch export.
const CAMPUS_PHOTO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDpqYJarpYoKTAo0IUAvXyV_jHniiR9o7tIFqvWdSVPbm_1R7558jg1tnnMqP47I-rEHr8ZcnuMKbW_L55vegZi4L9dCMrIJQDsXNL7583JNU12-OlelvF3SkhzvV0lt-qtiQmb5OW4kuz80nIin19fL8hNBo-yDD_rz6nQQKJPjkXoA_nXLaDYbqn4swcC2WJ75-VlL2lLQ3mqB4iI1Qg8fDVT6djfL_2Hmx_nSsSwIzlJ2pXo3hgpN1Y_1UgfDv8yIUUmX15tO9U";

type CodeCheck = { state: "idle" | "checking" | "valid" | "invalid"; schoolName?: string };

/**
 * Student-only — teachers/admins are invited (WEB-A04), never self-register.
 * Ported element-for-element from stitch_lefax_course_exam_prep/sign_up
 * (screen.png): Full Name + Phone + optional School Access Code all
 * collected before OTP, matching the mockup's own "OTP verification will
 * follow this step" note — this is a real, pre-existing multi-step design,
 * not one invented during the port.
 */
export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const [fullName, setFullName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [codeCheck, setCodeCheck] = useState<CodeCheck>({ state: "idle" });
  const [oauthNotice, setOauthNotice] = useState(false);

  async function checkSchoolCode() {
    if (!schoolCode.trim()) {
      setCodeCheck({ state: "idle" });
      return;
    }
    setCodeCheck({ state: "checking" });
    try {
      const res = await api.validateSchoolCode(schoolCode.trim());
      setCodeCheck(res.valid ? { state: "valid", schoolName: res.schoolName } : { state: "invalid" });
    } catch {
      setCodeCheck({ state: "invalid" });
    }
  }

  async function afterAuth(user: AuthUser, accessToken: string) {
    setSession(accessToken, user);
    if (schoolCode.trim() && codeCheck.state === "valid") {
      try {
        await api.joinSchool(schoolCode.trim());
      } catch (err) {
        // Non-fatal — the account exists either way; surface nothing blocking here.
        if (err instanceof ApiError) console.error(err.message);
      }
    }
    navigate(user.onboardingCompleted ? "/app" : "/onboarding/track");
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-margin-mobile py-xl bg-background relative">
      <LanguageSwitcher className="absolute top-lg right-lg" />
      <div className="w-full max-w-[440px] bg-white rounded-xl border border-outline-variant p-lg md:p-xl shadow-sm">
        <div className="mb-xl flex flex-col items-center text-center">
          <div className="mb-sm text-excellence-blue">
            <MaterialIcon name="school" filled className="text-[48px]" />
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-excellence-blue">
            {t("auth.signupTitle")}
          </h1>
          <p className="text-on-surface-variant font-body-sm mt-xs">{t("auth.signupSubtitle")}</p>
        </div>

        <PhoneOtpForm
          title={t("auth.signupTitle")}
          subtitle={t("auth.signupSubtitle")}
          submitLabel={t("auth.verify")}
          showPhoneStepHeader={false}
          onVerified={(res) => afterAuth(res.user, res.accessToken)}
          getVerifyExtras={() => ({ firstName: fullName.trim() || undefined })}
          phoneStepSubmitContent={
            <>
              {t("auth.signUpCta")}
              <MaterialIcon name="arrow_forward" className="text-[18px]" />
            </>
          }
          beforePhoneField={
            <TextField
              label={t("auth.fullNameLabel")}
              icon="person"
              placeholder={t("auth.fullNamePlaceholder")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          }
          afterPhoneField={
            <TextField
              label={t("auth.schoolCodeLabel")}
              icon="vpn_key"
              labelSuffix={<span className="font-label-md text-label-md text-on-surface-variant">{t("common.optional")}</span>}
              placeholder={t("auth.schoolCodePlaceholder")}
              value={schoolCode}
              onChange={(e) => {
                setSchoolCode(e.target.value);
                setCodeCheck({ state: "idle" });
              }}
              onBlur={checkSchoolCode}
              error={codeCheck.state === "invalid" ? t("auth.errors.SCHOOL_CODE_INVALID") : undefined}
            />
          }
          belowPhoneSubmit={
            <>
              {codeCheck.state === "valid" && (
                <p className="text-label-md font-label-md text-success-green flex items-center gap-xs -mt-sm">
                  <MaterialIcon name="check_circle" className="text-[16px]" />
                  {codeCheck.schoolName}
                </p>
              )}
              <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-lg border border-outline-variant/30">
                <MaterialIcon name="info" className="text-action-blue text-[18px]" />
                <p className="text-label-md font-label-md text-on-surface-variant">{t("auth.otpFollowsNote")}</p>
              </div>
            </>
          }
        />

        <div className="mt-lg text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {t("auth.haveAccount")}
            <Link to="/login" className="text-excellence-blue font-label-lg hover:underline ml-xs">
              {t("auth.loginLink")}
            </Link>
          </p>
        </div>

        <div className="relative my-xl">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant" />
          </div>
          <div className="relative flex justify-center text-label-md font-label-md">
            <span className="bg-white px-4 text-on-surface-variant">{t("auth.orContinueWith")}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-md">
          <button
            type="button"
            onClick={() => setOauthNotice(true)}
            className="flex items-center justify-center gap-sm py-2.5 border border-outline-variant rounded-lg hover:bg-surface-container-low transition-all"
          >
            <GoogleIcon />
            <span className="text-label-md font-label-md">Google</span>
          </button>
          <button
            type="button"
            onClick={() => setOauthNotice(true)}
            className="flex items-center justify-center gap-sm py-2.5 border border-outline-variant rounded-lg hover:bg-surface-container-low transition-all"
          >
            <FacebookIcon />
            <span className="text-label-md font-label-md">Facebook</span>
          </button>
        </div>
        {oauthNotice && (
          <p className="mt-sm text-center font-label-md text-label-md text-text-secondary">{t("onboarding.comingSoon")}</p>
        )}
      </div>

      <div className="h-32 w-full max-w-[440px] relative overflow-hidden shrink-0 mt-lg rounded-xl">
        <img src={CAMPUS_PHOTO_URL} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>
    </div>
  );
}
