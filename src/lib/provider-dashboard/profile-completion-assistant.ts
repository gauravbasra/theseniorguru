import type { ProviderPortalUpdateInput, ProviderRecord } from "@/lib/domain/providers";
import { getProviderVisibilityReport } from "@/lib/provider-dashboard/visibility-report";
import { getProviderById } from "@/lib/providers";

type CompletionPriority = "critical" | "recommended" | "optional";

type ProfileCompletionSuggestion = {
  key: string;
  label: string;
  priority: CompletionPriority;
  reason: string;
  currentValue?: string;
  suggestedValue?: string;
  updatePayload: Partial<ProviderPortalUpdateInput>;
};

export type ProviderProfileCompletionAssistant = {
  providerId: string;
  providerName: string;
  generatedAt: string;
  completionScore: number;
  missingFields: string[];
  suggestions: ProfileCompletionSuggestion[];
  readyToSubmitFields: string[];
  suggestedPatch: Partial<ProviderPortalUpdateInput>;
  nextAction: string;
};

function hasCompleteAddress(provider: ProviderRecord) {
  return Boolean(provider.address && provider.city && provider.state);
}

function suggestedSummary(provider: ProviderRecord) {
  const categoryText = provider.categories.length ? provider.categories.join(", ") : "senior care services";
  const location = [provider.city, provider.state].filter(Boolean).join(", ");

  return `${provider.name} is a ${categoryText} provider serving families in ${location}. The listing should be verified by the operator with current contact details, service availability, pricing guidance, and photos before families use it for high-confidence care decisions.`;
}

function compactPatch(suggestions: ProfileCompletionSuggestion[]) {
  return suggestions.reduce<Partial<ProviderPortalUpdateInput>>((patch, suggestion) => ({ ...patch, ...suggestion.updatePayload }), {});
}

function readyFields(patch: Partial<ProviderPortalUpdateInput>) {
  return Object.keys(patch).filter((key) => key !== "attestationAccepted" && key !== "providerId" && key !== "actorId");
}

export async function getProviderProfileCompletionAssistant(
  providerId: string
): Promise<ProviderProfileCompletionAssistant> {
  const provider = await getProviderById(providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const visibilityReport = await getProviderVisibilityReport(provider.id);
  const suggestions: ProfileCompletionSuggestion[] = [];

  if (!hasCompleteAddress(provider)) {
    suggestions.push({
      key: "address",
      label: "Verify complete address",
      priority: "critical",
      reason: "A complete address is required for local SEO pages, map confidence, and family trust.",
      currentValue: [provider.address, provider.city, provider.state, provider.zip].filter(Boolean).join(", ") || undefined,
      updatePayload: {}
    });
  }

  if (!provider.phone) {
    suggestions.push({
      key: "phone",
      label: "Add direct business phone",
      priority: "critical",
      reason: "Families need a direct call path, and phone verification depends on an operator-owned number.",
      updatePayload: {}
    });
  }

  if (!provider.websiteUrl) {
    suggestions.push({
      key: "websiteUrl",
      label: "Add official website",
      priority: "recommended",
      reason: "The website helps verify ownership, services, and source freshness before claim approval.",
      updatePayload: {}
    });
  }

  if (!provider.summary || provider.summary.length < 80) {
    const summary = suggestedSummary(provider);
    suggestions.push({
      key: "summary",
      label: "Draft family-facing summary",
      priority: "recommended",
      reason: "A complete summary improves family comparison quality and gives admins a reviewable starting point.",
      currentValue: provider.summary,
      suggestedValue: summary,
      updatePayload: { summary }
    });
  }

  if (!provider.categories.length) {
    suggestions.push({
      key: "categories",
      label: "Choose service categories",
      priority: "critical",
      reason: "Categories power search, city/category SEO pages, and lead routing.",
      updatePayload: {}
    });
  }

  if (!provider.imageUrl) {
    suggestions.push({
      key: "imageUrl",
      label: "Add reviewed profile image",
      priority: "optional",
      reason: "Photos improve trust, but image rights must be reviewed before publication.",
      updatePayload: {}
    });
  }

  const suggestedPatch = compactPatch(suggestions);
  const submitFields = readyFields(suggestedPatch);

  return {
    providerId: provider.id,
    providerName: provider.name,
    generatedAt: new Date().toISOString(),
    completionScore: visibilityReport.profileCompletionScore,
    missingFields: visibilityReport.missingProfileFields,
    suggestions,
    readyToSubmitFields: submitFields,
    suggestedPatch,
    nextAction: submitFields.length
      ? "Review the suggested patch, accept the provider attestation, and submit it to the provider profile audit queue."
      : "Collect the missing owner-controlled details before submitting a provider profile update."
  };
}
