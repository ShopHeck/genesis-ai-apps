import { useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserPlan = "free" | "pro" | "studio";

export interface AuthState {
  user: User | null;
  session: Session | null;
  plan: UserPlan;
  monthlyUsage: number;
  loading: boolean;
}

const PLAN_LIMITS: Record<UserPlan, number> = {
  free: 3,
  pro: 30,
  studio: Infinity,
};

export function getPlanLimit(plan: UserPlan) {
  return PLAN_LIMITS[plan];
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [plan, setPlan] = useState<UserPlan>("free");
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchPlanAndUsage(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchPlanAndUsage(session.user.id);
      else {
        setPlan("free");
        setMonthlyUsage(0);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchPlanAndUsage(userId: string) {
    try {
      const [planResult, usageResult] = await Promise.all([
        supabase.rpc("get_user_plan", { p_user_id: userId }),
        supabase.rpc("count_monthly_generations", { p_user_id: userId }),
      ]);
      setPlan((planResult.data as UserPlan) ?? "free");
      setMonthlyUsage((usageResult.data as number) ?? 0);
    } catch {
      // default to free on error
    } finally {
      setLoading(false);
    }
  }

  return { user, session, plan, monthlyUsage, loading };
}

export async function signOut() {
  await supabase.auth.signOut();
}
