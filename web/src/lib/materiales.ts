/* Los cinco materiales que fabrica Mauricios. Fuente única para el panel y
   las validaciones del servidor; el cotizador estático lleva su propia copia
   (con colores y textos de venta) porque no puede importar de aquí. */
export const MATERIALES = [
  { id: 'laminado', nombre: 'Laminado plástico' },
  { id: 'metal',    nombre: 'Acero laminado' },
  { id: 'hdpe',     nombre: 'Polietileno HDPE' },
  { id: 'compacto', nombre: 'Fenólico compacto' },
  { id: 'inox',     nombre: 'Acero inoxidable' },
] as const;

export type MaterialId = (typeof MATERIALES)[number]['id'];

export const MATERIAL_NOMBRE: Record<string, string> =
  Object.fromEntries(MATERIALES.map((m) => [m.id, m.nombre]));
