import Image from "next/image";

type ProductVisualProps = {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  copy: string;
  className?: string;
  priority?: boolean;
};

export function ProductVisual({ src, alt, eyebrow, title, copy, className = "", priority = false }: ProductVisualProps) {
  return (
    <figure className={`product-visual ${className}`.trim()}>
      <Image src={src} alt={alt} width={920} height={690} priority={priority} unoptimized />
      <figcaption>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <p>{copy}</p>
      </figcaption>
    </figure>
  );
}
