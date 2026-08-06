/* Marca genérica: tres paneles con separaciones, en el acento del sitio.
   Es un marcador de posición deliberado hasta que exista identidad propia. */
export function Marca({ size = 24 }: { size?: number }) {
  return (
    <svg className="brand-logo" viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <g fill="#4a7c7b">
        <rect x="34" y="48" width="34" height="112" rx="10" />
        <rect x="83" y="28" width="34" height="132" rx="10" />
        <rect x="132" y="48" width="34" height="112" rx="10" />
      </g>
    </svg>
  );
}
