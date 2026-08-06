'use client';

/* Lleva el proyecto guardado de vuelta al cotizador tal cual se dejó: escribe
   el borrador que el cotizador ya sabe leer y navega. Es una copia de trabajo;
   la solicitud original no cambia. */
export function AbrirEnCotizador({ estado }: { estado: unknown }) {
  const abrir = () => {
    try {
      const d = estado as { room?: unknown } | null;
      if (!d?.room) return;
      localStorage.setItem('mp_cotizador_v1', JSON.stringify({ ...d, step: 4 }));
      /* El cotizador es un archivo estático, no una ruta de Next: aquí la
         navegación de documento completo es la correcta, no el router. */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/cotizador.html';
    } catch { /* sin localStorage no hay viaje: mejor quedarse */ }
  };
  return (
    <button className="ui-btn ui-btn-block" type="button" onClick={abrir}
            style={{ marginTop: 'var(--space-3)' }}>
      Abrir en el cotizador
    </button>
  );
}
