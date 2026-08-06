import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { catalogItems, assemblyRules } from '@/db/schema';
import { currentUser, isAdmin } from '@/lib/auth';
import { CatalogTable } from './CatalogTable';
import { RulesTable } from './RulesTable';

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  if (!isAdmin(user)) redirect('/portal');

  const items = await db.query.catalogItems.findMany({
    where: eq(catalogItems.active, true),
    orderBy: [asc(catalogItems.category), asc(catalogItems.name)],
  });
  const rules = await db.query.assemblyRules.findMany({
    where: eq(assemblyRules.active, true),
    orderBy: [asc(assemblyRules.target)],
  });

  const conPrecio = items.filter((i) => i.unitPriceCents > 0).length;
  const listo = conPrecio === items.length && items.length > 0;

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Tabulador</h1>
          <p>De aquí sale todo el precio. Lo que no esté capturado aquí, se cotiza en cero.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <a className="ui-btn" href="/admin/solicitudes">Solicitudes</a>
          <a className="ui-btn ui-btn-primary" href="/admin/calculadora">Calculadora de material</a>
        </div>
      </div>

      {/* Estado de captura con palomas, no con una columna de ceros. */}
      <div className={`ui-alert ${listo ? 'ui-alert-ok' : 'ui-alert-info'}`} style={{ marginBottom: 'var(--space-4)' }}>
        {listo ? (
          <><b>✓ Tabulador completo.</b> Todas las piezas tienen precio.</>
        ) : (
          <>
            <b>Falta capturar precios.</b> Las piezas marcadas con <span className="chk-off">○</span> siguen
            en cero y no suman al presupuesto.
          </>
        )}
      </div>

      <CatalogTable items={items} />
      <RulesTable rules={rules} items={items} />
    </>
  );
}
