import type { SVGProps } from "react";

// Íconos de línea, stroke 2. Decorativos por defecto (aria-hidden); el botón que los contiene lleva el aria-label.
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

type P = SVGProps<SVGSVGElement>;

export const SearchIcon = (p: P) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
);
export const BagIcon = (p: P) => (
  <Icon {...p}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Icon>
);
export const GlobeIcon = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></Icon>
);
export const MenuIcon = (p: P) => (
  <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
);
export const CloseIcon = (p: P) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const ArrowRightIcon = (p: P) => (
  <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
);
export const PlusIcon = (p: P) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const MinusIcon = (p: P) => (
  <Icon {...p}><path d="M5 12h14" /></Icon>
);
export const ChevronDownIcon = (p: P) => (
  <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
);
export const InstagramIcon = (p: P) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></Icon>
);
