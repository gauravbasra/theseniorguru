import Image from "next/image";
import type { VisualAsset } from "@/lib/visual-assets";

type ProductVisualProps = {
  asset?: VisualAsset;
  src?: string;
  alt?: string;
  eyebrow?: string;
  title?: string;
  copy?: string;
  className?: string;
  priority?: boolean;
};

export function ProductVisual({ asset, src, alt, eyebrow, title, copy, className = "", priority = false }: ProductVisualProps) {
  const visual = {
    src: asset?.src ?? src ?? "",
    alt: asset?.alt ?? alt ?? "",
    eyebrow: asset?.eyebrow ?? eyebrow ?? "",
    title: asset?.title ?? title ?? "",
    copy: asset?.copy ?? copy ?? ""
  };

  return (
    <figure className={`product-visual ${className}`.trim()}>
      <Image src={visual.src} alt={visual.alt} width={920} height={690} priority={priority} unoptimized />
      <figcaption>
        <span>{visual.eyebrow}</span>
        <strong>{visual.title}</strong>
        <p>{visual.copy}</p>
      </figcaption>
    </figure>
  );
}
