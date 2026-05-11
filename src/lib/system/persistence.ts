import { getAppEnv, isSupabaseAdminConfigured } from "@/lib/env";

export type PersistenceStatus = {
  generatedAt: string;
  mode: "supabase_persistent" | "fallback_memory";
  writable: boolean;
  durableAcrossDeploys: boolean;
  configured: {
    supabaseUrl: boolean;
    supabaseAnonKey: boolean;
    supabaseServiceRoleKey: boolean;
  };
  ownerActions: string[];
};

export function getPersistenceStatus(): PersistenceStatus {
  const env = getAppEnv();
  const supabaseAdminConfigured = isSupabaseAdminConfigured();
  const fullyConfigured = Boolean(supabaseAdminConfigured && env.supabaseAnonKey);

  return {
    generatedAt: new Date().toISOString(),
    mode: fullyConfigured ? "supabase_persistent" : "fallback_memory",
    writable: true,
    durableAcrossDeploys: fullyConfigured,
    configured: {
      supabaseUrl: Boolean(env.supabaseUrl),
      supabaseAnonKey: Boolean(env.supabaseAnonKey),
      supabaseServiceRoleKey: Boolean(env.supabaseServiceRoleKey)
    },
    ownerActions: fullyConfigured
      ? []
      : [
          "Set NEXT_PUBLIC_SUPABASE_URL in Vercel Production.",
          "Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Production.",
          "Set SUPABASE_SERVICE_ROLE_KEY in Vercel Production.",
          "Apply committed Supabase migrations before running persistent import jobs."
        ]
  };
}
