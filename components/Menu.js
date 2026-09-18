'use client';
import { usePathname } from 'next/navigation';

export default function Menu({ grupos }) {
  const atual = usePathname();
  return (
    <nav className="menu" aria-label="Menu principal">
      {grupos.map((g) => (
        <div key={g.titulo || 'topo'} style={{ display: 'contents' }}>
          {g.titulo && <div className="menu-grupo">{g.titulo}</div>}
          {g.itens.map((i) => {
            const ativo = i.href === '/' ? atual === '/' : atual.startsWith(i.href);
            return (
              <a key={i.href} href={i.href} className={ativo ? 'ativo' : ''} aria-current={ativo ? 'page' : undefined}>
                <span>{i.rotulo}</span>
                {i.etiqueta && <span className="etq">{i.etiqueta}</span>}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
