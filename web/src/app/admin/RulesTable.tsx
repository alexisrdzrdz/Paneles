'use client';

import { useActionState, useState } from 'react';
import type { AssemblyRule, CatalogItem } from '@/db/schema';
import { saveRule, deleteRule, type CatalogState } from '@/lib/actions/catalog';
import { Notice, Submit } from '@/components/Field';

const TARGETS = [
  ['cabina', 'por cada cabina'],
  ['mingitorio', 'por cada mingitorio'],
  ['puerta', 'por cada puerta'],
  ['division_alta', 'por cada división alta'],
  ['division_corta', 'por cada mampara corta'],
  ['hilera', 'por cada hilera'],
  ['panel_fondo', 'por el panel de fondo'],
  ['proyecto', 'una vez por proyecto'],
  ['privacidad', 'por cada cabina con privacidad'],
  ['ada', 'por cada cabina accesible (ADA)'],
] as const;

const BASES = [
  ['fija', 'cantidad fija'],
  ['por_mm', 'por metro lineal'],
  ['por_mm2', 'por metro cuadrado'],
] as const;

const label = (list: readonly (readonly [string, string])[], v: string) =>
  list.find((x) => x[0] === v)?.[1] ?? v;

export function RulesTable({ rules, items }: { rules: AssemblyRule[]; items: CatalogItem[] }) {
  const [state, action] = useActionState<CatalogState, FormData>(saveRule, {});
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <section>
      <div className="tbl-head">
        <h2>Reglas de armado</h2>
        <button className="ui-btn" type="button" onClick={() => { setCreating(true); setEditing(null); }}>
          Agregar regla
        </button>
      </div>
      <p className="ui-meta" style={{ marginTop: 0 }}>
        Esto es lo que traduce el dibujo en piezas: cuántas bisagras lleva una puerta,
        cuántos taquetes una división, cuántas horas de instalación una cabina.
      </p>

      <Notice state={state} />

      {(creating || editing) && (
        <form action={action} className="cat-form" key={editing ?? 'nueva'}>
          {editing && <input type="hidden" name="id" value={editing} />}
          {(() => {
            const r = rules.find((x) => x.id === editing);
            return (
              <div className="ui-form four">
                <div className="ui-field"><label>Pieza</label>
                  <select name="itemId" defaultValue={r?.itemId ?? ''} required>
                    <option value="" disabled>Elige…</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select></div>
                <div className="ui-field"><label>Se aplica</label>
                  <select name="target" defaultValue={r?.target ?? 'cabina'}>
                    {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
                <div className="ui-field"><label>Cómo se calcula</label>
                  <select name="basis" defaultValue={r?.basis ?? 'fija'}>
                    {BASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
                <div className="ui-field"><label>Cantidad</label>
                  <input name="qtyMilli" inputMode="decimal" required
                         defaultValue={r ? String(r.qtyMilli / 1000) : '1'} placeholder="2" /></div>
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-3)' }}>
            <Submit>Guardar</Submit>
            <button className="ui-btn" type="button"
                    onClick={() => { setCreating(false); setEditing(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="tbl-scroll"><table className="cat-tbl">
        <thead>
          <tr>
            <th style={{ width: 34 }} />
            <th>Pieza</th>
            <th>Se aplica</th>
            <th>Cantidad</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => {
            const item = byId.get(r.itemId);
            /* La paloma mira el precio de la pieza: una regla perfecta sobre una
               pieza sin precio sigue cotizando en cero. */
            const listo = !!item && item.unitPriceCents > 0;
            return (
              <tr key={r.id} className={listo ? '' : 'is-pending'}>
                <td><span className={listo ? 'chk-on' : 'chk-off'}
                          title={listo ? 'Lista' : 'La pieza no tiene precio'}>{listo ? '✓' : '○'}</span></td>
                <td><b>{item?.name ?? '—'}</b></td>
                <td>{label(TARGETS, r.target)}</td>
                <td className="mono">
                  {r.qtyMilli / 1000} <span className="sub">{label(BASES, r.basis)}</span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="lnk" type="button"
                          onClick={() => { setEditing(r.id); setCreating(false); }}>Editar</button>
                  <button className="lnk danger" type="button"
                          onClick={() => { if (confirm('¿Borrar esta regla?')) deleteRule(r.id); }}>Borrar</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </section>
  );
}
