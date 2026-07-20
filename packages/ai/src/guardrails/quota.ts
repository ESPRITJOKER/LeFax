export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  tier?: string;
  usageToday?: number;
  dailyLimit?: number;
}

export interface SubscriptionRow {
  tier: string;
  status: string;
  expires_at: string;
}

export interface UsageCount {
  count: number;
}

export async function checkQuota(
  getActiveSubscription: () => Promise<SubscriptionRow | null>,
  getTodayUsageCount: () => Promise<number>,
  dailyLimit: number = 50
): Promise<QuotaCheckResult> {
  const subscription = await getActiveSubscription();

  if (!subscription || subscription.status !== "active") {
    return {
      allowed: false,
      reason: "NO_ACTIVE_SUBSCRIPTION",
    };
  }

  if (new Date(subscription.expires_at) <= new Date()) {
    return {
      allowed: false,
      reason: "SUBSCRIPTION_EXPIRED",
    };
  }

  if (subscription.tier === "free") {
    return {
      allowed: false,
      reason: "FREE_TIER_NO_TUTOR_ACCESS",
      tier: subscription.tier,
    };
  }

  const usageToday = await getTodayUsageCount();

  if (usageToday >= dailyLimit) {
    return {
      allowed: false,
      reason: "DAILY_LIMIT_EXCEEDED",
      tier: subscription.tier,
      usageToday,
      dailyLimit,
    };
  }

  return {
    allowed: true,
    tier: subscription.tier,
    usageToday,
    dailyLimit,
  };
}
