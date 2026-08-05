'use client';

import { useActionState, useState } from 'react';
import type { CatalogItem } from '@/db/schema';
import { saveItem, deleteItem, type CatalogState } from '@/lib/actions/catalog';
import { formatLength } from '@/lib/units';
import { Notice, Submit } from '@/components/Field';

const CATEGORIES = ['panel','puerta','pilastra','mampara','bisagra','cerradura','jaladera',
  'gancho','escuadra','zapata','riel','tornilleria','corte','mano_obra','flete','otro'] as const;

const CAT_LABEL: Record<string, string> = {
  panel: 'Panel', puerta: 'Puerta', pilastra: 'Pilastra', mampara: 'Mampara',
  bisagra: 'Bisagra', cerradura: 'Cerradura', jaladera: 'Jaladera', gancho: 'Gancho',
  escuadra: 'Escuadra', zapata: 'Zapata', riel: 'Riel', tornilleria: 'Tornillería',
  corte: 'Corte', mano_obra: 'Mano de obra', flete: 'Flete', otro: 'Otro',
};
const MODE_LABEL: Record<string, string> = {
  pieza: 'por pieza', longitud: 'por metro', area: 'por m²', hora: 'por hora',
};
const WASTE_LABEL: Record<string, string> = {
  exacto: 'Exacto',
  pieza_completa: 'Pieza completa',
  redondeo_arriba: 'Redondeo al alza',
};

const pesos = (c: number) => (c / 100).toFixed(2);

export function CatalogTable({ items }: { items: CatalogItem[] }) {
  const [state, action] = useActionState<CatalogState, FormData>(saveItem, {});
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <div className="tbl-head">
        <h2>Piezas</h2>
        <button className="ui-btn" type="button" onClick={() => { setCreating(true); setEditing(null); }}>
          Agregar pieza
        </button>
      </div>

      <Notice state={state} />

      {(creating || editing) && (
        <form action={action} className="cat-form" key={editing ?? 'nuevo'}>
          {editing && <input type="hidden" name="id" value={editing} />}
          <ItemFields item={items.find((i) => i.id === editing)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-3)' }}>
            <Submit>Guardar</Submit>
            <button className="ui-btn" type="button"
                    onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      <table className="cat-tbl">
        <thead>
          <tr>
            <th style={{ width: 34 }} />
            <th>Pieza</th>
            <th>Se vende</th>
            <th>Tramo</th>
            <th>Sobrante</th>
            <th style={{ textAlign: 'right' }}>Precio</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const listo = i.unitPriceCents > 0;
            return (
              <tr key={i.id} className={listo ? '' : 'is-pending'}>
                <td>
                  <span className={listo ? 'chk-on' : 'chk-off'}
                        title={listo ? 'Precio capturado' : 'Falta capturar el precio'}>
                    {listo ? '✓' : '○'}
                  </span>
                </td>
                <td>
                  <b>{i.name}</b>
                  <div className="sub">{CAT_LABEL[i.category]} · <span className="mono">{i.sku}</span></div>
                </td>
                <td>{MODE_LABEL[i.pricingMode]}</td>
                <td className="mono">
                  {i.stockLengthMm ? formatLength(i.stockLengthMm, 'm') : '—'}
                  {i.stockWidthMm ? ` × ${formatLength(i.stockWidthMm, 'm')}` : ''}
                </td>
                <td>{WASTE_LABEL[i.wastePolicy]}</td>
                <td className="mono" style={{ textAlign: 'right' }}>
                  {listo ? `$${pesos(i.unitPriceCents)}` : <span className="chk-off">falta</span>}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="lnk" type="button"
                          onClick={() => { setEditing(i.id); setCreating(false); }}>Editar</button>
                  <button className="lnk danger" type="button"
                          onClick={() => { if (confirm(`¿Retirar "${i.name}" del tabulador?`)) deleteItem(i.id); }}>
                    Retirar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ItemFields({ item }: { item?: CatalogItem }) {
  /* El tramo comercial solo importa si el sobrante se cobra completo; se deja
     visible siempre para no esconder el campo que explica el cobro. */
  return (
    <>
      <div className="ui-form two">
        <div className="ui-field"><label>SKU</label>
          <input name="sku" defaultValue={item?.sku} required placeholder="PANEL-FONDO" /></div>
        <div className="ui-field"><label>Nombre</label>
          <input name="name" defaultValue={item?.name} required placeholder="Panel de fondo" /></div>
      </div>
      <div className="ui-form three">
        <div className="ui-field"><label>Categoría</label>
          <select name="category" defaultValue={item?.category ?? 'otro'}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select></div>
        <div className="ui-field"><label>Se vende</label>
          <select name="pricingMode" defaultValue={item?.pricingMode ?? 'pieza'}>
            {Object.entries(MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div className="ui-field"><label>Precio (pesos)</label>
          <input name="unitPriceCents" defaultValue={item ? pesos(item.unitPriceCents) : ''}
                 inputMode="decimal" placeholder="0.00" /></div>
      </div>
      <div className="ui-form three">
        <div className="ui-field"><label>Tramo comercial (mm)</label>
          <input name="stockLengthMm" defaultValue={item?.stockLengthMm ?? ''}
                 inputMode="numeric" placeholder="6000" /></div>
        <div className="ui-field"><label>Ancho de hoja (mm)</label>
          <input name="stockWidthMm" defaultValue={item?.stockWidthMm ?? ''}
                 inputMode="numeric" placeholder="1500" /></div>
        <div className="ui-field"><label>Qué pasa con el sobrante</label>
          <select name="wastePolicy" defaultValue={item?.wastePolicy ?? 'exacto'}>
            {Object.entries(WASTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
      </div>
      <div className="ui-field"><label>Nota</label>
        <input name="notes" defaultValue={item?.notes ?? ''}
               placeholder="Tramo de 6 m: pedir 6.25 factura 12." /></div>
    </>
  );
}
