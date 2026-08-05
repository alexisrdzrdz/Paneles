'use client';

import { useActionState, useState } from 'react';
import { calcular, type CalcResult } from '@/lib/actions/calc';
import { formatLength, UNIT_LABEL, type DisplayUnit } from '@/lib/units';
import { Submit } from '@/components/Field';

const MATERIALS = [
  ['hdpe', 'Polietileno HDPE'], ['inox', 'Acero inoxidable'],
  ['compacto', 'Fenólico compacto'], ['metal', 'Acero laminado'],
  ['laminado', 'Laminado plástico'],
] as const;

/* Valores de arranque por unidad, para no obligar a teclear todo de cero. */
const DEFAULTS: Record<DisplayUnit, Record<string, string>> = {
  m:  { stallWidth: '1.5', stallDepth: '1.8', doorOpening: '0.8', urinalWidth: '0.76', urinalDepth: '0.6', height: '1.5' },
  cm: { stallWidth: '150', stallDepth: '180', doorOpening: '80',  urinalWidth: '76',   urinalDepth: '60',  height: '150' },
  in: { stallWidth: '60',  stallDepth: '72',  doorOpening: '32',  urinalWidth: '30',   urinalDepth: '24',  height: '58' },
};

const pesos = (c: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(c / 100);

/* Las cantidades vienen ×1000; se muestran sin ceros de adorno. */
const qty = (milli: number) => {
  const n = milli / 1000;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

export function Calculadora() {
  const [state, action] = useActionState<CalcResult, FormData>(calcular, {});
  const [unit, setUnit] = useState<DisplayUnit>('m');
  const d = DEFAULTS[unit];

  return (
    <div className="calc-cols">
      <form action={action} className="cat-form" style={{ margin: 0 }}>
        <div className="ui-field">
          <label>Unidad de trabajo</label>
          <div className="ui-segmented" style={{ display: 'flex' }}>
            {(Object.keys(UNIT_LABEL) as DisplayUnit[]).map((u) => (
              <button key={u} type="button" style={{ flex: 1 }}
                      className={`ui-seg ${unit === u ? 'is-on' : ''}`}
                      onClick={() => setUnit(u)}>{UNIT_LABEL[u]}</button>
            ))}
          </div>
          <input type="hidden" name="unit" value={unit} />
          <small style={{ color: 'var(--ink-faint)' }}>
            Puedes escribir la unidad y manda sobre esta: «240cm» son 240 cm aunque trabajes en metros.
          </small>
        </div>

        <div className="ui-field"><label>Material</label>
          <select name="materialId" defaultValue="hdpe">
            {MATERIALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>

        <div className="ui-field"><label>Altura del panel</label>
          <input name="height" defaultValue={d.height} key={`h-${unit}`} /></div>

        <h3 style={{ fontSize: 14, margin: 'var(--space-3) 0 var(--space-2)', color: 'var(--ink-dim)' }}>
          Cabinas de inodoro
        </h3>
        <div className="ui-form two">
          <div className="ui-field"><label>Cuántas</label>
            <input name="stalls" defaultValue="4" inputMode="numeric" /></div>
          <div className="ui-field"><label>Ancho</label>
            <input name="stallWidth" defaultValue={d.stallWidth} key={`sw-${unit}`} /></div>
        </div>
        <div className="ui-form two">
          <div className="ui-field"><label>Profundidad</label>
            <input name="stallDepth" defaultValue={d.stallDepth} key={`sd-${unit}`} /></div>
          <div className="ui-field"><label>Apertura de puerta</label>
            <input name="doorOpening" defaultValue={d.doorOpening} key={`do-${unit}`} /></div>
        </div>

        <h3 style={{ fontSize: 14, margin: 'var(--space-3) 0 var(--space-2)', color: 'var(--ink-dim)' }}>
          Mingitorios
        </h3>
        <div className="ui-form three">
          <div className="ui-field"><label>Cuántos</label>
            <input name="urinals" defaultValue="2" inputMode="numeric" /></div>
          <div className="ui-field"><label>Separación</label>
            <input name="urinalWidth" defaultValue={d.urinalWidth} key={`uw-${unit}`} /></div>
          <div className="ui-field"><label>Fondo</label>
            <input name="urinalDepth" defaultValue={d.urinalDepth} key={`ud-${unit}`} /></div>
        </div>

        <label className="ui-check" style={{ marginTop: 'var(--space-3)' }}>
          <input type="checkbox" name="backPanel" defaultChecked /><span>Incluir panel de fondo</span></label>
        <label className="ui-check"><input type="checkbox" name="headrail" /><span>Incluir riel superior</span></label>

        <div style={{ marginTop: 'var(--space-4)' }}><Submit>Calcular material</Submit></div>
      </form>

      <section>
        {state.error && <div className="ui-alert ui-alert-danger">{state.error}</div>}

        {state.geom && (
          <div className="ui-alert ui-alert-info" style={{ marginBottom: 'var(--space-3)' }}>
            <b>Lo que entendí:</b> frente de{' '}
            <span className="mono">{formatLength(state.geom.runLengthMm, unit)}</span>{' '}
            por <span className="mono">{formatLength(state.geom.heightMm, unit)}</span> de alto
            {' '}({state.geom.areaM2.toFixed(2)} m² de superficie).{' '}
            {state.geom.cabinas} cabinas · {state.geom.mingitorios} mingitorios ·{' '}
            {state.geom.puertas} puertas · {state.geom.divAltas} divisiones altas ·{' '}
            {state.geom.divCortas} mamparas cortas.
          </div>
        )}

        {state.faltanPrecios && state.faltanPrecios.length > 0 && (
          <div className="ui-alert" style={{ marginBottom: 'var(--space-3)' }}>
            <b>○ El total está incompleto.</b> Estas piezas del despiece siguen sin precio:{' '}
            {state.faltanPrecios.join(', ')}.
          </div>
        )}

        {state.bom && (
          <>
            <div className="tbl-head"><h2>Despiece</h2></div>
            <div className="tbl-scroll"><table className="cat-tbl">
              <thead>
                <tr>
                  <th style={{ width: 28 }} />
                  <th>Pieza</th>
                  <th style={{ textAlign: 'right' }}>Necesita</th>
                  <th style={{ textAlign: 'right' }}>Se factura</th>
                  <th style={{ textAlign: 'right' }}>Unitario</th>
                  <th style={{ textAlign: 'right' }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {state.bom.lines.map((l) => {
                  const conPrecio = l.unitPriceCents > 0;
                  /* Donde se factura más de lo necesario, ahí está el desperdicio:
                     se marca para que nadie se pregunte de dónde salió el importe. */
                  const hayDesperdicio = l.billedMilli > l.neededMilli;
                  return (
                    <tr key={l.sku} className={conPrecio ? '' : 'is-pending'}>
                      <td><span className={conPrecio ? 'chk-on' : 'chk-off'}>{conPrecio ? '✓' : '○'}</span></td>
                      <td><b>{l.name}</b><div className="sub mono">{l.sku}</div></td>
                      <td className="mono" style={{ textAlign: 'right' }}>{qty(l.neededMilli)} {l.unit}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {qty(l.billedMilli)} {l.unit}
                        {hayDesperdicio && (
                          <div className="sub" style={{ color: 'var(--danger)' }}>
                            +{qty(l.billedMilli - l.neededMilli)} de sobrante
                          </div>
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {conPrecio ? pesos(l.unitPriceCents) : <span className="chk-off">falta</span>}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{pesos(l.totalCents)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', paddingTop: 14 }}><b>Costo de material y mano de obra</b></td>
                  <td className="mono" style={{ textAlign: 'right', paddingTop: 14, fontSize: 18 }}>
                    <b>{pesos(state.bom.subtotalCents)}</b>
                  </td>
                </tr>
              </tfoot>
            </table></div>
          </>
        )}

        {!state.bom && !state.error && (
          <div className="empty">
            <p><b>Captura un proyecto y pulsa «Calcular material».</b></p>
            <p>Sale la lista completa: hojas, tornillos, empaques, corte y mano de obra.</p>
          </div>
        )}
      </section>
    </div>
  );
}
