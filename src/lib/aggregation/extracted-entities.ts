import type {
  AssignExtractedEntityReviewInput,
  CreateExtractedEntityInput,
  ExtractedEntityDecisionInput,
  ExtractedEntityReviewEscalationSummary,
  ExtractedEntityReviewAssignmentRecord,
  ExtractedEntityQualityAuditRecord,
  ExtractedEntityQualityAuditResult,
  ExtractedEntityRecord,
  ExtractedEntityReviewQueueItem,
  ExtractedEntityReviewQueueSummary
} from "@/lib/domain/entities";
import type { DataQualityFlagRecord } from "@/lib/domain/imports";
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
const seedQualityFlags: DataQualityFlagRecord[] = [];
const seedReviewAssignments: ExtractedEntityReviewAssignmentRecord[] = [];

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

function mapNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
    addressLine2: row.address_line2 ? String(row.address_line2) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    postalCode: row.postal_code ? String(row.postal_code) : undefined,
    county: row.county ? String(row.county) : undefined,
    latitude: mapNumber(row.latitude),
    longitude: mapNumber(row.longitude),
    phone: row.phone ? String(row.phone) : undefined,
    email: row.email ? String(row.email) : undefined,
    websiteUrl: row.website_url ? String(row.website_url) : undefined,
    categories: mapTextArray(row.categories),
    careTypes: mapTextArray(row.care_types),
    amenities: mapTextArray(row.amenities),
    services: mapTextArray(row.services),
    description: row.description ? String(row.description) : undefined,
    pricingSignals: mapJson(row.pricing_signals),
    licenseFields: mapJson(row.license_fields),
    accreditationFields: mapJson(row.accreditation_fields),
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    sourceRecordId: row.source_record_id ? String(row.source_record_id) : undefined,
    fetchedAt: row.fetched_at ? String(row.fetched_at) : undefined,
    licenseTermsStatus: row.license_terms_status ? String(row.license_terms_status) : undefined,
    robotsDecision: row.robots_decision ? String(row.robots_decision) : undefined,
    extractionConfidence: mapNumber(row.extraction_confidence),
    duplicateMatchData: mapJson(row.duplicate_match_data),
    imageAssets: Array.isArray(row.image_assets) ? row.image_assets : undefined,
    auditTrail: Array.isArray(row.audit_trail) ? row.audit_trail : undefined,
    rawPayload: mapJson(row.raw_payload),
    extractedFields: mapJson(row.extracted_fields),
    confidenceScore: Number(row.confidence_score ?? 0),
    matchedProviderId: row.matched_provider_id ? String(row.matched_provider_id) : undefined,
    createdAt: String(row.created_at)
  };
}

