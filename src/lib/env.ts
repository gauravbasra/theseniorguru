export type AppEnv = {
  appUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  adminAccessCode?: string;
  adminSessionSecret?: string;
  webhookSigningEncryptionKey?: string;
  cronSecret?: string;
  sourceAcquisitionCronMode?: string;
  sourceAcquisitionCronMaxRecords?: string;
  newsroomRssCronMode?: string;
  newsroomRssCronLimit?: string;
  webhookRetryCronMode?: string;
  webhookRetryCronLimit?: string;
  sourceManifestFetchCronMode?: string;
  sourceManifestFetchCronLimit?: string;
  importEscalationRetryCronMode?: string;
  importEscalationRetryCronLimit?: string;
  importEscalationRetryCronProvider?: string;
  mailjetApiKey?: string;
  mailjetApiSecret?: string;
  providerVerificationMailjetSenderEmail?: string;
  providerVerificationMailjetSenderName?: string;
  providerVerificationMailjetSendMode?: string;
  newsletterMailjetSenderEmail?: string;
  newsletterMailjetSendMode?: string;
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
    webhookSigningEncryptionKey: process.env.WEBHOOK_SIGNING_ENCRYPTION_KEY,
    cronSecret: process.env.CRON_SECRET,
    sourceAcquisitionCronMode: process.env.SOURCE_ACQUISITION_CRON_MODE,
    sourceAcquisitionCronMaxRecords: process.env.SOURCE_ACQUISITION_CRON_MAX_RECORDS,
    newsroomRssCronMode: process.env.NEWSROOM_RSS_CRON_MODE,
    newsroomRssCronLimit: process.env.NEWSROOM_RSS_CRON_LIMIT,
    webhookRetryCronMode: process.env.WEBHOOK_RETRY_CRON_MODE,
    webhookRetryCronLimit: process.env.WEBHOOK_RETRY_CRON_LIMIT,
    sourceManifestFetchCronMode: process.env.SOURCE_MANIFEST_FETCH_CRON_MODE,
    sourceManifestFetchCronLimit: process.env.SOURCE_MANIFEST_FETCH_CRON_LIMIT,
    importEscalationRetryCronMode: process.env.IMPORT_ESCALATION_RETRY_CRON_MODE,
    importEscalationRetryCronLimit: process.env.IMPORT_ESCALATION_RETRY_CRON_LIMIT,
    importEscalationRetryCronProvider: process.env.IMPORT_ESCALATION_RETRY_CRON_PROVIDER,
    mailjetApiKey: process.env.MAILJET_API_KEY,
    mailjetApiSecret: process.env.MAILJET_API_SECRET,
    providerVerificationMailjetSenderEmail: process.env.PROVIDER_VERIFICATION_MAILJET_SENDER_EMAIL,
    providerVerificationMailjetSenderName: process.env.PROVIDER_VERIFICATION_MAILJET_SENDER_NAME,
    providerVerificationMailjetSendMode: process.env.PROVIDER_VERIFICATION_MAILJET_SEND_MODE,
    newsletterMailjetSenderEmail: process.env.NEWSLETTER_MAILJET_SENDER_EMAIL,
    newsletterMailjetSendMode: process.env.NEWSLETTER_MAILJET_SEND_MODE,
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
