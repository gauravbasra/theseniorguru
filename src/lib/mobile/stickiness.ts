import type {
  AddCareCircleMemberInput,
  CareCircleMemberRecord,
  CareCircleRecord,
  CreateCareCircleInput,
  SavedProviderRecord,
  SaveProviderInput
} from "@/lib/domain/mobile";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedSavedProviders: SavedProviderRecord[] = [];
const seedCareCircles: CareCircleRecord[] = [];
const seedCareCircleMembers: CareCircleMemberRecord[] = [];

function mapTags(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function mapJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapSavedProvider(row: Record<string, unknown>): SavedProviderRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    providerId: String(row.provider_id),
    notes: row.notes ? String(row.notes) : undefined,
    tags: mapTags(row.tags),
    createdAt: String(row.created_at)
  };
}

function mapCareCircle(row: Record<string, unknown>): CareCircleRecord {
  return {
    id: String(row.id),
    ownerUserKey: String(row.owner_user_key),
    name: String(row.name),
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    goals: mapJson(row.goals),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapCareCircleMember(row: Record<string, unknown>): CareCircleMemberRecord {
  return {
    id: String(row.id),
    careCircleId: String(row.care_circle_id),
    displayName: String(row.display_name),
    email: row.email ? String(row.email) : undefined,
    role: row.role as CareCircleMemberRecord["role"],
    inviteStatus: row.invite_status as CareCircleMemberRecord["inviteStatus"],
    createdAt: String(row.created_at)
  };
}

export async function listSavedProviders(userKey: string): Promise<SavedProviderRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedSavedProviders.filter((item) => item.userKey === userKey);
  }

  const { data, error } = await supabase
    .from("saved_providers")
    .select("*")
    .eq("user_key", userKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Saved provider query failed: ${error.message}`);
  }

  return (data ?? []).map(mapSavedProvider);
}

export async function saveProvider(input: SaveProviderInput): Promise<SavedProviderRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "saved_provider",
    subjectId: input.providerId,
    actionKey: "save_provider",
    input: {
      userKey: input.userKey,
      providerId: input.providerId,
      notes: input.notes,
      tags: input.tags
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Saved provider blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-saved-provider-${Date.now()}`,
      userKey: input.userKey,
      providerId: input.providerId,
      notes: input.notes,
      tags: input.tags ?? [],
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("saved_providers")
    .upsert(
      {
        user_key: input.userKey,
        provider_id: input.providerId,
        notes: input.notes,
        tags: input.tags ?? []
      },
      { onConflict: "user_key,provider_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Saved provider upsert failed: ${error.message}`);
  }

  return mapSavedProvider(data);
}

export async function listCareCircles(userKey: string): Promise<CareCircleRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCareCircles.filter((circle) => circle.ownerUserKey === userKey);
  }

  const { data, error } = await supabase
    .from("care_circles")
    .select("*")
    .eq("owner_user_key", userKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Care circle query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCareCircle);
}

export async function createCareCircle(input: CreateCareCircleInput): Promise<CareCircleRecord> {
  const policy = await runPolicyCheck({
    subjectType: "care_circle",
    actionKey: "create_care_circle",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Care circle blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return {
      id: `pending-care-circle-${Date.now()}`,
      ownerUserKey: input.ownerUserKey,
      name: input.name,
      city: input.city,
      state: input.state,
      goals: input.goals ?? {},
      createdAt: now,
      updatedAt: now
    };
  }

  const { data, error } = await supabase
    .from("care_circles")
    .insert({
      owner_user_key: input.ownerUserKey,
      name: input.name,
      city: input.city,
      state: input.state,
      goals: input.goals ?? {}
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Care circle creation failed: ${error.message}`);
  }

  return mapCareCircle(data);
}

export async function listCareCircleMembers(careCircleId: string): Promise<CareCircleMemberRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCareCircleMembers.filter((member) => member.careCircleId === careCircleId);
  }

  const { data, error } = await supabase
    .from("care_circle_members")
    .select("*")
    .eq("care_circle_id", careCircleId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Care circle member query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCareCircleMember);
}

export async function addCareCircleMember(input: AddCareCircleMemberInput): Promise<CareCircleMemberRecord> {
  const policy = await runPolicyCheck({
    subjectType: "care_circle_member",
    subjectId: input.careCircleId,
    actionKey: "invite_care_circle_member",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Care circle member invite blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-care-circle-member-${Date.now()}`,
      careCircleId: input.careCircleId,
      displayName: input.displayName,
      email: input.email,
      role: input.role ?? "family",
      inviteStatus: "pending",
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("care_circle_members")
    .insert({
      care_circle_id: input.careCircleId,
      display_name: input.displayName,
      email: input.email,
      role: input.role ?? "family"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Care circle member invite failed: ${error.message}`);
  }

  return mapCareCircleMember(data);
}

