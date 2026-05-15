# Webhook SDK Registry Publishing

## Status

Owner approval and registry security setup are required before webhook SDK packages can be published or linked from public developer docs.

## Current safe path

- Use `/api/v1/partner/webhooks/signing-guide` for authoritative webhook verification examples.
- Use `/api/v1/partner/sdk-package-plan` for package scope, public modules, and release gates.
- Use `/api/v1/partner/sdk-publish-readiness` and `/api/v1/partner/sdk-publish-readiness?format=csv` as the owner handoff evidence before publishing packages.

## Required owner inputs

- `SDK_NPM_ORG_OWNER`, `SDK_NPM_PUBLISH_APPROVED=true`, `SDK_NPM_PROVENANCE_ENABLED=true`, `SDK_NPM_2FA_CONFIRMED=true`, `SDK_NPM_README_REVIEWED=true`, and `SDK_NPM_SMOKE_EVIDENCE_URL`.
- `SDK_PYPI_PROJECT_OWNER`, `SDK_PYPI_PUBLISH_APPROVED=true`, `SDK_PYPI_TRUSTED_PUBLISHING_ENABLED=true`, `SDK_PYPI_2FA_CONFIRMED=true`, `SDK_PYPI_README_REVIEWED=true`, and `SDK_PYPI_SMOKE_EVIDENCE_URL`.

Do not publish package URLs in public docs until owner-controlled registry accounts, signed/provenance-backed release workflows, README review, and deterministic signing-guide smoke evidence are complete.
