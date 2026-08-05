import Link from 'next/link';

export default function CaducadoPage() {
  return (
    <div className="auth-card">
      <h1>No pudimos confirmar</h1>
      <p className="lead">
        Ese enlace ya caducó, ya se usó o no es válido. Los enlaces de confirmación
        duran 24 horas y solo funcionan una vez.
      </p>
      <Link className="ui-btn ui-btn-primary ui-btn-block" href="/reenviar">Pedir otro enlace</Link>
      <p className="auth-foot"><Link href="/entrar">Volver a entrar</Link></p>
    </div>
  );
}
