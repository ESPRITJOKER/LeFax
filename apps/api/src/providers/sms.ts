import type { Env } from "../config/env.js";

export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Dev default: no SMS account needed to exercise the auth flow locally. */
class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    console.log(`[DEV OTP] ${phone} -> ${code}`);
  }
}

/** Real provider for prod, per CDC §9.2. Wired but untested until an
 * Africa's Talking merchant account exists — swap-in requires no code
 * change beyond setting SMS_PROVIDER=africastalking and the credentials. */
class AfricasTalkingSmsProvider implements SmsProvider {
  constructor(
    private readonly username: string,
    private readonly apiKey: string,
    private readonly senderId?: string
  ) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: this.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        username: this.username,
        to: phone,
        message: `Lefax Course: votre code de vérification est ${code}. Valable 10 minutes.`,
        ...(this.senderId ? { from: this.senderId } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`Africa's Talking SMS send failed: ${res.status} ${await res.text()}`);
    }
  }
}

export function createSmsProvider(env: Env): SmsProvider {
  if (env.SMS_PROVIDER === "africastalking") {
    if (!env.AFRICASTALKING_USERNAME || !env.AFRICASTALKING_API_KEY) {
      throw new Error("AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY are required when SMS_PROVIDER=africastalking");
    }
    return new AfricasTalkingSmsProvider(
      env.AFRICASTALKING_USERNAME,
      env.AFRICASTALKING_API_KEY,
      env.AFRICASTALKING_SENDER_ID
    );
  }
  return new ConsoleSmsProvider();
}
