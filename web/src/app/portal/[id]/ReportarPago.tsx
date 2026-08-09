'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/* El cliente ya transfirió: aquí reporta cuánto y sube su comprobante.
   Sin pasarelas — la cuenta es directa y el staff valida contra el banco. */
export function ReportarPago({ quoteId, instrucciones }: { quoteId: string; instrucciones: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<{ enviando?: boolean; error?: string; ok?: boolean }>({});

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setEstado({ enviando: true });
    try {
      const res = await fetch('/api/comprobantes', { method: 'POST', body: new FormData(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setEstado({ error: data.error || 'No se pudo enviar. Intenta otra vez.' }); return; }
      setEstado({ ok: true });
      router.refresh();
    } catch {
      setEstado({ error: 'Sin conexión. Revisa tu internet e intenta otra vez.' });
    }
  }

  if (estado.ok) {
    return (
      <div className="ui-alert ui-alert-ok" style={{ marginTop: 'var(--space-3)' }}>
        <b>Comprobante recibido.</b> Lo validamos contra el banco y te avisamos;
        aquí mismo verás el pago como confirmado.
      </div>
    );
  }

  return (
    <details className="pago-form">
      <summary className="ui-btn ui-btn-primary">Ya transferí — subir comprobante</summary>
      <div className="ui-alert ui-alert-info" style={{ margin: 'var(--space-3) 0' }}>
        <b>Datos para tu transferencia:</b> {instrucciones}
      </div>
      {estado.error && <div className="ui-alert ui-alert-danger">{estado.error}</div>}
      <form onSubmit={enviar} className="gestion-form">
        <input type="hidden" name="quoteId" value={quoteId} />
        <div className="ui-field"><label>Monto transferido (pesos)</label>
          <input name="monto" inputMode="decimal" required placeholder="p. ej. 20,000" /></div>
        <div className="ui-field"><label>Referencia o folio (opcional)</label>
          <input name="referencia" placeholder="El folio que te dio tu banco" /></div>
        <div className="ui-field" style={{ gridColumn: '1 / -1' }}>
          <label>Comprobante (foto o PDF, máx. 4 MB)</label>
          <input name="archivo" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" /></div>
        <div className="ui-field" style={{ gridColumn: '1 / -1' }}>
          <label>Nota (opcional)</label>
          <input name="nota" placeholder="Anticipo, liquidación…" /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <button className="ui-btn ui-btn-primary" type="submit" disabled={estado.enviando}>
            {estado.enviando ? 'Enviando…' : 'Enviar comprobante'}
          </button>
        </div>
      </form>
    </details>
  );
}
