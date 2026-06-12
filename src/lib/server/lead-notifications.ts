import { getAppEnv } from "@/lib/env";

export async function sendLeadNotificationEmail(input: { subject: string; html: string; text: string }) {
  const env = getAppEnv();

  if (!env.resendApiKey || !env.leadNotificationToEmail || !env.leadNotificationFromEmail) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.leadNotificationFromEmail,
      to: env.leadNotificationToEmail,
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Lead notification email failed: ${response.status} ${body}`);
  }
}
