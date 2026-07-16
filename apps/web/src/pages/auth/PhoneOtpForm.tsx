import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cameroonPhoneSchema, type AuthUser } from "@lefax/shared";
import { api, ApiError } from "../../lib/api-client";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";

interface VerifiedResult {
  accessToken: string;
  user: AuthUser;
  isNewUser: boolean;
}

interface PhoneOtpFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  onVerified: (result: VerifiedResult) => void;
  /** Extra fields rendered above the phone field on the phone step (e.g. Full Name — signup only). */
  beforePhoneField?: ReactNode;
  /** Extra fields rendered below the phone field on the phone step (e.g. School Access Code — signup only). */
  afterPhoneField?: ReactNode;
  /** Extra content rendered below the submit button on the phone step (e.g. OTP note, social buttons — signup only). */
  belowPhoneSubmit?: ReactNode;
  /** Extra verify-otp payload, e.g. { firstName } for account creation. Ignored by plain login. */
  getVerifyExtras?: () => Record<string, unknown> | undefined;
  /** Overrides the phone-step submit button content (default: t("auth.sendCode")). */
  phoneStepSubmitContent?: ReactNode;
  /** Set false when the caller already renders title/subtitle itself (signup). Default true. */
  showPhoneStepHeader?: boolean;
}

/**
 * Shared phone + OTP flow (CDC WEB-E01) used by both the student login and
 * signup screens — verify-otp always does findOrCreate server-side, so the
 * two pages differ only in the phone-step surrounding content (signup adds
 * Full Name / School Access Code / social buttons), not in the OTP mechanics.
 */
export function PhoneOtpForm({
  title,
  subtitle,
  submitLabel,
  onVerified,
  beforePhoneField,
  afterPhoneField,
  belowPhoneSubmit,
  getVerifyExtras,
  phoneStepSubmitContent,
  showPhoneStepHeader = true,
}: PhoneOtpFormProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("+237");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  function mapError(err: unknown): string {
    if (err instanceof ApiError) {
      return t(`auth.errors.${err.code}`, { defaultValue: t("auth.errors.INTERNAL") });
    }
    return t("auth.errors.INTERNAL");
  }

  async function sendOtp(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    const parsed = cameroonPhoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(t("auth.invalidPhone"));
      return;
    }
    setLoading(true);
    try {
      const res = await api.sendOtp(phone);
      setCooldown(res.cooldownSeconds);
      setStep("otp");
    } catch (err) {
      setError(mapError(err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError(t("auth.errors.OTP_INVALID"));
      return;
    }
    setLoading(true);
    try {
      const extras = getVerifyExtras?.();
      const res = await api.verifyOtp(phone, code, extras?.firstName as string | undefined);
      onVerified(res);
    } catch (err) {
      setError(mapError(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "phone") {
    return (
      <form className="space-y-lg" onSubmit={sendOtp}>
        {showPhoneStepHeader && (
          <header>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-text-primary mb-xs">{title}</h2>
            <p className="font-body-md text-body-md text-text-secondary">{subtitle}</p>
          </header>
        )}
        {beforePhoneField}
        <TextField
          label={t("auth.phoneLabel")}
          type="tel"
          icon="phone_android"
          placeholder={t("auth.phonePlaceholder")}
          value={phone}
          onChange={(evt) => setPhone(evt.target.value)}
          error={error ?? undefined}
        />
        {afterPhoneField}
        <Button type="submit" className="w-full flex items-center justify-center gap-xs" disabled={loading}>
          {loading ? t("common.loading") : (phoneStepSubmitContent ?? t("auth.sendCode"))}
        </Button>
        {belowPhoneSubmit}
      </form>
    );
  }

  return (
    <form className="space-y-lg" onSubmit={verifyOtp}>
      <header>
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-text-primary mb-xs">{t("auth.otpTitle")}</h2>
        <p className="font-body-md text-body-md text-text-secondary">{t("auth.otpSubtitle", { phone })}</p>
      </header>
      <TextField
        label={t("auth.otpTitle")}
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(evt) => setCode(evt.target.value.replace(/\D/g, ""))}
        error={error ?? undefined}
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("common.loading") : submitLabel}
      </Button>
      <button
        type="button"
        className="w-full text-center font-label-md text-label-md text-primary disabled:text-outline"
        disabled={cooldown > 0 || loading}
        onClick={() => sendOtp()}
      >
        {cooldown > 0 ? t("auth.otpResendIn", { seconds: cooldown }) : t("auth.otpResend")}
      </button>
    </form>
  );
}
