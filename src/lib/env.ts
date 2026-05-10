export type AppEnv = {
  appUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  mailjetApiKey?: string;
  mailjetApiSecret?: string;
  googleAdsClientId?: string;
  googleAdsClientSecret?: string;
  googleAdsDeveloperToken?: string;
};

export function getAppEnv(): AppEnv {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    mailjetApiKey: process.env.MAILJET_API_KEY,
    mailjetApiSecret: process.env.MAILJET_API_SECRET,
    googleAdsClientId: process.env.GOOGLE_ADS_CLIENT_ID,
    googleAdsClientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    googleAdsDeveloperToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  };
}

export function isSupabaseAdminConfigured() {
  const env = getAppEnv();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}
