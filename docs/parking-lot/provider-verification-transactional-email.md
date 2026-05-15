# Provider Verification Transactional Email

## Owner-Dependent Items

- Approve the sender domain and sender address for provider claim verification email.
- Set `MAILJET_API_KEY`, `MAILJET_API_SECRET`, `PROVIDER_VERIFICATION_MAILJET_SENDER_EMAIL`, and `PROVIDER_VERIFICATION_MAILJET_SEND_MODE=live` only after sender approval.
- Keep business-email verification in manual or dry-run mode until launch operations approve the final Mailjet sender identity.

## Implemented Guardrail

- The backend now builds a Mailjet verification email payload preview and blocks live dispatch unless credentials, sender email, and explicit live send mode are all configured.
