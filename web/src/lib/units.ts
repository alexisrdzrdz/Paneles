/* Todo se guarda en MILÍMETROS ENTEROS. Metros, centímetros y pulgadas son
   solo cómo se presenta. Así no hay que elegir sistema de una vez para
   siempre, no se arrastra error de redondeo al convertir de ida y vuelta, y
   una obra en metros y otra en pulgadas conviven en la misma base. */

export type UnitSystem = 'metrico' | 'imperial';

export const MM_PER_INCH = 25.4;

export const inchesToMm = (inches: number) => Math.round(inches * MM_PER_INCH);
export const mmToInches = (mm: number) => mm / MM_PER_INCH;
export const metersToMm = (m: number) => Math.round(m * 1000);
export const mmToMeters = (mm: number) => mm / 1000;

/* Fracciones de pulgada: el gremio mide en 1/4, 1/2, 3/4, no en decimales. */
const FRACTIONS: [number, string][] = [
  [0, ''], [0.125, ' 1/8'], [0.25, ' 1/4'], [0.375, ' 3/8'],
  [0.5, ' 1/2'], [0.625, ' 5/8'], [0.75, ' 3/4'], [0.875, ' 7/8'],
];

export function formatLength(mm: number, system: UnitSystem): string {
  if (system === 'metrico') {
    if (mm >= 1000) return `${(mm / 1000).toFixed(mm % 1000 === 0 ? 0 : 2)} m`;
    if (mm >= 10) return `${(mm / 10).toFixed(mm % 10 === 0 ? 0 : 1)} cm`;
    return `${mm} mm`;
  }
  const totalIn = mmToInches(mm);
  const feet = Math.floor(totalIn / 12);
  const restIn = totalIn - feet * 12;
  const whole = Math.floor(restIn);
  const frac = restIn - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  const inPart = `${whole}${best[1]}"`;
  return feet > 0 ? `${feet}'-${inPart}` : inPart;
}

/* Acepta lo que el cliente teclee de verdad: «2.4 m», «240cm», «94.5"»,
   «7' 10 1/2"», «2400». Sin unidad, se asume la del sistema activo.
   Devuelve milímetros enteros, o null si no se entiende. */
export function parseLength(raw: string, system: UnitSystem): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, '.');
  if (!s) return null;

  const m = /^([\d.]+)\s*m$/.exec(s);
  if (m) return metersToMm(parseFloat(m[1]));

  const cm = /^([\d.]+)\s*cm$/.exec(s);
  if (cm) return Math.round(parseFloat(cm[1]) * 10);

  const mm = /^([\d.]+)\s*mm$/.exec(s);
  if (mm) return Math.round(parseFloat(mm[1]));

  /* Pies y pulgadas con fracción: 7' 10 1/2"  ·  7'10"  ·  10 1/2"  ·  94.5" */
  const imp = /^(?:([\d.]+)\s*['’])?\s*(?:([\d.]+))?\s*(?:(\d+)\s*\/\s*(\d+))?\s*["”]?$/.exec(s);
  if (imp && (imp[1] || imp[2] || imp[3])) {
    const hasUnit = /['’"”]/.test(s);
    const feet = imp[1] ? parseFloat(imp[1]) : 0;
    const inch = imp[2] ? parseFloat(imp[2]) : 0;
    const frac = imp[3] && imp[4] ? parseInt(imp[3], 10) / parseInt(imp[4], 10) : 0;
    const total = feet * 12 + inch + frac;
    if (!Number.isFinite(total) || total <= 0) return null;
    /* Un número pelón sin unidad se interpreta según el sistema activo:
       en métrico son milímetros, en imperial son pulgadas. */
    if (!hasUnit && system === 'metrico') return Math.round(total);
    return inchesToMm(total);
  }
  return null;
}

export const money = (cents: number, currency = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
