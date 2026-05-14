# Source Adapter Object Storage Owner Inputs

The source adapter manifest readiness route now classifies storage schemes and keeps unattended object fetch disabled until owner-controlled access is configured. These items require owner decisions or credentials before implementation can safely move from readiness reporting to live object fetch execution.

## Required owner inputs

- S3: approved role ARN, external ID policy if needed, bucket/path allow-list, network egress expectations, and checksum verification callback requirements.
- GCS: approved service account, bucket/path allow-list, key rotation expectations, and checksum verification callback requirements.
- Azure Blob: approved managed identity or service principal, container/path allow-list, key rotation expectations, and checksum verification callback requirements.
- Supabase Storage: project reference, bucket policy, service role scope, path allow-list, and checksum verification callback requirements.

## Implementation guardrails

- Keep fetch execution disabled for signed object stores until owner credentials are stored in the governed credential vault path.
- Never infer access from a manifest URL alone.
- Verify downloaded bytes against the registered SHA-256 digest before passing records into the payload loader.
- Emit audit evidence for credential reference, bucket/path, digest comparison, record count comparison, and operator or worker actor.
