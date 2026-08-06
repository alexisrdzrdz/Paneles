/* Datos del tabulador: piezas y reglas de armado. Un solo lugar para dos
   consumidores: el seed de desarrollo (seed-catalog.mjs) y el asistente de
   instalación que viaja en el paquete de producción (iniciar.js).
   LOS PRECIOS VAN EN CERO A PROPÓSITO: los captura el administrador. */

/* Los cinco materiales que fabrica el taller (mismos ids que el cotizador).
   Las piezas HECHAS del material (hoja, fondo, puerta, pilastra, mampara) se
   siembran una vez por material, con su material_id: así el motor cobra la
   puerta de inoxidable distinta de la de laminado. Los herrajes, consumibles,
   mano de obra y flete son comunes. */
export const MATERIALES = [
  ['laminado', 'laminado plástico'],
  ['metal',    'acero laminado'],
  ['hdpe',     'HDPE'],
  ['compacto', 'fenólico compacto'],
  ['inox',     'acero inoxidable'],
];
const SUFIJO = { laminado: 'LAM', metal: 'MET', hdpe: 'HDPE', compacto: 'COMP', inox: 'INOX' };

/* sku base, nombre base, categoría, modo, largo (mm), ancho (mm), sobrante, nota */
const POR_MATERIAL = [
  ['HOJA',        'Hoja 3 × 1.5 m de',        'panel',    'area',     3000, 1500, 'pieza_completa', 'Hoja de 4.5 m². El sobrante se cobra completo.'],
  ['PANEL-FONDO', 'Panel de fondo de',        'panel',    'longitud', 6000, null, 'pieza_completa', 'Tramo de 6 m: pedir 6.25 factura 12.'],
  ['PUERTA',      'Puerta de cabina de',      'puerta',   'pieza',    null, null, 'exacto',         ''],
  ['PILASTRA',    'Pilastra de',              'pilastra', 'pieza',    null, null, 'exacto',         ''],
  ['MAMPARA',     'Mampara de mingitorio de', 'mampara',  'pieza',    null, null, 'exacto',         ''],
];

/* sku, nombre, categoría, modo, largo comercial (mm), ancho (mm), sobrante, nota, material */
export const ITEMS = [
  ['RIEL',       'Riel superior',                'riel',        'longitud', 6000, null, 'pieza_completa', 'Solo si el cliente lo pide.'],
  ['BISAGRA',    'Bisagra',                      'bisagra',     'pieza',    null, null, 'exacto',         ''],
  ['CERRADURA',  'Cerradura con indicador',      'cerradura',   'pieza',    null, null, 'exacto',         ''],
  ['JALADERA',   'Jaladera',                     'jaladera',    'pieza',    null, null, 'exacto',         ''],
  ['GANCHO',     'Gancho de ropa',               'gancho',      'pieza',    null, null, 'exacto',         ''],
  ['ESCUADRA',   'Escuadra de fijación',         'escuadra',    'pieza',    null, null, 'exacto',         ''],
  ['ZAPATA',     'Zapata de piso',               'zapata',      'pieza',    null, null, 'exacto',         ''],
  ['TAQUETE',    'Taquete de expansión',         'tornilleria', 'pieza',    null, null, 'exacto',         ''],
  ['TORNILLO',   'Tornillo inoxidable',          'tornilleria', 'pieza',    null, null, 'exacto',         ''],
  ['PIJA',       'Pija autoperforante',          'tornilleria', 'pieza',    null, null, 'exacto',         ''],
  ['EMPAQUE-P',  'Empaque perimetral',           'empaque',     'longitud', 5000, null, 'pieza_completa', 'Rollo de 5 m.'],
  ['EMPAQUE-U',  'Empaque de unión entre hojas', 'empaque',     'pieza',    null, null, 'exacto',         ''],
  ['SELLO',      'Sello de silicón',             'empaque',     'pieza',    null, null, 'exacto',         'Cartucho.'],
  ['CORTE',      'Corte y canteado',             'corte',       'pieza',    null, null, 'exacto',         'Por pieza maquinada.'],
  ['INSTALACION','Instalación',                  'mano_obra',   'hora',     null, null, 'exacto',         'Horas por cabina.'],
  ['FLETE',      'Flete',                        'flete',       'pieza',    null, null, 'exacto',         ''],
];
for (const [matId, matNombre] of MATERIALES) {
  for (const [base, nombre, cat, modo, largo, ancho, sobrante, nota] of POR_MATERIAL) {
    ITEMS.push([`${base}-${SUFIJO[matId]}`, `${nombre} ${matNombre}`, cat, modo, largo, ancho, sobrante, nota, matId]);
  }
}

