/* La hoja del logotipo, tal cual la trae el sitio estático. */
export function Marca({ size = 24 }: { size?: number }) {
  return (
    <svg className="brand-logo" viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <g transform="translate(100,182)" fill="#3a7d2c">
        <path d="M0,0 C -7,-25 -5,-65 0,-92 C 5,-65 7,-25 0,0 Z" />
        <path d="M0,0 C -7,-25 -5,-65 0,-92 C 5,-65 7,-25 0,0 Z" transform="rotate(26) scale(1,.9)" />
        <path d="M0,0 C -7,-25 -5,-65 0,-92 C 5,-65 7,-25 0,0 Z" transform="rotate(-26) scale(1,.9)" />
        <path d="M0,0 C -7,-25 -5,-65 0,-92 C 5,-65 7,-25 0,0 Z" transform="rotate(52) scale(1,.74)" />
        <path d="M0,0 C -7,-25 -5,-65 0,-92 C 5,-65 7,-25 0,0 Z" transform="rotate(-52) scale(1,.74)" />
      </g>
    </svg>
  );
}
