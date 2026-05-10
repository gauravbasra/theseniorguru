import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAppEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const env = getAppEnv();

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return null;
  }

  adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return adminClient;
}

