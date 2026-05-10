import type {
  CreateExtractedEntityInput,
  ExtractedEntityDecisionInput,
  ExtractedEntityRecord
} from "@/lib/domain/entities";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedExtractedEntities: ExtractedEntityRecord[] = [
  {
    id: "seed-extracted-denver-care",
    reviewStatus: "pending",
    entityType: "provider",
    name: "Denver Senior Support Center",
    normalizedName: "denver senior support center",
    addressLine1: "1200 Care Way",
    city: "Denver",
    state: "CO",
    postalCode: "80202",
    phone: "303-555-0188",
    websiteUrl: "https://example.com/denver-senior-support",
    categories: ["Home Care", "Senior Resources"],
    rawPayload: { source: "seed-review-queue" },
    extractedFields: { name: "Denver Senior Support Center", city: "Denver", state: "CO" },
    confidenceScore: 0.82,
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || `provider-${Date.now()}`;
}

function mapJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function mapExtractedEntity(row: Record<string, unknown>): ExtractedEntityRecord {
  return {
    id: String(row.id),
    importBatchId: row.import_batch_id ? String(row.import_batch_id) : undefined,
    crawlPageId: row.crawl_page_id ? String(row.crawl_page_id) : undefined,
    reviewStatus: row.review_status as ExtractedEntityRecord["reviewStatus"],
    entityType: String(row.entity_type ?? "provider"),
    name: String(row.name),
    normalizedName: row.normalized_name ? String(row.normalized_name) : undefined,
    addressLine1: row.address_line1 ? String(row.address_line1) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    postalCode: row.postal_code ? String(row.postal_code) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    websiteUrl: row.website_url ? String(row.website_url) : undefined,
    categories: mapTextArray(row.categories),
    rawPayload: mapJson(row.raw_payload),
    extractedFields: mapJson(row.extracted_fields),
    confidenceScore: Number(row.confidence_score ?? 0),
    matchedProviderId: row.matched_provider_id ? String(row.matched_provider_id) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listExtractedEntities(status = "pending"): Promise<ExtractedEntityRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return status === "all" ? seedExtractedEntities : seedExtractedEntities.filter((entity) => entity.reviewStatus === status);
  }

  let query = supabase.from("extracted_entities").select("*").order("created_at", { ascending: false }).limit(100);

  if (status !== "all") {
    query = query.eq("review_status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Extracted entity query failed: ${error.message}`);
  }

  return (data ?? []).map(mapExtractedEntity);
}

export async function createExtractedEntity(input: CreateExtractedEntityInput): Promise<ExtractedEntityRecord> {
  const policy = await runPolicyCheck({
    subjectType: "extracted_entity",
    actionKey: "stage_extracted_entity",
    input: {
      name: input.name,
      websiteUrl: input.websiteUrl,
      categories: input.categories,
      extractedFields: input.extractedFields
    }
  });

  const reviewStatus = policy.decision === "needs_legal_review" ? "needs_legal_review" : "pending";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-extracted-${Date.now()}`,
      importBatchId: input.importBatchId,
      crawlPageId: input.crawlPageId,
      reviewStatus,
      entityType: input.entityType ?? "provider",
      name: input.name,
      normalizedName: input.name.toLowerCase(),
      addressLine1: input.addressLine1,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      phone: input.phone,
      websiteUrl: input.websiteUrl,
      categories: input.categories ?? [],
      rawPayload: input.rawPayload ?? {},
      extractedFields: input.extractedFields ?? {},
      confidenceScore: input.confidenceScore ?? 0,
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("extracted_entities")
    .insert({
      import_batch_id: input.importBatchId,
      crawl_page_id: input.crawlPageId,
      review_status: reviewStatus,
      entity_type: input.entityType ?? "provider",
      name: input.name,
      normalized_name: input.name.toLowerCase(),
      address_line1: input.addressLine1,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      phone: input.phone,
      website_url: input.websiteUrl,
      categories: input.categories ?? [],
      raw_payload: input.rawPayload ?? {},
      extracted_fields: input.extractedFields ?? {},
      confidence_score: input.confidenceScore ?? 0
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Extracted entity staging failed: ${error.message}`);
  }

  return mapExtractedEntity(data);
}

