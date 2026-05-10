import { seedProviders } from "@/lib/data/seed";
import type { EntityMatchCandidateRecord, EntityMatchResult, ExtractedEntityRecord } from "@/lib/domain/entities";
import type { ProviderRecord } from "@/lib/domain/providers";
import { listProviders } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

function normalize(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/www\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value?: string) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2));
}

function domain(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return normalize(value).split("/")[0];
  }
}

function scoreCandidate(entity: ExtractedEntityRecord, provider: ProviderRecord) {
  const reasons: string[] = [];
  let score = 0;
  const entityName = normalize(entity.name);
  const providerName = normalize(provider.name);

  if (entityName && entityName === providerName) {
    score += 0.55;
    reasons.push("exact_name");
  } else if (entityName && providerName && (entityName.includes(providerName) || providerName.includes(entityName))) {
    score += 0.4;
    reasons.push("name_contains");
  } else {
    const entityTokens = tokenSet(entity.name);
    const providerTokens = tokenSet(provider.name);
    const overlap = [...entityTokens].filter((token) => providerTokens.has(token)).length;
    const denominator = Math.max(entityTokens.size, providerTokens.size, 1);
    const overlapScore = overlap / denominator;

    if (overlapScore > 0) {
      score += overlapScore * 0.35;
      reasons.push("name_token_overlap");
    }
  }

  if (entity.city && entity.state && normalize(entity.city) === normalize(provider.city) && entity.state === provider.state) {
    score += 0.2;
    reasons.push("same_city_state");
  } else if (entity.state && entity.state === provider.state) {
    score += 0.08;
    reasons.push("same_state");
  }

  if (entity.phone && provider.phone && normalize(entity.phone) === normalize(provider.phone)) {
    score += 0.2;
    reasons.push("same_phone");
  }

  if (domain(entity.websiteUrl) && domain(entity.websiteUrl) === domain(provider.websiteUrl)) {
    score += 0.2;
    reasons.push("same_website_domain");
  }

  return {
    score: Math.min(1, Number(score.toFixed(3))),
    reasons
  };
}

function mapCandidate(row: Record<string, unknown>, providerName = "Existing provider"): EntityMatchCandidateRecord {
  return {
    id: String(row.id),
    extractedEntityId: String(row.extracted_entity_id),
    providerId: String(row.provider_id),
    providerName,
    matchScore: Number(row.match_score ?? 0),
    matchReasons: Array.isArray(row.match_reasons) ? row.match_reasons.map(String) : [],
    createdAt: String(row.created_at)
  };
}

async function getExtractedEntity(entityId: string): Promise<ExtractedEntityRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: entityId,
      reviewStatus: "pending",
      entityType: "provider",
      name: "Sample Denver Memory Care",
      city: "Denver",
      state: "CO",
      phone: "303-555-0101",
      websiteUrl: "https://example.com",
      categories: ["Memory Care"],
      rawPayload: {},
      extractedFields: {},
      confidenceScore: 0.8,
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase.from("extracted_entities").select("*").eq("id", entityId).single();

  if (error) {
    throw new Error(`Extracted entity lookup failed: ${error.message}`);
  }

  return {
    id: String(data.id),
    importBatchId: data.import_batch_id ? String(data.import_batch_id) : undefined,
    crawlPageId: data.crawl_page_id ? String(data.crawl_page_id) : undefined,
    reviewStatus: data.review_status,
    entityType: String(data.entity_type ?? "provider"),
    name: String(data.name),
    normalizedName: data.normalized_name ? String(data.normalized_name) : undefined,
    addressLine1: data.address_line1 ? String(data.address_line1) : undefined,
    city: data.city ? String(data.city) : undefined,
    state: data.state ? String(data.state) : undefined,
    postalCode: data.postal_code ? String(data.postal_code) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
    websiteUrl: data.website_url ? String(data.website_url) : undefined,
    categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
    rawPayload: data.raw_payload ?? {},
    extractedFields: data.extracted_fields ?? {},
    confidenceScore: Number(data.confidence_score ?? 0),
    matchedProviderId: data.matched_provider_id ? String(data.matched_provider_id) : undefined,
    createdAt: String(data.created_at)
  };
}

export async function scoreEntityMatchCandidates(entityId: string): Promise<EntityMatchResult> {
  const entity = await getExtractedEntity(entityId);

  if (!entity) {
    throw new Error("Extracted entity not found");
  }

  const providers = getSupabaseAdminClient() ? await listProviders() : seedProviders;
  const ranked = providers
    .map((provider) => {
      const candidate = scoreCandidate(entity, provider);
      return { provider, ...candidate };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const topScore = ranked[0]?.score ?? 0;
  const reviewStatus = topScore >= 0.82 ? "needs_human_review" : entity.reviewStatus;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      entityId,
      reviewStatus,
      candidateCount: ranked.length,
      topScore,
      candidates: ranked.map((candidate, index) => ({
        id: `fallback-match-${index + 1}`,
        extractedEntityId: entityId,
        providerId: candidate.provider.id,
        providerName: candidate.provider.name,
        matchScore: candidate.score,
        matchReasons: candidate.reasons,
        createdAt: new Date().toISOString()
      }))
    };
  }

  const storedCandidates: EntityMatchCandidateRecord[] = [];

  for (const candidate of ranked) {
    const { data, error } = await supabase
      .from("entity_match_candidates")
      .upsert(
        {
          extracted_entity_id: entityId,
          provider_id: candidate.provider.id,
          match_score: candidate.score,
          match_reasons: candidate.reasons
        },
        { onConflict: "extracted_entity_id,provider_id" }
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(`Entity match candidate upsert failed: ${error.message}`);
    }

    storedCandidates.push(mapCandidate(data, candidate.provider.name));
  }

  if (topScore >= 0.82) {
    const { error } = await supabase
      .from("extracted_entities")
      .update({ review_status: "needs_human_review", matched_provider_id: ranked[0]?.provider.id })
      .eq("id", entityId);

    if (error) {
      throw new Error(`Extracted entity match status update failed: ${error.message}`);
    }

    await supabase.from("data_quality_flags").insert({
      subject_type: "extracted_entity",
      subject_id: entityId,
      severity: "high",
      flag_key: "possible_duplicate",
      message: `Possible duplicate of provider ${ranked[0]?.provider.name} with score ${topScore}.`
    });
  }

  return {
    entityId,
    reviewStatus,
    candidateCount: storedCandidates.length,
    topScore,
    candidates: storedCandidates
  };
}

