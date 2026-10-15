import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Freemium plan state (see DESIGN.md, section 3).
 * Free: up to FREE_ITEM_LIMIT items, adding is gated at the limit —
 * viewing and searching existing items is never gated.
 * Pro is stored locally in this prototype; production uses store
 * billing (RevenueCat) and this module becomes a thin wrapper over it.
 */
export type PlanKind = 'free' | 'pro';

export const FREE_ITEM_LIMIT = 30;

/** Test pricing — placeholders to validate before launch. */
export const PRICING = {
  monthly: { price: '£2.99', period: 'month' },
  yearly: { price: '£23.99', period: 'year', perMonth: '£2.00', saving: 'Save 33%', trial: '7-day free trial' },
} as const;

const PLAN_KEY = '@findit/plan/v1';

export async function loadPlan(): Promise<PlanKind> {
  try {
    const value = await AsyncStorage.getItem(PLAN_KEY);
    return value === 'pro' ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}

export async function savePlan(plan: PlanKind): Promise<void> {
  await AsyncStorage.setItem(PLAN_KEY, plan);
}

export function canAddItem(plan: PlanKind, itemCount: number): boolean {
  return plan === 'pro' || itemCount < FREE_ITEM_LIMIT;
}