/* Reglas de las piezas por material: las mismas para cada variante; el motor
   ya solo usa la variante del material elegido. */
const REGLAS_MATERIAL = [
  ['HOJA',        [['division_alta', 'por_mm2', 1000], ['division_corta', 'por_mm2', 1000]]],
  ['PANEL-FONDO', [['panel_fondo', 'por_mm', 1000]]],
  ['PUERTA',      [['puerta', 'fija', 1000]]],
  ['PILASTRA',    [['division_alta', 'fija', 1000]]],
  ['MAMPARA',     [['division_corta', 'fija', 1000]]],
];

/* sku, objetivo, base, cantidad (×1000). Esto es el "cada tornillo cuenta". */
export const RULES = [
  ['RIEL',       'hilera',         'por_mm',  1000],
  ['BISAGRA',    'puerta',         'fija',    2000],   // 2 por puerta
  ['CERRADURA',  'puerta',         'fija',    1000],
  ['JALADERA',   'puerta',         'fija',    1000],
  ['GANCHO',     'puerta',         'fija',    1000],
  ['ESCUADRA',   'division_alta',  'fija',    2000],
  ['ESCUADRA',   'division_corta', 'fija',    2000],
  ['ZAPATA',     'division_alta',  'fija',    1000],
  ['TAQUETE',    'division_alta',  'fija',    4000],   // 4 al piso/muro
  ['TAQUETE',    'division_corta', 'fija',    2000],
  ['TORNILLO',   'puerta',         'fija',    8000],   // bisagras + cerradura
  ['TORNILLO',   'division_alta',  'fija',    6000],
  ['PIJA',       'hilera',         'fija',    8000],
  ['EMPAQUE-P',  'division_alta',  'por_mm',  1000],
  ['EMPAQUE-U',  'division_alta',  'fija',    2000],
  ['SELLO',      'proyecto',       'fija',    2000],
  ['CORTE',      'division_alta',  'fija',    1000],
  ['CORTE',      'division_corta', 'fija',    1000],
  ['INSTALACION','cabina',         'fija',    1500],   // 1.5 h por cabina
  ['INSTALACION','mingitorio',     'fija',     750],
  ['FLETE',      'proyecto',       'fija',    1000],
];
for (const [matId] of MATERIALES) {
  for (const [base, reglas] of REGLAS_MATERIAL) {
    for (const [target, basis, qty] of reglas) {
      RULES.push([`${base}-${SUFIJO[matId]}`, target, basis, qty]);
    }
  }
}

/* Siembra piezas y reglas con `sql` (cliente postgres-js). Borra y recrea:
   es la estructura del tabulador, no los datos de los clientes. */
export async function sembrarCatalogo(sql) {
  await sql`delete from assembly_rules`;
  await sql`delete from catalog_items`;
  const ids = {};
  for (const [sku, name, category, mode, len, wid, waste, notes, materialId] of ITEMS) {
    const [row] = await sql`
      insert into catalog_items (sku, name, category, pricing_mode, unit_price_cents,
                                 stock_length_mm, stock_width_mm, waste_policy, notes, material_id)
      values (${sku}, ${name}, ${category}, ${mode}, 0,
              ${len}, ${wid}, ${waste}, ${notes || null}, ${materialId || null})
      returning id`;
    ids[sku] = row.id;
  }
  for (const [sku, target, basis, qty] of RULES) {
    await sql`insert into assembly_rules (item_id, target, basis, qty_milli)
              values (${ids[sku]}, ${target}, ${basis}, ${qty})`;
  }
  return { piezas: ITEMS.length, reglas: RULES.length };
}