function mapReviewAssignment(row: Record<string, unknown>): ExtractedEntityReviewAssignmentRecord {
  return {
    id: String(row.id),
    entityId: String(row.extracted_entity_id),
    route: row.route as ExtractedEntityReviewAssignmentRecord["route"],
    status: row.status as ExtractedEntityReviewAssignmentRecord["status"],
    assignedTo: String(row.assigned_to),
    assignedBy: row.assigned_by ? String(row.assigned_by) : undefined,
    dueAt: String(row.due_at),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    completedAt: row.completed_at ? String(row.completed_at) : undefined
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

export async function listExistingExtractedEntitySourceRecordIds(sourceRecordIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(sourceRecordIds.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Set();
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return new Set(
      seedExtractedEntities
        .filter((entity) => entity.sourceRecordId && uniqueIds.includes(entity.sourceRecordId))
        .map((entity) => entity.sourceRecordId as string)
    );
  }

  const { data, error } = await supabase
    .from("extracted_entities")
    .select("source_record_id")
    .in("source_record_id", uniqueIds)
    .neq("review_status", "rejected");

  if (error) {
    throw new Error(`Extracted entity source-record lookup failed: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => String(row.source_record_id)).filter(Boolean));
}

function getImageCount(entity: ExtractedEntityRecord) {
  return Array.isArray(entity.imageAssets) ? entity.imageAssets.length : 0;
}

function hasRiskyImageRights(entity: ExtractedEntityRecord) {
  return (entity.imageAssets ?? []).some(
    (image) =>
      image.reviewStatus === "needs_rights_review" ||
      image.reviewStatus === "rejected" ||
      image.storageStatus === "blocked" ||
      image.robotsDecision === "blocked" ||
      image.licenseTermsStatus === "restricted"
  );
}

function scoreEntityQuality(entity: ExtractedEntityRecord, minImages: number): ExtractedEntityQualityAuditRecord {
  const findings: ExtractedEntityQualityAuditRecord["findings"] = [];
  const imageCount = getImageCount(entity);

  if (!entity.addressLine1 || !entity.city || !entity.state) {
    findings.push({
      severity: "high",
      flagKey: "missing_location",
      message: "Listing is missing a complete city/state/address location."
    });
  }

  if (!entity.phone && !entity.websiteUrl && !entity.email) {
    findings.push({
      severity: "high",
      flagKey: "missing_contact_path",
      message: "Listing has no phone, website, or email contact path."
    });
  }

  if (!entity.categories.length && !(entity.careTypes ?? []).length && !(entity.services ?? []).length) {
    findings.push({
      severity: "medium",
      flagKey: "missing_care_taxonomy",
      message: "Listing is missing care categories, care types, and services."
    });
  }

  if (imageCount < minImages) {
    findings.push({
      severity: "low",
      flagKey: "insufficient_images",
      message: `Listing has ${imageCount} approved/staged image${imageCount === 1 ? "" : "s"}; launch target is at least ${minImages}. Save the source now and enrich images later.`
    });
  }

  if (hasRiskyImageRights(entity)) {
    findings.push({
      severity: "critical",
      flagKey: "image_rights_or_robots_risk",
      message: "One or more staged images needs rights review, was rejected, blocked by robots, or has restricted license terms."
    });
  }

  if ((entity.extractionConfidence ?? entity.confidenceScore) < 0.65) {
    findings.push({
      severity: "medium",
      flagKey: "low_extraction_confidence",
      message: "Extraction confidence is below the launch-quality threshold."
    });
  }

  if (entity.robotsDecision === "blocked" || entity.licenseTermsStatus === "restricted") {
    findings.push({
      severity: "critical",
      flagKey: "source_policy_risk",
      message: "Source robots or license terms block automated reuse without review."
    });
  }

  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === "critical") return total + 0.35;
    if (finding.severity === "high") return total + 0.22;
    if (finding.severity === "medium") return total + 0.12;
    return total + 0.05;
  }, 0);
  const qualityScore = Math.max(0, Number((1 - penalty).toFixed(2)));
  const recommendedStatus =
    findings.some((finding) => finding.severity === "critical" || finding.severity === "high") || qualityScore < 0.6
      ? "needs_human_review"
      : entity.reviewStatus;

  return {
    entityId: entity.id,
    name: entity.name,
    reviewStatus: entity.reviewStatus,
    recommendedStatus,
    qualityScore,
    imageCount,
    findings
  };
}

export async function runExtractedEntityQualityAudit(input: {
  status?: ExtractedEntityRecord["reviewStatus"] | "all";
  limit?: number;
  minImages?: number;
  actorId?: string;
} = {}): Promise<ExtractedEntityQualityAuditResult> {
  const minImages = Math.max(1, Math.min(12, input.minImages ?? 3));
  const limit = Math.max(1, Math.min(250, input.limit ?? 100));
  const status = input.status ?? "pending";

  const policy = await runPolicyCheck({
    subjectType: "extracted_entity",
    actionKey: "run_extracted_entity_quality_audit",
    input: {
      status,
      limit,
      minImages
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Extracted entity quality audit blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const results = (status === "all" ? seedExtractedEntities : seedExtractedEntities.filter((entity) => entity.reviewStatus === status))
      .slice(0, limit)
      .map((entity) => scoreEntityQuality(entity, minImages));

    for (const result of results) {
      for (const finding of result.findings) {
        seedQualityFlags.unshift({
          id: `quality-flag-${Date.now()}-${seedQualityFlags.length}`,
          subjectType: "extracted_entity",
          subjectId: result.entityId,
          severity: finding.severity,
          flagKey: finding.flagKey,
          message: finding.message,
          createdAt: new Date().toISOString()
        });
      }
    }

    return {
      audited: results.length,
      flagged: results.filter((result) => result.findings.length > 0).length,
      highRisk: results.filter((result) => result.findings.some((finding) => finding.severity === "critical" || finding.severity === "high")).length,
      minImages,
      results
    };
  }

  let query = supabase.from("extracted_entities").select("*").order("created_at", { ascending: false }).limit(limit);

  if (status !== "all") {
    query = query.eq("review_status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Extracted entity quality audit query failed: ${error.message}`);
  }

  const results = (data ?? []).map((row) => scoreEntityQuality(mapExtractedEntity(row), minImages));
  const flagged = results.filter((result) => result.findings.length > 0);

  for (const result of flagged) {
    for (const finding of result.findings) {
      await supabase.from("data_quality_flags").insert({
        subject_type: "extracted_entity",
        subject_id: result.entityId,
        severity: finding.severity,
        flag_key: finding.flagKey,
        message: finding.message
      });
    }

    if (result.recommendedStatus !== result.reviewStatus) {
      await supabase
        .from("extracted_entities")
        .update({ review_status: result.recommendedStatus })
        .eq("id", result.entityId);
    }
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "extracted_entity.quality_audit_run",
    subject_type: "extracted_entity",
    payload: {
      status,
      limit,
      minImages,
      audited: results.length,
      flagged: flagged.length,
      policyDecision: policy.decision
    }
  });

  return {
    audited: results.length,
    flagged: flagged.length,
    highRisk: results.filter((result) => result.findings.some((finding) => finding.severity === "critical" || finding.severity === "high")).length,
    minImages,
    results
  };
}

function confidenceBand(entity: ExtractedEntityRecord): ExtractedEntityReviewQueueItem["confidenceBand"] {
  const score = entity.extractionConfidence ?? entity.confidenceScore;

  if (score >= 0.82) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

function duplicateRisk(entity: ExtractedEntityRecord): ExtractedEntityReviewQueueItem["duplicateRisk"] {
  const matchScore = Number(entity.duplicateMatchData?.matchScore ?? entity.duplicateMatchData?.topScore ?? 0);
  const candidate = entity.duplicateMatchData?.candidateSourceRecordId ?? entity.duplicateMatchData?.providerId;

  if (matchScore >= 0.82 || entity.reviewStatus === "duplicate") return "high";
  if (matchScore >= 0.65 || candidate) return "medium";
  return "low";
}

function routeForReview(
  entity: ExtractedEntityRecord,
  quality: ExtractedEntityQualityAuditRecord,
  duplicate: ExtractedEntityReviewQueueItem["duplicateRisk"]
): ExtractedEntityReviewQueueItem["route"] {
  const findingKeys = new Set(quality.findings.map((finding) => finding.flagKey));

  if (entity.reviewStatus === "needs_legal_review" || findingKeys.has("source_policy_risk")) return "legal_review";
  if (findingKeys.has("image_rights_or_robots_risk")) return "image_rights_review";
  if (duplicate !== "low") return "duplicate_review";
  if (quality.recommendedStatus === "needs_human_review" || confidenceBand(entity) === "low") return "human_review";
  return "approve_ready";
}

function priorityForReview(
  route: ExtractedEntityReviewQueueItem["route"],
  quality: ExtractedEntityQualityAuditRecord,
  confidence: ExtractedEntityReviewQueueItem["confidenceBand"]
): ExtractedEntityReviewQueueItem["priority"] {
  if (route === "legal_review" || route === "image_rights_review") return "critical";
  if (quality.findings.some((finding) => finding.severity === "high" || finding.severity === "critical")) return "high";
  if (route === "duplicate_review" || route === "human_review" || confidence === "low") return "medium";
  return "low";
}

function nextActionsForReviewItem(item: Omit<ExtractedEntityReviewQueueItem, "nextActions">): string[] {
  if (item.slaStatus === "overdue") {
    return ["Escalate this assigned review because it is past its SLA due date."];
  }

  if (item.slaStatus === "unassigned" && item.route !== "approve_ready") {
    return ["Assign this review to an owner with a due date before approving or publishing the listing."];
  }

  if (item.route === "legal_review") {
    return ["Route the source and extracted fields to owner/legal review before publication."];
  }

  if (item.route === "image_rights_review") {
    return ["Review staged image rights and storage status before publishing any profile media."];
  }

  if (item.route === "duplicate_review") {
    return ["Run duplicate match scoring and decide whether to merge, mark duplicate, or approve as a new provider."];
  }

  if (item.route === "human_review") {
    return ["Have an admin verify location, contact paths, taxonomy, and confidence before approving the listing."];
  }

  return ["Approve the extracted entity or enrich optional profile content before launch publication."];
}

function slaStatusForAssignment(
  assignment: ExtractedEntityReviewAssignmentRecord | undefined,
  route: ExtractedEntityReviewQueueItem["route"]
): ExtractedEntityReviewQueueItem["slaStatus"] {
  if (!assignment) return route === "approve_ready" ? "on_track" : "unassigned";
  if (assignment.status === "completed") return "completed";

  const dueAt = new Date(assignment.dueAt).getTime();
  const now = Date.now();
  const hoursUntilDue = (dueAt - now) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) return "overdue";
  if (hoursUntilDue <= 12) return "due_soon";
  return "on_track";
}

function latestAssignmentForEntity(
  assignments: ExtractedEntityReviewAssignmentRecord[],
  entityId: string
): ExtractedEntityReviewAssignmentRecord | undefined {
  return assignments
    .filter((assignment) => assignment.entityId === entityId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
}

function toReviewQueueItem(
  entity: ExtractedEntityRecord,
  minImages: number,
  assignment?: ExtractedEntityReviewAssignmentRecord
): ExtractedEntityReviewQueueItem {
  const quality = scoreEntityQuality(entity, minImages);
  const confidence = confidenceBand(entity);
  const duplicate = duplicateRisk(entity);
  const route = routeForReview(entity, quality, duplicate);
  const slaStatus = slaStatusForAssignment(assignment, route);
  const blockers = quality.findings
    .filter((finding) => finding.severity === "critical" || finding.severity === "high")
    .map((finding) => finding.message);
  const item = {
    entity,
    quality,
    assignment,
    priority: priorityForReview(route, quality, confidence),
    confidenceBand: confidence,
    duplicateRisk: duplicate,
    route,
    slaStatus,
    blockers
  };

  return {
    ...item,
    nextActions: nextActionsForReviewItem(item)
  };
}

export async function getExtractedEntityReviewQueue(input: {
  status?: ExtractedEntityRecord["reviewStatus"] | "all";
  limit?: number;
  minImages?: number;
} = {}): Promise<ExtractedEntityReviewQueueSummary> {
  const limit = Math.max(1, Math.min(250, input.limit ?? 100));
  const minImages = Math.max(1, Math.min(12, input.minImages ?? 3));
  const status = input.status ?? "all";
  const reviewableStatuses = new Set(["pending", "needs_human_review", "needs_legal_review"]);
  const entities = (await listExtractedEntities(status))
    .filter((entity) => status !== "all" || reviewableStatuses.has(entity.reviewStatus))
    .slice(0, limit);
  const assignments = await listExtractedEntityReviewAssignments(entities.map((entity) => entity.id));
  const items = entities
    .map((entity) => toReviewQueueItem(entity, minImages, latestAssignmentForEntity(assignments, entity.id)))
    .sort((left, right) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 };
      return rank[left.priority] - rank[right.priority] || left.quality.qualityScore - right.quality.qualityScore;
    });
  const totals = {
    entities: items.length,
    approveReady: items.filter((item) => item.route === "approve_ready").length,
    humanReview: items.filter((item) => item.route === "human_review").length,
    legalReview: items.filter((item) => item.route === "legal_review").length,
    imageRightsReview: items.filter((item) => item.route === "image_rights_review").length,
    duplicateReview: items.filter((item) => item.route === "duplicate_review").length,
    lowConfidence: items.filter((item) => item.confidenceBand === "low").length,
    unassigned: items.filter((item) => item.slaStatus === "unassigned").length,
    overdue: items.filter((item) => item.slaStatus === "overdue").length
  };
  const blockers = items
    .filter((item) => item.priority === "critical" || item.priority === "high")
    .flatMap((item) => item.blockers.map((blocker) => `${item.entity.name}: ${blocker}`))
    .slice(0, 10);
  const statusValue =
    totals.overdue > 0 || totals.legalReview > 0 || totals.imageRightsReview > 0
      ? "blocked"
      : totals.unassigned > 0 || totals.humanReview > 0 || totals.duplicateReview > 0 || totals.lowConfidence > 0
        ? "action_required"
        : "ready";

  return {
    generatedAt: new Date().toISOString(),
    status: statusValue,
    minImages,
    totals,
    items,
    blockers,
    nextActions:
      items.length === 0
        ? ["Run approved import batches or launch source seeding to populate the extracted entity review queue."]
        : [
            ...(totals.legalReview + totals.imageRightsReview > 0
              ? ["Clear legal and image-rights review items before approving imported listings."]
              : []),
            ...(totals.overdue > 0 ? ["Escalate overdue extracted entity review assignments."] : []),
            ...(totals.unassigned > 0 ? ["Assign all human, legal, image-rights, and duplicate review records to owners."] : []),
            ...(totals.duplicateReview > 0 ? ["Resolve duplicate-review records before approving new provider inventory."] : []),
            ...(totals.approveReady > 0 ? ["Approve ready records after a final admin spot-check."] : [])
          ]
  };
}

