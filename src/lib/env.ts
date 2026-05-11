export type AppEnv = {
  appUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  adminAccessCode?: string;
  adminSessionSecret?: string;
  mailjetApiKey?: string;
  mailjetApiSecret?: string;
  googleAdsClientId?: string;
  googleAdsClientSecret?: string;
  googleAdsDeveloperToken?: string;
  vercelEnv?: string;
  vercelUrl?: string;
  vercelGitCommitSha?: string;
};

export function getAppEnv(): AppEnv {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    adminAccessCode: process.env.ADMIN_ACCESS_CODE,
    adminSessionSecret: process.env.ADMIN_SESSION_SECRET,
    mailjetApiKey: process.env.MAILJET_API_KEY,
    mailjetApiSecret: process.env.MAILJET_API_SECRET,
    googleAdsClientId: process.env.GOOGLE_ADS_CLIENT_ID,
    googleAdsClientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    googleAdsDeveloperToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA
  };
}

export function isSupabaseAdminConfigured() {
  const env = getAppEnv();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}
