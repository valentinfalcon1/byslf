/** ★★★ como separador / detalle de marca. Con `twinkle`, las tres estrellas titilan una tras otra. */
export function Stars({ className = "", twinkle = false }: { className?: string; twinkle?: boolean }) {
  return (
    <span aria-hidden="true" className={`select-none tracking-[0.3em] ${className}`}>
      {twinkle
        ? [0, 1, 2].map((i) => (
            <span key={i} className="twinkle inline-block" style={{ animationDelay: `${i * 0.45}s` }}>
              ★
            </span>
          ))
        : "★★★"}
    </span>
  );
}
