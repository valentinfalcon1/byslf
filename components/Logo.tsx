import Image from "next/image";

const files = {
  wordmark: { src: "/img/logo/wordmark.png", w: 1200, h: 382, alt: "BYSLF" },
  monogram: { src: "/img/logo/monogram.png", w: 300, h: 346, alt: "BY" },
  stars: { src: "/img/logo/stars.png", w: 700, h: 311, alt: "BYSLF — tres estrellas" },
  // secondary (slate) trae el fondo incluido: usar sobre `night`. El resto es transparente.
  primary: { src: "/img/logo/byslf.png", w: 1600, h: 988, alt: "BYSLF — logo" },
  secondary: { src: "/img/logo/secondary.png", w: 900, h: 543, alt: "BYSLF — logo" },
} as const;

export function Logo({
  variant,
  className = "",
  priority = false,
  decorative = false,
}: {
  variant: keyof typeof files;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const f = files[variant];
  return <Image src={f.src} width={f.w} height={f.h} alt={decorative ? "" : f.alt} priority={priority} className={className} />;
}