export async function decideExtractedEntity(input: ExtractedEntityDecisionInput) {
  const policy = await runPolicyCheck({
    subjectType: "extracted_entity",
    subjectId: input.entityId,
    actionKey: `${input.decision}_extracted_entity`,
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Extracted entity decision blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return {
      id: input.entityId,
      reviewStatus: policy.decision === "needs_legal_review" ? "needs_legal_review" : input.decision,
      matchedProviderId: input.matchedProviderId,
      adminNotes: input.adminNotes,
      decidedAt: now,
      policyDecision: policy.decision
    };
  }

  const { data: entity, error: entityError } = await supabase
    .from("extracted_entities")
    .select("*")
    .eq("id", input.entityId)
    .single();

  if (entityError) {
    throw new Error(`Extracted entity lookup failed: ${entityError.message}`);
  }

  if (policy.decision === "needs_legal_review") {
    const { data, error } = await supabase
      .from("extracted_entities")
      .update({ review_status: "needs_legal_review" })
      .eq("id", input.entityId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Extracted entity legal hold failed: ${error.message}`);
    }

    return mapExtractedEntity(data);
  }

  if (input.decision === "rejected" || input.decision === "duplicate") {
    const { data, error } = await supabase
      .from("extracted_entities")
      .update({
        review_status: input.decision,
        matched_provider_id: input.matchedProviderId
      })
      .eq("id", input.entityId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Extracted entity decision failed: ${error.message}`);
    }

    await supabase.from("audit_events").insert({
      actor_id: input.actorId,
      actor_type: input.actorId ? "admin" : "system",
      event_type: `extracted_entity.${input.decision}`,
      subject_type: "extracted_entity",
      subject_id: input.entityId,
      payload: { matchedProviderId: input.matchedProviderId, adminNotes: input.adminNotes, policyDecision: policy.decision }
    });

    return mapExtractedEntity(data);
  }

  const providerId = await publishProviderFromEntity(entity, input.matchedProviderId);

  const { data: updatedEntity, error: updateError } = await supabase
    .from("extracted_entities")
    .update({ review_status: "approved", matched_provider_id: providerId })
    .eq("id", input.entityId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Extracted entity approval failed: ${updateError.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "extracted_entity.approved",
    subject_type: "extracted_entity",
    subject_id: input.entityId,
    payload: { providerId, adminNotes: input.adminNotes, policyDecision: policy.decision }
  });

  return mapExtractedEntity(updatedEntity);
}

async function publishProviderFromEntity(entity: Record<string, unknown>, matchedProviderId?: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase admin client unavailable");
  }

  if (matchedProviderId) {
    const { error } = await supabase
      .from("providers")
      .update({
        phone: entity.phone,
        website_url: entity.website_url,
        confidence_score: entity.confidence_score,
        updated_at: new Date().toISOString()
      })
      .eq("id", matchedProviderId);

    if (error) {
      throw new Error(`Matched provider update failed: ${error.message}`);
    }

    return matchedProviderId;
  }

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .insert({
      name: entity.name,
      slug: `${slugify(String(entity.name))}-${String(entity.id).slice(0, 8)}`,
      status: "verified_by_source",
      phone: entity.phone,
      website_url: entity.website_url,
      confidence_score: entity.confidence_score
    })
    .select("id")
    .single();

  if (providerError) {
    throw new Error(`Provider publication failed: ${providerError.message}`);
  }

  const providerId = String(provider.id);

  if (entity.city && entity.state) {
    const { error: locationError } = await supabase.from("provider_locations").insert({
      provider_id: providerId,
      address_line1: entity.address_line1,
      city: entity.city,
      state: entity.state,
      postal_code: entity.postal_code,
      phone: entity.phone
    });

    if (locationError) {
      throw new Error(`Provider location publication failed: ${locationError.message}`);
    }
  }

  const { error: sourceError } = await supabase.from("provider_source_records").insert({
    provider_id: providerId,
    source_url: entity.website_url,
    raw_payload: entity.raw_payload ?? {},
    extracted_fields: entity.extracted_fields ?? {},
    confidence_score: entity.confidence_score ?? 0
  });

  if (sourceError) {
    throw new Error(`Provider source publication failed: ${sourceError.message}`);
  }

  return providerId;
}

