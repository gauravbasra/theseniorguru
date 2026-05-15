# Source Adapter Object Storage Owner Inputs

The source adapter manifest readiness route now classifies storage schemes and keeps unattended object fetch disabled until owner-controlled access is configured. These items require owner decisions or credentials before implementation can safely move from readiness reporting to live object fetch execution.

## Required owner inputs

- S3: approved role ARN, external ID policy if needed, bucket/path allow-list, network egress expectations, and checksum verification callback requirements.
- GCS: approved service account, bucket/path allow-list, key rotation expectations, and checksum verification callback requirements.
- Azure Blob: approved managed identity or service principal, container/path allow-list, key rotation expectations, and checksum verification callback requirements.
- Supabase Storage: project reference, bucket policy, service role scope, path allow-list, and checksum verification callback requirements.
- Non-secret production readiness keys to set only after approval: `SOURCE_MANIFEST_S3_CREDENTIAL_REF`, `SOURCE_MANIFEST_S3_PATH_ALLOWLIST`, `SOURCE_MANIFEST_GCS_CREDENTIAL_REF`, `SOURCE_MANIFEST_GCS_PATH_ALLOWLIST`, `SOURCE_MANIFEST_AZURE_CREDENTIAL_REF`, `SOURCE_MANIFEST_AZURE_PATH_ALLOWLIST`, `SOURCE_MANIFEST_SUPABASE_STORAGE_CREDENTIAL_REF`, `SOURCE_MANIFEST_SUPABASE_STORAGE_PATH_ALLOWLIST`, `SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED`, `SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED_BY`, and `SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED_AT`.

## Implementation guardrails

- Keep fetch execution disabled for signed object stores until owner credentials are stored in the governed credential vault path.
- Never infer access from a manifest URL alone.
- Verify downloaded bytes against the registered SHA-256 digest before passing records into the payload loader.
- Emit audit evidence for credential reference, bucket/path, digest comparison, record count comparison, and operator or worker actor.
- Use `/api/v1/admin/source-adapter-manifests/credential-readiness` and `/api/v1/admin/source-adapter-manifests/credential-readiness?format=csv` as the owner handoff evidence before enabling live object-store fetches.
