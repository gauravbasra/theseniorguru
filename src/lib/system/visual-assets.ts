import { existsSync } from "node:fs";
import { join } from "node:path";
import { listVisualAssetsBySurface, type VisualAsset, type VisualAssetSurface } from "@/lib/visual-assets";

export type VisualAssetReadinessItem = {
  key: string;
  src: string;
  audience: VisualAsset["audience"];
  surfaces: VisualAssetSurface[];
  approvedFor: string[];
  status: "ready" | "needs_attention";
  checks: {
    fileExists: boolean;
    hasSpecificAltText: boolean;
    hasContextMessaging: boolean;
    hasMappedSurface: boolean;
    hasProvenance: boolean;
    phiSafe: boolean;
  };
};

function publicAssetExists(src: string) {
  const relativePath = src.replace(/^\/+/, "");
  return existsSync(join(process.cwd(), "public", relativePath.replace(/^public\//, "")));
}

function readinessForAsset(asset: VisualAsset): VisualAssetReadinessItem {
  const checks = {
    fileExists: publicAssetExists(asset.src),
    hasSpecificAltText: asset.alt.length >= 80 && /senior|care|living|provider|family/i.test(asset.alt),
    hasContextMessaging: asset.title.length >= 24 && asset.copy.length >= 80 && asset.intent.length >= 40,
    hasMappedSurface: asset.surfaces.length > 0,
    hasProvenance: asset.source.type === "owned_illustration" && asset.source.provenance.length >= 40,
    phiSafe: asset.source.phiRisk === "none"
  };
  const status = Object.values(checks).every(Boolean) ? "ready" : "needs_attention";

  return {
    key: asset.key,
    src: asset.src,
    audience: asset.audience,
    surfaces: asset.surfaces,
    approvedFor: asset.source.approvedFor,
    status,
    checks
  };
}

export function getVisualAssetReadiness(audience?: VisualAsset["audience"], surface?: VisualAssetSurface) {
  const assets = listVisualAssetsBySurface(surface, audience);
  const items = assets.map(readinessForAsset);
  const ready = items.filter((item) => item.status === "ready").length;

  return {
    generatedAt: new Date().toISOString(),
    status: ready === items.length ? "passed" : "needs_attention",
    total: items.length,
    ready,
    needsAttention: items.length - ready,
    assets: items,
    nextActions:
      ready === items.length
        ? ["Owned contextual visual assets are ready for the mapped public surfaces."]
        : ["Review missing asset files, alt text specificity, provenance, or PHI safety flags before publishing."]
  };
}
