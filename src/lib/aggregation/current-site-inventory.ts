import { runImportBatch } from "@/lib/aggregation/import-worker";
import { seedProviders } from "@/lib/data/seed";
import type { ImportBatchRunResult, ImportRecordInput } from "@/lib/domain/imports";

export function getCurrentSiteInventoryRecords(): ImportRecordInput[] {
  return seedProviders.map((provider) => ({
    name: provider.name,
    addressLine1: provider.address,
    city: provider.city,
    state: provider.state,
    postalCode: provider.zip,
    phone: provider.phone,
    websiteUrl: provider.websiteUrl,
    categories: provider.categories,
    sourceUrl: provider.source.url,
    sourceRecordId: provider.id,
    confidenceScore: provider.confidenceScore,
    rawPayload: {
      importedFrom: "current_theseniorguru_site",
      provider
    },
    extractedFields: {
      name: provider.name,
      address: provider.address,
      city: provider.city,
      state: provider.state,
      sourceName: provider.source.name,
      priceLabel: provider.priceLabel,
      summary: provider.summary,
      imageUrl: provider.imageUrl
    }
  }));
}

export async function runCurrentSiteInventoryImport(input: {
  dryRun?: boolean;
  actorId?: string;
}): Promise<ImportBatchRunResult & { source: string }> {
  const result = await runImportBatch("current-site-inventory", {
    dryRun: input.dryRun ?? true,
    actorId: input.actorId,
    records: getCurrentSiteInventoryRecords()
  });

  return {
    ...result,
    source: "current_theseniorguru_site"
  };
}