async function listExtractedEntityReviewAssignments(entityIds: string[]): Promise<ExtractedEntityReviewAssignmentRecord[]> {
  if (entityIds.length === 0) return [];

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedReviewAssignments.filter((assignment) => entityIds.includes(assignment.entityId));
  }

  const { data, error } = await supabase
    .from("extracted_entity_review_assignments")
    .select("*")
    .in("extracted_entity_id", entityIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Extracted entity review assignment query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReviewAssignment);
}

async function getExtractedEntityById(entityId: string): Promise<ExtractedEntityRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedExtractedEntities.find((entity) => entity.id === entityId) ?? null;
  }

  const { data, error } = await supabase.from("extracted_entities").select("*").eq("id", entityId).maybeSingle();

  if (error) {
    throw new Error(`Extracted entity lookup failed: ${error.message}`);
  }

  return data ? mapExtractedEntity(data) : null;
}

export async function assignExtractedEntityReview(
  input: AssignExtractedEntityReviewInput
): Promise<ExtractedEntityReviewAssignmentRecord> {
  const entity = await getExtractedEntityById(input.entityId);

  if (!entity) {
    throw new Error("Extracted entity not found");
  }

  const previewItem = toReviewQueueItem(entity, 3);
  const route = input.route ?? previewItem.route;
  const dueAt = input.dueAt ?? new Date(Date.now() + (route === "legal_review" || route === "image_rights_review" ? 24 : 48) * 60 * 60 * 1000).toISOString();
  const policy = await runPolicyCheck({
    subjectType: "extracted_entity_review_assignment",
    subjectId: input.entityId,
    actionKey: "assign_extracted_entity_review",
    input: {
      entityId: input.entityId,
      assignedTo: input.assignedTo,
      route,
      dueAt,
      notes: input.notes
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Extracted entity review assignment blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const assignment: ExtractedEntityReviewAssignmentRecord = {
      id: `extracted-entity-review-assignment-${Date.now()}`,
      entityId: input.entityId,
      route,
      status: "assigned",
      assignedTo: input.assignedTo,
      assignedBy: input.assignedBy,
      dueAt,
      notes: input.notes,
      createdAt: new Date().toISOString()
    };

    seedReviewAssignments.unshift(assignment);
    return assignment;
  }

  await supabase
    .from("extracted_entity_review_assignments")
    .update({ status: "escalated" })
    .eq("extracted_entity_id", input.entityId)
    .in("status", ["assigned", "in_review"]);

  const { data, error } = await supabase
    .from("extracted_entity_review_assignments")
    .insert({
      extracted_entity_id: input.entityId,
      route,
      status: "assigned",
      assigned_to: input.assignedTo,
      assigned_by: input.assignedBy,
      due_at: dueAt,
      notes: input.notes
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Extracted entity review assignment failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.assignedBy,
    actor_type: input.assignedBy ? "admin" : "system",
    event_type: "extracted_entity.review_assigned",
    subject_type: "extracted_entity",
    subject_id: input.entityId,
    payload: { assignedTo: input.assignedTo, route, dueAt, notes: input.notes, policyDecision: policy.decision }
  });

  return mapReviewAssignment(data);
}

export async function getExtractedEntityReviewEscalations(input: {
  limit?: number;
  minImages?: number;
} = {}): Promise<ExtractedEntityReviewEscalationSummary> {
  const queue = await getExtractedEntityReviewQueue({
    status: "all",
    limit: input.limit ?? 100,
    minImages: input.minImages
  });
  const actionableItems = queue.items.filter((item) => item.route !== "approve_ready" || item.slaStatus === "overdue");
  const overdue = actionableItems.filter((item) => item.slaStatus === "overdue");
  const dueSoon = actionableItems.filter((item) => item.slaStatus === "due_soon");
  const unassigned = actionableItems.filter((item) => item.slaStatus === "unassigned");
  const blockedRoutes = actionableItems.filter(
    (item) => item.route === "legal_review" || item.route === "image_rights_review" || item.priority === "critical"
  );
  const status = overdue.length || blockedRoutes.length ? "blocked" : dueSoon.length || unassigned.length ? "attention_needed" : "ready";

  return {
    generatedAt: new Date().toISOString(),
    status,
    totals: {
      entities: queue.totals.entities,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      unassigned: unassigned.length,
      blockedRoutes: blockedRoutes.length
    },
    overdue,
    dueSoon,
    unassigned,
    blockedRoutes,
    nextActions: [
      ...(overdue.length ? ["Escalate overdue review assignments to the launch owner today."] : []),
      ...(blockedRoutes.length ? ["Clear legal and image-rights blocked routes before approving imported listings."] : []),
      ...(dueSoon.length ? ["Remind assigned reviewers before their SLA window closes."] : []),
      ...(unassigned.length ? ["Assign every non-approval-ready review item to a named owner with a due date."] : []),
      ...(!overdue.length && !blockedRoutes.length && !dueSoon.length && !unassigned.length
        ? ["No import review escalations are active. Continue processing approval-ready records."]
        : [])
    ]
  };
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
    const entity: ExtractedEntityRecord = {
      id: `pending-extracted-${Date.now()}`,
      importBatchId: input.importBatchId,
      crawlPageId: input.crawlPageId,
      reviewStatus,
      entityType: input.entityType ?? "provider",
      name: input.name,
      normalizedName: input.name.toLowerCase(),
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      county: input.county,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone,
      email: input.email,
      websiteUrl: input.websiteUrl,
      categories: input.categories ?? [],
      careTypes: input.careTypes ?? [],
      amenities: input.amenities ?? [],
      services: input.services ?? [],
      description: input.description,
      pricingSignals: input.pricingSignals ?? {},
      licenseFields: input.licenseFields ?? {},
      accreditationFields: input.accreditationFields ?? {},
      sourceUrl: input.sourceUrl,
      sourceRecordId: input.sourceRecordId,
      fetchedAt: input.fetchedAt,
      licenseTermsStatus: input.licenseTermsStatus,
      robotsDecision: input.robotsDecision,
      extractionConfidence: input.extractionConfidence,
      duplicateMatchData: input.duplicateMatchData ?? {},
      imageAssets: input.imageAssets ?? [],
      auditTrail: input.auditTrail ?? [],
      rawPayload: input.rawPayload ?? {},
      extractedFields: input.extractedFields ?? {},
      confidenceScore: input.confidenceScore ?? 0,
      createdAt: new Date().toISOString()
    };

    seedExtractedEntities.unshift(entity);

    return entity;
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
      address_line2: input.addressLine2,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      county: input.county,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone,
      email: input.email,
      website_url: input.websiteUrl,
      categories: input.categories ?? [],
      care_types: input.careTypes ?? [],
      amenities: input.amenities ?? [],
      services: input.services ?? [],
      description: input.description,
      pricing_signals: input.pricingSignals ?? {},
      license_fields: input.licenseFields ?? {},
      accreditation_fields: input.accreditationFields ?? {},
      source_url: input.sourceUrl,
      source_record_id: input.sourceRecordId,
      fetched_at: input.fetchedAt,
      license_terms_status: input.licenseTermsStatus,
      robots_decision: input.robotsDecision,
      extraction_confidence: input.extractionConfidence ?? input.confidenceScore ?? 0,
      duplicate_match_data: input.duplicateMatchData ?? {},
      image_assets: input.imageAssets ?? [],
      audit_trail: input.auditTrail ?? [],
      raw_payload: input.rawPayload ?? {},
      extracted_fields: input.extractedFields ?? {},
      confidence_score: input.confidenceScore ?? 0
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Extracted entity staging failed: ${error.message}`);
  }

  if (input.imageAssets?.length) {
    const { error: imageError } = await supabase.from("extracted_entity_images").upsert(
      input.imageAssets.map((image, index) => ({
        extracted_entity_id: data.id,
        image_url: image.url,
        source_url: image.sourceUrl,
        fetched_at: image.fetchedAt,
        license_terms_status: image.licenseTermsStatus,
        robots_decision: image.robotsDecision,
        review_status: image.reviewStatus,
        storage_status: image.storageStatus,
        alt_text: image.altText,
        credit: image.credit,
        ordinal: image.ordinal ?? index + 1
      })),
      { onConflict: "extracted_entity_id,image_url" }
    );

    if (imageError) {
      throw new Error(`Extracted entity image staging failed: ${imageError.message}`);
    }
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
