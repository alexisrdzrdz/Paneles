'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/* El sitio estático armaba este menú con site.js mutando el DOM. Dentro de React
   eso provoca desajuste de hidratación y React puede tirar el menú, así que aquí
   se construye como componente reusando las mismas clases del framework. */
export function MenuMovil({ items }: { items: { href: string; label: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  return (
    <div className="nav-mobile" ref={caja}>
      <button className="ui-btn nav-burger" type="button" aria-label="Abrir menú"
              aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>☰</button>
      <div className="ui-menu" hidden={!abierto}>
        {items.map((i) => (
          i.href.endsWith('.html')
            ? <a key={i.href} className="ui-menu-item" href={i.href}>{i.label}</a>
            : <Link key={i.href} className="ui-menu-item" href={i.href}
                    onClick={() => setAbierto(false)}>{i.label}</Link>
        ))}
      </div>
    </div>
  );
}
