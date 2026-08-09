/* Precios de REFERENCIA anclados a mercado (agosto 2026). NO son cotización
   de proveedor: son puntos de partida documentados para que el demo se pare
   sobre algo verificable. Los definitivos los captura el administrador.

   Anclas encontradas:
   · Lámina acero pintro lisa cal 22, 1.22×3.05 m (3.72 m²): $2,845–$3,556
     → ≈ $850/m²  [Claroshop MXNTO-023; Amazon MX MXPNX-005]
   · Placa HDPE 1/2" 24×48" (0.74 m²): ≈ 74.90 USD retail EUA → ≈ $1,800/m²;
     se toma $1,500/m² como mayoreo MX  [BuyPlastic/Professional Plastics]
   · Módulo COMPLETO de mampara comercial 0.90×1.50 m en acero esmaltado:
     ≈ $12,637 en material (distribuidor 2024 +5%)
     [analisisdepreciosunitarios.com] — sirve de sanity check del total.
   · Cuadrilla de instalación: ≈ $1,180/día → ≈ $150/h por persona; cargo
     por hora de cuadrilla con margen: $350/h  [misma fuente]
   · Fenólico compacto e inoxidable: sin precio público MX; se estiman por
     relación de industria (compacto ≈ 1.5× HDPE; inox doble cara).
   · Herrajes: kits bisagra+pasador+jaladera rondan $600–900 en Mercado
     Libre; se desglosan en piezas coherentes con eso.

   Uso:  npm run seed:precios-referencia   (DATABASE_URL del entorno manda) */
import { conectar } from './db.mjs';
const sql = conectar();

/* $/m² por material. OJO: HOJA se vende por ÁREA, así que su precio va POR
   M² tal cual — el motor ya multiplica por los m² facturados (en hojas
   completas de 4.5 m²). Ponerle el precio de la hoja entera lo cobraría
   4.5 veces. */
const M2 = { LAM: 600, MET: 850, HDPE: 1500, COMP: 2200, INOX: 2600 };

const P = {};
for (const [suf, m2] of Object.entries(M2)) {
  P[`HOJA-${suf}`]        = m2;                // por m² (la unidad de venta)
  P[`PUERTA-${suf}`]      = m2 * 1.05 * 1.35;  // pieza: ~1.05 m² + canteado/maquila
  P[`PILASTRA-${suf}`]    = m2 * 0.35 * 1.35;
  P[`MAMPARA-${suf}`]     = m2 * 0.75 * 1.35;
  P[`PANEL-FONDO-${suf}`] = m2 * 1.5 * 1.15;   // por metro lineal, 1.5 m de alto
}

/* Herrajes y consumibles (línea comercial inox 304). */
Object.assign(P, {
  BISAGRA: 120, CERRADURA: 260, JALADERA: 90, GANCHO: 70,
  ESCUADRA: 45, ZAPATA: 180, TAQUETE: 4, TORNILLO: 2.5, PIJA: 2,
  RIEL: 250,            // por metro
  'EMPAQUE-P': 25,      // por metro
  'EMPAQUE-U': 35, SELLO: 95, CORTE: 80,
  INSTALACION: 350,     // por hora de cuadrilla
  FLETE: 1800,          // entrega local; foráneo se ajusta en firme
  'TIRA-PRIV': 180,     // agregado por cabina con privacidad
  'KIT-ADA': 950,       // agregado por cabina accesible
});

/* Un update que no encuentra su SKU es un error silencioso: se avisa. */
let ok = 0;
for (const [sku, pesos] of Object.entries(P)) {
  const r = await sql`update catalog_items set unit_price_cents = ${Math.round(pesos * 100)}, updated_at = now()
            where sku = ${sku}`;
  if (r.count === 0) console.warn(`⚠  SKU sin renglón en el catálogo: ${sku} (¿corriste seed:catalog?)`);
  else ok++;
}
console.log(`Precios de REFERENCIA cargados en ${ok} de ${Object.keys(P).length} piezas.`);
console.log('Anclados a mercado ago-2026; los definitivos los captura el admin.');
await sql.end();
