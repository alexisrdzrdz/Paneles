/* Todo se guarda en MILÍMETROS ENTEROS. Metros, centímetros y pulgadas son
   solo cómo se presenta. Así no hay que elegir sistema de una vez para
   siempre, no se arrastra error de redondeo al convertir de ida y vuelta, y
   una obra en metros y otra en pulgadas conviven en la misma base. */

/* Tres unidades de trabajo, no dos: hay obra que se habla en metros, plano que
   se acota en centímetros y catálogo que viene en pulgadas. */
export type DisplayUnit = 'm' | 'cm' | 'in';

export const UNIT_LABEL: Record<DisplayUnit, string> = {
  m: 'Metros', cm: 'Centímetros', in: 'Pulgadas',
};
export const UNIT_SUFFIX: Record<DisplayUnit, string> = { m: 'm', cm: 'cm', in: '"' };

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

export function formatLength(mm: number, unit: DisplayUnit): string {
  if (unit === 'm')  return `${(mm / 1000).toFixed(mm % 1000 === 0 ? 0 : 2)} m`;
  if (unit === 'cm') return `${(mm / 10).toFixed(mm % 10 === 0 ? 0 : 1)} cm`;
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
   «7' 10 1/2"», «2400». Una unidad escrita SIEMPRE gana sobre la activa; un
   número pelón se interpreta en la unidad de trabajo.
   Devuelve milímetros enteros, o null si no se entiende. */
export function parseLength(raw: string, unit: DisplayUnit): number | null {
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
    if (hasUnit) return inchesToMm(total);         // llevaba ' o ": son pulgadas
    /* Número pelón: manda la unidad de trabajo. */
    if (unit === 'm')  return metersToMm(total);
    if (unit === 'cm') return Math.round(total * 10);
    return inchesToMm(total);
  }
  return null;
}

export const money = (cents: number, currency = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
