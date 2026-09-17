export interface PlanLimits {
  members: number;
  invitations: number;
  apiKeys: number;
  webhooks: number;
}

export interface PlanConfig {
  id: string;
  name: string;
  priceMonthly: number;
  limits: PlanLimits;
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    limits: {
      members: 3,
      invitations: 3,
      apiKeys: 1,
      webhooks: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    limits: {
      members: 15,
      invitations: 25,
      apiKeys: 5,
      webhooks: 5,
    },
  },
  business: {
    id: "business",
    name: "Business",
    priceMonthly: 99,
    limits: {
      members: 100,
      invitations: 200,
      apiKeys: 20,
      webhooks: 20,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const isPlan = (value: string): value is PlanId => value in PLANS;