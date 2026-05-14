# Vendor Feed Credentials

Status: owner-dependent

The vendor feed workflow now records safe metadata through `/api/v1/admin/vendor-feed-connections`.

Do not paste vendor secrets into the admin API. Store secrets in the owner-approved vault or deployment secret manager and record only a `credentialReference`.

Owner decisions needed before live vendor imports:

- Approve each vendor contract or data-use agreement.
- Provide credential references after secrets are stored in the vault.
- Approve source field mapping for provider name, address, contact, license, category, and source provenance fields.
- Provide a sample feed file or sandbox endpoint for import-runner verification.
- Confirm whether vendor imports should run through scheduled workers or manual launch batches.
